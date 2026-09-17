import {
  argumentStaleness,
  responseStaleness,
  type Argument,
  type ArgumentAxiom,
  type ArgumentCounterArgument,
  type ArgumentLibrary,
  type ArgumentRecordKind,
  type ArgumentTopic,
} from '@icarus-graph-explorer/argument-workspace';
import type { ReactNode } from 'react';

export interface ArgumentSelection {
  readonly kind: ArgumentRecordKind;
  readonly id: string;
}

function MarkdownText({ children }: { readonly children: string }) {
  return <div className="arguments-markdown-text">{children}</div>;
}

function Metadata({
  record,
  library,
}: {
  readonly record:
    ArgumentTopic | ArgumentAxiom | Argument | ArgumentCounterArgument;
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
  const argumentsByTopic = topic.argumentIds.map((id) =>
    library.arguments.find((record) => record.id === id)!,
  );
  const currentArgument =
    topic.currentArgumentId === undefined
      ? undefined
      : library.arguments.find(({ id }) => id === topic.currentArgumentId);
  return (
    <article className="arguments-record">
      <RecordHeader
        archived={topic.archived}
        eyebrow="Topic"
        reviewState={topic.reviewState}
        title={topic.title}
      />
      <MarkdownText>{topic.summary}</MarkdownText>
      <section className="arguments-reading-section arguments-current">
        <h3>Current reasoning</h3>
        {currentArgument === undefined ? (
          <p className="arguments-empty">No Current Argument selected.</p>
        ) : (
          <button
            onClick={() =>
              onNavigate({ kind: 'argument', id: currentArgument.id })
            }
            type="button"
          >
            {currentArgument.title}
          </button>
        )}
      </section>
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
          <h3>Arguments</h3>
          {argumentsByTopic.length === 0 ? (
            <p className="arguments-empty">No Arguments assigned.</p>
          ) : (
            <ul className="arguments-record-links">
              {argumentsByTopic.map((argument) => (
                <li key={argument.id}>
                  <button
                    onClick={() =>
                      onNavigate({ kind: 'argument', id: argument.id })
                    }
                    type="button"
                  >
                    {argument.title}
                    {argument.id === topic.currentArgumentId
                      ? ' — Current'
                      : ''}
                    {argument.archived ? ' — archived' : ''}
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

export function ArgumentView({
  argument,
  library,
  onNavigate,
  onPromote,
  onReassess,
  onReassessRelations,
  sourceSection,
}: {
  readonly argument: Argument;
  readonly library: ArgumentLibrary;
  readonly onNavigate: (selection: ArgumentSelection) => void;
  readonly onPromote: (topicId: string) => void;
  readonly onReassess: () => void;
  readonly onReassessRelations: () => void;
  readonly sourceSection: ReactNode;
}) {
  const stale = argumentStaleness(library, argument);
  const topicMemberships = library.topics.filter(({ argumentIds }) =>
    argumentIds.includes(argument.id),
  );
  const currentTopics = topicMemberships.filter(
    ({ currentArgumentId }) => currentArgumentId === argument.id,
  );
  const successors = library.arguments.filter(
    ({ supersedesArgumentId }) => supersedesArgumentId === argument.id,
  );
  const targetingCounters = library.counterArguments.filter(
    ({ target }) =>
      target?.kind === 'argument' && target.argumentId === argument.id,
  );
  return (
    <article className="arguments-record">
      <RecordHeader
        archived={argument.archived}
        eyebrow="Reasoning Argument"
        reviewState={argument.reviewState}
        title={argument.title}
      />
      <div className="arguments-badges">
        <span
          className={`arguments-badge ${stale.stale ? 'arguments-badge--stale' : 'arguments-badge--fresh'}`}
        >
          Dependencies{' '}
          {stale.stale ? 'need reassessment' : 'match referenced revisions'}
        </span>
        {currentTopics.length === 0 ? null : (
          <span className="arguments-badge">
            Current for {currentTopics.map(({ title }) => title).join(', ')}
          </span>
        )}
      </div>
      <section className="arguments-reading-section">
        <h3>Examples</h3>
        {argument.examples.length === 0 ? (
          <p className="arguments-empty">No concrete Examples recorded.</p>
        ) : (
          <ol className="arguments-premises">
            {argument.examples.map((example) => (
              <li key={example.id}>
                <code>{example.id}</code>
                <MarkdownText>{example.text}</MarkdownText>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="arguments-reading-section">
        <h3>Premises</h3>
        {argument.premises.length === 0 ? (
          <p className="arguments-empty">No premises recorded.</p>
        ) : (
          <ol className="arguments-premises">
            {argument.premises.map((premise) => {
              if (premise.kind === 'text') {
                return (
                  <li key={premise.id}>
                    <MarkdownText>{premise.text}</MarkdownText>
                    {premise.exampleIds?.length ? (
                      <small>
                        Grounded in Examples: {premise.exampleIds.join(', ')}.
                      </small>
                    ) : null}
                  </li>
                );
              }
              const referenced =
                premise.kind === 'axiom'
                  ? library.axioms.find(({ id }) => id === premise.axiomId)!
                  : library.arguments.find(
                      ({ id }) => id === premise.argumentId,
                    )!;
              const referencedKind =
                premise.kind === 'axiom' ? 'axiom' : 'argument';
              const premiseStale = stale.premiseIds.includes(premise.id);
              return (
                <li key={premise.id}>
                  <button
                    onClick={() =>
                      onNavigate({ kind: referencedKind, id: referenced.id })
                    }
                    type="button"
                  >
                    {referenced.title}
                    {premise.kind === 'argument-conclusion'
                      ? ' — conclusion'
                      : premise.kind === 'argument-premise'
                        ? ` — premise ${premise.premiseId}`
                        : ''}
                  </button>
                  <small>
                    Relied on revision {premise.reliedOnRevision}; current
                    revision {referenced.revision}
                    {premiseStale ? ' — changed' : ''}
                    {referenced.archived ? '; archived' : ''}.
                  </small>
                  {premise.exampleIds?.length ? (
                    <small>
                      Grounded in local Examples:{' '}
                      {premise.exampleIds.join(', ')}.
                    </small>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
        {stale.premiseIds.length > 0 ? (
          <div className="arguments-callout">
            <p>
              Changed premises: {stale.premiseIds.join(', ')}. This does not
              automatically change the conclusion.
            </p>
            <button onClick={onReassess} type="button">
              Reassess against current premise versions
            </button>
          </div>
        ) : null}
      </section>
      {argument.reasoning === undefined ? null : (
        <section className="arguments-reading-section">
          <h3>Reasoning</h3>
          <MarkdownText>{argument.reasoning}</MarkdownText>
        </section>
      )}
      <section className="arguments-reading-section">
        <h3>Conclusion</h3>
        <MarkdownText>{argument.conclusion}</MarkdownText>
      </section>
      {argument.boundary === undefined ? null : (
        <section className="arguments-reading-section">
          <h3>Boundary / Invariance</h3>
          <MarkdownText>{argument.boundary}</MarkdownText>
        </section>
      )}
      <section className="arguments-reading-section">
        <h3>Argument relations</h3>
        {argument.relations.length === 0 ? (
          <p className="arguments-empty">No attack or support relation.</p>
        ) : (
          <ul className="arguments-record-links">
            {argument.relations.map((relation) => {
              const target = library.arguments.find(
                ({ id }) => id === relation.targetArgumentId,
              )!;
              const relationStale = stale.relationIds.includes(relation.id);
              const part =
                relation.targetPart.kind === 'premise'
                  ? `premise ${relation.targetPart.premiseId}`
                  : relation.targetPart.kind;
              return (
                <li key={relation.id}>
                  <strong>{relation.kind}</strong>{' '}
                  <button
                    onClick={() =>
                      onNavigate({ kind: 'argument', id: target.id })
                    }
                    type="button"
                  >
                    {target.title} — {part}
                  </button>
                  <small>
                    Relied on revision {relation.reliedOnRevision}; current
                    revision {target.revision}
                    {relationStale ? ' — changed' : ''}.
                  </small>
                </li>
              );
            })}
          </ul>
        )}
        {stale.relationIds.length > 0 ? (
          <div className="arguments-callout">
            <p>
              Changed relation targets: {stale.relationIds.join(', ')}. The
              relations were not silently retargeted.
            </p>
            <button onClick={onReassessRelations} type="button">
              Reassess relation target versions
            </button>
          </div>
        ) : null}
      </section>
      <section className="arguments-reading-section">
        <h3>Topic status</h3>
        {topicMemberships.length === 0 ? (
          <p className="arguments-empty">Not assigned to a Topic.</p>
        ) : (
          <ul className="arguments-record-links">
            {topicMemberships.map((topic) => (
              <li key={topic.id}>
                <button
                  onClick={() => onNavigate({ kind: 'topic', id: topic.id })}
                  type="button"
                >
                  {topic.title}
                  {topic.currentArgumentId === argument.id ? ' — Current' : ''}
                </button>
                {topic.currentArgumentId !== argument.id &&
                argument.reviewState === 'accepted' &&
                !argument.archived ? (
                  <button onClick={() => onPromote(topic.id)} type="button">
                    Promote to Current
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {argument.supersedesArgumentId === undefined &&
      successors.length === 0 ? null : (
        <section className="arguments-reading-section">
          <h3>Supersession history</h3>
          <ul className="arguments-record-links">
            {argument.supersedesArgumentId === undefined ? null : (
              <li>
                Supersedes{' '}
                <button
                  onClick={() =>
                    onNavigate({
                      kind: 'argument',
                      id: argument.supersedesArgumentId!,
                    })
                  }
                  type="button"
                >
                  {
                    library.arguments.find(
                      ({ id }) => id === argument.supersedesArgumentId,
                    )!.title
                  }
                </button>
              </li>
            )}
            {successors.map((successor) => (
              <li key={successor.id}>
                Superseded by{' '}
                <button
                  onClick={() =>
                    onNavigate({ kind: 'argument', id: successor.id })
                  }
                  type="button"
                >
                  {successor.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="arguments-reading-section">
        <h3>Targeting Counter-Arguments</h3>
        {targetingCounters.length === 0 ? (
          <p className="arguments-empty">None.</p>
        ) : (
          <ul className="arguments-record-links">
            {targetingCounters.map((counter) => (
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
      {sourceSection}
      <Metadata library={library} record={argument} />
    </article>
  );
}

export function ArgumentAxiomView({
  axiom,
  library,
  onNavigate,
  sourceSection,
}: {
  readonly axiom: ArgumentAxiom;
  readonly library: ArgumentLibrary;
  readonly onNavigate: (selection: ArgumentSelection) => void;
  readonly sourceSection: ReactNode;
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
      {sourceSection}
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
  if (counter.target.kind === 'counter-argument')
    return `Counter-Argument: ${counter.target.counterArgumentId}`;
  return `Argument: ${counter.target.argumentId} (${counter.target.part.kind}${
    counter.target.part.kind === 'premise'
      ? ` ${counter.target.part.premiseId}`
      : ''
  })`;
}

export function ArgumentCounterArgumentView({
  counter,
  library,
  onNavigate,
  onReassess,
  sourceSection,
}: {
  readonly counter: ArgumentCounterArgument;
  readonly library: ArgumentLibrary;
  readonly onNavigate: (selection: ArgumentSelection) => void;
  readonly onReassess: () => void;
  readonly sourceSection: ReactNode;
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
      {sourceSection}
      <Metadata library={library} record={counter} />
    </article>
  );
}
