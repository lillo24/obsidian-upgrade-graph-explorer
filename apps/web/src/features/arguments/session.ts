import {
  ArgumentLibraryAuthoringService,
  ArgumentLibraryRepository,
  attachAnsweringAxiom,
  captureArgumentLibrarySnapshot,
  createAxiom,
  createCounterArgument,
  createKnowledgeReader,
  createTopic,
  detachAnsweringAxiom,
  editAxiom,
  editCounterArgument,
  editTopic,
  parseArgumentLibraryJson,
  previewArgumentLibraryImport,
  reassessCounterArgumentResponse,
  sameSnapshot,
  setRecordArchived,
  setRecordReviewState,
  setTopicMembership,
  updateCounterArgumentResponse,
  type ArgumentAxiom,
  type ArgumentCounterArgument,
  type ArgumentImportPreview,
  type ArgumentLibrary,
  type ArgumentLibraryCommitResult,
  type ArgumentLibrarySnapshot,
  type ArgumentLibraryStore,
  type ArgumentRecordKind,
  type ArgumentRuntime,
  type ArgumentTopic,
  type CounterArgumentOutcome,
  type CounterArgumentTarget,
  type HumanReviewState,
  type KnowledgeReader,
  type RetrievalMetadata,
  type RecordTheorySourceVersionInput,
  type SnapshotDescriptor,
  type TheorySourceReference,
} from '@icarus-graph-explorer/argument-workspace';

export const ARGUMENT_LIBRARY_IMPORT_LIMIT_BYTES = 5 * 1024 * 1024;

export type ArgumentWorkspaceSessionState =
  | { readonly phase: 'loading'; readonly busy: boolean }
  | {
      readonly phase: 'missing';
      readonly busy: boolean;
      readonly message?: string;
    }
  | {
      readonly phase: 'failure';
      readonly busy: boolean;
      readonly kind: 'corrupt' | 'future-schema' | 'unreadable';
      readonly message: string;
      readonly preservedValue?: string;
    }
  | {
      readonly phase: 'ready';
      readonly busy: boolean;
      readonly snapshot: ArgumentLibrarySnapshot;
      readonly reader: KnowledgeReader;
      readonly message?: string;
      readonly operationError?: string;
      readonly conflict?: SnapshotDescriptor;
    };

interface DraftBase {
  readonly mode: 'create' | 'edit';
  readonly id: string;
  readonly expected: SnapshotDescriptor;
  readonly reviewState: HumanReviewState;
  readonly topicIds: readonly string[];
}

export interface TopicRecordDraft extends DraftBase {
  readonly kind: 'topic';
  readonly title: string;
  readonly summary: string;
  readonly retrieval: RetrievalMetadata;
  readonly axiomIds: readonly string[];
  readonly counterArgumentIds: readonly string[];
}

export interface AxiomRecordDraft extends DraftBase {
  readonly kind: 'axiom';
  readonly title: string;
  readonly statement: string;
  readonly explanation?: string | undefined;
  readonly scope?: string | undefined;
  readonly supportingReasoning?: string | undefined;
  readonly retrieval: RetrievalMetadata;
  readonly sourceReferences: readonly TheorySourceReference[];
}

export interface CounterArgumentRecordDraft extends DraftBase {
  readonly kind: 'counter-argument';
  readonly title: string;
  readonly observation: string;
  readonly challengedClaim: string;
  readonly target?: CounterArgumentTarget | undefined;
  readonly retrieval: RetrievalMetadata;
  readonly sourceReferences: readonly TheorySourceReference[];
  readonly answeringAxiomIds: readonly string[];
  readonly responseExplanation: string;
  readonly outcome: CounterArgumentOutcome;
  readonly boundary?: string | undefined;
  readonly reopeningCondition?: string | undefined;
}

export type ArgumentRecordDraft =
  TopicRecordDraft | AxiomRecordDraft | CounterArgumentRecordDraft;

export interface ArgumentImportPlan {
  readonly source: string;
  readonly incoming: ArgumentLibrary;
  readonly mode: 'merge' | 'replace';
  readonly preview: ArgumentImportPreview;
  readonly base: SnapshotDescriptor;
}

export type ArgumentWorkspaceActionResult =
  | { readonly status: 'ok'; readonly snapshot: ArgumentLibrarySnapshot }
  | {
      readonly status: 'invalid' | 'conflict' | 'error';
      readonly message: string;
      readonly actual?: SnapshotDescriptor;
    };

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized === '' ? undefined : value;
}

function syncTopicMemberships(
  library: ArgumentLibrary,
  kind: 'axiom' | 'counter-argument',
  id: string,
  selectedTopicIds: readonly string[],
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const selected = new Set(selectedTopicIds);
  let next = library;
  for (const topic of library.topics) {
    const current =
      kind === 'axiom'
        ? topic.axiomIds.includes(id)
        : topic.counterArgumentIds.includes(id);
    const wanted = selected.has(topic.id);
    if (current !== wanted) {
      next = setTopicMembership(next, topic.id, kind, id, wanted, runtime);
    }
  }
  return next;
}

function syncTopicRecordMemberships(
  library: ArgumentLibrary,
  draft: TopicRecordDraft,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  let next = library;
  const axiomIds = new Set(draft.axiomIds);
  const counterIds = new Set(draft.counterArgumentIds);
  const topic = next.topics.find(({ id }) => id === draft.id)!;
  for (const axiom of next.axioms) {
    const current = topic.axiomIds.includes(axiom.id);
    const wanted = axiomIds.has(axiom.id);
    if (current !== wanted) {
      next = setTopicMembership(
        next,
        draft.id,
        'axiom',
        axiom.id,
        wanted,
        runtime,
      );
    }
  }
  for (const counter of next.counterArguments) {
    const current = topic.counterArgumentIds.includes(counter.id);
    const wanted = counterIds.has(counter.id);
    if (current !== wanted) {
      next = setTopicMembership(
        next,
        draft.id,
        'counter-argument',
        counter.id,
        wanted,
        runtime,
      );
    }
  }
  return next;
}

function saveDraft(
  library: ArgumentLibrary,
  draft: ArgumentRecordDraft,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  let next = library;
  if (draft.kind === 'topic') {
    next =
      draft.mode === 'create'
        ? createTopic(
            next,
            {
              id: draft.id,
              title: draft.title,
              summary: draft.summary,
              retrieval: draft.retrieval,
              reviewState: draft.reviewState,
            },
            runtime,
          )
        : editTopic(
            next,
            draft.id,
            {
              title: draft.title,
              summary: draft.summary,
              retrieval: draft.retrieval,
            },
            runtime,
          );
    next = syncTopicRecordMemberships(next, draft, runtime);
  } else if (draft.kind === 'axiom') {
    const explanation = optional(draft.explanation);
    const scope = optional(draft.scope);
    const supportingReasoning = optional(draft.supportingReasoning);
    next =
      draft.mode === 'create'
        ? createAxiom(
            next,
            {
              id: draft.id,
              title: draft.title,
              statement: draft.statement,
              ...(explanation === undefined ? {} : { explanation }),
              ...(scope === undefined ? {} : { scope }),
              ...(supportingReasoning === undefined
                ? {}
                : { supportingReasoning }),
              retrieval: draft.retrieval,
              sourceReferences: draft.sourceReferences,
              reviewState: draft.reviewState,
            },
            runtime,
          )
        : editAxiom(
            next,
            draft.id,
            {
              title: draft.title,
              statement: draft.statement,
              explanation: optional(draft.explanation) ?? null,
              scope: optional(draft.scope) ?? null,
              supportingReasoning: optional(draft.supportingReasoning) ?? null,
              retrieval: draft.retrieval,
              sourceReferences: draft.sourceReferences,
            },
            runtime,
          );
    next = syncTopicMemberships(
      next,
      'axiom',
      draft.id,
      draft.topicIds,
      runtime,
    );
  } else {
    const answeringAxiomIds = unique(draft.answeringAxiomIds);
    const boundary = optional(draft.boundary);
    const reopeningCondition = optional(draft.reopeningCondition);
    next =
      draft.mode === 'create'
        ? createCounterArgument(
            next,
            {
              id: draft.id,
              title: draft.title,
              observation: draft.observation,
              challengedClaim: draft.challengedClaim,
              ...(draft.target === undefined ? {} : { target: draft.target }),
              retrieval: draft.retrieval,
              sourceReferences: draft.sourceReferences,
              reviewState: draft.reviewState,
              response: {
                answeringAxioms: answeringAxiomIds.map((axiomId) => ({
                  axiomId,
                  reliedOnRevision: next.axioms.find(
                    ({ id }) => id === axiomId,
                  )!.revision,
                })),
                explanation: draft.responseExplanation,
                outcome: draft.outcome,
                ...(boundary === undefined ? {} : { boundary }),
                ...(reopeningCondition === undefined
                  ? {}
                  : { reopeningCondition }),
              },
            },
            runtime,
          )
        : editCounterArgument(
            next,
            draft.id,
            {
              title: draft.title,
              observation: draft.observation,
              challengedClaim: draft.challengedClaim,
              target: draft.target ?? null,
              retrieval: draft.retrieval,
              sourceReferences: draft.sourceReferences,
            },
            runtime,
          );
    if (draft.mode === 'edit') {
      next = updateCounterArgumentResponse(
        next,
        draft.id,
        {
          explanation: draft.responseExplanation,
          outcome: draft.outcome,
          boundary: optional(draft.boundary) ?? null,
          reopeningCondition: optional(draft.reopeningCondition) ?? null,
        },
        runtime,
      );
      const record = next.counterArguments.find(({ id }) => id === draft.id)!;
      const wanted = new Set(answeringAxiomIds);
      for (const reference of record.response.answeringAxioms) {
        if (!wanted.has(reference.axiomId)) {
          next = detachAnsweringAxiom(
            next,
            draft.id,
            reference.axiomId,
            runtime,
          );
        }
      }
      for (const axiomId of answeringAxiomIds) {
        next = attachAnsweringAxiom(next, draft.id, axiomId, runtime);
      }
    }
    next = syncTopicMemberships(
      next,
      'counter-argument',
      draft.id,
      draft.topicIds,
      runtime,
    );
  }
  const record = findRecord(next, draft.kind, draft.id);
  if (record.reviewState !== draft.reviewState) {
    next = setRecordReviewState(
      next,
      draft.kind,
      draft.id,
      draft.reviewState,
      runtime,
    );
  }
  return next;
}

export function findRecord(
  library: ArgumentLibrary,
  kind: 'topic',
  id: string,
): ArgumentTopic;
export function findRecord(
  library: ArgumentLibrary,
  kind: 'axiom',
  id: string,
): ArgumentAxiom;
export function findRecord(
  library: ArgumentLibrary,
  kind: 'counter-argument',
  id: string,
): ArgumentCounterArgument;
export function findRecord(
  library: ArgumentLibrary,
  kind: ArgumentRecordKind,
  id: string,
): ArgumentTopic | ArgumentAxiom | ArgumentCounterArgument;
export function findRecord(
  library: ArgumentLibrary,
  kind: ArgumentRecordKind,
  id: string,
): ArgumentTopic | ArgumentAxiom | ArgumentCounterArgument {
  const record =
    kind === 'topic'
      ? library.topics.find((candidate) => candidate.id === id)
      : kind === 'axiom'
        ? library.axioms.find((candidate) => candidate.id === id)
        : library.counterArguments.find((candidate) => candidate.id === id);
  if (record === undefined) throw new Error(`${kind} "${id}" does not exist.`);
  return record;
}

function resultFromCommit(
  result: ArgumentLibraryCommitResult,
): ArgumentWorkspaceActionResult {
  if (result.status === 'committed')
    return { status: 'ok', snapshot: result.snapshot };
  return {
    status: result.status === 'conflict' ? 'conflict' : 'error',
    message: result.message,
    ...(result.actual === undefined ? {} : { actual: result.actual }),
  };
}

export function createBrowserArgumentRuntime(): ArgumentRuntime {
  let fallbackId = 0;
  return {
    createId: (kind) => {
      const value = globalThis.crypto?.randomUUID?.();
      return `${kind}-${value ?? `${Date.now().toString(36)}-${++fallbackId}`}`;
    },
    now: () => new Date().toISOString(),
  };
}

/** One mutable repository/authoring owner for an application instance. */
export class ArgumentWorkspaceSession {
  readonly #repository: ArgumentLibraryRepository;
  readonly #authoring: ArgumentLibraryAuthoringService;
  readonly #listeners = new Set<() => void>();
  #state: ArgumentWorkspaceSessionState = { phase: 'loading', busy: false };
  #queue: Promise<void> = Promise.resolve();
  #openPromise?: Promise<void>;

  constructor(
    store: ArgumentLibraryStore,
    readonly runtime: ArgumentRuntime = createBrowserArgumentRuntime(),
  ) {
    this.#repository = new ArgumentLibraryRepository(store);
    this.#authoring = new ArgumentLibraryAuthoringService(
      this.#repository,
      runtime,
    );
  }

  state = (): ArgumentWorkspaceSessionState => this.#state;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  #publish(state: ArgumentWorkspaceSessionState): void {
    this.#state = state;
    this.#listeners.forEach((listener) => listener());
  }

  #ready(snapshot: ArgumentLibrarySnapshot, message?: string): void {
    this.#publish({
      phase: 'ready',
      busy: false,
      snapshot,
      reader: createKnowledgeReader(snapshot),
      ...(message === undefined ? {} : { message }),
    });
  }

  #schedule<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(operation, operation);
    this.#queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  open(): Promise<void> {
    this.#openPromise ??= this.#schedule(async () => {
      try {
        const opened = await this.#repository.open();
        if (opened.status === 'ready') this.#ready(opened.snapshot);
        else if (opened.status === 'missing') {
          this.#publish({ phase: 'missing', busy: false });
        } else {
          this.#publish({
            phase: 'failure',
            busy: false,
            kind: opened.status,
            message: opened.message,
            ...(opened.preservedValue === undefined
              ? {}
              : { preservedValue: opened.preservedValue }),
          });
        }
      } catch (error: unknown) {
        this.#publish({
          phase: 'failure',
          busy: false,
          kind: 'unreadable',
          message: `Could not open the Argument Library: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    });
    return this.#openPromise;
  }

  reload(): Promise<void> {
    return this.#schedule(async () => {
      const previous = this.#state;
      this.#publish({ ...previous, busy: true });
      try {
        const opened = await this.#repository.open();
        if (opened.status === 'ready') this.#ready(opened.snapshot, 'Reloaded');
        else if (previous.phase === 'ready') {
          this.#publish({
            ...previous,
            busy: false,
            operationError:
              opened.status === 'missing'
                ? 'Reload found no stored Argument Library. The last confirmed snapshot and draft were retained.'
                : `${opened.message} The last confirmed snapshot and draft were retained.`,
          });
        } else if (opened.status === 'missing') {
          this.#publish({ phase: 'missing', busy: false });
        } else {
          this.#publish({
            phase: 'failure',
            busy: false,
            kind: opened.status,
            message: opened.message,
            ...(opened.preservedValue === undefined
              ? {}
              : { preservedValue: opened.preservedValue }),
          });
        }
      } catch (error: unknown) {
        this.#publish({
          ...previous,
          busy: false,
          ...(previous.phase === 'ready'
            ? {
                operationError: `Reload failed: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              }
            : {}),
        });
      }
    });
  }

  initializeEmpty(): Promise<ArgumentWorkspaceActionResult> {
    return this.#initialize(undefined);
  }

  initializeJson(source: string): Promise<ArgumentWorkspaceActionResult> {
    if (
      new TextEncoder().encode(source).byteLength >
      ARGUMENT_LIBRARY_IMPORT_LIMIT_BYTES
    ) {
      return Promise.resolve({
        status: 'invalid',
        message: 'Argument Library JSON exceeds the 5 MiB import limit.',
      });
    }
    const parsed = parseArgumentLibraryJson(source);
    if (parsed.status !== 'valid') {
      return Promise.resolve({ status: 'invalid', message: parsed.message });
    }
    return this.#initialize(parsed.value);
  }

  #initialize(
    seed: ArgumentLibrary | undefined,
  ): Promise<ArgumentWorkspaceActionResult> {
    return this.#schedule(async () => {
      this.#publish({ phase: 'missing', busy: true });
      const result = resultFromCommit(
        await this.#repository.initialize(this.runtime, seed),
      );
      if (result.status === 'ok') this.#ready(result.snapshot, 'Saved');
      else
        this.#publish({
          phase: 'missing',
          busy: false,
          message: result.message,
        });
      return result;
    });
  }

  save(draft: ArgumentRecordDraft): Promise<ArgumentWorkspaceActionResult> {
    return this.#commit(draft.expected, (library) =>
      saveDraft(library, draft, this.runtime),
    );
  }

  setArchived(
    expected: SnapshotDescriptor,
    kind: ArgumentRecordKind,
    id: string,
    archived: boolean,
  ): Promise<ArgumentWorkspaceActionResult> {
    return this.#commit(expected, (library) =>
      setRecordArchived(library, kind, id, archived, this.runtime),
    );
  }

  setReviewState(
    expected: SnapshotDescriptor,
    kind: ArgumentRecordKind,
    id: string,
    reviewState: HumanReviewState,
  ): Promise<ArgumentWorkspaceActionResult> {
    return this.#commit(expected, (library) =>
      setRecordReviewState(library, kind, id, reviewState, this.runtime),
    );
  }

  reassessResponse(
    expected: SnapshotDescriptor,
    id: string,
  ): Promise<ArgumentWorkspaceActionResult> {
    return this.#commit(expected, (library) =>
      reassessCounterArgumentResponse(library, id, this.runtime),
    );
  }

  recordSourceVersion(
    expected: SnapshotDescriptor,
    input: RecordTheorySourceVersionInput,
  ): Promise<ArgumentWorkspaceActionResult> {
    return this.#adopt(this.#authoring.recordSourceVersion(expected, input));
  }

  previewImport(
    source: string,
    mode: 'merge' | 'replace',
  ):
    | { readonly status: 'ok'; readonly plan: ArgumentImportPlan }
    | { readonly status: 'invalid'; readonly message: string } {
    if (
      new TextEncoder().encode(source).byteLength >
      ARGUMENT_LIBRARY_IMPORT_LIMIT_BYTES
    ) {
      return {
        status: 'invalid',
        message: 'Argument Library JSON exceeds the 5 MiB import limit.',
      };
    }
    const state = this.#state;
    if (state.phase !== 'ready') {
      return {
        status: 'invalid',
        message: 'Load or initialize the Argument Library first.',
      };
    }
    const parsed = parseArgumentLibraryJson(source);
    if (parsed.status !== 'valid')
      return { status: 'invalid', message: parsed.message };
    return {
      status: 'ok',
      plan: {
        source,
        incoming: parsed.value,
        mode,
        preview: previewArgumentLibraryImport(
          state.snapshot.library,
          parsed.value,
          mode,
        ),
        base: state.snapshot.descriptor,
      },
    };
  }

  commitImport(
    plan: ArgumentImportPlan,
  ): Promise<ArgumentWorkspaceActionResult> {
    const state = this.#state;
    if (
      state.phase !== 'ready' ||
      !sameSnapshot(state.snapshot.descriptor, plan.base)
    ) {
      return Promise.resolve({
        status: 'conflict',
        message:
          'The library changed after the import preview. Recompute the preview before importing.',
        ...(state.phase === 'ready'
          ? { actual: state.snapshot.descriptor }
          : {}),
      });
    }
    const action =
      plan.mode === 'merge'
        ? this.#authoring.mergeImport(plan.base, plan.incoming)
        : this.#authoring.replaceImport(plan.base, plan.incoming);
    return this.#adopt(action);
  }

  #commit(
    expected: SnapshotDescriptor,
    update: (library: ArgumentLibrary) => ArgumentLibrary,
  ): Promise<ArgumentWorkspaceActionResult> {
    return this.#adopt(this.#repository.commit(expected, update));
  }

  #adopt(
    action: Promise<ArgumentLibraryCommitResult>,
  ): Promise<ArgumentWorkspaceActionResult> {
    return this.#schedule(async () => {
      const previous = this.#state;
      if (previous.phase !== 'ready') {
        return { status: 'error', message: 'Argument Library is not ready.' };
      }
      this.#publish({
        phase: 'ready',
        busy: true,
        snapshot: previous.snapshot,
        reader: previous.reader,
        ...(previous.message === undefined
          ? {}
          : { message: previous.message }),
      });
      const result = resultFromCommit(await action);
      if (result.status === 'ok') this.#ready(result.snapshot, 'Saved');
      else {
        this.#publish({
          ...previous,
          busy: false,
          operationError: result.message,
          ...(result.status === 'conflict' && result.actual !== undefined
            ? { conflict: result.actual }
            : {}),
        });
      }
      return result;
    });
  }
}

export function recordTopicIds(
  library: ArgumentLibrary,
  kind: 'axiom' | 'counter-argument',
  id: string,
): readonly string[] {
  return library.topics
    .filter((topic) =>
      kind === 'axiom'
        ? topic.axiomIds.includes(id)
        : topic.counterArgumentIds.includes(id),
    )
    .map(({ id: topicId }) => topicId);
}

export function snapshotForTesting(
  library: ArgumentLibrary,
): ArgumentLibrarySnapshot {
  return captureArgumentLibrarySnapshot(library);
}
