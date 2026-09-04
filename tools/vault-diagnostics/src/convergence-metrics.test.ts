import { describe, expect, it } from 'vitest';

import {
  createLocalConvergenceDegreeIndex,
  measureLocalConvergenceMovement,
} from '@icarus-graph-explorer/renderer-sigma/local-convergence';

import {
  measureDisplacement,
  measureLayoutQuality,
  percentile,
  rmsRadius,
} from './convergence-metrics';

const edges = [
  { source: 'root', target: 'leaf' },
  { source: 'leaf', target: 'branch' },
] as const;

describe('convergence displacement metrics', () => {
  it('uses deterministic interpolated percentiles and rejects invalid input', () => {
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(percentile([10, 20], 0.1)).toBe(11);
    expect(percentile([], 0.9)).toBe(0);
    expect(() => percentile([1], 1.1)).toThrow(/from 0 to 1/);
    expect(() => percentile([Number.NaN], 0.5)).toThrow(/finite/);
  });

  it('root-aligns Focus frames without hiding raw anchor translation', () => {
    const before = [
      { key: 'root', x: 0, y: 0 },
      { key: 'leaf', x: 2, y: 0 },
      { key: 'branch', x: 2, y: 2 },
      { key: 'isolate', x: -1, y: 1 },
    ];
    const after = before.map((position) => ({
      ...position,
      x: position.x + 4,
      y: position.y - 3,
    }));
    const measured = measureDisplacement({
      before,
      after,
      edges,
      alignment: { kind: 'root', rootKey: 'root' },
    });
    expect(measured.all.maximum).toBeCloseTo(0, 12);
    expect(measured.rawAnchorDrift).toBe(5);
    expect(measured.rawCentroidDrift).toBe(5);
    expect(measured.degree0.count).toBe(1);
    expect(measured.degree1.count).toBe(2);
    expect(measured.degree2Plus.count).toBe(1);
    expect(measured.lowDegree.count).toBe(3);
    expect(measured).toMatchObject(
      measureLocalConvergenceMovement({
        before,
        after,
        rootKey: 'root',
        degreeByKey: createLocalConvergenceDegreeIndex(
          before.map(({ key }) => key),
          edges,
        ),
      }),
    );
  });

  it('centroid-aligns Global shape movement and reports rigid drift separately', () => {
    const before = [
      { key: 'a', x: -1, y: 0 },
      { key: 'b', x: 1, y: 0 },
    ];
    const after = before.map((position) => ({
      ...position,
      x: position.x + 3,
      y: position.y + 4,
    }));
    const measured = measureDisplacement({
      before,
      after,
      edges: [{ source: 'a', target: 'b' }],
      alignment: { kind: 'centroid' },
    });
    expect(measured.all.p90).toBeCloseTo(0, 12);
    expect(measured.rawCentroidDrift).toBe(5);
    expect(measured.normalizedCentroidDrift).toBe(5);
    expect(measured.rawAnchorDrift).toBeNull();
  });

  it('normalizes displacement by the previous frame RMS radius', () => {
    const before = [
      { key: 'a', x: -1, y: 0 },
      { key: 'b', x: 1, y: 0 },
    ];
    const after = [
      { key: 'a', x: -0.9, y: 0 },
      { key: 'b', x: 0.9, y: 0 },
    ];
    const scaled = (positions: typeof before) =>
      positions.map((position) => ({
        ...position,
        x: position.x * 10,
        y: position.y * 10,
      }));
    const base = measureDisplacement({
      before,
      after,
      edges: [{ source: 'a', target: 'b' }],
      alignment: { kind: 'centroid' },
    });
    const larger = measureDisplacement({
      before: scaled(before),
      after: scaled(after),
      edges: [{ source: 'a', target: 'b' }],
      alignment: { kind: 'centroid' },
    });
    expect(base.all.p90).toBeCloseTo(larger.all.p90!, 12);
    expect(rmsRadius([{ key: 'a', x: 0, y: 0 }])).toBe(1e-6);
  });

  it('fails loudly for mismatched frames, invalid coordinates, and edges', () => {
    expect(() =>
      measureDisplacement({
        before: [{ key: 'a', x: 0, y: 0 }],
        after: [{ key: 'b', x: 0, y: 0 }],
        edges: [],
        alignment: { kind: 'centroid' },
      }),
    ).toThrow(/omitted node a/);
    expect(() =>
      measureDisplacement({
        before: [{ key: 'a', x: Number.NaN, y: 0 }],
        after: [{ key: 'a', x: 0, y: 0 }],
        edges: [],
        alignment: { kind: 'centroid' },
      }),
    ).toThrow(/finite/);
    expect(() =>
      measureDisplacement({
        before: [{ key: 'a', x: 0, y: 0 }],
        after: [{ key: 'a', x: 0, y: 0 }],
        edges: [{ source: 'a', target: 'missing' }],
        alignment: { kind: 'centroid' },
      }),
    ).toThrow(/missing endpoint/);
  });

  it('reports normalized edge lengths and gross coincident pairs', () => {
    const quality = measureLayoutQuality({
      positions: [
        { key: 'a', x: 0, y: 0 },
        { key: 'b', x: 0, y: 0 },
        { key: 'c', x: 2, y: 0 },
      ],
      edges: [{ source: 'b', target: 'c' }],
      alignment: { kind: 'centroid' },
    });
    expect(quality.nearCoincidentPairs).toBe(1);
    expect(quality.normalizedEdgeLength.count).toBe(1);
    expect(quality.nonFiniteCoordinates).toBe(0);
  });
});
