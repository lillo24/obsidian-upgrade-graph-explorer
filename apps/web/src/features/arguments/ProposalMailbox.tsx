import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

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
import { SafeMarkdown } from '../../components/markdown/SafeMarkdown';
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

const STATUS_LABELS: Readonly<Record<ArgumentProposal['status'], string>> = {
  pending: 'To store',
  discarded: 'Discarded',
  stored: 'Stored',
};

function proposalStatusLabel(proposal: ArgumentProposal): string {
  if (proposal.status !== 'stored') return STATUS_LABELS[proposal.status];
  const kinds = new Set(
    proposal.decision?.resultingRecords.map(({ kind }) => kind) ?? [],
  );
  if (kinds.size !== 1) return STATUS_LABELS.stored;
  return kinds.has('argument')
    ? 'Stored as Argument'
    : 'Stored as Counter-Argument';
}

export interface ProposalDraftTextEdits {
  readonly revisionReason: string;
  readonly title: string;
  readonly softExplanationMarkdown: string;
  readonly reasoning: string;
  readonly conclusion: string;
  readonly boundary: string;
  readonly whyNovelOrUnresolved: string;
}

export interface ProposalMailboxHandle {
  discardUnsavedEdit(): void;
  focusInitial(): void;
  hasUnsavedEdit(): boolean;
  saveUnsavedEdit(): Promise<boolean>;
}

interface ProposalMailboxProps {
  readonly busy: boolean;
  readonly library: ArgumentLibrary;
  readonly onAccept: (proposal: ArgumentProposal) => void;
  readonly onCopy: (value: string, message: string) => void;
  readonly onDirtyChange: (dirty: boolean) => void;
  readonly onDiscard: (proposal: ArgumentProposal) => void;
  readonly onEdit: (
    proposal: ArgumentProposal,
    edits: ProposalDraftTextEdits,
  ) => Promise<boolean>;
  readonly onNavigate: (selection: ArgumentSelection) => void;
  readonly onReject: (proposal: ArgumentProposal) => void;
  readonly onReload: () => void;
  readonly operationError?: string;
}

function proposalDraftTextEdits(
  proposal: ArgumentProposal,
): ProposalDraftTextEdits {
  return {
    revisionReason: '',
    title: proposal.title,
    softExplanationMarkdown: proposal.softExplanationMarkdown ?? '',
    reasoning: proposal.reasoning ?? '',
    conclusion: proposal.conclusion,
    boundary: proposal.boundary ?? '',
    whyNovelOrUnresolved: proposal.whyNovelOrUnresolved,
  };
}

function proposalDraftChanged(
  proposal: ArgumentProposal | undefined,
  editDraft:
    ({ readonly proposalId: string } & ProposalDraftTextEdits) | undefined,
): boolean {
  if (proposal === undefined || editDraft === undefined) return false;
  const baseline = proposalDraftTextEdits(proposal);
  return (Object.keys(baseline) as (keyof ProposalDraftTextEdits)[]).some(
    (key) => baseline[key] !== editDraft[key],
  );
}

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

export const ProposalMailbox = forwardRef<
  ProposalMailboxHandle,
  ProposalMailboxProps
>(function ProposalMailbox(
  {
    busy,
    library,
    onAccept,
    onCopy,
    onDirtyChange,
    onDiscard,
    onEdit,
    onNavigate,
    onReject,
    onReload,
    operationError,
  },
  ref,
) {
  const [view, setView] = useState<'pending' | 'history'>('pending');
  const [selectedId, setSelectedId] = useState<string>();
  const [editDraft, setEditDraft] = useState<
    { readonly proposalId: string } & ProposalDraftTextEdits
  >();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);
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
  const editedProposal = library.proposals.find(
    ({ id }) => id === editDraft?.proposalId,
  );
  const editDirty = proposalDraftChanged(editedProposal, editDraft);
  const saveEdit = useCallback(async (): Promise<boolean> => {
    if (editDraft === undefined || editedProposal === undefined) return true;
    if (!editDirty) {
      setEditDraft(undefined);
      return true;
    }
    const saved = await onEdit(editedProposal, editDraft);
    if (saved) setEditDraft(undefined);
    return saved;
  }, [editDraft, editDirty, editedProposal, onEdit]);

  useEffect(() => {
    onDirtyChange(editDirty);
  }, [editDirty, onDirtyChange]);

  useEffect(
    () => () => {
      onDirtyChange(false);
    },
    [onDirtyChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      discardUnsavedEdit() {
        setEditDraft(undefined);
      },
      focusInitial() {
        (selectedButtonRef.current ?? headingRef.current)?.focus();
      },
      hasUnsavedEdit() {
        return editDirty;
      },
      saveUnsavedEdit: saveEdit,
    }),
    [editDirty, saveEdit],
  );

  return (
    <section
      aria-labelledby="arguments-to-store-tab"
      className="arguments-mailbox"
      id="arguments-to-store-panel"
      role="tabpanel"
    >
      <div className="arguments-mailbox__surface">
        <header className="arguments-mailbox__intro">
          <p className="eyebrow">Non-canonical staging area</p>
          <h2 id="arguments-mailbox-title" ref={headingRef} tabIndex={-1}>
            To store
          </h2>
          <p>
            Develop active To store drafts over time. Staging revisions and
            links are non-canonical; storage still requires the separate human
            resolution editor.
          </p>
        </header>
        <div
          aria-label="Proposal staging status"
          className="arguments-actions arguments-mailbox__tabs"
          role="tablist"
        >
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
                ? `Active (${library.proposals.filter(({ status }) => status === 'pending').length})`
                : 'History'}
            </button>
          ))}
        </div>
        <div className="arguments-mailbox__layout">
          <nav aria-label={`${view} proposals`}>
            {proposals.length === 0 ? (
              <p className="arguments-empty">
                {view === 'pending'
                  ? 'No proposals to store.'
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
                      ref={
                        proposal.id === selected?.id
                          ? selectedButtonRef
                          : undefined
                      }
                      type="button"
                    >
                      <strong className="arguments-mailbox__row-title">
                        {proposal.title}
                      </strong>
                      <small className="arguments-mailbox__row-meta">
                        {INTENT_LABELS[proposal.intent]} ·{' '}
                        {library.topics.find(
                          ({ id }) => id === proposal.topicId,
                        )?.title ?? 'No Topic'}
                      </small>
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
                  <span className="arguments-badge">
                    {proposalStatusLabel(selected)}
                  </span>
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
                  Revision {selected.revision} · created{' '}
                  {new Date(selected.createdAt).toLocaleString()} · updated{' '}
                  {new Date(selected.updatedAt).toLocaleString()}
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
              {selected.softExplanationMarkdown === undefined ? null : (
                <section className="arguments-mailbox__soft-explanation">
                  <p className="eyebrow">Fast review</p>
                  <h4>What this means</h4>
                  <SafeMarkdown markdown={selected.softExplanationMarkdown} />
                </section>
              )}
              <h4 className="arguments-mailbox__formal-title">
                Formal argument
              </h4>
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
              {selected.draftRelations.length === 0 ? null : (
                <section className="arguments-mailbox__section">
                  <h4>Draft Proposal relationships</h4>
                  <p>
                    Staging intent only; these links are not canonical Argument
                    relations.
                  </p>
                  <ul>
                    {selected.draftRelations.map((relation) => {
                      const related = library.proposals.find(
                        ({ id }) => id === relation.targetProposalId,
                      );
                      return (
                        <li key={relation.id}>
                          <strong>{relation.kind}</strong> →{' '}
                          {related?.title ?? relation.targetProposalId}{' '}
                          <small>
                            revision {relation.targetProposalRevision}
                            {related === undefined
                              ? ' · missing'
                              : related.revision ===
                                  relation.targetProposalRevision
                                ? ' · current'
                                : ` · now revision ${related.revision}`}
                          </small>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              <details className="arguments-mailbox__technical">
                <summary>
                  Revision history ({selected.revisionHistory.length} prior)
                </summary>
                {selected.revisionHistory.length === 0 ? (
                  <p>This Proposal has not been revised.</p>
                ) : (
                  <ol>
                    {[...selected.revisionHistory].reverse().map((revision) => (
                      <li key={revision.revision}>
                        <strong>Revision {revision.revision}</strong>{' '}
                        <small>
                          replaced{' '}
                          {new Date(revision.replacedAt).toLocaleString()}
                        </small>
                        <p>{revision.revisionReason}</p>
                        <details>
                          <summary>{revision.content.title}</summary>
                          <p>{revision.content.conclusion}</p>
                        </details>
                      </li>
                    ))}
                  </ol>
                )}
              </details>
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
                  <h4>
                    {selected.status === 'discarded'
                      ? 'Staging decision'
                      : 'Canonical storage decision'}
                  </h4>
                  {selected.decision.note === undefined ? null : (
                    <p>{selected.decision.note}</p>
                  )}
                  {selected.decision.resultingRecords.map((record) => (
                    <RecordAction
                      id={record.id}
                      key={`${record.kind}:${record.id}`}
                      kind={record.kind}
                      onNavigate={onNavigate}
                    >
                      {record.kind === 'argument'
                        ? 'Open resulting Argument'
                        : 'Open resulting Counter-Argument'}
                    </RecordAction>
                  ))}
                </section>
              )}
              {selected.status !== 'pending' ? null : (
                <>
                  {editDraft?.proposalId !== selected.id ? null : (
                    <form
                      className="arguments-mailbox__section"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveEdit();
                      }}
                    >
                      <h4>Edit active draft</h4>
                      <p>
                        This creates a recoverable Proposal revision; it does
                        not store canonical theory.
                      </p>
                      <label>
                        Revision reason
                        <textarea
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current === undefined
                                ? current
                                : {
                                    ...current,
                                    revisionReason: event.target.value,
                                  },
                            )
                          }
                          required
                          value={editDraft.revisionReason}
                        />
                      </label>
                      <label>
                        Title
                        <input
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current === undefined
                                ? current
                                : { ...current, title: event.target.value },
                            )
                          }
                          required
                          value={editDraft.title}
                        />
                      </label>
                      <label>
                        Soft Explanation (Markdown)
                        <textarea
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current === undefined
                                ? current
                                : {
                                    ...current,
                                    softExplanationMarkdown: event.target.value,
                                  },
                            )
                          }
                          value={editDraft.softExplanationMarkdown}
                        />
                      </label>
                      <label>
                        Reasoning
                        <textarea
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current === undefined
                                ? current
                                : {
                                    ...current,
                                    reasoning: event.target.value,
                                  },
                            )
                          }
                          value={editDraft.reasoning}
                        />
                      </label>
                      <label>
                        Conclusion
                        <textarea
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current === undefined
                                ? current
                                : {
                                    ...current,
                                    conclusion: event.target.value,
                                  },
                            )
                          }
                          required
                          value={editDraft.conclusion}
                        />
                      </label>
                      <label>
                        Boundary
                        <textarea
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current === undefined
                                ? current
                                : { ...current, boundary: event.target.value },
                            )
                          }
                          value={editDraft.boundary}
                        />
                      </label>
                      <label>
                        Why novel / unresolved
                        <textarea
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current === undefined
                                ? current
                                : {
                                    ...current,
                                    whyNovelOrUnresolved: event.target.value,
                                  },
                            )
                          }
                          required
                          value={editDraft.whyNovelOrUnresolved}
                        />
                      </label>
                      <div className="arguments-actions">
                        <button
                          onClick={() => setEditDraft(undefined)}
                          type="button"
                        >
                          Cancel edit
                        </button>
                        <button disabled={busy} type="submit">
                          Save draft revision
                        </button>
                      </div>
                    </form>
                  )}
                  {editDraft === undefined ? (
                    <div className="arguments-actions">
                      <button
                        disabled={busy}
                        onClick={() =>
                          setEditDraft({
                            proposalId: selected.id,
                            ...proposalDraftTextEdits(selected),
                          })
                        }
                        type="button"
                      >
                        Edit draft
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => onDiscard(selected)}
                        type="button"
                      >
                        Discard
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => onReject(selected)}
                        type="button"
                      >
                        Store refutation / Counter-Argument…
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => onAccept(selected)}
                        type="button"
                      >
                        Store as Argument…
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </article>
          )}
        </div>
        {operationError === undefined ? null : (
          <div
            className="arguments-error arguments-operation-error"
            role="alert"
          >
            <p>{operationError}</p>
            <button disabled={busy} onClick={onReload} type="button">
              Reload confirmed library and review draft
            </button>
          </div>
        )}
      </div>
    </section>
  );
});
