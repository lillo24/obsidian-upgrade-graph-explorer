import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', () => ({ default: class {} }));

import { GlobalRendererSession } from './session';
import { LocalRendererSession } from './local-session';
import { NODE_DOUBLE_CLICK_TIMEOUT_MS } from './node-click';
import { buildGlobalGraph } from './graph';
import { buildLocalGraph } from './local-graph';
import type { GlobalNodeAttributes } from './types';

const documentNode: GlobalNodeAttributes = {
  x: 0,
  y: 0,
  size: 4,
  color: '#123456',
  label: 'Document',
  nodeKind: 'document',
  entityId: 'doc-a',
  sourcePath: 'A.md',
  status: null,
  folderKey: '.',
  revealableDescendantCount: 0,
};

const diagnosticNode: GlobalNodeAttributes = {
  ...documentNode,
  label: 'Missing',
  nodeKind: 'diagnostic',
  entityId: null,
  sourcePath: null,
  status: 'unresolved',
  folderKey: null,
};

type EventHandler = (payload: {
  readonly node: string;
  readonly preventSigmaDefault: () => void;
}) => void;

function interactionHarness(mode: 'global' | 'local') {
  const handlers = new Map<string, EventHandler>();
  const selected = vi.fn();
  const activated = vi.fn();
  const singleClick = vi.fn();
  const attributes = new Map([
    ['document', documentNode],
    ['diagnostic', diagnosticNode],
  ]);
  const session = Object.create(
    mode === 'global'
      ? GlobalRendererSession.prototype
      : LocalRendererSession.prototype,
  ) as GlobalRendererSession;
  Reflect.set(session, 'graph', {
    getNodeAttributes: (key: string) => attributes.get(key),
    hasNode: (key: string) => attributes.has(key),
  });
  Reflect.set(session, 'options', {
    onNodeActivated: activated,
    onNodeSelected: selected,
    onNodeSingleClick: singleClick,
  });
  Reflect.set(session, 'renderer', {
    on: (event: string, handler: EventHandler) => {
      handlers.set(event, handler);
    },
    scheduleRender: vi.fn(),
    scheduleRefresh: vi.fn(),
    getMouseCaptor: () => ({ off: vi.fn() }),
    getCamera: () => ({ off: vi.fn(), ratio: 1 }),
    kill: vi.fn(),
  });
  (
    session as unknown as {
      bindEvents: () => void;
    }
  ).bindEvents();
  Reflect.set(session, 'refreshNodeStyles', () => undefined);
  return { activated, handlers, selected, session, singleClick };
}

describe.each(['global', 'local'] as const)('%s node activation', (mode) => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps single-click selection separate from activation', () => {
    const { activated, handlers, selected, singleClick } =
      interactionHarness(mode);

    handlers.get('clickNode')?.({
      node: 'document',
      preventSigmaDefault: vi.fn(),
    });

    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith('document', documentNode);
    expect(activated).not.toHaveBeenCalled();
    expect(singleClick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NODE_DOUBLE_CLICK_TIMEOUT_MS);
    expect(singleClick).toHaveBeenCalledExactlyOnceWith('document');
  });

  it('activates a canonical document exactly once and suppresses Sigma zoom', () => {
    const { activated, handlers, singleClick } = interactionHarness(mode);
    const preventSigmaDefault = vi.fn();

    handlers.get('clickNode')?.({
      node: 'document',
      preventSigmaDefault: vi.fn(),
    });
    vi.advanceTimersByTime(NODE_DOUBLE_CLICK_TIMEOUT_MS - 1);

    handlers.get('doubleClickNode')?.({
      node: 'document',
      preventSigmaDefault,
    });

    expect(preventSigmaDefault).toHaveBeenCalledTimes(1);
    expect(activated).toHaveBeenCalledTimes(1);
    if (mode === 'global')
      expect(activated).toHaveBeenCalledWith('document', documentNode);
    else expect(activated).toHaveBeenCalledWith('doc-a');
    vi.advanceTimersByTime(NODE_DOUBLE_CLICK_TIMEOUT_MS);
    expect(singleClick).not.toHaveBeenCalled();
  });

  it('consumes diagnostic double-click without activating or adding edge behavior', () => {
    const { activated, handlers, singleClick } = interactionHarness(mode);
    const preventSigmaDefault = vi.fn();

    handlers.get('clickNode')?.({
      node: 'diagnostic',
      preventSigmaDefault: vi.fn(),
    });

    handlers.get('doubleClickNode')?.({
      node: 'diagnostic',
      preventSigmaDefault,
    });

    expect(preventSigmaDefault).toHaveBeenCalledTimes(1);
    expect(activated).not.toHaveBeenCalled();
    expect(handlers.has('doubleClickEdge')).toBe(false);
    vi.runAllTimers();
    expect(singleClick).not.toHaveBeenCalled();
  });

  it('reveals repeated clicks on the selected node, including after a double click', () => {
    const { handlers, selected, singleClick, activated } =
      interactionHarness(mode);
    const event = { node: 'document', preventSigmaDefault: vi.fn() };
    for (let click = 0; click < 2; click++) {
      handlers.get('clickNode')?.(event);
      vi.advanceTimersByTime(NODE_DOUBLE_CLICK_TIMEOUT_MS);
    }
    expect(selected).toHaveBeenCalledTimes(2);
    expect(singleClick.mock.calls).toEqual([['document'], ['document']]);
    handlers.get('clickNode')?.(event);
    handlers.get('doubleClickNode')?.(event);
    vi.advanceTimersByTime(NODE_DOUBLE_CLICK_TIMEOUT_MS);
    handlers.get('clickNode')?.(event);
    vi.advanceTimersByTime(NODE_DOUBLE_CLICK_TIMEOUT_MS);
    expect(singleClick).toHaveBeenCalledTimes(3);
    expect(activated).toHaveBeenCalledTimes(1);
  });

  it.each(['clickStage', 'doubleClickStage', 'destroy'])(
    'cancels a pending reveal on %s',
    (action) => {
      const { handlers, session, singleClick } = interactionHarness(mode);
      const event = { node: 'document', preventSigmaDefault: vi.fn() };
      handlers.get('clickNode')?.(event);
      if (action === 'destroy') session.destroy();
      else handlers.get(action)?.(event);
      vi.runAllTimers();
      expect(singleClick).not.toHaveBeenCalled();
    },
  );

  it('cancels a pending reveal when the projection is updated', () => {
    const { handlers, session, singleClick } = interactionHarness(mode);
    const input = {
      nodes: [{ key: 'document', attributes: { ...documentNode, root: true } }],
      edges: [],
      projectionIssues: [],
      rootNodeKey: 'document',
    };
    Reflect.set(
      session,
      'graph',
      mode === 'global' ? buildGlobalGraph(input) : buildLocalGraph(input),
    );
    Reflect.set(session, 'viewportAnchorNodeKey', () => 'document');
    Reflect.set(session, 'nodeViewportPoint', () => undefined);
    handlers.get('clickNode')?.({
      node: 'document',
      preventSigmaDefault: vi.fn(),
    });
    session.update(input);
    vi.runAllTimers();
    expect(singleClick).not.toHaveBeenCalled();
  });

  it('keeps selection echoes pending but cancels on external selection changes', () => {
    const { handlers, session, singleClick } = interactionHarness(mode);
    const event = { node: 'document', preventSigmaDefault: vi.fn() };
    handlers.get('clickNode')?.(event);
    session.setControlledSelection('document');
    vi.runAllTimers();
    expect(singleClick).toHaveBeenCalledTimes(1);
    handlers.get('clickNode')?.(event);
    session.setControlledSelection('diagnostic');
    vi.runAllTimers();
    expect(singleClick).toHaveBeenCalledTimes(1);
  });
});
