import { describe, expect, it } from 'vitest';

import {
  documentOnlyProjectionState,
  topLevelSectionProjectionState,
} from './presets';
import { projectSnapshot } from './project';
import { projectionFixture } from './test-fixture';
import type { ProjectedEntityNode, ViewProjectionState } from './types';

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
  it('projects documents only and reports every hidden structural descendant', () => {
    const nodes = entityNodes(documentOnlyProjectionState());

    expect(nodes.map((node) => node.entityId).sort()).toEqual([
      'doc-a',
      'doc-b',
      'doc-c',
    ]);
    expect(nodes.find((node) => node.entityId === 'doc-a')).toMatchObject({
      hasHiddenChildren: true,
      hiddenDescendantCount: 4,
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
