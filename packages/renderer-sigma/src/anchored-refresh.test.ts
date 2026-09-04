import { describe, expect, it } from 'vitest';

import { atomicAnchoredGraphMutation } from './anchored-refresh';

describe('atomic anchored Graphology mutation', () => {
  it('arms repair and completion before mutation, then repairs before draw', async () => {
    const order: string[] = [];
    let afterProcess: (() => void) | undefined;
    let afterRender: (() => void) | undefined;
    const transaction = atomicAnchoredGraphMutation(
      {
        onAfterProcess: (callback) => {
          order.push('arm-process');
          afterProcess = callback;
        },
        offAfterProcess: () => undefined,
        onAfterRender: (callback) => {
          order.push('arm-render');
          afterRender = callback;
        },
        offAfterRender: () => undefined,
      },
      () => order.push('restore-anchor'),
      () => {
        order.push('mutate');
        afterProcess?.();
        order.push('draw');
        afterRender?.();
        return 'result';
      },
    );

    await transaction.rendered;

    expect(transaction.result).toBe('result');
    expect(order).toEqual([
      'arm-process',
      'arm-render',
      'mutate',
      'restore-anchor',
      'draw',
    ]);
  });

  it('disarms callbacks when the mutation fails loudly', () => {
    const offProcess: (() => void)[] = [];
    const offRender: (() => void)[] = [];

    expect(() =>
      atomicAnchoredGraphMutation(
        {
          onAfterProcess: () => undefined,
          offAfterProcess: (callback) => offProcess.push(callback),
          onAfterRender: () => undefined,
          offAfterRender: (callback) => offRender.push(callback),
        },
        () => undefined,
        () => {
          throw new Error('mutation failed');
        },
      ),
    ).toThrow('mutation failed');
    expect(offProcess).toHaveLength(1);
    expect(offRender).toHaveLength(1);
  });
});
