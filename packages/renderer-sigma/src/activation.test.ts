import { describe, expect, it, vi } from 'vitest';

vi.mock('sigma', () => ({ default: class {} }));

import { GlobalRendererSession } from './session';
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

function interactionHarness() {
  const handlers = new Map<string, EventHandler>();
  const selected = vi.fn();
  const activated = vi.fn();
  const attributes = new Map([
    ['document', documentNode],
    ['diagnostic', diagnosticNode],
  ]);
  const session = Object.create(
    GlobalRendererSession.prototype,
  ) as GlobalRendererSession;
  Reflect.set(session, 'graph', {
    getNodeAttributes: (key: string) => attributes.get(key),
    hasNode: (key: string) => attributes.has(key),
  });
  Reflect.set(session, 'options', {
    onNodeActivated: activated,
    onNodeSelected: selected,
  });
  Reflect.set(session, 'renderer', {
    on: (event: string, handler: EventHandler) => {
      handlers.set(event, handler);
    },
  });
  (
    session as unknown as {
      bindEvents: () => void;
    }
  ).bindEvents();
  Reflect.set(session, 'refreshNodeStyles', () => undefined);
  return { activated, handlers, selected, session };
}

describe('Global node activation', () => {
  it('keeps single-click selection separate from activation', () => {
    const { activated, handlers, selected } = interactionHarness();

    handlers.get('clickNode')?.({
      node: 'document',
      preventSigmaDefault: vi.fn(),
    });

    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith('document', documentNode);
    expect(activated).not.toHaveBeenCalled();
  });

  it('activates a canonical document exactly once and suppresses Sigma zoom', () => {
    const { activated, handlers } = interactionHarness();
    const preventSigmaDefault = vi.fn();

    handlers.get('doubleClickNode')?.({
      node: 'document',
      preventSigmaDefault,
    });

    expect(preventSigmaDefault).toHaveBeenCalledTimes(1);
    expect(activated).toHaveBeenCalledTimes(1);
    expect(activated).toHaveBeenCalledWith('document', documentNode);
  });

  it('consumes diagnostic double-click without activating or adding edge behavior', () => {
    const { activated, handlers } = interactionHarness();
    const preventSigmaDefault = vi.fn();

    handlers.get('doubleClickNode')?.({
      node: 'diagnostic',
      preventSigmaDefault,
    });

    expect(preventSigmaDefault).toHaveBeenCalledTimes(1);
    expect(activated).not.toHaveBeenCalled();
    expect(handlers.has('doubleClickEdge')).toBe(false);
  });
});
