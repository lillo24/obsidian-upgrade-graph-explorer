import {
  formatTheorySourceLocator,
  sameSnapshot,
  type SnapshotDescriptor,
  type TheorySourceReference,
} from '@icarus-graph-explorer/argument-workspace';

import {
  argumentSourcePreviewKey,
  type ArgumentSourcePreview,
} from './source-preview';

export function TheorySourceReferences({
  currentLibrary,
  currentSourceGeneration,
  readAvailable,
  recordId,
  recordKind,
  references,
  previews,
  onCopy,
  onExport,
  onRead,
  onRecord,
}: {
  readonly currentLibrary: SnapshotDescriptor;
  readonly currentSourceGeneration: number | undefined;
  readonly readAvailable: boolean;
  readonly recordId: string;
  readonly recordKind: ArgumentSourcePreview['recordKind'];
  readonly references: readonly TheorySourceReference[];
  readonly previews: ReadonlyMap<string, ArgumentSourcePreview>;
  readonly onCopy: (value: string, message: string) => void;
  readonly onExport: (preview: ArgumentSourcePreview) => void;
  readonly onRead: (
    recordKind: ArgumentSourcePreview['recordKind'],
    recordId: string,
    reference: TheorySourceReference,
  ) => void;
  readonly onRecord: (preview: ArgumentSourcePreview) => void;
}) {
  return (
    <section className="arguments-reading-section">
      <h3>Theory source locators</h3>
      <p className="arguments-disclosure">
        Registered locators are read only from the explicitly bound source.
        Before a successful preview, source text has not been read or currently
        verified. Source freshness is independent of human review and outcome.
      </p>
      {references.length === 0 ? (
        <p className="arguments-empty">No source references recorded.</p>
      ) : (
        <ul className="arguments-source-list">
          {references.map((reference) => {
            const locator = formatTheorySourceLocator(reference);
            const preview = previews.get(
              argumentSourcePreviewKey({
                recordKind,
                recordId,
                reference,
              }),
            );
            const success =
              preview?.result.status === 'ok'
                ? preview.result.value
                : undefined;
            const current =
              preview !== undefined &&
              preview.source.sourceGeneration === currentSourceGeneration &&
              sameSnapshot(preview.library, currentLibrary);
            return (
              <li key={reference.id}>
                <div>
                  <strong>{reference.label}</strong>{' '}
                  <span className="arguments-badge">{reference.role}</span>
                </div>
                <code>{locator}</code>
                {reference.recordedVersion === undefined ? (
                  <small>No recorded source baseline.</small>
                ) : (
                  <small>
                    Recorded full-file version:{' '}
                    {reference.recordedVersion.sourceVersion ?? 'unavailable'}
                  </small>
                )}
                <div className="arguments-actions">
                  <button
                    disabled={!readAvailable}
                    onClick={() => onRead(recordKind, recordId, reference)}
                    type="button"
                  >
                    {preview === undefined ? 'Read source' : 'Refresh source'}
                  </button>
                  <button
                    onClick={() => onCopy(locator, 'Locator copied')}
                    type="button"
                  >
                    Copy locator
                  </button>
                </div>
                {preview === undefined ? null : (
                  <div className="arguments-source-preview">
                    <p className="arguments-disclosure">
                      {current
                        ? 'Current captured source and library.'
                        : 'Retained capture; source or library has changed. Refresh before recording a baseline.'}{' '}
                      {preview.source.acquisition === 'captured'
                        ? 'One-shot captured source.'
                        : `${preview.source.acquisitionState} live-source capture.`}{' '}
                      Observed {preview.source.observedAt}.
                    </p>
                    {success === undefined ? (
                      <div className="arguments-error" role="alert">
                        <strong>{preview.result.status}</strong>
                        {'message' in preview.result
                          ? `: ${preview.result.message}`
                          : ''}
                      </div>
                    ) : (
                      <>
                        <dl>
                          <div>
                            <dt>Resolved source</dt>
                            <dd>
                              <code>
                                {success.location.path}
                                {success.location.heading === undefined
                                  ? ''
                                  : `#${success.location.heading}`}
                              </code>
                            </dd>
                          </div>
                          <div>
                            <dt>Full-file version</dt>
                            <dd>
                              <code>
                                {success.sourceVersion ?? 'unavailable'}
                              </code>
                            </dd>
                          </div>
                          <div>
                            <dt>Source freshness</dt>
                            <dd>
                              {success.freshness === 'changed'
                                ? 'changed — review warning only; no verdict changed'
                                : success.freshness ===
                                    'matches-recorded-version'
                                  ? 'matches recorded version'
                                  : 'unknown / no comparable baseline'}
                            </dd>
                          </div>
                          <div>
                            <dt>Completeness</dt>
                            <dd>
                              {success.complete
                                ? 'complete'
                                : success.omissions.join(' ')}
                            </dd>
                          </div>
                        </dl>
                        <pre className="arguments-source-preview__text">
                          {success.text}
                        </pre>
                        <div className="arguments-actions">
                          <button
                            onClick={() =>
                              onCopy(success.text, 'Source passage copied')
                            }
                            type="button"
                          >
                            Copy passage
                          </button>
                          <button
                            onClick={() => onExport(preview)}
                            type="button"
                          >
                            Export passage
                          </button>
                          <button
                            disabled={
                              !current ||
                              !success.complete ||
                              success.sourceVersion === undefined
                            }
                            onClick={() => onRecord(preview)}
                            type="button"
                          >
                            Record this source version
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
