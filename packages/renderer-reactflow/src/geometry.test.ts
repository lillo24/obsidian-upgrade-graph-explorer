import { describe, expect, it } from 'vitest';
import { computeDagreLayout } from '@icarus-graph-explorer/dagre-layout/compute';
import {
  findRectangleOverlaps,
  HIERARCHY_NODE_CLEARANCE,
  nodeRectangle,
  RectangleOccupancy,
} from './geometry';
import {
  applyRendererLayoutPositions,
  createRendererLayoutInput,
  fallbackRendererGraph,
} from './layout';
import { seedLocalStructuredGraph } from './local-structured-layout';
import { mapProjectionToReactFlow } from './mapping';
import { rendererTestProjection } from './test-fixture';
import type { GraphFlowNode } from './types';

// Independent exhaustive oracle, used only in tests.
function exhaustive(
  nodes: readonly GraphFlowNode[],
  clearance = HIERARCHY_NODE_CLEARANCE,
) {
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      expect(
        a.position.x + a.width! + clearance <= b.position.x ||
          b.position.x + b.width! + clearance <= a.position.x ||
          a.position.y + a.height! + clearance <= b.position.y ||
          b.position.y + b.height! + clearance <= a.position.y,
      ).toBe(true);
    }
}

describe('Hierarchy rectangle contract', () => {
  const a = { id: 'a', x: 0, y: 0, width: 10, height: 10 };
  const b = { ...a, id: 'b', x: 10 };
  it('distinguishes touching boundaries, positive area, and clearance deterministically', () => {
    expect(findRectangleOverlaps([a, b])).toEqual([]);
    expect(findRectangleOverlaps([a, b], 1)).toEqual([['a', 'b']]);
    expect(findRectangleOverlaps([b, a], 1)).toEqual([['a', 'b']]);
    expect(findRectangleOverlaps([a, { ...b, x: 9 }])).toEqual([['a', 'b']]);
    expect(findRectangleOverlaps([a, { ...b, y: 10 }])).toEqual([]);
  });
  it.each([NaN, Infinity, -Infinity])(
    'rejects nonfinite coordinates and dimensions (%s) without labels',
    (value) => {
      for (const key of ['x', 'y', 'width', 'height']) {
        expect(() =>
          findRectangleOverlaps([{ ...a, id: 'private-label', [key]: value }]),
        ).toThrow(/finite/);
      }
    },
  );
  it('rejects invalid clearance and sizes', () => {
    for (const value of [-1, NaN, Infinity])
      expect(() => findRectangleOverlaps([a], value)).toThrow(/clearance/);
    for (const value of [0, -1])
      expect(() => findRectangleOverlaps([{ ...a, width: value }])).toThrow(
        /positive/,
      );
  });
  it('finds collisions across negative and neighboring spatial buckets', () => {
    const index = new RectangleOccupancy();
    index.add({ ...a, x: -5, y: -5 });
    index.add({ ...b, x: 255 });
    expect(index.collisions({ ...a, x: 250 }, 0).map((r) => r.id)).toEqual([
      'b',
    ]);
    expect(index.collisions(a, 0).map((r) => r.id)).toEqual(['a']);
  });
});

describe('Hierarchy collision baseline', () => {
  it('packs mixed heights and wide adjacent columns while normalizing the root', () => {
    const mapped = mapProjectionToReactFlow(
      rendererTestProjection(),
      'local-structured',
    );
    const root = mapped.nodes.find((n) => n.type === 'entity')!;
    const nodes = [
      root,
      ...[80, 72, 64, 94, 80, 94].map((height, index) => ({
        ...root,
        id: `mixed-${index}`,
        height,
        width: index === 3 ? 340 : 200,
      })),
    ];
    const edges = nodes.slice(1).map((node, index) => ({
      ...mapped.edges[0]!,
      id: `edge-${index}`,
      source: index === 5 ? 'mixed-3' : root.id,
      target: node.id,
    }));
    const seed = seedLocalStructuredGraph(nodes, edges, root.id);
    exhaustive(seed.nodes);
    expect(
      findRectangleOverlaps(
        seed.nodes.map(nodeRectangle),
        HIERARCHY_NODE_CLEARANCE,
      ),
    ).toEqual([]);
    expect(seed.nodes[0]!.position).toEqual({ x: 0, y: 0 });
    expect(seedLocalStructuredGraph(nodes, edges, root.id)).toEqual(seed);
    // The former 64px lanes intersect mixed-height cards.
    const old = nodes
      .slice(1)
      .map((node, i) => ({ ...node, position: { x: 210, y: i * 64 } }));
    expect(
      findRectangleOverlaps(old.map(nodeRectangle)).length,
    ).toBeGreaterThan(0);
  });
  it.each(['structure', 'local-structured'] as const)(
    'reserves entities and many/missing-source diagnostics in %s',
    (mode) => {
      const mapped = mapProjectionToReactFlow(rendererTestProjection(), mode);
      const entity = mapped.nodes.find((n) => n.type === 'entity')!;
      const diagnostic = mapped.nodes.find((n) => n.type === 'diagnostic')!;
      const nodes = [
        entity,
        ...Array.from({ length: 12 }, (_, i) => ({
          ...entity,
          id: `source-${i}`,
        })),
        ...Array.from({ length: 240 }, (_, i) => ({
          ...diagnostic,
          id: `diagnostic-${i}`,
          height: 64 + (i % 4) * 10,
          width: 148 + (i % 3) * 30,
        })),
      ];
      const edges = nodes
        .filter((n) => n.type === 'diagnostic')
        .slice(0, 220)
        .map((node, i) => ({
          ...mapped.edges[1]!,
          id: `edge-${i}`,
          source: i < 160 ? entity.id : `source-${i % 12}`,
          target: node.id,
        }));
      const input = createRendererLayoutInput(nodes, edges, mode);
      const output = computeDagreLayout(input);
      const final = applyRendererLayoutPositions(nodes, edges, mode, output);
      exhaustive(final.nodes);
      expect(final.nodes).toHaveLength(nodes.length);
      expect(
        findRectangleOverlaps(
          final.nodes.filter((n) => n.type === 'entity').map(nodeRectangle),
        ),
      ).toEqual([]);
      expect(
        applyRendererLayoutPositions(nodes, [...edges].reverse(), mode, output)
          .nodes,
      ).toEqual(final.nodes);
    },
  );
  it.each(['extended', 'compact-schematic'] as const)(
    'keeps the existing 280 × 170 fallback safe for %s fixed dimensions',
    (visualVariant) => {
      const mapped = mapProjectionToReactFlow(
        rendererTestProjection(),
        'structure',
        { visualVariant },
      );
      const nodes = Array.from({ length: 32 }, (_, i) => ({
        ...mapped.nodes[i % 3]!,
        id: `node-${i}`,
      }));
      const fallback = fallbackRendererGraph(
        nodes,
        [],
        'structure',
        'simulated failure',
      );
      exhaustive(fallback.nodes);
      expect(fallback.layoutWarning).toContain('simulated failure');
    },
  );
});
