import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';

import {
  createDiagnosticLookups,
  summarizeDiagnosticReport,
  validateObsidianDiagnosticReport,
  type ObsidianDiagnosticReport,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import type {
  TauriSourceProvider,
  VaultSelection,
  WorkspaceIdentityRecovery,
} from '@icarus-graph-explorer/source-provider-tauri';

import './App.css';
import { DeveloperSettingsSection } from './components/DeveloperSettingsSection';
import { DiagnosticEvidenceContent } from './components/DiagnosticEvidenceContent';
import { DiagnosticEvidenceDialog } from './components/DiagnosticEvidenceDialog';
import { GraphExplorer } from './components/GraphExplorer';
import { SourceSettingsSection } from './components/SourceSettingsSection';
import { WorkspaceNotice } from './components/WorkspaceNotice';
import {
  buildReferenceViews,
  filterReferenceViews,
  matchingHierarchyDocumentIds,
  type ResolutionFilter,
} from './report-view';
import sampleReportJson from './sample-report.json';
import type { OpenedDesktopVault } from './desktop-vault';
import type {
  DesktopLiveVaultController,
  DesktopLiveVaultPhase,
  DesktopLiveVaultSnapshot,
} from './desktop-live-vault';
import { browserPerformanceSession } from './performance';
import { browserStorage, clearWorkspaceView } from './persistence/storage';

const sampleValidation = validateObsidianDiagnosticReport(sampleReportJson);
if (!sampleValidation.valid) {
  throw new Error(
    `Bundled diagnostic report is invalid: ${sampleValidation.issues[0]?.message ?? 'unknown validation failure'}`,
  );
}
const SAMPLE_REPORT = sampleValidation.value;

interface IdentityRecoveryState {
  readonly selection: VaultSelection;
  readonly recovery: WorkspaceIdentityRecovery;
}

const LIVE_PHASE_LABELS: Record<DesktopLiveVaultPhase, string> = {
  'catching-up': 'Catching up',
  live: 'Live',
  updating: 'Updating',
  resyncing: 'Resyncing',
  paused: 'Paused',
};

function liveSourceStatus(snapshot: DesktopLiveVaultSnapshot): string {
  return snapshot.message;
}

export interface AppProps {
  /** Tests may inject the native provider; ordinary browser mode detects lazily. */
  readonly desktopSourceProvider?: TauriSourceProvider;
}

export function App({ desktopSourceProvider }: AppProps = {}) {
  const [report, setReport] = useState<ObsidianDiagnosticReport>(SAMPLE_REPORT);
  const [reportName, setReportName] = useState('Synthetic Sample');
  const [sourceSessionKey, setSourceSessionKey] = useState(0);
  const [graphMaximized, setGraphMaximized] = useState(false);
  const performanceSession = browserPerformanceSession;
  const [performanceUpdateKey, setPerformanceUpdateKey] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const [sourceStatus, setSourceStatus] = useState<string>();
  const [sourceWarning, setSourceWarning] = useState<string>();
  const [identityRecovery, setIdentityRecovery] =
    useState<IdentityRecoveryState>();
  const [detectedDesktopProvider, setDetectedDesktopProvider] =
    useState<TauriSourceProvider>();
  const liveControllerRef = useRef<DesktopLiveVaultController | undefined>(
    undefined,
  );
  const liveUnsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const sourceRequestGeneration = useRef(0);
  const lastPerformanceCorrelation = useRef<string | undefined>(undefined);
  const [livePhase, setLivePhase] = useState<DesktopLiveVaultPhase>();
  const [vaultOpening, setVaultOpening] = useState(false);
  const [diagnosticEvidenceOpen, setDiagnosticEvidenceOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ResolutionFilter>('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const lookups = useMemo(
    () => createDiagnosticLookups(report.snapshot),
    [report.snapshot],
  );
  const summary = useMemo(() => summarizeDiagnosticReport(report), [report]);
  const referenceViews = useMemo(
    () => buildReferenceViews(report, lookups),
    [lookups, report],
  );
  const visibleReferences = useMemo(
    () => filterReferenceViews(referenceViews, statusFilter, deferredSearch),
    [deferredSearch, referenceViews, statusFilter],
  );
  const hierarchyDocumentIds = useMemo(
    () => matchingHierarchyDocumentIds(report, lookups, deferredSearch),
    [deferredSearch, lookups, report],
  );

  const desktopProvider = desktopSourceProvider ?? detectedDesktopProvider;

  useEffect(() => {
    if (desktopSourceProvider !== undefined) return;
    let active = true;
    void import('./desktop-runtime')
      .then(({ desktopSourceProvider: detect }) => {
        if (active) setDetectedDesktopProvider(detect());
      })
      .catch(() => {
        // Browser mode remains fully functional if the desktop-only chunk is unavailable.
      });
    return () => {
      active = false;
    };
  }, [desktopSourceProvider]);

  useEffect(
    () => () => {
      sourceRequestGeneration.current += 1;
      liveUnsubscribeRef.current?.();
      const controller = liveControllerRef.current;
      liveControllerRef.current = undefined;
      if (controller !== undefined)
        void controller.stop().catch(() => undefined);
    },
    [],
  );

  function stopActiveLiveController(): void {
    liveUnsubscribeRef.current?.();
    liveUnsubscribeRef.current = undefined;
    const controller = liveControllerRef.current;
    liveControllerRef.current = undefined;
    if (controller !== undefined) {
      void controller.stop().catch((error: unknown) => {
        setLoadError(
          `The previous live watcher could not be stopped cleanly: ${
            error instanceof Error ? error.message : String(error)
          } Stale callbacks remain isolated from the current source.`,
        );
      });
    }
    setLivePhase(undefined);
  }

  function activateDesktopVault(
    opened: OpenedDesktopVault,
    controller?: DesktopLiveVaultController,
  ): void {
    performanceSession?.begin('I1-initial-view-preparation');
    setPerformanceUpdateKey(undefined);
    lastPerformanceCorrelation.current = undefined;
    let status = `Opened ${opened.displayName} locally with ${opened.report.sourceInventory.markdownFileCount} Markdown documents.`;
    if (opened.previousWorkspaceId !== undefined) {
      const storage = browserStorage();
      if (storage !== undefined) {
        const cleared = clearWorkspaceView(storage, opened.previousWorkspaceId);
        if (!cleared.ok) status = `${status} ${cleared.message}`;
      }
    }
    stopActiveLiveController();
    setReportName(opened.displayName);
    setSourceSessionKey((current) => current + 1);
    setStatusFilter('all');
    setSearch('');
    setLoadError(undefined);
    setSourceWarning(opened.warning);
    setIdentityRecovery(undefined);
    if (controller === undefined) {
      setReport(opened.report);
      setSourceStatus(status);
      return;
    }

    liveControllerRef.current = controller;
    const applySnapshot = (snapshot: DesktopLiveVaultSnapshot) => {
      if (liveControllerRef.current !== controller) return;
      const update = snapshot.lastUpdate;
      if (
        performanceSession !== undefined &&
        update !== undefined &&
        update.correlationId !== lastPerformanceCorrelation.current &&
        update.kind !== 'no-op'
      ) {
        lastPerformanceCorrelation.current = update.correlationId;
        performanceSession.begin(
          update.kind === 'incremental'
            ? 'I16-live-markdown'
            : update.kind === 'non-markdown'
              ? 'I17-live-non-markdown'
              : 'I18-full-rescan',
          update.correlationId,
        );
        const instrumentation = performanceSession.instrumentation;
        instrumentation.record(
          'source-reconciliation',
          update.timings.sourceReconciliationMs,
        );
        instrumentation.record(
          'workspace-update',
          update.timings.workspaceUpdateMs,
        );
        instrumentation.record(
          'report-construction',
          update.timings.diagnosticConstructionMs,
        );
        instrumentation.record(
          'identity-persistence',
          update.timings.identityPersistenceMs,
        );
        instrumentation.record('live-total', update.timings.totalMs);
        instrumentation.count('live-adoptions');
        setPerformanceUpdateKey(update.correlationId);
      }
      setReport((current) =>
        current === snapshot.report ? current : snapshot.report,
      );
      setLivePhase(snapshot.phase);
      setSourceStatus(liveSourceStatus(snapshot));
    };
    liveUnsubscribeRef.current = controller.subscribe(applySnapshot);
    applySnapshot(controller.snapshot());
  }

  async function openVault(): Promise<void> {
    if (desktopProvider === undefined || vaultOpening) return;
    const requestGeneration = sourceRequestGeneration.current + 1;
    sourceRequestGeneration.current = requestGeneration;
    setVaultOpening(true);
    let desktopVault: typeof import('./desktop-vault') | undefined;
    try {
      const selection = await desktopProvider.selectVaultDirectory();
      if (selection === undefined) return;
      const [desktopVaultModule, liveVaultModule] = await Promise.all([
        import('./desktop-vault'),
        import('./desktop-live-vault'),
      ]);
      desktopVault = desktopVaultModule;
      const result = await liveVaultModule.openLiveDesktopVault(
        desktopProvider,
        selection,
      );
      if (sourceRequestGeneration.current !== requestGeneration) {
        await result.controller?.stop();
        return;
      }
      activateDesktopVault(result.opened, result.controller);
    } catch (error: unknown) {
      if (sourceRequestGeneration.current !== requestGeneration) return;
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(
        `Could not open the selected vault: ${message} The current workspace remains loaded.`,
      );
      if (
        desktopVault !== undefined &&
        error instanceof desktopVault.DesktopVaultOpenError &&
        error.recovery !== undefined
      ) {
        setIdentityRecovery({
          selection: error.selection,
          recovery: error.recovery,
        });
      } else {
        setIdentityRecovery(undefined);
      }
    } finally {
      setVaultOpening(false);
    }
  }

  async function resetLocalIdentity(): Promise<void> {
    if (
      desktopProvider === undefined ||
      identityRecovery === undefined ||
      vaultOpening
    ) {
      return;
    }
    const requestGeneration = sourceRequestGeneration.current + 1;
    sourceRequestGeneration.current = requestGeneration;
    const registryReset =
      identityRecovery.recovery === 'replace-corrupt-registry';
    const confirmed = window.confirm(
      registryReset
        ? 'Replace the corrupt local workspace registry? Existing catalog files will remain private but their associations may need to be recreated.'
        : 'Reset local identity for this vault? Stable IDs and its saved graph view continuity will change.',
    );
    if (!confirmed) return;
    setVaultOpening(true);
    try {
      const { openLiveDesktopVault } = await import('./desktop-live-vault');
      const result = await openLiveDesktopVault(
        desktopProvider,
        identityRecovery.selection,
        {
          reset: true,
          ...(registryReset ? { replaceCorruptRegistry: true } : {}),
        },
      );
      if (sourceRequestGeneration.current !== requestGeneration) {
        await result.controller?.stop();
        return;
      }
      activateDesktopVault(result.opened, result.controller);
    } catch (error: unknown) {
      if (sourceRequestGeneration.current !== requestGeneration) return;
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(
        `Could not reset local identity and open the vault: ${message} The current workspace remains loaded.`,
      );
    } finally {
      setVaultOpening(false);
    }
  }

  async function loadReport(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file === undefined) return;
    sourceRequestGeneration.current += 1;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const validation = validateObsidianDiagnosticReport(parsed);
      if (!validation.valid) {
        const first = validation.issues[0];
        throw new Error(
          `${first?.path ?? '$'}: ${first?.message ?? 'Report validation failed.'}`,
        );
      }
      stopActiveLiveController();
      performanceSession?.begin('I1-initial-view-preparation');
      setPerformanceUpdateKey(undefined);
      lastPerformanceCorrelation.current = undefined;
      setReport(validation.value);
      setReportName(file.name);
      setSourceSessionKey((current) => current + 1);
      setStatusFilter('all');
      setSearch('');
      setLoadError(undefined);
      setSourceStatus(undefined);
      setSourceWarning(undefined);
      setIdentityRecovery(undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(
        `Could not load ${file.name}: ${message} Select a validated schema-v1 diagnostic report or restore the synthetic sample.`,
      );
    }
  }

  function restoreSample(): void {
    sourceRequestGeneration.current += 1;
    stopActiveLiveController();
    performanceSession?.begin('I1-initial-view-preparation');
    setPerformanceUpdateKey(undefined);
    lastPerformanceCorrelation.current = undefined;
    setReport(SAMPLE_REPORT);
    setReportName('Synthetic Sample');
    setSourceSessionKey((current) => current + 1);
    setStatusFilter('all');
    setSearch('');
    setLoadError(undefined);
    setSourceStatus(undefined);
    setSourceWarning(undefined);
    setIdentityRecovery(undefined);
  }

  async function rescanVault(): Promise<void> {
    const controller = liveControllerRef.current;
    if (controller === undefined) return;
    await controller.rescan();
  }

  const openDiagnosticEvidence = useCallback(
    () => setDiagnosticEvidenceOpen(true),
    [],
  );
  const closeDiagnosticEvidence = useCallback(
    () => setDiagnosticEvidenceOpen(false),
    [],
  );

  const currentSourceStatus = vaultOpening
    ? 'Opening'
    : livePhase === undefined
      ? report.identity?.stability === 'transient'
        ? 'Session Only'
        : 'Ready'
      : LIVE_PHASE_LABELS[livePhase];
  const recoveryLabel =
    identityRecovery?.recovery === 'replace-corrupt-registry'
      ? 'Reset Local Identity Registry'
      : identityRecovery === undefined
        ? undefined
        : 'Reset Local Identity for This Vault';
  const sourceNotice =
    loadError !== undefined
      ? { message: loadError, tone: 'error' as const }
      : vaultOpening
        ? {
            message: 'Opening Vault… The current workspace remains active.',
            tone: 'progress' as const,
          }
        : livePhase === 'catching-up' || livePhase === 'resyncing'
          ? {
              message:
                sourceStatus ??
                `${LIVE_PHASE_LABELS[livePhase]} the local vault.`,
              tone: 'progress' as const,
            }
          : livePhase === 'paused'
            ? {
                message:
                  sourceStatus ??
                  'Live updates are paused. Open Settings to rescan the vault.',
                tone: 'warning' as const,
              }
            : sourceWarning === undefined
              ? undefined
              : { message: sourceWarning, tone: 'warning' as const };

  return (
    <div
      className={`app-shell${graphMaximized ? ' app-shell--graph-maximized' : ''}`}
      data-performance-enabled={performanceSession !== undefined}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main
        aria-labelledby="workspace-title"
        className="workspace-main"
        id="main-content"
        tabIndex={-1}
      >
        <h1 className="visually-hidden" id="workspace-title" translate="no">
          Icarus Graph Explorer
        </h1>
        <GraphExplorer
          applicationOverlayOpen={diagnosticEvidenceOpen}
          key={sourceSessionKey}
          maximized={graphMaximized}
          onMaximizedChange={setGraphMaximized}
          {...(performanceSession === undefined
            ? {}
            : { performance: performanceSession.instrumentation })}
          {...(performanceUpdateKey === undefined
            ? {}
            : { performanceUpdateKey })}
          {...(report.identity === undefined
            ? {}
            : { identityStability: report.identity.stability })}
          settingsContent={
            <>
              <SourceSettingsSection
                currentSourceName={reportName}
                currentStatus={currentSourceStatus}
                desktopAvailable={desktopProvider !== undefined}
                entityCount={report.snapshot.entities.length}
                live={livePhase !== undefined}
                markdownFileCount={report.sourceInventory.markdownFileCount}
                onOpenVault={() => void openVault()}
                onReportChange={(event) => void loadReport(event)}
                onRescanVault={() => void rescanVault()}
                onResetLocalIdentity={() => void resetLocalIdentity()}
                onUseSample={restoreSample}
                opening={vaultOpening}
                {...(recoveryLabel === undefined ? {} : { recoveryLabel })}
                reportIsSample={reportName === 'Synthetic Sample'}
                rescanDisabled={vaultOpening || livePhase === 'resyncing'}
                {...(sourceStatus === undefined
                  ? {}
                  : { sourceDetail: sourceStatus })}
                {...(sourceWarning === undefined ? {} : { sourceWarning })}
              />
              <DeveloperSettingsSection
                onOpenDiagnosticEvidence={openDiagnosticEvidence}
              />
            </>
          }
          snapshot={report.snapshot}
        />
        {sourceNotice === undefined ? null : (
          <div className="workspace-notice-stack">
            <WorkspaceNotice tone={sourceNotice.tone}>
              {sourceNotice.message}
            </WorkspaceNotice>
          </div>
        )}
      </main>

      {diagnosticEvidenceOpen ? (
        <DiagnosticEvidenceDialog onClose={closeDiagnosticEvidence}>
          <DiagnosticEvidenceContent
            deferredSearch={deferredSearch}
            hierarchyDocumentIds={hierarchyDocumentIds}
            lookups={lookups}
            onSearchChange={setSearch}
            onStatusFilterChange={setStatusFilter}
            referenceViews={referenceViews}
            report={report}
            search={search}
            statusFilter={statusFilter}
            summary={summary}
            visibleReferences={visibleReferences}
          />
        </DiagnosticEvidenceDialog>
      ) : null}
    </div>
  );
}
