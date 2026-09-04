import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH,
  localDensityFramingRatio,
} from './local-density-framing';

describe('Focus density-framing strength', () => {
  it.each([
    [0.8, 0, 1],
    [0.8, 50, 0.9],
    [0.8, 100, 0.8],
    [1.4, 0, 1],
    [1.4, 50, 1.2],
    [1.4, 100, 1.4],
  ] as const)(
    'interpolates decision %s at %s%% to %s',
    (decision, strength, expected) => {
      expect(localDensityFramingRatio(decision, strength)).toBeCloseTo(
        expected,
        12,
      );
    },
  );

  it('defaults the QA control to the complete production decision', () => {
    expect(DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH).toBe(100);
  });

  it.each([
    [0, 100],
    [Number.NaN, 100],
    [1, -1],
    [1, 101],
    [1, Number.POSITIVE_INFINITY],
  ])('rejects invalid ratio/strength pair %s, %s', (ratio, strength) => {
    expect(() => localDensityFramingRatio(ratio, strength)).toThrow();
  });
});
