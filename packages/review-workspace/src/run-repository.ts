import type {
  ReviewRunRecord,
  ReviewRunRepository,
} from '@icarus-graph-explorer/ai-review';

import type {
  ReviewHistoryDescriptor,
  ReviewHistoryStore,
  StoredReviewRun,
} from './types';
import { validateReviewHistoryEntry } from './validation';

export interface ReviewRunHistoryMetadata {
  readonly title: string;
  readonly workspaceLabel: string;
}

/** Serializes engine snapshots and surfaces every durable write failure. */
export class HistoryReviewRunRepository implements ReviewRunRepository {
  readonly #descriptors = new Map<string, ReviewHistoryDescriptor>();
  readonly #queues = new Map<string, Promise<void>>();

  public constructor(
    private readonly store: ReviewHistoryStore,
    private readonly metadata: (
      run: ReviewRunRecord,
    ) => ReviewRunHistoryMetadata,
  ) {}

  public async save(run: ReviewRunRecord): Promise<void> {
    const snapshot = validateReviewHistoryEntry({
      schemaVersion: 1,
      kind: 'run',
      origin: 'local-engine',
      ...this.metadata(run),
      run,
    }) as StoredReviewRun;
    const preceding = this.#queues.get(run.id) ?? Promise.resolve();
    const queued = preceding
      .catch(() => undefined)
      .then(async () => {
        const expected: ReviewHistoryDescriptor | 'missing' =
          this.#descriptors.get(run.id) ?? 'missing';
        if (expected === 'missing') {
          const existing = await this.store.load(run.id);
          if (existing.status === 'loaded') {
            throw new Error(
              `Review run ID ${run.id} already exists; a new engine run cannot overwrite it.`,
            );
          } else if (existing.status !== 'missing') {
            throw new Error(existing.message);
          }
        }
        const result = await this.store.save(snapshot, expected);
        if (result.status !== 'saved') throw new Error(result.message);
        this.#descriptors.set(run.id, result.descriptor);
      });
    this.#queues.set(run.id, queued);
    try {
      await queued;
    } finally {
      if (this.#queues.get(run.id) === queued) this.#queues.delete(run.id);
    }
  }

  public async load(runId: string): Promise<ReviewRunRecord | undefined> {
    await this.#queues.get(runId);
    const loaded = await this.store.load(runId);
    if (loaded.status === 'missing') return undefined;
    if (loaded.status !== 'loaded') throw new Error(loaded.message);
    if (loaded.entry.kind !== 'run') return undefined;
    this.#descriptors.set(runId, loaded.descriptor);
    return loaded.entry.run;
  }

  public async list(): Promise<ReviewRunRecord[]> {
    const listed = await this.store.list();
    if (listed.status === 'unreadable') {
      throw new Error(listed.message ?? 'Review history could not be listed.');
    }
    const runs: ReviewRunRecord[] = [];
    for (const summary of listed.summaries) {
      if (summary.kind !== 'run') continue;
      const loaded = await this.store.load(summary.id);
      if (loaded.status === 'loaded' && loaded.entry.kind === 'run') {
        this.#descriptors.set(summary.id, loaded.descriptor);
        runs.push(loaded.entry.run);
      }
    }
    return runs;
  }
}
