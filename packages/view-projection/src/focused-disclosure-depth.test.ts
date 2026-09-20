import { describe, expect, it } from 'vitest';

import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';

import { describeFocusedDisclosureDepth } from './focused-disclosure-depth';
import { revealEntityInViewState } from './reveal';
import { projectionFixture } from './test-fixture';
import type { StructuralDepth, ViewProjectionState } from './types';
import { createProjectionWorkspace } from './workspace';

function focusState(
  defaultDepth: StructuralDepth,
  overrides: Partial<ViewProjectionState> = {},
): ViewProjectionState {
  return {
    disclosure: {
      defaultDepth,
      expandedEntityIds: [],
      collapsedEntityIds: [],
      hiddenEntityIds: [],
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

describe('Focus hierarchy depth presentation', () => {
  const workspace = createProjectionWorkspace(projectionFixture());

  it.each([0, 1, 2, 3] as const)(
    'describes uniform automatic depth %i without Custom',
    (depth) => {
      expect(
        describeFocusedDisclosureDepth(workspace, focusState(depth)),
      ).toEqual({ effectiveDepth: depth, custom: false });
    },
  );

  it('describes one manually expanded File as 1 level Custom', () => {
    const state = focusState(0, {
      disclosure: {
        ...focusState(0).disclosure,
        expandedEntityIds: ['doc-b'],
      },
    });

    expect(describeFocusedDisclosureDepth(workspace, state)).toEqual({
      effectiveDepth: 1,
      custom: true,
    });
  });

  it('ignores explicit Heading Hide when deriving uniform depth', () => {
    const state = focusState(1, {
      disclosure: {
        ...focusState(1).disclosure,
        hiddenEntityIds: ['a-overview', 'b-target', 'c-third'],
      },
    });

    expect(describeFocusedDisclosureDepth(workspace, state)).toEqual({
      effectiveDepth: 1,
      custom: false,
    });
  });

  it('ignores manual overrides outside the current canonical Focus neighborhood', () => {
    const state = focusState(0, {
      disclosure: {
        ...focusState(0).disclosure,
        expandedEntityIds: ['doc-a'],
      },
      focus: {
        ...focusState(0).focus!,
        rootEntityId: 'doc-b',
        direction: 'outgoing',
      },
      filters: { pathPrefixes: ['folder'] },
    });

    expect(describeFocusedDisclosureDepth(workspace, state)).toEqual({
      effectiveDepth: 0,
      custom: false,
    });
  });

  it('recomputes Custom when Focus reroots to a different neighborhood', () => {
    const expandedB = focusState(0, {
      disclosure: {
        ...focusState(0).disclosure,
        expandedEntityIds: ['doc-b'],
      },
    });
    const rerooted = {
      ...expandedB,
      focus: { ...expandedB.focus!, rootEntityId: 'doc-c' },
      filters: { pathPrefixes: ['other'] },
    };

    expect(describeFocusedDisclosureDepth(workspace, expandedB).custom).toBe(
      true,
    );
    expect(describeFocusedDisclosureDepth(workspace, rerooted)).toEqual({
      effectiveDepth: 0,
      custom: false,
    });
  });

  it('reflects Search reveal as structural depth rather than Markdown level', () => {
    const revealed = revealEntityInViewState(
      workspace,
      focusState(0),
      'b-leaf',
    );

    expect(workspace.requireEntity('b-leaf')).toMatchObject({ level: 4 });
    expect(describeFocusedDisclosureDepth(workspace, revealed)).toEqual({
      effectiveDepth: 2,
      custom: true,
    });
  });

  it('counts a direct H4 child as generation 1', () => {
    const fixture = projectionFixture();
    const h4Fixture: KnowledgeSnapshot = {
      ...fixture,
      entities: fixture.entities.map((entity) =>
        entity.id === 'b-target' && entity.kind === 'section'
          ? { ...entity, level: 4 }
          : entity.id === 'b-leaf' && entity.kind === 'section'
            ? { ...entity, level: 5 }
            : entity,
      ),
    };
    const h4Workspace = createProjectionWorkspace(h4Fixture);
    const state = focusState(1, {
      focus: {
        ...focusState(1).focus!,
        rootEntityId: 'doc-b',
        direction: 'outgoing',
      },
      filters: { pathPrefixes: ['folder'] },
    });

    expect(describeFocusedDisclosureDepth(h4Workspace, state)).toEqual({
      effectiveDepth: 1,
      custom: false,
    });
  });

  it('caps deeper manual disclosure at 3 levels and retains Custom', () => {
    const fixture = projectionFixture();
    const deepFixture: KnowledgeSnapshot = {
      ...fixture,
      entities: [
        ...fixture.entities,
        {
          id: 'a-fourth',
          kind: 'section',
          parentId: 'a-deep',
          title: 'Fourth generation',
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
    const deepWorkspace = createProjectionWorkspace(deepFixture);
    const state = focusState(0, {
      disclosure: {
        ...focusState(0).disclosure,
        expandedEntityIds: ['doc-a', 'a-overview', 'a-detail', 'a-deep'],
      },
    });

    expect(describeFocusedDisclosureDepth(deepWorkspace, state)).toEqual({
      effectiveDepth: 3,
      custom: true,
    });
  });
});
