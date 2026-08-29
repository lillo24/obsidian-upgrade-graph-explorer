import type { ObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import type {
  PrepareWorkspaceIdentityOptions,
  TauriSourceProvider,
  VaultSelection,
  VaultSourceChange,
  VaultSourceInventory,
  VaultWatchBatch,
  VaultWatchSubscription,
} from '@icarus-graph-explorer/source-provider-tauri';
import {
  WorkspaceProcessorError,
  type PreparedWorkspaceResult,
  type WorkspaceWorkerTimings,
} from '@icarus-graph-explorer/workspace-worker';

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
  readonly workerComputeMs: number;
  readonly workerRoundTripMs: number;
  readonly mainThreadHighGapMs: number;
  readonly identityPersistenceMs: number;
  readonly totalMs: number;
}

export interface DesktopLiveUpdateSummary {
  /** Runtime-only token joining live processing to the matching UI paint. */
  readonly correlationId: string;
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

export type DesktopLiveVaultServices = DesktopVaultServices;

const DEFAULT_SERVICES: DesktopLiveVaultServices = {
  now: () => performance.now(),
  createProcessor: () => {
    throw new Error(
      'Desktop worker services were not initialized by openLiveDesktopVault.',
    );
  },
};

function elapsed(start: number, services: DesktopLiveVaultServices): number {
  return Number((services.now() - start).toFixed(3));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function initialTimings(): DesktopLiveUpdateTimings {
  return {
    sourceReconciliationMs: 0,
    workspaceUpdateMs: 0,
    diagnosticConstructionMs: 0,
    workerComputeMs: 0,
    workerRoundTripMs: 0,
    mainThreadHighGapMs: 0,
    identityPersistenceMs: 0,
    totalMs: 0,
  };
}

function workerTimings(timings: WorkspaceWorkerTimings) {
  return {
    workspaceUpdateMs: timings.workspaceUpdateMs,
    diagnosticConstructionMs: timings.diagnosticConstructionMs,
    workerComputeMs: timings.workerComputeMs,
    workerRoundTripMs: timings.workerRoundTripMs ?? timings.workerComputeMs,
    mainThreadHighGapMs: timings.mainThreadHighGapMs ?? 0,
  };
}

function engineChanges(changes: readonly VaultSourceChange[]) {
  return changes.map((change) => ({ ...change }));
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
  let correlationSequence = 0;
  let lastDurableIdentityCatalog = input.opened.runtime.durableIdentityCatalog;

  function nextCorrelationId(): string {
    correlationSequence += 1;
    return `live-${correlationSequence}`;
  }

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

  function adopt(inputState: {
    readonly runtime: DesktopVaultRuntime;
    readonly report: ObsidianDiagnosticReport;
    readonly kind: DesktopLiveUpdateKind;
    readonly affectedPathCount: number;
    readonly timings: DesktopLiveUpdateTimings;
    readonly totalStart: number;
  }): void {
    if (disposed) return;
    current = {
      phase: bootstrapping ? 'catching-up' : 'live',
      dirty: pendingBatches > 1,
      message: bootstrapping
        ? 'Catching up with changes observed while the vault opened.'
        : 'Live vault updates are active.',
      report: inputState.report,
      runtime: inputState.runtime,
      lastUpdate: {
        correlationId: nextCorrelationId(),
        kind: inputState.kind,
        affectedPathCount: inputState.affectedPathCount,
        timings: {
          ...inputState.timings,
          totalMs: elapsed(inputState.totalStart, input.services),
        },
      },
    };
    for (const listener of listeners) listener(current);
  }

  async function prepareReplacement(
    inventory: VaultSourceInventory,
    durableCatalog: DesktopVaultRuntime['durableIdentityCatalog'],
  ): Promise<{
    readonly prepared: PreparedWorkspaceResult;
    readonly runtime: DesktopVaultRuntime;
    readonly identityPersistenceMs: number;
  }> {
    const previousProcessor = current.runtime.processor;
    previousProcessor.terminate();
    const processor = input.services.createProcessor();
    try {
      const prepared = await processor.prepareInitialize({
        workspaceId: current.runtime.workspaceId,
        documents: inventory.markdownDocuments,
        identityCatalog: durableCatalog,
        nonMarkdownPaths: inventory.nonMarkdownPaths,
      });
      const persistenceStart = input.services.now();
      await input.sourceProvider.commitWorkspaceIdentity(
        current.runtime.identitySession,
        prepared.nextIdentityCatalog,
      );
      lastDurableIdentityCatalog = prepared.nextIdentityCatalog;
      const identityPersistenceMs = elapsed(persistenceStart, input.services);
      await processor.commitCandidate(prepared.candidateId);
      return {
        prepared,
        identityPersistenceMs,
        runtime: {
          ...current.runtime,
          inventory,
          revision: prepared.toRevision,
          durableIdentityCatalog: prepared.nextIdentityCatalog,
          processor,
        },
      };
    } catch (error: unknown) {
      processor.terminate();
      throw error;
    }
  }

  async function recoverAfterCommitFailure(inputState: {
    readonly durableCatalog: DesktopVaultRuntime['durableIdentityCatalog'];
    readonly totalStart: number;
    readonly affectedPathCount: number;
  }): Promise<void> {
    publish({
      phase: 'resyncing',
      dirty: true,
      message:
        'The worker stopped after identity was saved. Rebuilding from the current vault.',
    });
    const sourceStart = input.services.now();
    const inventory = await input.sourceProvider.discoverSelectedVault(
      current.runtime.selection,
    );
    const sourceReconciliationMs = elapsed(sourceStart, input.services);
    if (disposed) return;
    const replacement = await prepareReplacement(
      inventory,
      inputState.durableCatalog,
    );
    adopt({
      runtime: replacement.runtime,
      report: replacement.prepared.report,
      kind: 'full-resync',
      affectedPathCount: inputState.affectedPathCount,
      timings: {
        ...initialTimings(),
        sourceReconciliationMs,
        ...workerTimings(replacement.prepared.timings),
        identityPersistenceMs: replacement.identityPersistenceMs,
      },
      totalStart: inputState.totalStart,
    });
  }

  async function persistCommitAndAdopt(inputState: {
    readonly prepared: PreparedWorkspaceResult;
    readonly inventory: VaultSourceInventory;
    readonly kind: 'incremental' | 'full-resync';
    readonly affectedPathCount: number;
    readonly timings: DesktopLiveUpdateTimings;
    readonly totalStart: number;
  }): Promise<void> {
    const persistenceStart = input.services.now();
    try {
      await input.sourceProvider.commitWorkspaceIdentity(
        current.runtime.identitySession,
        inputState.prepared.nextIdentityCatalog,
      );
      lastDurableIdentityCatalog = inputState.prepared.nextIdentityCatalog;
    } catch (error: unknown) {
      try {
        await current.runtime.processor.discardCandidate(
          inputState.prepared.candidateId,
        );
      } catch {
        current.runtime.processor.terminate();
      }
      throw error;
    }
    const identityPersistenceMs = elapsed(persistenceStart, input.services);
    if (disposed) return;
    try {
      await current.runtime.processor.commitCandidate(
        inputState.prepared.candidateId,
      );
    } catch {
      await recoverAfterCommitFailure({
        durableCatalog: lastDurableIdentityCatalog,
        totalStart: inputState.totalStart,
        affectedPathCount: inputState.affectedPathCount,
      });
      return;
    }
    if (disposed) return;
    adopt({
      runtime: {
        ...current.runtime,
        inventory: inputState.inventory,
        revision: inputState.prepared.toRevision,
        durableIdentityCatalog: inputState.prepared.nextIdentityCatalog,
      },
      report: inputState.prepared.report,
      kind: inputState.kind,
      affectedPathCount: inputState.affectedPathCount,
      timings: {
        ...inputState.timings,
        identityPersistenceMs,
      },
      totalStart: inputState.totalStart,
    });
  }

  async function prepareHealthyResync(inventory: VaultSourceInventory): Promise<
    | { readonly kind: 'current'; readonly prepared: PreparedWorkspaceResult }
    | {
        readonly kind: 'replacement';
        readonly prepared: PreparedWorkspaceResult;
        readonly runtime: DesktopVaultRuntime;
        readonly identityPersistenceMs: number;
      }
  > {
    try {
      return {
        kind: 'current',
        prepared: await current.runtime.processor.prepareResync({
          documents: inventory.markdownDocuments,
          nonMarkdownPaths: inventory.nonMarkdownPaths,
        }),
      };
    } catch (error: unknown) {
      if (
        !(error instanceof WorkspaceProcessorError) ||
        (error.category !== 'transport' && error.category !== 'terminated')
      ) {
        throw error;
      }
      const replacement = await prepareReplacement(
        inventory,
        lastDurableIdentityCatalog,
      );
      return { kind: 'replacement', ...replacement };
    }
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
    const result = await prepareHealthyResync(inventory);
    if (result.kind === 'replacement') {
      adopt({
        runtime: result.runtime,
        report: result.prepared.report,
        kind: 'full-resync',
        affectedPathCount,
        timings: {
          ...initialTimings(),
          sourceReconciliationMs,
          ...workerTimings(result.prepared.timings),
          identityPersistenceMs: result.identityPersistenceMs,
        },
        totalStart,
      });
      return;
    }
    await persistCommitAndAdopt({
      prepared: result.prepared,
      inventory,
      kind: 'full-resync',
      affectedPathCount,
      timings: {
        ...initialTimings(),
        sourceReconciliationMs,
        ...workerTimings(result.prepared.timings),
      },
      totalStart,
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
      publish({
        phase: bootstrapping ? 'catching-up' : 'live',
        dirty: pendingBatches > 1,
        message: bootstrapping
          ? 'Catching up with changes observed while the vault opened.'
          : 'Live vault updates are active.',
        lastUpdate: {
          correlationId: nextCorrelationId(),
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
      const built = await current.runtime.processor.buildCommittedReport({
        nonMarkdownPaths: plan.nextInventory.nonMarkdownPaths,
      });
      if (built.revision !== current.runtime.revision) {
        throw new Error(
          `Diagnostic worker revision changed unexpectedly: expected ${current.runtime.revision}, received ${built.revision}.`,
        );
      }
      adopt({
        runtime: { ...current.runtime, inventory: plan.nextInventory },
        report: built.report,
        kind: 'non-markdown',
        affectedPathCount: plan.affectedPaths.length,
        timings: {
          ...baseTimings,
          ...workerTimings(built.timings),
        },
        totalStart,
      });
      return;
    }

    let prepared: PreparedWorkspaceResult;
    try {
      prepared = await current.runtime.processor.prepareChanges({
        expectedRevision: current.runtime.revision,
        changes: engineChanges(plan.markdownChanges),
        nonMarkdownPaths: plan.nextInventory.nonMarkdownPaths,
      });
    } catch (error: unknown) {
      if (
        error instanceof WorkspaceProcessorError &&
        error.category === 'workspace' &&
        error.stage === 'input'
      ) {
        await fullResync(
          `incremental input was rejected (${error.message})`,
          plan.affectedPaths.length,
        );
        return;
      }
      throw error;
    }
    await persistCommitAndAdopt({
      prepared,
      inventory: plan.nextInventory,
      kind: 'incremental',
      affectedPathCount: plan.affectedPaths.length,
      timings: {
        ...baseTimings,
        ...workerTimings(prepared.timings),
      },
      totalStart,
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
      current.runtime.processor.terminate();
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
 * Starts native watching before source acquisition so no startup edit can fall
 * between discovery and subscription. The local-vault path then creates its
 * dedicated processor; browser Sample/Open Report paths never reach this code.
 */
export async function openLiveDesktopVault(
  sourceProvider: TauriSourceProvider,
  selection: VaultSelection,
  identityOptions: PrepareWorkspaceIdentityOptions = {},
  services?: DesktopLiveVaultServices,
): Promise<OpenLiveDesktopVaultResult> {
  const resolvedServices =
    services ??
    ({
      ...DEFAULT_SERVICES,
      createProcessor: (await import('./workers/workspace-worker-client'))
        .createDesktopWorkspaceProcessor,
    } satisfies DesktopLiveVaultServices);
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
      resolvedServices,
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
    services: resolvedServices,
  });
  batchSink.accept = controller.acceptWatchBatch;
  return { opened, controller };
}
