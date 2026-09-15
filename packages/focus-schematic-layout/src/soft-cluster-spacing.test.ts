import { describe, expect, it } from 'vitest';

import {
  FOCUS_SCHEMATIC_SOFT_SPACING_COMPACT,
  FOCUS_SCHEMATIC_SOFT_SPACING_SELECTED,
  FOCUS_SCHEMATIC_SOFT_SPACING_SPACIOUS,
  resolveFocusSchematicSoftClusterSpacing,
} from './soft-cluster-spacing';

describe('Soft Cluster spacing policy', () => {
  it('resolves the three validated anchors exactly', () => {
    expect(resolveFocusSchematicSoftClusterSpacing(0)).toEqual(
      FOCUS_SCHEMATIC_SOFT_SPACING_COMPACT,
    );
    expect(resolveFocusSchematicSoftClusterSpacing(50)).toEqual(
      FOCUS_SCHEMATIC_SOFT_SPACING_SELECTED,
    );
    expect(resolveFocusSchematicSoftClusterSpacing(100)).toEqual(
      FOCUS_SCHEMATIC_SOFT_SPACING_SPACIOUS,
    );
  });

  it('interpolates deterministically, monotonically, and within both segments', () => {
    const values = [0, 1, 25, 49, 50, 51, 75, 99, 100];
    const policies = values.map((value) =>
      resolveFocusSchematicSoftClusterSpacing(value),
    );
    expect(
      values.map((value) => resolveFocusSchematicSoftClusterSpacing(value)),
    ).toEqual(policies);
    for (const key of Object.keys(
      policies[0]!,
    ) as (keyof (typeof policies)[0])[]) {
      const series = policies.map((policy) => policy[key]);
      expect(series).toEqual([...series].sort((a, b) => a - b));
      expect(series[0]).toBeGreaterThan(0);
      expect(series.at(-1)).toBeGreaterThanOrEqual(series[0]!);
    }
  });

  it('defaults malformed values and clamps finite out-of-range values', () => {
    expect(resolveFocusSchematicSoftClusterSpacing(Number.NaN)).toEqual(
      FOCUS_SCHEMATIC_SOFT_SPACING_SELECTED,
    );
    expect(resolveFocusSchematicSoftClusterSpacing(-1)).toEqual(
      FOCUS_SCHEMATIC_SOFT_SPACING_COMPACT,
    );
    expect(resolveFocusSchematicSoftClusterSpacing(101)).toEqual(
      FOCUS_SCHEMATIC_SOFT_SPACING_SPACIOUS,
    );
  });
});
