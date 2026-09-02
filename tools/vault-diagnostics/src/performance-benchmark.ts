import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, release } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import {
  generateSyntheticWorkspace,
  type SyntheticSourceDocument,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  createInspectionWorkspace,
  inspectEntity,
  inspectProjectedEdge,
  searchEntities,
} from '@icarus-graph-explorer/explorer-inspection';
import {
  emptyPerformanceOperationCounts,
  measureRepeated,
  summarizePerformanceDurations,
  validatePerformanceResult,
  type PerformanceCanonicalCounts,
  type PerformanceOperationCounts,
  type PerformancePhase,
  type PerformanceResult,
  type PerformanceSampleSummary,
  type PerformanceScenarioResult,
  type PerformanceWorkloadProfile,
} from '@icarus-graph-explorer/performance';
import {
  layoutRendererGraph,
  mapProjectionToReactFlow,
} from '@icarus-graph-explorer/renderer-reactflow/prepare';
import { createStableIdentityCatalog } from '@icarus-graph-explorer/stable-identity';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectStructureView,
  projectView,
  structuralDepthProjectionState,
  topLevelSectionProjectionState,
  type ViewProjection,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import {
  BENCHMARK_PROFILES,
  isBenchmarkProfile,
  type BenchmarkProfile,
} from './benchmark-config';
import { measureIncrementalWorkspace } from './incremental-benchmark';
import {
  KG12B_SCOPE,
  PERFORMANCE_BUDGETS,
  PERFORMANCE_CACHE_DECISIONS,
  PERFORMANCE_WORKER_DECISIONS,
  RENDERER_SCALE_CLIFF,
} from './performance-policy';
import { buildReportFromSources } from './pipeline';

interface CliOptions {
  readonly profile: BenchmarkProfile;
  readonly warmupCount: number;
  readonly sampleCount: number;
  readonly output?: string;
}

const DEFAULT_REPEATS: Readonly<
  Record<
    BenchmarkProfile,
    { readonly warmupCount: number; readonly sampleCount: number }
  >
> = {
  smoke: { warmupCount: 2, sampleCount: 7 },
  small: { warmupCount: 2, sampleCount: 7 },
  medium: { warmupCount: 1, sampleCount: 5 },
  large: { warmupCount: 1, sampleCount: 3 },
};

// The small fully-expanded run establishes the Dagre cliff before this point.
// Larger scenes retain projection/mapping counts but skip a known multi-second
// main-thread phase rather than risking an unbounded benchmark process.
const MAX_REPEATED_LAYOUT_NODES = 2_500;

function positiveInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function nonNegativeInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
}

function selectedOptions(args: readonly string[]): CliOptions {
  const values = args[0] === '--' ? args.slice(1) : [...args];
  let profile: BenchmarkProfile = 'small';
  let sampleCount: number | undefined;
  let warmupCount: number | undefined;
  let output: string | undefined;
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (flag === undefined || value === undefined) {
      throw new Error('Every performance benchmark flag requires a value.');
    }
    if (flag === '--profile') {
      if (!isBenchmarkProfile(value))
        throw new Error(`Unknown benchmark profile: ${value}.`);
      profile = value;
    } else if (flag === '--samples') sampleCount = positiveInteger(value, flag);
    else if (flag === '--warmups')
      warmupCount = nonNegativeInteger(value, flag);
    else if (flag === '--output') output = value;
    else throw new Error(`Unknown performance benchmark flag: ${flag}.`);
  }
  const defaults = DEFAULT_REPEATS[profile];
  return {
    profile,
    sampleCount: sampleCount ?? defaults.sampleCount,
    warmupCount: warmupCount ?? defaults.warmupCount,
    ...(output === undefined ? {} : { output }),
  };
}

function canonicalCounts(
  snapshot: KnowledgeSnapshot,
): PerformanceCanonicalCounts {
  const documents = snapshot.entities.filter(
    ({ kind }) => kind === 'document',
  ).length;
  const sections = snapshot.entities.filter(
    ({ kind }) => kind === 'section',
  ).length;
  const blocks = snapshot.entities.filter(
    ({ kind }) => kind === 'block',
  ).length;
  return {
    documents,
    sections,
    blocks,
    entities: snapshot.entities.length,
    references: snapshot.references.length,
  };
}

function projectedCounts(projection: ViewProjection) {
  return {
    nodes: projection.nodes.length,
    edges: projection.edges.length,
    referenceEdges: projection.edges.filter(({ kind }) => kind === 'reference')
      .length,
    diagnosticNodes: projection.nodes.filter(
      ({ kind }) => kind === 'reference-target',
    ).length,
  };
}

function operations(
  changes: Partial<PerformanceOperationCounts>,
): PerformanceOperationCounts {
  return { ...emptyPerformanceOperationCounts(), ...changes };
}

function repeated<Value>(
  options: CliOptions,
  run: () => Value,
): { readonly summary: PerformanceSampleSummary; readonly lastValue: Value } {
  return measureRepeated({
    warmupCount: options.warmupCount,
    sampleCount: options.sampleCount,
    now: () => performance.now(),
    run,
  });
}

function pipelineScenario(
  options: CliOptions,
  documents: readonly SyntheticSourceDocument[],
) {
  const phaseValues: Record<
    | 'parse-adapt'
    | 'resolution'
    | 'identity-reconciliation'
    | 'report-construction',
    number[]
  > = {
    'parse-adapt': [],
    resolution: [],
    'identity-reconciliation': [],
    'report-construction': [],
  };
  const run = () =>
    buildReportFromSources({
      workspaceId: `synthetic-${options.profile}`,
      markdownDocuments: documents,
      nonMarkdownPaths: [],
      discoveryReadMs: 0,
      identityCatalog: createStableIdentityCatalog(
        `synthetic-${options.profile}`,
      ),
    });
  for (let index = 0; index < options.warmupCount; index += 1) run();
  let last: ReturnType<typeof run> | undefined;
  for (let index = 0; index < options.sampleCount; index += 1) {
    last = run();
    phaseValues['parse-adapt'].push(last.timings.parseAdaptMs);
    phaseValues.resolution.push(last.timings.resolutionMs);
    phaseValues['identity-reconciliation'].push(
      last.identity?.reconciliationMs ?? 0,
    );
    phaseValues['report-construction'].push(last.timings.reportConstructionMs);
  }
  if (last === undefined) {
    throw new Error('Pipeline benchmark completed without a measured sample.');
  }
  return {
    last,
    phases: Object.fromEntries(
      Object.entries(phaseValues).map(([phase, values]) => [
        phase,
        summarizePerformanceDurations(values, options.warmupCount),
      ]),
    ) as Readonly<Partial<Record<PerformancePhase, PerformanceSampleSummary>>>,
  };
}

function projectionStates(snapshot: KnowledgeSnapshot): Readonly<
  Record<
    string,
    {
      readonly label: string;
      readonly state: ViewProjectionState;
      readonly layoutMode: 'structure' | 'focus';
    }
  >
> {
  const workspace = createProjectionWorkspace(snapshot);
  const entities = workspace.entities();
  const focusRoot = entities.find(({ kind }) => kind === 'document');
  if (focusRoot === undefined)
    throw new Error('Synthetic benchmark produced no focus root.');
  const expandable = entities
    .filter(({ kind }) => kind !== 'block')
    .map(({ id }) => id);
  const boundedExpansionCount = Math.min(
    64,
    Math.max(8, Math.ceil(expandable.length * 0.02)),
  );
  const documentsOnly = documentOnlyProjectionState();
  const topLevel = topLevelSectionProjectionState();
  const threeLevels = structuralDepthProjectionState(3);
  return {
    'documents-only': {
      label: 'Documents only',
      state: documentsOnly,
      layoutMode: 'structure',
    },
    'top-level-sections': {
      label: 'Top-level sections',
      state: topLevel,
      layoutMode: 'structure',
    },
    'three-structural-levels': {
      label: 'Three structural section levels',
      state: threeLevels,
      layoutMode: 'structure',
    },
    'bounded-custom-expansion': {
      label: 'Bounded custom expansion',
      state: {
        disclosure: {
          defaultDepth: 1,
          expandedEntityIds: expandable.slice(0, boundedExpansionCount),
          collapsedEntityIds: [],
          includeBlocks: true,
        },
      },
      layoutMode: 'structure',
    },
    'one-hop-focus': {
      label: 'One-hop focus',
      state: {
        ...documentsOnly,
        focus: {
          rootEntityId: focusRoot.id,
          hops: 1,
          direction: 'both',
          hierarchyContext: 'ancestors',
        },
      },
      layoutMode: 'focus',
    },
    'deeper-focus': {
      label: 'Three-hop focus',
      state: {
        ...documentsOnly,
        focus: {
          rootEntityId: focusRoot.id,
          hops: 3,
          direction: 'both',
          hierarchyContext: 'ancestors-and-children',
        },
      },
      layoutMode: 'focus',
    },
    'resolution-filter': {
      label: 'Non-resolved reference filter',
      state: {
        ...topLevel,
        filters: { referenceStatuses: ['unresolved', 'ambiguous', 'invalid'] },
      },
      layoutMode: 'structure',
    },
    'heading-filter': {
      label: 'Heading-level filter',
      state: {
        ...topLevel,
        disclosure: { ...topLevel.disclosure, maxSectionLevel: 2 },
      },
      layoutMode: 'structure',
    },
    'path-entity-filter': {
      label: 'Path and entity-kind filters',
      state: {
        ...topLevel,
        filters: { pathPrefixes: ['notes'], entityKinds: ['section'] },
      },
      layoutMode: 'structure',
    },
    'depth-three-advanced-query': {
      label: 'Three structural levels with nontrivial advanced query',
      state: {
        ...threeLevels,
        filters: {
          query:
            '(documents OR (sections AND level<=3)) AND NOT path:"archive"',
        },
      },
      layoutMode: 'structure',
    },
    'fully-expanded-stress': {
      label: 'Fully expanded structural stress',
      state: {
        disclosure: {
          defaultDepth: 1,
          expandedEntityIds: expandable,
          collapsedEntityIds: [],
          includeBlocks: true,
        },
      },
      layoutMode: 'structure',
    },
  };
}

function projectionScenarios(
  options: CliOptions,
  snapshot: KnowledgeSnapshot,
): readonly PerformanceScenarioResult[] {
  const workspaceMeasurement = repeated(options, () =>
    createProjectionWorkspace(snapshot),
  );
  const workspace = workspaceMeasurement.lastValue;
  const canonical = canonicalCounts(snapshot);
  return Object.entries(projectionStates(snapshot)).map(([id, scenario]) => {
    const projected = repeated(options, () =>
      scenario.layoutMode === 'focus'
        ? projectStructureView(workspace, scenario.state)
        : projectView(workspace, scenario.state),
    );
    const projection = projected.lastValue;
    const mapped = repeated(options, () =>
      mapProjectionToReactFlow(projection, scenario.layoutMode, {
        visualVariant:
          scenario.layoutMode === 'structure'
            ? 'compact-schematic'
            : 'extended',
      }),
    );
    const laidOut =
      projection.nodes.length > MAX_REPEATED_LAYOUT_NODES
        ? undefined
        : repeated(options, () =>
            layoutRendererGraph(
              mapped.lastValue.nodes,
              mapped.lastValue.edges,
              scenario.layoutMode,
            ),
          );
    if (laidOut?.lastValue.layoutWarning !== null && laidOut !== undefined) {
      throw new Error(
        `${scenario.label} layout failed: ${laidOut.lastValue.layoutWarning}`,
      );
    }
    return {
      id,
      label: scenario.label,
      performanceClass: 'B',
      profile: options.profile,
      canonical,
      projected: projectedCounts(projection),
      phases: {
        'projection-workspace': workspaceMeasurement.summary,
        'project-view': projected.summary,
        'renderer-mapping': mapped.summary,
        ...(laidOut === undefined ? {} : { 'dagre-layout': laidOut.summary }),
      },
      operations: operations({
        'projection-workspace-builds': options.sampleCount,
        projections: options.sampleCount,
        'renderer-mappings': options.sampleCount,
        layouts: laidOut === undefined ? 0 : options.sampleCount,
      }),
      layoutMode: scenario.layoutMode,
      buildMode: 'production',
      ...(laidOut === undefined
        ? {
            omittedPhases: [
              {
                phase: 'dagre-layout' as const,
                reason: `Projected node count exceeds the ${MAX_REPEATED_LAYOUT_NODES}-node repeated-layout safety ceiling established after the measured structural cliff.`,
              },
            ],
          }
        : {}),
    };
  });
}

function inspectionScenarios(
  options: CliOptions,
  snapshot: KnowledgeSnapshot,
): readonly PerformanceScenarioResult[] {
  const canonical = canonicalCounts(snapshot);
  const workspaceMeasurement = repeated(options, () =>
    createInspectionWorkspace(snapshot),
  );
  const workspace = workspaceMeasurement.lastValue;
  const entity = workspace.entities().find(({ kind }) => kind === 'document');
  if (entity === undefined)
    throw new Error('Synthetic benchmark produced no inspectable document.');
  const projectionWorkspace = createProjectionWorkspace(snapshot);
  const projection = projectView(
    projectionWorkspace,
    documentOnlyProjectionState(),
  );
  const edge = projection.edges.find(({ kind }) => kind === 'reference');
  if (edge === undefined)
    throw new Error(
      'Synthetic benchmark produced no inspectable reference edge.',
    );
  const search = repeated(options, () =>
    searchEntities(workspace, 'Section 2-0'),
  );
  const entityInspection = repeated(options, () =>
    inspectEntity(workspace, entity.id),
  );
  const edgeInspection = repeated(options, () =>
    inspectProjectedEdge(workspace, projection, edge.id),
  );
  const common = {
    performanceClass: 'B' as const,
    profile: options.profile as PerformanceWorkloadProfile,
    canonical,
    layoutMode: 'none' as const,
    buildMode: 'production' as const,
  };
  return [
    {
      ...common,
      id: 'canonical-search',
      label: 'Canonical entity search',
      phases: {
        'inspection-workspace': workspaceMeasurement.summary,
        search: search.summary,
      },
      operations: operations({
        'inspection-workspace-builds': options.sampleCount,
        searches: options.sampleCount,
      }),
    },
    {
      ...common,
      id: 'entity-subtree-inspection',
      label: 'Entity subtree inspection',
      phases: { inspection: entityInspection.summary },
      operations: operations({ inspections: options.sampleCount }),
    },
    {
      ...common,
      id: 'aggregated-edge-inspection',
      label: 'Aggregated projected-edge inspection',
      projected: projectedCounts(projection),
      phases: { inspection: edgeInspection.summary },
      operations: operations({ inspections: options.sampleCount }),
    },
  ];
}

function incrementalScenarios(
  options: CliOptions,
  documents: readonly SyntheticSourceDocument[],
  canonical: PerformanceCanonicalCounts,
): readonly PerformanceScenarioResult[] {
  const runs = [];
  for (
    let index = 0;
    index < options.warmupCount + options.sampleCount;
    index += 1
  ) {
    runs.push(
      measureIncrementalWorkspace(`synthetic-${options.profile}`, documents),
    );
  }
  const measured = runs.slice(options.warmupCount);
  const names = ['one-file-edit', 'add', 'delete', 'move'] as const;
  return names.map((name) => {
    const values = measured.map((run) => {
      const scenario = run.scenarios.find(
        ({ changeType }) => changeType === name,
      );
      if (scenario === undefined)
        throw new Error(`Missing incremental ${name} result.`);
      return scenario.incrementalTotalMs;
    });
    return {
      id: `incremental-${name}`,
      label: `Incremental workspace ${name}`,
      performanceClass: 'C',
      profile: options.profile,
      canonical,
      phases: {
        'workspace-update': summarizePerformanceDurations(
          values,
          options.warmupCount,
        ),
      },
      operations: operations({}),
      layoutMode: 'none',
      buildMode: 'production',
    };
  });
}

function environment() {
  const cpu = cpus()[0]?.model ?? 'unknown CPU';
  let gitCommit = 'unknown';
  try {
    gitCommit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // An exported source tree may not contain Git metadata; the explicit
    // aggregate value remains honest instead of inventing a revision.
  }
  return {
    surface: 'node' as const,
    gitCommit,
    runtime: `Node ${process.version}`,
    os: `${platform()} ${release()}`,
    architecture: arch(),
    cpu,
  };
}

function main(): void {
  const options = selectedOptions(process.argv.slice(2));
  const documents = generateSyntheticWorkspace(
    BENCHMARK_PROFILES[options.profile],
  );
  const pipeline = pipelineScenario(options, documents);
  const canonical = canonicalCounts(pipeline.last.report.snapshot);
  const scenarios: PerformanceScenarioResult[] = [
    {
      id: 'workspace-pipeline',
      label: 'Parse, resolve, reconcile identity, and construct report',
      performanceClass: 'C',
      profile: options.profile,
      canonical,
      phases: pipeline.phases,
      operations: operations({}),
      layoutMode: 'none',
      buildMode: 'production',
    },
    ...incrementalScenarios(options, documents, canonical),
    ...projectionScenarios(options, pipeline.last.report.snapshot),
    ...inspectionScenarios(options, pipeline.last.report.snapshot),
  ];
  const result: PerformanceResult = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: environment(),
    scenarios,
    budgets: PERFORMANCE_BUDGETS,
    decisions: {
      workers: PERFORMANCE_WORKER_DECISIONS,
      caching: PERFORMANCE_CACHE_DECISIONS,
      rendererScaleCliff: RENDERER_SCALE_CLIFF,
      kg12bScope: KG12B_SCOPE,
    },
    note: 'Aggregate diagnostic evidence only; wall-clock values are not CI pass/fail gates.',
  };
  const validation = validatePerformanceResult(result);
  if (!validation.valid) {
    throw new Error(
      `Performance result validation failed: ${validation.issues[0] ?? 'unknown issue'}`,
    );
  }
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output !== undefined) {
    // pnpm filters execute from the package directory. INIT_CWD preserves the
    // caller's root-relative output expectation without recording that path.
    const outputPath = isAbsolute(options.output)
      ? options.output
      : resolve(process.env.INIT_CWD ?? process.cwd(), options.output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, serialized, 'utf8');
  }
  process.stdout.write(serialized);
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Performance benchmark failed: ${message}`);
  process.exitCode = 1;
}
