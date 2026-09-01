import { describe, expect, it } from 'vitest';

import { entityNodeId } from './ids';
import { projectionFixture } from './test-fixture';
import { projectStructureView } from './structure';
import type {
  StructuralDepth,
  ViewProjection,
  ViewProjectionState,
} from './types';
import { createProjectionWorkspace } from './workspace';

const workspace = createProjectionWorkspace(projectionFixture());

function focusState(
  defaultDepth: StructuralDepth,
  overrides: Partial<ViewProjectionState> = {},
): ViewProjectionState {
  return {
    disclosure: {
      defaultDepth,
      expandedEntityIds: [],
      collapsedEntityIds: [],
      includeBlocks: false,
      ...overrides.disclosure,
    },
    focus: {
      rootEntityId: 'doc-a',
      hops: 1,
      direction: 'both',
      hierarchyContext: 'ancestors',
      ...overrides.focus,
    },
    ...(overrides.filters === undefined ? {} : { filters: overrides.filters }),
  };
}

function entityIds(projection: ViewProjection): readonly string[] {
  return projection.nodes.flatMap((node) =>
    node.kind === 'entity' ? [node.entityId] : [],
  );
}

function documentIds(projection: ViewProjection): readonly string[] {
  return projection.nodes.flatMap((node) =>
    node.kind === 'entity' && node.entityKind === 'document'
      ? [node.entityId]
      : [],
  );
}

function referenceWith(projection: ViewProjection, referenceId: string) {
  return projection.edges.find(
    (edge) =>
      edge.kind === 'reference' && edge.referenceIds.includes(referenceId),
  );
}

describe('Structure Focus projection', () => {
  it('keeps the same file neighborhood at depths 0, 1, 2, and 3', () => {
    const documentSets = ([0, 1, 2, 3] as const).map((depth) =>
      documentIds(projectStructureView(workspace, focusState(depth))),
    );

    expect(documentSets[0]).toEqual(['doc-a', 'doc-b', 'doc-c']);
    expect(documentSets[1]).toEqual(documentSets[0]);
    expect(documentSets[2]).toEqual(documentSets[0]);
    expect(documentSets[3]).toEqual(documentSets[0]);
  });

  it('unfolds automatic depth only beneath the focused document', () => {
    const depth0 = entityIds(projectStructureView(workspace, focusState(0)));
    const depth1 = entityIds(projectStructureView(workspace, focusState(1)));
    const depth2 = entityIds(projectStructureView(workspace, focusState(2)));
    const depth3 = entityIds(projectStructureView(workspace, focusState(3)));

    expect(depth0).not.toContain('a-overview');
    expect(depth1).toContain('a-overview');
    expect(depth1).not.toContain('a-detail');
    expect(depth2).toContain('a-detail');
    expect(depth2).not.toContain('a-deep');
    expect(depth3).toContain('a-deep');
    for (const ids of [depth1, depth2, depth3]) {
      expect(ids).not.toContain('b-target');
      expect(ids).not.toContain('c-third');
    }
  });

  it('supports truthful manual neighbor expansion without changing file reachability', () => {
    const collapsed = projectStructureView(workspace, focusState(1));
    const expanded = projectStructureView(
      workspace,
      focusState(1, {
        disclosure: {
          defaultDepth: 1,
          expandedEntityIds: ['doc-b'],
          collapsedEntityIds: [],
          includeBlocks: false,
        },
      }),
    );

    expect(
      collapsed.nodes.find(
        (node) => node.kind === 'entity' && node.entityId === 'doc-b',
      ),
    ).toMatchObject({ revealableDescendantCount: 1 });
    expect(entityIds(expanded)).toContain('b-target');
    expect(entityIds(expanded)).not.toContain('b-leaf');
    expect(documentIds(expanded)).toEqual(documentIds(collapsed));
  });

  it('reroutes precise heading endpoints without dropping their neighbor file', () => {
    const filesOnly = projectStructureView(workspace, focusState(0));
    const twoLevels = projectStructureView(workspace, focusState(2));

    expect(referenceWith(filesOnly, 'r-a-detail-to-b-leaf')).toMatchObject({
      sourceNodeId: entityNodeId('doc-a'),
      targetNodeId: entityNodeId('doc-b'),
    });
    expect(referenceWith(twoLevels, 'r-a-detail-to-b-leaf')).toMatchObject({
      sourceNodeId: entityNodeId('a-detail'),
      targetNodeId: entityNodeId('doc-b'),
    });
    expect(documentIds(twoLevels)).toContain('doc-b');
  });

  it('normalizes section Focus to its containing document', () => {
    const projection = projectStructureView(
      workspace,
      focusState(2, {
        focus: {
          rootEntityId: 'a-detail',
          hops: 1,
          direction: 'outgoing',
          hierarchyContext: 'ancestors',
        },
      }),
    );

    expect(documentIds(projection)).toEqual(['doc-a', 'doc-b']);
    expect(entityIds(projection)).toContain('a-detail');
  });

  it('preserves heading ceilings, Blocks opt-in, and manual collapse precedence', () => {
    const limited = projectStructureView(
      workspace,
      focusState(3, {
        disclosure: {
          defaultDepth: 3,
          maxSectionLevel: 3,
          expandedEntityIds: [],
          collapsedEntityIds: [],
          includeBlocks: true,
        },
      }),
    );
    const withManualBlockExpansion = projectStructureView(
      workspace,
      focusState(3, {
        disclosure: {
          defaultDepth: 3,
          expandedEntityIds: ['a-detail'],
          collapsedEntityIds: [],
          includeBlocks: true,
        },
      }),
    );
    const collapsedRoot = projectStructureView(
      workspace,
      focusState(3, {
        disclosure: {
          defaultDepth: 3,
          expandedEntityIds: [],
          collapsedEntityIds: ['doc-a'],
          includeBlocks: false,
        },
      }),
    );

    expect(entityIds(limited)).not.toContain('a-deep');
    expect(entityIds(limited)).not.toContain('a-block');
    expect(entityIds(withManualBlockExpansion)).toContain('a-block');
    expect(entityIds(collapsedRoot)).not.toContain('a-overview');
  });

  it('keeps neighborhood filters separate from QUERY1 detail filtering', () => {
    const queried = projectStructureView(
      workspace,
      focusState(2, { filters: { query: 'title:"detail"' } }),
    );
    const pathScoped = projectStructureView(
      workspace,
      focusState(2, { filters: { pathPrefixes: ['A.md'] } }),
    );
    const unresolvedOnly = projectStructureView(
      workspace,
      focusState(2, {
        filters: { referenceStatuses: ['unresolved'] },
      }),
    );

    expect(entityIds(queried)).toEqual(['a-detail', 'a-overview', 'doc-a']);
    expect(
      queried.nodes.find(
        (node) => node.kind === 'entity' && node.entityId === 'doc-a',
      ),
    ).toMatchObject({ role: 'context', focusDistance: null });
    expect(documentIds(pathScoped)).toEqual(['doc-a']);
    expect(documentIds(unresolvedOnly)).toEqual(['doc-a']);
  });

  it('preserves Focus hop and direction semantics', () => {
    const outgoingOne = projectStructureView(
      workspace,
      focusState(0, {
        focus: {
          rootEntityId: 'doc-a',
          hops: 1,
          direction: 'outgoing',
          hierarchyContext: 'ancestors',
        },
      }),
    );
    const outgoingTwo = projectStructureView(
      workspace,
      focusState(0, {
        focus: {
          rootEntityId: 'doc-a',
          hops: 2,
          direction: 'outgoing',
          hierarchyContext: 'ancestors',
        },
      }),
    );

    expect(documentIds(outgoingOne)).toEqual(['doc-a', 'doc-b']);
    expect(documentIds(outgoingTwo)).toEqual(['doc-a', 'doc-b', 'doc-c']);
  });

  it('leaves non-Focus Structure depth global', () => {
    const projection = projectStructureView(workspace, {
      disclosure: {
        defaultDepth: 1,
        expandedEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: false,
      },
    });

    expect(entityIds(projection)).toEqual([
      'a-overview',
      'b-target',
      'c-third',
      'doc-a',
      'doc-b',
      'doc-c',
    ]);
  });
});
