import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, release } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import { generateSyntheticWorkspace } from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  matchesGraphQuery,
  parseGraphQuery,
} from '@icarus-graph-explorer/graph-query';
import {
  summarizePerformanceDurations,
  type PerformanceSampleSummary,
} from '@icarus-graph-explorer/performance';
import { mapProjectionToReactFlow } from '@icarus-graph-explorer/renderer-reactflow/prepare';
import { createStableIdentityCatalog } from '@icarus-graph-explorer/stable-identity';
import {
  createProjectionWorkspace,
  projectView,
  structuralDepthProjectionState,
  type ProjectionInstrumentation,
  type ProjectionOperation,
  type ProjectionPhase,
  type ViewProjection,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import {
  BENCHMARK_PROFILES,
  isBenchmarkProfile,
  type BenchmarkProfile,
} from './benchmark-config';
import { buildReportFromSources } from './pipeline';

interface CliOptions {
  readonly profile: BenchmarkProfile;
  readonly warmupCount: number;
  readonly sampleCount: number;
  readonly output?: string;
}

const PROJECTION_PHASES = [
  'base-projection',
  'focus-slice',
  'filter-preparation',
  'primary-filter',
  'candidate-direct-plan',
  'candidate-legacy-base',
  'candidate-legacy-filter',
  'actionable-count-finalization',
  'validation',
] as const satisfies readonly ProjectionPhase[];

const PROJECTION_OPERATIONS = [
  'baseProjectionBuilds',
  'candidateBaseProjectionBuilds',
  'filterPreparations',
  'primaryFilterApplications',
  'legacyCandidateFilterApplications',
  'candidateDirectPlans',
  'candidateLegacyFallbacks',
  'canonicalReferencesScanned',
  'entityFilterEvaluations',
  'ancestorWalkSteps',
  'hierarchyEdgesRebuilt',
  'nodeSorts',
  'edgeSorts',
  'validationRuns',
] as const satisfies readonly ProjectionOperation[];

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

function integer(
  value: string | undefined,
  flag: string,
  minimum: number,
): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`${flag} must be an integer >= ${minimum}.`);
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
      throw new Error(
        'Every query-projection benchmark flag requires a value.',
      );
    }
    if (flag === '--profile') {
      if (!isBenchmarkProfile(value)) {
        throw new Error(`Unknown benchmark profile: ${value}.`);
      }
      profile = value;
    } else if (flag === '--samples') {
      sampleCount = integer(value, flag, 1);
    } else if (flag === '--warmups') {
      warmupCount = integer(value, flag, 0);
    } else if (flag === '--output') {
      output = value;
    } else {
      throw new Error(`Unknown query-projection benchmark flag: ${flag}.`);
    }
  }
  const defaults = DEFAULT_REPEATS[profile];
  return {
    profile,
    sampleCount: sampleCount ?? defaults.sampleCount,
    warmupCount: warmupCount ?? defaults.warmupCount,
    ...(output === undefined ? {} : { output }),
  };
}

function emptyOperations(): Record<ProjectionOperation, number> {
  return Object.fromEntries(
    PROJECTION_OPERATIONS.map((operation) => [operation, 0]),
  ) as Record<ProjectionOperation, number>;
}

function recorder(): {
  readonly instrumentation: ProjectionInstrumentation;
  readonly phaseDurations: Record<ProjectionPhase, number>;
  readonly operations: Record<ProjectionOperation, number>;
} {
  const phaseDurations = Object.fromEntries(
    PROJECTION_PHASES.map((phase) => [phase, 0]),
  ) as Record<ProjectionPhase, number>;
  const operations = emptyOperations();
  return {
    instrumentation: {
      measure<Value>(phase: ProjectionPhase, run: () => Value): Value {
        const started = performance.now();
        try {
          return run();
        } finally {
          phaseDurations[phase] += performance.now() - started;
        }
      },
      count(operation, amount = 1) {
        operations[operation] += amount;
      },
    },
    phaseDurations,
    operations,
  };
}

function canonicalCounts(snapshot: KnowledgeSnapshot) {
  return {
    documents: snapshot.entities.filter(({ kind }) => kind === 'document')
      .length,
    sections: snapshot.entities.filter(({ kind }) => kind === 'section').length,
    blocks: snapshot.entities.filter(({ kind }) => kind === 'block').length,
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

function scenarioStates(): Readonly<Record<string, ViewProjectionState>> {
  const depthThree = structuralDepthProjectionState(3);
  return {
    'depth-three-no-filter': depthThree,
    'depth-three-query-most': {
      ...depthThree,
      filters: {
        query: '(documents OR (sections AND level<=3)) AND NOT path:"archive"',
      },
    },
    'depth-three-query-selective': {
      ...depthThree,
      filters: { query: 'sections AND level=4 AND title:"Section 2-3"' },
    },
    'path-kind': {
      ...depthThree,
      filters: { pathPrefixes: ['notes'], entityKinds: ['section'] },
    },
    'projected-text-fallback': {
      ...depthThree,
      filters: { text: 'Missing-2-' },
    },
    'invalid-query': {
      ...depthThree,
      filters: { query: 'sections documents' },
    },
  };
}

interface ProjectionMeasurement {
  readonly projectView: PerformanceSampleSummary;
  readonly phases: Readonly<Record<ProjectionPhase, PerformanceSampleSummary>>;
  readonly operations: Readonly<Record<ProjectionOperation, number>>;
  readonly projection: ViewProjection;
}

function measureProjection(
  options: CliOptions,
  workspace: ReturnType<typeof createProjectionWorkspace>,
  state: ViewProjectionState,
): ProjectionMeasurement {
  for (let index = 0; index < options.warmupCount; index += 1) {
    projectView(workspace, state);
  }
  const projectValues: number[] = [];
  const phaseValues = Object.fromEntries(
    PROJECTION_PHASES.map((phase) => [phase, [] as number[]]),
  ) as Record<ProjectionPhase, number[]>;
  let expectedOperations: Record<ProjectionOperation, number> | undefined;
  let projection: ViewProjection | undefined;
  for (let index = 0; index < options.sampleCount; index += 1) {
    const sample = recorder();
    const started = performance.now();
    projection = projectView(workspace, state, sample.instrumentation);
    projectValues.push(performance.now() - started);
    for (const phase of PROJECTION_PHASES) {
      phaseValues[phase].push(sample.phaseDurations[phase]);
    }
    if (
      expectedOperations !== undefined &&
      JSON.stringify(expectedOperations) !== JSON.stringify(sample.operations)
    ) {
      throw new Error('Projection operation counts changed between samples.');
    }
    expectedOperations = sample.operations;
  }
  if (projection === undefined || expectedOperations === undefined) {
    throw new Error('Query-projection benchmark produced no measured sample.');
  }
  return {
    projectView: summarizePerformanceDurations(
      projectValues,
      options.warmupCount,
    ),
    phases: Object.fromEntries(
      PROJECTION_PHASES.map((phase) => [
        phase,
        summarizePerformanceDurations(phaseValues[phase], options.warmupCount),
      ]),
    ) as Record<ProjectionPhase, PerformanceSampleSummary>,
    operations: expectedOperations,
    projection,
  };
}

function measureMapping(
  options: CliOptions,
  projection: ViewProjection,
): PerformanceSampleSummary {
  for (let index = 0; index < options.warmupCount; index += 1) {
    mapProjectionToReactFlow(projection, 'structure');
  }
  const values: number[] = [];
  for (let index = 0; index < options.sampleCount; index += 1) {
    const started = performance.now();
    mapProjectionToReactFlow(projection, 'structure');
    values.push(performance.now() - started);
  }
  return summarizePerformanceDurations(values, options.warmupCount);
}

function measureQueryEvaluator(
  options: CliOptions,
  snapshot: KnowledgeSnapshot,
  query: string | undefined,
): PerformanceSampleSummary | undefined {
  if (query === undefined) return undefined;
  const parsed = parseGraphQuery(query);
  if (!parsed.valid) return undefined;
  const run = () => {
    let matches = 0;
    for (const entity of snapshot.entities) {
      if (matchesGraphQuery(entity, parsed.expression)) matches += 1;
    }
    return matches;
  };
  for (let index = 0; index < options.warmupCount; index += 1) run();
  const values: number[] = [];
  for (let index = 0; index < options.sampleCount; index += 1) {
    const started = performance.now();
    run();
    values.push(performance.now() - started);
  }
  return summarizePerformanceDurations(values, options.warmupCount);
}

function environment() {
  let gitCommit = 'unknown';
  try {
    gitCommit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // Exported source trees may not contain Git metadata.
  }
  return {
    surface: 'node',
    gitCommit,
    runtime: `Node ${process.version}`,
    os: `${platform()} ${release()}`,
    architecture: arch(),
    cpu: cpus()[0]?.model ?? 'unknown CPU',
  };
}

function main(): void {
  const options = selectedOptions(process.argv.slice(2));
  const documents = generateSyntheticWorkspace(
    BENCHMARK_PROFILES[options.profile],
  );
  const built = buildReportFromSources({
    workspaceId: `synthetic-query-${options.profile}`,
    markdownDocuments: documents,
    nonMarkdownPaths: [],
    discoveryReadMs: 0,
    identityCatalog: createStableIdentityCatalog(
      `synthetic-query-${options.profile}`,
    ),
  });
  const snapshot = built.report.snapshot;
  const workspace = createProjectionWorkspace(snapshot);
  const states = scenarioStates();
  const scenarios = Object.entries(states).map(([id, state]) => {
    const measured = measureProjection(options, workspace, state);
    const queryEvaluator = measureQueryEvaluator(
      options,
      snapshot,
      state.filters?.query,
    );
    return {
      id,
      canonical: canonicalCounts(snapshot),
      projected: projectedCounts(measured.projection),
      projectView: measured.projectView,
      phases: measured.phases,
      operations: measured.operations,
      mapping: measureMapping(options, measured.projection),
      ...(queryEvaluator === undefined ? {} : { queryEvaluator }),
    };
  });
  const repeatedIds = [
    'depth-three-query-most',
    'depth-three-query-selective',
    'path-kind',
    'depth-three-no-filter',
    'depth-three-query-most',
  ] as const;
  const repeatedQuerySequence = repeatedIds.map((scenarioId, index) => {
    const state = states[scenarioId];
    if (state === undefined) {
      throw new Error(`Missing repeated query scenario: ${scenarioId}.`);
    }
    const measured = measureProjection(options, workspace, state);
    return {
      transition: ['A', 'B', 'C', 'Clear', 'A'][index],
      scenarioId,
      projectView: measured.projectView,
      phases: measured.phases,
      operations: measured.operations,
    };
  });
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: environment(),
    profile: options.profile,
    canonical: canonicalCounts(snapshot),
    scenarios,
    repeatedQuerySequence,
    note: 'Aggregate deterministic synthetic evidence only; scenario IDs contain no source/query text and timings are not CI gates.',
  };
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output !== undefined) {
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
  console.error(
    `Query-projection benchmark failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
