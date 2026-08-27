import { useDeferredValue, useMemo, useState, type ChangeEvent } from 'react';

import {
  createDiagnosticLookups,
  summarizeDiagnosticReport,
  validateObsidianDiagnosticReport,
  type ObsidianDiagnosticReport,
} from '@icarus-graph-explorer/diagnostics-obsidian';

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

const sampleValidation = validateObsidianDiagnosticReport(sampleReportJson);
if (!sampleValidation.valid) {
  throw new Error(
    `Bundled diagnostic report is invalid: ${sampleValidation.issues[0]?.message ?? 'unknown validation failure'}`,
  );
}
const SAMPLE_REPORT = sampleValidation.value;

export function App() {
  const [report, setReport] = useState<ObsidianDiagnosticReport>(SAMPLE_REPORT);
  const [reportName, setReportName] = useState('Synthetic Sample');
  const [reportRevision, setReportRevision] = useState(0);
  const [loadError, setLoadError] = useState<string>();
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(
        `Could not load ${file.name}: ${message} Select a schema-v1 KG5 report or restore the synthetic sample.`,
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
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <div>
          <p className="eyebrow">Local-first · Read-only</p>
          <h1 translate="no">Icarus Graph Explorer</h1>
          <p className="header-description">
            Explore the structure and references already captured in a validated
            diagnostic report.
          </p>
        </div>
        <div className="report-loader" aria-describedby="privacy-note">
          <label className="file-label" htmlFor="report-file">
            Load Diagnostic Report
          </label>
          <input
            accept="application/json,.json"
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
            Load Synthetic Sample
          </button>
          <p id="privacy-note">
            The selected JSON stays in this browser tab. Nothing is uploaded.
          </p>
          <p className="load-message" aria-live="polite">
            {loadError ?? `Viewing: ${reportName}`}
          </p>
        </div>
      </header>

      <main className="diagnostic-shell" id="main-content">
        <GraphExplorer
          key={reportRevision}
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
      <footer className="app-footer">
        KG9 restores stable local graph views from one generated report. Source
        text and product-grade vault access remain deferred to KG11.
      </footer>
    </>
  );
}
