import type { ResolvedFolderSpatialRules } from '@icarus-graph-explorer/spatial-overrides';

import type {
  GlobalLayoutPosition,
  GlobalRendererInput,
  GlobalRendererInstrumentation,
  GlobalSpatialInfluenceRequest,
  GlobalSpatialInfluenceResult,
  GlobalSpatialInfluenceService,
  GlobalSpatialInfluenceServiceFactory,
} from './types';

export const GLOBAL_SPATIAL_PULL_PREVIEW_ITERATIONS = 12;

export interface GlobalSpatialPullPreviewInput {
  readonly request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>;
  readonly basePositions: readonly GlobalLayoutPosition[];
  readonly input: GlobalRendererInput;
  readonly resolvedRules: ResolvedFolderSpatialRules;
}

export interface GlobalSpatialPullPreviewAdoption {
  readonly revision: number;
  readonly input: GlobalSpatialPullPreviewInput;
  readonly result: GlobalSpatialInfluenceResult;
}

export interface GlobalSpatialPullPreviewFrameScheduler {
  readonly request: (callback: (timestamp: number) => void) => number;
  readonly cancel: (handle: number) => void;
}

interface PreviewEntry {
  readonly revision: number;
  readonly scheduledAt: number;
  readonly input: GlobalSpatialPullPreviewInput;
}

export interface GlobalSpatialPullPreviewControllerOptions {
  readonly createService: GlobalSpatialInfluenceServiceFactory;
  readonly onAdopt: (
    adoption: GlobalSpatialPullPreviewAdoption,
  ) => Promise<void> | void;
  readonly onError: (message: string) => void;
  readonly instrumentation?: GlobalRendererInstrumentation;
  readonly frameScheduler?: GlobalSpatialPullPreviewFrameScheduler;
  readonly now?: () => number;
}

const browserFrameScheduler: GlobalSpatialPullPreviewFrameScheduler = {
  request: (callback) =>
    (
      globalThis as typeof globalThis & {
        readonly requestAnimationFrame: (
          callback: (timestamp: number) => void,
        ) => number;
      }
    ).requestAnimationFrame(callback),
  cancel: (handle) =>
    (
      globalThis as typeof globalThis & {
        readonly cancelAnimationFrame: (handle: number) => void;
      }
    ).cancelAnimationFrame(handle),
};

/**
 * Bounded draft-only Pull scheduler. Raw draft updates collapse at an animation
 * frame, then at most one active request and one newest pending request exist.
 * Reset disposes only this controller's preview worker, never the authoritative
 * spatial-influence service.
 */
export class GlobalSpatialPullPreviewController {
  private readonly options: GlobalSpatialPullPreviewControllerOptions;
  private readonly frameScheduler: GlobalSpatialPullPreviewFrameScheduler;
  private readonly now: () => number;
  private service: GlobalSpatialInfluenceService | undefined;
  private desired: PreviewEntry | undefined;
  private pending: PreviewEntry | undefined;
  private active:
    { readonly entry: PreviewEntry; readonly generation: number } | undefined;
  private frameHandle: number | undefined;
  private generation = 0;
  private sequence = 0;
  private adoptedRevision = 0;
  private disposed = false;

  constructor(options: GlobalSpatialPullPreviewControllerOptions) {
    this.options = options;
    this.frameScheduler = options.frameScheduler ?? browserFrameScheduler;
    this.now = options.now ?? (() => performance.now());
  }

  get hasWork(): boolean {
    return (
      this.desired !== undefined ||
      this.pending !== undefined ||
      this.active !== undefined
    );
  }

  schedule(input: GlobalSpatialPullPreviewInput): number {
    if (this.disposed) {
      throw new Error('The spatial Pull preview controller is disposed.');
    }
    const entry: PreviewEntry = {
      revision: ++this.sequence,
      scheduledAt: this.now(),
      input,
    };
    if (this.desired !== undefined) {
      this.recordSuperseded();
    }
    this.desired = entry;
    this.options.instrumentation?.count('spatial-pull-preview-schedules');
    this.options.instrumentation?.record('spatial-pull-preview-schedule', 0);
    if (this.frameHandle === undefined) {
      this.frameHandle = this.frameScheduler.request(() => {
        this.frameHandle = undefined;
        this.flushDesired();
      });
    }
    return entry.revision;
  }

  reset(): void {
    if (this.disposed) return;
    this.generation += 1;
    if (this.frameHandle !== undefined) {
      this.frameScheduler.cancel(this.frameHandle);
      this.frameHandle = undefined;
    }
    this.desired = undefined;
    this.pending = undefined;
    this.active = undefined;
    this.adoptedRevision = 0;
    this.service?.dispose();
    this.service = undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
  }

  private flushDesired(): void {
    const entry = this.desired;
    this.desired = undefined;
    if (entry === undefined || this.disposed) return;
    if (this.active !== undefined) {
      if (this.pending !== undefined) this.recordSuperseded();
      this.pending = entry;
      return;
    }
    this.start(entry);
  }

  private start(entry: PreviewEntry): void {
    if (this.disposed) return;
    const generation = this.generation;
    const active = { entry, generation };
    this.active = active;
    this.options.instrumentation?.count('spatial-pull-preview-requests');
    this.options.instrumentation?.record('spatial-pull-preview-request', 0);
    let request: Promise<GlobalSpatialInfluenceResult>;
    try {
      this.service ??= this.options.createService();
      request = this.service.layout(entry.input.request);
    } catch (error: unknown) {
      request = Promise.reject(error);
    }
    void request
      .then(async (result) => {
        if (!this.isCurrent(active)) return;
        this.options.instrumentation?.record(
          'spatial-pull-preview-worker',
          result.computeMs,
        );
        if (entry.revision <= this.adoptedRevision) return;
        const adoptStarted = this.now();
        await this.options.onAdopt({
          revision: entry.revision,
          input: entry.input,
          result,
        });
        if (!this.isCurrent(active)) return;
        this.adoptedRevision = entry.revision;
        this.options.instrumentation?.count('spatial-pull-preview-adopts');
        this.options.instrumentation?.record(
          'spatial-pull-preview-adopt',
          this.now() - adoptStarted,
        );
        this.options.instrumentation?.record(
          'spatial-pull-preview-end-to-end',
          this.now() - entry.scheduledAt,
        );
      })
      .catch((error: unknown) => {
        if (!this.isCurrent(active)) return;
        this.options.onError(
          error instanceof Error ? error.message : String(error),
        );
      })
      .finally(() => {
        if (!this.isCurrent(active)) return;
        this.active = undefined;
        let next = this.pending;
        this.pending = undefined;
        if (
          this.desired !== undefined &&
          (next === undefined || this.desired.revision > next.revision)
        ) {
          if (next !== undefined) this.recordSuperseded();
          next = this.desired;
          this.desired = undefined;
          if (this.frameHandle !== undefined) {
            this.frameScheduler.cancel(this.frameHandle);
            this.frameHandle = undefined;
          }
        }
        if (next !== undefined) this.start(next);
      });
  }

  private isCurrent(active: {
    readonly entry: PreviewEntry;
    readonly generation: number;
  }): boolean {
    return (
      !this.disposed &&
      this.active === active &&
      this.generation === active.generation
    );
  }

  private recordSuperseded(): void {
    this.options.instrumentation?.count('spatial-pull-preview-superseded');
    this.options.instrumentation?.record('spatial-pull-preview-superseded', 0);
  }
}
