import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { isAbsolute, resolve } from 'node:path';

import {
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  canonicalScreenNodes,
  composeGlobalSpatialOverrides,
  computeGlobalLayout,
  computeGlobalSpatialInfluence,
  createGlobalLayoutRequest,
  nearestNeighborDistances,
  resolveGlobalDensityFit,
  withFolderClusteringStrength,
  type GlobalLayoutPosition,
  type GlobalLayoutSettings,
  type GlobalRendererInput,
  type GlobalSpatialInfluenceRequest,
} from '@icarus-graph-explorer/renderer-sigma/core';

interface FixtureSpec {
  readonly id: string;
  readonly description: string;
  readonly count: number;
  readonly edges: readonly (readonly [number, number])[];
  readonly settings?: GlobalLayoutSettings;
  readonly composition?: 'dynamic' | 'fixed' | 'dynamic-fixed';
  readonly skipLayout?: boolean;
}

function pairs(
  count: number,
  kind: 'chain' | 'star' | 'mixed' | 'components' | 'reference-heavy',
): readonly (readonly [number, number])[] {
  if (kind === 'star') {
    return Array.from({ length: count - 1 }, (_, index) => [0, index + 1]);
  }
  if (kind === 'components') {
    return Array.from({ length: Math.floor(count / 2) }, (_, index) => [
      index * 2,
      index * 2 + 1,
    ]);
  }
  if (kind === 'reference-heavy') {
    return Array.from({ length: count }, (_, source) =>
      [1, 2, 3].flatMap((offset) =>
        source + offset < count ? [[source, source + offset] as const] : [],
      ),
    ).flat();
  }
  const connected = kind === 'mixed' ? Math.ceil(count * 0.6) : count;
  return Array.from({ length: Math.max(0, connected - 1) }, (_, index) => [
    index,
    index + 1,
  ]);
}

function denseClusters(count: number, bridge: boolean) {
  const half = Math.floor(count / 2);
  const result: Array<readonly [number, number]> = [];
  for (const start of [0, half]) {
    const end = start === 0 ? half : count;
    for (let source = start; source < end; source += 1) {
      for (let offset = 1; offset <= 2; offset += 1) {
        if (source + offset < end) result.push([source, source + offset]);
      }
    }
  }
  if (bridge) result.push([half - 1, half]);
  return result;
}

function fixtures(): readonly FixtureSpec[] {
  const independent = [1, 2, 3, 5, 10, 20, 50].map((count) => ({
    id: `${count}-independent`,
    description: `${count} independent displayed nodes`,
    count,
    edges: [],
  }));
  return [
    ...independent,
    {
      id: '2-connected',
      description: 'two connected nodes',
      count: 2,
      edges: [[0, 1]],
    },
    {
      id: '3-chain',
      description: 'three-node chain',
      count: 3,
      edges: pairs(3, 'chain'),
    },
    {
      id: '5-star',
      description: 'five-node star',
      count: 5,
      edges: pairs(5, 'star'),
    },
    ...[10, 20, 50].map((count) => ({
      id: `${count}-mixed`,
      description: `${count}-node mixed connected and isolated scene`,
      count,
      edges: pairs(count, 'mixed'),
    })),
    {
      id: 'mixed-connected-isolates',
      description: 'connected core plus independent nodes',
      count: 24,
      edges: pairs(24, 'mixed'),
    },
    {
      id: 'many-components',
      description: 'many disconnected two-node components',
      count: 30,
      edges: pairs(30, 'components'),
    },
    {
      id: 'two-dense-clusters-no-bridge',
      description: 'two dense components without a bridge',
      count: 30,
      edges: denseClusters(30, false),
    },
    {
      id: 'two-dense-clusters-one-bridge',
      description: 'two dense components with one bridge',
      count: 30,
      edges: denseClusters(30, true),
    },
    {
      id: 'long-chain',
      description: 'fifty-node long chain',
      count: 50,
      edges: pairs(50, 'chain'),
    },
    {
      id: 'reference-heavy',
      description: 'fifty-node reference-heavy graph',
      count: 50,
      edges: pairs(50, 'reference-heavy'),
    },
    {
      id: 'folder-clustered',
      description: 'folder-clustered automatic layout',
      count: 36,
      edges: pairs(36, 'mixed'),
    },
    {
      id: 'folder-clustering-weak',
      description: 'same folder graph with weak clustering',
      count: 36,
      edges: pairs(36, 'mixed'),
      settings: withFolderClusteringStrength(
        DEFAULT_GLOBAL_LAYOUT_SETTINGS,
        25,
      ),
    },
    {
      id: 'folder-clustering-strong',
      description: 'same folder graph with strong clustering',
      count: 36,
      edges: pairs(36, 'mixed'),
      settings: withFolderClusteringStrength(
        DEFAULT_GLOBAL_LAYOUT_SETTINGS,
        100,
      ),
    },
    {
      id: 'dynamic-pull',
      description: 'confirmed schema-v2 dynamic Pull result',
      count: 36,
      edges: pairs(36, 'mixed'),
      composition: 'dynamic',
    },
    {
      id: 'fixed-placement',
      description: 'confirmed fixed folder placement composition',
      count: 36,
      edges: pairs(36, 'mixed'),
      composition: 'fixed',
    },
    {
      id: 'dynamic-pull-fixed-placement',
      description: 'confirmed dynamic Pull plus fixed placement composition',
      count: 36,
      edges: pairs(36, 'mixed'),
      composition: 'dynamic-fixed',
    },
    {
      id: 'query-reduced-sparse',
      description: 'query-reduced sparse displayed projection',
      count: 7,
      edges: [[0, 1]],
    },
    ...[100, 500, 1_000].map((count) => ({
      id: `stress-${count}`,
      description: `${count}-node deterministic displayed stress scene`,
      count,
      edges: pairs(count, 'mixed'),
      skipLayout: true,
    })),
  ];
}

function seedPositions(count: number): readonly GlobalLayoutPosition[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const radius = Math.sqrt(index + 1) * 13;
    const angle = goldenAngle * index;
    return {
      key: `node-${index}`,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}

function rendererInput(
  positions: readonly GlobalLayoutPosition[],
  edgePairs: readonly (readonly [number, number])[],
): GlobalRendererInput {
  return {
    nodes: positions.map((position, index) => ({
      key: position.key,
      attributes: {
        x: position.x,
        y: position.y,
        size: 6,
        color: '#607d8b',
        label: position.key,
        nodeKind: 'document',
        entityId: position.key,
        sourcePath: `${position.key}.md`,
        status: null,
        folderKey: `folder-${index % 3}`,
        revealableDescendantCount: 0,
      },
    })),
    edges: edgePairs.map(([source, target], index) => ({
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
    })),
    projectionIssues: [],
  };
}

function dynamicPositions(
  input: GlobalRendererInput,
  positions: readonly GlobalLayoutPosition[],
) {
  const byKey = new Map(positions.map((position) => [position.key, position]));
  const request: Omit<GlobalSpatialInfluenceRequest, 'requestId'> = {
    schemaVersion: 1,
    algorithm: 'interleaved-centroid',
    algorithmVersion: 1,
    baseLayoutFingerprint: 'network-spacing-synthetic-base',
    iterations: 12,
    nodes: input.nodes.map(({ key, attributes }) => ({
      key,
      x: byKey.get(key)!.x,
      y: byKey.get(key)!.y,
      size: attributes.size,
    })),
    edges: input.edges.map(({ key, source, target, attributes }) => ({
      key,
      source,
      target,
      weight: Math.max(1, attributes.referenceCount),
    })),
    attractors: [
      {
        ruleFolderKey: 'folder-0',
        memberNodeKeys: input.nodes
          .filter(({ attributes }) => attributes.folderKey === 'folder-0')
          .map(({ key }) => key),
        targetX: 120,
        targetY: -80,
        strength: 75,
      },
    ],
    globalLayoutSettings: DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  };
  return computeGlobalSpatialInfluence({ ...request, requestId: 1 }).positions;
}

function finalPositions(spec: FixtureSpec, input: GlobalRendererInput) {
  const automatic = spec.skipLayout
    ? input.nodes.map(({ key, attributes }) => ({
        key,
        x: attributes.x,
        y: attributes.y,
      }))
    : computeGlobalLayout({
        ...createGlobalLayoutRequest(
          input,
          spec.settings ?? DEFAULT_GLOBAL_LAYOUT_SETTINGS,
          spec.count <= 10 ? 100 : 60,
        ),
        requestId: 1,
      }).positions;
  const dynamic =
    spec.composition === 'dynamic' || spec.composition === 'dynamic-fixed'
      ? dynamicPositions(input, automatic)
      : automatic;
  return spec.composition === 'fixed' || spec.composition === 'dynamic-fixed'
    ? composeGlobalSpatialOverrides(
        dynamic,
        input,
        new Map([
          ['folder-0', { x: -0.65, y: 0.5 }],
          ['folder-1', { x: 0.55, y: -0.45 }],
        ]),
      ).displayedPositions
    : dynamic;
}

function geometryMetrics(
  input: GlobalRendererInput,
  positions: readonly GlobalLayoutPosition[],
  ratio: number,
) {
  const positionByKey = new Map(
    positions.map((position) => [position.key, position]),
  );
  const screen = canonicalScreenNodes(
    input.nodes.map(({ key, attributes }) => ({
      key,
      x: positionByKey.get(key)!.x,
      y: positionByKey.get(key)!.y,
      size: attributes.size,
    })),
  );
  if (screen === undefined)
    throw new Error('Invalid analysis screen geometry.');
  const nearest = nearestNeighborDistances(screen);
  const byKey = new Map(screen.map((node) => [node.key, node]));
  const connected = input.edges.map(({ source, target }) => {
    const left = byKey.get(source)!;
    const right = byKey.get(target)!;
    return Math.hypot(left.x - right.x, left.y - right.y);
  });
  const center = {
    x: percentile(
      screen.map(({ x }) => x),
      0.5,
    ),
    y: percentile(
      screen.map(({ y }) => y),
      0.5,
    ),
  };
  const radii = screen.map(({ x, y }) =>
    Math.hypot(x - center.x, y - center.y),
  );
  const xs = screen.map(({ x }) => x);
  const ys = screen.map(({ y }) => y);
  const inside = screen.filter(({ x, y }) => {
    const adjustedX = 600 + (x - 600) / ratio;
    const adjustedY = 400 + (y - 400) / ratio;
    return (
      adjustedX >= 24 &&
      adjustedX <= 1_176 &&
      adjustedY >= 24 &&
      adjustedY <= 776
    );
  }).length;
  return {
    graph: {
      medianNearestNeighbor: round(percentile(nearest, 0.5)),
      p10NearestNeighbor: round(percentile(nearest, 0.1)),
      p90NearestNeighbor: round(percentile(nearest, 0.9)),
      medianConnectedEdge:
        connected.length === 0 ? null : round(percentile(connected, 0.5)),
      p95RobustRadius: round(percentile(radii, 0.95)),
      boundingWidth: round(Math.max(...xs) - Math.min(...xs)),
      boundingHeight: round(Math.max(...ys) - Math.min(...ys)),
    },
    screenAtDecision: {
      medianNearestNeighborPx: round(percentile(nearest, 0.5) / ratio),
      medianConnectedEdgePx:
        connected.length === 0
          ? null
          : round(percentile(connected, 0.5) / ratio),
      p95RadiusPx: round(percentile(radii, 0.95) / ratio),
      occupancyWidthPx: round((Math.max(...xs) - Math.min(...xs)) / ratio),
      occupancyHeightPx: round((Math.max(...ys) - Math.min(...ys)) / ratio),
      usefulViewportFraction: round(inside / screen.length),
      smallerViewportPolicyRatio: ratio,
    },
  };
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function maximumScaleDelta(
  input: GlobalRendererInput,
  positions: readonly GlobalLayoutPosition[],
) {
  const nodes = (factor: number) =>
    canonicalScreenNodes(
      positions.map((position, index) => ({
        ...position,
        x: position.x * factor,
        y: position.y * factor,
        size: input.nodes[index]!.attributes.size,
      })),
    )!;
  const base = nodes(1);
  const half = new Map(nodes(0.5).map((node) => [node.key, node]));
  return round(
    Math.max(
      ...base.map((node) => {
        const other = half.get(node.key)!;
        return Math.hypot(node.x - other.x, node.y - other.y);
      }),
    ),
    8,
  );
}

function densityTiming(count: number) {
  const positions = seedPositions(count);
  const input = rendererInput(positions, pairs(count, 'mixed'));
  resolveGlobalDensityFit(input, positions);
  const valuesMs = Array.from({ length: 7 }, () => {
    const started = performance.now();
    resolveGlobalDensityFit(input, positions);
    return round(performance.now() - started, 3);
  });
  return {
    count,
    valuesMs,
    medianMs: percentile(valuesMs, 0.5),
    p95Ms: percentile(valuesMs, 0.95),
  };
}

function outputDirectory(args: readonly string[]) {
  const values = args[0] === '--' ? args.slice(1) : [...args];
  if (
    values.length !== 0 &&
    (values.length !== 2 || values[0] !== '--output-dir')
  ) {
    throw new Error(
      'Usage: pnpm analyze:network-spacing [-- --output-dir <path>]',
    );
  }
  const selected = values[1] ?? 'output/spacing1b-global';
  const caller = process.env.INIT_CWD ?? process.cwd();
  return isAbsolute(selected) ? selected : resolve(caller, selected);
}

function main(): void {
  const rows = fixtures().map((spec) => {
    const seeds = seedPositions(spec.count);
    const input = rendererInput(seeds, spec.edges);
    const positions = finalPositions(spec, input);
    const decision = resolveGlobalDensityFit(input, positions);
    return {
      id: spec.id,
      description: spec.description,
      geometryAuthority: spec.skipLayout
        ? 'deterministic confirmed-position stress proxy'
        : spec.composition === undefined
          ? 'production Global ForceAtlas2 result'
          : `production Global ForceAtlas2 plus ${spec.composition} composition`,
      topology: {
        nodes: decision.nodeCount,
        edges: decision.edgeCount,
        components: decision.componentCount,
        isolatedNodes: decision.isolatedNodeCount,
        largestComponent: decision.largestComponentSize,
      },
      decision,
      metrics:
        decision.fallback || spec.count < 2
          ? null
          : geometryMetrics(input, positions, decision.ratio),
    };
  });
  const scale = rows.find(({ id }) => id === '20-mixed');
  if (scale === undefined) throw new Error('Scale fixture is missing.');
  const scaleSpec = fixtures().find(({ id }) => id === scale.id)!;
  const scaleSeeds = seedPositions(scaleSpec.count);
  const scaleInput = rendererInput(scaleSeeds, scaleSpec.edges);
  const scalePositions = finalPositions(scaleSpec, scaleInput);
  const result = {
    schemaVersion: 1,
    evidence: 'deterministic-synthetic-only',
    installedPipeline: [
      'Global mapping',
      'automatic ForceAtlas2',
      'optional dynamic folder Pull',
      'optional fixed folder placement composition',
      'final displayed positions',
      'Sigma 3.0.3 autoRescale',
      'Global camera',
    ],
    scaleExperiment: {
      coordinateFactor: 0.5,
      maximumScreenDeltaPx: maximumScaleDelta(scaleInput, scalePositions),
      conclusion:
        'Global Sigma autoRescale cancels raw uniform coordinate scaling; camera framing is the useful correction layer.',
    },
    fixtures: rows,
    densityPerformance: [100, 500, 1_000, 5_000].map(densityTiming),
    operationOracle: {
      automaticLayoutRequestsPerStrengthChange: 0,
      dynamicPullRequestsPerStrengthChange: 0,
      spatialPersistenceWritesPerStrengthChange: 0,
    },
    decision: {
      layer: 'B-camera',
      bounds: [0.7, 1.4],
      primary:
        'median nearest-neighbor distance per representative node diameter',
      optional: 'median connected-edge distance when valid edges exist',
      guard: 'p95 robust radius plus 95% useful-viewport visibility floor',
    },
    privacy:
      'Synthetic aggregate-only evidence; no vault names, paths, content, queries, workspace IDs, or screenshots.',
  };
  const directory = outputDirectory(process.argv.slice(2));
  mkdirSync(directory, { recursive: true });
  const jsonPath = resolve(directory, 'network-spacing-analysis.json');
  writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify(
      {
        fixtures: rows.length,
        globalDecision: result.decision.layer,
        scaleMaximumDeltaPx: result.scaleExperiment.maximumScreenDeltaPx,
        zeroEdgeNonFallback: rows
          .filter(({ topology }) => topology.nodes >= 2 && topology.edges === 0)
          .every(({ decision }) => !decision.fallback),
        densityPerformance: result.densityPerformance,
        jsonPath,
      },
      null,
      2,
    )}\n`,
  );
}

try {
  main();
} catch (error: unknown) {
  console.error(
    `Network-spacing analysis failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
