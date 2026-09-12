import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type SyntheticEvent,
} from 'react';

import {
  exportArgumentLibraryMarkdown,
  parseArgumentLibraryJson,
  serializeArgumentLibrary,
  type ArgumentLibrary,
  type ArgumentLibraryStore,
  type ArgumentRecordKind,
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
  ArgumentTopicView,
  type ArgumentSelection,
} from './ArgumentRecordView';
import { activateArgumentWorkspaceOverlay } from './argument-overlay';
import {
  argumentBundleFailure,
  formatArgumentBundle,
  type ArgumentContextExport,
} from './context-export';
import { createPlatformArgumentLibraryStore } from './platform-store';
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
  type ArgumentRecordDraft,
} from './session';
import './arguments.css';

interface EditorState {
  readonly record: ArgumentRecordDraft;
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
  const axiom =
    library.axioms.find(({ archived }) => !archived) ?? library.axioms[0];
  if (axiom !== undefined) return { kind: 'axiom', id: axiom.id };
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
        counterArgumentIds: topic.counterArgumentIds,
      },
    };
  }
  if (selection.kind === 'axiom') {
    const axiom = findRecord(library, 'axiom', selection.id);
    return {
      dirty: false,
      errors: [],
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
  const counter = findRecord(library, 'counter-argument', selection.id);
  return {
    dirty: false,
    errors: [],
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
  if (kind === 'topic') {
    return {
      dirty: true,
      errors: [],
      source: '[]',
      record: {
        ...base,
        kind,
        summary: '',
        axiomIds: [],
        counterArgumentIds: [],
      },
    };
  }
  if (kind === 'axiom') {
    return {
      dirty: true,
      errors: [],
      source: '[]',
      record: { ...base, kind, statement: '', sourceReferences: [] },
    };
  }
  return {
    dirty: true,
    errors: [],
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
  if (editor.record.kind === 'counter-argument') {
    if (editor.record.observation.trim() === '')
      errors.push('Observation is required.');
    if (editor.record.challengedClaim.trim() === '')
      errors.push('Challenged claim is required.');
  }
  if (editor.record.kind === 'topic') {
    return errors.length === 0
      ? { valid: true, record: editor.record }
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
      ...editor.record,
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
  return `${library.topics.length} Topic${library.topics.length === 1 ? '' : 's'}, ${library.axioms.length} Axiom${library.axioms.length === 1 ? '' : 's'}, ${library.counterArguments.length} Counter-Argument${library.counterArguments.length === 1 ? '' : 's'}`;
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
    setPreview({ source, fileName: file.name, library: parsed.value });
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
      <div className="arguments-search-results" aria-live="polite">
        {current.candidates.length === 0 ? (
          <p className="arguments-empty">No matching records.</p>
        ) : (
          <ul>
            {current.candidates.map((candidate) => (
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

export function ArgumentsWorkspace({
  open,
  onRequestClose,
  restoreFocus,
  session,
}: {
  readonly open: boolean;
  readonly onRequestClose: () => void;
  readonly restoreFocus?: HTMLElement;
  readonly session: ArgumentWorkspaceSession;
}) {
  const state = useSyncExternalStore(
    session.subscribe,
    session.state,
    session.state,
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
  const [importPreview, setImportPreview] = useState<ImportPreviewState>();
  const [markdownFiles, setMarkdownFiles] =
    useState<ReturnType<typeof exportArgumentLibraryMarkdown>>();
  const [contextExport, setContextExport] = useState<ArgumentContextExport>();
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

  useEffect(() => {
    escapeAction.current = () => {
      if (confirmation !== undefined) {
        pendingTransition.current = undefined;
        setConfirmation(undefined);
        return;
      }
      if (contextExport !== undefined) {
        setContextExport(undefined);
        return;
      }
      if (markdownFiles !== undefined) {
        setMarkdownFiles(undefined);
        return;
      }
      if (importPreview !== undefined) {
        setImportPreview(undefined);
        return;
      }
      requestClose();
    };
  }, [confirmation, contextExport, importPreview, markdownFiles, requestClose]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, restoreFocus]);

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
      setHistory((current) =>
        currentSelection === undefined || sameSelection(currentSelection, next)
          ? current
          : [...current, currentSelection],
      );
      setSelection(next);
      setEditor(undefined);
    });
  }

  function goBack() {
    const target = history.at(-1);
    if (target === undefined) return;
    requestTransition('Return with unsaved changes?', () => {
      setHistory((current) => current.slice(0, -1));
      setSelection(target);
      setEditor(undefined);
    });
  }

  async function saveCurrent(afterSave?: () => void): Promise<boolean> {
    if (editor === undefined) return false;
    const parsed = parseSources(editor);
    if (!parsed.valid) {
      setEditor({ ...editor, errors: parsed.errors });
      return false;
    }
    const result = await session.save(parsed.record);
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
    setNotice('Saved');
    afterSave?.();
    return true;
  }

  function discardAndContinue() {
    const action = pendingTransition.current;
    pendingTransition.current = undefined;
    setConfirmation(undefined);
    setEditor(undefined);
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
      setEditor(
        newDraft(
          kind,
          state.snapshot.descriptor,
          session,
          currentSelection?.kind === 'topic' ? currentSelection.id : undefined,
        ),
      );
    });
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

  function previewContext() {
    if (state.phase !== 'ready' || currentSelection === undefined) return;
    const result = state.reader.readArgumentBundle({
      ...currentSelection,
      maxDepth: 8,
      maxRecords: 100,
      expectedSnapshot: state.snapshot.descriptor,
    });
    if (result.status === 'ok')
      setContextExport(formatArgumentBundle(result.value));
    else setNotice(argumentBundleFailure(result));
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

  const selectedRecord =
    state.phase === 'ready' && currentSelection !== undefined
      ? findRecord(
          state.snapshot.library,
          currentSelection.kind,
          currentSelection.id,
        )
      : undefined;

  return (
    <dialog
      aria-labelledby="arguments-workspace-title"
      className="arguments-dialog"
      onCancel={cancelNative}
      ref={dialogRef}
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
                <label className="button-like">
                  Import JSON
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
              <SearchPane
                library={state.snapshot.library}
                onNavigate={navigate}
                reader={state.reader}
                snapshot={state.snapshot.descriptor}
              />
            </aside>
            <main className="arguments-main" data-graph-scroll-container>
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
                        requestTransition('Cancel this draft?', () =>
                          setEditor(undefined),
                        )
                      }
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() =>
                        downloadText(
                          `argument-draft-${editor.record.id}.json`,
                          `${JSON.stringify({ ...editor.record, sourceReferencesJson: editor.source }, null, 2)}\n`,
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
                    <p>Create a Topic, Axiom, or Counter-Argument to begin.</p>
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
                ) : currentSelection?.kind === 'axiom' ? (
                  <ArgumentAxiomView
                    axiom={findRecord(
                      state.snapshot.library,
                      'axiom',
                      currentSelection.id,
                    )}
                    library={state.snapshot.library}
                    onCopy={(value) => void copy(value, 'Locator copied')}
                    onNavigate={navigate}
                  />
                ) : (
                  <ArgumentCounterArgumentView
                    counter={findRecord(
                      state.snapshot.library,
                      'counter-argument',
                      currentSelection!.id,
                    )}
                    library={state.snapshot.library}
                    onCopy={(value) => void copy(value, 'Locator copied')}
                    onNavigate={navigate}
                    onReassess={() => void reassess()}
                  />
                )
              ) : (
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
                  onSourceChange={(source) =>
                    setEditor((current) =>
                      current === undefined
                        ? current
                        : { ...current, dirty: true, errors: [], source },
                    )
                  }
                  source={editor.source}
                />
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
                <code>topics/</code>, <code>axioms/</code>, or{' '}
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
              <p>{contextExport.label}.</p>
              <textarea
                aria-label="Argument context preview"
                readOnly
                value={contextExport.text}
              />
              <div className="arguments-actions">
                <button
                  onClick={() =>
                    void copy(contextExport.text, 'Context copied')
                  }
                  type="button"
                >
                  Copy context
                </button>
                <button
                  onClick={() =>
                    downloadText(
                      'argument-context.md',
                      contextExport.text,
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
                      contextExport.structured,
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
    </dialog>
  );
}

export function ArgumentWorkspaceOwner({
  open,
  onRequestClose,
  restoreFocus,
  store,
}: {
  readonly open: boolean;
  readonly onRequestClose: () => void;
  readonly restoreFocus?: HTMLElement;
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
      {...(restoreFocus === undefined ? {} : { restoreFocus })}
    />
  );
}
