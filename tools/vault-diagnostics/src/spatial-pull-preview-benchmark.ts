import { computeGlobalSpatialInfluence } from '@icarus-graph-explorer/renderer-sigma/spatial-influence';
import type {
  GlobalLayoutPosition,
  GlobalSpatialInfluenceRequest,
  GlobalSpatialInfluenceResult,
} from '@icarus-graph-explorer/renderer-sigma/types';

const ITERATION_CANDIDATES = [6, 12, 18, 30] as const;
const NODE_COUNTS = [100, 300, 1_000, 3_000] as const;
const SAMPLE_COUNT = 7;

function percentile(values: readonly number[], fraction: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * fraction) - 1]!;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function request(
  nodeCount: number,
  iterations: number,
): GlobalSpatialInfluenceRequest {
  const radius = Math.sqrt(nodeCount);
  const nodes = Array.from({ length: nodeCount }, (_value, index) => {
    const angle = (Math.PI * 2 * index) / nodeCount;
    const band = 0.7 + (index % 11) / 25;
    return {
      key: `node-${index}`,
      x: Math.cos(angle) * radius * band,
      y: Math.sin(angle) * radius * band,
      size: 4,
    };
  });
  const edges = nodes.flatMap((_node, index) => {
    const offsets = index % 3 === 0 ? [1, 7] : [1];
    return offsets.map((offset) => ({
      key: `edge-${index}-${offset}`,
      source: `node-${index}`,
      target: `node-${(index + offset) % nodeCount}`,
      weight: 1,
    }));
  });
  const memberCount = Math.max(8, Math.floor(nodeCount * 0.2));
  return {
    schemaVersion: 1,
    requestId: 1,
    algorithm: 'interleaved-centroid',
    algorithmVersion: 1,
    baseLayoutFingerprint: `synthetic-${nodeCount}`,
    iterations,
    nodes,
    edges,
    attractors: [
      {
        ruleFolderKey: 'preview-folder',
        memberNodeKeys: nodes.slice(0, memberCount).map(({ key }) => key),
        targetX: radius * 0.9,
        targetY: radius * -0.45,
        strength: 70,
      },
    ],
    globalLayoutSettings: {
      folderClustering: true,
      spacingPreset: 'normal',
    },
  };
}

function rmsGap(
  left: readonly GlobalLayoutPosition[],
  right: readonly GlobalLayoutPosition[],
): number {
  const rightByKey = new Map(right.map((position) => [position.key, position]));
  const squared = left.map((position) => {
    const target = rightByKey.get(position.key)!;
    return (position.x - target.x) ** 2 + (position.y - target.y) ** 2;
  });
  return Math.sqrt(
    squared.reduce((sum, value) => sum + value, 0) / squared.length,
  );
}

function centroidDisplacement(
  base: GlobalSpatialInfluenceRequest,
  result: GlobalSpatialInfluenceResult,
): { readonly x: number; readonly y: number } {
  const members = new Set(base.attractors[0]!.memberNodeKeys);
  const baseByKey = new Map(base.nodes.map((node) => [node.key, node]));
  const deltas = result.positions
    .filter(({ key }) => members.has(key))
    .map((position) => {
      const start = baseByKey.get(position.key)!;
      return { x: position.x - start.x, y: position.y - start.y };
    });
  return {
    x: deltas.reduce((sum, delta) => sum + delta.x, 0) / deltas.length,
    y: deltas.reduce((sum, delta) => sum + delta.y, 0) / deltas.length,
  };
}

function directionAgreement(
  base: GlobalSpatialInfluenceRequest,
  candidate: GlobalSpatialInfluenceResult,
  final: GlobalSpatialInfluenceResult,
): number {
  const left = centroidDisplacement(base, candidate);
  const right = centroidDisplacement(base, final);
  const denominator = Math.hypot(left.x, left.y) * Math.hypot(right.x, right.y);
  return denominator === 0
    ? 1
    : (left.x * right.x + left.y * right.y) / denominator;
}

const profiles = NODE_COUNTS.map((nodeCount) => {
  const fullRequest = request(nodeCount, 30);
  const final = computeGlobalSpatialInfluence(fullRequest);
  const basePositions = fullRequest.nodes.map(({ key, x, y }) => ({
    key,
    x,
    y,
  }));
  const baseToFinal = rmsGap(basePositions, final.positions);
  const candidates = ITERATION_CANDIDATES.map((iterations) => {
    const candidateRequest = request(nodeCount, iterations);
    computeGlobalSpatialInfluence(candidateRequest);
    const samples: number[] = [];
    let latest = final;
    for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
      const started = performance.now();
      latest = computeGlobalSpatialInfluence(candidateRequest);
      samples.push(performance.now() - started);
    }
    return {
      iterations,
      computeP50Ms: round(percentile(samples, 0.5)),
      computeP95Ms: round(percentile(samples, 0.95)),
      directionAgreement: round(
        directionAgreement(candidateRequest, latest, final),
      ),
      relativeGapToFinal: round(
        baseToFinal === 0
          ? 0
          : rmsGap(latest.positions, final.positions) / baseToFinal,
      ),
      connectedNonmemberMeanDisplacement: round(
        latest.metrics.meanUnaffectedDisplacement,
      ),
    };
  });
  return { nodeCount, edgeCount: fullRequest.edges.length, candidates };
});

process.stdout.write(
  `${JSON.stringify(
    {
      schemaVersion: 1,
      algorithm: 'interleaved-centroid',
      sampleCount: SAMPLE_COUNT,
      note: 'Pure Node compute evidence; browser worker startup, round trip, and Sigma adoption are excluded.',
      profiles,
    },
    null,
    2,
  )}\n`,
);
