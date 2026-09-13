import {
  DEFAULT_COMPILER_POLICY,
  DEFAULT_REVIEW_LIMITS,
  DEFAULT_REVIEW_TEMPLATES,
  ReviewEngine,
  exportReviewRunJson,
  exportReviewRunMarkdown,
  importReviewRunJson,
  prepareReviewPromptPreview,
  renderAnalysisPrompt,
  type AgentProvider,
  type CompilerPlacementPolicy,
  type CompilerProvider,
  type ReviewClock,
  type ReviewIdGenerator,
  type ReviewModelConfiguration,
  type ReviewRunRecord,
  type ReviewRunRepository,
  type ReviewSource,
  type ReviewStage,
  type ReviewTemplates,
} from '@icarus-graph-explorer/ai-review';
import {
  HistoryReviewRunRepository,
  createReviewPreparationId,
  createUuidReviewIdGenerator,
  type ReviewHistoryDescriptor,
  type ReviewHistoryEntry,
  type ReviewHistoryListResult,
  type ReviewHistoryStore,
  type ReviewPreparationRecord,
  type StoredReviewRun,
  serializeReviewHistoryEntry,
} from '@icarus-graph-explorer/review-workspace';
import {
  type ReviewSourceCapture,
  type ReviewSourceFileDescriptor,
  type ReviewSourcePreparation,
  type ReviewSourceProvider,
  type ReviewSourceSession,
} from '@icarus-graph-explorer/review-source-tauri';
import type { WorkspaceIdentitySession } from '@icarus-graph-explorer/source-provider-tauri';

export interface ReviewWorkspaceBinding {
  readonly identitySession: WorkspaceIdentitySession;
  readonly label: string;
}

export interface ReviewSetupState {
  readonly commitCount: number;
  readonly title: string;
  readonly additionalRequest: string;
  readonly templates: ReviewTemplates;
  readonly compilerPolicy: CompilerPlacementPolicy;
  readonly models?: ReviewModelConfiguration | undefined;
}

export interface ReviewPromptPreviews {
  readonly negative: string;
  readonly positive: string;
}

export interface ReviewImportPreview {
  readonly sourceName: string;
  readonly byteLength: number;
  readonly run: ReviewRunRecord;
  readonly collision: 'none' | 'exact' | 'different';
}

export interface ReviewWorkspaceSnapshot {
  readonly phase: 'opening' | 'ready' | 'error';
  readonly storageDurability: ReviewHistoryStore['durability'];
  readonly storageMessage?: string | undefined;
  readonly workspace?:
    { readonly id: string; readonly label: string } | undefined;
  readonly sourceAvailable: boolean;
  readonly sourceMessage: string;
  readonly setup: ReviewSetupState;
  readonly preparation?: ReviewSourcePreparation | undefined;
  readonly contextFiles: readonly ReviewSourceFileDescriptor[];
  readonly contextQuery: string;
  readonly contextNextCursor?: string | undefined;
  readonly selectedPaths: readonly string[];
  readonly capture?: ReviewSourceCapture | undefined;
  readonly draftSource?: ReviewSource | undefined;
  readonly draftWorkspace?:
    { readonly id: string; readonly label: string } | undefined;
  readonly captureProgress?:
    'starting' | 'capturing' | 'completed' | 'cancelled' | undefined;
  readonly captureBusy: boolean;
  readonly promptPreviews?: ReviewPromptPreviews | undefined;
  readonly history: ReviewHistoryListResult;
  readonly selectedEntry?: ReviewHistoryEntry | undefined;
  readonly selectedDescriptor?: ReviewHistoryDescriptor | undefined;
  readonly activeRunId?: string | undefined;
  readonly run?: ReviewRunRecord | undefined;
  readonly modelAvailable: boolean;
  readonly modelProvider?: string | undefined;
  readonly modelMessage: string;
  readonly compilerAvailable: boolean;
  readonly notice?: string | undefined;
  readonly error?: string | undefined;
  readonly saveState: 'idle' | 'saving' | 'saved' | 'failed';
  readonly importPreview?: ReviewImportPreview | undefined;
}

export interface ReviewAgentProviderAvailability {
  readonly supported: boolean;
  readonly ready: boolean;
  readonly provider: string;
  readonly message: string;
  readonly defaultModel: string;
}

export interface AiReviewControllerDependencies {
  readonly sourceProvider: ReviewSourceProvider;
  readonly historyStore: ReviewHistoryStore;
  readonly runRepository?: ReviewRunRepository;
  readonly agentProvider?: AgentProvider;
  readonly agentProviderAvailability?: () => Promise<ReviewAgentProviderAvailability>;
  readonly agentProviderAvailabilitySubscribe?: (
    listener: () => void,
  ) => () => void;
  readonly defaultModels?: ReviewModelConfiguration;
  readonly compilerProvider?: CompilerProvider;
  readonly clock?: ReviewClock;
  readonly ids?: ReviewIdGenerator;
  readonly preparationId?: () => string;
}

const EMPTY_HISTORY: ReviewHistoryListResult = {
  status: 'loaded',
  summaries: [],
  issues: [],
};

function systemClock(): ReviewClock {
  return {
    now: () => new Date(),
    setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
  };
}

function timestamp(clock: ReviewClock): string {
  return clock.now().toISOString();
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cloneTemplates(): ReviewTemplates {
  return structuredClone(DEFAULT_REVIEW_TEMPLATES);
}

function defaultSetup(models?: ReviewModelConfiguration): ReviewSetupState {
  return {
    commitCount: 1,
    title: '',
    additionalRequest: '',
    templates: cloneTemplates(),
    compilerPolicy: { ...DEFAULT_COMPILER_POLICY },
    ...(models === undefined ? {} : { models: structuredClone(models) }),
  };
}

function interruptedState(state: ReviewRunRecord['state']): boolean {
  return ['queued', 'running', 'cancel-requested'].includes(state);
}

export class AiReviewController {
  readonly #listeners = new Set<() => void>();
  readonly #sourceProvider: ReviewSourceProvider;
  readonly #historyStore: ReviewHistoryStore;
  readonly #clock: ReviewClock;
  readonly #preparationId: () => string;
  readonly #engine?: ReviewEngine;
  readonly #agentProviderAvailability:
    (() => Promise<ReviewAgentProviderAvailability>) | undefined;
  readonly #agentProviderAvailabilitySubscribe:
    ((listener: () => void) => () => void) | undefined;
  readonly #defaultModels: ReviewModelConfiguration | undefined;
  #sourceSession: ReviewSourceSession | undefined;
  #workspaceBinding: ReviewWorkspaceBinding | undefined;
  #sourceGeneration = 0;
  #contextGeneration = 0;
  #captureAbort: AbortController | undefined;
  #disposed = false;
  #lifecycleGeneration = 0;
  #agentProviderAvailabilityUnsubscribe: (() => void) | undefined;
  #state: ReviewWorkspaceSnapshot;

  public constructor(dependencies: AiReviewControllerDependencies) {
    this.#sourceProvider = dependencies.sourceProvider;
    this.#historyStore = dependencies.historyStore;
    this.#clock = dependencies.clock ?? systemClock();
    this.#preparationId =
      dependencies.preparationId ?? (() => createReviewPreparationId());
    this.#agentProviderAvailability = dependencies.agentProviderAvailability;
    this.#agentProviderAvailabilitySubscribe =
      dependencies.agentProviderAvailabilitySubscribe;
    this.#defaultModels = dependencies.defaultModels;
    const injectedProvider =
      dependencies.agentProvider !== undefined &&
      dependencies.agentProviderAvailability === undefined;
    this.#state = {
      phase: 'opening',
      storageDurability: dependencies.historyStore.durability,
      sourceAvailable: false,
      sourceMessage:
        'Open a durably identified local vault to capture Git history.',
      setup: defaultSetup(dependencies.defaultModels),
      contextFiles: [],
      contextQuery: '',
      selectedPaths: [],
      captureBusy: false,
      history: EMPTY_HISTORY,
      modelAvailable: injectedProvider,
      ...(injectedProvider && dependencies.defaultModels !== undefined
        ? { modelProvider: dependencies.defaultModels.analysis.provider }
        : {}),
      modelMessage:
        dependencies.agentProvider === undefined
          ? 'Live analysis is not connected. Preparation and imported-result reading remain available.'
          : injectedProvider
            ? 'Injected live analysis provider is ready.'
            : 'Checking the OpenAI provider…',
      compilerAvailable: dependencies.compilerProvider !== undefined,
      saveState: 'idle',
    };

    if (dependencies.agentProvider !== undefined) {
      const runMetadata = new Map<
        string,
        { readonly title: string; readonly workspaceLabel: string }
      >();
      const durableRepository =
        dependencies.runRepository ??
        new HistoryReviewRunRepository(dependencies.historyStore, (run) => {
          const retained = runMetadata.get(run.id);
          if (retained !== undefined) return retained;
          const metadata = {
            title:
              this.#state.setup.title.trim() ||
              run.frozenInput.additionalRequest.trim() ||
              'AI Review',
            workspaceLabel:
              this.#state.draftWorkspace?.label ??
              this.#state.workspace?.label ??
              run.frozenInput.workspaceId,
          };
          runMetadata.set(run.id, metadata);
          return metadata;
        });
      const observableRepository: ReviewRunRepository = {
        save: async (run) => {
          await durableRepository.save(run);
          if (this.#state.activeRunId === run.id) {
            this.#set({ run, saveState: 'saved' });
          }
        },
        load: (id) => durableRepository.load(id),
        list: () => durableRepository.list(),
      };
      this.#engine = new ReviewEngine({
        provider: dependencies.agentProvider,
        repository: observableRepository,
        ...(dependencies.compilerProvider === undefined
          ? {}
          : { compilerProvider: dependencies.compilerProvider }),
        clock: this.#clock,
        ids: dependencies.ids ?? createUuidReviewIdGenerator(),
      });
    }
  }

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  public readonly snapshot = (): ReviewWorkspaceSnapshot => this.#state;

  #set(patch: Partial<ReviewWorkspaceSnapshot>): void {
    if (this.#disposed) return;
    this.#state = { ...this.#state, ...patch };
    this.#listeners.forEach((listener) => listener());
  }

  public async open(): Promise<void> {
    this.#disposed = false;
    const lifecycleGeneration = ++this.#lifecycleGeneration;
    try {
      const [history, availability] = await Promise.all([
        this.#historyStore.list(),
        this.#agentProviderAvailability?.().catch((error: unknown) => ({
          supported: false,
          ready: false,
          provider: '',
          defaultModel: '',
          message: `OpenAI provider initialization failed: ${message(error)}`,
        })),
      ]);
      if (lifecycleGeneration !== this.#lifecycleGeneration) return;
      this.#set({
        phase: history.status === 'loaded' ? 'ready' : 'error',
        history,
        ...(availability === undefined
          ? {}
          : {
              modelAvailable: availability.ready,
              modelProvider: availability.provider || undefined,
              modelMessage: availability.message,
            }),
        ...(history.message === undefined
          ? {}
          : { storageMessage: history.message }),
      });
      this.#agentProviderAvailabilityUnsubscribe?.();
      this.#agentProviderAvailabilityUnsubscribe =
        this.#agentProviderAvailabilitySubscribe?.(() => {
          void this.#refreshAgentProviderAvailability();
        });
    } catch (error) {
      if (lifecycleGeneration !== this.#lifecycleGeneration) return;
      this.#set({
        phase: 'error',
        error: `Review history could not be opened: ${message(error)}`,
      });
    }
  }

  async #refreshAgentProviderAvailability(): Promise<
    ReviewAgentProviderAvailability | undefined
  > {
    if (this.#agentProviderAvailability === undefined) return undefined;
    try {
      const availability = await this.#agentProviderAvailability();
      if (!this.#disposed) {
        this.#set({
          modelAvailable: availability.ready,
          modelProvider: availability.provider || undefined,
          modelMessage: availability.message,
        });
      }
      return availability;
    } catch (error) {
      const availability = {
        supported: false,
        ready: false,
        provider: '',
        defaultModel: '',
        message: `OpenAI provider initialization failed: ${message(error)}`,
      } satisfies ReviewAgentProviderAvailability;
      if (!this.#disposed) {
        this.#set({
          modelAvailable: false,
          modelProvider: undefined,
          modelMessage: availability.message,
        });
      }
      return availability;
    }
  }

  public setWorkspace(binding: ReviewWorkspaceBinding | undefined): void {
    if (
      binding?.identitySession.workspaceId ===
      this.#workspaceBinding?.identitySession.workspaceId
    ) {
      return;
    }
    this.#sourceGeneration += 1;
    this.#contextGeneration += 1;
    this.#captureAbort?.abort('Workspace changed');
    this.#captureAbort = undefined;
    const previous = this.#sourceSession;
    this.#sourceSession = undefined;
    if (previous !== undefined) void previous.dispose().catch(() => undefined);
    this.#workspaceBinding = binding;
    const runtimeSupported = this.#sourceProvider.isSupported();
    const retainedSource =
      this.#state.selectedEntry?.kind === 'preparation'
        ? this.#state.selectedEntry.preparation.source
        : this.#state.selectedEntry?.kind === 'run'
          ? this.#state.selectedEntry.run.frozenInput.source
          : undefined;
    const retainedWorkspace =
      this.#state.selectedEntry?.kind === 'preparation'
        ? this.#state.selectedEntry.preparation.workspace
        : this.#state.selectedEntry?.kind === 'run'
          ? {
              id: this.#state.selectedEntry.run.frozenInput.workspaceId,
              label: this.#state.selectedEntry.workspaceLabel,
            }
          : undefined;
    this.#set({
      ...(binding === undefined
        ? { workspace: undefined }
        : {
            workspace: {
              id: binding.identitySession.workspaceId,
              label: binding.label,
            },
          }),
      sourceAvailable: binding !== undefined && runtimeSupported,
      sourceMessage:
        binding === undefined
          ? 'Open a durably identified local vault to capture Git history.'
          : runtimeSupported
            ? 'Ready to prepare committed Git history from this authorized vault.'
            : 'Native Git capture is unavailable in browser/report-only mode. Imported reviews remain readable.',
      preparation: undefined,
      contextFiles: [],
      contextQuery: '',
      contextNextCursor: undefined,
      selectedPaths: [],
      capture: undefined,
      draftSource: retainedSource,
      draftWorkspace: retainedWorkspace,
      promptPreviews: undefined,
      captureBusy: false,
      captureProgress: undefined,
      notice: undefined,
      error: undefined,
      saveState: 'idle',
    });
  }

  public updateSetup(
    patch: Partial<Omit<ReviewSetupState, 'commitCount'>>,
  ): void {
    this.#set({
      setup: { ...this.#state.setup, ...patch },
      promptPreviews: undefined,
      saveState:
        this.#state.selectedEntry?.kind === 'preparation'
          ? 'idle'
          : this.#state.saveState,
    });
  }

  public refreshPromptPreviews(): void {
    const promptPreviews = this.#renderPreviews(
      this.#state.draftSource,
      this.#state.setup,
    );
    if (promptPreviews !== undefined) {
      this.#set({
        promptPreviews,
        notice:
          'Prompt previews rendered from the retained source and current templates.',
      });
    }
  }

  public setCommitCount(commitCount: number): void {
    if (
      !Number.isInteger(commitCount) ||
      commitCount < 1 ||
      commitCount > 10 ||
      commitCount === this.#state.setup.commitCount
    ) {
      return;
    }
    this.#sourceGeneration += 1;
    this.#contextGeneration += 1;
    this.#captureAbort?.abort('Commit range changed');
    this.#set({
      setup: { ...this.#state.setup, commitCount },
      preparation: undefined,
      contextFiles: [],
      contextQuery: '',
      contextNextCursor: undefined,
      selectedPaths: [],
      capture: undefined,
      draftSource: undefined,
      draftWorkspace: undefined,
      promptPreviews: undefined,
      captureBusy: false,
      captureProgress: undefined,
      notice: 'Commit count changed. Prepare the new range explicitly.',
      error: undefined,
      saveState: 'idle',
    });
  }

  async #session(): Promise<ReviewSourceSession> {
    if (this.#workspaceBinding === undefined) {
      throw new Error('No durably identified local vault is authorized.');
    }
    if (!this.#sourceProvider.isSupported()) {
      throw new Error('Native Git capture is unavailable in this runtime.');
    }
    this.#sourceSession ??= await this.#sourceProvider.openAuthorizedSession(
      this.#workspaceBinding.identitySession,
    );
    return this.#sourceSession;
  }

  public async prepareHistory(): Promise<void> {
    const generation = ++this.#sourceGeneration;
    this.#contextGeneration += 1;
    this.#captureAbort?.abort('Preparing a new range');
    this.#set({
      preparation: undefined,
      contextFiles: [],
      contextQuery: '',
      contextNextCursor: undefined,
      selectedPaths: [],
      capture: undefined,
      promptPreviews: undefined,
      captureBusy: true,
      captureProgress: 'starting',
      notice: 'Preparing committed first-parent history…',
      error: undefined,
    });
    try {
      const binding = this.#workspaceBinding;
      if (binding === undefined || !this.#sourceProvider.isSupported()) {
        throw new Error(
          binding === undefined
            ? 'No durably identified local vault is authorized.'
            : 'Native Git capture is unavailable in this runtime.',
        );
      }
      const priorSession = this.#sourceSession;
      this.#sourceSession = undefined;
      await priorSession?.dispose();
      const session = await this.#sourceProvider.openAuthorizedSession(
        binding.identitySession,
      );
      if (generation !== this.#sourceGeneration) {
        await session.dispose();
        return;
      }
      this.#sourceSession = session;
      const preparation = await session.prepareLastCommits(
        this.#state.setup.commitCount,
      );
      if (generation !== this.#sourceGeneration) return;
      this.#set({
        preparation,
        captureBusy: false,
        captureProgress: undefined,
        sourceMessage: `Pinned ${preparation.commits.length} commit${preparation.commits.length === 1 ? '' : 's'} at ${preparation.headCommitId}.`,
        notice:
          'Range prepared. Select eligible files, then capture exact material.',
      });
    } catch (error) {
      if (generation !== this.#sourceGeneration) return;
      this.#set({
        captureBusy: false,
        captureProgress: undefined,
        error: `Could not prepare Git history: ${message(error)}`,
      });
    }
  }

  public async searchContext(query: string, loadMore = false): Promise<void> {
    const preparation = this.#state.preparation;
    if (preparation === undefined) return;
    const generation = ++this.#contextGeneration;
    const sourceGeneration = this.#sourceGeneration;
    const cursor = loadMore ? this.#state.contextNextCursor : undefined;
    this.#set({
      contextQuery: query,
      ...(loadMore ? {} : { contextFiles: [], contextNextCursor: undefined }),
      notice: 'Loading context files…',
      error: undefined,
    });
    try {
      const page = await (
        await this.#session()
      ).listAdditionalFiles(preparation.preparationId, {
        query,
        limit: 50,
        ...(cursor === undefined ? {} : { cursor }),
      });
      if (
        generation !== this.#contextGeneration ||
        sourceGeneration !== this.#sourceGeneration ||
        page.preparationId !== this.#state.preparation?.preparationId
      ) {
        return;
      }
      this.#set({
        contextFiles: loadMore
          ? [...this.#state.contextFiles, ...page.files]
          : page.files,
        ...(page.nextCursor === undefined
          ? { contextNextCursor: undefined }
          : { contextNextCursor: page.nextCursor }),
        notice: `Showing ${page.files.length} context file${page.files.length === 1 ? '' : 's'} from the pinned tree.`,
      });
    } catch (error) {
      if (generation !== this.#contextGeneration) return;
      this.#set({ error: `Could not list context files: ${message(error)}` });
    }
  }

  public setPathSelected(path: string, selected: boolean): void {
    const candidates = [
      ...(this.#state.preparation?.changedFiles ?? []),
      ...this.#state.contextFiles,
    ];
    const descriptor = candidates.find((file) => file.path === path);
    if (descriptor?.eligible !== true) return;
    const selection = new Set(this.#state.selectedPaths);
    if (selected) selection.add(path);
    else selection.delete(path);
    const limit = this.#sourceSession?.descriptor.limits.maxSelectedFiles ?? 32;
    if (selection.size > limit) {
      this.#set({
        error: `Select at most ${limit} files. Nothing was silently omitted.`,
      });
      return;
    }
    this.#set({
      selectedPaths: [...selection],
      capture: undefined,
      promptPreviews: undefined,
      saveState: 'idle',
      error: undefined,
    });
  }

  public selectEligibleChangedFiles(): void {
    const preparation = this.#state.preparation;
    if (preparation === undefined) return;
    const paths = preparation.changedFiles
      .filter(({ eligible }) => eligible)
      .map(({ path }) => path);
    const limit = this.#sourceSession?.descriptor.limits.maxSelectedFiles ?? 32;
    if (paths.length > limit) {
      this.#set({
        error: `${paths.length} changed files are eligible but the capture limit is ${limit}. Select files individually; none were silently omitted.`,
      });
      return;
    }
    this.#set({
      selectedPaths: paths,
      capture: undefined,
      promptPreviews: undefined,
      notice: `Selected ${paths.length} eligible changed file${paths.length === 1 ? '' : 's'}.`,
      error: undefined,
      saveState: 'idle',
    });
  }

  public async captureSelectedFiles(): Promise<void> {
    const preparation = this.#state.preparation;
    if (preparation === undefined || this.#state.selectedPaths.length === 0) {
      this.#set({
        error: 'Prepare a range and select at least 1 eligible file.',
      });
      return;
    }
    const sourceGeneration = this.#sourceGeneration;
    this.#captureAbort?.abort('New capture requested');
    const abort = new AbortController();
    this.#captureAbort = abort;
    this.#set({
      captureBusy: true,
      captureProgress: 'starting',
      notice: 'Starting bounded source capture…',
      error: undefined,
    });
    try {
      const capture = await (
        await this.#session()
      ).capture(preparation.preparationId, this.#state.selectedPaths, {
        signal: abort.signal,
        onProgress: (captureProgress) => {
          if (
            this.#captureAbort === abort &&
            sourceGeneration === this.#sourceGeneration
          ) {
            this.#set({ captureProgress });
          }
        },
      });
      if (
        this.#captureAbort !== abort ||
        sourceGeneration !== this.#sourceGeneration ||
        capture.native.preparationId !== this.#state.preparation?.preparationId
      ) {
        return;
      }
      this.#set({
        capture,
        draftSource: capture.source,
        draftWorkspace: this.#state.workspace,
        captureBusy: false,
        captureProgress: 'completed',
        promptPreviews: this.#renderPreviews(
          capture.source,
          this.#state.setup,
          this.#state.workspace,
        ),
        notice: `Captured ${new Intl.NumberFormat().format(capture.native.manifest.capturedByteCount)} bytes from ${capture.native.selectedPaths.length} selected path${capture.native.selectedPaths.length === 1 ? '' : 's'}.`,
        saveState: 'idle',
      });
    } catch (error) {
      if (this.#captureAbort !== abort) return;
      this.#set({
        captureBusy: false,
        captureProgress: abort.signal.aborted ? 'cancelled' : undefined,
        error: `${abort.signal.aborted ? 'Capture cancelled' : 'Capture failed'}: ${message(error)}`,
      });
    }
  }

  public cancelCapture(): void {
    this.#captureAbort?.abort('Cancelled by user');
  }

  #renderPreviews(
    source: ReviewSource | undefined,
    setup: ReviewSetupState,
    workspace = this.#state.draftWorkspace ?? this.#state.workspace,
  ): ReviewPromptPreviews | undefined {
    if (source === undefined || workspace === undefined) return undefined;
    try {
      const preview = prepareReviewPromptPreview({
        workspaceId: workspace.id,
        source,
        additionalRequest: setup.additionalRequest,
        templates: setup.templates,
        limits: DEFAULT_REVIEW_LIMITS,
        compiler: setup.compilerPolicy,
      });
      const compilerAvailable =
        this.#state.compilerAvailable && setup.compilerPolicy.analysis;
      return {
        negative: renderAnalysisPrompt({
          stage: 'negative',
          frozenInput: preview.frozenInput,
          templates: preview.templates,
          compilerAvailable,
        }).text,
        positive: renderAnalysisPrompt({
          stage: 'positive',
          frozenInput: preview.frozenInput,
          templates: preview.templates,
          compilerAvailable,
        }).text,
      };
    } catch (error) {
      this.#set({ error: `Prompt preview is invalid: ${message(error)}` });
      return undefined;
    }
  }

  public async savePreparation(): Promise<void> {
    const source = this.#state.draftSource;
    const workspace = this.#state.draftWorkspace;
    if (source === undefined || workspace === undefined) {
      this.#set({
        error: 'Capture exact source material before saving a preparation.',
      });
      return;
    }
    this.#set({
      saveState: 'saving',
      error: undefined,
      notice: 'Saving preparation…',
    });
    try {
      const preview = prepareReviewPromptPreview({
        workspaceId: workspace.id,
        source,
        additionalRequest: this.#state.setup.additionalRequest,
        templates: this.#state.setup.templates,
        limits: DEFAULT_REVIEW_LIMITS,
        compiler: this.#state.setup.compilerPolicy,
      });
      const selected = this.#state.selectedEntry;
      const prior =
        selected?.kind === 'preparation' ? selected.preparation : undefined;
      const now = timestamp(this.#clock);
      const preparation: ReviewPreparationRecord = {
        schemaVersion: 1,
        id: prior?.id ?? this.#preparationId(),
        revision: (prior?.revision ?? 0) + 1,
        createdAt: prior?.createdAt ?? now,
        updatedAt: now,
        title:
          this.#state.setup.title.trim() ||
          (source.mode === 'captured-git-history'
            ? `Review ${source.headCommitId.slice(0, 8)}`
            : 'Prepared AI Review'),
        workspace,
        source,
        additionalRequest: this.#state.setup.additionalRequest,
        templates: preview.templates,
        limits: preview.limits,
        compilerPolicy: preview.compilerPolicy,
        ...(this.#state.setup.models === undefined
          ? {}
          : { models: this.#state.setup.models }),
        origin: {
          kind:
            prior?.origin.kind ??
            (this.#state.capture === undefined
              ? 'duplicated-run'
              : 'captured-local-git'),
          capturedAt: now,
          ...(prior?.origin.importedAt === undefined
            ? {}
            : { importedAt: prior.origin.importedAt }),
        },
      };
      const entry: ReviewHistoryEntry = {
        schemaVersion: 1,
        kind: 'preparation',
        preparation,
      };
      const expected =
        prior === undefined || this.#state.selectedDescriptor === undefined
          ? 'missing'
          : this.#state.selectedDescriptor;
      const result = await this.#historyStore.save(entry, expected);
      if (result.status !== 'saved') throw new Error(result.message);
      this.#set({
        selectedEntry: entry,
        selectedDescriptor: result.descriptor,
        saveState: 'saved',
        notice: `Prepared review revision ${preparation.revision} saved ${this.#historyStore.durability === 'desktop-app-local' ? 'in app-local history' : 'for this browser session only'}.`,
      });
      await this.refreshHistory();
    } catch (error) {
      this.#set({
        saveState: 'failed',
        error: `Preparation was not saved: ${message(error)} The in-session capture remains available for export.`,
      });
    }
  }

  public async refreshHistory(): Promise<void> {
    const history = await this.#historyStore.list();
    this.#set({ history });
  }

  public async openHistory(id: string): Promise<void> {
    try {
      const loaded = await this.#historyStore.load(id);
      if (loaded.status !== 'loaded') {
        throw new Error(
          loaded.status === 'missing'
            ? `Review record ${id} is missing.`
            : loaded.message,
        );
      }
      let entry = loaded.entry;
      let descriptor = loaded.descriptor;
      if (entry.kind === 'run' && interruptedState(entry.run.state)) {
        const importedAt = timestamp(this.#clock);
        const interrupted = importReviewRunJson(
          exportReviewRunJson(entry.run),
          importedAt,
        );
        const recovered: StoredReviewRun = { ...entry, run: interrupted };
        const saved = await this.#historyStore.save(recovered, descriptor);
        if (saved.status !== 'saved') throw new Error(saved.message);
        entry = recovered;
        descriptor = saved.descriptor;
        await this.refreshHistory();
      }
      const preparation =
        entry.kind === 'preparation' ? entry.preparation : undefined;
      this.#set({
        selectedEntry: entry,
        selectedDescriptor: descriptor,
        run: entry.kind === 'run' ? entry.run : undefined,
        ...(preparation === undefined
          ? {}
          : {
              setup: {
                commitCount:
                  preparation.source.mode === 'captured-git-history'
                    ? preparation.source.commitCount
                    : 1,
                title: preparation.title,
                additionalRequest: preparation.additionalRequest,
                templates: preparation.templates,
                compilerPolicy: preparation.compilerPolicy,
                ...(preparation.models === undefined
                  ? {}
                  : { models: preparation.models }),
              },
              draftSource: preparation.source,
              draftWorkspace: preparation.workspace,
              promptPreviews: (() => {
                const preview = prepareReviewPromptPreview({
                  workspaceId: preparation.workspace.id,
                  source: preparation.source,
                  additionalRequest: preparation.additionalRequest,
                  templates: preparation.templates,
                  limits: preparation.limits,
                  compiler: preparation.compilerPolicy,
                });
                return {
                  negative: renderAnalysisPrompt({
                    stage: 'negative',
                    frozenInput: preview.frozenInput,
                    templates: preview.templates,
                    compilerAvailable:
                      this.#state.compilerAvailable &&
                      preparation.compilerPolicy.analysis,
                  }).text,
                  positive: renderAnalysisPrompt({
                    stage: 'positive',
                    frozenInput: preview.frozenInput,
                    templates: preview.templates,
                    compilerAvailable:
                      this.#state.compilerAvailable &&
                      preparation.compilerPolicy.analysis,
                  }).text,
                };
              })(),
            }),
        notice: `Opened ${entry.kind === 'run' ? 'run' : 'prepared review'} from history without reading the current vault.`,
        error: undefined,
        saveState: 'saved',
      });
    } catch (error) {
      this.#set({ error: `Could not open review history: ${message(error)}` });
    }
  }

  public async previewRunImport(
    sourceName: string,
    source: string,
  ): Promise<void> {
    try {
      const byteLength = new TextEncoder().encode(source).byteLength;
      if (byteLength > 5 * 1024 * 1024) {
        throw new Error('Import exceeds the 5 MiB review-record limit.');
      }
      const run = importReviewRunJson(source, timestamp(this.#clock));
      const existing = await this.#historyStore.load(run.id);
      let collision: ReviewImportPreview['collision'] = 'none';
      if (existing.status === 'loaded') {
        collision =
          existing.entry.kind === 'run' &&
          exportReviewRunJson(existing.entry.run) === exportReviewRunJson(run)
            ? 'exact'
            : 'different';
      } else if (existing.status !== 'missing') {
        throw new Error(existing.message);
      }
      this.#set({
        importPreview: { sourceName, byteLength, run, collision },
        notice:
          collision === 'exact'
            ? 'This exact run is already present; accepting is idempotent.'
            : collision === 'different'
              ? 'A different record uses this run ID. Import cannot overwrite it.'
              : 'Validated import preview. No model or vault read was started.',
        error: undefined,
      });
    } catch (error) {
      this.#set({
        error: `Review import rejected: ${message(error)}`,
        importPreview: undefined,
      });
    }
  }

  public dismissImportPreview(): void {
    this.#set({ importPreview: undefined });
  }

  public async acceptRunImport(): Promise<void> {
    const preview = this.#state.importPreview;
    if (preview === undefined || preview.collision === 'different') return;
    if (preview.collision === 'exact') {
      this.#set({
        importPreview: undefined,
        notice: 'Exact run already retained; no duplicate was written.',
      });
      await this.openHistory(preview.run.id);
      return;
    }
    const importedAt = timestamp(this.#clock);
    const entry: StoredReviewRun = {
      schemaVersion: 1,
      kind: 'run',
      title:
        preview.run.frozenInput.additionalRequest.trim() ||
        'Imported AI Review',
      workspaceLabel: preview.run.frozenInput.workspaceId,
      origin: 'imported',
      importedAt,
      run: preview.run,
    };
    const result = await this.#historyStore.save(entry, 'missing');
    if (result.status !== 'saved') {
      this.#set({ error: `Import was not saved: ${result.message}` });
      return;
    }
    this.#set({
      importPreview: undefined,
      selectedEntry: entry,
      selectedDescriptor: result.descriptor,
      run: entry.run,
      saveState: 'saved',
      notice: 'Imported run retained without rebinding its workspace identity.',
    });
    await this.refreshHistory();
  }

  public async startRun(): Promise<void> {
    const currentAvailability = await this.#refreshAgentProviderAvailability();
    if (currentAvailability?.ready === false) {
      this.#set({ error: currentAvailability.message });
      return;
    }
    const source = this.#state.draftSource;
    const workspace = this.#state.draftWorkspace;
    const models = this.#state.setup.models;
    const conflictingRun =
      this.#state.run !== undefined && interruptedState(this.#state.run.state);
    const configuredModels = models === undefined ? [] : Object.values(models);
    const modelConfigurationValid =
      configuredModels.length === 3 &&
      configuredModels.every(
        ({ provider, model }) =>
          provider.trim() !== '' &&
          model.trim() !== '' &&
          (this.#state.modelProvider === undefined ||
            provider === this.#state.modelProvider),
      );
    if (
      this.#engine === undefined ||
      source === undefined ||
      workspace === undefined ||
      models === undefined ||
      !this.#state.modelAvailable ||
      !modelConfigurationValid ||
      conflictingRun
    ) {
      this.#set({
        error:
          this.#engine === undefined
            ? this.#state.modelMessage
            : !this.#state.modelAvailable
              ? this.#state.modelMessage
              : models === undefined
                ? 'Configure injected provider model settings before running.'
                : !modelConfigurationValid
                  ? 'Use a non-empty model from the connected provider for every review stage.'
                  : conflictingRun
                    ? 'Wait for the active review run to finish or cancel it before starting another.'
                    : 'Capture source material before running.',
      });
      return;
    }
    this.#set({
      saveState: 'saving',
      error: undefined,
      notice: 'Starting independent Negative and Positive analyses…',
    });
    try {
      const handle = await this.#engine.start({
        workspaceId: workspace.id,
        source,
        additionalRequest: this.#state.setup.additionalRequest,
        templates: this.#state.setup.templates,
        models,
        limits: DEFAULT_REVIEW_LIMITS,
        compiler: this.#state.setup.compilerPolicy,
      });
      this.#set({
        activeRunId: handle.runId,
        run: await this.#engine.get(handle.runId),
      });
      void handle.completion
        .then(async (run) => {
          if (this.#state.activeRunId !== handle.runId) return;
          this.#set({
            run,
            saveState: 'saved',
            notice: `Review run finished with state ${run.state}.`,
          });
          await this.refreshHistory();
        })
        .catch((error: unknown) => {
          this.#set({
            saveState: 'failed',
            error: `Review run failed: ${message(error)}`,
          });
        });
    } catch (error) {
      this.#set({
        saveState: 'failed',
        error: `Review run could not start: ${message(error)}`,
      });
    }
  }

  public async cancelRun(): Promise<void> {
    if (this.#engine === undefined || this.#state.activeRunId === undefined)
      return;
    try {
      this.#set({ notice: 'Cancellation requested…' });
      const run = await this.#engine.cancel(
        this.#state.activeRunId,
        'Cancelled by user',
      );
      this.#set({
        run,
        notice:
          'Cancellation was requested. Attempt records show whether remote termination was confirmed.',
      });
    } catch (error) {
      this.#set({ error: `Run cancellation failed: ${message(error)}` });
    }
  }

  public async retryStage(stage: ReviewStage): Promise<void> {
    if (this.#engine === undefined || this.#state.activeRunId === undefined)
      return;
    try {
      const run = await this.#engine.retry(this.#state.activeRunId, stage);
      this.#set({
        run,
        notice: `${stage} retry started; superseded attempts remain in history.`,
      });
    } catch (error) {
      this.#set({ error: `Could not retry ${stage}: ${message(error)}` });
    }
  }

  public async deleteSelected(): Promise<void> {
    const entry = this.#state.selectedEntry;
    const descriptor = this.#state.selectedDescriptor;
    if (entry === undefined || descriptor === undefined) return;
    if (
      entry.kind === 'run' &&
      this.#state.activeRunId === entry.run.id &&
      !['completed', 'failed', 'cancelled', 'interrupted', 'blocked'].includes(
        entry.run.state,
      )
    ) {
      this.#set({
        error: 'Cancel and settle the active run before deleting it.',
      });
      return;
    }
    const result = await this.#historyStore.delete(descriptor.id, descriptor);
    if (result.status === 'conflict' || result.status === 'error') {
      this.#set({ error: `Review was not removed: ${result.message}` });
      return;
    }
    this.#set({
      selectedEntry: undefined,
      selectedDescriptor: undefined,
      run: undefined,
      notice: 'Review history item removed.',
    });
    await this.refreshHistory();
  }

  public exportPreparation(): string | undefined {
    const selected = this.#state.selectedEntry;
    const source =
      selected?.kind === 'preparation'
        ? selected.preparation.source
        : this.#state.draftSource;
    const title =
      selected?.kind === 'preparation'
        ? selected.preparation.title
        : this.#state.setup.title || 'Prepared AI Review';
    const prompts = this.#state.promptPreviews;
    if (source === undefined || prompts === undefined) return undefined;
    return [
      '# PREPARED AI REVIEW — NOT AI CONCLUSIONS',
      '',
      `- Title: ${title}`,
      `- Workspace identity: ${selected?.kind === 'preparation' ? selected.preparation.workspace.id : (this.#state.draftWorkspace?.id ?? 'unavailable')}`,
      `- Source mode: ${source.mode}`,
      `- Completeness: ${source.completeness} for ${source.selectedPaths.length} explicitly selected paths`,
      '',
      '## Captured source and patches',
      '',
      ...source.materials.flatMap((material) => [
        `### ${material.kind}: ${material.relativePath}`,
        '',
        `Material ID: \`${material.id}\``,
        '',
        '```text',
        material.content,
        '```',
        '',
      ]),
      '## Negative prompt',
      '',
      prompts.negative,
      '',
      '## Positive prompt',
      '',
      prompts.positive,
      '',
      '> This export contains full captured source. It is prepared material, not an AI conclusion, and was not uploaded by this feature.',
      '',
    ].join('\n');
  }

  public exportSelectedPreparationJson(): string | undefined {
    const selected = this.#state.selectedEntry;
    return selected?.kind === 'preparation'
      ? serializeReviewHistoryEntry(selected)
      : undefined;
  }

  public exportSelectedRun(format: 'json' | 'markdown'): string | undefined {
    const run = this.#state.run;
    if (run === undefined) return undefined;
    return format === 'json'
      ? exportReviewRunJson(run)
      : exportReviewRunMarkdown(run);
  }

  public newReview(): void {
    this.#set({
      setup: defaultSetup(this.#defaultModels),
      preparation: undefined,
      contextFiles: [],
      contextQuery: '',
      contextNextCursor: undefined,
      selectedPaths: [],
      capture: undefined,
      draftSource: undefined,
      draftWorkspace: undefined,
      promptPreviews: undefined,
      selectedEntry: undefined,
      selectedDescriptor: undefined,
      run: undefined,
      notice: 'New review setup. Prepare a committed range explicitly.',
      error: undefined,
      saveState: 'idle',
    });
  }

  public duplicateRunAsPreparation(): void {
    const run = this.#state.run;
    if (run === undefined) return;
    const setup: ReviewSetupState = {
      commitCount:
        run.frozenInput.source.mode === 'captured-git-history'
          ? run.frozenInput.source.commitCount
          : 1,
      title: `${
        this.#state.selectedEntry?.kind === 'run'
          ? this.#state.selectedEntry.title
          : 'AI Review'
      } copy`,
      additionalRequest: run.frozenInput.additionalRequest,
      templates: run.templates,
      compilerPolicy: run.compilerPolicy,
      models: run.models,
    };
    const draftWorkspace = {
      id: run.frozenInput.workspaceId,
      label:
        this.#state.selectedEntry?.kind === 'run'
          ? this.#state.selectedEntry.workspaceLabel
          : run.frozenInput.workspaceId,
    };
    this.#set({
      setup,
      draftSource: run.frozenInput.source,
      draftWorkspace,
      promptPreviews: this.#renderPreviews(
        run.frozenInput.source,
        setup,
        draftWorkspace,
      ),
      selectedEntry: undefined,
      selectedDescriptor: undefined,
      run: undefined,
      saveState: 'idle',
      notice:
        'Duplicated immutable run input as a new unsaved preparation. No provider call was made.',
    });
  }

  public async dispose(): Promise<void> {
    this.#disposed = true;
    this.#lifecycleGeneration += 1;
    this.#sourceGeneration += 1;
    this.#captureAbort?.abort('Application disposed');
    this.#agentProviderAvailabilityUnsubscribe?.();
    this.#agentProviderAvailabilityUnsubscribe = undefined;
    const sourceSession = this.#sourceSession;
    this.#sourceSession = undefined;
    this.#listeners.clear();
    await sourceSession?.dispose();
  }
}
