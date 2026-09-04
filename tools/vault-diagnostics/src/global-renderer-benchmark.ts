import { readdir, stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSyntheticWorkspace } from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  createGlobalFixtureProjection,
  type GlobalFixtureProfile,
} from '@icarus-graph-explorer/global-renderer-spike/core';
import {
  buildGlobalGraph,
  composeGlobalSpatialOverrides,
  computeGlobalSpatialInfluence,
  computeGlobalLayout,
  createGlobalLayoutRequest,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  GlobalLayoutCache,
  GlobalSpatialInfluenceCache,
  globalLayoutPositionsFromInput,
  globalLayoutFingerprint,
  globalSpatialInfluenceFingerprint,
  mapProjectionToGlobal,
  reconcileGlobalGraph,
  type GlobalRendererInput,
  type GlobalSpatialInfluenceRequest,
} from '@icarus-graph-explorer/renderer-sigma/core';
import { createStableIdentityCatalog } from '@icarus-graph-explorer/stable-identity';
import {
  createFolderClusterPreviewGeometry,
  previewFolderClusterAtAnchor,
  resolveFolderSpatialRules,
  type FolderSpatialRule,
  type FolderClusterPreviewGeometry,
} from '@icarus-graph-explorer/spatial-overrides';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectView,
  type ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import {
  BENCHMARK_PROFILES,
  isBenchmarkProfile,
  type BenchmarkProfile,
} from './benchmark-config';
import { buildReportFromSources } from './pipeline';

function layoutEvidence(result: ReturnType<typeof computeGlobalLayout>) {
  return {
    algorithm: result.algorithm,
    computeMs: result.computeMs,
    folderPriorMs: result.folderPriorMs,
    positionCount: result.positions.length,
    metrics: result.metrics,
  };
}

interface BenchmarkOptions {
  readonly profile: BenchmarkProfile;
  readonly include25k: boolean;
}

interface Distribution {
  readonly valuesMs: readonly number[];
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly maximumMs: number;
}

function selectedOptions(args: readonly string[]): BenchmarkOptions {
  const normalized = args[0] === '--' ? args.slice(1) : [...args];
  let profile: BenchmarkProfile = 'small';
  let include25k = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const flag = normalized[index];
    if (flag === '--include-25k') {
      include25k = true;
      continue;
    }
    if (flag === '--profile') {
      const value = normalized[index + 1];
      if (value === undefined || !isBenchmarkProfile(value)) {
        throw new Error(
          `Unknown global renderer benchmark profile: ${value ?? 'missing'}.`,
        );
      }
      profile = value;
      index += 1;
      continue;
    }
    throw new Error(
      'Usage: pnpm benchmark:global-renderer -- --profile <smoke|small|medium|large> [--include-25k]',
    );
  }
  return { profile, include25k };
}

function distribution(values: readonly number[]): Distribution {
  if (values.length === 0)
    throw new Error('A timing distribution cannot be empty.');
  const sorted = [...values].sort((left, right) => left - right);
  const medianIndex = Math.floor((sorted.length - 1) / 2);
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return {
    valuesMs: values,
    medianMs: sorted[medianIndex]!,
    p95Ms: sorted[p95Index]!,
    maximumMs: sorted.at(-1)!,
  };
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function measureRepeated(run: () => void, repeats: number): Distribution {
  run();
  const samples: number[] = [];
  for (let index = 0; index < repeats; index += 1) {
    const start = performance.now();
    run();
    samples.push(Number((performance.now() - start).toFixed(3)));
  }
  return distribution(samples);
}

function changedProjection(
  projection: ViewProjection,
  fraction: 0.01 | 0.1,
): ViewProjection {
  const count = Math.max(1, Math.floor(projection.nodes.length * fraction));
  return {
    ...projection,
    nodes: projection.nodes.map((node, index) =>
      index >= count || node.kind !== 'entity'
        ? node
        : {
            ...node,
            revealableDescendantCount: node.revealableDescendantCount + 1,
          },
    ),
  };
}

function updateEvidence(
  original: GlobalRendererInput,
  changed: GlobalRendererInput,
  repeats: number,
) {
  const incrementalSamples: number[] = [];
  for (let index = 0; index < repeats + 1; index += 1) {
    const graph = buildGlobalGraph(original);
    const start = performance.now();
    reconcileGlobalGraph(graph, changed);
    if (index > 0) {
      incrementalSamples.push(Number((performance.now() - start).toFixed(3)));
    }
  }
  return {
    fullReplacement: measureRepeated(() => {
      buildGlobalGraph(changed);
    }, repeats),
    incrementalMutation: distribution(incrementalSamples),
  };
}

function folderDragPreviewEvidence(folderSize: number, repeats: number) {
  const memberPositions = Array.from({ length: folderSize }, (_, index) => ({
    key: `synthetic-member-${index}`,
    x: index % 2 === 0 ? index * 0.01 : -index * 0.01,
    y: (index % 7) * 0.013,
  }));
  const automaticPositions = [
    ...memberPositions,
    { key: 'synthetic-frame-left', x: -100, y: -80 },
    { key: 'synthetic-frame-right', x: 100, y: 80 },
  ];
  const folderKeyByNodeKey = new Map([
    ...memberPositions.map(({ key }) => [key, 'synthetic-folder'] as const),
    ['synthetic-frame-left', 'other-folder'] as const,
    ['synthetic-frame-right', 'other-folder'] as const,
  ]);
  let geometry: FolderClusterPreviewGeometry | undefined;
  const geometryCapture = measureRepeated(() => {
    geometry = createFolderClusterPreviewGeometry({
      automaticPositions,
      folderKeyByNodeKey,
      anchors: new Map(),
      folderKey: 'synthetic-folder',
      visualDownGraphYSign: -1,
    });
  }, repeats);
  if (geometry === undefined) {
    throw new Error('Folder drag preview benchmark produced no geometry.');
  }
  const capturedGeometry: FolderClusterPreviewGeometry = geometry;
  let outputPositionCount = 0;
  let sample = 0;
  const sparsePreview = measureRepeated(
    () => {
      const preview = previewFolderClusterAtAnchor({
        geometry: capturedGeometry,
        anchor: {
          x: 0.35 + (sample % 5) * 0.01,
          y: -0.45 + (sample % 7) * 0.01,
        },
        visualDownGraphYSign: -1,
      });
      sample += 1;
      outputPositionCount = preview.positions.length;
    },
    Math.max(20, repeats * 10),
  );
  return {
    folderSize,
    outputPositionCount,
    geometryCapture,
    sparsePreview,
    operationCountsPerPreview: {
      automaticLayouts: 0,
      projections: 0,
      topologyReconciliations: 0,
      fullSpatialCompositions: 0,
    },
  };
}

function spatialInfluenceEvidence(
  input: GlobalRendererInput,
  basePositions: ReturnType<typeof globalLayoutPositionsFromInput>,
  repeats: number,
) {
  const documentKeys = input.nodes.flatMap((node) =>
    node.attributes.nodeKind === 'document' ? [node.key] : [],
  );
  const requestedSizes = [
    1,
    10,
    100,
    Math.min(1_000, documentKeys.length),
    Math.max(1, Math.floor(documentKeys.length * 0.6)),
  ];
  const groupSizes = [...new Set(requestedSizes)].filter(
    (size) => size <= documentKeys.length,
  );
  const baseByKey = new Map(
    basePositions.map((position) => [position.key, position] as const),
  );
  const nodes = input.nodes.map(({ key, attributes }) => {
    const position = baseByKey.get(key);
    if (position === undefined)
      throw new Error(`Spatial benchmark omitted node ${key}.`);
    return { key, x: position.x, y: position.y, size: attributes.size };
  });
  const edges = input.edges.map(({ key, source, target, attributes }) => ({
    key,
    source,
    target,
    weight: Math.max(1, attributes.referenceCount),
  }));
  const centerX = mean(basePositions.map(({ x }) => x));
  const centerY = mean(basePositions.map(({ y }) => y));
  const iterations = input.nodes.length <= 1_000 ? 12 : 4;
  const template = (
    groupSize: number,
    algorithm: GlobalSpatialInfluenceRequest['algorithm'] = 'interleaved-centroid',
    multiple = false,
  ): Omit<GlobalSpatialInfluenceRequest, 'requestId'> => {
    const first = documentKeys.slice(0, groupSize);
    const second = multiple
      ? documentKeys.slice(
          groupSize,
          Math.min(documentKeys.length, groupSize * 2),
        )
      : [];
    return {
      schemaVersion: 1,
      algorithm,
      algorithmVersion: 1,
      baseLayoutFingerprint: `synthetic-base-${input.nodes.length}-${input.edges.length}`,
      iterations,
      globalLayoutSettings: DEFAULT_GLOBAL_LAYOUT_SETTINGS,
      nodes,
      edges,
      attractors: [
        {
          ruleFolderKey: 'synthetic-rule-0',
          memberNodeKeys: first,
          targetX: centerX + 20,
          targetY: centerY,
          strength: 75,
        },
        ...(second.length === 0
          ? []
          : [
              {
                ruleFolderKey: 'synthetic-rule-1',
                memberNodeKeys: second,
                targetX: centerX - 20,
                targetY: centerY,
                strength: 50,
              },
            ]),
      ],
    };
  };
  const cases = groupSizes.map((groupSize, index) => {
    const request = template(
      groupSize,
      'interleaved-centroid',
      index === groupSizes.length - 1,
    );
    const serialization = measureRepeated(() => {
      JSON.stringify(request);
    }, repeats);
    const started = performance.now();
    const result = computeGlobalSpatialInfluence({
      ...request,
      requestId: index + 1,
    });
    const workerWallMs = Number((performance.now() - started).toFixed(3));
    const fingerprint = globalSpatialInfluenceFingerprint(request);
    const cache = new GlobalSpatialInfluenceCache();
    cache.set(fingerprint, result.positions);
    const cacheHit = measureRepeated(() => {
      if (cache.get(fingerprint) === undefined)
        throw new Error('Dynamic cache miss.');
    }, repeats);
    return {
      groupSize,
      attractorCount: request.attractors.length,
      iterations,
      requestSerialization: serialization,
      workerWallMs,
      computeMs: result.computeMs,
      forceAtlasMs: result.forceAtlasMs,
      attractorMs: result.attractorMs,
      metrics: result.metrics,
      dynamicCacheHit: cacheHit,
    };
  });
  const comparisonSize = Math.min(
    100,
    Math.max(1, Math.floor(documentKeys.length * 0.2)),
  );
  const comparisonIterations = Math.max(iterations, 24);
  const candidateA = computeGlobalSpatialInfluence({
    ...template(comparisonSize, 'interleaved-centroid'),
    iterations: comparisonIterations,
    requestId: 10_001,
  });
  const candidateB = computeGlobalSpatialInfluence({
    ...template(comparisonSize, 'move-then-relax'),
    iterations: comparisonIterations,
    requestId: 10_002,
  });

  const distinctFolders = [
    ...new Set(
      input.nodes.flatMap((node) =>
        node.attributes.folderKey === null ? [] : [node.attributes.folderKey],
      ),
    ),
  ].sort();
  const resolutionRules: FolderSpatialRule[] = distinctFolders
    .slice(0, 3)
    .map((folderKey, index) => ({
      folderKey,
      behavior: index % 2 === 0 ? 'pull' : 'place',
      scope: { kind: 'exact' },
      anchor: { x: index * 0.25, y: -index * 0.2 },
      ...(index % 2 === 0 ? { strength: 50 + index * 10 } : {}),
    }));
  const folderKeyByNodeKey = new Map(
    input.nodes.flatMap((node) =>
      node.attributes.folderKey === null
        ? []
        : [[node.key, node.attributes.folderKey] as const],
    ),
  );
  const ruleResolution = measureRepeated(() => {
    resolveFolderSpatialRules({ rules: resolutionRules, folderKeyByNodeKey });
  }, repeats);
  return {
    ruleResolution,
    cases,
    candidateComparison: {
      groupSize: comparisonSize,
      iterations: comparisonIterations,
      selected: 'interleaved-centroid',
      candidateA: {
        computeMs: candidateA.computeMs,
        metrics: candidateA.metrics,
      },
      candidateB: {
        computeMs: candidateB.computeMs,
        metrics: candidateB.metrics,
      },
    },
  };
}

function stressProfile(options: BenchmarkOptions): GlobalFixtureProfile {
  if (options.include25k) return 'stress-25000';
  switch (options.profile) {
    case 'smoke':
    case 'small':
      return 'stress-1000';
    case 'medium':
      return 'stress-5000';
    case 'large':
      return 'stress-10000';
  }
}

async function bundleEvidence() {
  const assetsDirectory = fileURLToPath(
    new URL('../../global-renderer-spike/dist/assets/', import.meta.url),
  );
  const files = await readdir(assetsDirectory);
  const assets = await Promise.all(
    files.sort().map(async (name) => ({
      kind: name.endsWith('.js')
        ? 'javascript'
        : name.endsWith('.css')
          ? 'css'
          : 'other',
      bytes: (await stat(join(assetsDirectory, name))).size,
    })),
  );
  return {
    javascriptBytes: assets
      .filter((asset) => asset.kind === 'javascript')
      .reduce((total, asset) => total + asset.bytes, 0),
    cssBytes: assets
      .filter((asset) => asset.kind === 'css')
      .reduce((total, asset) => total + asset.bytes, 0),
    chunkCount: assets.filter((asset) => asset.kind === 'javascript').length,
  };
}

async function main(): Promise<void> {
  const options = selectedOptions(process.argv.slice(2));
  const markdownDocuments = generateSyntheticWorkspace(
    BENCHMARK_PROFILES[options.profile],
  );
  const workspaceId = `synthetic-global-${options.profile}`;
  const report = buildReportFromSources({
    workspaceId,
    markdownDocuments,
    nonMarkdownPaths: [],
    discoveryReadMs: 0,
    identityCatalog: createStableIdentityCatalog(workspaceId),
  }).report;
  const projectionWorkspace = createProjectionWorkspace(report.snapshot);
  const projection = projectView(projectionWorkspace, {
    ...documentOnlyProjectionState(),
    filters: { referenceStatuses: ['resolved'] },
  });
  const repeats = options.profile === 'large' ? 3 : 5;
  let mapped: GlobalRendererInput | undefined;
  const mapping = measureRepeated(() => {
    mapped = mapProjectionToGlobal(projection);
  }, repeats);
  if (mapped === undefined)
    throw new Error('Global mapping benchmark produced no input.');
  const productInput: GlobalRendererInput = mapped;
  const graphBuild = measureRepeated(() => {
    buildGlobalGraph(productInput);
  }, repeats);
  const syntheticFolderKeys = [
    ...new Set(
      productInput.nodes.flatMap((node) =>
        node.attributes.folderKey === null ? [] : [node.attributes.folderKey],
      ),
    ),
  ].slice(0, 3);
  const syntheticAnchors = new Map(
    syntheticFolderKeys.map((folderKey, index) => [
      folderKey,
      { x: 0.35 + index * 0.2, y: 0.7 - index * 0.15 },
    ]),
  );
  const automaticPositions = globalLayoutPositionsFromInput(productInput);
  const directFolderDragging = [1, 10, 100, 1_000].map((folderSize) =>
    folderDragPreviewEvidence(folderSize, repeats),
  );
  const softFolderAttractors = spatialInfluenceEvidence(
    productInput,
    automaticPositions,
    repeats,
  );
  let spatialResult:
    ReturnType<typeof composeGlobalSpatialOverrides> | undefined;
  const spatialComposition = measureRepeated(() => {
    spatialResult = composeGlobalSpatialOverrides(
      automaticPositions,
      productInput,
      syntheticAnchors,
    );
  }, repeats);
  if (spatialResult === undefined) {
    throw new Error('Spatial composition benchmark produced no result.');
  }
  const onePercentInput = mapProjectionToGlobal(
    changedProjection(projection, 0.01),
  );
  const tenPercentInput = mapProjectionToGlobal(
    changedProjection(projection, 0.1),
  );

  const stressName = stressProfile(options);
  const stressProjection = createGlobalFixtureProjection(stressName);
  let stressInput: GlobalRendererInput | undefined;
  const stressMapping = measureRepeated(() => {
    stressInput = mapProjectionToGlobal(stressProjection);
  }, repeats);
  if (stressInput === undefined)
    throw new Error('Stress mapping produced no input.');
  const measuredStressInput: GlobalRendererInput = stressInput;
  const stressBuild = measureRepeated(() => {
    buildGlobalGraph(measuredStressInput);
  }, repeats);
  const stressSoftFolderAttractors = spatialInfluenceEvidence(
    measuredStressInput,
    globalLayoutPositionsFromInput(measuredStressInput),
    repeats,
  );

  const layoutGraph = buildGlobalGraph(productInput);
  const layoutIterations =
    layoutGraph.order <= 1_000 ? 100 : layoutGraph.order <= 5_000 ? 20 : 0;
  let layout:
    | { readonly omitted: true; readonly reason: string }
    | {
        readonly omitted: false;
        readonly iterations: number;
        readonly barnesHut: boolean;
        readonly referenceOnly: ReturnType<typeof layoutEvidence>;
        readonly optionAChunkedPrior: ReturnType<typeof layoutEvidence>;
        readonly optionBOffsetField: ReturnType<typeof layoutEvidence>;
        readonly exactCacheHit: Distribution;
        readonly folderMoveWarmSeed: ReturnType<typeof layoutEvidence>;
        readonly settingsWarmSeed: ReturnType<typeof layoutEvidence>;
        readonly selected: 'chunked-prior';
      };
  if (layoutIterations === 0) {
    layout = {
      omitted: true,
      reason: `Product projection has ${layoutGraph.order} nodes; fixed-iteration synchronous layout is intentionally capped at 5,000. Use the browser/Tauri worker harness.`,
    };
  } else {
    const clusteredSettings = DEFAULT_GLOBAL_LAYOUT_SETTINGS;
    const referenceSettings = {
      ...DEFAULT_GLOBAL_LAYOUT_SETTINGS,
      folderClustering: false,
    };
    const referenceRequest = createGlobalLayoutRequest(
      productInput,
      referenceSettings,
      layoutIterations,
      'reference-only',
    );
    const clusteredRequest = createGlobalLayoutRequest(
      productInput,
      clusteredSettings,
      layoutIterations,
      'chunked-prior',
    );
    const offsetRequest = createGlobalLayoutRequest(
      productInput,
      clusteredSettings,
      layoutIterations,
      'offset-field',
    );
    const referenceResult = computeGlobalLayout({
      ...referenceRequest,
      requestId: 1,
    });
    const clusteredResult = computeGlobalLayout({
      ...clusteredRequest,
      requestId: 2,
    });
    const offsetResult = computeGlobalLayout({
      ...offsetRequest,
      requestId: 3,
    });
    const warmNodes = productInput.nodes.map((node) => {
      const position = clusteredResult.positions.find(
        ({ key }) => key === node.key,
      );
      if (position === undefined) {
        throw new Error(`Clustered layout omitted warm node ${node.key}.`);
      }
      return {
        ...node,
        attributes: { ...node.attributes, x: position.x, y: position.y },
      };
    });
    const folderMoveInput = {
      ...productInput,
      nodes: warmNodes.map((node, index) =>
        index === 0
          ? {
              ...node,
              attributes: {
                ...node.attributes,
                folderKey: `${node.attributes.folderKey ?? '.'}/moved`,
              },
            }
          : node,
      ),
    };
    const spaciousSettings = {
      ...clusteredSettings,
      spacingPreset: 'spacious' as const,
    };
    const cache = new GlobalLayoutCache();
    const fingerprint = globalLayoutFingerprint(clusteredRequest);
    cache.set(fingerprint, clusteredResult.positions);
    const exactCacheHit = measureRepeated(() => {
      if (cache.get(fingerprint) === undefined) {
        throw new Error('Exact Global layout cache hit was unexpectedly lost.');
      }
    }, repeats);
    layout = {
      omitted: false,
      iterations: layoutIterations,
      barnesHut: layoutGraph.order >= 1_000,
      referenceOnly: layoutEvidence(referenceResult),
      optionAChunkedPrior: layoutEvidence(clusteredResult),
      optionBOffsetField: layoutEvidence(offsetResult),
      exactCacheHit,
      folderMoveWarmSeed: layoutEvidence(
        computeGlobalLayout({
          ...createGlobalLayoutRequest(
            folderMoveInput,
            clusteredSettings,
            layoutIterations,
            'chunked-prior',
          ),
          requestId: 4,
        }),
      ),
      settingsWarmSeed: layoutEvidence(
        computeGlobalLayout({
          ...createGlobalLayoutRequest(
            { ...productInput, nodes: warmNodes },
            spaciousSettings,
            layoutIterations,
            'chunked-prior',
          ),
          requestId: 5,
        }),
      ),
      selected: 'chunked-prior',
    };
  }

  console.log(
    JSON.stringify(
      {
        schemaVersion: 1,
        candidate: {
          sigma: { version: '3.0.3', license: 'MIT', channel: 'stable-v3' },
          graphology: { version: '0.26.0', license: 'MIT' },
          forceAtlas2: { version: '0.10.1', license: 'MIT' },
        },
        profile: options.profile,
        buildMode: 'production',
        productProjection: {
          mode: 'KG6 documents-only with effective resolved-only default',
          nodes: productInput.nodes.length,
          edges: productInput.edges.length,
          diagnosticTargets: projection.nodes.filter(
            (node) => node.kind === 'reference-target',
          ).length,
          mapping,
          graphologyBuild: graphBuild,
          updates: {
            onePercent: updateEvidence(productInput, onePercentInput, repeats),
            tenPercent: updateEvidence(productInput, tenPercentInput, repeats),
          },
        },
        stressProjection: {
          profile: stressName,
          nodes: measuredStressInput.nodes.length,
          edges: measuredStressInput.edges.length,
          mapping: stressMapping,
          graphologyBuild: stressBuild,
          softFolderAttractors: stressSoftFolderAttractors,
        },
        forceAtlas2AndFolderPrior: layout,
        normalizedSpatialOverrides: {
          anchorCount: syntheticAnchors.size,
          activeFolderCount: spatialResult.activeFolders.length,
          inactiveFolderCount: spatialResult.inactiveFolderKeys.length,
          positionCount: spatialResult.displayedPositions.length,
          composition: spatialComposition,
          automaticLayoutRequestsPerAnchorEdit: 0,
          projectionRequestsPerAnchorEdit: 0,
          topologyReconciliationsPerAnchorEdit: 0,
        },
        softFolderAttractors,
        directFolderDragging: {
          folderSizes: directFolderDragging,
          previewApplyModel:
            'One sparse exact-folder coordinate update and one scheduled Sigma partial refresh per animation frame; browser/Tauri harness measures renderer work.',
        },
        bundle: await bundleEvidence(),
        rendererRuntime: {
          measuredBy: 'production browser/Tauri harness',
          api: 'window.icarusGlobalRendererSpike',
          requiredPhases: [
            'sigma-mount',
            'first-after-render',
            'camera-pan-zoom',
            'hover-reducer',
            'selection',
            'search-center',
            '1%-full-replace',
            '1%-incremental',
            '10%-full-replace',
            '10%-incremental',
            'edge-events-off',
            'edge-events-on',
            'destroy-recreate',
            'forceatlas2-worker',
            'spatial-direct-drag',
          ],
        },
        privacy:
          'Synthetic aggregate-only evidence; no paths, names, content, workspace IDs, queries, or private output files.',
        note: 'Wall-clock values are local evidence and never CI thresholds.',
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Global renderer benchmark failed: ${message}`);
  process.exitCode = 1;
});
