import { memo } from 'react';

import type { DiagnosticReportSummary } from '@icarus-graph-explorer/diagnostics-obsidian';

const NUMBER_FORMAT = new Intl.NumberFormat();

const METRICS = [
  ['Documents', 'documents'],
  ['Sections', 'sections'],
  ['Blocks', 'blocks'],
  ['References', 'references'],
  ['Resolved', 'resolved'],
  ['Unresolved', 'unresolved'],
  ['Ambiguous', 'ambiguous'],
  ['Invalid', 'invalid'],
  ['Warnings', 'warningDiagnostics'],
  ['Errors', 'errorDiagnostics'],
  ['Probes', 'compatibilityProbes'],
] as const satisfies readonly (readonly [
  string,
  keyof DiagnosticReportSummary,
])[];

export const SummaryPanel = memo(function SummaryPanel({
  summary,
}: {
  readonly summary: DiagnosticReportSummary;
}) {
  return (
    <section className="panel summary-panel" aria-labelledby="summary-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Canonical Snapshot</p>
          <h2 id="summary-title">Workspace Summary</h2>
        </div>
      </div>
      <dl className="metric-grid">
        {METRICS.map(([label, key]) => (
          <div className={`metric metric-${key}`} key={key}>
            <dt>{label}</dt>
            <dd>{NUMBER_FORMAT.format(summary[key])}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
});
