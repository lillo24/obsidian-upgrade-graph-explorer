import {
  buildObsidianDiagnosticReport,
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
import {
  initializeObsidianWorkspaceEngine,
  type InitializeObsidianWorkspaceEngineResult,
  type ObsidianWorkspaceEngine,
} from '@icarus-graph-explorer/workspace-engine-obsidian';

export interface DesktopVaultTimings {
  readonly sourceAcquisitionMs: number;
  readonly workspaceInitializationMs: number;
  readonly diagnosticConstructionMs: number;
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
  readonly engine: ObsidianWorkspaceEngine;
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
  readonly initializeEngine: typeof initializeObsidianWorkspaceEngine;
  readonly buildReport: typeof buildObsidianDiagnosticReport;
}

const DEFAULT_SERVICES: DesktopVaultServices = {
  now: () => performance.now(),
  initializeEngine: initializeObsidianWorkspaceEngine,
  buildReport: buildObsidianDiagnosticReport,
};

function elapsed(start: number, services: DesktopVaultServices): number {
  return Number((services.now() - start).toFixed(3));
}

function initializationFailure(
  result: Extract<
    InitializeObsidianWorkspaceEngineResult,
    { readonly ok: false }
  >,
  selection: VaultSelection,
): DesktopVaultOpenError {
  return new DesktopVaultOpenError(
    `Workspace initialization failed at ${result.failure.stage}: ${result.failure.message}`,
    selection,
  );
}

function identityCounts(
  result: Extract<
    InitializeObsidianWorkspaceEngineResult,
    { readonly ok: true }
  >,
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

function buildReport(
  initialized: Extract<
    InitializeObsidianWorkspaceEngineResult,
    { readonly ok: true }
  >,
  inventory: VaultSourceInventory,
  stability: 'stable' | 'transient',
  services: DesktopVaultServices,
): ObsidianDiagnosticReport {
  return services.buildReport({
    snapshot: initialized.snapshot,
    diagnostics: initialized.resolutionDiagnostics,
    documents: initialized.engine.parsedDocuments(),
    nonMarkdownPaths: inventory.nonMarkdownPaths,
    identity: { stability },
  });
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
  const sourceAcquisitionMs = elapsed(acquisitionStart, services);

  const initializationStart = services.now();
  const initialized = services.initializeEngine({
    workspaceId: identitySession.workspaceId,
    documents: inventory.markdownDocuments,
    identityCatalog: identitySession.catalog,
  });
  const workspaceInitializationMs = elapsed(initializationStart, services);
  if (!initialized.ok) throw initializationFailure(initialized, selection);

  const diagnosticStart = services.now();
  let stableReport;
  try {
    stableReport = buildReport(initialized, inventory, 'stable', services);
  } catch (error: unknown) {
    throw new DesktopVaultOpenError(
      `Diagnostic report construction failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      selection,
      { cause: error },
    );
  }
  let diagnosticConstructionMs = elapsed(diagnosticStart, services);

  const persistenceStart = services.now();
  let identityPersisted = true;
  let warning: string | undefined;
  let report = stableReport;
  try {
    await sourceProvider.commitWorkspaceIdentity(
      identitySession,
      initialized.identityCatalog,
    );
  } catch (error: unknown) {
    identityPersisted = false;
    warning = `The vault is open for this session, but stable identity could not be saved: ${
      error instanceof Error ? error.message : String(error)
    } Saved-view restoration is disabled for this transient session.`;
    const transientStart = services.now();
    report = buildReport(initialized, inventory, 'transient', services);
    diagnosticConstructionMs = Number(
      (diagnosticConstructionMs + elapsed(transientStart, services)).toFixed(3),
    );
  }
  const identityPersistenceMs = elapsed(persistenceStart, services);

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
      workspaceInitializationMs,
      diagnosticConstructionMs,
      identityPersistenceMs,
    },
    identityCounts: identityCounts(initialized),
    runtime: {
      selection,
      inventory,
      identitySession,
      engine: initialized.engine,
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
