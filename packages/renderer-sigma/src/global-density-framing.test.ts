import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH,
  globalDensityFramingRatio,
} from './global-density-framing';

describe('All Network density framing interpolation', () => {
  it('keeps legacy at 0, reaches Auto at 100, and amplifies through 150', () => {
    expect(DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH).toBe(100);
    for (const raw of [0.7, 0.93, 1, 1.19, 1.4]) {
      for (const strength of [0, 50, 100, 125, 150]) {
        expect(globalDensityFramingRatio(raw, strength)).toBeCloseTo(
          1 + (raw - 1) * (strength / 100),
          12,
        );
      }
    }
  });

  it('rejects invalid runtime-only values', () => {
    expect(() => globalDensityFramingRatio(0, 100)).toThrow(/positive/);
    expect(() => globalDensityFramingRatio(1, -1)).toThrow(/0 to 150/);
    expect(() => globalDensityFramingRatio(1, 151)).toThrow(/0 to 150/);
    expect(() => globalDensityFramingRatio(1, Number.NaN)).toThrow(/0 to 150/);
    expect(() =>
      globalDensityFramingRatio(1, Number.POSITIVE_INFINITY),
    ).toThrow(/0 to 150/);
  });
});
