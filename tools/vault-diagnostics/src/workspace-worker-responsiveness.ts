import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';

import { generateSyntheticWorkspace } from '@icarus-graph-explorer/diagnostics-obsidian';
import { createStableIdentityCatalog } from '@icarus-graph-explorer/stable-identity';
import {
  WORKSPACE_WORKER_PROTOCOL_VERSION,
  chunkWorkspaceWorkerRequest,
  createWorkspaceWorkerRuntime,
  createWorkspaceWorkerResponseAssembler,
  type WorkspaceWorkerRequest,
  type WorkspaceWorkerResponse,
} from '@icarus-graph-explorer/workspace-worker';

import {
  BENCHMARK_PROFILES,
  isBenchmarkProfile,
  type BenchmarkProfile,
} from './benchmark-config';

interface Measured<T> {
  readonly value: T;
  readonly elapsedMs: number;
  readonly maximumEventLoopGapMs: number;
  readonly eventLoopGapP95Ms: number;
  readonly maximumGapAtMs: number;
}

function profileFromArguments(): BenchmarkProfile {
  const flag = process.argv.indexOf('--profile');
  const value = flag < 0 ? 'medium' : process.argv[flag + 1];
  if (value === undefined || !isBenchmarkProfile(value)) {
    throw new Error('--profile must be smoke, small, medium, or large.');
  }
  return value;
}

async function measureWithEventLoopProbe<T>(
  operation: () => T | Promise<T>,
): Promise<Measured<T>> {
  let active = true;
  let lastProbeAt = performance.now();
  let maximumEventLoopGapMs = 0;
  let maximumGapAtMs = 0;
  let operationStartedAt = 0;
  const eventLoopGaps: number[] = [];
  const probe = () => {
    const current = performance.now();
    const gap = current - lastProbeAt;
    eventLoopGaps.push(gap);
    if (gap > maximumEventLoopGapMs) {
      maximumEventLoopGapMs = gap;
      maximumGapAtMs = Math.max(0, current - operationStartedAt);
    }
    lastProbeAt = current;
    if (active) setTimeout(probe, 16);
  };
  setTimeout(probe, 16);
  await new Promise<void>((resolve) => setTimeout(resolve, 20));
  const startedAt = performance.now();
  operationStartedAt = startedAt;
  const value = await operation();
  const elapsedMs = performance.now() - startedAt;
  active = false;
  await new Promise<void>((resolve) => setTimeout(resolve, 20));
  const sortedEventLoopGaps = [...eventLoopGaps].sort(
    (left, right) => left - right,
  );
  return {
    value,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    maximumEventLoopGapMs: Number(maximumEventLoopGapMs.toFixed(3)),
    eventLoopGapP95Ms: Number(
      sortedEventLoopGaps[
        Math.max(0, Math.ceil(eventLoopGaps.length * 0.95) - 1)
      ]!.toFixed(3),
    ),
    maximumGapAtMs: Number(maximumGapAtMs.toFixed(3)),
  };
}

function send(
  worker: Worker,
  request: WorkspaceWorkerRequest,
): Promise<WorkspaceWorkerResponse> {
  return new Promise((resolve, reject) => {
    const assembler = createWorkspaceWorkerResponseAssembler();
    const onMessage = (response: unknown) => {
      const result = assembler.accept(response);
      if (result.status === 'pending') return;
      cleanup();
      if (result.status === 'invalid') {
        reject(new Error('Worker thread returned a malformed response.'));
        return;
      }
      resolve(result.response);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      worker.off('message', onMessage);
      worker.off('error', onError);
    };
    worker.on('message', onMessage);
    worker.on('error', onError);
    void (async () => {
      try {
        const frames = chunkWorkspaceWorkerRequest(request);
        for (let index = 0; index < frames.length; index += 1) {
          worker.postMessage(frames[index]);
          if (index + 1 < frames.length) {
            await new Promise<void>((continueSending) =>
              setImmediate(continueSending),
            );
          }
        }
      } catch (error: unknown) {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    })();
  });
}

const profile = profileFromArguments();
const documents = generateSyntheticWorkspace(BENCHMARK_PROFILES[profile]);
const request: WorkspaceWorkerRequest = {
  protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
  requestId: 'responsiveness-initialize',
  kind: 'prepare-initialize',
  input: {
    workspaceId: 'synthetic-worker-benchmark',
    documents,
    identityCatalog: createStableIdentityCatalog('synthetic-worker-benchmark'),
    nonMarkdownPaths: [],
  },
};

const worker = new Worker(
  new URL('./workspace-worker-thread.ts', import.meta.url),
);
let offThread: Measured<WorkspaceWorkerResponse>;
try {
  // Exclude tsx/worker module startup from the transaction comparison. The
  // production worker is likewise reusable for every update in one vault.
  await send(worker, {
    protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
    requestId: 'responsiveness-warmup',
    kind: 'build-committed-report',
    input: { nonMarkdownPaths: [] },
  });
  offThread = await measureWithEventLoopProbe(() => send(worker, request));
} finally {
  await worker.terminate();
}
const directRuntime = createWorkspaceWorkerRuntime();
const direct = await measureWithEventLoopProbe(() =>
  directRuntime.handle(structuredClone(request)),
);

if (direct.value.kind !== 'prepared' || offThread.value.kind !== 'prepared') {
  throw new Error(
    'Both direct and worker measurements must prepare successfully.',
  );
}
const output = {
  schemaVersion: 1,
  profile,
  counts: {
    documents: documents.length,
    entities: offThread.value.prepared.report.snapshot.entities.length,
    references: offThread.value.prepared.report.snapshot.references.length,
  },
  direct: {
    roundTripMs: direct.elapsedMs,
    mainThreadHighGapMs: direct.maximumEventLoopGapMs,
    mainThreadGapP95Ms: direct.eventLoopGapP95Ms,
    maximumGapAtMs: direct.maximumGapAtMs,
  },
  worker: {
    internalComputeMs: offThread.value.prepared.timings.workerComputeMs,
    roundTripMs: offThread.elapsedMs,
    mainThreadHighGapMs: offThread.maximumEventLoopGapMs,
    mainThreadGapP95Ms: offThread.eventLoopGapP95Ms,
    maximumGapAtMs: offThread.maximumGapAtMs,
  },
  responsiveness: {
    highGapReductionRatio: Number(
      (
        direct.maximumEventLoopGapMs /
        Math.max(offThread.maximumEventLoopGapMs, 0.001)
      ).toFixed(2),
    ),
  },
  correctness: {
    reportEqual:
      JSON.stringify(direct.value.prepared.report) ===
      JSON.stringify(offThread.value.prepared.report),
    catalogEqual:
      JSON.stringify(direct.value.prepared.nextIdentityCatalog) ===
      JSON.stringify(offThread.value.prepared.nextIdentityCatalog),
  },
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
