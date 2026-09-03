import type {
  AddressableEntity,
  KnowledgeSnapshot,
  Reference,
  SourceSpan,
} from '@icarus-graph-explorer/core';
import {
  createProjectionWorkspace,
  projectLocalView,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import { createFocusSchematicModel } from './model';

export interface GraphReference {
  readonly source: string;
  readonly target?: string;
  readonly status?: 'unresolved' | 'invalid' | 'ambiguous';
  readonly candidates?: readonly string[];
  readonly sourceEntityId?: string;
  readonly targetEntityId?: string;
}

const span = (line: number): SourceSpan => ({
  start: { line, column: 1, offset: line * 10 },
  end: { line, column: 2, offset: line * 10 + 1 },
});

export function graphFixture(input: {
  readonly root: string;
  readonly documents: readonly string[];
  readonly references: readonly GraphReference[];
  readonly direction?: 'incoming' | 'outgoing' | 'both';
  readonly hops?: 1 | 2 | 3;
  readonly filters?: ViewProjectionState['filters'];
  readonly withStructure?: boolean;
}) {
  const entities: AddressableEntity[] = input.documents.flatMap((id) => {
    const path = `${id}.md`;
    const document: AddressableEntity = {
      id,
      kind: 'document',
      source: { path, span: span(1) },
    };
    return input.withStructure
      ? [
          document,
          {
            id: `${id}-section`,
            kind: 'section',
            parentId: id,
            title: 'Synthetic',
            level: 1,
            source: { path, span: span(2) },
          },
        ]
      : [document];
  });
  const references: Reference[] = input.references.map((item, index) => {
    const status = item.status;
    const resolution: Reference['resolution'] =
      status === 'unresolved'
        ? { status, reason: 'Synthetic missing target.' }
        : status === 'invalid'
          ? { status, reason: 'Synthetic invalid target.' }
          : status === 'ambiguous'
            ? {
                status,
                candidateEntityIds: item.candidates ?? [],
                reason: 'Synthetic ambiguity.',
              }
            : {
                status: 'resolved',
                targetEntityId: item.targetEntityId ?? item.target ?? '',
              };
    return {
      id: `reference-${index}`,
      kind: 'link',
      sourceEntityId: item.sourceEntityId ?? item.source,
      rawTarget: item.target ?? status ?? '',
      sourceSpan: span(10 + index),
      resolution,
    };
  });
  const snapshot: KnowledgeSnapshot = {
    schemaVersion: 1,
    workspace: { id: 'synthetic-focus-schematic' },
    entities,
    references,
  };
  const workspace = createProjectionWorkspace(snapshot);
  const state: ViewProjectionState = {
    disclosure: {
      defaultDepth: input.withStructure ? 3 : 0,
      expandedEntityIds: input.withStructure ? input.documents : [],
      collapsedEntityIds: [],
      includeBlocks: true,
    },
    focus: {
      rootEntityId: input.root,
      hops: input.hops ?? 3,
      direction: input.direction ?? 'both',
      hierarchyContext: 'ancestors-and-children',
    },
    ...(input.filters === undefined ? {} : { filters: input.filters }),
  };
  const projection = projectLocalView(workspace, state);
  return {
    workspace,
    state,
    projection,
    model: createFocusSchematicModel({ workspace, state, projection }),
  };
}
