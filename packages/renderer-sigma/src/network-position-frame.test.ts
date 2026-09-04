import { describe, expect, it } from 'vitest';

import { networkPositionExtent } from './network-position-frame';

describe('Network presented position frame', () => {
  it('captures the exact finite raw extent', () => {
    expect(
      networkPositionExtent([
        { x: 7, y: -3 },
        { x: -4, y: 9 },
        { x: 2, y: 1 },
      ]),
    ).toEqual({ x: [-4, 7], y: [-3, 9] });
  });

  it('rejects empty and invalid frames loudly', () => {
    expect(() => networkPositionExtent([])).toThrow(
      'requires at least one node',
    );
    expect(() => networkPositionExtent([{ x: Number.NaN, y: 0 }])).toThrow(
      'requires finite coordinates',
    );
  });
});
