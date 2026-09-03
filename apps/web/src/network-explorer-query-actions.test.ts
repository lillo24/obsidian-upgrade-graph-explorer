import { describe, expect, it } from 'vitest';
import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectLocalView,
  projectView,
} from '@icarus-graph-explorer/view-projection';
import {
  listExactPathExclusions,
  MAX_GRAPH_QUERY_LENGTH,
  parseGraphQuery,
} from '@icarus-graph-explorer/graph-query';

import {
  hiddenFileLabels,
  planExactPathQueryMutation,
  reconcileGraphQueryDraft,
} from './network-explorer-query-actions';
import { graphStateReducer, initialGraphState } from './graph-state';
import { effectiveGlobalProjectionState } from './global-view';
import {
  createGraphHistoryCheckpoint,
  createGraphNavigationHistory,
  goBackInGraphHistory,
  goForwardInGraphHistory,
  recordGraphNavigation,
} from './navigation-history';

describe('atomic exact-path UI query planning', () => {
  it.each(['All', 'Focus'] as const)(
    '%s Hide removes only the excluded file and its incident edges',
    (scope) => {
      const span = {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 3, column: 1, offset: 20 },
      };
      const snapshot: KnowledgeSnapshot = {
        schemaVersion: 1,
        workspace: { id: 'hide-edge-regression' },
        entities: ['A', 'B', 'C'].map((id) => ({
          id,
          kind: 'document',
          source: { path: `${id}.md`, span },
        })),
        references: ['B', 'C'].map((target) => ({
          id: `A-${target}`,
          sourceEntityId: 'A',
          kind: 'link',
          rawTarget: `${target}.md`,
          sourceSpan: span,
          resolution: { status: 'resolved', targetEntityId: target },
        })),
      };
      const workspace = createProjectionWorkspace(snapshot);
      const initial = {
        ...documentOnlyProjectionState(),
        ...(scope === 'Focus'
          ? {
              focus: {
                rootEntityId: 'A',
                hops: 1,
                direction: 'both',
                hierarchyContext: 'ancestors',
              } as const,
            }
          : {}),
      };
      const project = (state: typeof initial) =>
        scope === 'Focus'
          ? projectLocalView(workspace, state)
          : projectView(
              workspace,
              effectiveGlobalProjectionState(workspace, state),
            );
      expect(project(initial).edges).toHaveLength(2);
      const hidden = planExactPathQueryMutation({
        activeQuery: undefined,
        queryDraft: '',
        path: 'C.md',
        operation: 'add',
      });
      if (!hidden.ok) throw new Error(hidden.issue);
      const state = graphStateReducer(initial, {
        type: 'set-query',
        query: hidden.query ?? null,
      });
      const projection = project(state);
      expect(
        projection.nodes.map((node) =>
          node.kind === 'entity' ? node.entityId : node.id,
        ),
      ).toEqual(['A', 'B']);
      expect(projection.edges).toHaveLength(1);
      expect(projection.edges[0]).toMatchObject({
        kind: 'reference',
        referenceIds: ['A-B'],
      });
    },
  );

  it('adds to clean empty, AND, and OR queries without replacing their meaning', () => {
    for (const query of [
      undefined,
      'kind:document AND title:"notes"',
      'title:"one" OR title:"two"',
    ]) {
      const plan = planExactPathQueryMutation({
        activeQuery: query,
        queryDraft: query ?? '',
        path: 'Notes/Foo.md',
        operation: 'add',
      });
      expect(plan.ok).toBe(true);
      if (!plan.ok) throw new Error(plan.issue);
      expect(plan.draft).toBe(plan.query);
      expect(listExactPathExclusions(plan.query)).toEqual({
        ok: true,
        paths: ['Notes/Foo.md'],
      });
      if (query?.includes('OR'))
        expect(plan.query).toContain(
          '(title:"one" OR title:"two") AND NOT path="Notes/Foo.md"',
        );
    }
  });

  it('mutates valid dirty drafts independently so their later Apply preserves Hide', () => {
    const plan = planExactPathQueryMutation({
      activeQuery: 'kind:document',
      queryDraft: 'title:"todo" OR title:"notes"',
      path: 'A.md',
      operation: 'add',
    });
    if (!plan.ok) throw new Error(plan.issue);
    expect(plan.query).not.toBe(plan.draft);
    expect(listExactPathExclusions(plan.query)).toEqual(
      listExactPathExclusions(plan.draft),
    );
    expect(parseGraphQuery(plan.draft).valid).toBe(true);
  });

  it.each(['add', 'remove'] as const)(
    'blocks %s atomically when the dirty draft is invalid or a limit would be exceeded',
    (operation) => {
      expect(
        planExactPathQueryMutation({
          activeQuery: 'NOT path="A.md"',
          queryDraft: 'title:',
          path: 'A.md',
          operation,
        }),
      ).toMatchObject({
        ok: false,
        issue: expect.stringContaining('Fix or reset'),
      });
      const tooLong = `title:"${'x'.repeat(MAX_GRAPH_QUERY_LENGTH)}"`;
      expect(
        planExactPathQueryMutation({
          activeQuery: tooLong,
          queryDraft: tooLong,
          path: 'A.md',
          operation,
        }).ok,
      ).toBe(false);
    },
  );

  it('rejects a valid dirty draft whose added exclusion exceeds the length budget', () => {
    const draft = `title:"${'x'.repeat(MAX_GRAPH_QUERY_LENGTH - 8)}"`;
    expect(parseGraphQuery(draft).valid).toBe(true);
    expect(
      planExactPathQueryMutation({
        activeQuery: undefined,
        queryDraft: draft,
        path: 'A.md',
        operation: 'add',
      }).ok,
    ).toBe(false);
  });

  it('restores only the requested global term in active and dirty queries, including the sole term', () => {
    const active =
      'NOT path="A.md" AND kind:document AND NOT path="B.md" AND NOT path="C.md"';
    for (const path of ['A.md', 'B.md', 'C.md']) {
      const plan = planExactPathQueryMutation({
        activeQuery: active,
        queryDraft: `${active} AND title:"todo"`,
        path,
        operation: 'remove',
      });
      if (!plan.ok) throw new Error(plan.issue);
      expect(listExactPathExclusions(plan.query)).toEqual({
        ok: true,
        paths: ['A.md', 'B.md', 'C.md'].filter((item) => item !== path),
      });
      expect(listExactPathExclusions(plan.draft)).toEqual(
        listExactPathExclusions(plan.query),
      );
      expect(plan.draft).toContain('title:"todo"');
    }
    expect(
      planExactPathQueryMutation({
        activeQuery: 'NOT path="gone.md"',
        queryDraft: 'NOT path="gone.md"',
        path: 'gone.md',
        operation: 'remove',
      }),
    ).toEqual({ ok: true, query: undefined, draft: '' });
  });

  it('keeps chip identity from exact paths, including duplicate basenames and nonexistent paths', () => {
    expect(hiddenFileLabels(['a/Note.md', 'b/Note.md', 'gone.md'])).toEqual([
      { path: 'a/Note.md', label: 'a/Note.md' },
      { path: 'b/Note.md', label: 'b/Note.md' },
      { path: 'gone.md', label: 'gone.md' },
    ]);
  });

  it('keeps clean drafts following history and dirty drafts intact across placement/external updates', () => {
    const clean = {
      activeQuery: 'kind:document',
      draft: 'kind:document',
      issue: undefined,
    };
    expect(reconcileGraphQueryDraft(clean, 'NOT path="A.md"').draft).toBe(
      'NOT path="A.md"',
    );
    const dirty = { ...clean, draft: 'title:"todo"' };
    expect(reconcileGraphQueryDraft(dirty, 'NOT path="A.md"').draft).toBe(
      dirty.draft,
    );
    expect(reconcileGraphQueryDraft(dirty, dirty.activeQuery)).toBe(dirty);
  });

  it('uses one normal set-query checkpoint and preserves Back/Forward for Hide and restore', () => {
    const initial = createGraphHistoryCheckpoint(
      initialGraphState(),
      undefined,
      'global',
    );
    let history = createGraphNavigationHistory();
    const hidden = planExactPathQueryMutation({
      activeQuery: undefined,
      queryDraft: '',
      path: 'A.md',
      operation: 'add',
    });
    if (!hidden.ok) throw new Error(hidden.issue);
    const afterHide = createGraphHistoryCheckpoint(
      graphStateReducer(initial.state, {
        type: 'set-query',
        query: hidden.query ?? null,
      }),
      undefined,
      'global',
    );
    history = recordGraphNavigation(history, initial, afterHide);
    const restored = planExactPathQueryMutation({
      activeQuery: hidden.query,
      queryDraft: hidden.draft,
      path: 'A.md',
      operation: 'remove',
    });
    if (!restored.ok) throw new Error(restored.issue);
    const afterRestore = createGraphHistoryCheckpoint(
      graphStateReducer(afterHide.state, {
        type: 'set-query',
        query: restored.query ?? null,
      }),
      undefined,
      'global',
    );
    history = recordGraphNavigation(history, afterHide, afterRestore);
    const back = goBackInGraphHistory(history, afterRestore);
    expect(back?.target.state.filters?.query).toBe(hidden.query);
    if (back === null) throw new Error('Expected Back checkpoint.');
    expect(
      goForwardInGraphHistory(back.history, back.target)?.target.state.filters
        ?.query,
    ).toBeUndefined();
  });
});
