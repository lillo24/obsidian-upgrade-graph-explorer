import { memo, useState } from 'react';

import type { ReferenceView } from '../report-view';

const PAGE_SIZE = 100;
const NUMBER_FORMAT = new Intl.NumberFormat();

function resolutionReason(view: ReferenceView): string | undefined {
  const resolution = view.reference.resolution;
  return resolution.status === 'resolved' ? undefined : resolution.reason;
}

const ReferenceRow = memo(function ReferenceRow({
  view,
}: {
  readonly view: ReferenceView;
}) {
  const { reference } = view;
  const reason = resolutionReason(view);
  return (
    <article className="reference-row">
      <details>
        <summary>
          <span
            className={`status-badge status-${reference.resolution.status}`}
          >
            {reference.resolution.status}
          </span>
          <code className="target-text" translate="no">
            {reference.rawTarget}
          </code>
          <span className="reference-kind">{reference.kind}</span>
        </summary>
        <dl className="reference-detail">
          <div>
            <dt>Source Path</dt>
            <dd className="breakable" translate="no">
              {view.sourcePath}
            </dd>
          </div>
          <div>
            <dt>Source Owner</dt>
            <dd className="breakable">{view.sourceLabel}</dd>
          </div>
          <div>
            <dt>Source Position</dt>
            <dd className="numeric">
              Line {reference.sourceSpan.start.line}, column{' '}
              {reference.sourceSpan.start.column}
            </dd>
          </div>
          {view.targetLabels.length > 0 ? (
            <div>
              <dt>
                {reference.resolution.status === 'ambiguous'
                  ? 'Candidates'
                  : 'Target'}
              </dt>
              <dd>
                <ul className="candidate-list">
                  {view.targetLabels.map((label) => (
                    <li className="breakable" key={label}>
                      {label}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {reason === undefined ? null : (
            <div>
              <dt>Reason</dt>
              <dd>{reason}</dd>
            </div>
          )}
        </dl>
      </details>
    </article>
  );
});

export const ReferencesPanel = memo(function ReferencesPanel({
  views,
  total,
  searchIsPending,
}: {
  readonly views: readonly ReferenceView[];
  readonly total: number;
  readonly searchIsPending: boolean;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(views.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = views.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return (
    <section
      className="panel references-panel"
      aria-labelledby="references-title"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Reference Evidence</p>
          <h2 id="references-title">References</h2>
        </div>
        <span className="panel-count" aria-live="polite">
          {searchIsPending
            ? 'Updating…'
            : `${NUMBER_FORMAT.format(views.length)} of ${NUMBER_FORMAT.format(total)}`}
        </span>
      </div>
      {visible.length === 0 ? (
        <p className="empty-state">No references match the current filters.</p>
      ) : (
        <div className="reference-list">
          {visible.map((view) => (
            <ReferenceRow key={view.reference.id} view={view} />
          ))}
        </div>
      )}
      {pageCount > 1 ? (
        <nav className="pagination" aria-label="Reference result pages">
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous Page
          </button>
          <span className="numeric">
            Page {safePage} of {pageCount}
          </span>
          <button
            type="button"
            disabled={safePage === pageCount}
            onClick={() =>
              setPage((current) => Math.min(pageCount, current + 1))
            }
          >
            Next Page
          </button>
        </nav>
      ) : null}
    </section>
  );
});
