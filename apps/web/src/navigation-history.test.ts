import { describe, expect, it } from 'vitest';

import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import { reconcileCurrentWorkspaceView } from '@icarus-graph-explorer/view-state';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectView,
  type StructuralDepth,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import {
  graphStateReducer,
  initialGraphState,
  type GraphStateAction,
} from './graph-state';
import {
  createGraphHistoryCheckpoint,
  createGraphNavigationHistory,
  goBackInGraphHistory,
  goForwardInGraphHistory,
  GRAPH_NAVIGATION_HISTORY_LIMIT,
  graphHistoryActionPolicy,
  nextGraphViewportRequestKey,
  planSemanticViewportRestore,
  recordGraphNavigation,
  sameGraphHistoryCheckpoint,
  sameGraphViewState,
} from './navigation-history';

const snapshot: KnowledgeSnapshot = {
  schemaVersion: 1,
  workspace: { id: 'history-test' },
  entities: [
    {
      id: 'doc-a',
      kind: 'document',
      source: {
        path: 'A.md',
        span: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 4, column: 1, offset: 30 },
        },
      },
    },
    {
      id: 'section-a',
      kind: 'section',
      parentId: 'doc-a',
      title: 'A section',
      level: 1,
      source: {
        path: 'A.md',
        span: {
          start: { line: 2, column: 1, offset: 5 },
          end: { line: 4, column: 1, offset: 30 },
        },
      },
    },
  ],
  references: [],
};

function stateWithText(text: string): ViewProjectionState {
  return { ...initialGraphState(), filters: { text } };
}

describe('renderer-independent graph navigation history', () => {
  it('records and traverses all four structural depths while preserving no-op history', () => {
    const atDepth = (depth: StructuralDepth) =>
      graphStateReducer(initialGraphState(), { type: 'set-depth', depth });
    let history = createGraphNavigationHistory();
    let current = createGraphHistoryCheckpoint(atDepth(0));
    for (const depth of [1, 2, 3] as const) {
      const destination = createGraphHistoryCheckpoint(atDepth(depth));
      history = recordGraphNavigation(history, current, destination);
      current = destination;
    }

    const backToTwo = goBackInGraphHistory(history, current);
    if (backToTwo === null) throw new Error('Expected Back to depth 2.');
    expect(backToTwo.target.state.disclosure.defaultDepth).toBe(2);
    expect(
      recordGraphNavigation(
        backToTwo.history,
        backToTwo.target,
        createGraphHistoryCheckpoint(atDepth(2)),
      ),
    ).toBe(backToTwo.history);
    expect(backToTwo.history.future).toHaveLength(1);

    const backToOne = goBackInGraphHistory(backToTwo.history, backToTwo.target);
    if (backToOne === null) throw new Error('Expected Back to depth 1.');
    expect(backToOne.target.state.disclosure.defaultDepth).toBe(1);
    const forwardToTwo = goForwardInGraphHistory(
      backToOne.history,
      backToOne.target,
    );
    if (forwardToTwo === null) throw new Error('Expected Forward to depth 2.');
    expect(forwardToTwo.target.state.disclosure.defaultDepth).toBe(2);
  });

  it('starts empty and cannot traverse', () => {
    const history = createGraphNavigationHistory();
    const current = createGraphHistoryCheckpoint(initialGraphState());

    expect(history).toEqual({ past: [], future: [] });
    expect(goBackInGraphHistory(history, current)).toBeNull();
    expect(goForwardInGraphHistory(history, current)).toBeNull();
  });

  it('keeps viewport request keys monotonic across active-request clears', () => {
    let lastIssuedKey = 1;
    const activeRequest: { readonly key: number } | undefined = undefined;

    lastIssuedKey = nextGraphViewportRequestKey(lastIssuedKey);

    expect(activeRequest).toBeUndefined();
    expect(lastIssuedKey).toBe(2);
    expect(nextGraphViewportRequestKey(lastIssuedKey)).toBe(3);
  });

  it('records current state immutably and clears future after a new action', () => {
    const a = createGraphHistoryCheckpoint(stateWithText('A'));
    const b = createGraphHistoryCheckpoint(stateWithText('B'));
    const c = createGraphHistoryCheckpoint(stateWithText('C'));
    const original = createGraphNavigationHistory();
    const atB = recordGraphNavigation(original, a, b);
    const back = goBackInGraphHistory(atB, b);
    if (back === null) throw new Error('Expected Back to be available.');
    const branched = recordGraphNavigation(back.history, back.target, c);

    expect(original).toEqual({ past: [], future: [] });
    expect(atB).toEqual({ past: [a], future: [] });
    expect(back.history).toEqual({ past: [], future: [b] });
    expect(branched).toEqual({ past: [a], future: [] });
  });

  it('moves the current checkpoint symmetrically between past and future', () => {
    const a = createGraphHistoryCheckpoint(stateWithText('A'));
    const b = createGraphHistoryCheckpoint(stateWithText('B'));
    const history = recordGraphNavigation(createGraphNavigationHistory(), a, b);
    const back = goBackInGraphHistory(history, b);
    if (back === null) throw new Error('Expected Back to be available.');
    const forward = goForwardInGraphHistory(back.history, back.target);

    expect(back.target).toBe(a);
    expect(back.history).toEqual({ past: [], future: [b] });
    expect(forward).toEqual({
      target: b,
      history: { past: [a], future: [] },
    });
  });

  it('traverses renderer modes with their independent semantic viewports', () => {
    const structure = createGraphHistoryCheckpoint(
      initialGraphState(),
      undefined,
      'structure',
      { structure: { anchorEntityId: 'section-a', zoom: 1.1 } },
    );
    const global = createGraphHistoryCheckpoint(
      initialGraphState(),
      undefined,
      'global',
      { global: { anchorEntityId: 'doc-a', ratio: 0.32 } },
    );
    const history = recordGraphNavigation(
      createGraphNavigationHistory(),
      structure,
      global,
    );
    const back = goBackInGraphHistory(history, global);
    if (back === null) throw new Error('Expected cross-mode Back.');
    const forward = goForwardInGraphHistory(back.history, back.target);

    expect(back.target).toEqual(structure);
    expect(forward?.target).toEqual(global);
  });

  it('bounds retained checkpoints at 100 and drops the oldest', () => {
    let history = createGraphNavigationHistory();
    for (let index = 0; index <= GRAPH_NAVIGATION_HISTORY_LIMIT; index += 1) {
      history = recordGraphNavigation(
        history,
        createGraphHistoryCheckpoint(stateWithText(String(index))),
        createGraphHistoryCheckpoint(stateWithText(String(index + 1))),
      );
    }

    expect(history.past).toHaveLength(GRAPH_NAVIGATION_HISTORY_LIMIT);
    expect(history.past[0]?.state.filters?.text).toBe('1');
    expect(history.past.at(-1)?.state.filters?.text).toBe('100');
  });

  it('treats equivalent state and tiny zoom noise as a no-op', () => {
    const history = {
      past: [createGraphHistoryCheckpoint(stateWithText('past'))],
      future: [createGraphHistoryCheckpoint(stateWithText('future'))],
    };
    const left = createGraphHistoryCheckpoint(initialGraphState(), {
      anchorEntityId: 'doc-a',
      zoom: 1.1,
    });
    const right = createGraphHistoryCheckpoint(
      {
        ...initialGraphState(),
        disclosure: { ...initialGraphState().disclosure },
      },
      { anchorEntityId: 'doc-a', zoom: 1.10005 },
    );

    expect(sameGraphHistoryCheckpoint(left, right)).toBe(true);
    expect(recordGraphNavigation(history, left, right)).toBe(history);
  });

  it('includes semantic viewport differences in checkpoint equality', () => {
    const state = initialGraphState();
    const left = createGraphHistoryCheckpoint(state, {
      anchorEntityId: 'doc-a',
      zoom: 1,
    });
    const moved = createGraphHistoryCheckpoint(state, {
      anchorEntityId: 'section-a',
      zoom: 1,
    });
    const zoomed = createGraphHistoryCheckpoint(state, {
      anchorEntityId: 'doc-a',
      zoom: 1.2,
    });

    expect(sameGraphHistoryCheckpoint(left, moved)).toBe(false);
    expect(sameGraphHistoryCheckpoint(left, zoomed)).toBe(false);
  });

  it('compares every graph-state dimension, including transient projected text', () => {
    const base = initialGraphState();
    const variants: ViewProjectionState[] = [
      { ...base, disclosure: { ...base.disclosure, defaultDepth: 1 } },
      { ...base, disclosure: { ...base.disclosure, maxSectionLevel: 2 } },
      { ...base, disclosure: { ...base.disclosure, includeBlocks: true } },
      {
        ...base,
        disclosure: { ...base.disclosure, expandedEntityIds: ['doc-a'] },
      },
      {
        ...base,
        disclosure: { ...base.disclosure, collapsedEntityIds: ['doc-a'] },
      },
      {
        ...base,
        focus: {
          rootEntityId: 'doc-a',
          hops: 2,
          direction: 'incoming',
          hierarchyContext: 'ancestors',
        },
      },
      { ...base, filters: { pathPrefixes: ['folder'] } },
      { ...base, filters: { entityKinds: ['document'] } },
      { ...base, filters: { referenceStatuses: ['resolved'] } },
      { ...base, filters: { text: 'needle' } },
    ];

    expect(
      variants.every((variant) => !sameGraphViewState(base, variant)),
    ).toBe(true);
  });

  it('stores only semantic state and optional canonical viewport data', () => {
    const checkpoint = createGraphHistoryCheckpoint(initialGraphState(), {
      anchorEntityId: 'doc-a',
      zoom: 1.25,
    });

    expect(Object.keys(checkpoint).sort()).toEqual([
      'rendererMode',
      'state',
      'viewports',
    ]);
    expect(Object.keys(checkpoint.viewports.structure ?? {}).sort()).toEqual([
      'anchorEntityId',
      'zoom',
    ]);
    expect(checkpoint).not.toHaveProperty('selection');
    expect(checkpoint).not.toHaveProperty('transform');
    expect(checkpoint).not.toHaveProperty('layout');
  });

  it('classifies every current graph action explicitly', () => {
    const recordActions: readonly GraphStateAction[] = [
      { type: 'toggle-entity', entityId: 'doc-a', currentlyOpen: false },
      { type: 'set-depth', depth: 1 },
      { type: 'set-heading-limit', maxSectionLevel: 2 },
      { type: 'set-include-blocks', includeBlocks: true },
      { type: 'enter-focus', entityId: 'doc-a' },
      { type: 'exit-focus' },
      { type: 'set-focus-hops', hops: 2 },
      { type: 'set-focus-direction', direction: 'incoming' },
      { type: 'set-path-scope', pathPrefix: 'folder' },
      {
        type: 'toggle-entity-kind',
        entityKind: 'section',
        enabled: false,
      },
      {
        type: 'toggle-reference-status',
        status: 'invalid',
        enabled: false,
      },
      { type: 'apply-navigation', state: initialGraphState() },
    ];

    expect(recordActions.map(graphHistoryActionPolicy)).toEqual(
      recordActions.map(() => 'record'),
    );
    expect(
      graphHistoryActionPolicy({
        type: 'replace-state',
        state: initialGraphState(),
      }),
    ).toBe('system');
    expect(graphHistoryActionPolicy({ type: 'reset-view' })).toBe('clear');
  });

  it('resolves visible canonical anchors to projection IDs and Fits hidden anchors', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const projection = projectView(workspace, documentOnlyProjectionState());
    const document = projection.nodes.find(
      (node) => node.kind === 'entity' && node.entityId === 'doc-a',
    );
    if (document === undefined) throw new Error('Missing document node.');

    expect(
      planSemanticViewportRestore(projection, {
        anchorEntityId: 'doc-a',
        zoom: 1.1,
      }),
    ).toEqual({ kind: 'center', nodeId: document.id, zoom: 1.1 });
    expect(
      planSemanticViewportRestore(projection, {
        anchorEntityId: 'section-a',
        zoom: 1.1,
      }),
    ).toEqual({ kind: 'fit' });
    expect(planSemanticViewportRestore(projection, undefined)).toEqual({
      kind: 'fit',
    });
  });

  it('lazily reconciles missing Focus and viewport targets before restoration', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const staleState: ViewProjectionState = {
      ...initialGraphState(),
      disclosure: {
        ...initialGraphState().disclosure,
        expandedEntityIds: ['missing'],
      },
      focus: {
        rootEntityId: 'missing',
        hops: 2,
        direction: 'both',
        hierarchyContext: 'ancestors',
      },
      filters: { pathPrefixes: ['missing-folder'] },
    };
    const reconciled = reconcileCurrentWorkspaceView(workspace, staleState, {
      anchorEntityId: 'missing',
      zoom: 1.1,
    });
    const projection = projectView(workspace, reconciled.state);

    expect(reconciled.state.focus).toBeUndefined();
    expect(reconciled.state.disclosure.expandedEntityIds).toEqual([]);
    expect(reconciled.state.filters).toBeUndefined();
    expect(reconciled.viewport).toBeUndefined();
    expect(reconciled.issues.map(({ code }) => code)).toEqual([
      'unknown-expanded-entity',
      'focus-root-missing',
      'path-filter-no-longer-matches',
      'viewport-anchor-missing',
    ]);
    expect(
      planSemanticViewportRestore(projection, reconciled.viewport),
    ).toEqual({ kind: 'fit' });
  });
});
