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
import type { DesktopVaultRuntime, OpenedDesktopVault } from './desktop-vault';
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

export interface AppProps {
  /** Tests may inject the native provider; ordinary browser mode detects lazily. */
  readonly desktopSourceProvider?: TauriSourceProvider;
}

export function App({ desktopSourceProvider }: AppProps = {}) {
  const [report, setReport] = useState<ObsidianDiagnosticReport>(SAMPLE_REPORT);
  const [reportName, setReportName] = useState('Synthetic Sample');
  const [reportRevision, setReportRevision] = useState(0);
  const [graphMaximized, setGraphMaximized] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [sourceStatus, setSourceStatus] = useState<string>();
  const [identityRecovery, setIdentityRecovery] =
    useState<IdentityRecoveryState>();
  const [detectedDesktopProvider, setDetectedDesktopProvider] =
    useState<TauriSourceProvider>();
  const desktopRuntimeRef = useRef<DesktopVaultRuntime | undefined>(undefined);
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

  function activateDesktopVault(opened: OpenedDesktopVault): void {
    const identitySummary = opened.identityPersisted
      ? `stable identity (${opened.identityCounts.entitiesReused} entities and ${opened.identityCounts.referencesReused} references reused; ${opened.identityCounts.entitiesNew} entities and ${opened.identityCounts.referencesNew} references new)`
      : 'transient identity';
    const timingSummary = `source ${opened.timings.sourceAcquisitionMs} ms, KG10 ${opened.timings.workspaceInitializationMs} ms, report ${opened.timings.diagnosticConstructionMs} ms, identity persistence ${opened.timings.identityPersistenceMs} ms`;
    let status = `${
      opened.warning ?? `Opened ${opened.displayName} locally.`
    } ${opened.report.sourceInventory.markdownFileCount} Markdown documents, ${opened.report.snapshot.entities.length} entities, and ${opened.report.snapshot.references.length} references; ${identitySummary}; ${timingSummary}.`;
    if (opened.previousWorkspaceId !== undefined) {
      const storage = browserStorage();
      if (storage !== undefined) {
        const cleared = clearWorkspaceView(storage, opened.previousWorkspaceId);
        if (!cleared.ok) status = `${status} ${cleared.message}`;
      }
    }
    setReport(opened.report);
    desktopRuntimeRef.current = opened.runtime;
    setReportName(opened.displayName);
    setReportRevision((current) => current + 1);
    setStatusFilter('all');
    setSearch('');
    setLoadError(undefined);
    setSourceStatus(status);
    setIdentityRecovery(undefined);
  }

  async function openVault(): Promise<void> {
    if (desktopProvider === undefined || vaultOpening) return;
    setVaultOpening(true);
    let desktopVault: typeof import('./desktop-vault') | undefined;
    try {
      desktopVault = await import('./desktop-vault');
      const result =
        await desktopVault.selectAndOpenDesktopVault(desktopProvider);
      if (result.status === 'opened') activateDesktopVault(result);
    } catch (error: unknown) {
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
      const { openSelectedDesktopVault } = await import('./desktop-vault');
      const opened = await openSelectedDesktopVault(
        desktopProvider,
        identityRecovery.selection,
        {
          reset: true,
          ...(registryReset ? { replaceCorruptRegistry: true } : {}),
        },
      );
      activateDesktopVault(opened);
    } catch (error: unknown) {
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
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const validation = validateObsidianDiagnosticReport(parsed);
      if (!validation.valid) {
        const first = validation.issues[0];
        throw new Error(
          `${first?.path ?? '$'}: ${first?.message ?? 'Report validation failed.'}`,
        );
      }
      setReport(validation.value);
      setReportName(file.name);
      setReportRevision((current) => current + 1);
      setStatusFilter('all');
      setSearch('');
      setLoadError(undefined);
      setSourceStatus(undefined);
      setIdentityRecovery(undefined);
      desktopRuntimeRef.current = undefined;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(
        `Could not load ${file.name}: ${message} Select a validated schema-v1 diagnostic report or restore the synthetic sample.`,
      );
    }
  }

  function restoreSample(): void {
    setReport(SAMPLE_REPORT);
    setReportName('Synthetic Sample');
    setReportRevision((current) => current + 1);
    setStatusFilter('all');
    setSearch('');
    setLoadError(undefined);
    setSourceStatus(undefined);
    setIdentityRecovery(undefined);
    desktopRuntimeRef.current = undefined;
  }

  return (
    <div
      className={`app-shell${graphMaximized ? ' app-shell--graph-maximized' : ''}`}
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
        {sourceStatus === undefined ? null : (
          <p
            className={
              report.identity?.stability === 'stable'
                ? 'source-status'
                : 'source-status source-status--warning'
            }
            aria-live="polite"
          >
            {sourceStatus}
          </p>
        )}
      </header>

      <main className="diagnostic-shell" id="main-content">
        <GraphExplorer
          key={reportRevision}
          maximized={graphMaximized}
          onMaximizedChange={setGraphMaximized}
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
