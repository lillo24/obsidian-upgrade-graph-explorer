import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FOCUS_SCHEMATIC_SOFT_SPACING,
  focusSchematicSoftRadialSpreadScale,
  normalizeFocusSchematicSoftSpacing,
} from './soft-cluster-spacing';

describe('Soft radial spread policy', () => {
  it('uses the bounded smooth 1x through 2.4x mapping', () => {
    expect(focusSchematicSoftRadialSpreadScale(0)).toBe(1);
    expect(focusSchematicSoftRadialSpreadScale(50)).toBeCloseTo(1.7, 12);
    expect(focusSchematicSoftRadialSpreadScale(100)).toBeCloseTo(2.4, 12);
    expect(focusSchematicSoftRadialSpreadScale(71)).toBeLessThan(
      focusSchematicSoftRadialSpreadScale(72),
    );
    expect(focusSchematicSoftRadialSpreadScale(72)).toBeLessThan(
      focusSchematicSoftRadialSpreadScale(73),
    );
  });

  it('clamps finite values and restores malformed values to the persisted default', () => {
    expect(normalizeFocusSchematicSoftSpacing(-1)).toBe(0);
    expect(normalizeFocusSchematicSoftSpacing(101)).toBe(100);
    expect(normalizeFocusSchematicSoftSpacing(Number.NaN)).toBe(
      DEFAULT_FOCUS_SCHEMATIC_SOFT_SPACING,
    );
    expect(normalizeFocusSchematicSoftSpacing('50')).toBe(
      DEFAULT_FOCUS_SCHEMATIC_SOFT_SPACING,
    );
  });
});
