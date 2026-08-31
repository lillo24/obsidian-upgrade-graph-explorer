import { describe, expect, it } from 'vitest';

import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectView,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import { planEntityNavigation, topLevelPathScopes } from './navigation';

const snapshot: KnowledgeSnapshot = {
  schemaVersion: 1,
  workspace: { id: 'navigation-test' },
  entities: [
    {
      id: 'doc-a',
      kind: 'document',
      source: {
        path: 'alpha/A.md',
        span: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 10, column: 1, offset: 100 },
        },
      },
    },
    {
      id: 'section-a',
      kind: 'section',
      parentId: 'doc-a',
      title: 'Hidden',
      level: 1,
      source: {
        path: 'alpha/A.md',
        span: {
          start: { line: 2, column: 1, offset: 10 },
          end: { line: 8, column: 1, offset: 80 },
        },
      },
    },
    {
      id: 'block-a',
      kind: 'block',
      parentId: 'section-a',
      source: {
        path: 'alpha/A.md',
        span: {
          start: { line: 5, column: 1, offset: 50 },
          end: { line: 5, column: 5, offset: 54 },
        },
      },
    },
    {
      id: 'section-deep',
      kind: 'section',
      parentId: 'section-a',
      title: 'Deep heading',
      level: 3,
      source: {
        path: 'alpha/A.md',
        span: {
          start: { line: 6, column: 1, offset: 60 },
          end: { line: 7, column: 1, offset: 70 },
        },
      },
    },
    {
      id: 'doc-b',
      kind: 'document',
      source: {
        path: 'beta/B.md',
        span: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 2, column: 1, offset: 20 },
        },
      },
    },
  ],
  references: [],
};

describe('shared canonical navigation planning', () => {
  it('exits focus, reveals a nested target, and returns its projected selection', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const state: ViewProjectionState = {
      ...documentOnlyProjectionState(),
      focus: {
        rootEntityId: 'doc-b',
        hops: 1,
        direction: 'both',
        hierarchyContext: 'ancestors',
      },
    };
    const plan = planEntityNavigation(workspace, state, 'section-a');

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.state.focus).toBeUndefined();
    expect(plan.state.disclosure.expandedEntityIds).toEqual(['doc-a']);
    expect(
      projectView(workspace, plan.state).nodes.some(
        (node) =>
          node.kind === 'entity' &&
          node.id === plan.projectionNodeId &&
          node.entityId === 'section-a',
      ),
    ).toBe(true);
  });

  it('enables block policy and widens only conflicting path/kind/text filters', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const state: ViewProjectionState = {
      ...documentOnlyProjectionState(),
      filters: {
        pathPrefixes: ['beta'],
        entityKinds: ['document'],
        referenceStatuses: ['unresolved'],
        text: 'not-the-target',
      },
    };
    const plan = planEntityNavigation(workspace, state, 'block-a');

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.state.disclosure.includeBlocks).toBe(true);
    expect(plan.state.filters).toEqual({
      entityKinds: ['block', 'document'],
      referenceStatuses: ['unresolved'],
    });
    expect(plan.filterChanges).toEqual([
      'path-scope-cleared',
      'entity-kind-included',
      'projected-text-cleared',
    ]);
    expect(plan.announcement).toMatch(/scope cleared/u);
  });

  it('widens a heading limit only enough to reveal a deeper search target', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const state: ViewProjectionState = {
      ...documentOnlyProjectionState(),
      disclosure: {
        ...documentOnlyProjectionState().disclosure,
        maxSectionLevel: 1,
      },
    };
    const plan = planEntityNavigation(workspace, state, 'section-deep');

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.headingLimitWidened).toBe(true);
    expect(plan.state.disclosure.maxSectionLevel).toBe(3);
    expect(plan.state.disclosure.expandedEntityIds).toEqual([
      'doc-a',
      'section-a',
    ]);
    expect(plan.announcement).toContain('Heading limit widened to ###');
    expect(
      projectView(workspace, plan.state).nodes.some(
        (node) => node.kind === 'entity' && node.entityId === 'section-deep',
      ),
    ).toBe(true);
  });

  it('keeps a matching advanced query and clears a conflicting one', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const matching = planEntityNavigation(
      workspace,
      {
        ...documentOnlyProjectionState(),
        filters: { query: 'path:"alpha" AND sections' },
      },
      'section-a',
    );
    const conflicting = planEntityNavigation(
      workspace,
      {
        ...documentOnlyProjectionState(),
        filters: {
          pathPrefixes: ['alpha'],
          query: 'documents AND path:"beta"',
        },
      },
      'section-a',
    );

    expect(matching.ok).toBe(true);
    if (matching.ok) {
      expect(matching.state.filters?.query).toBe('path:"alpha" AND sections');
      expect(matching.filterChanges).not.toContain('advanced-query-cleared');
    }
    expect(conflicting.ok).toBe(true);
    if (conflicting.ok) {
      expect(conflicting.state.filters).toEqual({ pathPrefixes: ['alpha'] });
      expect(conflicting.filterChanges).toContain('advanced-query-cleared');
      expect(conflicting.announcement).toContain('Advanced query cleared');
    }
  });

  it('clears an invalid externally supplied query instead of failing navigation', () => {
    const plan = planEntityNavigation(
      createProjectionWorkspace(snapshot),
      {
        ...documentOnlyProjectionState(),
        filters: { query: 'sections documents' },
      },
      'doc-b',
    );

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.state.filters).toBeUndefined();
    expect(plan.filterChanges).toEqual(['advanced-query-cleared']);
  });

  it('reveals a deep target without widening the selected structural depth', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const state: ViewProjectionState = {
      ...documentOnlyProjectionState(),
      disclosure: {
        ...documentOnlyProjectionState().disclosure,
        defaultDepth: 1,
      },
    };
    const plan = planEntityNavigation(workspace, state, 'section-deep');

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.state.disclosure.defaultDepth).toBe(1);
    expect(plan.state.disclosure.expandedEntityIds).toEqual([
      'doc-a',
      'section-a',
    ]);
  });

  it('supports breadcrumb/backlink/candidate callers without mutating inputs', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const state = documentOnlyProjectionState();
    const before = JSON.stringify({ snapshot, state });
    const plan = planEntityNavigation(workspace, state, 'doc-b');

    expect(plan.ok).toBe(true);
    expect(JSON.stringify({ snapshot, state })).toBe(before);
  });

  it('returns an actionable failure for stale canonical targets', () => {
    const plan = planEntityNavigation(
      createProjectionWorkspace(snapshot),
      documentOnlyProjectionState(),
      'missing',
    );

    expect(plan).toEqual({
      ok: false,
      message:
        'Cannot navigate: entity "missing" is no longer present in the loaded report.',
    });
  });

  it('derives normalized top-level folder scopes without hard-coded names', () => {
    expect(topLevelPathScopes(createProjectionWorkspace(snapshot))).toEqual([
      'alpha',
      'beta',
    ]);
  });
});
