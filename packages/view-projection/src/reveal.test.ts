import { describe, expect, it } from 'vitest';

import { documentOnlyProjectionState } from './presets';
import { projectView } from './project';
import { revealEntityInViewState } from './reveal';
import { projectionFixture } from './test-fixture';
import type { ViewProjectionState } from './types';
import { createProjectionWorkspace } from './workspace';

function projectedEntityIds(
  workspace: ReturnType<typeof createProjectionWorkspace>,
  state: ViewProjectionState,
): readonly string[] {
  return projectView(workspace, state).nodes.flatMap((node) =>
    node.kind === 'entity' ? [node.entityId] : [],
  );
}

describe('canonical entity reveal state', () => {
  it('opens every blocking structural ancestor for a nested section', () => {
    const workspace = createProjectionWorkspace(projectionFixture());
    const initial: ViewProjectionState = {
      ...documentOnlyProjectionState(),
      disclosure: {
        ...documentOnlyProjectionState().disclosure,
        expandedEntityIds: ['stays-expanded'],
        collapsedEntityIds: ['doc-a', 'a-overview', 'a-detail'],
      },
    };
    const revealed = revealEntityInViewState(workspace, initial, 'a-deep');

    expect(revealed.disclosure.expandedEntityIds).toEqual([
      'a-detail',
      'a-overview',
      'doc-a',
      'stays-expanded',
    ]);
    expect(revealed.disclosure.collapsedEntityIds).toEqual([]);
    expect(projectedEntityIds(workspace, revealed)).toContain('a-deep');
    expect(initial.disclosure.collapsedEntityIds).toEqual([
      'doc-a',
      'a-overview',
      'a-detail',
    ]);
  });

  it('enables blocks and explicitly expands their visible parent chain', () => {
    const workspace = createProjectionWorkspace(projectionFixture());
    const revealed = revealEntityInViewState(
      workspace,
      documentOnlyProjectionState(),
      'a-block',
    );

    expect(revealed.disclosure.includeBlocks).toBe(true);
    expect(revealed.disclosure.expandedEntityIds).toEqual([
      'a-detail',
      'a-overview',
      'doc-a',
    ]);
    expect(projectedEntityIds(workspace, revealed)).toContain('a-block');
  });

  it('minimally widens a heading ceiling for a deeper section or block', () => {
    const workspace = createProjectionWorkspace(projectionFixture());
    const h1Only: ViewProjectionState = {
      ...documentOnlyProjectionState(),
      disclosure: {
        ...documentOnlyProjectionState().disclosure,
        maxSectionLevel: 1,
      },
    };
    const section = revealEntityInViewState(workspace, h1Only, 'a-deep');
    const block = revealEntityInViewState(workspace, h1Only, 'a-block');

    expect(section.disclosure.maxSectionLevel).toBe(5);
    expect(projectedEntityIds(workspace, section)).toContain('a-deep');
    expect(block.disclosure.maxSectionLevel).toBe(3);
    expect(block.disclosure.includeBlocks).toBe(true);
    expect(projectedEntityIds(workspace, block)).toContain('a-block');
  });

  it('preserves an unlimited or already-wide heading policy', () => {
    const workspace = createProjectionWorkspace(projectionFixture());
    const unlimited = revealEntityInViewState(
      workspace,
      documentOnlyProjectionState(),
      'a-deep',
    );
    const alreadyWide = revealEntityInViewState(
      workspace,
      {
        ...documentOnlyProjectionState(),
        disclosure: {
          ...documentOnlyProjectionState().disclosure,
          maxSectionLevel: 6,
        },
      },
      'a-detail',
    );

    expect(unlimited.disclosure.maxSectionLevel).toBeUndefined();
    expect(alreadyWide.disclosure.maxSectionLevel).toBe(6);
  });

  it('preserves focus and filters because the helper owns disclosure only', () => {
    const workspace = createProjectionWorkspace(projectionFixture());
    const state: ViewProjectionState = {
      ...documentOnlyProjectionState(),
      focus: {
        rootEntityId: 'doc-b',
        hops: 2,
        direction: 'incoming',
        hierarchyContext: 'ancestors',
      },
      filters: {
        pathPrefixes: ['folder'],
        entityKinds: ['section'],
        referenceStatuses: ['resolved'],
      },
    };
    const revealed = revealEntityInViewState(workspace, state, 'b-leaf');

    expect(revealed.focus).toEqual(state.focus);
    expect(revealed.filters).toEqual(state.filters);
  });

  it('leaves document disclosure stable and rejects stale entity IDs', () => {
    const workspace = createProjectionWorkspace(projectionFixture());
    const state = documentOnlyProjectionState();

    expect(revealEntityInViewState(workspace, state, 'doc-a')).toEqual(state);
    expect(() =>
      revealEntityInViewState(workspace, state, 'missing-entity'),
    ).toThrow(/missing entity/u);
  });
});
