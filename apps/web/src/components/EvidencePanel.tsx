import { memo } from 'react';

import type {
  DiagnosticLookups,
  ObsidianDiagnosticReport,
} from '@icarus-graph-explorer/diagnostics-obsidian';

export const EvidencePanel = memo(function EvidencePanel({
  report,
  lookups,
}: {
  readonly report: ObsidianDiagnosticReport;
  readonly lookups: DiagnosticLookups;
}) {
  return (
    <div className="evidence-grid">
      <section
        className="panel evidence-panel"
        aria-labelledby="diagnostics-title"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Pipeline Evidence</p>
            <h2 id="diagnostics-title">Diagnostics</h2>
          </div>
          <span className="panel-count">{report.diagnostics.length}</span>
        </div>
        {report.diagnostics.length === 0 ? (
          <p className="empty-state">No adapter or resolver diagnostics.</p>
        ) : (
          <ul className="evidence-list">
            {report.diagnostics.map((diagnostic, index) => (
              <li className="evidence-row" key={`${diagnostic.code}-${index}`}>
                <div className="evidence-meta">
                  <span
                    className={`severity-badge severity-${diagnostic.severity}`}
                  >
                    {diagnostic.severity}
                  </span>
                  <code translate="no">{diagnostic.code}</code>
                  <span>{diagnostic.fatal ? 'Fatal' : 'Non-fatal'}</span>
                </div>
                <p>{diagnostic.message}</p>
                {diagnostic.sourcePath === undefined ? null : (
                  <p className="source-note breakable" translate="no">
                    {diagnostic.sourcePath}
                    {diagnostic.sourceSpan === undefined
                      ? ''
                      : ` · line ${diagnostic.sourceSpan.start.line}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel evidence-panel" aria-labelledby="probes-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Non-Canonical Evidence</p>
            <h2 id="probes-title">Compatibility Probes</h2>
          </div>
          <span className="panel-count">{report.probes.length}</span>
        </div>
        <p className="panel-note">
          A probe is a possible compatibility clue, not canonical resolution
          truth.
        </p>
        {report.probes.length === 0 ? (
          <p className="empty-state">No compatibility clues were produced.</p>
        ) : (
          <ul className="evidence-list">
            {report.probes.map((probe) => (
              <li
                className="evidence-row"
                key={`${probe.referenceId}-${probe.code}`}
              >
                <div className="evidence-meta">
                  <span className="probe-badge">Probe</span>
                  <code translate="no">{probe.code}</code>
                </div>
                <p>{probe.message}</p>
                {probe.candidateEntityIds === undefined ? null : (
                  <ul className="candidate-list">
                    {probe.candidateEntityIds.map((id) => (
                      <li className="breakable" key={id}>
                        {lookups.labelByEntityId.get(id) ?? id}
                      </li>
                    ))}
                  </ul>
                )}
                {probe.candidatePaths === undefined ? null : (
                  <ul className="candidate-list">
                    {probe.candidatePaths.map((path) => (
                      <li className="breakable" key={path} translate="no">
                        {path}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
});
