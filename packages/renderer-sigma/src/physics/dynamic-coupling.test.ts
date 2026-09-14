import { describe, expect, it } from 'vitest';

import type { NetworkPhysicsAttractor } from './protocol';
import { NetworkPhysicsDynamicCouplingIndex } from './dynamic-coupling';

function pull(
  ruleFolderKey: string,
  memberNodeKeys: readonly string[],
  strength = 70,
): NetworkPhysicsAttractor {
  return {
    ruleFolderKey,
    memberNodeKeys,
    targetX: 0,
    targetY: 0,
    strength,
  };
}

describe('NetworkPhysicsDynamicCouplingIndex', () => {
  it('classifies undirected reference components deterministically', () => {
    const index = new NetworkPhysicsDynamicCouplingIndex(
      ['isolate', 'c', 'b', 'a'],
      [
        { source: 'b', target: 'a' },
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    );

    expect(index.resolve('a', [])).toEqual({
      activeNodeKeys: ['a', 'b', 'c'],
      stabilizedNodeKeys: ['isolate'],
    });
    expect(index.resolve('isolate', [])).toEqual({
      activeNodeKeys: ['isolate'],
      stabilizedNodeKeys: ['a', 'b', 'c'],
    });
  });

  it('extends the active set through transitive effective Pull memberships', () => {
    const index = new NetworkPhysicsDynamicCouplingIndex(
      ['a', 'b', 'c', 'd', 'e', 'isolate'],
      [
        { source: 'a', target: 'b' },
        { source: 'c', target: 'd' },
      ],
    );

    expect(
      index.resolve('a', [
        pull('first', ['b', 'c']),
        pull('second', ['d', 'e']),
      ]),
    ).toEqual({
      activeNodeKeys: ['a', 'b', 'c', 'd', 'e'],
      stabilizedNodeKeys: ['isolate'],
    });
  });

  it('ignores zero-strength Pull membership and fails on unknown members', () => {
    const index = new NetworkPhysicsDynamicCouplingIndex(['a', 'b'], []);
    expect(index.resolve('a', [pull('off', ['a', 'b'], 0)])).toEqual({
      activeNodeKeys: ['a'],
      stabilizedNodeKeys: ['b'],
    });
    expect(() => index.resolve('a', [pull('invalid', ['missing'])])).toThrow(
      'omitted node missing',
    );
  });

  it('fails loudly when topology endpoints or constrained nodes are missing', () => {
    expect(
      () =>
        new NetworkPhysicsDynamicCouplingIndex(
          ['a'],
          [{ source: 'a', target: 'missing' }],
        ),
    ).toThrow('missing endpoint');
    const index = new NetworkPhysicsDynamicCouplingIndex(['a'], []);
    expect(() => index.resolve('missing', [])).toThrow(
      'omitted constrained node missing',
    );
  });
});
