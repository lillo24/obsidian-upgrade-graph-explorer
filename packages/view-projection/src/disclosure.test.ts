import { describe, expect, it } from 'vitest';

import {
  documentOnlyProjectionState,
  topLevelSectionProjectionState,
} from './presets';
import { projectSnapshot } from './project';
import { projectionFixture } from './test-fixture';
import type {
  ProjectedEntityNode,
  StructuralDepth,
  ViewProjectionState,
} from './types';

function fixtureWithFourthSection() {
  const snapshot = projectionFixture();
  const template = snapshot.entities.find(
    (entity) => entity.kind === 'section' && entity.id === 'a-deep',
  );
  if (template?.kind !== 'section') {
    throw new Error('Projection fixture is missing its deep Section template.');
  }
  return {
    ...snapshot,
    entities: [
      ...snapshot.entities,
      {
        ...template,
        id: 'a-beyond',
        parentId: 'a-deep',
        title: 'Beyond',
        level: 6,
        source: {
          path: 'A.md',
          span: {
            start: { line: 6, column: 1, offset: 50 },
            end: { line: 6, column: 2, offset: 51 },
          },
        },
      },
    ],
  };
}

function fixtureWithThreeBlockChildren() {
  const snapshot = projectionFixture();
  const template = snapshot.entities.find(
    (entity) => entity.kind === 'block' && entity.id === 'a-block',
  );
  if (template?.kind !== 'block') {
    throw new Error('Projection fixture is missing its Block template.');
  }
  return {
    ...snapshot,
    entities: [
      ...snapshot.entities,
      ...['block-one', 'block-two', 'block-three'].map((id) => ({
        ...template,
        id,
        parentId: 'a-deep',
      })),
    ],
  };
}

function entityNodes(
  state: ViewProjectionState,
): readonly ProjectedEntityNode[] {
  return entityNodesFrom(projectionFixture(), state);
}

function entityNodesFrom(
  snapshot: ReturnType<typeof projectionFixture>,
  state: ViewProjectionState,
): readonly ProjectedEntityNode[] {
  return projectSnapshot(snapshot, state).nodes.filter(
    (node): node is ProjectedEntityNode => node.kind === 'entity',
  );
}

function entityIds(state: ViewProjectionState): readonly string[] {
  return entityNodes(state)
    .map((node) => node.entityId)
    .sort();
}

describe('structural disclosure', () => {
  it('reports one-action revealability instead of total hidden subtree size', () => {
    const nodes = entityNodes(documentOnlyProjectionState());

    expect(nodes.map((node) => node.entityId).sort()).toEqual([
      'doc-a',
      'doc-b',
      'doc-c',
    ]);
    expect(nodes.find((node) => node.entityId === 'doc-a')).toMatchObject({
      revealableDescendantCount: 1,
    });
  });

  it('uses structural depth for top-level sections, not Markdown heading level', () => {
    expect(entityIds(topLevelSectionProjectionState())).toEqual([
      'a-overview',
      'b-target',
      'c-third',
      'doc-a',
      'doc-b',
      'doc-c',
    ]);
  });

  it('supports zero through three canonical section-tree generations independently of heading numbers', () => {
    const stateAtDepth = (defaultDepth: StructuralDepth) =>
      ({
        disclosure: {
          defaultDepth,
          expandedEntityIds: [],
          hiddenEntityIds: [],
          collapsedEntityIds: [],
          includeBlocks: false,
        },
      }) satisfies ViewProjectionState;

    expect(entityIds(stateAtDepth(0))).not.toContain('a-overview');
    expect(entityIds(stateAtDepth(1))).toEqual(
      expect.arrayContaining(['a-overview']),
    );
    expect(entityIds(stateAtDepth(1))).not.toContain('a-detail');
    expect(entityIds(stateAtDepth(2))).toEqual(
      expect.arrayContaining(['a-overview', 'a-detail']),
    );
    expect(entityIds(stateAtDepth(2))).not.toContain('a-deep');
    expect(entityIds(stateAtDepth(3))).toEqual(
      expect.arrayContaining(['a-overview', 'a-detail', 'a-deep']),
    );
  });

  it('crosses structural depth with an independent literal heading limit', () => {
    const state = (
      defaultDepth: StructuralDepth,
      maxSectionLevel: 1 | 3 | 6 | undefined,
    ) =>
      ({
        disclosure: {
          defaultDepth,
          ...(maxSectionLevel === undefined ? {} : { maxSectionLevel }),
          expandedEntityIds: [],
          hiddenEntityIds: [],
          collapsedEntityIds: [],
          includeBlocks: false,
        },
      }) satisfies ViewProjectionState;

    expect(entityIds(state(3, undefined))).toEqual(
      expect.arrayContaining(['a-overview', 'a-detail', 'a-deep']),
    );
    expect(entityIds(state(3, 3))).toEqual(
      expect.arrayContaining(['a-overview', 'a-detail']),
    );
    expect(entityIds(state(3, 3))).not.toContain('a-deep');
    expect(entityIds(state(3, 1))).toContain('a-overview');
    expect(entityIds(state(3, 1))).not.toContain('a-detail');
    expect(entityIds(state(1, 6))).toContain('a-overview');
    expect(entityIds(state(1, 6))).not.toContain('a-detail');
  });

  it('keeps manual expansion and collapse precedence independent of the default depth', () => {
    const expanded: ViewProjectionState = {
      disclosure: {
        defaultDepth: 1,
        expandedEntityIds: ['a-overview', 'a-detail'],
        hiddenEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: false,
      },
    };
    const collapsed: ViewProjectionState = {
      disclosure: {
        defaultDepth: 3,
        expandedEntityIds: [],
        hiddenEntityIds: [],
        collapsedEntityIds: ['a-overview'],
        includeBlocks: false,
      },
    };

    expect(entityIds(expanded)).toEqual(
      expect.arrayContaining(['a-overview', 'a-detail', 'a-deep']),
    );
    expect(entityIds(collapsed)).toContain('a-overview');
    expect(entityIds(collapsed)).not.toContain('a-detail');
    expect(entityIds(collapsed)).not.toContain('a-deep');
  });

  it('never auto-reveals Blocks as a structural-depth generation', () => {
    const state: ViewProjectionState = {
      disclosure: {
        defaultDepth: 3,
        expandedEntityIds: [],
        hiddenEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: true,
      },
    };

    expect(entityIds(state)).toContain('a-deep');
    expect(entityIds(state)).not.toContain('a-block');
    expect(
      entityIds({
        ...state,
        disclosure: {
          ...state.disclosure,
          expandedEntityIds: ['a-detail'],
        },
      }),
    ).toContain('a-block');
  });

  it.each([
    [0, 'doc-a'],
    [1, 'a-overview'],
    [2, 'a-detail'],
    [3, 'a-deep'],
  ] as const)(
    'moves the one-action reveal boundary to structural depth %i',
    (defaultDepth, boundaryEntityId) => {
      const nodes = entityNodesFrom(fixtureWithFourthSection(), {
        disclosure: {
          defaultDepth,
          expandedEntityIds: [],
          hiddenEntityIds: [],
          collapsedEntityIds: [],
          includeBlocks: false,
        },
      });

      expect(
        nodes.find((node) => node.entityId === boundaryEntityId),
      ).toMatchObject({ revealableDescendantCount: 1 });
      for (const visibleAncestorId of [
        'doc-a',
        'a-overview',
        'a-detail',
        'a-deep',
      ].slice(0, defaultDepth)) {
        expect(
          nodes.find((node) => node.entityId === visibleAncestorId),
        ).toMatchObject({ revealableDescendantCount: 0 });
      }
    },
  );

  it('applies a literal Markdown heading ceiling independently of structural depth', () => {
    const topLevel = topLevelSectionProjectionState();
    const h1Only: ViewProjectionState = {
      ...topLevel,
      disclosure: { ...topLevel.disclosure, maxSectionLevel: 1 },
    };
    const throughH2: ViewProjectionState = {
      ...topLevel,
      disclosure: { ...topLevel.disclosure, maxSectionLevel: 2 },
    };

    expect(entityIds(h1Only)).toEqual([
      'a-overview',
      'c-third',
      'doc-a',
      'doc-b',
      'doc-c',
    ]);
    expect(entityIds(h1Only)).not.toContain('b-target');
    expect(entityIds(throughH2)).toContain('b-target');
  });

  it('does not let explicit expansion bypass the heading ceiling', () => {
    const limited: ViewProjectionState = {
      disclosure: {
        defaultDepth: 1,
        maxSectionLevel: 1,
        expandedEntityIds: [
          'doc-a',
          'a-overview',
          'a-detail',
          'doc-b',
          'b-target',
        ],
        hiddenEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: true,
      },
    };
    const widened: ViewProjectionState = {
      ...limited,
      disclosure: { ...limited.disclosure, maxSectionLevel: 4 },
    };
    const unlimited: ViewProjectionState = {
      ...limited,
      disclosure: {
        defaultDepth: limited.disclosure.defaultDepth,
        expandedEntityIds: limited.disclosure.expandedEntityIds,
        hiddenEntityIds: [],
        collapsedEntityIds: limited.disclosure.collapsedEntityIds,
        includeBlocks: limited.disclosure.includeBlocks,
      },
    };

    for (const hiddenId of ['a-detail', 'a-deep', 'b-target', 'b-leaf']) {
      expect(entityIds(limited)).not.toContain(hiddenId);
    }
    expect(entityIds(widened)).toEqual(
      expect.arrayContaining(['a-detail', 'b-target', 'b-leaf']),
    );
    expect(entityIds(widened)).not.toContain('a-deep');
    expect(entityIds(unlimited)).toContain('a-deep');
  });

  it('supports progressive expansion one parent at a time', () => {
    const state = documentOnlyProjectionState();
    const withDocument = {
      ...state,
      disclosure: {
        ...state.disclosure,
        expandedEntityIds: ['doc-a'],
      },
    } satisfies ViewProjectionState;
    const withSection = {
      ...withDocument,
      disclosure: {
        ...withDocument.disclosure,
        expandedEntityIds: ['doc-a', 'a-overview'],
      },
    } satisfies ViewProjectionState;
    const withSubsection = {
      ...withSection,
      disclosure: {
        ...withSection.disclosure,
        expandedEntityIds: ['doc-a', 'a-overview', 'a-detail'],
      },
    } satisfies ViewProjectionState;

    expect(entityIds(withDocument)).toContain('a-overview');
    expect(entityIds(withDocument)).not.toContain('a-detail');
    expect(entityIds(withSection)).toContain('a-detail');
    expect(entityIds(withSection)).not.toContain('a-deep');
    expect(entityIds(withSubsection)).toContain('a-deep');
  });

  it('counts descendants restored by preserved nested expansion state', () => {
    const state: ViewProjectionState = {
      disclosure: {
        defaultDepth: 0,
        expandedEntityIds: ['doc-a', 'a-overview', 'a-detail'],
        hiddenEntityIds: [],
        collapsedEntityIds: ['doc-a'],
        includeBlocks: false,
      },
    };
    const document = entityNodes(state).find(
      (node) => node.entityId === 'doc-a',
    );

    expect(document).toMatchObject({ revealableDescendantCount: 3 });
  });

  it('counts mixed children according to Block eligibility', () => {
    const base: ViewProjectionState = {
      disclosure: {
        defaultDepth: 0,
        expandedEntityIds: ['doc-a', 'a-overview'],
        hiddenEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: false,
      },
    };
    const countForDetail = (state: ViewProjectionState) =>
      entityNodes(state).find((node) => node.entityId === 'a-detail')
        ?.revealableDescendantCount;

    expect(countForDetail(base)).toBe(1);
    expect(
      countForDetail({
        ...base,
        disclosure: { ...base.disclosure, includeBlocks: true },
      }),
    ).toBe(2);
  });

  it('excludes headings above the literal heading ceiling', () => {
    const topLevel = topLevelSectionProjectionState();
    const countForOverview = (maxSectionLevel: 2 | 3) =>
      entityNodes({
        ...topLevel,
        disclosure: { ...topLevel.disclosure, maxSectionLevel },
      }).find((node) => node.entityId === 'a-overview')
        ?.revealableDescendantCount;

    expect(countForOverview(2)).toBe(0);
    expect(countForOverview(3)).toBe(1);
  });

  it('preserves expanded intent while a heading ceiling hides descendants', () => {
    const limited: ViewProjectionState = {
      disclosure: {
        defaultDepth: 1,
        maxSectionLevel: 2,
        expandedEntityIds: ['a-overview'],
        hiddenEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: false,
      },
    };
    const limitedOverview = entityNodes(limited).find(
      (node) => node.entityId === 'a-overview',
    );
    const widened: ViewProjectionState = {
      ...limited,
      disclosure: { ...limited.disclosure, maxSectionLevel: 3 },
    };

    expect(limitedOverview).toMatchObject({ revealableDescendantCount: 0 });
    expect(entityIds(widened)).toContain('a-detail');
    expect(limited.disclosure.expandedEntityIds).toEqual(['a-overview']);
  });

  it('gives collapse precedence and reports conflicting state', () => {
    const state: ViewProjectionState = {
      disclosure: {
        defaultDepth: 1,
        expandedEntityIds: ['a-overview'],
        hiddenEntityIds: [],
        collapsedEntityIds: ['a-overview'],
        includeBlocks: true,
      },
    };
    const projection = projectSnapshot(projectionFixture(), state);

    expect(entityIds(state)).not.toContain('a-detail');
    expect(projection.issues).toContainEqual(
      expect.objectContaining({ code: 'conflicting-disclosure-state' }),
    );
  });

  it('shows blocks only when enabled and their visible parent is expanded', () => {
    const base: ViewProjectionState = {
      disclosure: {
        defaultDepth: 0,
        expandedEntityIds: ['doc-a', 'a-overview', 'a-detail'],
        hiddenEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: false,
      },
    };
    expect(entityIds(base)).not.toContain('a-block');
    expect(
      entityIds({
        ...base,
        disclosure: { ...base.disclosure, includeBlocks: true },
      }),
    ).toContain('a-block');
    expect(
      entityIds({
        disclosure: {
          ...base.disclosure,
          expandedEntityIds: ['doc-a', 'a-overview'],
          includeBlocks: true,
        },
      }),
    ).not.toContain('a-block');
  });

  it('does not count Block-only descendants while Blocks are disabled', () => {
    const snapshot = fixtureWithThreeBlockChildren();
    const base: ViewProjectionState = {
      disclosure: {
        defaultDepth: 0,
        expandedEntityIds: ['doc-a', 'a-overview', 'a-detail'],
        hiddenEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: false,
      },
    };
    const node = projectSnapshot(snapshot, base).nodes.find(
      (candidate): candidate is ProjectedEntityNode =>
        candidate.kind === 'entity' && candidate.entityId === 'a-deep',
    );

    expect(node).toMatchObject({ revealableDescendantCount: 0 });

    const enabled: ViewProjectionState = {
      ...base,
      disclosure: { ...base.disclosure, includeBlocks: true },
    };
    const enabledNode = projectSnapshot(snapshot, enabled).nodes.find(
      (candidate): candidate is ProjectedEntityNode =>
        candidate.kind === 'entity' && candidate.entityId === 'a-deep',
    );
    expect(enabledNode).toMatchObject({ revealableDescendantCount: 3 });

    const expanded = projectSnapshot(snapshot, {
      ...enabled,
      disclosure: {
        ...enabled.disclosure,
        expandedEntityIds: [...enabled.disclosure.expandedEntityIds, 'a-deep'],
      },
    });
    expect(
      expanded.nodes
        .flatMap((candidate) =>
          candidate.kind === 'entity' && candidate.entityKind === 'block'
            ? [candidate.entityId]
            : [],
        )
        .filter((entityId) => entityId.startsWith('block-')),
    ).toHaveLength(3);
  });

  it('recomputes Block revealability from each adopted live snapshot', () => {
    const initial = fixtureWithThreeBlockChildren();
    const updated = {
      ...initial,
      entities: initial.entities.filter(
        (entity) => entity.id !== 'block-three',
      ),
    };
    const state: ViewProjectionState = {
      disclosure: {
        defaultDepth: 0,
        expandedEntityIds: ['doc-a', 'a-overview', 'a-detail'],
        hiddenEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: true,
      },
    };
    const count = (
      snapshot: ReturnType<typeof fixtureWithThreeBlockChildren>,
    ) =>
      projectSnapshot(snapshot, state).nodes.find(
        (node): node is ProjectedEntityNode =>
          node.kind === 'entity' && node.entityId === 'a-deep',
      )?.revealableDescendantCount;

    expect(count(initial)).toBe(3);
    expect(count(updated)).toBe(2);
  });

  it('turns stale disclosure IDs into deterministic non-fatal issues', () => {
    const state: ViewProjectionState = {
      disclosure: {
        defaultDepth: 0,
        expandedEntityIds: ['missing-expanded'],
        hiddenEntityIds: [],
        collapsedEntityIds: ['missing-collapsed'],
        includeBlocks: false,
      },
    };
    const projection = projectSnapshot(projectionFixture(), state);

    expect(entityIds(state)).toEqual(['doc-a', 'doc-b', 'doc-c']);
    expect(projection.issues.map(({ code }) => code)).toEqual([
      'unknown-collapsed-entity',
      'unknown-expanded-entity',
    ]);
  });

  it('hides a Heading and its complete subtree without affecting siblings', () => {
    const base = topLevelSectionProjectionState();
    const state: ViewProjectionState = {
      ...base,
      disclosure: {
        ...base.disclosure,
        defaultDepth: 3,
        expandedEntityIds: ['a-detail'],
        includeBlocks: true,
        hiddenEntityIds: ['a-detail'],
      },
    };

    const visible = entityIds(state);
    expect(visible).toHaveLength(7);
    expect(visible).toEqual(
      expect.arrayContaining([
        'doc-a',
        'a-overview',
        'doc-b',
        'b-target',
        'b-leaf',
        'doc-c',
        'c-third',
      ]),
    );
    expect(visible).not.toContain('a-detail');
    expect(visible).not.toContain('a-deep');
    expect(visible).not.toContain('a-block');
  });

  it('keeps three of five sibling Headings when two explicit subtrees are hidden', () => {
    const fixture = projectionFixture();
    const source = (line: number, offset: number) => ({
      path: 'A.md',
      span: {
        start: { line, column: 1, offset },
        end: { line, column: 2, offset: offset + 1 },
      },
    });
    const snapshot = {
      ...fixture,
      entities: [
        ...fixture.entities,
        {
          id: 'a-h2',
          kind: 'section' as const,
          parentId: 'doc-a',
          title: 'H2',
          level: 1,
          source: source(6, 50),
        },
        {
          id: 'a-h2-child',
          kind: 'section' as const,
          parentId: 'a-h2',
          title: 'H2 child',
          level: 2,
          source: source(7, 60),
        },
        {
          id: 'a-h3',
          kind: 'section' as const,
          parentId: 'doc-a',
          title: 'H3',
          level: 1,
          source: source(8, 70),
        },
        {
          id: 'a-h4',
          kind: 'section' as const,
          parentId: 'doc-a',
          title: 'H4',
          level: 1,
          source: source(9, 80),
        },
        {
          id: 'a-h5',
          kind: 'section' as const,
          parentId: 'doc-a',
          title: 'H5',
          level: 1,
          source: source(10, 90),
        },
      ],
    };
    const base = topLevelSectionProjectionState();
    const projection = projectSnapshot(snapshot, {
      ...base,
      disclosure: {
        ...base.disclosure,
        defaultDepth: 2,
        hiddenEntityIds: ['a-h2', 'a-h4'],
      },
    });
    const visible = projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [node.entityId] : [],
    );

    expect(visible).toEqual(
      expect.arrayContaining(['a-overview', 'a-h3', 'a-h5']),
    );
    expect(visible).not.toContain('a-h2');
    expect(visible).not.toContain('a-h2-child');
    expect(visible).not.toContain('a-h4');
  });

  it('ignores unsupported hidden kinds and reports stale hidden IDs deterministically', () => {
    const base = documentOnlyProjectionState();
    const state: ViewProjectionState = {
      ...base,
      disclosure: {
        ...base.disclosure,
        hiddenEntityIds: ['a-block', 'doc-a', 'missing-hidden'],
      },
    };
    const projection = projectSnapshot(projectionFixture(), state);

    expect(entityIds(state)).toEqual(['doc-a', 'doc-b', 'doc-c']);
    expect(projection.issues.map(({ code }) => code)).toEqual([
      'invalid-hidden-entity-kind',
      'invalid-hidden-entity-kind',
      'unknown-hidden-entity',
    ]);
  });
});
