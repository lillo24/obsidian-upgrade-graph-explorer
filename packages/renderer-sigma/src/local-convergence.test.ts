import { describe, expect, it } from 'vitest';

import {
  convergencePercentile,
  convergenceRmsRadius,
  createLocalConvergenceDegreeIndex,
  LOCAL_CONVERGENCE_ALL_P90_THRESHOLD,
  LOCAL_CONVERGENCE_LOW_DEGREE_MAXIMUM_THRESHOLD,
  localConvergenceBatchIsStable,
  localConvergenceBatchPlan,
  localConvergenceMaxIterations,
  measureLocalConvergenceMovement,
  nextLocalConvergenceStableBatchCount,
} from './local-convergence';
import type {
  LocalConvergenceDistribution,
  LocalConvergenceMovement,
  LocalLayoutPosition,
} from './local-types';

function distribution(
  count: number,
  value: number | null,
): LocalConvergenceDistribution {
  return { count, p50: value, p90: value, maximum: value };
}

function movement(input?: {
  readonly allP90?: number;
  readonly lowDegreeCount?: number;
  readonly lowDegreeMaximum?: number;
}): LocalConvergenceMovement {
  const allP90 = input?.allP90 ?? LOCAL_CONVERGENCE_ALL_P90_THRESHOLD;
  const lowDegreeCount = input?.lowDegreeCount ?? 1;
  const lowDegreeMaximum =
    input?.lowDegreeMaximum ?? LOCAL_CONVERGENCE_LOW_DEGREE_MAXIMUM_THRESHOLD;
  return {
    scale: 1,
    all: { count: 2, p50: 0, p90: allP90, maximum: allP90 },
    degree0: distribution(0, null),
    degree1: distribution(
      lowDegreeCount,
      lowDegreeCount === 0 ? null : lowDegreeMaximum,
    ),
    degree2Plus: distribution(2 - lowDegreeCount, 0),
    lowDegree: distribution(
      lowDegreeCount,
      lowDegreeCount === 0 ? null : lowDegreeMaximum,
    ),
  };
}

describe('Local convergence metrics and policy', () => {
  it('uses interpolated percentiles and the root RMS floor', () => {
    expect(convergencePercentile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(convergencePercentile([10, 20], 0.1)).toBe(11);
    expect(convergencePercentile([], 0.9)).toBe(0);
    expect(() => convergencePercentile([1], 1.1)).toThrow(/from 0 to 1/);
    expect(() => convergencePercentile([Number.NaN], 0.5)).toThrow(/finite/);
    expect(
      convergenceRmsRadius([{ key: 'root', x: 0, y: 0 }], { x: 0, y: 0 }),
    ).toBe(1e-6);
  });

  it('removes root translation but leaves rotation and scale visible', () => {
    const before = [
      { key: 'root', x: 0, y: 0 },
      { key: 'leaf', x: 2, y: 0 },
    ];
    const degreeByKey = new Map([
      ['root', 1],
      ['leaf', 1],
    ]);
    const translated = measureLocalConvergenceMovement({
      before,
      after: before.map((position) => ({
        ...position,
        x: position.x + 4,
        y: position.y - 3,
      })),
      rootKey: 'root',
      degreeByKey,
    });
    const rotated = measureLocalConvergenceMovement({
      before,
      after: [
        { key: 'root', x: 0, y: 0 },
        { key: 'leaf', x: 0, y: 2 },
      ],
      rootKey: 'root',
      degreeByKey,
    });
    const scaled = measureLocalConvergenceMovement({
      before,
      after: [
        { key: 'root', x: 0, y: 0 },
        { key: 'leaf', x: 4, y: 0 },
      ],
      rootKey: 'root',
      degreeByKey,
    });
    expect(translated.all.maximum).toBeCloseTo(0, 12);
    expect(rotated.all.maximum).toBeGreaterThan(0);
    expect(scaled.all.maximum).toBeGreaterThan(0);
  });

  it('rejects mismatched, duplicate, and non-finite frames', () => {
    const base: readonly LocalLayoutPosition[] = [{ key: 'root', x: 0, y: 0 }];
    const degreeByKey = new Map([['root', 0]]);
    expect(() =>
      measureLocalConvergenceMovement({
        before: base,
        after: [{ key: 'other', x: 0, y: 0 }],
        rootKey: 'root',
        degreeByKey,
      }),
    ).toThrow(/omitted node root/);
    expect(() =>
      measureLocalConvergenceMovement({
        before: [...base, ...base],
        after: base,
        rootKey: 'root',
        degreeByKey,
      }),
    ).toThrow(/duplicate/);
    expect(() =>
      measureLocalConvergenceMovement({
        before: base,
        after: [{ key: 'root', x: Number.NaN, y: 0 }],
        rootKey: 'root',
        degreeByKey,
      }),
    ).toThrow(/finite/);
  });

  it('counts undirected unique neighbors and reports every degree class', () => {
    const keys = ['root', 'leaf', 'branch', 'isolate'];
    const degreeByKey = createLocalConvergenceDegreeIndex(keys, [
      { source: 'root', target: 'leaf' },
      { source: 'leaf', target: 'root' },
      { source: 'root', target: 'leaf' },
      { source: 'leaf', target: 'branch' },
    ]);
    expect(Object.fromEntries(degreeByKey)).toEqual({
      root: 1,
      leaf: 2,
      branch: 1,
      isolate: 0,
    });
    const before = keys.map((key, index) => ({ key, x: index, y: 0 }));
    const measured = measureLocalConvergenceMovement({
      before,
      after: before.map((position, index) => ({
        ...position,
        y: index * 0.01,
      })),
      rootKey: 'root',
      degreeByKey,
    });
    expect(measured.degree0.count).toBe(1);
    expect(measured.degree1.count).toBe(2);
    expect(measured.degree2Plus.count).toBe(1);
    expect(measured.lowDegree.count).toBe(3);
  });

  it('accepts threshold equality and bypasses an empty low-degree guard', () => {
    expect(localConvergenceBatchIsStable(movement())).toBe(true);
    expect(
      localConvergenceBatchIsStable(
        movement({ lowDegreeCount: 0, lowDegreeMaximum: 99 }),
      ),
    ).toBe(true);
    expect(
      localConvergenceBatchIsStable(
        movement({
          lowDegreeMaximum:
            LOCAL_CONVERGENCE_LOW_DEGREE_MAXIMUM_THRESHOLD + 0.000001,
        }),
      ),
    ).toBe(false);
  });

  it('requires three consecutive full stable batches and resets on instability', () => {
    let stableBatches = 0;
    for (let index = 0; index < 2; index += 1) {
      stableBatches = nextLocalConvergenceStableBatchCount({
        previousStableBatches: stableBatches,
        batchIterations: 32,
        movement: movement(),
      });
    }
    expect(stableBatches).toBe(2);
    stableBatches = nextLocalConvergenceStableBatchCount({
      previousStableBatches: stableBatches,
      batchIterations: 32,
      movement: movement({
        allP90: LOCAL_CONVERGENCE_ALL_P90_THRESHOLD + 0.000001,
      }),
    });
    expect(stableBatches).toBe(0);
    stableBatches = nextLocalConvergenceStableBatchCount({
      previousStableBatches: 2,
      batchIterations: 8,
      movement: movement(),
    });
    expect(stableBatches).toBe(2);
  });

  it('selects size-class caps and deterministic final partial batches', () => {
    expect([100, 101, 500, 501].map(localConvergenceMaxIterations)).toEqual([
      1_000, 600, 600, 240,
    ]);
    expect(localConvergenceBatchPlan(100).at(-1)).toBe(8);
    expect(localConvergenceBatchPlan(101).at(-1)).toBe(24);
    expect(localConvergenceBatchPlan(501).at(-1)).toBe(16);
    expect(localConvergenceBatchPlan(100).reduce((a, b) => a + b, 0)).toBe(
      1_000,
    );
  });
});
