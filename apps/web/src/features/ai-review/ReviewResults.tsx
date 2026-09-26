import { useEffect, useMemo, useState } from 'react';

import type {
  IntegrationResult,
  PostCheckResult,
  ReviewAttemptRecord,
  ReviewRunRecord,
  VerifiedContributionReference,
} from '@icarus-graph-explorer/ai-review';

import { SafeMarkdown } from '../../components/markdown/SafeMarkdown';

type ResultTab =
  'integrated' | 'negative' | 'positive' | 'compare' | 'post-check';

function currentAttempt(
  run: ReviewRunRecord,
  stage: ReviewAttemptRecord['stage'],
): ReviewAttemptRecord | undefined {
  const id = run.currentAttemptIds[stage];
  return id === undefined
    ? undefined
    : run.attempts.find((attempt) => attempt.id === id);
}

function isSynthetic(run: ReviewRunRecord): boolean {
  return Object.values(run.models).some(({ provider, model }) =>
    /synthetic|scripted|fixture|test/iu.test(`${provider} ${model}`),
  );
}

function References({
  references,
}: {
  readonly references: readonly VerifiedContributionReference[];
}) {
  if (references.length === 0) return <span>Not addressed</span>;
  return (
    <ul className="review-reference-list">
      {references.map((reference, index) => (
        <li key={`${reference.attemptId}-${index}`}>
          {reference.verification === 'verified' ? (
            <a href={`#review-attempt-${reference.attemptId}`}>
              Verified passage in{' '}
              <span translate="no">{reference.attemptId}</span>
            </a>
          ) : (
            <span className="review-reference--invalid">
              Invalid reference to{' '}
              <span translate="no">{reference.attemptId}</span>
              {reference.verificationMessage
                ? ` — ${reference.verificationMessage}`
                : ''}
            </span>
          )}
          {reference.quote === undefined ? null : (
            <blockquote>{reference.quote}</blockquote>
          )}
          {reference.locator === undefined ? null : (
            <small>{reference.locator}</small>
          )}
        </li>
      ))}
    </ul>
  );
}

function AttemptView({
  attempt,
}: {
  readonly attempt: ReviewAttemptRecord | undefined;
}) {
  const [raw, setRaw] = useState(false);
  if (attempt === undefined)
    return <p className="review-empty">No attempt exists for this stage.</p>;
  return (
    <article
      className="review-attempt"
      id={`review-attempt-${attempt.id}`}
      tabIndex={-1}
    >
      <header className="review-attempt__header">
        <div>
          <h3>
            {attempt.stage === 'post-check' ? 'Post-check' : attempt.stage}
          </h3>
          <p>
            Attempt {attempt.number} · {attempt.state} ·{' '}
            {attempt.current ? 'current' : 'superseded'}
          </p>
        </div>
        <div className="review-inline-actions">
          <button
            disabled={attempt.output === undefined}
            onClick={() =>
              void navigator.clipboard.writeText(
                attempt.output?.rawMarkdown ?? '',
              )
            }
            type="button"
          >
            Copy Original
          </button>
          <button onClick={() => setRaw((value) => !value)} type="button">
            {raw ? 'Formatted Output' : 'Raw Output'}
          </button>
        </div>
      </header>
      {attempt.error === undefined ? null : (
        <p className="review-error" role="status">
          {attempt.error.code}: {attempt.error.message}
        </p>
      )}
      {attempt.terminalStatus === undefined ? null : (
        <p className="review-evidence-label">
          Provider status: {attempt.terminalStatus}
        </p>
      )}
      {attempt.cancellation === undefined ? null : (
        <p className="review-evidence-label">
          Cancellation requested: {attempt.cancellation.reason} · Remote
          termination{' '}
          {attempt.cancellation.remoteTerminationConfirmed
            ? 'confirmed'
            : 'not confirmed'}
        </p>
      )}
      {attempt.output === undefined ? (
        <p className="review-empty">
          No retained output. The attempt may still be running or failed before
          producing text.
        </p>
      ) : raw ? (
        <pre className="review-raw-output">{attempt.output.rawMarkdown}</pre>
      ) : (
        <SafeMarkdown markdown={attempt.output.rawMarkdown} />
      )}
      <details>
        <summary>Exact prompt & evidence</summary>
        <p>
          Tools available: {attempt.toolsAvailable.join(', ') || 'disabled'}
        </p>
        <p>
          Records retrieved:{' '}
          {attempt.recordsRetrieved
            .map(({ canonicalId, revision }) => `${canonicalId}@${revision}`)
            .join(', ') || 'none'}
        </p>
        <p>
          Usage:{' '}
          {attempt.usage === undefined
            ? 'unavailable'
            : JSON.stringify(attempt.usage)}
        </p>
        <pre className="review-raw-output">{attempt.prompt.text}</pre>
      </details>
    </article>
  );
}

function IntegratedView({
  attempt,
}: {
  readonly attempt: ReviewAttemptRecord | undefined;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const structured =
    attempt?.output?.structuredStatus === 'valid' &&
    attempt.stage === 'integrator'
      ? (attempt.output.structured as IntegrationResult)
      : undefined;
  if (attempt === undefined)
    return <p className="review-empty">Integration has not been produced.</p>;
  if (structured === undefined) return <AttemptView attempt={attempt} />;
  return (
    <article className="review-integrated">
      <header className="review-attempt__header">
        <div>
          <h3>Integrated Review</h3>
          <p>Validated issue alignment from attempt {attempt.number}</p>
        </div>
        <button onClick={() => setShowRaw((value) => !value)} type="button">
          {showRaw ? 'Structured View' : 'Original Raw Output'}
        </button>
      </header>
      {showRaw ? (
        <pre className="review-raw-output">{attempt.output?.rawMarkdown}</pre>
      ) : (
        <>
          <SafeMarkdown markdown={structured.summary} />
          {structured.issues.map((issue) => (
            <section className="review-issue" key={issue.id}>
              <p className="review-badge">{issue.relation}</p>
              <h4>{issue.id}</h4>
              <div className="review-issue__contributions">
                <div>
                  <h5>Negative Contribution</h5>
                  {issue.negativeContribution === undefined ? (
                    <p>Not addressed</p>
                  ) : (
                    <SafeMarkdown markdown={issue.negativeContribution} />
                  )}
                  <References references={issue.negativeReferences} />
                </div>
                <div>
                  <h5>Positive Contribution</h5>
                  {issue.positiveContribution === undefined ? (
                    <p>Not addressed</p>
                  ) : (
                    <SafeMarkdown markdown={issue.positiveContribution} />
                  )}
                  <References references={issue.positiveReferences} />
                </div>
              </div>
              <h5>Integration</h5>
              <SafeMarkdown markdown={issue.integrationMarkdown} />
              {issue.unresolvedPoints.length === 0 ? null : (
                <>
                  <h5>Unresolved Points</h5>
                  <ul>
                    {issue.unresolvedPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </>
              )}
              {issue.integratorNotes.length === 0 ? null : (
                <aside className="review-integrator-note">
                  <strong>Integrator Notes</strong>
                  <ul>
                    {issue.integratorNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </aside>
              )}
            </section>
          ))}
          {structured.unresolvedQuestions.length === 0 ? null : (
            <section>
              <h4>Unresolved Questions</h4>
              <ul>
                {structured.unresolvedQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </section>
          )}
          {structured.validationWarnings.length === 0 ? null : (
            <p className="review-warning" role="status">
              Reference warnings: {structured.validationWarnings.join(' ')}
            </p>
          )}
        </>
      )}
    </article>
  );
}

function CompareView({
  negative,
  positive,
  integration,
}: {
  readonly negative: ReviewAttemptRecord | undefined;
  readonly positive: ReviewAttemptRecord | undefined;
  readonly integration: ReviewAttemptRecord | undefined;
}) {
  const [mode, setMode] = useState<'original' | 'aligned'>('original');
  const [layout, setLayout] = useState<'stacked' | 'horizontal'>('stacked');
  const [wideEnoughForColumns, setWideEnoughForColumns] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 801px)').matches
      : true,
  );
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const wide = window.matchMedia('(min-width: 801px)');
    const update = ({ matches }: MediaQueryListEvent) => {
      setWideEnoughForColumns(matches);
      if (!matches) setLayout('stacked');
    };
    wide.addEventListener('change', update);
    return () => wide.removeEventListener('change', update);
  }, []);
  const structured =
    integration?.output?.structuredStatus === 'valid'
      ? (integration.output.structured as IntegrationResult)
      : undefined;
  return (
    <section className="review-compare">
      <div className="review-segmented" aria-label="Comparison mode">
        <button
          aria-pressed={mode === 'original'}
          onClick={() => setMode('original')}
          type="button"
        >
          Original Outputs
        </button>
        <button
          aria-pressed={mode === 'aligned'}
          disabled={structured === undefined}
          onClick={() => setMode('aligned')}
          type="button"
        >
          Aligned by Issue
        </button>
        <button
          aria-pressed={layout === 'stacked'}
          onClick={() => setLayout('stacked')}
          type="button"
        >
          Stacked
        </button>
        <button
          aria-pressed={layout === 'horizontal'}
          disabled={!wideEnoughForColumns}
          onClick={() => setLayout('horizontal')}
          type="button"
          title={
            wideEnoughForColumns
              ? undefined
              : 'Side-by-side comparison requires a wider window.'
          }
        >
          Side by Side
        </button>
      </div>
      {mode === 'original' ? (
        <div
          className={`review-compare__panes review-compare__panes--${layout}`}
        >
          <div>
            <h3>Negative — Original</h3>
            <AttemptView attempt={negative} />
          </div>
          <div>
            <h3>Positive — Original</h3>
            <AttemptView attempt={positive} />
          </div>
        </div>
      ) : (
        <div className="review-aligned">
          <p className="review-evidence-label">
            Aligned contributions are Integrator extracts/paraphrases. Follow
            verified references to original attempts.
          </p>
          {structured?.issues.map((issue) => (
            <article className="review-issue" key={issue.id}>
              <h3>
                {issue.id} · {issue.relation}
              </h3>
              <div
                className={`review-compare__panes review-compare__panes--${layout}`}
              >
                <div>
                  <h4>Negative</h4>
                  {issue.negativeContribution ? (
                    <SafeMarkdown markdown={issue.negativeContribution} />
                  ) : (
                    <p>Not addressed</p>
                  )}
                  <References references={issue.negativeReferences} />
                </div>
                <div>
                  <h4>Positive</h4>
                  {issue.positiveContribution ? (
                    <SafeMarkdown markdown={issue.positiveContribution} />
                  ) : (
                    <p>Not addressed</p>
                  )}
                  <References references={issue.positiveReferences} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PostCheckView({
  attempt,
}: {
  readonly attempt: ReviewAttemptRecord | undefined;
}) {
  const structured =
    attempt?.output?.structuredStatus === 'valid' &&
    attempt.stage === 'post-check'
      ? (attempt.output.structured as PostCheckResult)
      : undefined;
  if (structured === undefined) return <AttemptView attempt={attempt} />;
  return (
    <article>
      <h3>Separate Post-check</h3>
      <SafeMarkdown markdown={structured.summary} />
      {structured.findings.map((finding) => (
        <section className="review-issue" key={finding.id}>
          <p className="review-badge">{finding.kind}</p>
          <SafeMarkdown markdown={finding.markdown} />
          <References references={finding.references} />
        </section>
      ))}
      {structured.revisedSynthesis === undefined ? null : (
        <section>
          <h4>Revised Synthesis</h4>
          <SafeMarkdown markdown={structured.revisedSynthesis} />
        </section>
      )}
    </article>
  );
}

export default function ReviewResults({
  run,
}: {
  readonly run: ReviewRunRecord;
}) {
  const [tab, setTab] = useState<ResultTab>('integrated');
  const attempts = useMemo(
    () => ({
      negative: currentAttempt(run, 'negative'),
      positive: currentAttempt(run, 'positive'),
      integrator: currentAttempt(run, 'integrator'),
      postCheck: currentAttempt(run, 'post-check'),
    }),
    [run],
  );
  const tabs: ResultTab[] = ['integrated', 'negative', 'positive', 'compare'];
  if (attempts.postCheck !== undefined) tabs.push('post-check');
  return (
    <section className="review-results" aria-labelledby="review-results-title">
      <div className="review-section-heading">
        <div>
          <p className="eyebrow">Retained run · {run.state}</p>
          <h2 id="review-results-title">Results</h2>
        </div>
      </div>
      {isSynthetic(run) ? (
        <p className="review-synthetic-banner" role="status">
          SYNTHETIC REVIEW OUTPUT — NOT AN AI CONCLUSION
        </p>
      ) : null}
      <div
        className="review-tablist"
        role="tablist"
        aria-label="Review results"
      >
        {tabs.map((candidate) => (
          <button
            aria-selected={tab === candidate}
            key={candidate}
            onClick={() => setTab(candidate)}
            role="tab"
            type="button"
          >
            {candidate === 'post-check'
              ? 'Post-check'
              : candidate[0]!.toUpperCase() + candidate.slice(1)}
          </button>
        ))}
      </div>
      <div className="review-results__body" role="tabpanel">
        {tab === 'integrated' ? (
          <IntegratedView attempt={attempts.integrator} />
        ) : null}
        {tab === 'negative' ? (
          <AttemptView attempt={attempts.negative} />
        ) : null}
        {tab === 'positive' ? (
          <AttemptView attempt={attempts.positive} />
        ) : null}
        {tab === 'compare' ? (
          <CompareView
            integration={attempts.integrator}
            negative={attempts.negative}
            positive={attempts.positive}
          />
        ) : null}
        {tab === 'post-check' ? (
          <PostCheckView attempt={attempts.postCheck} />
        ) : null}
      </div>
      <details className="review-attempt-history">
        <summary>All attempts ({run.attempts.length})</summary>
        <ul>
          {run.attempts.map((attempt) => (
            <li key={attempt.id}>
              <span translate="no">{attempt.id}</span> · {attempt.stage} ·{' '}
              {attempt.state} · {attempt.current ? 'current' : 'superseded'}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
