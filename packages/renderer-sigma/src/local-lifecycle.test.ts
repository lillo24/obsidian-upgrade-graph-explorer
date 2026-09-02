import { describe, expect, it, vi } from 'vitest';

import {
  mountLocalRendererSession,
  refreshLocalRendererWithAnchor,
} from './local-lifecycle';

describe('Local renderer lifecycle', () => {
  it('reports WebGL construction failure without a success-shaped session', () => {
    const result = mountLocalRendererSession(() => {
      throw new Error('WebGL is unavailable');
    });

    expect(result).toEqual({
      ok: false,
      message:
        'Focus Network WebGL initialization failed: WebGL is unavailable',
    });
  });

  it('owns exactly one imperative cleanup', () => {
    const destroy = vi.fn();
    const result = mountLocalRendererSession(() => ({ destroy }));
    if (!result.ok) throw new Error(result.message);

    result.dispose();
    result.dispose();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('restores the semantic anchor after processing and before drawing', async () => {
    const order: string[] = [];
    let afterProcess: (() => void) | undefined;
    let afterRender: (() => void) | undefined;
    const refreshed = refreshLocalRendererWithAnchor(
      {
        afterProcess: (callback) => {
          afterProcess = callback;
        },
        afterRender: (callback) => {
          afterRender = callback;
        },
        scheduleRefresh: () => {
          order.push('process');
          afterProcess?.();
          order.push('draw');
          afterRender?.();
        },
      },
      () => order.push('anchor'),
    );

    await refreshed;

    expect(order).toEqual(['process', 'anchor', 'draw']);
  });
});
