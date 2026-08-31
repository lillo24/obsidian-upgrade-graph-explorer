import type {
  ProjectionWorkspace,
  ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import { parseGraphQuery } from '@icarus-graph-explorer/graph-query';

import { restorePersistedWorkspaceView } from './restore';
import {
  PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION,
  type PersistedViewportAnchor,
  type PersistedWorkspaceView,
} from './types';
import { validatePersistedWorkspaceView } from './validation';

export interface CreatePersistedWorkspaceViewInput {
  readonly workspace: ProjectionWorkspace;
  readonly state: ViewProjectionState;
  readonly viewport?: PersistedViewportAnchor;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort(compareText);
}

export function createPersistedWorkspaceView({
  workspace,
  state,
  viewport,
}: CreatePersistedWorkspaceViewInput): PersistedWorkspaceView {
  const parsedQuery =
    state.filters?.query === undefined
      ? undefined
      : parseGraphQuery(state.filters.query);
  if (parsedQuery !== undefined && !parsedQuery.valid) {
    const first = parsedQuery.issues[0];
    throw new Error(
      `Cannot persist invalid graph query${
        first === undefined
          ? '.'
          : ` at character ${first.position + 1}: ${first.message}`
      }`,
    );
  }
  const collapsedEntityIds = sortedUnique(state.disclosure.collapsedEntityIds);
  const collapsed = new Set(collapsedEntityIds);
  const candidate: PersistedWorkspaceView = {
    schemaVersion: PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION,
    workspaceId: workspace.snapshot().workspace.id,
    projection: {
      disclosure: {
        defaultDepth: state.disclosure.defaultDepth,
        ...(state.disclosure.maxSectionLevel === undefined
          ? {}
          : { maxSectionLevel: state.disclosure.maxSectionLevel }),
        expandedEntityIds: sortedUnique(
          state.disclosure.expandedEntityIds,
        ).filter((entityId) => !collapsed.has(entityId)),
        collapsedEntityIds,
        includeBlocks: state.disclosure.includeBlocks,
      },
      ...(state.focus === undefined ? {} : { focus: state.focus }),
      ...(state.filters === undefined
        ? {}
        : {
            filters: {
              ...(state.filters.pathPrefixes === undefined
                ? {}
                : { pathPrefixes: sortedUnique(state.filters.pathPrefixes) }),
              ...(state.filters.entityKinds === undefined
                ? {}
                : { entityKinds: sortedUnique(state.filters.entityKinds) }),
              ...(state.filters.referenceStatuses === undefined
                ? {}
                : {
                    referenceStatuses: sortedUnique(
                      state.filters.referenceStatuses,
                    ),
                  }),
              ...(parsedQuery === undefined
                ? {}
                : { query: parsedQuery.canonical }),
            },
          }),
    },
    ...(viewport === undefined ? {} : { viewport }),
  };
  const validation = validatePersistedWorkspaceView(candidate);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Cannot persist invalid view state${first === undefined ? '.' : `: ${first.path} ${first.message}`}`,
    );
  }
  const restored = restorePersistedWorkspaceView(workspace, validation.value);
  const normalized: PersistedWorkspaceView = {
    schemaVersion: PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION,
    workspaceId: candidate.workspaceId,
    projection: {
      disclosure: restored.state.disclosure,
      ...(restored.state.focus === undefined
        ? {}
        : { focus: restored.state.focus }),
      ...(restored.state.filters === undefined
        ? {}
        : { filters: restored.state.filters }),
    },
    ...(restored.viewport === undefined ? {} : { viewport: restored.viewport }),
  };
  return normalized;
}

export function serializePersistedWorkspaceView(
  value: PersistedWorkspaceView,
): string {
  const validation = validatePersistedWorkspaceView(value);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Cannot serialize invalid view state${first === undefined ? '.' : `: ${first.path} ${first.message}`}`,
    );
  }
  return JSON.stringify(validation.value);
}
