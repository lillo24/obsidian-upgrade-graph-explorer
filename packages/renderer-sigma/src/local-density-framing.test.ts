import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH,
  localDensityFramingRatio,
} from './local-density-framing';

describe('Focus density-framing strength', () => {
  it('interpolates Legacy, Auto, and stronger Sandbox values exactly', () => {
    for (const raw of [0.7, 0.93, 1, 1.19, 1.4]) {
      for (const strength of [0, 50, 100, 125, 150]) {
        expect(localDensityFramingRatio(raw, strength)).toBeCloseTo(
          1 + (raw - 1) * (strength / 100),
          12,
        );
      }
    }
  });

  it('defaults the QA control to the complete production decision', () => {
    expect(DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH).toBe(100);
  });

  it.each([
    [0, 100],
    [Number.NaN, 100],
    [1, -1],
    [1, 151],
    [1, Number.POSITIVE_INFINITY],
  ])('rejects invalid ratio/strength pair %s, %s', (ratio, strength) => {
    expect(() => localDensityFramingRatio(ratio, strength)).toThrow();
  });
});
