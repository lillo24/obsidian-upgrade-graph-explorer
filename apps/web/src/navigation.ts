import type { EntityId, EntityKind } from '@icarus-graph-explorer/core';
import {
  projectView,
  revealEntityInViewState,
  type ProjectionNodeId,
  type ProjectionWorkspace,
  type ViewProjectionFilters,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

export type NavigationFilterChange =
  'path-scope-cleared' | 'entity-kind-included' | 'projected-text-cleared';

export type EntityNavigationPlan =
  | {
      readonly ok: true;
      readonly state: ViewProjectionState;
      readonly projectionNodeId: ProjectionNodeId;
      readonly filterChanges: readonly NavigationFilterChange[];
      readonly announcement: string;
    }
  | { readonly ok: false; readonly message: string };

function pathMatches(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function projectedTextMatches(
  path: string,
  kind: EntityKind,
  title: string | undefined,
  text: string,
): boolean {
  const query = text.trim().toLocaleLowerCase('en-US');
  if (query.length === 0) return true;
  return (
    path.toLocaleLowerCase('en-US').includes(query) ||
    (kind === 'section' &&
      (title?.toLocaleLowerCase('en-US').includes(query) ?? false))
  );
}

function navigationFilters(
  filters: ViewProjectionFilters | undefined,
  target: ReturnType<ProjectionWorkspace['requireEntity']>,
): {
  readonly filters: ViewProjectionFilters | undefined;
  readonly changes: readonly NavigationFilterChange[];
} {
  if (filters === undefined) return { filters: undefined, changes: [] };
  const changes: NavigationFilterChange[] = [];
  const keepPath =
    filters.pathPrefixes === undefined ||
    pathMatches(target.source.path, filters.pathPrefixes);
  if (!keepPath) changes.push('path-scope-cleared');

  const entityKinds = filters.entityKinds;
  const kindAllowed =
    entityKinds === undefined || entityKinds.includes(target.kind);
  if (!kindAllowed) changes.push('entity-kind-included');

  const keepText =
    filters.text === undefined ||
    projectedTextMatches(
      target.source.path,
      target.kind,
      target.kind === 'section' ? target.title : undefined,
      filters.text,
    );
  if (!keepText) changes.push('projected-text-cleared');

  const next: ViewProjectionFilters = {
    ...(keepPath && filters.pathPrefixes !== undefined
      ? { pathPrefixes: filters.pathPrefixes }
      : {}),
    ...(keepText && filters.text !== undefined ? { text: filters.text } : {}),
    ...(entityKinds === undefined
      ? {}
      : {
          entityKinds: kindAllowed
            ? entityKinds
            : [...new Set([...entityKinds, target.kind])].sort(),
        }),
    ...(filters.referenceStatuses === undefined
      ? {}
      : { referenceStatuses: filters.referenceStatuses }),
  };
  const hasFilters =
    next.pathPrefixes !== undefined ||
    next.text !== undefined ||
    next.entityKinds !== undefined ||
    next.referenceStatuses !== undefined;
  return { filters: hasFilters ? next : undefined, changes };
}

function fileName(path: string): string {
  return path.split('/').at(-1) ?? path;
}

function changeAnnouncement(
  changes: readonly NavigationFilterChange[],
): string {
  if (changes.length === 0) return '';
  const labels = changes.map((change) => {
    switch (change) {
      case 'path-scope-cleared':
        return 'Path scope cleared';
      case 'entity-kind-included':
        return 'Entity kind included';
      case 'projected-text-cleared':
        return 'Projected text filter cleared';
    }
  });
  return ` ${labels.join('; ')} to reveal the target.`;
}

export function planEntityNavigation(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
  entityId: EntityId,
): EntityNavigationPlan {
  const target = workspace.entity(entityId);
  if (target === undefined) {
    return {
      ok: false,
      message: `Cannot navigate: entity "${entityId}" is no longer present in the loaded report.`,
    };
  }
  const unfocused: ViewProjectionState = {
    disclosure: state.disclosure,
    ...(state.filters === undefined ? {} : { filters: state.filters }),
  };
  const revealed = revealEntityInViewState(workspace, unfocused, entityId);
  const filtered = navigationFilters(revealed.filters, target);
  const nextState: ViewProjectionState = {
    disclosure: revealed.disclosure,
    ...(filtered.filters === undefined ? {} : { filters: filtered.filters }),
  };
  const projection = projectView(workspace, nextState);
  const projectedNode = projection.nodes.find(
    (node) => node.kind === 'entity' && node.entityId === entityId,
  );
  if (projectedNode === undefined) {
    return {
      ok: false,
      message: `Cannot navigate to "${entityId}": KG6 did not project the revealed canonical target.`,
    };
  }
  return {
    ok: true,
    state: nextState,
    projectionNodeId: projectedNode.id,
    filterChanges: filtered.changes,
    announcement: `Revealed ${target.kind} in ${fileName(target.source.path)}.${changeAnnouncement(filtered.changes)}`,
  };
}

export function topLevelPathScopes(
  workspace: ProjectionWorkspace,
): readonly string[] {
  return [
    ...new Set(
      workspace
        .entities()
        .filter((entity) => entity.kind === 'document')
        .flatMap((entity) => {
          const separator = entity.source.path.indexOf('/');
          return separator === -1
            ? []
            : [entity.source.path.slice(0, separator)];
        }),
    ),
  ].sort((left, right) => left.localeCompare(right));
}
