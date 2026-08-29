import {
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
import { EvidencePanel } from './components/EvidencePanel';
import { GraphExplorer } from './components/GraphExplorer';
import { HierarchyPanel } from './components/HierarchyPanel';
import { ReferencesPanel } from './components/ReferencesPanel';
import { SummaryPanel } from './components/SummaryPanel';
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

function liveSourceStatus(
  displayName: string,
  snapshot: DesktopLiveVaultSnapshot,
): string {
  const counts = `${snapshot.report.sourceInventory.markdownFileCount} Markdown · ${snapshot.report.snapshot.entities.length} entities`;
  const recovery = snapshot.phase === 'paused' ? ` · ${snapshot.message}` : '';
  return `${LIVE_PHASE_LABELS[snapshot.phase]} · ${displayName} · ${counts}${recovery}`;
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
    let status =
      opened.warning ??
      `Opened ${opened.displayName} locally with ${opened.report.sourceInventory.markdownFileCount} Markdown documents.`;
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
      setSourceStatus(liveSourceStatus(opened.displayName, snapshot));
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
    setIdentityRecovery(undefined);
  }

  async function rescanVault(): Promise<void> {
    const controller = liveControllerRef.current;
    if (controller === undefined) return;
    await controller.rescan();
  }

  return (
    <div
      className={`app-shell${graphMaximized ? ' app-shell--graph-maximized' : ''}`}
      data-performance-enabled={performanceSession !== undefined}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-bar">
        <h1 translate="no">Icarus Graph Explorer</h1>
        <div className="report-actions" aria-describedby="privacy-note">
          {desktopProvider === undefined ? null : (
            <button
              className="secondary-button"
              disabled={vaultOpening}
              onClick={() => void openVault()}
              type="button"
            >
              {vaultOpening ? 'Opening Vault…' : 'Open Vault'}
            </button>
          )}
          <label
            className="report-open-button"
            htmlFor="report-file"
            title="Reports stay in this browser tab and are not uploaded."
          >
            Open Report
          </label>
          <input
            accept="application/json,.json"
            className="report-file-input"
            id="report-file"
            name="diagnostic-report"
            onChange={(event) => void loadReport(event)}
            type="file"
          />
          <button
            className="secondary-button"
            onClick={restoreSample}
            type="button"
          >
            Sample
          </button>
          {livePhase === undefined ? null : (
            <button
              className="secondary-button"
              disabled={vaultOpening || livePhase === 'resyncing'}
              onClick={() => void rescanVault()}
              type="button"
            >
              Rescan Vault
            </button>
          )}
          <span className="report-name" title={reportName} translate="no">
            {reportName}
          </span>
          <span className="visually-hidden" id="privacy-note">
            Browser reports stay in this tab. Desktop vaults are read locally.
            Nothing is uploaded.
          </span>
        </div>
        {loadError === undefined ? null : (
          <p className="report-error" role="alert">
            {loadError}
          </p>
        )}
        {identityRecovery === undefined ? null : (
          <button
            className="identity-reset-button"
            disabled={vaultOpening}
            onClick={() => void resetLocalIdentity()}
            type="button"
          >
            {identityRecovery.recovery === 'replace-corrupt-registry'
              ? 'Reset local identity registry'
              : 'Reset local identity for this vault'}
          </button>
        )}
        {!vaultOpening && sourceStatus === undefined ? null : (
          <p
            className={
              report.identity?.stability === 'stable' && livePhase !== 'paused'
                ? 'source-status'
                : 'source-status source-status--warning'
            }
            aria-live="polite"
          >
            {vaultOpening
              ? 'Opening · the current workspace remains active'
              : sourceStatus}
          </p>
        )}
      </header>

      <main className="diagnostic-shell" id="main-content">
        <GraphExplorer
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
          snapshot={report.snapshot}
        />

        <details className="diagnostic-evidence">
          <summary>Inspect diagnostic evidence</summary>
          <section className="filter-bar" aria-labelledby="filter-title">
            <div>
              <p className="eyebrow">Local Inspection</p>
              <h2 id="filter-title">Filter Evidence</h2>
            </div>
            <div className="filter-controls">
              <label>
                Search Paths, Titles, or Targets
                <input
                  autoComplete="off"
                  name="diagnostic-search"
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="Example: folder or target…"
                  type="search"
                  value={search}
                />
              </label>
              <label>
                Resolution Status
                <select
                  autoComplete="off"
                  name="resolution-status"
                  onChange={(event) =>
                    setStatusFilter(
                      event.currentTarget.value as ResolutionFilter,
                    )
                  }
                  value={statusFilter}
                >
                  <option value="all">All States</option>
                  <option value="resolved">Resolved</option>
                  <option value="unresolved">Unresolved</option>
                  <option value="ambiguous">Ambiguous</option>
                  <option value="invalid">Invalid</option>
                </select>
              </label>
            </div>
          </section>

          <SummaryPanel summary={summary} />
          <div className="primary-grid">
            <HierarchyPanel
              documentIds={hierarchyDocumentIds}
              lookups={lookups}
            />
            <ReferencesPanel
              key={`${report.snapshot.workspace.id}:${statusFilter}:${deferredSearch}`}
              searchIsPending={search !== deferredSearch}
              total={referenceViews.length}
              views={visibleReferences}
            />
          </div>
          <EvidencePanel lookups={lookups} report={report} />
        </details>
      </main>
    </div>
  );
}
