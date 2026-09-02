import { describe, expect, it } from 'vitest';

import type {
  AddressableEntity,
  KnowledgeSnapshot,
} from '@icarus-graph-explorer/core';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectLocalView,
  projectStructureView,
  projectView,
  type ViewProjection,
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
  {
    id: 'doc-folder',
    kind: 'document',
    source: source('folder/A.md', 1),
  },
  {
    id: 'section-folder',
    kind: 'section',
    parentId: 'doc-folder',
    title: 'Heading',
    level: 1,
    source: source('folder/A.md', 2),
  },
  {
    id: 'block-folder',
    kind: 'block',
    parentId: 'section-folder',
    source: source('folder/A.md', 3),
  },
  {
    id: 'doc-language',
    kind: 'document',
    source: source('Language/B.md', 1),
  },
  {
    id: 'section-language',
    kind: 'section',
    parentId: 'doc-language',
    title: 'Associated Value',
    level: 2,
    source: source('Language/B.md', 2),
  },
  {
    id: 'doc-archive',
    kind: 'document',
    source: source('archive/C.md', 1),
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
    rootEntityId: 'section-folder',
    hops: 1,
    direction: 'both',
    hierarchyContext: 'ancestors-and-children',
  },
};

function entityIds(projection: ViewProjection): readonly string[] {
  return projection.nodes.flatMap((node) =>
    node.kind === 'entity' ? [node.entityId] : [],
  );
}

function allState(
  filters?: ViewProjectionState['filters'],
): ViewProjectionState {
  return {
    ...documentOnlyProjectionState(),
    ...(filters === undefined ? {} : { filters }),
  };
}

function projectAllNetwork(
  workspace: ReturnType<typeof createProjectionWorkspace>,
  state: ViewProjectionState,
): ViewProjection {
  return projectView(
    workspace,
    effectiveGlobalProjectionState(workspace, state),
  );
}

describe('effective All Network KG6 state', () => {
  it('enforces documents-only topology without mutating Hierarchy disclosure', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const before = JSON.stringify(expanded);
    const global = effectiveGlobalProjectionState(workspace, expanded);
    const projection = projectView(workspace, global);
    expect(global.disclosure.defaultDepth).toBe(0);
    expect(global.focus?.rootEntityId).toBe('doc-folder');
    expect(global.filters?.referenceStatuses).toEqual(['resolved']);
    expect(
      projection.nodes.every(
        (node) => node.kind !== 'entity' || node.entityKind === 'document',
      ),
    ).toBe(true);
    expect(
      projection.nodes.some(
        (node) => node.kind === 'entity' && node.entityId === 'section-folder',
      ),
    ).toBe(false);
    expect(projection.edges.every((edge) => edge.kind === 'reference')).toBe(
      true,
    );
    expect(JSON.stringify(expanded)).toBe(before);
    expect(containingDocumentEntityId(workspace, 'block-folder')).toBe(
      'doc-folder',
    );
  });

  it('preserves an explicit reference-status filter', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const global = effectiveGlobalProjectionState(workspace, {
      ...expanded,
      filters: { referenceStatuses: ['ambiguous', 'invalid'] },
    });
    expect(global.filters?.referenceStatuses).toEqual(['ambiguous', 'invalid']);
  });

  it('propagates the canonical query exactly without mutating the source state', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const state = allState({ query: 'documents AND path:"folder"' });
    const before = JSON.stringify(state);

    const global = effectiveGlobalProjectionState(workspace, state);

    expect(global.filters?.query).toBe('documents AND path:"folder"');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('applies document-compatible path queries to All Network', () => {
    const workspace = createProjectionWorkspace(snapshot);

    expect(
      entityIds(
        projectAllNetwork(
          workspace,
          allState({ query: 'documents AND path:"Language"' }),
        ),
      ),
    ).toEqual(['doc-language']);
  });

  it('evaluates QUERY1 text against document paths in All Network', () => {
    const workspace = createProjectionWorkspace(snapshot);

    expect(
      entityIds(
        projectAllNetwork(workspace, allState({ query: 'text:"Language"' })),
      ),
    ).toEqual(['doc-language']);
  });

  it('applies negated document queries without overriding other filters', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const notArchive = projectAllNetwork(
      workspace,
      allState({ query: 'documents AND NOT path:"archive"' }),
    );
    const documentsDisabled = projectAllNetwork(
      workspace,
      allState({ entityKinds: ['section'], query: 'documents' }),
    );

    expect(entityIds(notArchive)).toEqual(['doc-folder', 'doc-language']);
    expect(entityIds(documentsDisabled)).toEqual([]);
  });

  it.each([
    'sections',
    'level<=2',
    'sections AND level<=2',
    'title:"Associated Value"',
  ])('returns no All Network entities for %s', (query) => {
    const workspace = createProjectionWorkspace(snapshot);

    expect(
      entityIds(projectAllNetwork(workspace, allState({ query }))),
    ).toEqual([]);
  });

  it('matches Files-only Hierarchy document IDs for a document query', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const state = allState({ query: 'documents AND path:"Language"' });

    expect(entityIds(projectAllNetwork(workspace, state))).toEqual(
      entityIds(projectStructureView(workspace, state)),
    );
  });

  it('keeps Focus Network and Focus Hierarchy on shared detailed semantics', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const state: ViewProjectionState = {
      ...expanded,
      focus: {
        ...expanded.focus!,
        rootEntityId: 'section-language',
      },
      filters: { query: 'title:"Associated Value"' },
    };
    const network = projectLocalView(workspace, state);
    const hierarchy = projectStructureView(workspace, state);

    expect(network).toEqual(hierarchy);
    expect(entityIds(network)).toEqual(['doc-language', 'section-language']);
  });
});
