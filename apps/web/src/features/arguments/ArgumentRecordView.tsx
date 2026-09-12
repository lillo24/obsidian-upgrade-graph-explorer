import {
  responseStaleness,
  type ArgumentAxiom,
  type ArgumentCounterArgument,
  type ArgumentLibrary,
  type ArgumentRecordKind,
  type ArgumentTopic,
  type TheorySourceReference,
} from '@icarus-graph-explorer/argument-workspace';

export interface ArgumentSelection {
  readonly kind: ArgumentRecordKind;
  readonly id: string;
}

function MarkdownText({ children }: { readonly children: string }) {
  return <div className="arguments-markdown-text">{children}</div>;
}

function locator(reference: TheorySourceReference): string {
  return (
    reference.originalWikilink ??
    `${reference.path}${
      reference.heading === undefined ? '' : `#${reference.heading}`
    }${reference.block === undefined ? '' : `^${reference.block}`}`
  );
}

function SourceReferences({
  references,
  onCopy,
}: {
  readonly references: readonly TheorySourceReference[];
  readonly onCopy: (value: string) => void;
}) {
  return (
    <section className="arguments-reading-section">
      <h3>Theory source locators</h3>
      <p className="arguments-disclosure">
        Recorded locators only — linked theory source text is unavailable and
        has not been read or currently verified.
      </p>
      {references.length === 0 ? (
        <p className="arguments-empty">No source references recorded.</p>
      ) : (
        <ul className="arguments-source-list">
          {references.map((reference) => (
            <li key={reference.id}>
              <div>
                <strong>{reference.label}</strong>{' '}
                <span className="arguments-badge">{reference.role}</span>
              </div>
              <code>{locator(reference)}</code>
              {reference.recordedVersion === undefined ? (
                <small>No recorded version metadata.</small>
              ) : (
                <small>
                  Recorded version:{' '}
                  {reference.recordedVersion.sourceVersion ??
                    'fingerprint only'}
                  ; scope {reference.recordedVersion.fingerprintScope}. Not
                  currently verified.
                </small>
              )}
              <button onClick={() => onCopy(locator(reference))} type="button">
                Copy locator
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Metadata({
  record,
  library,
}: {
  readonly record: ArgumentTopic | ArgumentAxiom | ArgumentCounterArgument;
  readonly library: ArgumentLibrary;
}) {
  return (
    <details className="arguments-metadata">
      <summary>Technical metadata</summary>
      <dl>
        <div>
          <dt>Record ID</dt>
          <dd>
            <code>{record.id}</code>
          </dd>
        </div>
        <div>
          <dt>Record revision</dt>
          <dd>{record.revision}</dd>
        </div>
        <div>
          <dt>Library revision</dt>
          <dd>{library.libraryRevision}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{record.updatedAt}</dd>
        </div>
      </dl>
    </details>
  );
}

function RecordHeader({
  archived,
  eyebrow,
  reviewState,
  title,
}: {
  readonly archived: boolean;
  readonly eyebrow: string;
  readonly reviewState: string;
  readonly title: string;
}) {
  return (
    <header className="arguments-record-header">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <div className="arguments-badges">
        <span
          className={`arguments-badge arguments-badge--review-${reviewState}`}
        >
          Human review: {reviewState}
        </span>
        {archived ? <span className="arguments-badge">Archived</span> : null}
      </div>
    </header>
  );
}

export function ArgumentTopicView({
  library,
  onNavigate,
  topic,
}: {
  readonly library: ArgumentLibrary;
  readonly onNavigate: (selection: ArgumentSelection) => void;
  readonly topic: ArgumentTopic;
}) {
  const axioms = topic.axiomIds.map((id) =>
    library.axioms.find((record) => record.id === id)!,
  );
  const counters = topic.counterArgumentIds.map((id) =>
    library.counterArguments.find((record) => record.id === id)!,
  );
  return (
    <article className="arguments-record">
      <RecordHeader
        archived={topic.archived}
        eyebrow="Topic"
        reviewState={topic.reviewState}
        title={topic.title}
      />
      <MarkdownText>{topic.summary}</MarkdownText>
      <div className="arguments-topic-columns">
        <section className="arguments-reading-section">
          <h3>Axioms</h3>
          {axioms.length === 0 ? (
            <p className="arguments-empty">No Axioms assigned.</p>
          ) : (
            <ul className="arguments-record-links">
              {axioms.map((axiom) => (
                <li key={axiom.id}>
                  <button
                    onClick={() => onNavigate({ kind: 'axiom', id: axiom.id })}
                    type="button"
                  >
                    {axiom.title}
                    {axiom.archived ? ' — archived' : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="arguments-reading-section">
          <h3>Counter-Arguments</h3>
          {counters.length === 0 ? (
            <p className="arguments-empty">No Counter-Arguments assigned.</p>
          ) : (
            <ul className="arguments-record-links">
              {counters.map((counter) => (
                <li key={counter.id}>
                  <button
                    onClick={() =>
                      onNavigate({ kind: 'counter-argument', id: counter.id })
                    }
                    type="button"
                  >
                    {counter.title}
                    {counter.archived ? ' — archived' : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <Metadata library={library} record={topic} />
    </article>
  );
}

export function ArgumentAxiomView({
  axiom,
  library,
  onCopy,
  onNavigate,
}: {
  readonly axiom: ArgumentAxiom;
  readonly library: ArgumentLibrary;
  readonly onCopy: (value: string) => void;
  readonly onNavigate: (selection: ArgumentSelection) => void;
}) {
  const linked = library.counterArguments.filter(
    (counter) =>
      (counter.target?.kind === 'axiom' &&
        counter.target.axiomId === axiom.id) ||
      counter.response.answeringAxioms.some(
        ({ axiomId }) => axiomId === axiom.id,
      ),
  );
  return (
    <article className="arguments-record">
      <RecordHeader
        archived={axiom.archived}
        eyebrow="Reusable Axiom"
        reviewState={axiom.reviewState}
        title={axiom.title}
      />
      <section className="arguments-reading-section">
        <h3>Statement</h3>
        <MarkdownText>{axiom.statement}</MarkdownText>
      </section>
      {axiom.explanation === undefined ? null : (
        <section className="arguments-reading-section">
          <h3>Explanation</h3>
          <MarkdownText>{axiom.explanation}</MarkdownText>
        </section>
      )}
      {axiom.scope === undefined ? null : (
        <section className="arguments-reading-section">
          <h3>Scope</h3>
          <MarkdownText>{axiom.scope}</MarkdownText>
        </section>
      )}
      {axiom.supportingReasoning === undefined ? null : (
        <section className="arguments-reading-section">
          <h3>Supporting reasoning</h3>
          <MarkdownText>{axiom.supportingReasoning}</MarkdownText>
        </section>
      )}
      <SourceReferences onCopy={onCopy} references={axiom.sourceReferences} />
      <section className="arguments-reading-section">
        <h3>Linked Counter-Arguments</h3>
        {linked.length === 0 ? (
          <p className="arguments-empty">None.</p>
        ) : (
          <ul className="arguments-record-links">
            {linked.map((counter) => (
              <li key={counter.id}>
                <button
                  onClick={() =>
                    onNavigate({ kind: 'counter-argument', id: counter.id })
                  }
                  type="button"
                >
                  {counter.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Metadata library={library} record={axiom} />
    </article>
  );
}

function targetLabel(counter: ArgumentCounterArgument): string {
  if (counter.target === undefined) return 'No structured target recorded.';
  if (counter.target.kind === 'topic-claim')
    return `Topic claim: ${counter.target.topicId}`;
  if (counter.target.kind === 'axiom')
    return `Axiom: ${counter.target.axiomId}`;
  return `Counter-Argument: ${counter.target.counterArgumentId}`;
}

export function ArgumentCounterArgumentView({
  counter,
  library,
  onCopy,
  onNavigate,
  onReassess,
}: {
  readonly counter: ArgumentCounterArgument;
  readonly library: ArgumentLibrary;
  readonly onCopy: (value: string) => void;
  readonly onNavigate: (selection: ArgumentSelection) => void;
  readonly onReassess: () => void;
}) {
  const stale = responseStaleness(library, counter);
  return (
    <article className="arguments-record">
      <RecordHeader
        archived={counter.archived}
        eyebrow="Counter-Argument"
        reviewState={counter.reviewState}
        title={counter.title}
      />
      <ol className="arguments-exchange">
        <li>
          <h3>Observation / example / argument</h3>
          <MarkdownText>{counter.observation}</MarkdownText>
        </li>
        <li>
          <h3>What this is intended to challenge</h3>
          <MarkdownText>{counter.challengedClaim}</MarkdownText>
          <p className="arguments-structured-target">{targetLabel(counter)}</p>
        </li>
        <li>
          <h3>Answered using</h3>
          {counter.response.answeringAxioms.length === 0 ? (
            <p className="arguments-empty">No answering Axiom attached.</p>
          ) : (
            <ul className="arguments-record-links">
              {counter.response.answeringAxioms.map((reference) => {
                const axiom = library.axioms.find(
                  ({ id }) => id === reference.axiomId,
                )!;
                return (
                  <li key={reference.axiomId}>
                    <button
                      onClick={() =>
                        onNavigate({ kind: 'axiom', id: axiom.id })
                      }
                      type="button"
                    >
                      {axiom.title}
                    </button>
                    <small>
                      Assessed at revision {reference.reliedOnRevision}; current
                      revision {axiom.revision}
                      {axiom.archived ? '; archived' : ''}.
                    </small>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
        <li>
          <h3>Recorded response — why it applies</h3>
          <MarkdownText>
            {counter.response.explanation || 'No response recorded.'}
          </MarkdownText>
        </li>
        <li>
          <h3>Current outcome</h3>
          <div className="arguments-badges">
            <span className="arguments-badge arguments-badge--outcome">
              Outcome: {counter.response.outcome}
            </span>
            <span
              className={`arguments-badge ${stale.stale ? 'arguments-badge--stale' : 'arguments-badge--fresh'}`}
            >
              Response{' '}
              {stale.stale
                ? 'needs reassessment'
                : 'matches recorded Axiom revisions'}
            </span>
          </div>
          {counter.response.boundary === undefined ? null : (
            <>
              <h4>Boundary</h4>
              <MarkdownText>{counter.response.boundary}</MarkdownText>
            </>
          )}
          {counter.response.reopeningCondition === undefined ? null : (
            <>
              <h4>Reopening condition</h4>
              <MarkdownText>{counter.response.reopeningCondition}</MarkdownText>
            </>
          )}
          {stale.stale ? (
            <div className="arguments-callout">
              <p>
                Changed Axioms: {stale.axiomIds.join(', ')}. The recorded
                outcome has not changed.
              </p>
              <button onClick={onReassess} type="button">
                Reassess against current Axiom versions
              </button>
            </div>
          ) : null}
        </li>
      </ol>
      <SourceReferences onCopy={onCopy} references={counter.sourceReferences} />
      <Metadata library={library} record={counter} />
    </article>
  );
}
