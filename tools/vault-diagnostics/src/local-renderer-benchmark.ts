import { performance } from 'node:perf_hooks';

import type {
  AddressableEntity,
  KnowledgeSnapshot,
  Reference,
  SourceLocation,
  SourceSpan,
} from '@icarus-graph-explorer/core';
import {
  buildLocalGraph,
  computeLocalLayout,
  createLocalLayoutRequest,
  LocalLayoutCache,
  localLayoutFingerprint,
  mapProjectionToLocalTopology,
  reconcileLocalGraph,
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
    neighborDocuments: 75,
    rootHeadings: 200,
    childrenPerHeading: 3,
    includeBlocks: true,
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
  const iterations = seeded.nodes.length >= 600 ? 30 : 80;
  const request = createLocalLayoutRequest(seeded, iterations);
  const layoutMeasure = measureRepeated(
    () => computeLocalLayout({ ...request, requestId: 1 }),
    repeats,
  );
  const graph = buildLocalGraph(seeded);
  const applyMeasure = measureRepeated(
    () => applyPositions(graph, layoutMeasure.value.positions),
    repeats,
  );
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

  console.log(
    JSON.stringify(
      {
        schemaVersion: 1,
        profile,
        mode: 'Local Free',
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
          iterations,
          layout: layoutMeasure.distribution,
          reportedComputeMs: layoutMeasure.value.computeMs,
          apply: applyMeasure.distribution,
          rootNormalizedToOrigin: layoutMeasure.value.positions.some(
            ({ key, x, y }) => key === seeded.rootNodeKey && x === 0 && y === 0,
          ),
        },
        disclosureUpdate: {
          ...mappedEvidence(expandedInput),
          reconciliation: reconciliation.distribution,
          finalMutationCounts: reconciliation.value,
          globalLayouts: 0,
        },
        exactLayoutCacheHit: exactCacheHit.distribution,
        runtimeEvidence:
          'Transition-to-first-visual-paint, Sigma mount, LOD, hover, selection, pan/zoom, and search-center remain production browser/Tauri measurements.',
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
