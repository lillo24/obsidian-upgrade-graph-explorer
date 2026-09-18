import {
  forwardRef,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useImperativeHandle,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react';

import {
  ARGUMENT_WORKSPACE_INSERT_TEMPLATE,
  canonicalJson,
  createKnowledgeReader,
  exportArgumentLibraryMarkdown,
  parseArgumentLibraryJson,
  safeMarkdownFileName,
  sameSnapshot,
  serializeArgumentLibrary,
  type ArgumentLibrary,
  type ArgumentLibraryStore,
  type ArgumentProposal,
  type ArgumentRecordKind,
  type ArgumentWorkspaceInsertPlan,
  type HumanReviewState,
  type IndexCandidate,
  type KnowledgeReader,
  type SnapshotDescriptor,
  type TheorySourceReference,
} from '@icarus-graph-explorer/argument-workspace';

import { ArgumentRecordEditor } from './ArgumentRecordEditor';
import {
  ArgumentAxiomView,
  ArgumentCounterArgumentView,
  ArgumentContextView,
  ArgumentTopicView,
  ArgumentView,
  type ArgumentSelection,
} from './ArgumentRecordView';
import { activateArgumentWorkspaceOverlay } from './argument-overlay';
import {
  argumentBundleFailure,
  formatArgumentBundle,
  type ArgumentContextExport,
} from './context-export';
import {
  buildArgumentSourcePacket,
  formatArgumentSourcePacket,
  sourceOrigins,
  type ArgumentSourcePacketExport,
} from './source-packet';
import { createPlatformArgumentLibraryStore } from './platform-store';
import {
  normalizeRetrievalEditorText,
  retrievalEditorText,
  type RetrievalEditorText,
} from './retrieval-editor';
import {
  ArgumentSourceAccessSession,
  type ArgumentSourceAccess,
} from './source-capture';
import {
  argumentSourcePreviewKey,
  type ArgumentSourcePreview,
} from './source-preview';
import { TheorySourceReferences } from './TheorySourceReferences';
import {
  saveMarkdownDirectory,
  type DirectoryPicker,
} from './markdown-directory-export';
import {
  ARGUMENT_LIBRARY_IMPORT_LIMIT_BYTES,
  ArgumentWorkspaceSession,
  findRecord,
  recordTopicIds,
  type ArgumentImportPlan,
  type ArgumentRecordEditorDraft,
  type ArgumentRecordDraft,
  type CounterArgumentRecordDraft,
} from './session';
import './arguments.css';

interface EditorState {
  readonly record: ArgumentRecordDraft;
  readonly retrievalText: RetrievalEditorText;
  readonly source: string;
  readonly dirty: boolean;
  readonly errors: readonly string[];
}

interface ImportPreviewState {
  readonly fileName: string;
  readonly source: string;
  readonly merge?: ArgumentImportPlan;
  readonly replace?: ArgumentImportPlan;
  readonly error?: string;
}

interface InsertJsonState {
  readonly source: string;
  readonly fileName?: string;
  readonly plan?: ArgumentWorkspaceInsertPlan;
  readonly errors?: readonly string[];
}

interface ProposalResolutionState {
  readonly proposalId: string;
  readonly mode: 'accept' | 'reject';
  readonly promoteToCurrent: boolean;
  readonly decisionNote: string;
}

interface ContextPreviewState {
  readonly libraryOnly: ArgumentContextExport;
  readonly sourcePacket?: ArgumentSourcePacketExport | undefined;
  readonly preparing: boolean;
  readonly error?: string | undefined;
}

const EMPTY_RETRIEVAL = { aliases: [], keywords: [], phrases: [] } as const;
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function sameSelection(
  left: ArgumentSelection | undefined,
  right: ArgumentSelection,
): boolean {
  return left?.kind === right.kind && left.id === right.id;
}

function selectedExists(
  library: ArgumentLibrary,
  selection: ArgumentSelection | undefined,
): boolean {
  if (selection === undefined) return false;
  try {
    findRecord(library, selection.kind, selection.id);
    return true;
  } catch {
    return false;
  }
}

function firstSelection(
  library: ArgumentLibrary,
): ArgumentSelection | undefined {
  const topic =
    library.topics.find(({ archived }) => !archived) ?? library.topics[0];
  if (topic !== undefined) return { kind: 'topic', id: topic.id };
  const context =
    library.contexts.find(({ archived }) => !archived) ?? library.contexts[0];
  if (context !== undefined) return { kind: 'context', id: context.id };
  const axiom =
    library.axioms.find(({ archived }) => !archived) ?? library.axioms[0];
  if (axiom !== undefined) return { kind: 'axiom', id: axiom.id };
  const argument =
    library.arguments.find(({ archived }) => !archived) ?? library.arguments[0];
  if (argument !== undefined) return { kind: 'argument', id: argument.id };
  const counter =
    library.counterArguments.find(({ archived }) => !archived) ??
    library.counterArguments[0];
  return counter === undefined
    ? undefined
    : { kind: 'counter-argument', id: counter.id };
}

function sourceJson(references: readonly TheorySourceReference[]): string {
  return JSON.stringify(references, null, 2);
}

function editDraft(
  library: ArgumentLibrary,
  descriptor: SnapshotDescriptor,
  selection: ArgumentSelection,
): EditorState {
  if (selection.kind === 'topic') {
    const topic = findRecord(library, 'topic', selection.id);
    return {
      dirty: false,
      errors: [],
      retrievalText: retrievalEditorText(topic.retrieval),
      source: '[]',
      record: {
        kind: 'topic',
        mode: 'edit',
        id: topic.id,
        expected: descriptor,
        title: topic.title,
        summary: topic.summary,
        retrieval: topic.retrieval,
        reviewState: topic.reviewState,
        topicIds: [topic.id],
        axiomIds: topic.axiomIds,
        argumentIds: topic.argumentIds,
        counterArgumentIds: topic.counterArgumentIds,
      },
    };
  }
  if (selection.kind === 'context') {
    const context = findRecord(library, 'context', selection.id);
    return {
      dirty: false,
      errors: [],
      retrievalText: retrievalEditorText(context.retrieval),
      source: '[]',
      record: {
        kind: 'context',
        mode: 'edit',
        id: context.id,
        expected: descriptor,
        title: context.title,
        description: context.description,
        retrieval: context.retrieval,
        axiomIds: context.axiomIds,
        parentContextId: context.parentContextId,
        reviewState: context.reviewState,
        topicIds: [],
      },
    };
  }
  if (selection.kind === 'axiom') {
    const axiom = findRecord(library, 'axiom', selection.id);
    return {
      dirty: false,
      errors: [],
      retrievalText: retrievalEditorText(axiom.retrieval),
      source: sourceJson(axiom.sourceReferences),
      record: {
        kind: 'axiom',
        mode: 'edit',
        id: axiom.id,
        expected: descriptor,
        title: axiom.title,
        statement: axiom.statement,
        explanation: axiom.explanation,
        scope: axiom.scope,
        supportingReasoning: axiom.supportingReasoning,
        retrieval: axiom.retrieval,
        sourceReferences: axiom.sourceReferences,
        reviewState: axiom.reviewState,
        topicIds: recordTopicIds(library, 'axiom', axiom.id),
      },
    };
  }
  if (selection.kind === 'argument') {
    const argument = findRecord(library, 'argument', selection.id);
    return {
      dirty: false,
      errors: [],
      retrievalText: retrievalEditorText(argument.retrieval),
      source: sourceJson(argument.sourceReferences),
      record: {
        kind: 'argument',
        mode: 'edit',
        id: argument.id,
        expected: descriptor,
        title: argument.title,
        examples: argument.examples,
        premises: argument.premises,
        reasoning: argument.reasoning,
        conclusion: argument.conclusion,
        boundary: argument.boundary,
        relations: argument.relations,
        contextIds: argument.contextIds,
        retrieval: argument.retrieval,
        sourceReferences: argument.sourceReferences,
        supersedesArgumentId: argument.supersedesArgumentId,
        reviewState: argument.reviewState,
        topicIds: recordTopicIds(library, 'argument', argument.id),
      },
    };
  }
  const counter = findRecord(library, 'counter-argument', selection.id);
  return {
    dirty: false,
    errors: [],
    retrievalText: retrievalEditorText(counter.retrieval),
    source: sourceJson(counter.sourceReferences),
    record: {
      kind: 'counter-argument',
      mode: 'edit',
      id: counter.id,
      expected: descriptor,
      title: counter.title,
      observation: counter.observation,
      challengedClaim: counter.challengedClaim,
      target: counter.target,
      retrieval: counter.retrieval,
      sourceReferences: counter.sourceReferences,
      answeringAxiomIds: counter.response.answeringAxioms.map(
        ({ axiomId }) => axiomId,
      ),
      responseExplanation: counter.response.explanation,
      outcome: counter.response.outcome,
      boundary: counter.response.boundary,
      reopeningCondition: counter.response.reopeningCondition,
      reviewState: counter.reviewState,
      topicIds: recordTopicIds(library, 'counter-argument', counter.id),
    },
  };
}

function newDraft(
  kind: ArgumentRecordKind,
  descriptor: SnapshotDescriptor,
  session: ArgumentWorkspaceSession,
  topicId?: string,
): EditorState {
  const id = session.runtime.createId(kind);
  const base = {
    mode: 'create' as const,
    id,
    expected: descriptor,
    title: '',
    retrieval: EMPTY_RETRIEVAL,
    reviewState: 'draft' as const,
    topicIds: topicId === undefined ? [] : [topicId],
  };
  const emptyRetrievalText = retrievalEditorText(EMPTY_RETRIEVAL);
  if (kind === 'topic') {
    return {
      dirty: true,
      errors: [],
      retrievalText: emptyRetrievalText,
      source: '[]',
      record: {
        ...base,
        kind,
        summary: '',
        axiomIds: [],
        argumentIds: [],
        counterArgumentIds: [],
      },
    };
  }
  if (kind === 'axiom') {
    return {
      dirty: true,
      errors: [],
      retrievalText: emptyRetrievalText,
      source: '[]',
      record: { ...base, kind, statement: '', sourceReferences: [] },
    };
  }
  if (kind === 'context') {
    return {
      dirty: true,
      errors: [],
      retrievalText: emptyRetrievalText,
      source: '[]',
      record: {
        ...base,
        kind,
        description: undefined,
        axiomIds: [],
        parentContextId: undefined,
      },
    };
  }
  if (kind === 'argument') {
    return {
      dirty: true,
      errors: [],
      retrievalText: emptyRetrievalText,
      source: '[]',
      record: {
        ...base,
        kind,
        examples: [],
        premises: [],
        conclusion: '',
        relations: [],
        contextIds: [],
        sourceReferences: [],
      },
    };
  }
  return {
    dirty: true,
    errors: [],
    retrievalText: emptyRetrievalText,
    source: '[]',
    record: {
      ...base,
      kind,
      observation: '',
      challengedClaim: '',
      sourceReferences: [],
      answeringAxiomIds: [],
      responseExplanation: '',
      outcome: 'unanswered',
    },
  };
}

function proposalArgumentEditor(
  library: ArgumentLibrary,
  descriptor: SnapshotDescriptor,
  proposal: ArgumentProposal,
  session: ArgumentWorkspaceSession,
): { readonly editor: EditorState; readonly promoteToCurrent: boolean } {
  const base = newDraft('argument', descriptor, session, proposal.topicId);
  if (base.record.kind !== 'argument') {
    throw new Error('Argument proposal draft initialization failed.');
  }
  const target = proposal.target;
  const commonReplacement =
    target !== undefined &&
    proposal.topicId !== undefined &&
    library.topics.find(({ id }) => id === proposal.topicId)
      ?.currentArgumentId === target.argumentId;
  const relations =
    target === undefined
      ? []
      : [
          {
            id: session.runtime.createId('relation'),
            kind: 'attack' as const,
            targetArgumentId: target.argumentId,
            targetPart: target.part,
            reliedOnRevision: target.reliedOnRevision,
          },
        ];
  return {
    promoteToCurrent: commonReplacement,
    editor: {
      ...base,
      record: {
        ...base.record,
        title: proposal.title,
        examples: proposal.examples.map((text) => ({
          id: session.runtime.createId('example'),
          text,
        })),
        premises: proposal.premiseHints.map((text) => ({
          id: session.runtime.createId('premise'),
          kind: 'text' as const,
          text,
        })),
        ...(proposal.reasoning === undefined
          ? {}
          : { reasoning: proposal.reasoning }),
        conclusion: proposal.conclusion,
        ...(proposal.boundary === undefined
          ? {}
          : { boundary: proposal.boundary }),
        relations,
        ...(commonReplacement
          ? { supersedesArgumentId: target.argumentId }
          : {}),
        reviewState: 'accepted',
      },
    },
  };
}

function proposalCounterArgumentEditor(
  descriptor: SnapshotDescriptor,
  proposal: ArgumentProposal,
  session: ArgumentWorkspaceSession,
): EditorState {
  const base = newDraft(
    'counter-argument',
    descriptor,
    session,
    proposal.topicId,
  );
  if (base.record.kind !== 'counter-argument') {
    throw new Error('Counter-Argument proposal draft initialization failed.');
  }
  const observation =
    proposal.examples.length === 0
      ? (proposal.reasoning ?? proposal.conclusion)
      : proposal.examples.join('\n\n');
  return {
    ...base,
    record: {
      ...base.record,
      title: proposal.title,
      observation,
      challengedClaim: proposal.conclusion,
      ...(proposal.target === undefined
        ? proposal.topicId === undefined
          ? {}
          : {
              target: {
                kind: 'topic-claim' as const,
                topicId: proposal.topicId,
              },
            }
        : {
            target: {
              kind: 'argument' as const,
              argumentId: proposal.target.argumentId,
              part: proposal.target.part,
            },
          }),
      responseExplanation: '',
      outcome: 'refuted',
      ...(proposal.boundary === undefined
        ? {}
        : { boundary: proposal.boundary }),
      reviewState: 'accepted',
    },
  };
}

function parseSources(
  editor: EditorState,
):
  | { readonly valid: true; readonly record: ArgumentRecordDraft }
  | { readonly valid: false; readonly errors: readonly string[] } {
  const errors: string[] = [];
  if (editor.record.title.trim() === '') errors.push('Title is required.');
  if (editor.record.kind === 'topic' && editor.record.summary.trim() === '') {
    errors.push('Summary is required.');
  }
  if (editor.record.kind === 'axiom' && editor.record.statement.trim() === '') {
    errors.push('Statement is required.');
  }
  if (editor.record.kind === 'argument') {
    if (editor.record.conclusion.trim() === '') {
      errors.push('Conclusion is required.');
    }
    editor.record.premises.forEach((premise, index) => {
      if (premise.kind === 'text' && premise.text.trim() === '') {
        errors.push(`Premise ${index + 1} text is required.`);
      }
    });
  }
  if (editor.record.kind === 'counter-argument') {
    if (editor.record.observation.trim() === '')
      errors.push('Observation is required.');
    if (editor.record.challengedClaim.trim() === '')
      errors.push('Challenged claim is required.');
  }
  const record = {
    ...editor.record,
    retrieval: normalizeRetrievalEditorText(editor.retrievalText),
  } as ArgumentRecordDraft;
  if (record.kind === 'topic' || record.kind === 'context') {
    return errors.length === 0
      ? { valid: true, record }
      : { valid: false, errors };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(editor.source) as unknown;
  } catch (error: unknown) {
    errors.push(
      `Source references JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (parsed !== undefined && !Array.isArray(parsed)) {
    errors.push('Source references JSON must be an array.');
  }
  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    record: {
      ...record,
      sourceReferences: parsed as readonly TheorySourceReference[],
    },
  };
}

function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText === undefined) {
    throw new Error('Clipboard access is unavailable in this environment.');
  }
  await navigator.clipboard.writeText(text);
}

function counts(library: ArgumentLibrary): string {
  return `${library.topics.length} Topic${library.topics.length === 1 ? '' : 's'}, ${library.contexts.length} Context${library.contexts.length === 1 ? '' : 's'}, ${library.axioms.length} Axiom${library.axioms.length === 1 ? '' : 's'}, ${library.arguments.length} Argument${library.arguments.length === 1 ? '' : 's'}, ${library.counterArguments.length} Counter-Argument${library.counterArguments.length === 1 ? '' : 's'}`;
}

function proposalTargetStaleness(
  library: ArgumentLibrary,
  proposal: ArgumentProposal,
): string | undefined {
  const target = proposal.target;
  if (target === undefined) return undefined;
  const argument = library.arguments.find(({ id }) => id === target.argumentId);
  if (argument === undefined)
    return 'The target Argument is no longer present.';
  if (argument.revision !== target.reliedOnRevision) {
    return `The proposal targeted revision ${target.reliedOnRevision}; the Argument is now revision ${argument.revision}.`;
  }
  if (target.part.kind === 'premise') {
    const premiseId = target.part.premiseId;
    if (!argument.premises.some(({ id }) => id === premiseId)) {
      return `The targeted premise ${premiseId} is no longer present.`;
    }
  }
  if (target.part.kind === 'reasoning' && argument.reasoning === undefined) {
    return 'The targeted reasoning section is no longer present.';
  }
  return undefined;
}

function proposalTargetText(
  library: ArgumentLibrary,
  proposal: ArgumentProposal,
): string {
  if (proposal.target === undefined) {
    const topic = library.topics.find(({ id }) => id === proposal.topicId);
    return topic === undefined
      ? 'No canonical target'
      : `Topic: ${topic.title}`;
  }
  const argument = library.arguments.find(
    ({ id }) => id === proposal.target?.argumentId,
  );
  const part =
    proposal.target.part.kind === 'premise'
      ? `premise ${proposal.target.part.premiseId}`
      : proposal.target.part.kind;
  return `${argument?.title ?? proposal.target.argumentId} — ${part}`;
}

function MailboxDialog({
  busy,
  library,
  onAccept,
  onClose,
  onNavigate,
  onReject,
}: {
  readonly busy: boolean;
  readonly library: ArgumentLibrary;
  readonly onAccept: (proposal: ArgumentProposal) => void;
  readonly onClose: () => void;
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
            AI proposals are not framework knowledge. Only human resolution can
            create canonical Argument or Counter-Argument history.
          </p>
        </header>
        <div className="arguments-actions" role="tablist">
          <button
            aria-selected={view === 'pending'}
            onClick={() => {
              setView('pending');
              setSelectedId(undefined);
            }}
            role="tab"
            type="button"
          >
            Pending (
            {
              library.proposals.filter(({ status }) => status === 'pending')
                .length
            }
            )
          </button>
          <button
            aria-selected={view === 'history'}
            onClick={() => {
              setView('history');
              setSelectedId(undefined);
            }}
            role="tab"
            type="button"
          >
            History
          </button>
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
                      <small>{proposalTargetText(library, proposal)}</small>
                      <small>
                        {proposal.status} ·{' '}
                        {new Date(proposal.createdAt).toLocaleString()}
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
              <p className="eyebrow">{selected.status}</p>
              <h3>{selected.title}</h3>
              <p>
                Target: <strong>{proposalTargetText(library, selected)}</strong>
              </p>
              {targetStale === undefined ? null : (
                <p className="arguments-error" role="alert">
                  Stale target: {targetStale} Review the current record before
                  resolving.
                </p>
              )}
              <h3>Examples</h3>
              {selected.examples.length === 0 ? (
                <p className="arguments-empty">No examples supplied.</p>
              ) : (
                <ul>
                  {selected.examples.map((example, index) => (
                    <li key={`${index}:${example}`}>{example}</li>
                  ))}
                </ul>
              )}
              <h3>Premise hints</h3>
              {selected.premiseHints.length === 0 ? (
                <p className="arguments-empty">No premise hints supplied.</p>
              ) : (
                <ul>
                  {selected.premiseHints.map((premise, index) => (
                    <li key={`${index}:${premise}`}>{premise}</li>
                  ))}
                </ul>
              )}
              {selected.reasoning === undefined ? null : (
                <>
                  <h3>Candidate reasoning</h3>
                  <p>{selected.reasoning}</p>
                </>
              )}
              <h3>Candidate conclusion</h3>
              <p>{selected.conclusion}</p>
              {selected.boundary === undefined ? null : (
                <>
                  <h3>Boundary / Invariance</h3>
                  <p>{selected.boundary}</p>
                </>
              )}
              <h3>Why novel or unresolved</h3>
              <p>{selected.whyNovelOrUnresolved}</p>
              <h3>Consulted records</h3>
              <ul>
                {selected.consultation.records.map((record) => (
                  <li key={`${record.kind}:${record.id}`}>
                    {record.kind} <code>{record.id}</code>
                    {record.revision === undefined
                      ? ''
                      : ` at revision ${record.revision}`}
                  </li>
                ))}
              </ul>
              {selected.decision === undefined ? null : (
                <section className="arguments-mailbox__decision">
                  <h3>Human decision</h3>
                  {selected.decision.note === undefined ? null : (
                    <p>{selected.decision.note}</p>
                  )}
                  {selected.decision.resultingArgumentId ===
                  undefined ? null : (
                    <button
                      onClick={() =>
                        onNavigate({
                          kind: 'argument',
                          id: selected.decision!.resultingArgumentId!,
                        })
                      }
                      type="button"
                    >
                      Open resulting Argument
                    </button>
                  )}
                  {selected.decision.resultingCounterArgumentId ===
                  undefined ? null : (
                    <button
                      onClick={() =>
                        onNavigate({
                          kind: 'counter-argument',
                          id: selected.decision!.resultingCounterArgumentId!,
                        })
                      }
                      type="button"
                    >
                      Open resulting Counter-Argument
                    </button>
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

function ProposalResolutionPanel({
  draft,
  library,
  onDecisionNoteChange,
  onPromoteChange,
  onToggleAttack,
  onToggleSupersession,
  proposal,
  resolution,
}: {
  readonly draft: ArgumentRecordEditorDraft | CounterArgumentRecordDraft;
  readonly library: ArgumentLibrary;
  readonly onDecisionNoteChange: (note: string) => void;
  readonly onPromoteChange: (promote: boolean) => void;
  readonly onToggleAttack: (enabled: boolean) => void;
  readonly onToggleSupersession: (enabled: boolean) => void;
  readonly proposal: ArgumentProposal;
  readonly resolution: ProposalResolutionState;
}) {
  const target = proposal.target;
  const attackSelected =
    draft.kind === 'argument' &&
    target !== undefined &&
    draft.relations.some(
      (relation) =>
        relation.kind === 'attack' &&
        relation.targetArgumentId === target.argumentId &&
        canonicalJson(relation.targetPart) === canonicalJson(target.part),
    );
  const supersessionSelected =
    draft.kind === 'argument' &&
    target !== undefined &&
    draft.supersedesArgumentId === target.argumentId;
  const stale = proposalTargetStaleness(library, proposal);
  return (
    <section className="arguments-proposal-resolution">
      <p className="eyebrow">Human Mailbox resolution</p>
      <h2>
        {resolution.mode === 'accept'
          ? 'Integrate accepted proposal'
          : 'Record why the proposal failed'}
      </h2>
      <p>
        Proposal <code>{proposal.id}</code> remains pending until this complete
        canonical transaction is saved.
      </p>
      {stale === undefined ? null : (
        <p className="arguments-error" role="alert">
          Stale target: {stale}
        </p>
      )}
      {proposal.suggestedAxiomIds.length === 0 ? null : (
        <div className="arguments-disclosure">
          Suggested Axioms (not selected automatically):{' '}
          {proposal.suggestedAxiomIds
            .map(
              (id) =>
                library.axioms.find((axiom) => axiom.id === id)?.title ?? id,
            )
            .join('; ')}
          . Add any accepted dependency through the ordinary Axiom premise or
          answering-Axiom controls below.
        </div>
      )}
      {resolution.mode === 'reject' ? (
        <p className="arguments-disclosure">
          The canonical Counter-Argument will be human-accepted Audit. Record
          failure in its response outcome, not by rejecting the canonical
          record.
        </p>
      ) : (
        <fieldset className="arguments-editor__fieldset">
          <legend>Final relationship to the target</legend>
          <label>
            <input
              checked={attackSelected}
              disabled={target === undefined}
              onChange={(event) => onToggleAttack(event.currentTarget.checked)}
              type="checkbox"
            />{' '}
            Attack the proposal target and exact target part
          </label>
          <label>
            <input
              checked={supersessionSelected}
              disabled={target === undefined}
              onChange={(event) =>
                onToggleSupersession(event.currentTarget.checked)
              }
              type="checkbox"
            />{' '}
            Supersede the target Argument
          </label>
          <label>
            <input
              checked={resolution.promoteToCurrent}
              disabled={draft.topicIds.length === 0}
              onChange={(event) => onPromoteChange(event.currentTarget.checked)}
              type="checkbox"
            />{' '}
            Promote the new Argument to Current for the selected Topic
          </label>
        </fieldset>
      )}
      <label>
        Human decision note
        <textarea
          onChange={(event) => onDecisionNoteChange(event.currentTarget.value)}
          rows={3}
          value={resolution.decisionNote}
        />
      </label>
    </section>
  );
}

function InsertJsonDialog({
  busy,
  state,
  onCancel,
  onChange,
  onChooseFile,
  onConfirm,
  onPreview,
  onUseTemplate,
}: {
  readonly busy: boolean;
  readonly state: InsertJsonState;
  readonly onCancel: () => void;
  readonly onChange: (source: string) => void;
  readonly onChooseFile: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onConfirm: (plan: ArgumentWorkspaceInsertPlan) => void;
  readonly onPreview: () => void;
  readonly onUseTemplate: () => void;
}) {
  const plan = state.plan;
  const preview = plan?.preview;
  return (
    <section
      aria-labelledby="arguments-insert-title"
      className="arguments-subdialog"
      role="dialog"
    >
      <div>
        <h2 id="arguments-insert-title">Insert JSON</h2>
        <p>
          Add records and links to the current library. Preview is strict and
          non-mutating; nothing is saved until confirmation.
        </p>
        <div className="arguments-actions">
          <label className="button-like">
            Select JSON file
            <input
              accept="application/json,.json"
              disabled={busy}
              onChange={onChooseFile}
              type="file"
            />
          </label>
          {state.fileName === undefined ? null : (
            <span>
              Loaded <code>{state.fileName}</code>
            </span>
          )}
        </div>
        <label>
          Insert JSON document (or paste manually)
          <textarea
            onChange={(event) => onChange(event.currentTarget.value)}
            placeholder='{"format":"argument-workspace-insert-v1", ...}'
            spellCheck={false}
            value={state.source}
          />
        </label>
        <div className="arguments-actions">
          <button disabled={busy} onClick={onPreview} type="button">
            Preview insert
          </button>
          <button disabled={busy} onClick={onUseTemplate} type="button">
            Use template
          </button>
        </div>
        {state.errors === undefined ? null : (
          <div className="arguments-error" role="alert">
            <h3>Validation errors</h3>
            <ul>
              {state.errors.map((error, index) => (
                <li key={`${index}:${error}`}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        {preview === undefined ? null : (
          <div className="arguments-insert-preview">
            <h3>Validated preview</h3>
            <p>
              Format <code>{preview.format}</code>. Create{' '}
              {preview.counts.topics} Topic, {preview.counts.axioms} Axiom,{' '}
              {preview.counts.arguments} Argument, and{' '}
              {preview.counts.counterArguments} Counter-Argument records.
            </p>
            {preview.records.length === 0 ? null : (
              <>
                <h3>Records</h3>
                <ul>
                  {preview.records.map((record) => (
                    <li key={`${record.kind}:${record.id}`}>
                      {record.kind} <code>{record.id}</code> — {record.title}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {preview.memberships.length === 0 ? null : (
              <>
                <h3>Topic memberships</h3>
                <ul>
                  {preview.memberships.map((membership) => (
                    <li
                      key={`${membership.topicId}:${membership.kind}:${membership.recordId}`}
                    >
                      <code>{membership.topicId}</code> ← {membership.kind}{' '}
                      <code>{membership.recordId}</code>
                      {membership.alreadyPresent ? ' (already present)' : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {preview.currentPromotions.length === 0 ? null : (
              <>
                <h3>Current promotions</h3>
                <ul>
                  {preview.currentPromotions.map((promotion) => (
                    <li key={promotion.topicId}>
                      <code>{promotion.argumentId}</code> for{' '}
                      <code>{promotion.topicId}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {preview.supersessions.length === 0 ? null : (
              <>
                <h3>Supersession</h3>
                <ul>
                  {preview.supersessions.map((link) => (
                    <li key={link.argumentId}>
                      <code>{link.argumentId}</code> supersedes{' '}
                      <code>{link.supersedesArgumentId}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {preview.relations.length === 0 ? null : (
              <>
                <h3>Attack / support relations</h3>
                <ul>
                  {preview.relations.map(({ argumentId, relation }) => (
                    <li key={`${argumentId}:${relation.id}`}>
                      <code>{argumentId}</code> {relation.kind}s{' '}
                      <code>{relation.targetArgumentId}</code> (
                      {relation.targetPart.kind})
                    </li>
                  ))}
                </ul>
              </>
            )}
            {preview.referencedExistingRecords.length === 0 ? null : (
              <>
                <h3>Existing records referenced</h3>
                <ul>
                  {preview.referencedExistingRecords.map((record) => (
                    <li key={`${record.kind}:${record.id}`}>
                      {record.kind} <code>{record.id}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {preview.resolvedPins.length === 0 ? null : (
              <>
                <h3>Revision pins</h3>
                <ul>
                  {preview.resolvedPins.map((pin) => (
                    <li key={pin.path}>
                      {pin.suppliedExplicitly ? 'Validated' : 'Resolved'}{' '}
                      <code>{pin.targetId}</code> at revision {pin.revision}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {preview.warnings.length === 0 ? null : (
              <>
                <h3>Warnings</h3>
                <ul>
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <div className="arguments-actions">
          <button
            disabled={busy || plan === undefined}
            onClick={() => {
              if (plan !== undefined) onConfirm(plan);
            }}
            type="button"
          >
            Confirm insert
          </button>
          <button onClick={onCancel} type="button">
            Cancel insert
          </button>
        </div>
      </div>
    </section>
  );
}

function WorkspaceOnboarding({
  busy,
  message,
  onCreateEmpty,
  onImport,
}: {
  readonly busy: boolean;
  readonly message?: string;
  readonly onCreateEmpty: () => void;
  readonly onImport: (source: string, fileName: string) => void;
}) {
  const [preview, setPreview] = useState<{
    source: string;
    fileName: string;
    library: ArgumentLibrary;
    migratedFromSchemaVersion?: 1 | 2 | 3 | 4;
  }>();
  const [error, setError] = useState<string>();
  async function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file === undefined) return;
    if (file.size > ARGUMENT_LIBRARY_IMPORT_LIMIT_BYTES) {
      setError('Argument Library JSON exceeds the 5 MiB import limit.');
      return;
    }
    const source = await file.text();
    const parsed = parseArgumentLibraryJson(source);
    if (parsed.status !== 'valid') {
      setError(parsed.message);
      setPreview(undefined);
      return;
    }
    setError(undefined);
    setPreview({
      source,
      fileName: file.name,
      library: parsed.value,
      ...(parsed.migratedFromSchemaVersion === undefined
        ? {}
        : {
            migratedFromSchemaVersion: parsed.migratedFromSchemaVersion,
          }),
    });
  }
  return (
    <section className="arguments-onboarding">
      <p className="eyebrow">Private, local library</p>
      <h2>Start the Argument Library</h2>
      <p>
        No library is stored in this profile. Nothing is created until you
        choose an action.
      </p>
      <div className="arguments-actions">
        <label className="button-like">
          Import library JSON
          <input
            accept="application/json,.json"
            disabled={busy}
            onChange={(event) => void select(event)}
            type="file"
          />
        </label>
        <button disabled={busy} onClick={onCreateEmpty} type="button">
          Create empty library
        </button>
      </div>
      {preview === undefined ? null : (
        <div className="arguments-import-preview">
          <h3>Ready to initialize</h3>
          <p>
            {preview.fileName}: {counts(preview.library)}
          </p>
          <p>
            Lineage <code>{preview.library.libraryId}</code>, revision{' '}
            {preview.library.libraryRevision}.
          </p>
          {preview.migratedFromSchemaVersion === undefined ? null : (
            <p className="arguments-disclosure">
              Schema v{preview.migratedFromSchemaVersion} will be migrated
              deterministically to v3. Existing records remain intact; no
              Examples, relations, Arguments, or Current pointer are inferred.
            </p>
          )}
          <button
            disabled={busy}
            onClick={() => onImport(preview.source, preview.fileName)}
            type="button"
          >
            Confirm import
          </button>
        </div>
      )}
      {error === undefined ? null : (
        <p className="arguments-error" role="alert">
          {error}
        </p>
      )}
      {message === undefined ? null : (
        <p className="arguments-error" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}

function SearchPane({
  library,
  onNavigate,
  reader,
  snapshot,
}: {
  readonly library: ArgumentLibrary;
  readonly onNavigate: (selection: ArgumentSelection) => void;
  readonly reader: KnowledgeReader;
  readonly snapshot: SnapshotDescriptor;
}) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [proposalsOnly, setProposalsOnly] = useState(false);
  const key = `${snapshot.contentFingerprint.value}\0${deferredQuery}\0${includeArchived}`;
  const firstPage = useMemo(
    () =>
      deferredQuery.trim() === ''
        ? reader.listIndex({
            limit: 25,
            includeArchived,
            expectedSnapshot: snapshot,
          })
        : reader.searchIndex({
            query: deferredQuery,
            limit: 25,
            includeArchived,
            expectedSnapshot: snapshot,
          }),
    [deferredQuery, includeArchived, reader, snapshot],
  );
  const [additional, setAdditional] = useState<{
    key: string;
    candidates: readonly IndexCandidate[];
    cursor?: string;
  }>({ key: '', candidates: [] });
  if (firstPage.status !== 'ok') {
    return (
      <p className="arguments-error" role="alert">
        Search could not read the current snapshot.
      </p>
    );
  }
  const current =
    additional.key === key
      ? additional
      : {
          key,
          candidates: firstPage.value.candidates,
          cursor: firstPage.value.nextCursor,
        };
  const topicTitles = new Map(
    library.topics.map((topic) => [topic.id, topic.title]),
  );
  const displayedCandidates = proposalsOnly
    ? current.candidates.filter(
        (candidate) =>
          (candidate.kind === 'argument' ||
            candidate.kind === 'counter-argument') &&
          findRecord(library, candidate.kind, candidate.id).reviewState ===
            'pending-review',
      )
    : current.candidates;
  function loadMore() {
    if (current.cursor === undefined) return;
    const page =
      deferredQuery.trim() === ''
        ? reader.listIndex({
            limit: 25,
            cursor: current.cursor,
            includeArchived,
            expectedSnapshot: snapshot,
          })
        : reader.searchIndex({
            query: deferredQuery,
            limit: 25,
            cursor: current.cursor,
            includeArchived,
            expectedSnapshot: snapshot,
          });
    if (page.status !== 'ok') return;
    setAdditional({
      key,
      candidates: [...current.candidates, ...page.value.candidates],
      ...(page.value.nextCursor === undefined
        ? {}
        : { cursor: page.value.nextCursor }),
    });
  }
  return (
    <>
      <label className="arguments-search">
        <span>Search all records</span>
        <input
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Title, phrase, number, or operator"
          type="search"
          value={query}
        />
      </label>
      <label className="arguments-archive-toggle">
        <input
          checked={includeArchived}
          onChange={(event) => setIncludeArchived(event.currentTarget.checked)}
          type="checkbox"
        />{' '}
        Show archived
      </label>
      <label className="arguments-archive-toggle">
        <input
          checked={proposalsOnly}
          onChange={(event) => setProposalsOnly(event.currentTarget.checked)}
          type="checkbox"
        />{' '}
        Proposals only
      </label>
      <div className="arguments-search-results" aria-live="polite">
        {displayedCandidates.length === 0 ? (
          <p className="arguments-empty">No matching records.</p>
        ) : (
          <ul>
            {displayedCandidates.map((candidate) => (
              <li key={`${candidate.kind}:${candidate.id}`}>
                <button
                  onClick={() =>
                    onNavigate({ kind: candidate.kind, id: candidate.id })
                  }
                  type="button"
                >
                  <span>{candidate.title}</span>
                  <small>
                    {candidate.kind} ·{' '}
                    {candidate.topicIds.length === 0
                      ? 'Unassigned'
                      : candidate.topicIds
                          .map((id) => topicTitles.get(id) ?? id)
                          .join(', ')}
                  </small>
                  {candidate.matchedFields.length === 0 ? null : (
                    <small>Matched {candidate.matchedFields.join(', ')}</small>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {current.cursor === undefined ? null : (
          <button
            className="arguments-load-more"
            onClick={loadMore}
            type="button"
          >
            Load more
          </button>
        )}
      </div>
    </>
  );
}

export interface ArgumentsWorkspaceHandle {
  handleEscape(): boolean;
  requestExit(action: () => void, message?: string): void;
  focusInitial(): void;
}

interface ArgumentsWorkspaceContentProps {
  readonly active: boolean;
  readonly embedded: boolean;
  readonly onRequestClose: () => void;
  readonly restoreFocus?: HTMLElement;
  readonly session: ArgumentWorkspaceSession;
  readonly sourceAccess?: ArgumentSourceAccess;
}

function ArgumentsWorkspaceContainer({
  active,
  children,
  dialogRef,
  embedded,
  onCancel,
}: {
  readonly active: boolean;
  readonly children: ReactNode;
  readonly dialogRef: RefObject<HTMLDialogElement | null>;
  readonly embedded: boolean;
  readonly onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void;
}) {
  return embedded ? (
    <section
      aria-labelledby="arguments-workspace-title"
      className="arguments-dialog arguments-dialog--embedded"
      hidden={!active}
    >
      {children}
    </section>
  ) : (
    <dialog
      aria-labelledby="arguments-workspace-title"
      className="arguments-dialog"
      onCancel={onCancel}
      ref={dialogRef}
    >
      {children}
    </dialog>
  );
}

const ArgumentsWorkspaceContent = forwardRef<
  ArgumentsWorkspaceHandle,
  ArgumentsWorkspaceContentProps
>(function ArgumentsWorkspaceContent(
  {
    active: open,
    embedded,
    onRequestClose,
    restoreFocus,
    session,
    sourceAccess,
  }: ArgumentsWorkspaceContentProps,
  ref,
) {
  const [fallbackSourceAccess] = useState(
    () => new ArgumentSourceAccessSession(),
  );
  const argumentSources = sourceAccess ?? fallbackSourceAccess;
  const state = useSyncExternalStore(
    session.subscribe,
    session.state,
    session.state,
  );
  const sourceState = useSyncExternalStore(
    argumentSources.subscribe,
    argumentSources.state,
    argumentSources.state,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const newTopicButtonRef = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState<ArgumentSelection>();
  const [history, setHistory] = useState<readonly ArgumentSelection[]>([]);
  const [editor, setEditor] = useState<EditorState>();
  const [confirmation, setConfirmation] = useState<string>();
  const pendingTransition = useRef<(() => void) | undefined>(undefined);
  const [notice, setNotice] = useState<string>();
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [proposalResolution, setProposalResolution] =
    useState<ProposalResolutionState>();
  const [insertJson, setInsertJson] = useState<InsertJsonState>();
  const [importPreview, setImportPreview] = useState<ImportPreviewState>();
  const [markdownFiles, setMarkdownFiles] =
    useState<ReturnType<typeof exportArgumentLibraryMarkdown>>();
  const [contextExport, setContextExport] = useState<ContextPreviewState>();
  const [sourcePreviews, setSourcePreviews] = useState<
    ReadonlyMap<string, ArgumentSourcePreview>
  >(() => new Map());
  const sourceReadTokens = useRef(new Map<string, symbol>());
  const contextSourceToken = useRef<symbol | undefined>(undefined);
  const escapeAction = useRef<() => void>(() => undefined);

  useEffect(() => {
    void session.open();
  }, [session]);

  const readyLibrary =
    state.phase === 'ready' ? state.snapshot.library : undefined;
  const currentSelection =
    readyLibrary === undefined || selectedExists(readyLibrary, selection)
      ? selection
      : firstSelection(readyLibrary);

  const requestTransition = useCallback(
    (message: string, action: () => void) => {
      if (editor?.dirty === true) {
        pendingTransition.current = action;
        setConfirmation(message);
        return;
      }
      action();
    },
    [editor?.dirty],
  );

  const requestClose = useCallback(() => {
    requestTransition('Close Arguments with unsaved changes?', onRequestClose);
  }, [onRequestClose, requestTransition]);

  const handleEscape = useCallback((): boolean => {
    if (confirmation !== undefined) {
      pendingTransition.current = undefined;
      setConfirmation(undefined);
      return true;
    }
    if (mailboxOpen) {
      setMailboxOpen(false);
      return true;
    }
    if (contextExport !== undefined) {
      setContextExport(undefined);
      return true;
    }
    if (insertJson !== undefined) {
      setInsertJson(undefined);
      return true;
    }
    if (markdownFiles !== undefined) {
      setMarkdownFiles(undefined);
      return true;
    }
    if (importPreview !== undefined) {
      setImportPreview(undefined);
      return true;
    }
    requestClose();
    return true;
  }, [
    confirmation,
    contextExport,
    importPreview,
    insertJson,
    mailboxOpen,
    markdownFiles,
    requestClose,
  ]);

  useEffect(() => {
    escapeAction.current = handleEscape;
  }, [handleEscape]);

  useImperativeHandle(
    ref,
    () => ({
      handleEscape,
      requestExit(action, message = 'Leave Arguments with unsaved changes?') {
        requestTransition(message, action);
      },
      focusInitial() {
        (newTopicButtonRef.current ?? closeButtonRef.current)?.focus();
      },
    }),
    [handleEscape, requestTransition],
  );

  useEffect(() => {
    if (!open || embedded) return;
    const dialog = dialogRef.current;
    const closeButton = closeButtonRef.current;
    if (dialog === null || closeButton === null) return;
    if (!dialog.open) dialog.showModal();
    const fallbackFocus =
      document.getElementById('graph-tools-trigger') ??
      document.getElementById('main-content') ??
      undefined;
    const deactivate = activateArgumentWorkspaceOverlay(
      {
        bodyStyle: document.body.style,
        initialFocus: closeButton,
        ...(restoreFocus === undefined ? {} : { returnFocus: restoreFocus }),
        ...(fallbackFocus === undefined ? {} : { fallbackFocus }),
        focusables: () => [
          ...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ],
        addKeydownListener: (listener) =>
          window.addEventListener('keydown', listener, true),
        removeKeydownListener: (listener) =>
          window.removeEventListener('keydown', listener, true),
        queueFocus: (callback) => queueMicrotask(callback),
      },
      () => escapeAction.current(),
    );
    return () => {
      deactivate();
      if (dialog.open) dialog.close();
    };
  }, [embedded, open, restoreFocus]);

  useEffect(() => {
    if (editor?.dirty !== true) return;
    const protect = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [editor?.dirty]);

  useEffect(() => {
    if (
      !open ||
      state.phase !== 'ready' ||
      dialogRef.current?.contains(document.activeElement) === true
    ) {
      return;
    }
    newTopicButtonRef.current?.focus();
  }, [open, state.phase]);

  function cancelNative(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    escapeAction.current();
  }

  function navigate(next: ArgumentSelection) {
    requestTransition('Switch records with unsaved changes?', () => {
      sourceReadTokens.current.clear();
      setHistory((current) =>
        currentSelection === undefined || sameSelection(currentSelection, next)
          ? current
          : [...current, currentSelection],
      );
      setSelection(next);
      setEditor(undefined);
      setProposalResolution(undefined);
    });
  }

  function goBack() {
    const target = history.at(-1);
    if (target === undefined) return;
    requestTransition('Return with unsaved changes?', () => {
      sourceReadTokens.current.clear();
      setHistory((current) => current.slice(0, -1));
      setSelection(target);
      setEditor(undefined);
      setProposalResolution(undefined);
    });
  }

  async function saveCurrent(afterSave?: () => void): Promise<boolean> {
    if (editor === undefined) return false;
    const parsed = parseSources(editor);
    if (!parsed.valid) {
      setEditor({ ...editor, errors: parsed.errors });
      return false;
    }
    if (
      proposalResolution?.mode === 'reject' &&
      parsed.record.kind === 'counter-argument'
    ) {
      const resolutionErrors = [
        ...(parsed.record.responseExplanation.trim() === ''
          ? ['Response explanation is required to reject a proposal.']
          : []),
        ...(parsed.record.outcome === 'unanswered'
          ? ['A resolved response outcome is required to reject a proposal.']
          : []),
      ];
      if (resolutionErrors.length > 0) {
        setEditor({ ...editor, errors: resolutionErrors });
        return false;
      }
    }
    let result;
    if (
      proposalResolution?.mode === 'accept' &&
      parsed.record.kind === 'argument'
    ) {
      const proposal =
        state.phase === 'ready'
          ? state.snapshot.library.proposals.find(
              ({ id }) => id === proposalResolution.proposalId,
            )
          : undefined;
      const promotionTopicId = proposalResolution.promoteToCurrent
        ? proposal?.topicId !== undefined &&
          parsed.record.topicIds.includes(proposal.topicId)
          ? proposal.topicId
          : parsed.record.topicIds[0]
        : undefined;
      if (
        proposalResolution.promoteToCurrent &&
        promotionTopicId === undefined
      ) {
        setEditor({
          ...editor,
          errors: ['Select a Topic before promoting the new Argument.'],
        });
        return false;
      }
      result = await session.resolveProposalAsArgument(
        proposalResolution.proposalId,
        parsed.record,
        promotionTopicId,
        proposalResolution.decisionNote,
      );
    } else if (
      proposalResolution?.mode === 'reject' &&
      parsed.record.kind === 'counter-argument'
    ) {
      result = await session.resolveProposalAsRejected(
        proposalResolution.proposalId,
        parsed.record,
        proposalResolution.decisionNote,
      );
    } else {
      result = await session.save(parsed.record);
    }
    if (result.status !== 'ok') {
      setEditor((current) =>
        current === undefined
          ? current
          : { ...current, errors: [result.message] },
      );
      return false;
    }
    const selected = {
      kind: parsed.record.kind,
      id: parsed.record.id,
    } as const;
    setSelection(selected);
    setEditor(undefined);
    setProposalResolution(undefined);
    setNotice(proposalResolution === undefined ? 'Saved' : 'Proposal resolved');
    afterSave?.();
    return true;
  }

  function discardAndContinue() {
    const action = pendingTransition.current;
    pendingTransition.current = undefined;
    setConfirmation(undefined);
    setEditor(undefined);
    setProposalResolution(undefined);
    action?.();
  }

  async function saveAndContinue() {
    const action = pendingTransition.current;
    if (await saveCurrent(action)) {
      pendingTransition.current = undefined;
      setConfirmation(undefined);
    }
  }

  function beginCreate(kind: ArgumentRecordKind) {
    if (state.phase !== 'ready') return;
    requestTransition('Start a new record with unsaved changes?', () => {
      sourceReadTokens.current.clear();
      setEditor(
        newDraft(
          kind,
          state.snapshot.descriptor,
          session,
          currentSelection?.kind === 'topic' ? currentSelection.id : undefined,
        ),
      );
      setProposalResolution(undefined);
    });
  }

  function openMailbox() {
    requestTransition('Open Mailbox with unsaved changes?', () => {
      setEditor(undefined);
      setProposalResolution(undefined);
      void session.reload().then(() => setMailboxOpen(true));
    });
  }

  function startProposalAcceptance(proposal: ArgumentProposal) {
    if (state.phase !== 'ready') return;
    const prepared = proposalArgumentEditor(
      state.snapshot.library,
      state.snapshot.descriptor,
      proposal,
      session,
    );
    setMailboxOpen(false);
    setEditor(prepared.editor);
    setProposalResolution({
      proposalId: proposal.id,
      mode: 'accept',
      promoteToCurrent: prepared.promoteToCurrent,
      decisionNote: '',
    });
  }

  function startProposalRejection(proposal: ArgumentProposal) {
    if (state.phase !== 'ready') return;
    setMailboxOpen(false);
    setEditor(
      proposalCounterArgumentEditor(
        state.snapshot.descriptor,
        proposal,
        session,
      ),
    );
    setProposalResolution({
      proposalId: proposal.id,
      mode: 'reject',
      promoteToCurrent: false,
      decisionNote: '',
    });
  }

  function toggleProposalAttack(enabled: boolean) {
    if (state.phase !== 'ready' || proposalResolution === undefined) return;
    const proposal = state.snapshot.library.proposals.find(
      ({ id }) => id === proposalResolution.proposalId,
    );
    const target = proposal?.target;
    if (target === undefined) return;
    setEditor((current) => {
      if (current?.record.kind !== 'argument') return current;
      const matches = (relation: (typeof current.record.relations)[number]) =>
        relation.kind === 'attack' &&
        relation.targetArgumentId === target.argumentId &&
        canonicalJson(relation.targetPart) === canonicalJson(target.part);
      const relations = enabled
        ? current.record.relations.some(matches)
          ? current.record.relations
          : [
              ...current.record.relations,
              {
                id: session.runtime.createId('relation'),
                kind: 'attack' as const,
                targetArgumentId: target.argumentId,
                targetPart: target.part,
                reliedOnRevision: target.reliedOnRevision,
              },
            ]
        : current.record.relations.filter((relation) => !matches(relation));
      return {
        ...current,
        dirty: true,
        errors: [],
        record: { ...current.record, relations },
      };
    });
  }

  function toggleProposalSupersession(enabled: boolean) {
    if (state.phase !== 'ready' || proposalResolution === undefined) return;
    const target = state.snapshot.library.proposals.find(
      ({ id }) => id === proposalResolution.proposalId,
    )?.target;
    if (target === undefined) return;
    setEditor((current) =>
      current?.record.kind !== 'argument'
        ? current
        : {
            ...current,
            dirty: true,
            errors: [],
            record: {
              ...current.record,
              supersedesArgumentId: enabled ? target.argumentId : undefined,
            },
          },
    );
  }

  async function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file === undefined) return;
    if (file.size > ARGUMENT_LIBRARY_IMPORT_LIMIT_BYTES) {
      setImportPreview({
        fileName: file.name,
        source: '',
        error: 'Argument Library JSON exceeds the 5 MiB import limit.',
      });
      return;
    }
    const source = await file.text();
    const merge = session.previewImport(source, 'merge');
    const replace = session.previewImport(source, 'replace');
    setImportPreview({
      fileName: file.name,
      source,
      ...(merge.status === 'ok' ? { merge: merge.plan } : {}),
      ...(replace.status === 'ok' ? { replace: replace.plan } : {}),
      ...(merge.status === 'invalid' ? { error: merge.message } : {}),
    });
  }

  function commitImport(plan: ArgumentImportPlan) {
    requestTransition('Import over unsaved changes?', () => {
      void session.commitImport(plan).then((result) => {
        if (result.status === 'ok') {
          setImportPreview(undefined);
          setHistory([]);
          setSelection(firstSelection(result.snapshot.library));
          setNotice(
            result.snapshot.descriptor.contentFingerprint.value ===
              plan.preview.incoming.contentFingerprint.value
              ? 'Imported library'
              : 'Import saved',
          );
        } else setNotice(result.message);
      });
    });
  }

  function previewInsert() {
    if (insertJson === undefined) return;
    const result = session.previewInsert(insertJson.source);
    const selectedFile =
      insertJson.fileName === undefined
        ? {}
        : { fileName: insertJson.fileName };
    setInsertJson(
      result.status === 'ok'
        ? { source: insertJson.source, ...selectedFile, plan: result.plan }
        : {
            source: insertJson.source,
            ...selectedFile,
            errors: result.issues ?? [result.message],
          },
    );
  }

  async function chooseInsertJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file === undefined) return;
    if (file.size > ARGUMENT_LIBRARY_IMPORT_LIMIT_BYTES) {
      setInsertJson((current) =>
        current === undefined
          ? current
          : {
              source: current.source,
              ...(current.fileName === undefined
                ? {}
                : { fileName: current.fileName }),
              errors: [
                `Insert JSON file "${file.name}" exceeds the 5 MiB limit.`,
              ],
            },
      );
      return;
    }
    try {
      const source = await file.text();
      setInsertJson((current) =>
        current === undefined ? current : { source, fileName: file.name },
      );
    } catch (error) {
      const detail = error instanceof Error ? `: ${error.message}` : '';
      setInsertJson((current) =>
        current === undefined
          ? current
          : {
              source: current.source,
              ...(current.fileName === undefined
                ? {}
                : { fileName: current.fileName }),
              errors: [
                `Could not read Insert JSON file "${file.name}"${detail}`,
              ],
            },
      );
    }
  }

  function commitInsert(plan: ArgumentWorkspaceInsertPlan) {
    requestTransition('Insert over unsaved changes?', () => {
      void session.commitInsert(plan).then((result) => {
        if (result.status === 'ok') {
          const firstRecord = plan.preview.records[0];
          setInsertJson(undefined);
          setHistory([]);
          if (firstRecord !== undefined) {
            setSelection({ kind: firstRecord.kind, id: firstRecord.id });
          }
          setNotice('Inserted JSON');
        } else {
          setNotice(result.message);
        }
      });
    });
  }

  function previewContext() {
    if (state.phase !== 'ready' || currentSelection === undefined) return;
    const result = state.reader.readArgumentBundle({
      ...currentSelection,
      maxDepth: 8,
      maxRecords: 100,
      expectedSnapshot: state.snapshot.descriptor,
    });
    if (result.status === 'ok')
      setContextExport({
        libraryOnly: formatArgumentBundle(result.value),
        preparing: false,
      });
    else setNotice(argumentBundleFailure(result));
  }

  async function includeTheorySources() {
    if (state.phase !== 'ready' || contextExport === undefined) return;
    if (
      !sameSnapshot(
        state.snapshot.descriptor,
        contextExport.libraryOnly.bundle.snapshot,
      )
    ) {
      setContextExport((current) =>
        current === undefined
          ? current
          : {
              ...current,
              preparing: false,
              error:
                'The library changed after this preview. Close and preview context again.',
            },
      );
      return;
    }
    const origins = sourceOrigins(contextExport.libraryOnly.bundle);
    const captured = argumentSources.capture(
      origins.map(({ locator }) => locator),
    );
    if (captured.status !== 'ok') {
      setContextExport((current) =>
        current === undefined
          ? current
          : { ...current, preparing: false, error: captured.message },
      );
      return;
    }
    const token = Symbol('source-packet');
    contextSourceToken.current = token;
    const retainedLibrary = state.snapshot;
    setContextExport((current) =>
      current === undefined
        ? current
        : { ...current, preparing: true, error: undefined },
    );
    const packet = await buildArgumentSourcePacket(
      contextExport.libraryOnly.bundle,
      captured.capture,
      retainedLibrary,
    );
    const activeSource = argumentSources.state();
    const activeSession = session.state();
    if (
      contextSourceToken.current !== token ||
      activeSource.status === 'unavailable' ||
      activeSource.generation !==
        captured.capture.provenance.sourceGeneration ||
      activeSession.phase !== 'ready' ||
      !sameSnapshot(
        activeSession.snapshot.descriptor,
        retainedLibrary.descriptor,
      )
    ) {
      setContextExport((current) =>
        current === undefined
          ? current
          : {
              ...current,
              preparing: false,
              error:
                'Source or library changed while preparing the packet. Regenerate from the current capture.',
            },
      );
      return;
    }
    setContextExport((current) =>
      current === undefined
        ? current
        : {
            ...current,
            preparing: false,
            error: undefined,
            sourcePacket: formatArgumentSourcePacket(packet),
          },
    );
  }

  function bindTheorySources() {
    if (sourceState.status === 'unavailable') {
      setNotice(sourceState.message);
      return;
    }
    if (
      !window.confirm(
        `Use ${sourceState.source.displayName} for registered theory-source reads in this Arguments session? This grants no write access.`,
      )
    ) {
      return;
    }
    const result = argumentSources.bindCurrent(sourceState.generation);
    setNotice(
      result.status === 'bound'
        ? `Bound ${result.source.displayName} for registered theory-source reads.`
        : result.message,
    );
  }

  async function readTheorySource(
    recordKind: ArgumentSourcePreview['recordKind'],
    recordId: string,
    reference: TheorySourceReference,
  ) {
    if (state.phase !== 'ready') return;
    const captured = argumentSources.capture([reference]);
    if (captured.status !== 'ok') {
      setNotice(captured.message);
      return;
    }
    const key = argumentSourcePreviewKey({
      recordKind,
      recordId,
      reference,
    });
    const token = Symbol(key);
    sourceReadTokens.current.set(key, token);
    const retainedLibrary = state.snapshot;
    const source = captured.capture.provenance;
    const reader = createKnowledgeReader(retainedLibrary, {
      sourceProvider: captured.capture.provider,
    });
    const result = await reader.readLinkedTheorySource({
      sourceReferenceId: reference.id,
      maxCharacters: 64_000,
      expectedSnapshot: retainedLibrary.descriptor,
    });
    const activeSource = argumentSources.state();
    const activeSession = session.state();
    if (
      sourceReadTokens.current.get(key) !== token ||
      activeSource.status === 'unavailable' ||
      activeSource.generation !== source.sourceGeneration ||
      activeSession.phase !== 'ready' ||
      !sameSnapshot(
        activeSession.snapshot.descriptor,
        retainedLibrary.descriptor,
      )
    ) {
      return;
    }
    const preview: ArgumentSourcePreview = {
      recordKind,
      recordId,
      reference,
      source,
      library: retainedLibrary.descriptor,
      result,
    };
    setSourcePreviews((current) => {
      const next = new Map(current);
      next.set(key, preview);
      return next;
    });
    setNotice(
      result.status === 'ok'
        ? result.value.complete
          ? 'Source captured'
          : 'Source captured with an explicit size omission'
        : `Source read failed: ${result.status}`,
    );
  }

  function exportTheorySource(preview: ArgumentSourcePreview) {
    if (preview.result.status !== 'ok') return;
    downloadText(
      safeMarkdownFileName('source-passage', preview.reference.id),
      preview.result.value.text,
      'text/markdown',
    );
  }

  async function recordTheorySourceBaseline(preview: ArgumentSourcePreview) {
    if (state.phase !== 'ready' || preview.result.status !== 'ok') return;
    const source = preview.result.value;
    const activeSource = argumentSources.state();
    if (
      editor?.dirty === true ||
      !source.complete ||
      source.sourceVersion === undefined ||
      activeSource.status !== 'bound' ||
      activeSource.generation !== preview.source.sourceGeneration ||
      !sameSnapshot(state.snapshot.descriptor, preview.library)
    ) {
      setNotice(
        'Refresh the source against the current confirmed library before recording its baseline.',
      );
      return;
    }
    const record =
      preview.recordKind === 'axiom'
        ? findRecord(state.snapshot.library, 'axiom', preview.recordId)
        : preview.recordKind === 'argument'
          ? findRecord(state.snapshot.library, 'argument', preview.recordId)
          : findRecord(
              state.snapshot.library,
              'counter-argument',
              preview.recordId,
            );
    const currentReference = record.sourceReferences.find(
      ({ id }) => id === preview.reference.id,
    );
    if (
      currentReference === undefined ||
      canonicalJson(currentReference) !== canonicalJson(preview.reference)
    ) {
      setNotice('The registered locator changed. Refresh before recording.');
      return;
    }
    const addsBinding = currentReference.sourceSpaceHint === undefined;
    if (
      !window.confirm(
        `Record the observed full-file source version on ${preview.reference.label}?${
          addsBinding
            ? ` This also records the portable source-space binding ${preview.source.sourceSpaceId}.`
            : ''
        } This does not verify the argument or write to the theory file.`,
      )
    ) {
      return;
    }
    const result = await session.recordSourceVersion(
      state.snapshot.descriptor,
      {
        recordKind: preview.recordKind,
        recordId: preview.recordId,
        sourceReferenceId: preview.reference.id,
        sourceSpaceId: preview.source.sourceSpaceId,
        sourceVersion: source.sourceVersion,
      },
    );
    setNotice(
      result.status === 'ok'
        ? 'Source baseline saved; the source file and recorded argument outcome were not changed.'
        : result.message,
    );
  }

  async function copy(value: string, success = 'Copied') {
    try {
      await copyText(value);
      setNotice(success);
    } catch (error: unknown) {
      setNotice(
        `Copy failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  function exportJson() {
    if (state.phase !== 'ready') return;
    downloadText(
      'argument-library.json',
      serializeArgumentLibrary(state.snapshot.library),
      'application/json',
    );
    if (editor?.dirty === true) {
      setNotice(
        'Exported the confirmed snapshot; the unsaved draft was not included.',
      );
    }
  }

  async function saveMarkdownFolder() {
    if (markdownFiles === undefined) return;
    const candidate = Reflect.get(window, 'showDirectoryPicker') as
      DirectoryPicker | undefined;
    if (candidate === undefined) {
      setNotice(
        'Folder export is unavailable in this browser. Download each inspected file and preserve its shown folder.',
      );
      return;
    }
    try {
      const count = await saveMarkdownDirectory(markdownFiles.files, candidate);
      setNotice(`Saved ${count} Markdown files to the selected directory.`);
    } catch (error: unknown) {
      setNotice(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Markdown export canceled; no success was recorded.'
          : `Markdown export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async function changeRecordState(reviewState: HumanReviewState) {
    if (state.phase !== 'ready' || currentSelection === undefined) return;
    const result = await session.setReviewState(
      state.snapshot.descriptor,
      currentSelection.kind,
      currentSelection.id,
      reviewState,
    );
    setNotice(result.status === 'ok' ? 'Saved' : result.message);
  }

  async function toggleArchive() {
    if (state.phase !== 'ready' || currentSelection === undefined) return;
    const record = findRecord(
      state.snapshot.library,
      currentSelection.kind,
      currentSelection.id,
    );
    const result = await session.setArchived(
      state.snapshot.descriptor,
      currentSelection.kind,
      currentSelection.id,
      !record.archived,
    );
    setNotice(
      result.status === 'ok'
        ? record.archived
          ? 'Restored'
          : 'Archived'
        : result.message,
    );
  }

  async function reassess() {
    if (
      state.phase !== 'ready' ||
      currentSelection?.kind !== 'counter-argument'
    )
      return;
    if (
      !window.confirm(
        'Confirm that you inspected the current answering Axiom versions and want to record this reassessment.',
      )
    )
      return;
    const result = await session.reassessResponse(
      state.snapshot.descriptor,
      currentSelection.id,
    );
    setNotice(
      result.status === 'ok'
        ? 'Reassessment saved; response prose and outcome were retained.'
        : result.message,
    );
  }

  async function reassessArgument() {
    if (state.phase !== 'ready' || currentSelection?.kind !== 'argument') {
      return;
    }
    if (
      !window.confirm(
        'Confirm that you inspected the current referenced premise versions and want to record this reassessment.',
      )
    ) {
      return;
    }
    const result = await session.reassessArgument(
      state.snapshot.descriptor,
      currentSelection.id,
    );
    setNotice(
      result.status === 'ok'
        ? 'Reassessment saved; premises, reasoning, conclusion, review state, and Current status were retained.'
        : result.message,
    );
  }

  async function reassessArgumentRelations() {
    if (state.phase !== 'ready' || currentSelection?.kind !== 'argument') {
      return;
    }
    if (
      !window.confirm(
        'Confirm that you inspected the current relation targets and want to advance their relied-on revisions.',
      )
    ) {
      return;
    }
    const result = await session.reassessArgumentRelations(
      state.snapshot.descriptor,
      currentSelection.id,
    );
    setNotice(
      result.status === 'ok'
        ? 'Relation reassessment saved; attack/support and supersession remain independent.'
        : result.message,
    );
  }

  async function promoteArgument(topicId: string) {
    if (state.phase !== 'ready' || currentSelection?.kind !== 'argument') {
      return;
    }
    const topic = findRecord(state.snapshot.library, 'topic', topicId);
    if (
      !window.confirm(
        `Promote this accepted Argument to Current for ${topic.title}? The previous Current Argument will be preserved.`,
      )
    ) {
      return;
    }
    const result = await session.promoteArgument(
      state.snapshot.descriptor,
      topicId,
      currentSelection.id,
    );
    setNotice(
      result.status === 'ok'
        ? `Current reasoning updated for ${topic.title}.`
        : result.message,
    );
  }

  const selectedRecord =
    state.phase === 'ready' && currentSelection !== undefined
      ? findRecord(
          state.snapshot.library,
          currentSelection.kind,
          currentSelection.id,
        )
      : undefined;
  const resolvingProposal =
    state.phase === 'ready' && proposalResolution !== undefined
      ? state.snapshot.library.proposals.find(
          ({ id }) => id === proposalResolution.proposalId,
        )
      : undefined;
  const displayedContext =
    contextExport?.sourcePacket ?? contextExport?.libraryOnly;
  const contextOrigins =
    contextExport === undefined
      ? []
      : sourceOrigins(contextExport.libraryOnly.bundle);
  const sourcePacketCurrent =
    contextExport?.sourcePacket !== undefined &&
    state.phase === 'ready' &&
    sourceState.status !== 'unavailable' &&
    contextExport.sourcePacket.packet.sourceCapture.sourceGeneration ===
      sourceState.source.sourceGeneration &&
    sameSnapshot(
      contextExport.sourcePacket.packet.library,
      state.snapshot.descriptor,
    );

  return (
    <ArgumentsWorkspaceContainer
      active={open}
      dialogRef={dialogRef}
      embedded={embedded}
      onCancel={cancelNative}
    >
      <div className="arguments-dialog__surface">
        <header className="arguments-dialog__header">
          <div>
            <p className="eyebrow">Local knowledge workspace</p>
            <h1 id="arguments-workspace-title">Arguments</h1>
          </div>
          <div className="arguments-dialog__status" role="status">
            {state.phase === 'loading'
              ? 'Opening…'
              : state.busy
                ? 'Saving…'
                : state.phase === 'ready'
                  ? (state.message ?? 'Saved locally')
                  : state.phase}
          </div>
          <div className="arguments-dialog__actions">
            {state.phase !== 'ready' ? null : (
              <>
                <button
                  disabled={state.busy}
                  onClick={openMailbox}
                  type="button"
                >
                  Mailbox (
                  {
                    state.snapshot.library.proposals.filter(
                      ({ status }) => status === 'pending',
                    ).length
                  }
                  )
                </button>
                <button
                  disabled={state.busy}
                  onClick={() => setInsertJson({ source: '' })}
                  type="button"
                >
                  Insert JSON
                </button>
                <label className="button-like">
                  Import Library JSON
                  <input
                    accept="application/json,.json"
                    disabled={state.busy}
                    onChange={(event) => void chooseImport(event)}
                    type="file"
                  />
                </label>
                <button
                  disabled={state.busy}
                  onClick={exportJson}
                  title="Export the confirmed snapshot; unsaved drafts are excluded."
                  type="button"
                >
                  Export JSON
                </button>
                <button
                  disabled={state.busy}
                  onClick={() =>
                    setMarkdownFiles(
                      exportArgumentLibraryMarkdown(state.snapshot.library),
                    )
                  }
                  type="button"
                >
                  Export Markdown
                </button>
              </>
            )}
            <button onClick={requestClose} ref={closeButtonRef} type="button">
              Close
            </button>
          </div>
        </header>

        {state.phase === 'loading' ? (
          <div className="arguments-centered">
            <p>Opening the private Argument Library…</p>
          </div>
        ) : null}
        {state.phase === 'missing' ? (
          <WorkspaceOnboarding
            busy={state.busy}
            {...(state.message === undefined ? {} : { message: state.message })}
            onCreateEmpty={() => void session.initializeEmpty()}
            onImport={(source) =>
              void session
                .initializeJson(source)
                .then((result) =>
                  setNotice(
                    result.status === 'ok'
                      ? 'Imported library'
                      : result.message,
                  ),
                )
            }
          />
        ) : null}
        {state.phase === 'failure' ? (
          <section className="arguments-onboarding arguments-failure">
            <p className="eyebrow">{state.kind}</p>
            <h2>The Argument Library was not opened</h2>
            <p role="alert">{state.message}</p>
            <div className="arguments-actions">
              <button
                disabled={state.busy}
                onClick={() => void session.reload()}
                type="button"
              >
                Retry
              </button>
              {state.preservedValue === undefined ? null : (
                <button
                  onClick={() =>
                    downloadText(
                      'argument-library-preserved.txt',
                      state.preservedValue!,
                      'text/plain',
                    )
                  }
                  type="button"
                >
                  Export preserved data
                </button>
              )}
            </div>
          </section>
        ) : null}

        {state.phase !== 'ready' ? null : (
          <div className="arguments-layout">
            <aside className="arguments-sidebar">
              <div className="arguments-create-actions">
                <button
                  onClick={() => beginCreate('topic')}
                  ref={newTopicButtonRef}
                  type="button"
                >
                  New Topic
                </button>
                <button onClick={() => beginCreate('axiom')} type="button">
                  New Axiom
                </button>
                <button onClick={() => beginCreate('context')} type="button">
                  New Context
                </button>
                <button onClick={() => beginCreate('argument')} type="button">
                  New Argument
                </button>
                <button
                  onClick={() => beginCreate('counter-argument')}
                  type="button"
                >
                  New Counter-Argument
                </button>
              </div>
              <nav aria-label="Topics" className="arguments-topics">
                <h2>Topics</h2>
                {state.snapshot.library.topics.filter(
                  (topic) => !topic.archived,
                ).length === 0 ? (
                  <p className="arguments-empty">No active Topics.</p>
                ) : (
                  <ul>
                    {state.snapshot.library.topics
                      .filter((topic) => !topic.archived)
                      .map((topic) => (
                        <li key={topic.id}>
                          <button
                            aria-current={
                              currentSelection?.kind === 'topic' &&
                              currentSelection.id === topic.id
                                ? 'page'
                                : undefined
                            }
                            onClick={() =>
                              navigate({ kind: 'topic', id: topic.id })
                            }
                            type="button"
                          >
                            {topic.title}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </nav>
              <nav aria-label="Contexts" className="arguments-topics">
                <h2>Contexts</h2>
                {state.snapshot.library.contexts.filter(
                  (context) => !context.archived,
                ).length === 0 ? (
                  <p className="arguments-empty">No active Contexts.</p>
                ) : (
                  <ul>
                    {state.snapshot.library.contexts
                      .filter((context) => !context.archived)
                      .map((context) => (
                        <li key={context.id}>
                          <button
                            aria-current={
                              currentSelection?.kind === 'context' &&
                              currentSelection.id === context.id
                                ? 'page'
                                : undefined
                            }
                            onClick={() =>
                              navigate({ kind: 'context', id: context.id })
                            }
                            type="button"
                          >
                            {context.title}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </nav>
              <SearchPane
                library={state.snapshot.library}
                onNavigate={navigate}
                reader={state.reader}
                snapshot={state.snapshot.descriptor}
              />
            </aside>
            <main className="arguments-main" data-graph-scroll-container>
              <section className="arguments-source-binding">
                <div>
                  <strong>Theory source access</strong>
                  <small>{sourceState.message}</small>
                </div>
                {sourceState.status ===
                'unavailable' ? null : sourceState.status === 'bound' ? (
                  <button
                    onClick={() => {
                      argumentSources.disconnect();
                      setNotice('Theory source access disconnected.');
                    }}
                    type="button"
                  >
                    Disconnect source access
                  </button>
                ) : (
                  <button onClick={bindTheorySources} type="button">
                    Use selected vault for theory sources
                  </button>
                )}
              </section>
              <div className="arguments-main__toolbar">
                <button
                  disabled={history.length === 0}
                  onClick={goBack}
                  type="button"
                >
                  Back
                </button>
                {selectedRecord === undefined || editor !== undefined ? null : (
                  <button
                    onClick={() =>
                      setEditor(
                        editDraft(
                          state.snapshot.library,
                          state.snapshot.descriptor,
                          currentSelection!,
                        ),
                      )
                    }
                    type="button"
                  >
                    Edit
                  </button>
                )}
                {selectedRecord === undefined || editor !== undefined ? null : (
                  <select
                    aria-label="Change human review state"
                    disabled={state.busy}
                    onChange={(event) =>
                      void changeRecordState(
                        event.currentTarget.value as HumanReviewState,
                      )
                    }
                    value={selectedRecord.reviewState}
                  >
                    <option value="draft">draft</option>
                    <option value="pending-review">pending-review</option>
                    <option value="accepted">accepted</option>
                    <option value="reopened">reopened</option>
                    <option value="rejected">rejected</option>
                  </select>
                )}
                {selectedRecord === undefined || editor !== undefined ? null : (
                  <button
                    disabled={state.busy}
                    onClick={() => void toggleArchive()}
                    type="button"
                  >
                    {selectedRecord.archived ? 'Restore' : 'Archive'}
                  </button>
                )}
                {currentSelection === undefined ||
                editor !== undefined ? null : (
                  <button onClick={previewContext} type="button">
                    Preview context
                  </button>
                )}
                {editor === undefined ? null : (
                  <>
                    <button
                      disabled={state.busy}
                      onClick={() => void saveCurrent()}
                      type="button"
                    >
                      {state.busy ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      disabled={state.busy}
                      onClick={() =>
                        requestTransition('Cancel this draft?', () => {
                          const wasResolving = proposalResolution !== undefined;
                          setEditor(undefined);
                          setProposalResolution(undefined);
                          if (wasResolving) setMailboxOpen(true);
                        })
                      }
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() =>
                        downloadText(
                          `argument-draft-${editor.record.id}.json`,
                          `${JSON.stringify({ ...editor.record, retrievalEditorText: editor.retrievalText, sourceReferencesJson: editor.source }, null, 2)}\n`,
                          'application/json',
                        )
                      }
                      type="button"
                    >
                      Download draft copy
                    </button>
                  </>
                )}
              </div>
              {editor === undefined ? (
                selectedRecord === undefined ? (
                  <section className="arguments-empty-workspace">
                    <h2>Empty library</h2>
                    <p>
                      Create a Topic, Context, Axiom, Argument, or
                      Counter-Argument to begin.
                    </p>
                  </section>
                ) : currentSelection?.kind === 'topic' ? (
                  <ArgumentTopicView
                    library={state.snapshot.library}
                    onNavigate={navigate}
                    topic={findRecord(
                      state.snapshot.library,
                      'topic',
                      currentSelection.id,
                    )}
                  />
                ) : currentSelection?.kind === 'context' ? (
                  <ArgumentContextView
                    context={findRecord(
                      state.snapshot.library,
                      'context',
                      currentSelection.id,
                    )}
                    library={state.snapshot.library}
                    onNavigate={navigate}
                  />
                ) : currentSelection?.kind === 'axiom' ? (
                  <ArgumentAxiomView
                    axiom={findRecord(
                      state.snapshot.library,
                      'axiom',
                      currentSelection.id,
                    )}
                    library={state.snapshot.library}
                    onNavigate={navigate}
                    sourceSection={
                      <TheorySourceReferences
                        currentLibrary={state.snapshot.descriptor}
                        currentSourceGeneration={
                          sourceState.status === 'unavailable'
                            ? undefined
                            : sourceState.source.sourceGeneration
                        }
                        onCopy={(value, message) => void copy(value, message)}
                        onExport={exportTheorySource}
                        onRead={(kind, id, reference) =>
                          void readTheorySource(kind, id, reference)
                        }
                        onRecord={(preview) =>
                          void recordTheorySourceBaseline(preview)
                        }
                        previews={sourcePreviews}
                        readAvailable={
                          sourceState.status === 'bound' &&
                          sourceState.freshReadAvailable
                        }
                        recordId={currentSelection.id}
                        recordKind="axiom"
                        references={
                          findRecord(
                            state.snapshot.library,
                            'axiom',
                            currentSelection.id,
                          ).sourceReferences
                        }
                      />
                    }
                  />
                ) : currentSelection?.kind === 'argument' ? (
                  <ArgumentView
                    argument={findRecord(
                      state.snapshot.library,
                      'argument',
                      currentSelection.id,
                    )}
                    library={state.snapshot.library}
                    onNavigate={navigate}
                    onPromote={(topicId) => void promoteArgument(topicId)}
                    onReassess={() => void reassessArgument()}
                    onReassessRelations={() => void reassessArgumentRelations()}
                    sourceSection={
                      <TheorySourceReferences
                        currentLibrary={state.snapshot.descriptor}
                        currentSourceGeneration={
                          sourceState.status === 'unavailable'
                            ? undefined
                            : sourceState.source.sourceGeneration
                        }
                        onCopy={(value, message) => void copy(value, message)}
                        onExport={exportTheorySource}
                        onRead={(kind, id, reference) =>
                          void readTheorySource(kind, id, reference)
                        }
                        onRecord={(preview) =>
                          void recordTheorySourceBaseline(preview)
                        }
                        previews={sourcePreviews}
                        readAvailable={
                          sourceState.status === 'bound' &&
                          sourceState.freshReadAvailable
                        }
                        recordId={currentSelection.id}
                        recordKind="argument"
                        references={
                          findRecord(
                            state.snapshot.library,
                            'argument',
                            currentSelection.id,
                          ).sourceReferences
                        }
                      />
                    }
                  />
                ) : (
                  <ArgumentCounterArgumentView
                    counter={findRecord(
                      state.snapshot.library,
                      'counter-argument',
                      currentSelection!.id,
                    )}
                    library={state.snapshot.library}
                    onNavigate={navigate}
                    onReassess={() => void reassess()}
                    sourceSection={
                      <TheorySourceReferences
                        currentLibrary={state.snapshot.descriptor}
                        currentSourceGeneration={
                          sourceState.status === 'unavailable'
                            ? undefined
                            : sourceState.source.sourceGeneration
                        }
                        onCopy={(value, message) => void copy(value, message)}
                        onExport={exportTheorySource}
                        onRead={(kind, id, reference) =>
                          void readTheorySource(kind, id, reference)
                        }
                        onRecord={(preview) =>
                          void recordTheorySourceBaseline(preview)
                        }
                        previews={sourcePreviews}
                        readAvailable={
                          sourceState.status === 'bound' &&
                          sourceState.freshReadAvailable
                        }
                        recordId={currentSelection!.id}
                        recordKind="counter-argument"
                        references={
                          findRecord(
                            state.snapshot.library,
                            'counter-argument',
                            currentSelection!.id,
                          ).sourceReferences
                        }
                      />
                    }
                  />
                )
              ) : (
                <>
                  {proposalResolution === undefined ||
                  resolvingProposal === undefined ||
                  (editor.record.kind !== 'argument' &&
                    editor.record.kind !== 'counter-argument') ? null : (
                    <ProposalResolutionPanel
                      draft={editor.record}
                      library={state.snapshot.library}
                      onDecisionNoteChange={(decisionNote) =>
                        setProposalResolution((current) =>
                          current === undefined
                            ? current
                            : { ...current, decisionNote },
                        )
                      }
                      onPromoteChange={(promoteToCurrent) =>
                        setProposalResolution((current) =>
                          current === undefined
                            ? current
                            : { ...current, promoteToCurrent },
                        )
                      }
                      onToggleAttack={toggleProposalAttack}
                      onToggleSupersession={toggleProposalSupersession}
                      proposal={resolvingProposal}
                      resolution={proposalResolution}
                    />
                  )}
                  <ArgumentRecordEditor
                    draft={editor.record}
                    errors={editor.errors}
                    library={state.snapshot.library}
                    onChange={(record) =>
                      setEditor((current) =>
                        current === undefined
                          ? current
                          : { ...current, dirty: true, errors: [], record },
                      )
                    }
                    onCreateExampleId={() =>
                      session.runtime.createId('example')
                    }
                    onCreatePremiseId={() =>
                      session.runtime.createId('premise')
                    }
                    onCreateRelationId={() =>
                      session.runtime.createId('relation')
                    }
                    onRetrievalTextChange={(retrievalText) =>
                      setEditor((current) =>
                        current === undefined
                          ? current
                          : {
                              ...current,
                              dirty: true,
                              errors: [],
                              retrievalText,
                            },
                      )
                    }
                    onSourceChange={(source) =>
                      setEditor((current) =>
                        current === undefined
                          ? current
                          : { ...current, dirty: true, errors: [], source },
                      )
                    }
                    retrievalText={editor.retrievalText}
                    source={editor.source}
                  />
                </>
              )}
              <details className="arguments-snapshot-metadata">
                <summary>Library snapshot and receipt identity</summary>
                <pre>{JSON.stringify(state.snapshot.descriptor, null, 2)}</pre>
              </details>
              {editor?.dirty === true ? (
                <p className="arguments-dirty" role="status">
                  Unsaved draft
                </p>
              ) : null}
              {state.operationError === undefined ? null : (
                <div
                  className="arguments-error arguments-operation-error"
                  role="alert"
                >
                  <p>{state.operationError}</p>
                  <button
                    disabled={state.busy}
                    onClick={() => void session.reload()}
                    type="button"
                  >
                    Reload confirmed library and review draft
                  </button>
                </div>
              )}
            </main>
          </div>
        )}

        {!mailboxOpen || state.phase !== 'ready' ? null : (
          <MailboxDialog
            busy={state.busy}
            library={state.snapshot.library}
            onAccept={startProposalAcceptance}
            onClose={() => setMailboxOpen(false)}
            onNavigate={(next) => {
              setMailboxOpen(false);
              navigate(next);
            }}
            onReject={startProposalRejection}
          />
        )}

        {notice === undefined ? null : (
          <div className="arguments-toast" role="status">
            <span>{notice}</span>
            <button
              aria-label="Dismiss status"
              onClick={() => setNotice(undefined)}
              type="button"
            >
              ×
            </button>
          </div>
        )}

        {insertJson === undefined ? null : (
          <InsertJsonDialog
            busy={state.busy}
            onCancel={() => setInsertJson(undefined)}
            onChange={(source) => setInsertJson({ source })}
            onChooseFile={(event) => void chooseInsertJson(event)}
            onConfirm={commitInsert}
            onPreview={previewInsert}
            onUseTemplate={() =>
              setInsertJson({ source: ARGUMENT_WORKSPACE_INSERT_TEMPLATE })
            }
            state={insertJson}
          />
        )}

        {importPreview === undefined ? null : (
          <section
            aria-labelledby="arguments-import-title"
            className="arguments-subdialog"
            role="dialog"
          >
            <div>
              <h2 id="arguments-import-title">Import preview</h2>
              {importPreview.error === undefined ? (
                <p>{importPreview.fileName}. Preview is non-mutating.</p>
              ) : (
                <p className="arguments-error" role="alert">
                  {importPreview.error}
                </p>
              )}
              {importPreview.merge === undefined ? null : (
                <div>
                  <h3>Merge</h3>
                  {importPreview.merge.migratedFromSchemaVersion ===
                  undefined ? null : (
                    <p className="arguments-disclosure">
                      Incoming schema v
                      {importPreview.merge.migratedFromSchemaVersion} was
                      migrated to v5 without inferring canonical records,
                      relationships, Context bindings, Current pointers, or
                      Mailbox proposals.
                    </p>
                  )}
                  <p>Status: {importPreview.merge.preview.status}</p>
                  {importPreview.merge.preview.status === 'conflict' ? (
                    <ul>
                      {importPreview.merge.preview.conflicts.map((conflict) => (
                        <li key={`${conflict.kind}:${conflict.id}`}>
                          {conflict.id}: {conflict.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      {importPreview.merge.preview.status === 'identical'
                        ? 'No changes; exact re-import is idempotent.'
                        : `${importPreview.merge.preview.additions.length} record additions.`}
                    </p>
                  )}
                  <button
                    disabled={
                      state.phase !== 'ready' ||
                      state.busy ||
                      importPreview.merge.preview.status === 'conflict'
                    }
                    onClick={() => commitImport(importPreview.merge!)}
                    type="button"
                  >
                    Confirm merge
                  </button>
                </div>
              )}
              {importPreview.replace === undefined ? null : (
                <div>
                  <h3>Replace</h3>
                  <p>Status: {importPreview.replace.preview.status}</p>
                  {importPreview.replace.preview.status === 'conflict' ? (
                    <ul>
                      {importPreview.replace.preview.conflicts.map(
                        (conflict) => (
                          <li key={`${conflict.kind}:${conflict.id}`}>
                            {conflict.id}: {conflict.message}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p>
                      Incoming {counts(importPreview.replace.incoming)}. Lineage{' '}
                      <code>{importPreview.replace.incoming.libraryId}</code>.
                    </p>
                  )}
                  <button
                    disabled={
                      state.phase !== 'ready' ||
                      state.busy ||
                      importPreview.replace.preview.status === 'conflict'
                    }
                    onClick={() => commitImport(importPreview.replace!)}
                    type="button"
                  >
                    Confirm replacement
                  </button>
                </div>
              )}
              <button onClick={() => setImportPreview(undefined)} type="button">
                Cancel import
              </button>
            </div>
          </section>
        )}

        {markdownFiles === undefined ? null : (
          <section
            aria-labelledby="arguments-markdown-title"
            className="arguments-subdialog"
            role="dialog"
          >
            <div>
              <h2 id="arguments-markdown-title">Obsidian Markdown export</h2>
              <p>
                Inspectable files from the confirmed snapshot. Downloads go only
                to destinations chosen by the browser; the active vault is never
                written.
              </p>
              <button onClick={() => void saveMarkdownFolder()} type="button">
                Save folder structure
              </button>
              <ul className="arguments-export-files">
                {markdownFiles.files.map((file) => (
                  <li key={file.path}>
                    <code>{file.path}</code>
                    <button
                      onClick={() =>
                        downloadText(
                          file.path.split('/').at(-1)!,
                          file.text,
                          'text/markdown',
                        )
                      }
                      type="button"
                    >
                      Download
                    </button>
                  </li>
                ))}
              </ul>
              <p className="arguments-disclosure">
                If folder selection is unavailable, preserve each shown{' '}
                <code>topics/</code>, <code>axioms/</code>,{' '}
                <code>contexts/</code>, <code>arguments/</code>, or{' '}
                <code>counter-arguments/</code> path when arranging individual
                downloads so reusable links remain valid.
              </p>
              <button onClick={() => setMarkdownFiles(undefined)} type="button">
                Close export
              </button>
            </div>
          </section>
        )}

        {contextExport === undefined ? null : (
          <section
            aria-labelledby="arguments-context-title"
            className="arguments-subdialog"
            role="dialog"
          >
            <div>
              <h2 id="arguments-context-title">Context preview</h2>
              <p>{displayedContext!.label}.</p>
              {contextExport.sourcePacket === undefined ? null : (
                <p className="arguments-disclosure">
                  {sourcePacketCurrent
                    ? 'This packet matches the current library and captured source.'
                    : 'This is a retained older packet. Its exports remain reproducible; regenerate for current content.'}
                </p>
              )}
              <details className="arguments-context-sources">
                <summary>
                  Registered theory sources ({contextOrigins.length})
                </summary>
                {contextOrigins.length === 0 ? (
                  <p className="arguments-empty">No linked sources selected.</p>
                ) : (
                  <ul>
                    {contextOrigins.map((origin) => (
                      <li
                        key={`${origin.recordKind}:${origin.recordId}:${origin.sourceReferenceId}`}
                      >
                        <code>{origin.sourceReferenceId}</code> —{' '}
                        {origin.locator.label} [{origin.role}]
                      </li>
                    ))}
                  </ul>
                )}
              </details>
              {contextExport.error === undefined ? null : (
                <p className="arguments-error" role="alert">
                  {contextExport.error}
                </p>
              )}
              <textarea
                aria-label="Argument context preview"
                readOnly
                value={displayedContext!.text}
              />
              <div className="arguments-actions">
                <button
                  disabled={
                    contextExport.preparing ||
                    contextOrigins.length === 0 ||
                    sourceState.status !== 'bound' ||
                    !sourceState.freshReadAvailable
                  }
                  onClick={() => void includeTheorySources()}
                  type="button"
                >
                  {contextExport.preparing
                    ? 'Preparing source packet…'
                    : contextExport.sourcePacket === undefined
                      ? 'Include linked theory sources'
                      : 'Regenerate source packet'}
                </button>
                {contextExport.sourcePacket === undefined ? null : (
                  <button
                    onClick={() =>
                      setContextExport((current) =>
                        current === undefined
                          ? current
                          : { ...current, sourcePacket: undefined },
                      )
                    }
                    type="button"
                  >
                    Show library-only context
                  </button>
                )}
                <button
                  onClick={() =>
                    void copy(displayedContext!.text, 'Context copied')
                  }
                  type="button"
                >
                  Copy context
                </button>
                <button
                  onClick={() =>
                    downloadText(
                      'argument-context.md',
                      displayedContext!.text,
                      'text/markdown',
                    )
                  }
                  type="button"
                >
                  Export context
                </button>
                <button
                  onClick={() =>
                    downloadText(
                      'argument-context.json',
                      displayedContext!.structured,
                      'application/json',
                    )
                  }
                  type="button"
                >
                  Export structured payload and receipt
                </button>
                <button
                  onClick={() => setContextExport(undefined)}
                  type="button"
                >
                  Close preview
                </button>
              </div>
            </div>
          </section>
        )}

        {confirmation === undefined ? null : (
          <section
            aria-labelledby="arguments-dirty-title"
            className="arguments-subdialog arguments-subdialog--confirmation"
            role="alertdialog"
          >
            <div>
              <h2 id="arguments-dirty-title">Unsaved changes</h2>
              <p>{confirmation}</p>
              <div className="arguments-actions">
                <button
                  disabled={state.busy}
                  onClick={() => void saveAndContinue()}
                  type="button"
                >
                  Save
                </button>
                <button
                  disabled={state.busy}
                  onClick={discardAndContinue}
                  type="button"
                >
                  Discard
                </button>
                <button
                  onClick={() => {
                    pendingTransition.current = undefined;
                    setConfirmation(undefined);
                  }}
                  type="button"
                >
                  Stay
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </ArgumentsWorkspaceContainer>
  );
});

export function ArgumentsWorkspace({
  open,
  onRequestClose,
  restoreFocus,
  session,
  sourceAccess,
}: {
  readonly open: boolean;
  readonly onRequestClose: () => void;
  readonly restoreFocus?: HTMLElement;
  readonly session: ArgumentWorkspaceSession;
  readonly sourceAccess?: ArgumentSourceAccess;
}) {
  return (
    <ArgumentsWorkspaceContent
      active={open}
      embedded={false}
      onRequestClose={onRequestClose}
      session={session}
      {...(sourceAccess === undefined ? {} : { sourceAccess })}
      {...(restoreFocus === undefined ? {} : { restoreFocus })}
    />
  );
}

export const ArgumentsWorkspacePanel = forwardRef<
  ArgumentsWorkspaceHandle,
  {
    readonly active: boolean;
    readonly onRequestClose: () => void;
    readonly session: ArgumentWorkspaceSession;
    readonly sourceAccess?: ArgumentSourceAccess;
  }
>(function ArgumentsWorkspacePanel(props, ref) {
  return <ArgumentsWorkspaceContent {...props} embedded ref={ref} />;
});

export function ArgumentWorkspaceOwner({
  open,
  onRequestClose,
  restoreFocus,
  sourceAccess,
  store,
}: {
  readonly open: boolean;
  readonly onRequestClose: () => void;
  readonly restoreFocus?: HTMLElement;
  readonly sourceAccess?: ArgumentSourceAccess;
  readonly store?: ArgumentLibraryStore;
}) {
  const [session] = useState(
    () =>
      new ArgumentWorkspaceSession(
        store ?? createPlatformArgumentLibraryStore(),
      ),
  );
  return (
    <ArgumentsWorkspace
      onRequestClose={onRequestClose}
      open={open}
      session={session}
      {...(sourceAccess === undefined ? {} : { sourceAccess })}
      {...(restoreFocus === undefined ? {} : { restoreFocus })}
    />
  );
}
