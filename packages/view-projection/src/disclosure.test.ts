import { describe, expect, it } from 'vitest';

import {
  documentOnlyProjectionState,
  topLevelSectionProjectionState,
} from './presets';
import { projectSnapshot } from './project';
import { projectionFixture } from './test-fixture';
import type { ProjectedEntityNode, ViewProjectionState } from './types';

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
  return projectSnapshot(projectionFixture(), state).nodes.filter(
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
});
