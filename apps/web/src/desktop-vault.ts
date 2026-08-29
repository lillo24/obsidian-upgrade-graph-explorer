import {
  validateObsidianDiagnosticReport,
  type ObsidianDiagnosticReport,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  RecoverableWorkspaceIdentityError,
  type PrepareWorkspaceIdentityOptions,
  type TauriSourceProvider,
  type VaultSelection,
  type VaultSourceInventory,
  type WorkspaceIdentityRecovery,
  type WorkspaceIdentitySession,
} from '@icarus-graph-explorer/source-provider-tauri';
import type { StableIdentityCatalog } from '@icarus-graph-explorer/stable-identity';
import {
  type DesktopWorkspaceProcessor,
  type DesktopWorkspaceProcessorFactory,
  type PreparedWorkspaceResult,
} from '@icarus-graph-explorer/workspace-worker';

import { createDesktopWorkspaceProcessor } from './workers/workspace-worker-client';

export interface DesktopVaultTimings {
  readonly sourceAcquisitionMs: number;
  readonly workspaceInitializationMs: number;
  readonly diagnosticConstructionMs: number;
  readonly workerComputeMs: number;
  readonly workerRoundTripMs: number;
  readonly mainThreadHighGapMs: number;
  readonly identityPersistenceMs: number;
}

export interface DesktopVaultIdentityCounts {
  readonly entitiesReused: number;
  readonly entitiesNew: number;
  readonly referencesReused: number;
  readonly referencesNew: number;
}

export interface DesktopVaultRuntime {
  readonly selection: VaultSelection;
  readonly inventory: VaultSourceInventory;
  readonly identitySession: WorkspaceIdentitySession;
  readonly workspaceId: string;
  readonly revision: number;
  /** Last catalog known to have completed app-local durable persistence. */
  readonly durableIdentityCatalog: StableIdentityCatalog;
  readonly processor: DesktopWorkspaceProcessor;
}

export interface OpenedDesktopVault {
  readonly status: 'opened';
  readonly displayName: string;
  readonly report: ObsidianDiagnosticReport;
  readonly identityPersisted: boolean;
  readonly warning?: string;
  readonly previousWorkspaceId?: string;
  readonly timings: DesktopVaultTimings;
  readonly identityCounts: DesktopVaultIdentityCounts;
  readonly runtime: DesktopVaultRuntime;
}

export type SelectAndOpenDesktopVaultResult =
  { readonly status: 'cancelled' } | OpenedDesktopVault;

export class DesktopVaultOpenError extends Error {
  readonly selection: VaultSelection;
  readonly recovery?: WorkspaceIdentityRecovery;

  constructor(
    message: string,
    selection: VaultSelection,
    options?: {
      readonly cause?: unknown;
      readonly recovery?: WorkspaceIdentityRecovery;
    },
  ) {
    super(
      message,
      options?.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = 'DesktopVaultOpenError';
    this.selection = selection;
    if (options?.recovery !== undefined) this.recovery = options.recovery;
  }
}

export interface DesktopVaultServices {
  readonly now: () => number;
  readonly createProcessor: DesktopWorkspaceProcessorFactory;
}

const DEFAULT_SERVICES: DesktopVaultServices = {
  now: () => performance.now(),
  createProcessor: createDesktopWorkspaceProcessor,
};

function elapsed(start: number, services: DesktopVaultServices): number {
  return Number((services.now() - start).toFixed(3));
}

function identityCounts(
  result: PreparedWorkspaceResult,
): DesktopVaultIdentityCounts {
  const entityKinds = [
    result.identitySummary.documents,
    result.identitySummary.sections,
    result.identitySummary.blocks,
  ];
  return {
    entitiesReused: entityKinds.reduce(
      (total, kind) => total + kind.reusedExact + kind.reusedStrong,
      0,
    ),
    entitiesNew: entityKinds.reduce(
      (total, kind) => total + kind.allocatedNew,
      0,
    ),
    referencesReused:
      result.identitySummary.references.reusedExact +
      result.identitySummary.references.reusedStrong,
    referencesNew: result.identitySummary.references.allocatedNew,
  };
}

function transientReport(
  report: ObsidianDiagnosticReport,
  selection: VaultSelection,
): ObsidianDiagnosticReport {
  const validation = validateObsidianDiagnosticReport({
    ...report,
    identity: { stability: 'transient' },
  });
  if (!validation.valid) {
    throw new DesktopVaultOpenError(
      `Transient diagnostic report validation failed: ${
        validation.issues[0]?.message ?? 'unknown validation failure'
      }`,
      selection,
    );
  }
  return validation.value;
}

async function prepareInitialization(
  processor: DesktopWorkspaceProcessor,
  identitySession: WorkspaceIdentitySession,
  inventory: VaultSourceInventory,
  selection: VaultSelection,
): Promise<PreparedWorkspaceResult> {
  try {
    return await processor.prepareInitialize({
      workspaceId: identitySession.workspaceId,
      documents: inventory.markdownDocuments,
      identityCatalog: identitySession.catalog,
      nonMarkdownPaths: inventory.nonMarkdownPaths,
    });
  } catch (error: unknown) {
    processor.terminate();
    throw new DesktopVaultOpenError(
      `Workspace worker initialization failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      selection,
      { cause: error },
    );
  }
}

async function recoverCommitFailure(input: {
  readonly failedProcessor: DesktopWorkspaceProcessor;
  readonly sourceProvider: TauriSourceProvider;
  readonly selection: VaultSelection;
  readonly identitySession: WorkspaceIdentitySession;
  readonly durableCatalog: StableIdentityCatalog;
  readonly services: DesktopVaultServices;
}): Promise<{
  readonly processor: DesktopWorkspaceProcessor;
  readonly prepared: PreparedWorkspaceResult;
  readonly inventory: VaultSourceInventory;
  readonly sourceAcquisitionMs: number;
  readonly persistenceMs: number;
}> {
  input.failedProcessor.terminate();
  const replacement = input.services.createProcessor();
  const replacementSession: WorkspaceIdentitySession = {
    ...input.identitySession,
    catalog: input.durableCatalog,
  };
  try {
    const acquisitionStart = input.services.now();
    const inventory = await input.sourceProvider.discoverSelectedVault(
      input.selection,
    );
    const sourceAcquisitionMs = elapsed(acquisitionStart, input.services);
    const prepared = await replacement.prepareInitialize({
      workspaceId: replacementSession.workspaceId,
      documents: inventory.markdownDocuments,
      identityCatalog: input.durableCatalog,
      nonMarkdownPaths: inventory.nonMarkdownPaths,
    });
    const persistenceStart = input.services.now();
    await input.sourceProvider.commitWorkspaceIdentity(
      replacementSession,
      prepared.nextIdentityCatalog,
    );
    const persistenceMs = elapsed(persistenceStart, input.services);
    await replacement.commitCandidate(prepared.candidateId);
    return {
      processor: replacement,
      prepared,
      inventory,
      sourceAcquisitionMs,
      persistenceMs,
    };
  } catch (error: unknown) {
    replacement.terminate();
    throw new DesktopVaultOpenError(
      `Workspace worker commit failed after identity persistence, and replacement recovery failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      input.selection,
      { cause: error },
    );
  }
}

export async function openSelectedDesktopVault(
  sourceProvider: TauriSourceProvider,
  selection: VaultSelection,
  identityOptions: PrepareWorkspaceIdentityOptions = {},
  services: DesktopVaultServices = DEFAULT_SERVICES,
): Promise<OpenedDesktopVault> {
  const acquisitionStart = services.now();
  let inventory: VaultSourceInventory;
  let identitySession: WorkspaceIdentitySession;
  try {
    [inventory, identitySession] = await Promise.all([
      sourceProvider.discoverSelectedVault(selection),
      sourceProvider.loadOrPrepareWorkspaceIdentity(selection, identityOptions),
    ]);
  } catch (error: unknown) {
    throw new DesktopVaultOpenError(
      error instanceof Error ? error.message : String(error),
      selection,
      {
        cause: error,
        ...(error instanceof RecoverableWorkspaceIdentityError
          ? { recovery: error.recovery }
          : {}),
      },
    );
  }
  let sourceAcquisitionMs = elapsed(acquisitionStart, services);

  let processor = services.createProcessor();
  const prepared = await prepareInitialization(
    processor,
    identitySession,
    inventory,
    selection,
  );
  let activePrepared = prepared;
  let identityPersisted = true;
  let warning: string | undefined;
  let identityPersistenceMs: number;
  const persistenceStart = services.now();
  try {
    await sourceProvider.commitWorkspaceIdentity(
      identitySession,
      prepared.nextIdentityCatalog,
    );
    identityPersistenceMs = elapsed(persistenceStart, services);
  } catch (error: unknown) {
    identityPersisted = false;
    identityPersistenceMs = elapsed(persistenceStart, services);
    warning = `The vault is open for this session, but stable identity could not be saved: ${
      error instanceof Error ? error.message : String(error)
    } Saved-view restoration is disabled for this transient session.`;
    try {
      await processor.discardCandidate(prepared.candidateId);
    } catch (discardError: unknown) {
      warning = `${warning} The uncommitted worker candidate could not be discarded cleanly (${String(
        discardError instanceof Error ? discardError.message : discardError,
      )}); its worker was terminated.`;
    } finally {
      processor.terminate();
    }
  }

  if (identityPersisted) {
    try {
      await processor.commitCandidate(prepared.candidateId);
    } catch {
      const recovered = await recoverCommitFailure({
        failedProcessor: processor,
        sourceProvider,
        selection,
        identitySession,
        durableCatalog: prepared.nextIdentityCatalog,
        services,
      });
      processor = recovered.processor;
      activePrepared = recovered.prepared;
      inventory = recovered.inventory;
      sourceAcquisitionMs = Number(
        (sourceAcquisitionMs + recovered.sourceAcquisitionMs).toFixed(3),
      );
      identityPersistenceMs = Number(
        (identityPersistenceMs + recovered.persistenceMs).toFixed(3),
      );
    }
  }

  const report = identityPersisted
    ? activePrepared.report
    : transientReport(prepared.report, selection);
  return {
    status: 'opened',
    displayName: identitySession.selection.displayName,
    report,
    identityPersisted,
    ...(warning === undefined ? {} : { warning }),
    ...(identityPersisted && identitySession.previousWorkspaceId !== undefined
      ? { previousWorkspaceId: identitySession.previousWorkspaceId }
      : {}),
    timings: {
      sourceAcquisitionMs,
      workspaceInitializationMs: activePrepared.timings.workspaceUpdateMs,
      diagnosticConstructionMs: activePrepared.timings.diagnosticConstructionMs,
      workerComputeMs: activePrepared.timings.workerComputeMs,
      workerRoundTripMs:
        activePrepared.timings.workerRoundTripMs ??
        activePrepared.timings.workerComputeMs,
      mainThreadHighGapMs: activePrepared.timings.mainThreadHighGapMs ?? 0,
      identityPersistenceMs,
    },
    identityCounts: identityCounts(activePrepared),
    runtime: {
      selection,
      inventory,
      identitySession,
      workspaceId: activePrepared.workspaceId,
      revision: activePrepared.toRevision,
      durableIdentityCatalog: identityPersisted
        ? activePrepared.nextIdentityCatalog
        : identitySession.catalog,
      processor,
    },
  };
}

export async function selectAndOpenDesktopVault(
  sourceProvider: TauriSourceProvider,
  services: DesktopVaultServices = DEFAULT_SERVICES,
): Promise<SelectAndOpenDesktopVaultResult> {
  const selection = await sourceProvider.selectVaultDirectory();
  return selection === undefined
    ? { status: 'cancelled' }
    : openSelectedDesktopVault(sourceProvider, selection, {}, services);
}
