import { performance } from 'node:perf_hooks';

import type {
  AddressableEntity,
  KnowledgeSnapshot,
  Reference,
  SourceLocation,
  SourceSpan,
} from '@icarus-graph-explorer/core';
import { computeDagreLayout } from '@icarus-graph-explorer/dagre-layout/compute';
import {
  applyLocalStructuredPositions,
  applyRendererLayoutPositions,
  createRendererLayoutInput,
  LocalStructuredLayoutCache,
  localStructuredGraphPositions,
  localStructuredLayoutFingerprint,
  mapProjectionToReactFlow,
  seedLocalStructuredGraph,
} from '@icarus-graph-explorer/renderer-reactflow/local-structured';
import {
  buildLocalGraph,
  computeLocalLayout,
  createLocalLayoutRequest,
  LocalLayoutCache,
  localLayoutFingerprint,
  mapProjectionToLocalTopology,
  reconcileLocalGraph,
  resolveLocalDensityFit,
  seedLocalRendererInput,
  type LocalLayoutPosition,
  type LocalRendererInput,
} from '@icarus-graph-explorer/renderer-sigma/core';
import {
  createProjectionWorkspace,
  deriveLocalProjectionState,
  documentOnlyProjectionState,
  projectLocalView,
  type ViewProjection,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

type LocalBenchmarkProfile = 'smoke' | 'small' | 'medium' | 'stress';

interface LocalProfileShape {
  readonly neighborDocuments: number;
  readonly rootHeadings: number;
  readonly childrenPerHeading: number;
  readonly includeBlocks: boolean;
}

const LOCAL_PROFILES: Readonly<
  Record<LocalBenchmarkProfile, LocalProfileShape>
> = {
  smoke: {
    neighborDocuments: 2,
    rootHeadings: 3,
    childrenPerHeading: 1,
    includeBlocks: false,
  },
  small: {
    neighborDocuments: 10,
    rootHeadings: 12,
    childrenPerHeading: 1,
    includeBlocks: false,
  },
  medium: {
    neighborDocuments: 50,
    rootHeadings: 80,
    childrenPerHeading: 2,
    includeBlocks: true,
  },
  stress: {
    neighborDocuments: 600,
    rootHeadings: 64,
    childrenPerHeading: 1,
    includeBlocks: false,
  },
};

interface Distribution {
  readonly valuesMs: readonly number[];
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly maximumMs: number;
}

function selectedProfile(args: readonly string[]): LocalBenchmarkProfile {
  const normalized = args[0] === '--' ? args.slice(1) : [...args];
  if (normalized.length === 0) return 'small';
  if (
    normalized.length === 2 &&
    normalized[0] === '--profile' &&
    (normalized[1] === 'smoke' ||
      normalized[1] === 'small' ||
      normalized[1] === 'medium' ||
      normalized[1] === 'stress')
  ) {
    return normalized[1];
  }
  throw new Error(
    'Usage: pnpm benchmark:local-renderer -- --profile <smoke|small|medium|stress>',
  );
}

function sourceSpan(line: number): SourceSpan {
  const offset = line * 10;
  return {
    start: { line, column: 1, offset },
    end: { line, column: 2, offset: offset + 1 },
  };
}

function source(path: string, line: number): SourceLocation {
  return { path, span: sourceSpan(line) };
}

function localFixture(profile: LocalBenchmarkProfile): {
  readonly snapshot: KnowledgeSnapshot;
  readonly rootEntityId: string;
  readonly expandedEntityIds: readonly string[];
} {
  const shape = LOCAL_PROFILES[profile];
  const rootEntityId = 'local-root';
  const entities: AddressableEntity[] = [
    {
      id: rootEntityId,
      kind: 'document',
      source: source('local/root.md', 1),
    },
  ];
  const references: Reference[] = [];
  const expandedEntityIds: string[] = [];
  const topHeadingIds: string[] = [];

  for (let index = 0; index < shape.rootHeadings; index += 1) {
    const headingId = `root-heading-${index}`;
    topHeadingIds.push(headingId);
    entities.push({
      id: headingId,
      kind: 'section',
      parentId: rootEntityId,
      title: `Root heading ${index}`,
      level: 1,
      source: source('local/root.md', 2 + index * 10),
    });
    if (profile === 'medium' || profile === 'stress') {
      expandedEntityIds.push(headingId);
    }
    for (let child = 0; child < shape.childrenPerHeading; child += 1) {
      entities.push({
        id: `${headingId}-child-${child}`,
        kind: 'section',
        parentId: headingId,
        title: `Detail ${index}.${child}`,
        level: child + 2,
        source: source('local/root.md', 3 + index * 10 + child),
      });
    }
    if (shape.includeBlocks) {
      entities.push({
        id: `${headingId}-block`,
        kind: 'block',
        parentId: headingId,
        source: source('local/root.md', 8 + index * 10),
      });
    }
    if (index % 8 === 0) {
      references.push({
        id: `diagnostic-${index}`,
        kind: 'link',
        sourceEntityId: headingId,
        rawTarget: `Missing ${index}`,
        sourceSpan: sourceSpan(2 + index * 10),
        resolution: {
          status: 'unresolved',
          reason: 'Synthetic missing target.',
        },
      });
    }
  }

  for (let index = 0; index < shape.neighborDocuments; index += 1) {
    const documentId = `neighbor-${index}`;
    const neighborPath = `local/neighbors/${index}.md`;
    entities.push({
      id: documentId,
      kind: 'document',
      source: source(neighborPath, 1),
    });
    entities.push({
      id: `${documentId}-heading`,
      kind: 'section',
      parentId: documentId,
      title: `Neighbor ${index}`,
      level: 1,
      source: source(neighborPath, 2),
    });
    const sourceHeading = topHeadingIds[index % topHeadingIds.length]!;
    references.push({
      id: `root-to-neighbor-${index}`,
      kind: 'link',
      sourceEntityId: sourceHeading,
      rawTarget: `Neighbor ${index}`,
      sourceSpan: sourceSpan(2 + index * 10),
      resolution: { status: 'resolved', targetEntityId: documentId },
    });
    references.push({
      id: `neighbor-to-root-${index}`,
      kind: 'link',
      sourceEntityId: `${documentId}-heading`,
      rawTarget: 'Root',
      sourceSpan: sourceSpan(2),
      resolution: { status: 'resolved', targetEntityId: rootEntityId },
    });
  }

  return {
    snapshot: {
      schemaVersion: 1,
      workspace: { id: `synthetic-local-${profile}` },
      entities,
      references,
    },
    rootEntityId,
    expandedEntityIds,
  };
}

function distribution(values: readonly number[]): Distribution {
  if (values.length === 0)
    throw new Error('A timing distribution cannot be empty.');
  const sorted = [...values].sort((left, right) => left - right);
  return {
    valuesMs: values,
    medianMs: sorted[Math.floor((sorted.length - 1) / 2)]!,
    p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!,
    maximumMs: sorted.at(-1)!,
  };
}

function measureRepeated<Value>(
  run: () => Value,
  repeats: number,
): { readonly distribution: Distribution; readonly value: Value } {
  run();
  const samples: number[] = [];
  let value!: Value;
  let measured = false;
  for (let index = 0; index < repeats; index += 1) {
    const started = performance.now();
    value = run();
    measured = true;
    samples.push(Number((performance.now() - started).toFixed(3)));
  }
  if (!measured) throw new Error('Benchmark produced no value.');
  return { distribution: distribution(samples), value };
}

function applyPositions(
  graph: ReturnType<typeof buildLocalGraph>,
  positions: readonly LocalLayoutPosition[],
): void {
  for (const position of positions) {
    graph.mergeNodeAttributes(position.key, { x: position.x, y: position.y });
  }
}

function expandedNeighborState(
  projection: ViewProjection,
  state: ViewProjectionState,
  rootEntityId: string,
): ViewProjectionState {
  const neighbor = projection.nodes.find(
    (node) =>
      node.kind === 'entity' &&
      node.entityKind === 'document' &&
      node.entityId !== rootEntityId,
  );
  if (neighbor?.kind !== 'entity') return state;
  return {
    ...state,
    disclosure: {
      ...state.disclosure,
      expandedEntityIds: [
        ...new Set([...state.disclosure.expandedEntityIds, neighbor.entityId]),
      ].sort(),
    },
  };
}

function mappedEvidence(input: LocalRendererInput) {
  return {
    nodes: input.nodes.length,
    edges: input.edges.length,
    documents: input.nodes.filter(
      ({ attributes }) => attributes.nodeKind === 'document',
    ).length,
    sections: input.nodes.filter(
      ({ attributes }) => attributes.nodeKind === 'section',
    ).length,
    blocks: input.nodes.filter(
      ({ attributes }) => attributes.nodeKind === 'block',
    ).length,
    diagnostics: input.nodes.filter(
      ({ attributes }) => attributes.nodeKind === 'diagnostic',
    ).length,
  };
}

function main(): void {
  const profile = selectedProfile(process.argv.slice(2));
  const fixture = localFixture(profile);
  const workspace = createProjectionWorkspace(fixture.snapshot);
  const rootEntityId = fixture.rootEntityId;
  const state = deriveLocalProjectionState(
    workspace,
    {
      ...documentOnlyProjectionState(),
      disclosure: {
        ...documentOnlyProjectionState().disclosure,
        expandedEntityIds: fixture.expandedEntityIds,
        includeBlocks: LOCAL_PROFILES[profile].includeBlocks,
      },
    },
    rootEntityId,
  );
  const repeats = profile === 'stress' ? 1 : profile === 'medium' ? 3 : 7;
  const projectionMeasure = measureRepeated(
    () => projectLocalView(workspace, state),
    repeats,
  );
  const projection = projectionMeasure.value;
  const mappingMeasure = measureRepeated(
    () => mapProjectionToLocalTopology(projection, rootEntityId),
    repeats,
  );
  const topology = mappingMeasure.value;
  const seedMeasure = measureRepeated(
    () => seedLocalRendererInput(topology),
    repeats,
  );
  const seeded = seedMeasure.value;
  const graphBuild = measureRepeated(() => buildLocalGraph(seeded), repeats);
  const request = createLocalLayoutRequest(seeded);
  const layoutMeasure = measureRepeated(
    () => computeLocalLayout({ ...request, requestId: 1 }),
    repeats,
  );
  const graph = buildLocalGraph(seeded);
  const applyMeasure = measureRepeated(
    () => applyPositions(graph, layoutMeasure.value.positions),
    repeats,
  );
  const densityPolicy = measureRepeated(
    () => resolveLocalDensityFit(seeded, layoutMeasure.value.positions),
    repeats,
  );
  if (densityPolicy.value.fallback) {
    throw new Error(
      `Local density benchmark fell back: ${densityPolicy.value.fallbackReason ?? 'unknown reason'}`,
    );
  }
  const expandedState = expandedNeighborState(projection, state, rootEntityId);
  const expandedProjection = projectLocalView(workspace, expandedState);
  const expandedInput = seedLocalRendererInput(
    mapProjectionToLocalTopology(expandedProjection, rootEntityId),
  );
  const reconciliation = measureRepeated(() => {
    const candidate = buildLocalGraph(seeded);
    return reconcileLocalGraph(candidate, expandedInput);
  }, repeats);
  const cache = new LocalLayoutCache();
  const fingerprint = localLayoutFingerprint(request);
  cache.set(fingerprint, layoutMeasure.value.positions);
  const exactCacheHit = measureRepeated(() => {
    const hit = cache.get(fingerprint);
    if (hit === undefined)
      throw new Error('Exact Local layout cache hit was lost.');
    return hit.length;
  }, repeats);
  const structuredMapping = measureRepeated(
    () =>
      mapProjectionToReactFlow(projection, 'local-structured', {
        visualVariant: 'extended',
        rootEntityId,
      }),
    repeats,
  );
  const structuredRootNodeId = structuredMapping.value.nodes.find(
    (node) => node.type === 'entity' && node.data.root,
  )?.id;
  if (structuredRootNodeId === undefined) {
    throw new Error('Local Structured mapping omitted the root document.');
  }
  const structuredSeed = measureRepeated(
    () =>
      seedLocalStructuredGraph(
        structuredMapping.value.nodes,
        structuredMapping.value.edges,
        structuredRootNodeId,
      ),
    repeats,
  );
  const structuredLayoutInput = createRendererLayoutInput(
    structuredMapping.value.nodes,
    structuredMapping.value.edges,
    'local-structured',
  );
  const structuredLayout = measureRepeated(
    () => computeDagreLayout(structuredLayoutInput),
    repeats,
  );
  const focusBaselineLayout = measureRepeated(
    () => computeDagreLayout({ ...structuredLayoutInput, mode: 'focus' }),
    repeats,
  );
  const structuredApply = measureRepeated(() => {
    const dagreGraph = applyRendererLayoutPositions(
      structuredMapping.value.nodes,
      structuredMapping.value.edges,
      'local-structured',
      structuredLayout.value,
    );
    return applyLocalStructuredPositions(
      dagreGraph.nodes,
      dagreGraph.edges,
      localStructuredGraphPositions(dagreGraph),
      structuredRootNodeId,
    );
  }, repeats);
  const structuredFingerprint = localStructuredLayoutFingerprint(
    structuredMapping.value.nodes,
    structuredMapping.value.edges,
  );
  const structuredCache = new LocalStructuredLayoutCache();
  structuredCache.set(
    structuredFingerprint,
    localStructuredGraphPositions(structuredApply.value),
  );
  const structuredCacheHit = measureRepeated(() => {
    const positions = structuredCache.get(structuredFingerprint);
    if (positions === undefined) {
      throw new Error('Exact Local Structured cache hit was lost.');
    }
    return applyLocalStructuredPositions(
      structuredMapping.value.nodes,
      structuredMapping.value.edges,
      positions,
      structuredRootNodeId,
    );
  }, repeats);
  const freeToStructured = measureRepeated(() => {
    const mapped = mapProjectionToReactFlow(projection, 'local-structured', {
      visualVariant: 'extended',
      rootEntityId,
    });
    const rootNodeId = mapped.nodes.find(
      (node) => node.type === 'entity' && node.data.root,
    )?.id;
    if (rootNodeId === undefined) throw new Error('Missing Structured root.');
    return seedLocalStructuredGraph(mapped.nodes, mapped.edges, rootNodeId);
  }, repeats);
  const structuredToFree = measureRepeated(() => {
    const mapped = mapProjectionToLocalTopology(projection, rootEntityId);
    return seedLocalRendererInput(mapped);
  }, repeats);
  const expandedStructuredMapping = measureRepeated(
    () =>
      mapProjectionToReactFlow(expandedProjection, 'local-structured', {
        visualVariant: 'extended',
        rootEntityId,
      }),
    repeats,
  );
  const expandedStructuredRoot = expandedStructuredMapping.value.nodes.find(
    (node) => node.type === 'entity' && node.data.root,
  )?.id;
  if (expandedStructuredRoot === undefined) {
    throw new Error('Expanded Local Structured mapping omitted the root.');
  }
  const expandedStructuredSeed = measureRepeated(
    () =>
      seedLocalStructuredGraph(
        expandedStructuredMapping.value.nodes,
        expandedStructuredMapping.value.edges,
        expandedStructuredRoot,
      ),
    repeats,
  );

  console.log(
    JSON.stringify(
      {
        schemaVersion: 1,
        profile,
        modes: ['Local Free', 'Local Structured'],
        canonicalWorkspace: {
          entities: fixture.snapshot.entities.length,
          references: fixture.snapshot.references.length,
        },
        boundedProjection: {
          ...mappedEvidence(seeded),
          projection: projectionMeasure.distribution,
          topologyMapping: mappingMeasure.distribution,
          deterministicSeed: seedMeasure.distribution,
          graphologyBuild: graphBuild.distribution,
        },
        forceAtlas2WorkerEquivalent: {
          policyVersion: layoutMeasure.value.policyVersion,
          stopReason: layoutMeasure.value.stopReason,
          iterationsCompleted: layoutMeasure.value.iterationsCompleted,
          batchesCompleted: layoutMeasure.value.batchesCompleted,
          stableBatches: layoutMeasure.value.stableBatches,
          layout: layoutMeasure.distribution,
          reportedComputeMs: layoutMeasure.value.computeMs,
          finalP90: layoutMeasure.value.finalMovement?.all.p90 ?? null,
          lowDegreeMaximum:
            layoutMeasure.value.finalMovement?.lowDegree.maximum ?? null,
          apply: applyMeasure.distribution,
          rootNormalizedToOrigin: layoutMeasure.value.positions.some(
            ({ key, x, y }) => key === seeded.rootNodeKey && x === 0 && y === 0,
          ),
        },
        densityAwareCameraFit: {
          ratio: densityPolicy.value.ratio,
          computation: densityPolicy.distribution,
          measuredEvaluations: repeats,
          warmupEvaluations: 1,
          additionalLayoutRequests: 0,
        },
        disclosureUpdate: {
          ...mappedEvidence(expandedInput),
          reconciliation: reconciliation.distribution,
          finalMutationCounts: reconciliation.value,
          globalLayouts: 0,
        },
        exactLayoutCacheHit: exactCacheHit.distribution,
        localStructured: {
          nodes: structuredMapping.value.nodes.length,
          edges: structuredMapping.value.edges.length,
          extendedMapping: structuredMapping.distribution,
          deterministicSeed: structuredSeed.distribution,
          firstUsableScenePreparation: {
            mapping: structuredMapping.distribution,
            seed: structuredSeed.distribution,
          },
          dagreWorkerEquivalent: structuredLayout.distribution,
          focusModeDagreBaseline: focusBaselineLayout.distribution,
          applyAndRootNormalize: structuredApply.distribution,
          rootNormalizedToOrigin:
            structuredApply.value.nodes.find(
              ({ id }) => id === structuredRootNodeId,
            )?.position.x === 0 &&
            structuredApply.value.nodes.find(
              ({ id }) => id === structuredRootNodeId,
            )?.position.y === 0,
          exactCacheHit: structuredCacheHit.distribution,
          exactCacheHitW3Layouts: 0,
          freeToStructuredSeedPreparation: freeToStructured.distribution,
          structuredToFreeSeedPreparation: structuredToFree.distribution,
          disclosureUpdate: {
            nodes: expandedStructuredMapping.value.nodes.length,
            edges: expandedStructuredMapping.value.edges.length,
            mapping: expandedStructuredMapping.distribution,
            seed: expandedStructuredSeed.distribution,
            latestW3LayoutsOnChangedTopology: 1,
            globalLayouts: 0,
          },
        },
        layoutToggleOperationOracle: {
          localProjectionCalls: 0,
          globalProjectionCalls: 0,
          globalLayoutCalls: 0,
          workspaceTransactions: 0,
          cacheMissW3LayoutsAtMost: 1,
        },
        runtimeEvidence:
          'DOM first/refined paint, W3 round trip and main-thread gaps, Sigma/WebGL mount, viewport-point anchoring, hover, selection, pan/zoom, and search-center remain production browser/Tauri measurements.',
        privacy:
          'Deterministic synthetic aggregate-only evidence; no paths, names, source text, queries, workspace IDs, or private output files.',
        note: 'Wall-clock values are local evidence and never CI thresholds.',
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Local renderer benchmark failed: ${message}`);
  process.exitCode = 1;
}
