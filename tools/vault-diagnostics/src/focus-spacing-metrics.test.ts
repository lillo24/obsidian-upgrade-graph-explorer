import {
  computeLocalLayout,
  createLocalLayoutRequest,
} from '@icarus-graph-explorer/renderer-sigma/core';
import { describe, expect, it } from 'vitest';

import { focusSpacingFixtures } from './focus-spacing-fixtures';
import {
  candidateRatios,
  maximumRelativeGeometryError,
  maximumScreenDelta,
  percentile,
  productionDensityRatio,
  sceneFromLayout,
  screenMetrics,
  SMALL_VIEWPORT,
  uniformlyScaleScene,
} from './focus-spacing-metrics';

function sampleScene() {
  const fixture = focusSpacingFixtures().find(({ id }) => id === 'five-star')!;
  const request = createLocalLayoutRequest(fixture.input);
  const result = computeLocalLayout(
    { ...request, requestId: 1 },
    { maxWallTimeMs: 60_000, now: () => 0 },
  );
  return sceneFromLayout(request, result.positions);
}

describe('focus spacing diagnostic metrics', () => {
  it('uses deterministic interpolated percentiles', () => {
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(percentile([10, 20], 0.1)).toBe(11);
    expect(percentile([], 0.5)).toBe(0);
  });

  it('covers the required sparse, mixed, disconnected, and dense fixture matrix', () => {
    const fixtures = focusSpacingFixtures();
    expect(fixtures.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'two-reference',
        'three-chain',
        'three-star',
        'five-chain',
        'five-star',
        'five-mixed-isolate',
        'eight-star',
        'ten-mixed',
        'twenty-mixed',
        'fifty-mixed',
        'two-dense-clusters-bridge',
        'long-chain',
        'root-weak-and-isolated',
        'hierarchy-heavy',
        'reference-heavy',
      ]),
    );
    expect(fixtures).toHaveLength(15);
  });

  it('proves Sigma auto-rescale cancels uniform coordinate scaling', () => {
    const scene = sampleScene();
    const halfScale = uniformlyScaleScene(scene, 0.5);
    expect(maximumScreenDelta(scene, halfScale, 1)).toBe(0);
    expect(maximumScreenDelta(scene, halfScale, 1.75)).toBe(0);
    expect(maximumScreenDelta(scene, halfScale, 0.82)).toBe(0);
    expect(maximumScreenDelta(scene, halfScale, 1, SMALL_VIEWPORT)).toBe(0);
    expect(screenMetrics(scene, 1).medianNodeRadiusPx).toBe(
      screenMetrics(halfScale, 1).medianNodeRadiusPx,
    );
  });

  it('changes density uniformly through camera ratio without geometry distortion', () => {
    const scene = sampleScene();
    const baseline = screenMetrics(scene, 1);
    const zoomedOut = screenMetrics(scene, 1.4);
    expect(zoomedOut.medianNearestNeighborPx).toBeLessThan(
      baseline.medianNearestNeighborPx,
    );
    expect(zoomedOut.medianNodeRadiusPx).toBeLessThan(
      baseline.medianNodeRadiusPx,
    );
    expect(maximumRelativeGeometryError(scene, 1.4)).toBeLessThan(0.000_001);
  });

  it('keeps every diagnostic candidate inside the selected bounds', () => {
    const scene = sampleScene();
    const ratios = candidateRatios(screenMetrics(scene, 1), scene.nodes.length);
    for (const ratio of Object.values(ratios)) {
      expect(ratio).toBeGreaterThanOrEqual(0.7);
      expect(ratio).toBeLessThanOrEqual(1.4);
      expect(maximumRelativeGeometryError(scene, ratio)).toBeLessThan(
        0.000_001,
      );
    }
  });

  it('keeps all 15 diagnostic fixtures in parity with the production B4 policy', () => {
    const ratios = focusSpacingFixtures().map((fixture, index) => {
      const request = createLocalLayoutRequest(fixture.input);
      const result = computeLocalLayout(
        { ...request, requestId: index + 1 },
        { now: () => 0 },
      );
      const scene = sceneFromLayout(request, result.positions);
      const diagnostic = candidateRatios(
        screenMetrics(scene, 1),
        scene.nodes.length,
      ).B4;
      const production = productionDensityRatio(scene);
      // Both contracts round the final B4 ratio to four decimals.
      expect(production).toBe(diagnostic);
      return production;
    });

    expect(ratios).toHaveLength(15);
    expect(ratios.every((ratio) => ratio >= 0.7 && ratio <= 1.4)).toBe(true);
  });
});
