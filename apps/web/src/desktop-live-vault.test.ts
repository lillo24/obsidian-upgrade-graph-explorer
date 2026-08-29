import {
  buildObsidianDiagnosticReport,
  type ObsidianDiagnosticReport,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  type TauriSourceProvider,
  type VaultChangeReconciliationResult,
  type VaultSelection,
  type VaultSourceChange,
  type VaultSourceInventory,
  type VaultWatchBatch,
} from '@icarus-graph-explorer/source-provider-tauri';
import { createStableIdentityCatalog } from '@icarus-graph-explorer/stable-identity';
import {
  applyObsidianWorkspaceChanges,
  initializeObsidianWorkspaceEngine,
  type WorkspaceEngineFailureStage,
} from '@icarus-graph-explorer/workspace-engine-obsidian';
import {
  WORKSPACE_WORKER_PROTOCOL_VERSION,
  WorkspaceProcessorError,
  createInProcessWorkspaceProcessor,
  createWorkspaceWorkerRuntime,
  type DesktopWorkspaceProcessor,
} from '@icarus-graph-explorer/workspace-worker';
import { describe, expect, it } from 'vitest';

import {
  openLiveDesktopVault,
  type DesktopLiveVaultServices,
} from './desktop-live-vault';

const SELECTION: VaultSelection = {
  rootPath: 'C:/private/vault',
  displayName: 'vault',
};

const BATCH: VaultWatchBatch = {
  paths: ['A.md'],
  categories: ['modify'],
  requiresResync: false,
  reasons: [],
};

function inventory(
  source = '# A',
  nonMarkdownPaths: readonly string[] = [],
): VaultSourceInventory {
  return {
    markdownDocuments: [{ path: 'A.md', source }],
    nonMarkdownPaths,
  };
}

function planned(input: {
  readonly nextInventory: VaultSourceInventory;
  readonly markdownChanges?: readonly VaultSourceChange[];
  readonly nonMarkdownChanged?: boolean;
  readonly affectedPaths?: readonly string[];
}): VaultChangeReconciliationResult {
  return {
    status: 'planned',
    plan: {
      markdownChanges: input.markdownChanges ?? [],
      nextInventory: input.nextInventory,
      nonMarkdownChanged: input.nonMarkdownChanged ?? false,
      affectedPaths: input.affectedPaths ?? ['A.md'],
    },
  };
}

class FakeLiveProvider implements TauriSourceProvider {
  currentInventory = inventory();
  reconciliations: VaultChangeReconciliationResult[] = [];
  previousInventories: VaultSourceInventory[] = [];
  commits = 0;
  commitFailures = 0;
  discoverCalls = 0;
  reconcileCalls = 0;
  stopCalls = 0;
  discoverError: Error | undefined;
  onDiscover: ((call: number) => void | Promise<void>) | undefined;
  reconcileGate: Promise<void> | undefined;
  private listener:
    ((batch: VaultWatchBatch) => void | Promise<void>) | undefined;

  async selectVaultDirectory(): Promise<VaultSelection> {
    return SELECTION;
  }

  async discoverSelectedVault(): Promise<VaultSourceInventory> {
    this.discoverCalls += 1;
    await this.onDiscover?.(this.discoverCalls);
    if (this.discoverError !== undefined) throw this.discoverError;
    return this.currentInventory;
  }

  async watchSelectedVault(
    _selection: VaultSelection,
    listener: (batch: VaultWatchBatch) => void | Promise<void>,
  ) {
    this.listener = listener;
    return {
      stop: async () => {
        this.stopCalls += 1;
        this.listener = undefined;
      },
    };
  }

  async reconcileSelectedVaultChanges(input: {
    readonly previousInventory: VaultSourceInventory;
  }): Promise<VaultChangeReconciliationResult> {
    this.reconcileCalls += 1;
    this.previousInventories.push(input.previousInventory);
    await this.reconcileGate;
    const next = this.reconciliations.shift();
    if (next === undefined) throw new Error('Missing scripted reconciliation.');
    return next;
  }

  async loadOrPrepareWorkspaceIdentity() {
    return {
      selection: SELECTION,
      workspaceId: 'stable-workspace',
      catalog: createStableIdentityCatalog('stable-workspace'),
      association: 'existing' as const,
    };
  }

  async commitWorkspaceIdentity(): Promise<void> {
    this.commits += 1;
    if (this.commitFailures > 0) {
      this.commitFailures -= 1;
      throw new Error('private state unavailable');
    }
  }

  async emit(batch: VaultWatchBatch = BATCH): Promise<void> {
    await this.listener?.(batch);
  }
}

function liveServices(
  input: {
    readonly failReportCall?: number;
    readonly failApplyStage?: WorkspaceEngineFailureStage;
    readonly onApply?: () => void;
    readonly customizeProcessor?: (
      processor: DesktopWorkspaceProcessor,
      index: number,
    ) => DesktopWorkspaceProcessor;
  } = {},
): DesktopLiveVaultServices {
  let tick = 0;
  let reportCalls = 0;
  let processorCount = 0;
  return {
    now: () => (tick += 1),
    createProcessor() {
      processorCount += 1;
      const processor = createInProcessWorkspaceProcessor(
        createWorkspaceWorkerRuntime({
          now: () => (tick += 1),
          nextCandidateId: () => `candidate-${tick}`,
          initializeEngine: initializeObsidianWorkspaceEngine,
          applyChanges(engine, changes) {
            input.onApply?.();
            if (input.failApplyStage !== undefined) {
              return {
                ok: false,
                failure: {
                  stage: input.failApplyStage,
                  code: 'injected-failure',
                  message: 'injected engine failure',
                },
              };
            }
            return applyObsidianWorkspaceChanges(engine, changes);
          },
          buildReport(reportInput): ObsidianDiagnosticReport {
            reportCalls += 1;
            if (reportCalls === input.failReportCall) {
              throw new Error('report validation failed');
            }
            return buildObsidianDiagnosticReport(reportInput);
          },
        }),
      );
      return input.customizeProcessor?.(processor, processorCount) ?? processor;
    },
  };
}

async function openedController(
  provider: FakeLiveProvider,
  services = liveServices(),
) {
  const result = await openLiveDesktopVault(provider, SELECTION, {}, services);
  expect(result.controller).toBeDefined();
  const controller = result.controller!;
  await controller.whenIdle();
  return { ...result, controller };
}

describe('desktop live vault controller', () => {
  it('starts watching before discovery and drains bootstrap changes in order', async () => {
    const provider = new FakeLiveProvider();
    const changed = inventory('# A\n\n## Added');
    provider.reconciliations.push(
      planned({
        nextInventory: changed,
        markdownChanges: [
          { kind: 'upsert', path: 'A.md', source: '# A\n\n## Added' },
        ],
      }),
    );
    provider.onDiscover = async (call) => {
      if (call === 1) await provider.emit();
    };

    const { controller } = await openedController(provider);

    expect(provider.reconcileCalls).toBe(1);
    expect(controller.snapshot()).toMatchObject({
      phase: 'live',
      dirty: false,
      lastUpdate: { kind: 'incremental' },
    });
    expect(controller.snapshot().runtime.revision).toBe(1);
    expect(provider.commits).toBe(2);
    await controller.stop();
  });

  it('drains a bootstrap resync request before declaring the session live', async () => {
    const provider = new FakeLiveProvider();
    provider.reconciliations.push({
      status: 'resync-required',
      reason: 'startup overflow',
      affectedPaths: ['A.md'],
    });
    provider.onDiscover = async (call) => {
      if (call === 1) await provider.emit({ ...BATCH, requiresResync: true });
    };

    const { controller } = await openedController(provider);

    expect(provider.discoverCalls).toBe(2);
    expect(controller.snapshot()).toMatchObject({
      phase: 'live',
      lastUpdate: { kind: 'full-resync' },
    });
  });

  it('serializes consecutive watch batches against the last committed inventory', async () => {
    const provider = new FakeLiveProvider();
    const second = inventory('# A\n\n## Two');
    const third = inventory('# A\n\n## Three');
    provider.reconciliations.push(
      planned({
        nextInventory: second,
        markdownChanges: [
          { kind: 'upsert', path: 'A.md', source: '# A\n\n## Two' },
        ],
      }),
      planned({
        nextInventory: third,
        markdownChanges: [
          { kind: 'upsert', path: 'A.md', source: '# A\n\n## Three' },
        ],
      }),
    );
    const { controller } = await openedController(provider);

    await Promise.all([provider.emit(), provider.emit()]);
    await controller.whenIdle();

    expect(provider.previousInventories).toEqual([inventory(), second]);
    expect(controller.snapshot().runtime.inventory).toBe(third);
    expect(controller.snapshot().runtime.revision).toBe(2);
    expect(provider.commits).toBe(3);
  });

  it('adopts non-Markdown inventory without KG10 application or identity persistence', async () => {
    const provider = new FakeLiveProvider();
    const next = inventory('# A', ['image.png']);
    provider.reconciliations.push(
      planned({
        nextInventory: next,
        nonMarkdownChanged: true,
        affectedPaths: ['image.png'],
      }),
    );
    let applyCalls = 0;
    const { controller } = await openedController(
      provider,
      liveServices({ onApply: () => (applyCalls += 1) }),
    );
    const processor = controller.snapshot().runtime.processor;
    const revision = controller.snapshot().runtime.revision;

    await provider.emit({ ...BATCH, paths: ['image.png'] });
    await controller.whenIdle();

    expect(controller.snapshot().lastUpdate?.kind).toBe('non-markdown');
    expect(controller.snapshot().runtime.processor).toBe(processor);
    expect(controller.snapshot().runtime.revision).toBe(revision);
    expect(
      controller.snapshot().report.sourceInventory.nonMarkdownFileCount,
    ).toBe(1);
    expect(applyCalls).toBe(0);
    expect(provider.commits).toBe(1);
  });

  it('does not replace the visible report for a net no-op', async () => {
    const provider = new FakeLiveProvider();
    provider.reconciliations.push(planned({ nextInventory: inventory() }));
    const { controller } = await openedController(provider);
    const report = controller.snapshot().report;

    await provider.emit();
    await controller.whenIdle();

    expect(controller.snapshot().report).toBe(report);
    expect(controller.snapshot().lastUpdate?.kind).toBe('no-op');
    expect(provider.commits).toBe(1);
  });

  it('preserves committed state and pauses when identity persistence fails', async () => {
    const provider = new FakeLiveProvider();
    const changed = inventory('# A\n\n## Candidate');
    provider.reconciliations.push(
      planned({
        nextInventory: changed,
        markdownChanges: [
          {
            kind: 'upsert',
            path: 'A.md',
            source: '# A\n\n## Candidate',
          },
        ],
      }),
    );
    let discardCalls = 0;
    const { controller } = await openedController(
      provider,
      liveServices({
        customizeProcessor: (processor) => ({
          ...processor,
          async discardCandidate(candidateId) {
            discardCalls += 1;
            return processor.discardCandidate(candidateId);
          },
        }),
      }),
    );
    const committed = controller.snapshot();
    provider.currentInventory = changed;
    provider.commitFailures = 1;

    await provider.emit();
    await controller.whenIdle();

    expect(controller.snapshot()).toMatchObject({
      phase: 'paused',
      dirty: true,
    });
    expect(controller.snapshot().runtime).toBe(committed.runtime);
    expect(controller.snapshot().report).toBe(committed.report);
    expect(discardCalls).toBe(1);

    await controller.rescan();
    expect(controller.snapshot()).toMatchObject({
      phase: 'live',
      dirty: false,
      lastUpdate: { kind: 'full-resync' },
    });
    expect(controller.snapshot().runtime.workspaceId).toBe(
      committed.runtime.workspaceId,
    );
  });

  it('preserves committed state and recovers after diagnostic construction fails', async () => {
    const provider = new FakeLiveProvider();
    const changed = inventory('# A\n\n## Candidate');
    provider.currentInventory = changed;
    provider.reconciliations.push(
      planned({
        nextInventory: changed,
        markdownChanges: [
          {
            kind: 'upsert',
            path: 'A.md',
            source: '# A\n\n## Candidate',
          },
        ],
      }),
    );
    const { controller } = await openedController(
      provider,
      liveServices({ failReportCall: 2 }),
    );
    const committed = controller.snapshot();

    await provider.emit();
    await controller.whenIdle();

    expect(controller.snapshot().phase).toBe('paused');
    expect(controller.snapshot().runtime).toBe(committed.runtime);
    expect(controller.snapshot().report).toBe(committed.report);
    expect(provider.commits).toBe(1);
    await controller.rescan();
    expect(controller.snapshot().phase).toBe('live');
  });

  it('pauses without automatic retry after a non-input KG10 failure', async () => {
    const provider = new FakeLiveProvider();
    provider.reconciliations.push(
      planned({
        nextInventory: inventory('# Changed'),
        markdownChanges: [
          { kind: 'upsert', path: 'A.md', source: '# Changed' },
        ],
      }),
    );
    const { controller } = await openedController(
      provider,
      liveServices({ failApplyStage: 'identity' }),
    );
    const committed = controller.snapshot();

    await provider.emit();
    await controller.whenIdle();

    expect(controller.snapshot()).toMatchObject({
      phase: 'paused',
      dirty: true,
    });
    expect(controller.snapshot().report).toBe(committed.report);
    expect(controller.snapshot().runtime).toBe(committed.runtime);
    expect(provider.discoverCalls).toBe(1);
    expect(provider.commits).toBe(1);
  });

  it('rescans with a replacement worker after persistence succeeds but commit acknowledgement fails', async () => {
    const provider = new FakeLiveProvider();
    const changed = inventory('# A\n\n## Candidate');
    provider.currentInventory = changed;
    provider.reconciliations.push(
      planned({
        nextInventory: changed,
        markdownChanges: [
          {
            kind: 'upsert',
            path: 'A.md',
            source: '# A\n\n## Candidate',
          },
        ],
      }),
    );
    let firstCommitCalls = 0;
    let processors = 0;
    const services = liveServices({
      customizeProcessor: (processor, index) => {
        processors = Math.max(processors, index);
        if (index !== 1) return processor;
        return {
          ...processor,
          async commitCandidate(candidateId) {
            firstCommitCalls += 1;
            if (firstCommitCalls === 2) {
              processor.terminate();
              throw new WorkspaceProcessorError({
                protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
                requestId: 'injected',
                kind: 'failure',
                category: 'transport',
                code: 'worker-crashed',
                message: 'worker crashed before commit acknowledgement',
              });
            }
            return processor.commitCandidate(candidateId);
          },
        };
      },
    });
    const { controller } = await openedController(provider, services);
    const previousReport = controller.snapshot().report;

    await provider.emit();
    await controller.whenIdle();

    expect(controller.snapshot()).toMatchObject({
      phase: 'live',
      dirty: false,
      lastUpdate: { kind: 'full-resync' },
    });
    expect(controller.snapshot().report).not.toBe(previousReport);
    expect(processors).toBe(2);
    expect(provider.discoverCalls).toBe(2);
    expect(provider.commits).toBe(3);
  });

  it('pauses on worker transport failure and manual Rescan creates a replacement', async () => {
    const provider = new FakeLiveProvider();
    const changed = inventory('# Changed');
    provider.currentInventory = changed;
    provider.reconciliations.push(
      planned({
        nextInventory: changed,
        markdownChanges: [
          { kind: 'upsert', path: 'A.md', source: '# Changed' },
        ],
      }),
    );
    let processors = 0;
    const services = liveServices({
      customizeProcessor: (processor, index) => {
        processors = Math.max(processors, index);
        if (index !== 1) return processor;
        return {
          ...processor,
          async prepareChanges() {
            processor.terminate();
            throw new WorkspaceProcessorError({
              protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
              requestId: 'injected',
              kind: 'failure',
              category: 'transport',
              code: 'worker-crashed',
              message: 'worker transport failed',
            });
          },
        };
      },
    });
    const { controller } = await openedController(provider, services);
    const priorReport = controller.snapshot().report;

    await provider.emit();
    await controller.whenIdle();
    expect(controller.snapshot()).toMatchObject({
      phase: 'paused',
      dirty: true,
    });
    expect(controller.snapshot().report).toBe(priorReport);

    await controller.rescan();
    expect(controller.snapshot()).toMatchObject({
      phase: 'live',
      lastUpdate: { kind: 'full-resync' },
    });
    expect(processors).toBe(2);
  });

  it('automatically performs a full resync when the provider requires one', async () => {
    const provider = new FakeLiveProvider();
    provider.currentInventory = inventory('# Resynced');
    provider.reconciliations.push({
      status: 'resync-required',
      reason: 'native overflow',
      affectedPaths: ['A.md'],
    });
    const { controller } = await openedController(provider);
    const workspaceId = controller.snapshot().runtime.workspaceId;

    await provider.emit({ ...BATCH, requiresResync: true });
    await controller.whenIdle();

    expect(provider.discoverCalls).toBe(2);
    expect(controller.snapshot().lastUpdate?.kind).toBe('full-resync');
    expect(controller.snapshot().runtime.workspaceId).toBe(workspaceId);
    expect(provider.commits).toBe(2);
  });

  it('attempts one automatic full resync after a KG10 input rejection', async () => {
    const provider = new FakeLiveProvider();
    provider.currentInventory = inventory('# Resynced');
    provider.reconciliations.push(
      planned({
        nextInventory: provider.currentInventory,
        markdownChanges: [{ kind: 'delete', path: 'missing.md' }],
      }),
    );
    let applyCalls = 0;
    const { controller } = await openedController(
      provider,
      liveServices({ onApply: () => (applyCalls += 1) }),
    );

    await provider.emit();
    await controller.whenIdle();

    expect(applyCalls).toBe(1);
    expect(provider.discoverCalls).toBe(2);
    expect(controller.snapshot().lastUpdate?.kind).toBe('full-resync');
  });

  it('keeps watch input dirty while paused and routes recovery through manual rescan', async () => {
    const provider = new FakeLiveProvider();
    const changed = inventory('# Changed');
    provider.currentInventory = changed;
    provider.reconciliations.push(
      planned({
        nextInventory: changed,
        markdownChanges: [
          { kind: 'upsert', path: 'A.md', source: '# Changed' },
        ],
      }),
    );
    const { controller } = await openedController(provider);
    provider.commitFailures = 1;
    await provider.emit();
    await controller.whenIdle();
    const reconcileCalls = provider.reconcileCalls;

    await provider.emit();
    await controller.whenIdle();

    expect(provider.reconcileCalls).toBe(reconcileCalls);
    expect(controller.snapshot()).toMatchObject({
      phase: 'paused',
      dirty: true,
    });
    await controller.rescan();
    expect(controller.snapshot().phase).toBe('live');
  });

  it('keeps the prior report when manual rescan fails', async () => {
    const provider = new FakeLiveProvider();
    const changed = inventory('# Changed');
    provider.currentInventory = changed;
    provider.reconciliations.push(
      planned({
        nextInventory: changed,
        markdownChanges: [
          { kind: 'upsert', path: 'A.md', source: '# Changed' },
        ],
      }),
    );
    const { controller } = await openedController(provider);
    const report = controller.snapshot().report;
    provider.commitFailures = 1;
    await provider.emit();
    await controller.whenIdle();
    provider.discoverError = new Error('full scan denied');

    await controller.rescan();

    expect(controller.snapshot()).toMatchObject({
      phase: 'paused',
      dirty: true,
    });
    expect(controller.snapshot().report).toBe(report);
  });

  it('queues a watch event observed during resync and reconciles it afterward', async () => {
    const provider = new FakeLiveProvider();
    const resynced = inventory('# Resynced');
    provider.reconciliations.push(
      {
        status: 'resync-required',
        reason: 'native overflow',
        affectedPaths: ['A.md'],
      },
      planned({ nextInventory: resynced }),
    );
    let releaseResync!: () => void;
    let markResyncStarted!: () => void;
    const resyncStarted = new Promise<void>((resolve) => {
      markResyncStarted = resolve;
    });
    const resyncGate = new Promise<void>((resolve) => {
      releaseResync = resolve;
    });
    provider.onDiscover = async (call) => {
      if (call !== 2) return;
      markResyncStarted();
      await resyncGate;
    };
    const { controller } = await openedController(provider);
    provider.currentInventory = resynced;

    await provider.emit({ ...BATCH, requiresResync: true });
    await resyncStarted;
    await provider.emit();
    releaseResync();
    await controller.whenIdle();

    expect(provider.reconcileCalls).toBe(2);
    expect(provider.previousInventories[1]).toBe(resynced);
    expect(controller.snapshot().phase).toBe('live');
  });

  it('assigns a new runtime-only correlation token to every adopted batch', async () => {
    const provider = new FakeLiveProvider();
    provider.reconciliations.push(
      planned({ nextInventory: provider.currentInventory }),
      planned({ nextInventory: provider.currentInventory }),
    );
    const { controller } = await openedController(provider);

    await provider.emit();
    await controller.whenIdle();
    const first = controller.snapshot().lastUpdate?.correlationId;
    await provider.emit();
    await controller.whenIdle();
    const second = controller.snapshot().lastUpdate?.correlationId;

    expect(first).toBe('live-1');
    expect(second).toBe('live-2');
  });

  it('does not adopt an in-flight update after the controller is stopped', async () => {
    const provider = new FakeLiveProvider();
    const changed = inventory('# Changed');
    provider.reconciliations.push(
      planned({
        nextInventory: changed,
        markdownChanges: [
          { kind: 'upsert', path: 'A.md', source: '# Changed' },
        ],
      }),
    );
    let release!: () => void;
    provider.reconcileGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { controller } = await openedController(provider);
    const report = controller.snapshot().report;

    await provider.emit();
    await controller.stop();
    release();
    await controller.whenIdle();

    expect(controller.snapshot().report).toBe(report);
    expect(provider.commits).toBe(1);
    expect(provider.stopCalls).toBe(1);
  });

  it('stops the bootstrap watcher when opening fails or identity is transient', async () => {
    const failedProvider = new FakeLiveProvider();
    failedProvider.discoverError = new Error('vault unavailable');
    await expect(
      openLiveDesktopVault(failedProvider, SELECTION, {}, liveServices()),
    ).rejects.toThrow('vault unavailable');
    expect(failedProvider.stopCalls).toBe(1);

    const transientProvider = new FakeLiveProvider();
    transientProvider.commitFailures = 1;
    const transient = await openLiveDesktopVault(
      transientProvider,
      SELECTION,
      {},
      liveServices(),
    );
    expect(transient.opened.identityPersisted).toBe(false);
    expect(transient.controller).toBeUndefined();
    expect(transientProvider.stopCalls).toBe(1);
  });
});
