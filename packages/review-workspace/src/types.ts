import type {
  CompilerPlacementPolicy,
  ReviewModelConfiguration,
  ReviewResourceLimits,
  ReviewRunRecord,
  ReviewSource,
  ReviewTemplates,
} from '@icarus-graph-explorer/ai-review';

export const REVIEW_PREPARATION_SCHEMA_VERSION = 1 as const;
export const REVIEW_HISTORY_ENVELOPE_SCHEMA_VERSION = 1 as const;
export const MAX_REVIEW_HISTORY_RECORD_BYTES = 5 * 1024 * 1024;
export const MAX_REVIEW_HISTORY_ITEMS = 500;

export interface ReviewPreparationRecord {
  readonly schemaVersion: typeof REVIEW_PREPARATION_SCHEMA_VERSION;
  readonly id: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly title: string;
  readonly workspace: {
    readonly id: string;
    readonly label: string;
  };
  readonly source: ReviewSource;
  readonly additionalRequest: string;
  readonly templates: ReviewTemplates;
  readonly limits: ReviewResourceLimits;
  readonly compilerPolicy: CompilerPlacementPolicy;
  readonly models?: ReviewModelConfiguration;
  readonly origin: {
    readonly kind: 'captured-local-git' | 'duplicated-run' | 'imported';
    readonly capturedAt: string;
    readonly importedAt?: string;
  };
}

export interface StoredReviewPreparation {
  readonly schemaVersion: typeof REVIEW_HISTORY_ENVELOPE_SCHEMA_VERSION;
  readonly kind: 'preparation';
  readonly preparation: ReviewPreparationRecord;
}

export interface StoredReviewRun {
  readonly schemaVersion: typeof REVIEW_HISTORY_ENVELOPE_SCHEMA_VERSION;
  readonly kind: 'run';
  readonly title: string;
  readonly workspaceLabel: string;
  readonly origin: 'local-engine' | 'imported';
  readonly importedAt?: string;
  readonly run: ReviewRunRecord;
}

export type ReviewHistoryEntry = StoredReviewPreparation | StoredReviewRun;

export interface ReviewHistoryDescriptor {
  readonly id: string;
  readonly fingerprint: string;
}

export interface ReviewHistorySummary extends ReviewHistoryDescriptor {
  readonly kind: ReviewHistoryEntry['kind'];
  readonly title: string;
  readonly workspaceId: string;
  readonly workspaceLabel: string;
  readonly state: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly byteLength: number;
  readonly origin: string;
}

export type ReviewHistoryLoadResult =
  | { readonly status: 'missing' }
  | {
      readonly status: 'loaded';
      readonly entry: ReviewHistoryEntry;
      readonly descriptor: ReviewHistoryDescriptor;
    }
  | {
      readonly status: 'corrupt' | 'future-schema' | 'unreadable';
      readonly message: string;
      readonly preservedValue?: string;
    };

export interface ReviewHistoryListResult {
  readonly status: 'loaded' | 'unreadable';
  readonly summaries: readonly ReviewHistorySummary[];
  readonly issues: ReadonlyArray<{
    readonly id: string;
    readonly status: 'corrupt' | 'future-schema' | 'unreadable';
    readonly message: string;
  }>;
  readonly message?: string;
}

export type ReviewHistoryWriteResult =
  | {
      readonly status: 'saved';
      readonly descriptor: ReviewHistoryDescriptor;
      readonly summary: ReviewHistorySummary;
    }
  | {
      readonly status: 'conflict' | 'error';
      readonly message: string;
      readonly actual?: ReviewHistoryDescriptor;
    };

export type ReviewHistoryDeleteResult =
  | { readonly status: 'deleted' | 'missing' }
  | { readonly status: 'conflict' | 'error'; readonly message: string };

export interface ReviewHistoryStore {
  readonly durability: 'desktop-app-local' | 'browser-session-only';
  list(): Promise<ReviewHistoryListResult>;
  load(id: string): Promise<ReviewHistoryLoadResult>;
  save(
    entry: ReviewHistoryEntry,
    expected: ReviewHistoryDescriptor | 'missing',
  ): Promise<ReviewHistoryWriteResult>;
  delete(
    id: string,
    expected: ReviewHistoryDescriptor,
  ): Promise<ReviewHistoryDeleteResult>;
}
