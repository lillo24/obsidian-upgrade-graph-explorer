import { describe, expect, it, vi } from 'vitest';

import { mountLocalRendererSession } from './local-lifecycle';

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
});
