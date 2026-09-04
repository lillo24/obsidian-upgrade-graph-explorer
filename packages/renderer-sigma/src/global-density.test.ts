import { describe, expect, it } from 'vitest';

import { createGlobalLayoutRequest, globalLayoutFingerprint } from './layout';
import {
  GLOBAL_DENSITY_RATIO_BOUNDS,
  resolveGlobalDensityFit,
} from './global-density';
import type {
  GlobalInputEdge,
  GlobalLayoutPosition,
  GlobalRendererInput,
} from './types';

function input(
  positions: readonly GlobalLayoutPosition[],
  pairs: readonly (readonly [number, number])[] = [],
): GlobalRendererInput {
  const nodes = positions.map((position) => ({
    key: position.key,
    attributes: {
      x: position.x,
      y: position.y,
      size: 6,
      color: '#607d8b',
      label: position.key,
      nodeKind: 'document' as const,
      entityId: position.key,
      sourcePath: `${position.key}.md`,
      status: null,
      folderKey: null,
      revealableDescendantCount: 0,
    },
  }));
  const edges: GlobalInputEdge[] = pairs.map(([source, target], index) => ({
    key: `edge-${index}`,
    source: positions[source]!.key,
    target: positions[target]!.key,
    attributes: {
      size: 1,
      color: '#91aab2',
      edgeKind: 'reference',
      status: 'resolved',
      referenceCount: 1,
    },
  }));
  return { nodes, edges, projectionIssues: [] };
}

function ring(count: number, radius = 100): readonly GlobalLayoutPosition[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return {
      key: `node-${index}`,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}

describe('All Network density policy', () => {
  it('accepts zero-edge independent graphs as first-class density input', () => {
    for (const count of [2, 3, 5, 10, 20, 50]) {
      const positions = ring(count);
      const decision = resolveGlobalDensityFit(input(positions), positions);

      expect(decision.fallback).toBe(false);
      expect(decision.edgeCount).toBe(0);
      expect(decision.componentCount).toBe(count);
      expect(decision.isolatedNodeCount).toBe(count);
      expect(decision.ratio).toBeGreaterThanOrEqual(
        GLOBAL_DENSITY_RATIO_BOUNDS.minimum,
      );
      expect(decision.ratio).toBeLessThanOrEqual(
        GLOBAL_DENSITY_RATIO_BOUNDS.maximum,
      );
    }
  });

  it('fails loudly only for geometry without usable spacing', () => {
    const empty = resolveGlobalDensityFit(input([]), []);
    expect(empty).toMatchObject({ fallback: true, ratio: 1, nodeCount: 0 });
    expect(empty.fallbackReason).toContain('at least one');

    const singleton = [{ key: 'only', x: 0, y: 0 }];
    expect(resolveGlobalDensityFit(input(singleton), singleton)).toMatchObject({
      fallback: true,
      ratio: 1,
      nodeCount: 1,
    });

    const duplicate = [
      { key: 'left', x: 0, y: 0 },
      { key: 'right', x: 0, y: 0 },
    ];
    expect(resolveGlobalDensityFit(input(duplicate), duplicate)).toMatchObject({
      fallback: true,
      ratio: 1,
    });
  });

  it('frames sparse distributed nodes more strongly than a dense cluster', () => {
    const sparse = ring(20);
    const dense = [
      ...Array.from({ length: 19 }, (_, index) => ({
        key: `node-${index}`,
        x: (index % 5) * 0.1,
        y: Math.floor(index / 5) * 0.1,
      })),
      { key: 'node-19', x: 100, y: 100 },
    ];
    const sparseDecision = resolveGlobalDensityFit(input(sparse), sparse);
    const denseDecision = resolveGlobalDensityFit(input(dense), dense);

    expect(sparseDecision.fallback).toBe(false);
    expect(denseDecision.fallback).toBe(false);
    expect(sparseDecision.ratio).toBeGreaterThan(denseDecision.ratio);
    expect(denseDecision.ratio).toBeGreaterThanOrEqual(0.7);
    expect(denseDecision.ratio).toBeLessThanOrEqual(1.1);
  });

  it('is deterministic and invariant to raw uniform coordinate scaling', () => {
    const positions = ring(50);
    const connected = positions.map(
      (_position, index) => [index, (index + 1) % positions.length] as const,
    );
    const graph = input(positions, connected);
    const first = resolveGlobalDensityFit(graph, positions);
    const repeated = resolveGlobalDensityFit(graph, positions);
    const scaled = positions.map((position) => ({
      ...position,
      x: position.x * 0.5,
      y: position.y * 0.5,
    }));

    expect(repeated).toEqual(first);
    expect(resolveGlobalDensityFit(graph, scaled).ratio).toBe(first.ratio);
  });

  it('does not alter ForceAtlas2 requests or layout fingerprints', () => {
    const positions = ring(10);
    const graph = input(positions, [
      [0, 1],
      [1, 2],
    ]);
    const request = createGlobalLayoutRequest(
      graph,
      { folderClustering: true, spacingPreset: 'normal' },
      100,
    );
    const before = globalLayoutFingerprint(request);

    resolveGlobalDensityFit(graph, positions);

    expect(globalLayoutFingerprint(request)).toBe(before);
    expect(request.nodes.map(({ x, y }) => ({ x, y }))).toEqual(
      positions.map(({ x, y }) => ({ x, y })),
    );
  });
});
