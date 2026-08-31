import { describe, expect, it } from 'vitest';

import type {
  AddressableEntity,
  KnowledgeSnapshot,
} from '@icarus-graph-explorer/core';
import {
  createProjectionWorkspace,
  projectView,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import {
  containingDocumentEntityId,
  effectiveGlobalProjectionState,
} from './global-view';

function source(path: string, line: number) {
  return {
    path,
    span: {
      start: { line, column: 1, offset: line },
      end: { line, column: 2, offset: line + 1 },
    },
  };
}

const entities: readonly AddressableEntity[] = [
  { id: 'doc', kind: 'document', source: source('folder/A.md', 1) },
  {
    id: 'section',
    kind: 'section',
    parentId: 'doc',
    title: 'Heading',
    level: 1,
    source: source('folder/A.md', 2),
  },
  {
    id: 'block',
    kind: 'block',
    parentId: 'section',
    source: source('folder/A.md', 3),
  },
];
const snapshot: KnowledgeSnapshot = {
  schemaVersion: 1,
  workspace: { id: 'workspace' },
  entities,
  references: [],
};
const expanded: ViewProjectionState = {
  disclosure: {
    defaultDepth: 3,
    expandedEntityIds: ['doc', 'section'],
    collapsedEntityIds: [],
    includeBlocks: true,
  },
  focus: {
    rootEntityId: 'section',
    hops: 1,
    direction: 'both',
    hierarchyContext: 'ancestors-and-children',
  },
};

describe('effective Global KG6 state', () => {
  it('maps section focus to its file without mutating Structure disclosure', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const before = JSON.stringify(expanded);
    const global = effectiveGlobalProjectionState(workspace, expanded);
    const projection = projectView(workspace, global);
    expect(global.disclosure.defaultDepth).toBe(0);
    expect(global.focus?.rootEntityId).toBe('doc');
    expect(global.filters?.referenceStatuses).toEqual(['resolved']);
    expect(
      projection.nodes.every(
        (node) => node.kind !== 'entity' || node.entityKind === 'document',
      ),
    ).toBe(true);
    expect(projection.edges.every((edge) => edge.kind === 'reference')).toBe(
      true,
    );
    expect(JSON.stringify(expanded)).toBe(before);
    expect(containingDocumentEntityId(workspace, 'block')).toBe('doc');
  });

  it('preserves an explicit reference-status filter', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const global = effectiveGlobalProjectionState(workspace, {
      ...expanded,
      filters: { referenceStatuses: ['ambiguous', 'invalid'] },
    });
    expect(global.filters?.referenceStatuses).toEqual(['ambiguous', 'invalid']);
  });
});
