import { clonePlainData, deepFreeze } from '@icarus-graph-explorer/ai-review';

import {
  MAX_REVIEW_HISTORY_ITEMS,
  type ReviewHistoryDescriptor,
  type ReviewHistoryEntry,
  type ReviewHistoryStore,
} from './types';
import {
  captureReviewHistoryDescriptor,
  reviewHistoryEntryId,
  sameReviewHistoryDescriptor,
  summarizeReviewHistoryEntry,
  validateReviewHistoryEntry,
} from './validation';

export class MemoryReviewHistoryStore implements ReviewHistoryStore {
  public readonly durability = 'browser-session-only' as const;
  readonly #entries = new Map<string, ReviewHistoryEntry>();

  public async list() {
    await Promise.resolve();
    return {
      status: 'loaded' as const,
      summaries: [...this.#entries.values()]
        .map(summarizeReviewHistoryEntry)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      issues: [],
    };
  }

  public async load(id: string) {
    await Promise.resolve();
    const entry = this.#entries.get(id);
    return entry === undefined
      ? ({ status: 'missing' } as const)
      : ({
          status: 'loaded' as const,
          entry: deepFreeze(clonePlainData(entry)),
          descriptor: captureReviewHistoryDescriptor(entry),
        } as const);
  }

  public async save(
    entry: ReviewHistoryEntry,
    expected: ReviewHistoryDescriptor | 'missing',
  ) {
    await Promise.resolve();
    const validated = validateReviewHistoryEntry(entry);
    const id = reviewHistoryEntryId(validated);
    const current = this.#entries.get(id);
    const currentDescriptor =
      current === undefined
        ? undefined
        : captureReviewHistoryDescriptor(current);
    if (
      (expected === 'missing' && current !== undefined) ||
      (expected !== 'missing' &&
        (currentDescriptor === undefined ||
          !sameReviewHistoryDescriptor(currentDescriptor, expected)))
    ) {
      return {
        status: 'conflict' as const,
        message: `Review record ${id} changed after it was read.`,
        ...(currentDescriptor === undefined
          ? {}
          : { actual: currentDescriptor }),
      };
    }
    if (
      current === undefined &&
      this.#entries.size >= MAX_REVIEW_HISTORY_ITEMS
    ) {
      return {
        status: 'error' as const,
        message: `Review history has reached its ${MAX_REVIEW_HISTORY_ITEMS}-item limit; no record was evicted.`,
      };
    }
    this.#entries.set(id, validated);
    return {
      status: 'saved' as const,
      descriptor: captureReviewHistoryDescriptor(validated),
      summary: summarizeReviewHistoryEntry(validated),
    };
  }

  public async delete(id: string, expected: ReviewHistoryDescriptor) {
    await Promise.resolve();
    const current = this.#entries.get(id);
    if (current === undefined) return { status: 'missing' as const };
    if (
      !sameReviewHistoryDescriptor(
        captureReviewHistoryDescriptor(current),
        expected,
      )
    ) {
      return {
        status: 'conflict' as const,
        message: `Review record ${id} changed after it was read.`,
      };
    }
    this.#entries.delete(id);
    return { status: 'deleted' as const };
  }
}
