import { describe, expect, it } from 'vitest';

import { buildInternalLayoutBenchmarkReport } from './internal-layout-benchmark';

describe('HIER4A-FIX2 internal layout benchmark', () => {
  it('reports transparent bounded M0/V1/C1 evidence without auto-selecting', () => {
    const report = buildInternalLayoutBenchmarkReport();
    expect(report.decision).toBe('INTERNAL_LAYOUT_REQUIRES_GRAPHICAL_REVIEW');
    expect(report.aggregate.allHardGatesPass).toBe(true);
    expect(report.aggregate.allDeterministic).toBe(true);
    expect(report.aggregate.rowCount).toBe(45);
    expect(report.aggregate.byVariant).toHaveProperty('current');
    expect(report.aggregate.byVariant).toHaveProperty('vertical-spine');
    expect(report.aggregate.byVariant).toHaveProperty('adaptive-compass');

    const find = (fixtureId: string, variant: string) => {
      const row = report.rows.find(
        (item) => item.fixtureId === fixtureId && item.variant === variant,
      );
      if (row === undefined)
        throw new Error(`Missing benchmark row ${fixtureId}/${variant}.`);
      return row;
    };

    expect(find('DB12', 'current').rootBandTopologyOverride).toBe(
      'crossing-guard',
    );
    expect(find('DB12', 'vertical-spine').rootBandTopologyOverride).toBeNull();
    for (const variant of ['vertical-spine', 'adaptive-compass'])
      expect(find('DB19', variant).rootBandTopologyOverride).toBe(
        'crossing-guard',
      );

    expect(
      find('CP5', 'adaptive-compass').primaryReferenceManhattanSpan.total,
    ).toBeLessThan(
      find('CP5', 'vertical-spine').primaryReferenceManhattanSpan.total,
    );
    expect(find('CP4', 'adaptive-compass').rootModule.width).toBeGreaterThan(
      find('CP4', 'vertical-spine').rootModule.width,
    );
    const many = find('CP3', 'adaptive-compass');
    expect(many.search.completeCompassAssignmentsEvaluated).toBeLessThanOrEqual(
      many.search.compassAssignmentCap * many.search.jointFolderRoundLimit,
    );
  }, 30_000);
});
