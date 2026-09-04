import { describe, expect, it } from 'vitest';

import {
  documentOnlyProjectionState,
  topLevelSectionProjectionState,
} from './presets';
import { projectSnapshot } from './project';
import { projectionFixture } from './test-fixture';
import type {
  ProjectedEntityNode,
  ProjectedReferenceTargetNode,
  ViewProjection,
  ViewProjectionState,
} from './types';

function entityNodes(
  projection: ViewProjection,
): readonly ProjectedEntityNode[] {
  return projection.nodes.filter(
    (node): node is ProjectedEntityNode => node.kind === 'entity',
  );
}

function entityIds(projection: ViewProjection): readonly string[] {
  return entityNodes(projection)
    .map(({ entityId }) => entityId)
    .sort();
}

function focusState(
  rootEntityId: string,
  hops: 1 | 2 | 3,
  direction: 'incoming' | 'outgoing' | 'both' = 'outgoing',
): ViewProjectionState {
  return {
    ...documentOnlyProjectionState(),
    focus: {
      rootEntityId,
      hops,
      direction,
      hierarchyContext: 'ancestors',
    },
  };
}

describe('focus projection', () => {
  it('extracts one-hop outgoing reference neighbors and diagnostic targets', () => {
    const projection = projectSnapshot(
      projectionFixture(),
      focusState('doc-a', 1),
    );

    expect(entityIds(projection)).toEqual(['doc-a', 'doc-b']);
    expect(
      projection.nodes.filter((node) => node.kind === 'reference-target'),
    ).not.toHaveLength(0);
    expect(
      entityNodes(projection).find(({ entityId }) => entityId === 'doc-b'),
    ).toMatchObject({ focusDistance: 1, role: 'content' });
  });

  it('supports bounded two/three-hop traversal and direction', () => {
    expect(
      entityIds(projectSnapshot(projectionFixture(), focusState('doc-a', 2))),
    ).toEqual(['doc-a', 'doc-b', 'doc-c']);
    expect(
      entityIds(
        projectSnapshot(
          projectionFixture(),
          focusState('doc-a', 1, 'incoming'),
        ),
      ),
    ).toEqual(['doc-a', 'doc-b', 'doc-c']);
    expect(
      entityIds(
        projectSnapshot(projectionFixture(), focusState('doc-b', 1, 'both')),
      ),
    ).toEqual(['doc-a', 'doc-b', 'doc-c']);
    expect(
      entityNodes(
        projectSnapshot(projectionFixture(), focusState('doc-a', 3)),
      ).every((node) => (node.focusDistance ?? 0) <= 3),
    ).toBe(true);
  });

  it('does not traverse beyond a diagnostic target', () => {
    const projection = projectSnapshot(
      projectionFixture(),
      focusState('doc-a', 3),
    );
    const targets = projection.nodes.filter(
      (node): node is ProjectedReferenceTargetNode =>
        node.kind === 'reference-target',
    );

    expect(targets.every((target) => target.rawTarget !== '')).toBe(true);
    expect(targets.every((target) => !('focusDistance' in target))).toBe(true);
  });

  it('adds ancestors and optional direct children as context without hop distances', () => {
    const state: ViewProjectionState = {
      ...topLevelSectionProjectionState(),
      disclosure: {
        ...topLevelSectionProjectionState().disclosure,
        expandedEntityIds: ['a-overview'],
      },
      focus: {
        rootEntityId: 'a-overview',
        hops: 1,
        direction: 'outgoing',
        hierarchyContext: 'ancestors-and-children',
      },
    };
    const projection = projectSnapshot(projectionFixture(), state);
    const document = entityNodes(projection).find(
      ({ entityId }) => entityId === 'doc-a',
    );
    const directChild = entityNodes(projection).find(
      ({ entityId }) => entityId === 'a-detail',
    );

    expect(document).toMatchObject({ role: 'context', focusDistance: null });
    expect(directChild).toMatchObject({ role: 'context', focusDistance: null });
  });

  it('suppresses non-local Expand predictions while Focus is active', () => {
    const projection = projectSnapshot(projectionFixture(), {
      ...documentOnlyProjectionState(),
      focus: {
        rootEntityId: 'doc-a',
        hops: 1,
        direction: 'outgoing',
        hierarchyContext: 'ancestors-and-children',
      },
    });

    expect(
      entityNodes(projection).every(
        ({ revealableDescendantCount }) => revealableDescendantCount === 0,
      ),
    ).toBe(true);
  });

  it('reports unknown and structurally hidden focus roots without crashing', () => {
    const unknown = projectSnapshot(
      projectionFixture(),
      focusState('absent', 1),
    );
    const hidden = projectSnapshot(
      projectionFixture(),
      focusState('a-detail', 1),
    );

    expect(unknown.nodes).toEqual([]);
    expect(unknown.issues[0]?.code).toBe('unknown-focus-root');
    expect(hidden.nodes).toEqual([]);
    expect(hidden.issues[0]?.code).toBe('hidden-focus-root');
  });
});

describe('projected filters', () => {
  it('filters normalized paths and keeps only necessary structural context', () => {
    const state: ViewProjectionState = {
      ...topLevelSectionProjectionState(),
      filters: { pathPrefixes: ['folder'] },
    };
    const projection = projectSnapshot(projectionFixture(), state);

    expect(entityIds(projection)).toEqual(['b-target', 'doc-b']);
    expect(
      entityNodes(projection).every(({ role }) => role === 'content'),
    ).toBe(true);
    expect(
      projection.edges.filter((edge) => edge.kind === 'reference'),
    ).toHaveLength(1);
  });

  it('matches projected titles and marks required ancestors as context', () => {
    const projection = projectSnapshot(projectionFixture(), {
      ...topLevelSectionProjectionState(),
      filters: { text: 'target' },
    });

    expect(entityIds(projection)).toEqual(['b-target', 'doc-b']);
    expect(
      entityNodes(projection).find(({ entityId }) => entityId === 'b-target'),
    ).toMatchObject({ role: 'content' });
    expect(
      entityNodes(projection).find(({ entityId }) => entityId === 'doc-b'),
    ).toMatchObject({ role: 'context' });
  });

  it('allows raw diagnostic targets to match without crossing path/kind exclusions', () => {
    const projection = projectSnapshot(projectionFixture(), {
      ...topLevelSectionProjectionState(),
      filters: { pathPrefixes: ['folder'], text: 'missing' },
    });

    expect(entityIds(projection)).toEqual(['b-target', 'doc-b']);
    expect(
      entityNodes(projection).find(({ entityId }) => entityId === 'b-target'),
    ).toMatchObject({ role: 'context' });
    expect(
      projection.nodes.filter((node) => node.kind === 'reference-target'),
    ).toHaveLength(1);
  });

  it('filters entity kinds while retaining ancestors as context', () => {
    const projection = projectSnapshot(projectionFixture(), {
      ...topLevelSectionProjectionState(),
      filters: { entityKinds: ['section'] },
    });
    const documents = entityNodes(projection).filter(
      ({ entityKind }) => entityKind === 'document',
    );

    expect(documents).toHaveLength(3);
    expect(documents.every(({ role }) => role === 'context')).toBe(true);
    expect(
      projection.edges
        .filter((edge) => edge.kind === 'reference')
        .some((edge) => edge.referenceIds.includes('r-b-back')),
    ).toBe(false);
  });

  it('finalizes reveal counts against entity-kind filters', () => {
    const documentsOnly = projectSnapshot(projectionFixture(), {
      ...documentOnlyProjectionState(),
      filters: { entityKinds: ['document'] },
    });
    const documentsAndSections = projectSnapshot(projectionFixture(), {
      ...documentOnlyProjectionState(),
      filters: { entityKinds: ['document', 'section'] },
    });
    const revealCount = (projection: ViewProjection, entityId: string) =>
      entityNodes(projection).find((node) => node.entityId === entityId)
        ?.revealableDescendantCount;

    expect(revealCount(documentsOnly, 'doc-a')).toBe(0);
    expect(revealCount(documentsAndSections, 'doc-a')).toBe(1);
  });

  it('keeps path/text retention and reference-status filtering source-neutral', () => {
    const path = projectSnapshot(projectionFixture(), {
      ...documentOnlyProjectionState(),
      filters: { pathPrefixes: ['A.md'] },
    });
    const text = projectSnapshot(projectionFixture(), {
      ...documentOnlyProjectionState(),
      filters: { text: 'A.md' },
    });
    const status = projectSnapshot(projectionFixture(), {
      ...documentOnlyProjectionState(),
      filters: { referenceStatuses: ['unresolved'] },
    });
    const revealCount = (projection: ViewProjection) =>
      entityNodes(projection).find((node) => node.entityId === 'doc-a')
        ?.revealableDescendantCount;

    expect(revealCount(path)).toBe(1);
    expect(revealCount(text)).toBe(1);
    expect(revealCount(status)).toBe(1);
  });

  it('filters resolution states, clears excluded internal provenance, and removes orphan targets', () => {
    const projection = projectSnapshot(projectionFixture(), {
      ...documentOnlyProjectionState(),
      filters: { referenceStatuses: ['unresolved', 'ambiguous'] },
    });

    expect(
      projection.edges
        .filter((edge) => edge.kind === 'reference')
        .every(
          (edge) => edge.status === 'unresolved' || edge.status === 'ambiguous',
        ),
    ).toBe(true);
    expect(
      entityNodes(projection).every(
        ({ internalReferenceIds }) => internalReferenceIds.length === 0,
      ),
    ).toBe(true);
    expect(
      projection.nodes.some(
        (node) => node.kind === 'reference-target' && node.status === 'invalid',
      ),
    ).toBe(false);
  });

  it('does not reroute a relationship when filtering removes its endpoint', () => {
    const projection = projectSnapshot(projectionFixture(), {
      ...topLevelSectionProjectionState(),
      filters: { pathPrefixes: ['A.md'] },
    });

    expect(
      projection.edges
        .filter((edge) => edge.kind === 'reference')
        .some((edge) => edge.referenceIds.includes('r-a-detail-to-b-leaf')),
    ).toBe(false);
    expect(
      entityNodes(projection).flatMap(
        ({ internalReferenceIds }) => internalReferenceIds,
      ),
    ).toEqual(['r-a-internal']);
  });

  it('reports invalid path prefixes and returns no accidental broad match', () => {
    const projection = projectSnapshot(projectionFixture(), {
      ...documentOnlyProjectionState(),
      filters: { pathPrefixes: ['../outside'] },
    });

    expect(projection.nodes).toEqual([]);
    expect(projection.issues[0]?.code).toBe('invalid-path-prefix');
  });

  it('evaluates canonical QUERY1 paths, titles, levels, and Boolean groups', () => {
    const projection = projectSnapshot(projectionFixture(), {
      disclosure: {
        defaultDepth: 3,
        expandedEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: false,
      },
      filters: {
        query: '(path:"folder" AND sections AND level<=2) OR title:"deep"',
      },
    });

    expect(entityIds(projection)).toEqual([
      'a-deep',
      'a-detail',
      'a-overview',
      'b-target',
      'doc-a',
      'doc-b',
    ]);
    expect(
      entityNodes(projection)
        .filter(({ role }) => role === 'content')
        .map(({ entityId }) => entityId)
        .sort(),
    ).toEqual(['a-deep', 'b-target']);
  });

  it('applies exact folder-subtree QUERY1 semantics in canonical projection', () => {
    const projection = projectSnapshot(projectionFixture(), {
      disclosure: {
        defaultDepth: 3,
        expandedEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: true,
      },
      filters: { query: 'folder="folder"' },
    });
    expect(entityNodes(projection).map(({ sourcePath }) => sourcePath)).toEqual(
      ['folder/B.md', 'folder/B.md', 'folder/B.md'],
    );
    expect(entityIds(projection)).toEqual(['b-leaf', 'b-target', 'doc-b']);
  });

  it('combines QUERY1 with simple filters and applies it after Focus', () => {
    const projection = projectSnapshot(projectionFixture(), {
      ...focusState('doc-a', 1),
      filters: {
        pathPrefixes: ['folder'],
        entityKinds: ['document'],
        query: 'NOT text:"archive"',
      },
    });

    expect(entityIds(projection)).toEqual(['doc-b']);
  });

  it('fails closed for invalid externally constructed queries', () => {
    const projection = projectSnapshot(projectionFixture(), {
      ...documentOnlyProjectionState(),
      filters: { query: 'sections documents' },
    });

    expect(projection.nodes).toEqual([]);
    expect(projection.edges).toEqual([]);
    expect(projection.issues).toContainEqual(
      expect.objectContaining({ code: 'invalid-query' }),
    );
  });

  it('keeps query levels separate from disclosure depth and Blocks eligibility', () => {
    const state = documentOnlyProjectionState();
    const levels = projectSnapshot(projectionFixture(), {
      ...state,
      filters: { query: 'level<=3' },
    });
    const blocks = projectSnapshot(projectionFixture(), {
      ...state,
      filters: { query: 'blocks' },
    });

    expect(state.disclosure.defaultDepth).toBe(0);
    expect(state.disclosure.includeBlocks).toBe(false);
    expect(entityIds(levels)).toEqual([]);
    expect(blocks.nodes).toEqual([]);
  });

  it('uses QUERY1 in DISC1 actionable reveal counts', () => {
    const matching = projectSnapshot(projectionFixture(), {
      ...documentOnlyProjectionState(),
      filters: {
        query: 'path:"A.md" AND (documents OR title:"overview")',
      },
    });
    const excluded = projectSnapshot(projectionFixture(), {
      ...documentOnlyProjectionState(),
      filters: { query: 'path:"A.md" AND documents' },
    });
    const count = (projection: ViewProjection) =>
      entityNodes(projection).find(({ entityId }) => entityId === 'doc-a')
        ?.revealableDescendantCount;

    expect(count(matching)).toBe(1);
    expect(count(excluded)).toBe(0);
  });
});
