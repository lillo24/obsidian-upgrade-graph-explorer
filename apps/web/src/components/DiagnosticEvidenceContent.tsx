import { memo } from 'react';

import type {
  DiagnosticLookups,
  DiagnosticReportSummary,
  ObsidianDiagnosticReport,
} from '@icarus-graph-explorer/diagnostics-obsidian';

import type { ReferenceView, ResolutionFilter } from '../report-view';
import { EvidencePanel } from './EvidencePanel';
import { HierarchyPanel } from './HierarchyPanel';
import { ReferencesPanel } from './ReferencesPanel';
import { SummaryPanel } from './SummaryPanel';

interface DiagnosticEvidenceContentProps {
  readonly deferredSearch: string;
  readonly hierarchyDocumentIds: readonly string[];
  readonly lookups: DiagnosticLookups;
  readonly onSearchChange: (value: string) => void;
  readonly onStatusFilterChange: (filter: ResolutionFilter) => void;
  readonly referenceViews: readonly ReferenceView[];
  readonly report: ObsidianDiagnosticReport;
  readonly search: string;
  readonly statusFilter: ResolutionFilter;
  readonly summary: DiagnosticReportSummary;
  readonly visibleReferences: readonly ReferenceView[];
}

export const DiagnosticEvidenceContent = memo(
  function DiagnosticEvidenceContent({
    deferredSearch,
    hierarchyDocumentIds,
    lookups,
    onSearchChange,
    onStatusFilterChange,
    referenceViews,
    report,
    search,
    statusFilter,
    summary,
    visibleReferences,
  }: DiagnosticEvidenceContentProps) {
    return (
      <>
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
                onChange={(event) => onSearchChange(event.currentTarget.value)}
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
                  onStatusFilterChange(
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
      </>
    );
  },
);
