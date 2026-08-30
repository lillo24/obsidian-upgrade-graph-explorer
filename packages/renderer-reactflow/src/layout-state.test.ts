import { describe, expect, it } from 'vitest';

import type { DagreLayoutInput } from '@icarus-graph-explorer/dagre-layout';

import {
  INITIAL_RENDERER_LAYOUT_STATE,
  beginRendererLayout,
  commitRendererLayout,
} from './layout-state';
import type { RendererGraph } from './types';

const input = (id: string): DagreLayoutInput => ({
  mode: 'structure',
  nodes: [{ id, width: 100, height: 60 }],
  edges: [],
});
const graph = (id: string): RendererGraph => ({
  nodes: [],
  edges: [],
  layoutWarning: id,
});

describe('async renderer layout state', () => {
  it('keeps the last committed graph while a newer layout is pending', () => {
    const firstPending = beginRendererLayout(INITIAL_RENDERER_LAYOUT_STATE, 1);
    const firstCommitted = commitRendererLayout(firstPending, {
      generation: 1,
      input: input('a'),
      graph: graph('a'),
      disclosureAnchor: null,
    });
    const secondPending = beginRendererLayout(firstCommitted, 2);

    expect(secondPending.pendingGeneration).toBe(2);
    expect(secondPending.committed?.graph.layoutWarning).toBe('a');
  });

  it('allows only the latest generation to commit', () => {
    const first = beginRendererLayout(INITIAL_RENDERER_LAYOUT_STATE, 1);
    const second = beginRendererLayout(first, 2);
    const stale = commitRendererLayout(second, {
      generation: 1,
      input: input('a'),
      graph: graph('a'),
      disclosureAnchor: null,
    });
    const current = commitRendererLayout(stale, {
      generation: 2,
      input: input('b'),
      graph: graph('b'),
      disclosureAnchor: null,
    });

    expect(stale).toBe(second);
    expect(current.committed?.graph.layoutWarning).toBe('b');
  });

  it('carries a disclosure anchor only on its matching commit', () => {
    const anchor = {
      projectionNodeId: 'node-a',
      entityId: 'entity-a',
      screenPoint: { x: 10, y: 20 },
      zoom: 1,
    };
    const pending = beginRendererLayout(INITIAL_RENDERER_LAYOUT_STATE, 3);
    const committed = commitRendererLayout(pending, {
      generation: 3,
      input: input('a'),
      graph: graph('a'),
      disclosureAnchor: anchor,
    });

    expect(committed.committed?.disclosureAnchor).toEqual(anchor);
  });
});
