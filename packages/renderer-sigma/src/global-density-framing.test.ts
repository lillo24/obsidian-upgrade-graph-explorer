import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH,
  globalDensityFramingRatio,
} from './global-density-framing';

describe('All Network density framing interpolation', () => {
  it('keeps legacy at 0 and reaches the raw decision at 100', () => {
    expect(DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH).toBe(100);
    expect(globalDensityFramingRatio(1.4, 0)).toBe(1);
    expect(globalDensityFramingRatio(1.4, 50)).toBeCloseTo(1.2);
    expect(globalDensityFramingRatio(1.4, 100)).toBe(1.4);
    expect(globalDensityFramingRatio(0.7, 50)).toBeCloseTo(0.85);
  });

  it('rejects invalid runtime-only values', () => {
    expect(() => globalDensityFramingRatio(0, 100)).toThrow(/positive/);
    expect(() => globalDensityFramingRatio(1, -1)).toThrow(/0 to 100/);
    expect(() => globalDensityFramingRatio(1, 101)).toThrow(/0 to 100/);
  });
});
