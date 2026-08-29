import { describe, expect, it } from 'vitest';

import { buildObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import { createStableIdentityCatalog } from '@icarus-graph-explorer/stable-identity';
import {
  applyObsidianWorkspaceChanges,
  initializeObsidianWorkspaceEngine,
} from '@icarus-graph-explorer/workspace-engine-obsidian';

import {
  WORKSPACE_WORKER_PROTOCOL_VERSION,
  WorkspaceProcessorError,
  chunkWorkspaceWorkerRequest,
  chunkWorkspaceWorkerResponse,
  createInProcessWorkspaceProcessor,
  createWorkspaceWorkerRequestAssembler,
  createWorkspaceWorkerResponseAssembler,
  createWorkspaceWorkerRuntime,
  isWorkspaceWorkerResponse,
  type WorkspaceWorkerRequestPayload,
  type WorkspaceWorkerResponse,
  type WorkspaceWorkerRuntimeDependencies,
} from './index';

const INITIAL_DOCUMENTS = [
  { path: 'A.md', source: '# A\n[[B]]\n' },
  { path: 'B.md', source: '# B\n' },
] as const;

function runtime(overrides: Partial<WorkspaceWorkerRuntimeDependencies> = {}) {
  let tick = 0;
  let candidate = 0;
  return createWorkspaceWorkerRuntime({
    now: () => ++tick,
    nextCandidateId: () => `candidate-${++candidate}`,
    initializeEngine: initializeObsidianWorkspaceEngine,
    applyChanges: applyObsidianWorkspaceChanges,
    buildReport: buildObsidianDiagnosticReport,
    ...overrides,
  });
}

function request(
  target: ReturnType<typeof runtime>,
  sequence: number,
  payload: WorkspaceWorkerRequestPayload,
): WorkspaceWorkerResponse {
  return target.handle({
    ...payload,
    protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
    requestId: `request-${sequence}`,
  });
}

function prepared(response: WorkspaceWorkerResponse) {
  expect(response.kind).toBe('prepared');
  if (response.kind !== 'prepared')
    throw new Error('Expected prepared result.');
  return response.prepared;
}

function failure(response: WorkspaceWorkerResponse) {
  expect(response.kind).toBe('failure');
  if (response.kind !== 'failure') throw new Error('Expected failure result.');
  return response;
}

function initializePayload(): WorkspaceWorkerRequestPayload {
  return {
    kind: 'prepare-initialize',
    input: {
      workspaceId: 'worker-workspace',
      documents: INITIAL_DOCUMENTS,
      identityCatalog: createStableIdentityCatalog('worker-workspace'),
      nonMarkdownPaths: ['image.png'],
    },
  };
}

describe('workspace worker transactional runtime', () => {
  it('prepares initialization without committing, then commits exactly once', () => {
    const target = runtime();
    const candidate = prepared(request(target, 1, initializePayload()));
    expect(candidate).toMatchObject({
      workspaceId: 'worker-workspace',
      fromRevision: null,
      toRevision: 0,
    });

    const beforeCommit = failure(
      request(target, 2, {
        kind: 'build-committed-report',
        input: { nonMarkdownPaths: [] },
      }),
    );
    expect(beforeCommit.code).toBe('not-initialized');

    expect(
      request(target, 3, {
        kind: 'commit-candidate',
        candidateId: candidate.candidateId,
      }),
    ).toMatchObject({ kind: 'candidate-committed', revision: 0 });
    expect(
      request(target, 4, {
        kind: 'build-committed-report',
        input: { nonMarkdownPaths: ['other.bin'] },
      }),
    ).toMatchObject({ kind: 'committed-report', revision: 0 });
  });

  it('discards initialization and preserves EMPTY state', () => {
    const target = runtime();
    const candidate = prepared(request(target, 1, initializePayload()));
    expect(
      request(target, 2, {
        kind: 'discard-candidate',
        candidateId: candidate.candidateId,
      }),
    ).toMatchObject({ kind: 'candidate-discarded', revision: null });
    expect(
      failure(
        request(target, 3, {
          kind: 'build-committed-report',
          input: { nonMarkdownPaths: [] },
        }),
      ).code,
    ).toBe('not-initialized');
  });

  it('rejects a second prepare, stale revisions, and wrong candidate IDs', () => {
    const target = runtime();
    const initial = prepared(request(target, 1, initializePayload()));
    expect(failure(request(target, 2, initializePayload())).code).toBe(
      'candidate-pending',
    );
    expect(
      failure(
        request(target, 3, {
          kind: 'commit-candidate',
          candidateId: 'wrong-candidate',
        }),
      ).code,
    ).toBe('candidate-mismatch');
    request(target, 4, {
      kind: 'commit-candidate',
      candidateId: initial.candidateId,
    });
    expect(
      failure(
        request(target, 5, {
          kind: 'prepare-changes',
          input: {
            expectedRevision: 9,
            changes: [{ kind: 'delete', path: 'B.md' }],
            nonMarkdownPaths: [],
          },
        }),
      ).code,
    ).toBe('stale-revision');
  });

  it('commits one change revision and discard leaves the committed revision unchanged', () => {
    const target = runtime();
    const initial = prepared(request(target, 1, initializePayload()));
    request(target, 2, {
      kind: 'commit-candidate',
      candidateId: initial.candidateId,
    });
    const changed = prepared(
      request(target, 3, {
        kind: 'prepare-changes',
        input: {
          expectedRevision: 0,
          changes: [{ kind: 'upsert', path: 'A.md', source: '# A changed' }],
          nonMarkdownPaths: [],
        },
      }),
    );
    expect(changed.toRevision).toBe(1);
    request(target, 4, {
      kind: 'discard-candidate',
      candidateId: changed.candidateId,
    });
    expect(
      request(target, 5, {
        kind: 'build-committed-report',
        input: { nonMarkdownPaths: [] },
      }),
    ).toMatchObject({ kind: 'committed-report', revision: 0 });

    const next = prepared(
      request(target, 6, {
        kind: 'prepare-changes',
        input: {
          expectedRevision: 0,
          changes: [{ kind: 'delete', path: 'B.md' }],
          nonMarkdownPaths: [],
        },
      }),
    );
    request(target, 7, {
      kind: 'commit-candidate',
      candidateId: next.candidateId,
    });
    expect(
      request(target, 8, {
        kind: 'build-committed-report',
        input: { nonMarkdownPaths: [] },
      }),
    ).toMatchObject({ kind: 'committed-report', revision: 1 });
  });

  it('uses the committed catalog for resync and keeps protocol revision monotonic', () => {
    const target = runtime();
    const initial = prepared(request(target, 1, initializePayload()));
    request(target, 2, {
      kind: 'commit-candidate',
      candidateId: initial.candidateId,
    });
    const resynced = prepared(
      request(target, 3, {
        kind: 'prepare-resync',
        input: {
          documents: [...INITIAL_DOCUMENTS, { path: 'C.md', source: '# C' }],
          nonMarkdownPaths: [],
        },
      }),
    );
    expect(resynced).toMatchObject({ fromRevision: 0, toRevision: 1 });
    expect(resynced.identitySummary.documents.reusedExact).toBe(2);
  });

  it('serializes KG10 input failures and diagnostics failures without a candidate', () => {
    const target = runtime();
    const initial = prepared(request(target, 1, initializePayload()));
    request(target, 2, {
      kind: 'commit-candidate',
      candidateId: initial.candidateId,
    });
    const workspaceFailure = failure(
      request(target, 3, {
        kind: 'prepare-changes',
        input: {
          expectedRevision: 0,
          changes: [{ kind: 'delete', path: 'missing.md' }],
          nonMarkdownPaths: [],
        },
      }),
    );
    expect(workspaceFailure).toMatchObject({
      category: 'workspace',
      stage: 'input',
    });

    const diagnosticsTarget = runtime({
      buildReport: () => {
        throw new Error('injected diagnostics fault');
      },
    });
    expect(
      failure(request(diagnosticsTarget, 1, initializePayload())),
    ).toMatchObject({
      category: 'diagnostics',
      code: 'diagnostic-construction-failed',
    });
    expect(
      failure(
        request(diagnosticsTarget, 2, {
          kind: 'discard-candidate',
          candidateId: 'candidate-1',
        }),
      ).code,
    ).toBe('candidate-mismatch');
  });

  it('uses plain structured-cloneable payloads and does not expose worker-owned state', () => {
    const target = runtime();
    const clonedRequest = structuredClone({
      ...initializePayload(),
      protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
      requestId: 'clone-request',
    });
    const response = target.handle(clonedRequest);
    expect(isWorkspaceWorkerResponse(response)).toBe(true);
    const clone = structuredClone(response);
    expect(clone).toEqual(response);
    const assembler = createWorkspaceWorkerResponseAssembler();
    let assembled: WorkspaceWorkerResponse | undefined;
    for (const frame of chunkWorkspaceWorkerResponse(response, {
      chunkSize: 1,
      threshold: 1,
    })) {
      const result = assembler.accept(structuredClone(frame));
      if (result.status === 'complete') assembled = result.response;
    }
    expect(assembled).toEqual(response);
    const requestAssembler = createWorkspaceWorkerRequestAssembler();
    let assembledRequest: unknown;
    for (const frame of chunkWorkspaceWorkerRequest(clonedRequest, {
      chunkSize: 1,
      threshold: 1,
    })) {
      const result = requestAssembler.accept(structuredClone(frame));
      if (result.status === 'complete') assembledRequest = result.request;
    }
    expect(assembledRequest).toEqual(clonedRequest);
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain('parsedDocuments');
    expect(serialized).not.toContain('reparsedPaths');
    expect(serialized).not.toContain('"engine"');
  });

  it('matches the direct KG10 + diagnostics output for initialize, edit, add, move, delete, resync, and non-Markdown reporting', async () => {
    const catalog = createStableIdentityCatalog('worker-workspace');
    const processor = createInProcessWorkspaceProcessor(runtime());
    let worker = await processor.prepareInitialize({
      workspaceId: 'worker-workspace',
      documents: INITIAL_DOCUMENTS,
      identityCatalog: catalog,
      nonMarkdownPaths: ['image.png'],
    });
    const directInitial = initializeObsidianWorkspaceEngine({
      workspaceId: 'worker-workspace',
      documents: INITIAL_DOCUMENTS,
      identityCatalog: catalog,
    });
    if (!directInitial.ok) throw new Error(directInitial.failure.message);
    expect(worker.report).toEqual(
      buildObsidianDiagnosticReport({
        snapshot: directInitial.snapshot,
        diagnostics: directInitial.resolutionDiagnostics,
        documents: directInitial.engine.parsedDocuments(),
        nonMarkdownPaths: ['image.png'],
        identity: { stability: 'stable' },
      }),
    );
    expect(worker.nextIdentityCatalog).toEqual(directInitial.identityCatalog);
    await processor.commitCandidate(worker.candidateId);

    const changes = [
      { kind: 'upsert', path: 'A.md', source: '# A edited\n[[C]]' },
      { kind: 'upsert', path: 'C.md', source: '# C' },
      { kind: 'move', fromPath: 'B.md', toPath: 'Moved/B.md' },
      { kind: 'delete', path: 'Moved/B.md' },
    ] as const;
    let directEngine = directInitial.engine;
    let revision = 0;
    for (const change of changes) {
      worker = await processor.prepareChanges({
        expectedRevision: revision,
        changes: [change],
        nonMarkdownPaths: [],
      });
      const direct = applyObsidianWorkspaceChanges(directEngine, [change]);
      if (!direct.ok) throw new Error(direct.failure.message);
      expect(worker.report.snapshot).toEqual(direct.snapshot);
      expect(worker.nextIdentityCatalog).toEqual(direct.identityCatalog);
      await processor.commitCandidate(worker.candidateId);
      directEngine = direct.engine;
      revision += 1;
    }

    const diagnosticOnly = await processor.buildCommittedReport({
      nonMarkdownPaths: ['asset.png'],
    });
    expect(diagnosticOnly.revision).toBe(revision);
    expect(diagnosticOnly.report.sourceInventory.nonMarkdownFileCount).toBe(1);

    const resyncDocuments = [
      { path: 'A.md', source: '# A resynced' },
      { path: 'D.md', source: '# D' },
    ] as const;
    worker = await processor.prepareResync({
      documents: resyncDocuments,
      nonMarkdownPaths: [],
    });
    const directResync = initializeObsidianWorkspaceEngine({
      workspaceId: 'worker-workspace',
      documents: resyncDocuments,
      identityCatalog: directEngine.identityCatalog,
    });
    if (!directResync.ok) throw new Error(directResync.failure.message);
    expect(worker.report.snapshot).toEqual(directResync.snapshot);
    expect(worker.nextIdentityCatalog).toEqual(directResync.identityCatalog);
  });

  it('turns in-process termination into a distinguishable failure', async () => {
    const processor = createInProcessWorkspaceProcessor(runtime());
    processor.terminate();
    await expect(
      processor.prepareInitialize({
        workspaceId: 'worker-workspace',
        documents: INITIAL_DOCUMENTS,
        identityCatalog: createStableIdentityCatalog('worker-workspace'),
        nonMarkdownPaths: [],
      }),
    ).rejects.toMatchObject({
      category: 'terminated',
      code: 'processor-terminated',
    } satisfies Partial<WorkspaceProcessorError>);
  });
});
