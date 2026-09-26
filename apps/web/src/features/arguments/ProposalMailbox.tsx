import { useMemo, useState } from 'react';

import type {
  Argument,
  ArgumentLibrary,
  ArgumentPremise,
  ArgumentProposal,
  ArgumentProposalIntent,
  ArgumentTargetPart,
  ProposalConsultedRecord,
} from '@icarus-graph-explorer/argument-workspace';

import type { ArgumentSelection } from './ArgumentRecordView';
import { proposalTargetStaleness } from './proposal-mailbox';

const INTENT_LABELS: Readonly<Record<ArgumentProposalIntent, string>> = {
  unspecified: 'Legacy intent not specified',
  new: 'New independent argument',
  attack: 'Attack',
  support: 'Support',
  refine: 'Refine',
  extend: 'Extend',
  'add-boundary': 'Add boundary to',
  supersede: 'Supersede',
};

function targetPartLabel(part: ArgumentTargetPart): string {
  if (part.kind === 'argument') return 'whole Argument';
  if (part.kind === 'premise') return `premise ${part.premiseId}`;
  return part.kind;
}

function targetPartPreview(argument: Argument, proposal: ArgumentProposal) {
  const part = proposal.target?.part;
  if (part === undefined || part.kind === 'argument')
    return argument.conclusion;
  if (part.kind === 'reasoning')
    return argument.reasoning ?? 'No reasoning section remains.';
  if (part.kind === 'conclusion') return argument.conclusion;
  const premise = argument.premises.find(({ id }) => id === part.premiseId);
  return premise === undefined
    ? 'The referenced premise is no longer present.'
    : premiseText(premise);
}

function premiseText(premise: ArgumentPremise): string {
  if (premise.kind === 'text') return premise.text;
  if (premise.kind === 'axiom') return `Axiom ${premise.axiomId}`;
  if (premise.kind === 'argument-conclusion')
    return `Conclusion of Argument ${premise.argumentId}`;
  return `Premise ${premise.premiseId} of Argument ${premise.argumentId}`;
}

function consultedLabel(
  library: ArgumentLibrary,
  record: ProposalConsultedRecord,
): string {
  if (record.kind === 'topic')
    return (
      library.topics.find(({ id }) => id === record.id)?.title ?? record.id
    );
  if (record.kind === 'axiom')
    return (
      library.axioms.find(({ id }) => id === record.id)?.title ?? record.id
    );
  if (record.kind === 'argument')
    return (
      library.arguments.find(({ id }) => id === record.id)?.title ?? record.id
    );
  return (
    library.counterArguments.find(({ id }) => id === record.id)?.title ??
    record.id
  );
}

function referencedArgumentContext(
  library: ArgumentLibrary,
  proposal: ArgumentProposal,
): readonly Argument[] {
  const targetId = proposal.target?.argumentId;
  const topic = library.topics.find(({ id }) => id === proposal.topicId);
  const ids = new Set<string>();
  if (targetId !== undefined) ids.add(targetId);
  if (topic?.currentArgumentId !== undefined) ids.add(topic.currentArgumentId);
  const target = library.arguments.find(({ id }) => id === targetId);
  if (target?.supersedesArgumentId !== undefined)
    ids.add(target.supersedesArgumentId);
  for (const argument of library.arguments) {
    if (argument.supersedesArgumentId === targetId) ids.add(argument.id);
    if (
      argument.relations.some(
        ({ targetArgumentId }) => targetArgumentId === targetId,
      )
    )
      ids.add(argument.id);
  }
  for (const relation of target?.relations ?? [])
    ids.add(relation.targetArgumentId);
  return [...ids]
    .map((id) => library.arguments.find((argument) => argument.id === id))
    .filter((argument): argument is Argument => argument !== undefined);
}

function RecordAction({
  children,
  id,
  kind,
  onNavigate,
}: {
  readonly children: string;
  readonly id: string;
  readonly kind: ArgumentSelection['kind'];
  readonly onNavigate: (selection: ArgumentSelection) => void;
}) {
  return (
    <button onClick={() => onNavigate({ kind, id })} type="button">
      {children}
    </button>
  );
}

function ProposalPremiseCard({
  library,
  onNavigate,
  premise,
}: {
  readonly library: ArgumentLibrary;
  readonly onNavigate: (selection: ArgumentSelection) => void;
  readonly premise: ArgumentProposal['premises'][number];
}) {
  if (premise.kind === 'text')
    return (
      <li className="arguments-mailbox__premise">
        <span className="arguments-badge">Claim</span>
        <strong>{premise.id}</strong>
        <p>{premise.text}</p>
      </li>
    );
  if (premise.kind === 'axiom') {
    const axiom = library.axioms.find(({ id }) => id === premise.axiomId);
    return (
      <li className="arguments-mailbox__premise">
        <span className="arguments-badge">Axiom dependency</span>
        <strong>{axiom?.title ?? premise.axiomId}</strong>
        <small>
          Relied on revision {premise.reliedOnRevision}; current revision{' '}
          {axiom?.revision ?? 'missing'}.
        </small>
        {axiom === undefined ? null : (
          <details>
            <summary>Preview Axiom</summary>
            <p>{axiom.statement}</p>
            <RecordAction id={axiom.id} kind="axiom" onNavigate={onNavigate}>
              Open record
            </RecordAction>
          </details>
        )}
      </li>
    );
  }
  const argument = library.arguments.find(
    ({ id }) => id === premise.argumentId,
  );
  const referencedPremise =
    premise.kind === 'argument-premise'
      ? argument?.premises.find(({ id }) => id === premise.premiseId)
      : undefined;
  return (
    <li className="arguments-mailbox__premise">
      <span className="arguments-badge">
        {premise.kind === 'argument-conclusion'
          ? 'Argument conclusion dependency'
          : 'Argument premise dependency'}
      </span>
      <strong>{argument?.title ?? premise.argumentId}</strong>
      <small>
        Relied on revision {premise.reliedOnRevision}; current revision{' '}
        {argument?.revision ?? 'missing'}.
      </small>
      {argument === undefined ? null : (
        <details>
          <summary>
            Preview{' '}
            {premise.kind === 'argument-conclusion'
              ? 'conclusion'
              : `premise ${premise.premiseId}`}
          </summary>
          <p>
            {premise.kind === 'argument-conclusion'
              ? argument.conclusion
              : referencedPremise === undefined
                ? 'The referenced premise is no longer present.'
                : premiseText(referencedPremise)}
          </p>
          <RecordAction
            id={argument.id}
            kind="argument"
            onNavigate={onNavigate}
          >
            Open record
          </RecordAction>
        </details>
      )}
    </li>
  );
}

function LocalArgumentContext({
  library,
  onNavigate,
  proposal,
}: {
  readonly library: ArgumentLibrary;
  readonly onNavigate: (selection: ArgumentSelection) => void;
  readonly proposal: ArgumentProposal;
}) {
  const topic = library.topics.find(({ id }) => id === proposal.topicId);
  const argumentsInContext = useMemo(
    () => referencedArgumentContext(library, proposal),
    [library, proposal],
  );
  if (argumentsInContext.length === 0) return null;
  return (
    <section className="arguments-mailbox__section">
      <h4>Local Argument context</h4>
      <div className="arguments-mailbox__chain" role="list">
        {argumentsInContext.map((argument) => (
          <article key={argument.id} role="listitem">
            <div className="arguments-badges">
              {argument.id === proposal.target?.argumentId ? (
                <span className="arguments-badge">Target</span>
              ) : null}
              {argument.id === topic?.currentArgumentId ? (
                <span className="arguments-badge arguments-badge--fresh">
                  Current
                </span>
              ) : null}
            </div>
            <strong>{argument.title}</strong>
            <p>{argument.conclusion}</p>
            <details>
              <summary>Inspect Argument</summary>
              {argument.reasoning === undefined ? null : (
                <p>{argument.reasoning}</p>
              )}
              <RecordAction
                id={argument.id}
                kind="argument"
                onNavigate={onNavigate}
              >
                Open record
              </RecordAction>
            </details>
          </article>
        ))}
        <article className="arguments-mailbox__proposal-marker" role="listitem">
          <span className="arguments-badge">Proposal</span>
          <strong>{INTENT_LABELS[proposal.intent]}</strong>
          <p>{proposal.title}</p>
        </article>
      </div>
    </section>
  );
}

export function ProposalMailbox({
  busy,
  library,
  onAccept,
  onClose,
  onCopy,
  onNavigate,
  onReject,
}: {
  readonly busy: boolean;
  readonly library: ArgumentLibrary;
  readonly onAccept: (proposal: ArgumentProposal) => void;
  readonly onClose: () => void;
  readonly onCopy: (value: string, message: string) => void;
  readonly onNavigate: (selection: ArgumentSelection) => void;
  readonly onReject: (proposal: ArgumentProposal) => void;
}) {
  const [view, setView] = useState<'pending' | 'history'>('pending');
  const [selectedId, setSelectedId] = useState<string>();
  const proposals = library.proposals.filter(({ status }) =>
    view === 'pending' ? status === 'pending' : status !== 'pending',
  );
  const selected =
    proposals.find(({ id }) => id === selectedId) ?? proposals[0];
  const targetStale =
    selected === undefined
      ? undefined
      : proposalTargetStaleness(library, selected);
  const target =
    selected?.target === undefined
      ? undefined
      : library.arguments.find(({ id }) => id === selected.target?.argumentId);
  const topic = library.topics.find(({ id }) => id === selected?.topicId);
  return (
    <section
      aria-labelledby="arguments-mailbox-title"
      className="arguments-subdialog arguments-mailbox"
      role="dialog"
    >
      <div>
        <header>
          <p className="eyebrow">Non-canonical review queue</p>
          <h2 id="arguments-mailbox-title">Proposal Mailbox</h2>
          <p>
            Review the proposed argument structure and provenance. Canonical
            mutation still requires the separate human resolution editor.
          </p>
        </header>
        <div className="arguments-actions" role="tablist">
          {(['pending', 'history'] as const).map((tab) => (
            <button
              aria-selected={view === tab}
              key={tab}
              onClick={() => {
                setView(tab);
                setSelectedId(undefined);
              }}
              role="tab"
              type="button"
            >
              {tab === 'pending'
                ? `Pending (${library.proposals.filter(({ status }) => status === 'pending').length})`
                : 'History'}
            </button>
          ))}
        </div>
        <div className="arguments-mailbox__layout">
          <nav aria-label={`${view} proposals`}>
            {proposals.length === 0 ? (
              <p className="arguments-empty">
                {view === 'pending'
                  ? 'No pending proposals.'
                  : 'No resolved proposals.'}
              </p>
            ) : (
              <ul>
                {proposals.map((proposal) => (
                  <li key={proposal.id}>
                    <button
                      aria-current={
                        proposal.id === selected?.id ? 'page' : undefined
                      }
                      onClick={() => setSelectedId(proposal.id)}
                      type="button"
                    >
                      <strong>{proposal.title}</strong>
                      <small>{INTENT_LABELS[proposal.intent]}</small>
                      <small>
                        {library.topics.find(
                          ({ id }) => id === proposal.topicId,
                        )?.title ?? 'No Topic'}
                      </small>
                      <span>{proposal.conclusion}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>
          {selected === undefined ? null : (
            <article className="arguments-mailbox__detail">
              <header className="arguments-mailbox__proposal-header">
                <div className="arguments-badges">
                  <span className="arguments-badge">{selected.status}</span>
                  <span className="arguments-badge">
                    {INTENT_LABELS[selected.intent]}
                  </span>
                </div>
                <p className="eyebrow">{topic?.title ?? 'No Topic assigned'}</p>
                <h3>{selected.title}</h3>
                {target === undefined ? (
                  <p>No existing Argument is targeted.</p>
                ) : (
                  <p>
                    {INTENT_LABELS[selected.intent]}{' '}
                    <strong>{target.title}</strong> —{' '}
                    {targetPartLabel(selected.target!.part)}
                  </p>
                )}
                <small>
                  Submitted {new Date(selected.createdAt).toLocaleString()} ·
                  consultation snapshot revision{' '}
                  {selected.consultation.libraryRevision}
                </small>
              </header>
              {targetStale === undefined ? null : (
                <p className="arguments-error" role="alert">
                  Stale target: {targetStale} Review the current record before
                  resolving.
                </p>
              )}
              {target === undefined ? null : (
                <section className="arguments-mailbox__section">
                  <h4>Target Argument</h4>
                  <details>
                    <summary>
                      {target.title} — {targetPartLabel(selected.target!.part)}
                    </summary>
                    <p>{targetPartPreview(target, selected)}</p>
                    <small>
                      Relied on revision {selected.target!.reliedOnRevision};
                      current revision {target.revision}. ID {target.id}.
                    </small>
                    <RecordAction
                      id={target.id}
                      kind="argument"
                      onNavigate={onNavigate}
                    >
                      Open record
                    </RecordAction>
                  </details>
                </section>
              )}
              <LocalArgumentContext
                library={library}
                onNavigate={onNavigate}
                proposal={selected}
              />
              {selected.examples.length === 0 ? null : (
                <section className="arguments-mailbox__section">
                  <h4>Examples</h4>
                  <ul>
                    {selected.examples.map((example, index) => (
                      <li key={`${index}:${example}`}>{example}</li>
                    ))}
                  </ul>
                </section>
              )}
              {selected.premises.length === 0 ? null : (
                <section className="arguments-mailbox__section">
                  <h4>Premises / dependencies</h4>
                  <ol className="arguments-mailbox__premises">
                    {selected.premises.map((premise) => (
                      <ProposalPremiseCard
                        key={premise.id}
                        library={library}
                        onNavigate={onNavigate}
                        premise={premise}
                      />
                    ))}
                  </ol>
                </section>
              )}
              {selected.reasoning === undefined &&
              selected.reasoningSteps.length === 0 ? null : (
                <section className="arguments-mailbox__section">
                  <h4>Reasoning</h4>
                  {selected.reasoning === undefined ? null : (
                    <p>{selected.reasoning}</p>
                  )}
                  {selected.reasoningSteps.length === 0 ? null : (
                    <ol className="arguments-mailbox__reasoning">
                      {selected.reasoningSteps.map((step) => (
                        <li key={step.id}>
                          <strong>{step.id}</strong>
                          <p>{step.text}</p>
                          {step.uses.length === 0 ? null : (
                            <small>
                              Uses{' '}
                              {step.uses
                                .map((reference) =>
                                  reference.kind === 'premise'
                                    ? reference.premiseId
                                    : reference.stepId,
                                )
                                .join(', ')}
                            </small>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}
              <section className="arguments-mailbox__section arguments-mailbox__conclusion">
                <h4>Conclusion</h4>
                <p>{selected.conclusion}</p>
              </section>
              {selected.boundary === undefined ? null : (
                <section className="arguments-mailbox__section">
                  <h4>Boundary</h4>
                  <p>{selected.boundary}</p>
                </section>
              )}
              {selected.sourceObservations.length === 0 ? null : (
                <section className="arguments-mailbox__section">
                  <h4>Source observations / provenance</h4>
                  <ul className="arguments-mailbox__sources">
                    {selected.sourceObservations.map((observation) => (
                      <li key={observation.id}>
                        <strong>
                          {observation.label ?? 'Source observation'}
                        </strong>
                        <p>{observation.observation}</p>
                        <div className="arguments-mailbox__source-meta">
                          {observation.repository === undefined ? null : (
                            <span>{observation.repository}</span>
                          )}
                          {observation.filePath === undefined ? null : (
                            <span>{observation.filePath}</span>
                          )}
                          {observation.heading === undefined ? null : (
                            <span>§ {observation.heading}</span>
                          )}
                          {observation.span === undefined ? null : (
                            <span>{observation.span}</span>
                          )}
                          {observation.sourceVersion === undefined ? null : (
                            <span title={observation.sourceVersion}>
                              Version {observation.sourceVersion}
                            </span>
                          )}
                          {observation.commitSha === undefined ? null : (
                            <span>
                              {observation.url === undefined ? (
                                <code title={observation.commitSha}>
                                  {observation.commitSha.slice(0, 8)}
                                </code>
                              ) : (
                                <a
                                  href={observation.url}
                                  rel="noreferrer"
                                  target="_blank"
                                  title={observation.commitSha}
                                >
                                  {observation.commitSha.slice(0, 8)}
                                </a>
                              )}
                              <button
                                onClick={() =>
                                  onCopy(
                                    observation.commitSha!,
                                    'Commit SHA copied',
                                  )
                                }
                                type="button"
                              >
                                Copy SHA
                              </button>
                            </span>
                          )}
                          {observation.url === undefined ||
                          observation.commitSha !== undefined ? null : (
                            <a
                              href={observation.url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Open source
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="arguments-mailbox__section">
                <h4>Why novel / unresolved</h4>
                <p>{selected.whyNovelOrUnresolved}</p>
              </section>
              <details className="arguments-mailbox__technical">
                <summary>Consulted records and technical metadata</summary>
                <ul>
                  {selected.consultation.records.map((record) => (
                    <li key={`${record.kind}:${record.id}`}>
                      <strong>{consultedLabel(library, record)}</strong>{' '}
                      <small>
                        {record.kind} · {record.id}
                        {record.revision === undefined
                          ? ''
                          : ` · revision ${record.revision}`}
                      </small>
                    </li>
                  ))}
                </ul>
                <p>
                  Proposal ID <code>{selected.id}</code>
                </p>
              </details>
              {selected.decision === undefined ? null : (
                <section className="arguments-mailbox__decision">
                  <h4>Human decision</h4>
                  {selected.decision.note === undefined ? null : (
                    <p>{selected.decision.note}</p>
                  )}
                  {selected.decision.resultingArgumentId ===
                  undefined ? null : (
                    <RecordAction
                      id={selected.decision.resultingArgumentId}
                      kind="argument"
                      onNavigate={onNavigate}
                    >
                      Open resulting Argument
                    </RecordAction>
                  )}
                  {selected.decision.resultingCounterArgumentId ===
                  undefined ? null : (
                    <RecordAction
                      id={selected.decision.resultingCounterArgumentId}
                      kind="counter-argument"
                      onNavigate={onNavigate}
                    >
                      Open resulting Counter-Argument
                    </RecordAction>
                  )}
                </section>
              )}
              {selected.status !== 'pending' ? null : (
                <div className="arguments-actions">
                  <button
                    disabled={busy}
                    onClick={() => onReject(selected)}
                    type="button"
                  >
                    Reject / Record response
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onAccept(selected)}
                    type="button"
                  >
                    Accept / Integrate
                  </button>
                </div>
              )}
            </article>
          )}
        </div>
        <div className="arguments-actions">
          <button onClick={onClose} type="button">
            Close Mailbox
          </button>
        </div>
      </div>
    </section>
  );
}
