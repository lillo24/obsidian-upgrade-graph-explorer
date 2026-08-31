import { describe, expect, it, vi } from 'vitest';

import { mountGlobalRendererSession } from './lifecycle';

describe('Global renderer lifecycle', () => {
  it('reports WebGL construction failure without a success-shaped session', () => {
    const result = mountGlobalRendererSession(() => {
      throw new Error('WebGL is unavailable');
    });

    expect(result).toEqual({
      ok: false,
      message:
        'Global WebGL renderer initialization failed: WebGL is unavailable',
    });
  });

  it('owns exactly one imperative cleanup even if React probes it twice', () => {
    const destroy = vi.fn();
    const result = mountGlobalRendererSession(() => ({ destroy }));
    if (!result.ok) throw new Error(result.message);

    result.lease.dispose();
    result.lease.dispose();

    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
