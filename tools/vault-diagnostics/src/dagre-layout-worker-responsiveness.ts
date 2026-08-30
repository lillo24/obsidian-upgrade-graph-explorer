import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';

import {
  DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
  validateDagreLayoutWorkerResponse,
  type DagreLayoutInput,
  type DagreLayoutWorkerRequest,
  type DagreLayoutWorkerResponse,
} from '@icarus-graph-explorer/dagre-layout';
import { computeDagreLayout } from '@icarus-graph-explorer/dagre-layout/compute';
import { generateSyntheticWorkspace } from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  applyRendererLayoutPositions,
  createRendererLayoutInput,
} from '@icarus-graph-explorer/renderer-reactflow/layout';
import { mapProjectionToReactFlow } from '@icarus-graph-explorer/renderer-reactflow/prepare';
import { createStableIdentityCatalog } from '@icarus-graph-explorer/stable-identity';
import {
  createProjectionWorkspace,
  projectView,
  type ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import { BENCHMARK_PROFILES } from './benchmark-config';
import { buildReportFromSources } from './pipeline';

interface Measured<Value> {
  readonly value: Value;
  readonly elapsedMs: number;
  readonly maximumEventLoopGapMs: number;
  readonly eventLoopGapP95Ms: number;
}

interface WorkerRequestResult {
  readonly response: DagreLayoutWorkerResponse;
  readonly roundTripMs: number;
}

function selectedProfile(): 'small' | 'medium' {
  const flag = process.argv.indexOf('--profile');
  const value = flag < 0 ? 'small' : process.argv[flag + 1];
  if (value !== 'small' && value !== 'medium') {
    throw new Error('--profile must be small or medium.');
  }
  return value;
}

function createProductionInput(profile: 'small' | 'medium'): {
  readonly input: DagreLayoutInput;
  readonly projection: ViewProjection;
  readonly mapped: ReturnType<typeof mapProjectionToReactFlow>;
} {
  const documents = generateSyntheticWorkspace(BENCHMARK_PROFILES[profile]);
  const run = buildReportFromSources({
    workspaceId: `synthetic-dagre-${profile}`,
    markdownDocuments: documents,
    nonMarkdownPaths: [],
    discoveryReadMs: 0,
    identityCatalog: createStableIdentityCatalog(`synthetic-dagre-${profile}`),
  });
  const workspace = createProjectionWorkspace(run.report.snapshot);
  const expandable = workspace
    .entities()
    .filter(({ kind }) => kind !== 'block')
    .map(({ id }) => id);
  const expandedEntityIds =
    profile === 'small' ? expandable : expandable.slice(0, 64);
  const projection = projectView(workspace, {
    disclosure: {
      defaultDepth: 1,
      expandedEntityIds,
      collapsedEntityIds: [],
      includeBlocks: true,
    },
  });
  const mapped = mapProjectionToReactFlow(projection, 'structure');
  const input = createRendererLayoutInput(
    mapped.nodes,
    mapped.edges,
    'structure',
  );
  return { input, projection, mapped };
}

async function measureWithEventLoopProbe<Value>(
  operation: () => Value | Promise<Value>,
): Promise<Measured<Value>> {
  let active = true;
  let lastProbeAt = performance.now();
  let maximumEventLoopGapMs = 0;
  const gaps: number[] = [];
  const probe = () => {
    const current = performance.now();
    const gap = current - lastProbeAt;
    gaps.push(gap);
    maximumEventLoopGapMs = Math.max(maximumEventLoopGapMs, gap);
    lastProbeAt = current;
    if (active) setTimeout(probe, 16);
  };
  setTimeout(probe, 16);
  await new Promise<void>((resolve) => setTimeout(resolve, 20));
  const startedAt = performance.now();
  const value = await operation();
  const elapsedMs = performance.now() - startedAt;
  active = false;
  await new Promise<void>((resolve) => setTimeout(resolve, 20));
  const sorted = [...gaps].sort((left, right) => left - right);
  return {
    value,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    maximumEventLoopGapMs: Number(maximumEventLoopGapMs.toFixed(3)),
    eventLoopGapP95Ms: Number(
      sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!.toFixed(3),
    ),
  };
}

function createWorker(): {
  readonly worker: Worker;
  readonly startupMs: number;
} {
  const startedAt = performance.now();
  const worker = new Worker(
    new URL('./dagre-layout-worker-thread.ts', import.meta.url),
  );
  return {
    worker,
    startupMs: Number((performance.now() - startedAt).toFixed(3)),
  };
}

function send(
  worker: Worker,
  request: DagreLayoutWorkerRequest,
): Promise<WorkerRequestResult> {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
    };
    const onMessage = (value: unknown) => {
      cleanup();
      try {
        resolve({
          response: validateDagreLayoutWorkerResponse(
            value,
            request.requestId,
            request.input,
          ),
          roundTripMs: Number((performance.now() - startedAt).toFixed(3)),
        });
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = () => {
      cleanup();
      reject(new Error('The superseded Dagre worker exited.'));
    };
    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.on('exit', onExit);
    worker.postMessage(request);
  });
}

function request(
  requestId: number,
  input: DagreLayoutInput,
): DagreLayoutWorkerRequest {
  return {
    protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
    requestId,
    kind: 'layout',
    input,
  };
}

async function supersessionEvidence(input: DagreLayoutInput) {
  const restartConstructorMs: number[] = [];
  const first = createWorker();
  restartConstructorMs.push(first.startupMs);
  const a = send(first.worker, request(101, input)).catch(() => null);
  await new Promise<void>((resolve) => setTimeout(resolve, 16));
  await first.worker.terminate();
  await a;

  const second = createWorker();
  restartConstructorMs.push(second.startupMs);
  const b = send(second.worker, request(102, input)).catch(() => null);
  await new Promise<void>((resolve) => setTimeout(resolve, 16));
  await second.worker.terminate();
  await b;

  const third = createWorker();
  restartConstructorMs.push(third.startupMs);
  try {
    const c = await send(third.worker, request(103, input));
    return {
      adoptedRequest: 'C',
      terminatedRequests: ['A', 'B'],
      restartConstructorMs,
      staleCpuWindowMs: 32,
      cRoundTripMs: c.roundTripMs,
      cComputeMs: c.response.computeMs,
      cSucceeded: c.response.kind === 'success',
    };
  } finally {
    await third.worker.terminate();
  }
}

const profile = selectedProfile();
const fixture = createProductionInput(profile);
const direct = await measureWithEventLoopProbe(() =>
  computeDagreLayout(fixture.input),
);

const warm = createWorker();
let workerMeasured: Measured<WorkerRequestResult>;
try {
  await send(
    warm.worker,
    request(1, {
      mode: 'structure',
      nodes: [{ id: 'warmup', width: 10, height: 10 }],
      edges: [],
    }),
  );
  workerMeasured = await measureWithEventLoopProbe(() =>
    send(warm.worker, request(2, fixture.input)),
  );
} finally {
  await warm.worker.terminate();
}
if (workerMeasured.value.response.kind !== 'success') {
  throw new Error('The measured Dagre worker request failed.');
}
const applyStartedAt = performance.now();
const applied = applyRendererLayoutPositions(
  fixture.mapped.nodes,
  fixture.mapped.edges,
  fixture.input.mode,
  workerMeasured.value.response.output,
);
const resultApplyMs = Number((performance.now() - applyStartedAt).toFixed(3));
const supersession = await measureWithEventLoopProbe(() =>
  supersessionEvidence(fixture.input),
);

const output = {
  schemaVersion: 1,
  profile,
  counts: {
    projectedNodes: fixture.projection.nodes.length,
    projectedEdges: fixture.projection.edges.length,
    layoutNodes: fixture.input.nodes.length,
    layoutEdges: fixture.input.edges.length,
  },
  direct: {
    computeMs: direct.elapsedMs,
    mainThreadHighGapMs: direct.maximumEventLoopGapMs,
    mainThreadGapP95Ms: direct.eventLoopGapP95Ms,
  },
  worker: {
    warmWorkerConstructorMs: warm.startupMs,
    internalComputeMs: workerMeasured.value.response.computeMs,
    roundTripMs: workerMeasured.value.roundTripMs,
    resultApplyMs,
    requestToAdoptionMs: Number(
      (workerMeasured.value.roundTripMs + resultApplyMs).toFixed(3),
    ),
    mainThreadHighGapMs: workerMeasured.maximumEventLoopGapMs,
    mainThreadGapP95Ms: workerMeasured.eventLoopGapP95Ms,
  },
  responsiveness: {
    highGapReductionRatio: Number(
      (
        direct.maximumEventLoopGapMs /
        Math.max(workerMeasured.maximumEventLoopGapMs, 0.001)
      ).toFixed(2),
    ),
  },
  correctness: {
    positionsEqual:
      JSON.stringify(direct.value) ===
      JSON.stringify(workerMeasured.value.response.output),
    appliedNodeCount: applied.nodes.length,
    appliedEdgeCount: applied.edges.length,
  },
  supersession: {
    ...supersession.value,
    sequenceElapsedMs: supersession.elapsedMs,
    mainThreadHighGapMs: supersession.maximumEventLoopGapMs,
    mainThreadGapP95Ms: supersession.eventLoopGapP95Ms,
  },
  note: 'Synthetic aggregate-only production topology; no identifiers are emitted.',
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
