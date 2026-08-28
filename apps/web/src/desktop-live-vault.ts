import {
  buildObsidianDiagnosticReport,
  type ObsidianDiagnosticReport,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import type {
  PrepareWorkspaceIdentityOptions,
  TauriSourceProvider,
  VaultSelection,
  VaultSourceChange,
  VaultWatchBatch,
  VaultWatchSubscription,
} from '@icarus-graph-explorer/source-provider-tauri';
import {
  applyObsidianWorkspaceChanges,
  initializeObsidianWorkspaceEngine,
  type ApplyObsidianWorkspaceChangesResult,
  type ObsidianWorkspaceEngine,
  type WorkspaceSourceChange,
} from '@icarus-graph-explorer/workspace-engine-obsidian';

import {
  DesktopVaultOpenError,
  openSelectedDesktopVault,
  type DesktopVaultRuntime,
  type DesktopVaultServices,
  type OpenedDesktopVault,
} from './desktop-vault';

export type DesktopLiveVaultPhase =
  'catching-up' | 'live' | 'updating' | 'resyncing' | 'paused';

export type DesktopLiveUpdateKind =
  'incremental' | 'non-markdown' | 'no-op' | 'full-resync';

export interface DesktopLiveUpdateTimings {
  readonly sourceReconciliationMs: number;
  readonly workspaceUpdateMs: number;
  readonly diagnosticConstructionMs: number;
  readonly identityPersistenceMs: number;
  readonly totalMs: number;
}

export interface DesktopLiveUpdateSummary {
  readonly kind: DesktopLiveUpdateKind;
  readonly affectedPathCount: number;
  readonly timings: DesktopLiveUpdateTimings;
}

export interface DesktopLiveVaultSnapshot {
  readonly phase: DesktopLiveVaultPhase;
  readonly dirty: boolean;
  readonly message: string;
  readonly report: ObsidianDiagnosticReport;
  readonly runtime: DesktopVaultRuntime;
  readonly lastUpdate?: DesktopLiveUpdateSummary;
}

export interface DesktopLiveVaultController {
  snapshot(): DesktopLiveVaultSnapshot;
  subscribe(listener: (snapshot: DesktopLiveVaultSnapshot) => void): () => void;
  acceptWatchBatch(batch: VaultWatchBatch): void;
  rescan(): Promise<void>;
  whenIdle(): Promise<void>;
  stop(): Promise<void>;
}

export interface OpenLiveDesktopVaultResult {
  readonly opened: OpenedDesktopVault;
  /** Missing when the one-shot open could not persist stable identity. */
  readonly controller?: DesktopLiveVaultController;
}

export interface DesktopLiveVaultServices extends DesktopVaultServices {
  readonly applyChanges: typeof applyObsidianWorkspaceChanges;
}

const DEFAULT_SERVICES: DesktopLiveVaultServices = {
  now: () => performance.now(),
  initializeEngine: initializeObsidianWorkspaceEngine,
  applyChanges: applyObsidianWorkspaceChanges,
  buildReport: buildObsidianDiagnosticReport,
};

function elapsed(start: number, services: DesktopLiveVaultServices): number {
  return Number((services.now() - start).toFixed(3));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildStableReport(
  engine: ObsidianWorkspaceEngine,
  nonMarkdownPaths: DesktopVaultRuntime['inventory']['nonMarkdownPaths'],
  services: DesktopLiveVaultServices,
): ObsidianDiagnosticReport {
  return services.buildReport({
    snapshot: engine.snapshot,
    diagnostics: engine.resolutionDiagnostics,
    documents: engine.parsedDocuments(),
    nonMarkdownPaths,
    identity: { stability: 'stable' },
  });
}

function engineChanges(
  changes: readonly VaultSourceChange[],
): readonly WorkspaceSourceChange[] {
  return changes.map((change) => ({ ...change }));
}

function initialTimings(): DesktopLiveUpdateTimings {
  return {
    sourceReconciliationMs: 0,
    workspaceUpdateMs: 0,
    diagnosticConstructionMs: 0,
    identityPersistenceMs: 0,
    totalMs: 0,
  };
}

function failedEngineMessage(
  result: Extract<ApplyObsidianWorkspaceChangesResult, { readonly ok: false }>,
): string {
  return `Workspace update failed at ${result.failure.stage}: ${result.failure.message}`;
}

function createController(input: {
  readonly sourceProvider: TauriSourceProvider;
  readonly opened: OpenedDesktopVault;
  readonly subscription: VaultWatchSubscription;
  readonly bufferedBatches: readonly VaultWatchBatch[];
  readonly services: DesktopLiveVaultServices;
}): DesktopLiveVaultController {
  const listeners = new Set<(snapshot: DesktopLiveVaultSnapshot) => void>();
  let current: DesktopLiveVaultSnapshot = {
    phase: 'catching-up',
    dirty: input.bufferedBatches.length > 0,
    message:
      input.bufferedBatches.length > 0
        ? 'Catching up with changes observed while the vault opened.'
        : 'Preparing live vault updates.',
    report: input.opened.report,
    runtime: input.opened.runtime,
  };
  let disposed = false;
  let bootstrapping = true;
  let pendingBatches = 0;
  let queue: Promise<void> = Promise.resolve();
  let stopPromise: Promise<void> | undefined;

  function publish(update: Partial<DesktopLiveVaultSnapshot>): void {
    if (disposed) return;
    current = { ...current, ...update };
    for (const listener of listeners) listener(current);
  }

  function pause(reason: string): void {
    publish({
      phase: 'paused',
      dirty: true,
      message: `${reason} Live updates are paused; use Rescan to recover.`,
    });
  }

  function enqueue(task: () => Promise<void>): Promise<void> {
    const run = async () => {
      if (disposed) return;
      try {
        await task();
      } catch (error: unknown) {
        pause(`Live update failed: ${message(error)}`);
      }
    };
    queue = queue.then(run, run);
    return queue;
  }

  async function persistAndAdopt(inputState: {
    readonly runtime: DesktopVaultRuntime;
    readonly report: ObsidianDiagnosticReport;
    readonly kind: DesktopLiveUpdateKind;
    readonly affectedPathCount: number;
    readonly timings: DesktopLiveUpdateTimings;
    readonly totalStart: number;
    readonly persistIdentity: boolean;
  }): Promise<void> {
    let identityPersistenceMs = 0;
    if (inputState.persistIdentity) {
      if (disposed) return;
      const persistenceStart = input.services.now();
      await input.sourceProvider.commitWorkspaceIdentity(
        inputState.runtime.identitySession,
        inputState.runtime.engine.identityCatalog,
      );
      identityPersistenceMs = elapsed(persistenceStart, input.services);
    }
    if (disposed) return;
    const timings: DesktopLiveUpdateTimings = {
      ...inputState.timings,
      identityPersistenceMs,
      totalMs: elapsed(inputState.totalStart, input.services),
    };
    current = {
      phase: bootstrapping ? 'catching-up' : 'live',
      dirty: pendingBatches > 1,
      message: bootstrapping
        ? 'Catching up with changes observed while the vault opened.'
        : 'Live vault updates are active.',
      report: inputState.report,
      runtime: inputState.runtime,
      lastUpdate: {
        kind: inputState.kind,
        affectedPathCount: inputState.affectedPathCount,
        timings,
      },
    };
    for (const listener of listeners) listener(current);
  }

  async function fullResync(
    reason: string,
    affectedPathCount: number,
  ): Promise<void> {
    const totalStart = input.services.now();
    publish({
      phase: 'resyncing',
      dirty: true,
      message: `Resyncing the full vault: ${reason}`,
    });
    const sourceStart = input.services.now();
    const inventory = await input.sourceProvider.discoverSelectedVault(
      current.runtime.selection,
    );
    const sourceReconciliationMs = elapsed(sourceStart, input.services);
    if (disposed) return;

    const workspaceStart = input.services.now();
    const initialized = input.services.initializeEngine({
      workspaceId: current.runtime.engine.workspaceId,
      documents: inventory.markdownDocuments,
      identityCatalog: current.runtime.engine.identityCatalog,
    });
    const workspaceUpdateMs = elapsed(workspaceStart, input.services);
    if (!initialized.ok) {
      throw new Error(
        `Full resync failed at ${initialized.failure.stage}: ${initialized.failure.message}`,
      );
    }
    const candidateRuntime: DesktopVaultRuntime = {
      ...current.runtime,
      inventory,
      engine: initialized.engine,
    };
    const diagnosticStart = input.services.now();
    const report = buildStableReport(
      initialized.engine,
      inventory.nonMarkdownPaths,
      input.services,
    );
    const diagnosticConstructionMs = elapsed(diagnosticStart, input.services);
    await persistAndAdopt({
      runtime: candidateRuntime,
      report,
      kind: 'full-resync',
      affectedPathCount,
      timings: {
        ...initialTimings(),
        sourceReconciliationMs,
        workspaceUpdateMs,
        diagnosticConstructionMs,
      },
      totalStart,
      persistIdentity: true,
    });
  }

  async function processBatch(batch: VaultWatchBatch): Promise<void> {
    if (current.phase === 'paused') return;
    const totalStart = input.services.now();
    publish({
      phase: bootstrapping ? 'catching-up' : 'updating',
      dirty: true,
      message: bootstrapping
        ? 'Catching up with changes observed while the vault opened.'
        : 'Applying vault changes.',
    });
    const sourceStart = input.services.now();
    const reconciliation =
      await input.sourceProvider.reconcileSelectedVaultChanges({
        selection: current.runtime.selection,
        previousInventory: current.runtime.inventory,
        watchBatch: batch,
      });
    const sourceReconciliationMs = elapsed(sourceStart, input.services);
    if (disposed) return;
    if (reconciliation.status === 'resync-required') {
      await fullResync(
        reconciliation.reason,
        reconciliation.affectedPaths.length,
      );
      return;
    }

    const { plan } = reconciliation;
    const baseTimings: DesktopLiveUpdateTimings = {
      ...initialTimings(),
      sourceReconciliationMs,
    };
    if (plan.markdownChanges.length === 0 && !plan.nonMarkdownChanged) {
      if (disposed) return;
      publish({
        phase: bootstrapping ? 'catching-up' : 'live',
        dirty: pendingBatches > 1,
        message: bootstrapping
          ? 'Catching up with changes observed while the vault opened.'
          : 'Live vault updates are active.',
        lastUpdate: {
          kind: 'no-op',
          affectedPathCount: plan.affectedPaths.length,
          timings: {
            ...baseTimings,
            totalMs: elapsed(totalStart, input.services),
          },
        },
      });
      return;
    }

    if (plan.markdownChanges.length === 0) {
      const diagnosticStart = input.services.now();
      const report = buildStableReport(
        current.runtime.engine,
        plan.nextInventory.nonMarkdownPaths,
        input.services,
      );
      const diagnosticConstructionMs = elapsed(diagnosticStart, input.services);
      await persistAndAdopt({
        runtime: { ...current.runtime, inventory: plan.nextInventory },
        report,
        kind: 'non-markdown',
        affectedPathCount: plan.affectedPaths.length,
        timings: { ...baseTimings, diagnosticConstructionMs },
        totalStart,
        persistIdentity: false,
      });
      return;
    }

    const workspaceStart = input.services.now();
    const applied = input.services.applyChanges(
      current.runtime.engine,
      engineChanges(plan.markdownChanges),
    );
    const workspaceUpdateMs = elapsed(workspaceStart, input.services);
    if (!applied.ok) {
      if (applied.failure.stage === 'input') {
        await fullResync(
          `incremental input was rejected (${applied.failure.message})`,
          plan.affectedPaths.length,
        );
        return;
      }
      throw new Error(failedEngineMessage(applied));
    }
    const candidateRuntime: DesktopVaultRuntime = {
      ...current.runtime,
      inventory: plan.nextInventory,
      engine: applied.engine,
    };
    const diagnosticStart = input.services.now();
    const report = buildStableReport(
      applied.engine,
      plan.nextInventory.nonMarkdownPaths,
      input.services,
    );
    const diagnosticConstructionMs = elapsed(diagnosticStart, input.services);
    await persistAndAdopt({
      runtime: candidateRuntime,
      report,
      kind: 'incremental',
      affectedPathCount: plan.affectedPaths.length,
      timings: {
        ...baseTimings,
        workspaceUpdateMs,
        diagnosticConstructionMs,
      },
      totalStart,
      persistIdentity: true,
    });
  }

  function acceptWatchBatch(batch: VaultWatchBatch): void {
    if (disposed) return;
    if (current.phase === 'paused') {
      publish({ dirty: true });
      return;
    }
    pendingBatches += 1;
    publish({ dirty: true });
    void enqueue(async () => {
      try {
        await processBatch(batch);
      } finally {
        pendingBatches -= 1;
      }
    });
  }

  const controller: DesktopLiveVaultController = {
    snapshot: () => current,
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    acceptWatchBatch,
    rescan() {
      return enqueue(async () => {
        await fullResync('manual request', 0);
      });
    },
    whenIdle: () => queue,
    stop() {
      if (stopPromise !== undefined) return stopPromise;
      disposed = true;
      listeners.clear();
      stopPromise = input.subscription.stop();
      return stopPromise;
    },
  };

  for (const batch of input.bufferedBatches) acceptWatchBatch(batch);
  void enqueue(async () => {
    bootstrapping = false;
    if (current.phase !== 'paused') {
      publish({
        phase: 'live',
        dirty: false,
        message: 'Live vault updates are active.',
      });
    }
  });

  return controller;
}

/**
 * Starts native watching before the one-shot open so no startup edit can fall
 * between acquisition and subscription. Buffered batches are then serialized
 * through the same controller queue used for later watch and manual work.
 */
export async function openLiveDesktopVault(
  sourceProvider: TauriSourceProvider,
  selection: VaultSelection,
  identityOptions: PrepareWorkspaceIdentityOptions = {},
  services: DesktopLiveVaultServices = DEFAULT_SERVICES,
): Promise<OpenLiveDesktopVaultResult> {
  const bufferedBatches: VaultWatchBatch[] = [];
  const batchSink: {
    accept?: DesktopLiveVaultController['acceptWatchBatch'];
  } = {};
  let subscription: VaultWatchSubscription;
  try {
    subscription = await sourceProvider.watchSelectedVault(
      selection,
      (batch) => {
        if (batchSink.accept === undefined) bufferedBatches.push(batch);
        else batchSink.accept(batch);
      },
    );
  } catch (error: unknown) {
    throw new DesktopVaultOpenError(
      `Could not start live vault watching: ${message(error)}`,
      selection,
      { cause: error },
    );
  }

  let opened: OpenedDesktopVault;
  try {
    opened = await openSelectedDesktopVault(
      sourceProvider,
      selection,
      identityOptions,
      services,
    );
  } catch (error: unknown) {
    await subscription.stop();
    throw error;
  }
  if (!opened.identityPersisted) {
    await subscription.stop();
    return { opened };
  }
  const controller = createController({
    sourceProvider,
    opened,
    subscription,
    bufferedBatches,
    services,
  });
  batchSink.accept = controller.acceptWatchBatch;
  return { opened, controller };
}
