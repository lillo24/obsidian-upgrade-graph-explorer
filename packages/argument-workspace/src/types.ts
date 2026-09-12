export const ARGUMENT_LIBRARY_SCHEMA_VERSION = 1 as const;
export const KNOWLEDGE_READER_CONTRACT_VERSION = 1 as const;
export const CONTENT_FINGERPRINT_ALGORITHM =
  'sha256-canonical-json-v1' as const;

export type ArgumentRecordKind = 'topic' | 'axiom' | 'counter-argument';
export type HumanReviewState =
  'draft' | 'pending-review' | 'accepted' | 'reopened' | 'rejected';
export type CounterArgumentOutcome =
  | 'unanswered'
  | 'standing'
  | 'partially-addressed'
  | 'refuted'
  | 'inapplicable-under-stated-scope';
export type SourceReferenceRole = 'target' | 'basis' | 'support';
export type SourceFingerprintScope = 'file' | 'heading' | 'block' | 'span';
export type SourceFreshness =
  'matches-recorded-version' | 'changed' | 'unknown';

export interface ContentFingerprint {
  readonly algorithm: typeof CONTENT_FINGERPRINT_ALGORITHM;
  readonly value: string;
}

export interface SourcePosition {
  readonly line: number;
  readonly column: number;
  readonly offset?: number;
}

export interface SourceSpan {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export interface RecordedSourceVersion {
  readonly sourceVersion?: string;
  readonly contentFingerprint?: ContentFingerprint;
  readonly fingerprintScope: SourceFingerprintScope;
  readonly span?: SourceSpan;
}

export interface TheorySourceReference {
  readonly id: string;
  readonly sourceSpaceHint?: string;
  readonly path: string;
  readonly heading?: string;
  readonly block?: string;
  readonly label: string;
  readonly originalWikilink?: string;
  readonly role: SourceReferenceRole;
  readonly entityIdHint?: string;
  readonly recordedVersion?: RecordedSourceVersion;
}

export interface ArgumentRecordMetadata {
  readonly id: string;
  readonly revision: number;
  readonly reviewState: HumanReviewState;
  readonly archived: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RetrievalMetadata {
  readonly aliases: readonly string[];
  readonly keywords: readonly string[];
  readonly phrases: readonly string[];
}

export interface ArgumentTopic extends ArgumentRecordMetadata {
  readonly title: string;
  readonly summary: string;
  readonly retrieval: RetrievalMetadata;
  readonly axiomIds: readonly string[];
  readonly counterArgumentIds: readonly string[];
}

export interface ArgumentAxiom extends ArgumentRecordMetadata {
  readonly title: string;
  readonly statement: string;
  readonly explanation?: string;
  readonly scope?: string;
  readonly supportingReasoning?: string;
  readonly retrieval: RetrievalMetadata;
  readonly sourceReferences: readonly TheorySourceReference[];
}

export type CounterArgumentTarget =
  | { readonly kind: 'topic-claim'; readonly topicId: string }
  | { readonly kind: 'axiom'; readonly axiomId: string }
  | {
      readonly kind: 'counter-argument';
      readonly counterArgumentId: string;
    };

export interface AnsweringAxiomReference {
  readonly axiomId: string;
  readonly reliedOnRevision: number;
}

export interface CounterArgumentResponse {
  readonly answeringAxioms: readonly AnsweringAxiomReference[];
  readonly explanation: string;
  readonly outcome: CounterArgumentOutcome;
  readonly boundary?: string;
  readonly reopeningCondition?: string;
}

export interface ArgumentCounterArgument extends ArgumentRecordMetadata {
  readonly title: string;
  readonly observation: string;
  readonly challengedClaim: string;
  readonly target?: CounterArgumentTarget;
  readonly retrieval: RetrievalMetadata;
  readonly sourceReferences: readonly TheorySourceReference[];
  readonly response: CounterArgumentResponse;
}

export interface ArgumentLibrary {
  readonly schemaVersion: typeof ARGUMENT_LIBRARY_SCHEMA_VERSION;
  readonly libraryId: string;
  readonly libraryRevision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly topics: readonly ArgumentTopic[];
  readonly axioms: readonly ArgumentAxiom[];
  readonly counterArguments: readonly ArgumentCounterArgument[];
}

export interface SnapshotDescriptor {
  readonly libraryId: string;
  readonly schemaVersion: typeof ARGUMENT_LIBRARY_SCHEMA_VERSION;
  readonly libraryRevision: number;
  readonly contentFingerprint: ContentFingerprint;
}

export interface ArgumentLibrarySnapshot {
  readonly descriptor: SnapshotDescriptor;
  readonly library: ArgumentLibrary;
}

export interface ArgumentLibraryValidationIssue {
  readonly path: string;
  readonly code:
    | 'invalid-type'
    | 'invalid-value'
    | 'unknown-field'
    | 'missing-reference'
    | 'duplicate-id'
    | 'self-reference'
    | 'future-schema';
  readonly message: string;
}

export type ArgumentLibraryValidationResult =
  | {
      readonly valid: true;
      readonly value: ArgumentLibrary;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly ArgumentLibraryValidationIssue[];
    };

export interface ArgumentRuntime {
  readonly createId: (
    kind: 'library' | ArgumentRecordKind | 'source',
  ) => string;
  readonly now: () => string;
}

export interface CreateTopicInput {
  readonly id?: string;
  readonly title: string;
  readonly summary: string;
  readonly retrieval?: Partial<RetrievalMetadata>;
  readonly reviewState?: HumanReviewState;
}

export interface EditTopicInput {
  readonly title?: string;
  readonly summary?: string;
  readonly retrieval?: RetrievalMetadata;
}

export interface CreateAxiomInput {
  readonly id?: string;
  readonly title: string;
  readonly statement: string;
  readonly explanation?: string;
  readonly scope?: string;
  readonly supportingReasoning?: string;
  readonly retrieval?: Partial<RetrievalMetadata>;
  readonly sourceReferences?: readonly TheorySourceReference[];
  readonly reviewState?: HumanReviewState;
}

export interface EditAxiomInput {
  readonly title?: string;
  readonly statement?: string;
  readonly explanation?: string | null;
  readonly scope?: string | null;
  readonly supportingReasoning?: string | null;
  readonly retrieval?: RetrievalMetadata;
  readonly sourceReferences?: readonly TheorySourceReference[];
}

export interface CreateCounterArgumentInput {
  readonly id?: string;
  readonly title: string;
  readonly observation: string;
  readonly challengedClaim: string;
  readonly target?: CounterArgumentTarget;
  readonly retrieval?: Partial<RetrievalMetadata>;
  readonly sourceReferences?: readonly TheorySourceReference[];
  readonly response?: Partial<CounterArgumentResponse>;
  readonly reviewState?: HumanReviewState;
}

export interface EditCounterArgumentInput {
  readonly title?: string;
  readonly observation?: string;
  readonly challengedClaim?: string;
  readonly target?: CounterArgumentTarget | null;
  readonly retrieval?: RetrievalMetadata;
  readonly sourceReferences?: readonly TheorySourceReference[];
}

export interface UpdateCounterArgumentResponseInput {
  readonly explanation?: string;
  readonly outcome?: CounterArgumentOutcome;
  readonly boundary?: string | null;
  readonly reopeningCondition?: string | null;
}

export type TopicMembershipKind = 'axiom' | 'counter-argument';

export interface ReturnedRecordIdentity {
  readonly kind: ArgumentRecordKind;
  readonly id: string;
  readonly revision: number;
}

export interface ConsultationReceipt {
  readonly contractVersion: typeof KNOWLEDGE_READER_CONTRACT_VERSION;
  readonly operation:
    | 'list-index'
    | 'search-index'
    | 'read-argument-bundle'
    | 'read-linked-theory-source';
  readonly normalizedRequest: Readonly<Record<string, unknown>>;
  readonly snapshot: SnapshotDescriptor;
  readonly returnedRecords: readonly ReturnedRecordIdentity[];
  readonly sourceObservations: readonly {
    readonly sourceReferenceId: string;
    readonly sourceVersion?: string;
    readonly contentFingerprint?: ContentFingerprint;
  }[];
  readonly payloadFingerprint: ContentFingerprint;
  readonly completeness: 'complete' | 'incomplete' | 'unavailable';
  readonly omissions: readonly string[];
  readonly warnings: readonly string[];
  readonly observedAt?: string;
}

export interface IndexCandidate {
  readonly kind: ArgumentRecordKind;
  readonly id: string;
  readonly revision: number;
  readonly title: string;
  readonly topicIds: readonly string[];
  readonly score: number;
  readonly matchedFields: readonly string[];
}

export interface IndexPage {
  readonly candidates: readonly IndexCandidate[];
  readonly nextCursor?: string;
  readonly snapshot: SnapshotDescriptor;
  readonly receipt: ConsultationReceipt;
}

export interface ListIndexRequest {
  readonly limit?: number;
  readonly cursor?: string;
  readonly includeArchived?: boolean;
  readonly expectedSnapshot?: SnapshotDescriptor;
}

export interface SearchIndexRequest extends ListIndexRequest {
  readonly query: string;
}

export type SnapshotBoundResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | {
      readonly status: 'snapshot-mismatch';
      readonly expected: SnapshotDescriptor;
      readonly actual: SnapshotDescriptor;
    }
  | {
      readonly status: 'invalid-request';
      readonly issues: readonly string[];
    };

export interface BundleCompleteness {
  readonly status: 'complete';
  readonly libraryContext: 'bounded-closure';
  readonly theorySources: 'not-read';
  readonly warnings: readonly string[];
}

export interface ArgumentBundle {
  readonly selector: {
    readonly kind?: ArgumentRecordKind;
    readonly id: string;
  };
  readonly topics: readonly ArgumentTopic[];
  readonly axioms: readonly (ArgumentAxiom & {
    readonly linkedCounterArgumentIds: readonly string[];
  })[];
  readonly counterArguments: readonly (ArgumentCounterArgument & {
    readonly responseStale: boolean;
    readonly staleAxiomIds: readonly string[];
  })[];
  readonly completeness: BundleCompleteness;
  readonly snapshot: SnapshotDescriptor;
  readonly receipt: ConsultationReceipt;
}

export interface ReadArgumentBundleRequest {
  readonly id: string;
  readonly kind?: ArgumentRecordKind;
  readonly maxRecords?: number;
  readonly maxDepth?: number;
  readonly expectedSnapshot?: SnapshotDescriptor;
}

export type ReadArgumentBundleResult =
  | SnapshotBoundResult<ArgumentBundle>
  | {
      readonly status: 'not-found';
      readonly id: string;
    }
  | {
      readonly status: 'ambiguous-selector';
      readonly id: string;
      readonly kinds: readonly ArgumentRecordKind[];
    }
  | {
      readonly status: 'limit-exceeded';
      readonly snapshot: SnapshotDescriptor;
      readonly requiredRecordIds: readonly string[];
      readonly omissions: readonly string[];
      readonly receipt: ConsultationReceipt;
    };

export interface ResolvedSourceLocation {
  readonly path: string;
  readonly heading?: string;
  readonly block?: string;
  readonly span?: SourceSpan;
}

export interface LinkedTheorySourceReadRequest {
  readonly sourceReferenceId: string;
  readonly expectedSourceVersion?: string;
  readonly requireExactVersion?: boolean;
  readonly maxCharacters?: number;
  readonly expectedSnapshot?: SnapshotDescriptor;
}

export interface LinkedTheorySourceProviderRequest {
  readonly sourceReferenceId: string;
  readonly locator: TheorySourceReference;
  readonly expectedSourceVersion?: string;
  readonly requireExactVersion: boolean;
  readonly maxCharacters: number;
}

export interface LinkedTheorySourceSuccess {
  readonly status: 'ok';
  readonly sourceSpaceId?: string;
  readonly location: ResolvedSourceLocation;
  readonly text: string;
  readonly sourceVersion?: string;
  readonly complete: boolean;
  readonly omissions: readonly string[];
  readonly observedAt: string;
}

export type LinkedTheorySourceProviderResult =
  | LinkedTheorySourceSuccess
  | {
      readonly status:
        | 'source-missing'
        | 'heading-unresolved'
        | 'heading-ambiguous'
        | 'denied'
        | 'wrong-binding'
        | 'version-unavailable'
        | 'unsupported';
      readonly message: string;
    };

export interface LinkedTheorySourceProvider {
  readonly sourceSpaceId?: string;
  read(
    request: LinkedTheorySourceProviderRequest,
  ): Promise<LinkedTheorySourceProviderResult>;
}

export interface LinkedTheorySourcePayload {
  readonly sourceReferenceId: string;
  readonly locator: TheorySourceReference;
  readonly sourceSpaceId?: string;
  readonly location: ResolvedSourceLocation;
  readonly text: string;
  readonly sourceVersion?: string;
  readonly contentFingerprint: ContentFingerprint;
  readonly fingerprintScope: 'returned-excerpt';
  readonly recordedVersion?: RecordedSourceVersion;
  readonly freshness: SourceFreshness;
  readonly complete: boolean;
  readonly omissions: readonly string[];
  readonly observedAt: string;
  readonly snapshot: SnapshotDescriptor;
  readonly receipt: ConsultationReceipt;
}

export type ReadLinkedTheorySourceResult =
  | { readonly status: 'ok'; readonly value: LinkedTheorySourcePayload }
  | {
      readonly status: 'snapshot-mismatch';
      readonly expected: SnapshotDescriptor;
      readonly actual: SnapshotDescriptor;
    }
  | {
      readonly status: 'invalid-request';
      readonly issues: readonly string[];
    }
  | {
      readonly status:
        | 'source-reference-not-found'
        | 'provider-unavailable'
        | 'source-missing'
        | 'heading-unresolved'
        | 'heading-ambiguous'
        | 'denied'
        | 'wrong-binding'
        | 'version-unavailable'
        | 'version-mismatch'
        | 'unsupported'
        | 'provider-error';
      readonly sourceReferenceId: string;
      readonly locator?: TheorySourceReference;
      readonly message: string;
      readonly snapshot: SnapshotDescriptor;
      readonly receipt: ConsultationReceipt;
    };

export type KnowledgeCall =
  | { readonly operation: 'listIndex'; readonly input: ListIndexRequest }
  | { readonly operation: 'searchIndex'; readonly input: SearchIndexRequest }
  | {
      readonly operation: 'readArgumentBundle';
      readonly input: ReadArgumentBundleRequest;
    }
  | {
      readonly operation: 'readLinkedTheorySource';
      readonly input: LinkedTheorySourceReadRequest;
    };

export interface KnowledgeReader {
  readonly snapshot: SnapshotDescriptor;
  listIndex(input?: ListIndexRequest): SnapshotBoundResult<IndexPage>;
  searchIndex(input: SearchIndexRequest): SnapshotBoundResult<IndexPage>;
  readArgumentBundle(
    input: ReadArgumentBundleRequest,
  ): ReadArgumentBundleResult;
  readLinkedTheorySource(
    input: LinkedTheorySourceReadRequest,
  ): Promise<ReadLinkedTheorySourceResult>;
  exportRetainedSnapshot(): string;
}

export type ArgumentLibraryJsonParseResult =
  | { readonly status: 'valid'; readonly value: ArgumentLibrary }
  | {
      readonly status: 'invalid-json' | 'future-schema' | 'invalid-library';
      readonly message: string;
      readonly issues: readonly ArgumentLibraryValidationIssue[];
      readonly preservedSource: string;
    };

export type ArgumentLibraryStoreLoadResult =
  | { readonly status: 'missing' }
  | { readonly status: 'loaded'; readonly snapshot: ArgumentLibrarySnapshot }
  | {
      readonly status: 'corrupt' | 'future-schema' | 'unreadable';
      readonly message: string;
      readonly preservedValue?: string;
    };

export type ArgumentLibraryStoreSaveResult =
  | { readonly status: 'saved'; readonly snapshot: ArgumentLibrarySnapshot }
  | {
      readonly status: 'conflict';
      readonly message: string;
      readonly actual?: SnapshotDescriptor;
    }
  | { readonly status: 'error'; readonly message: string };

export interface ArgumentLibraryStore {
  load(): Promise<ArgumentLibraryStoreLoadResult>;
  save(
    library: ArgumentLibrary,
    expected: SnapshotDescriptor | 'missing',
  ): Promise<ArgumentLibraryStoreSaveResult>;
}

export type ArgumentLibraryCommitResult =
  | { readonly status: 'committed'; readonly snapshot: ArgumentLibrarySnapshot }
  | {
      readonly status: 'conflict' | 'not-loaded' | 'persistence-error';
      readonly message: string;
      readonly actual?: SnapshotDescriptor;
    };

export interface MarkdownExportFile {
  readonly path: string;
  readonly text: string;
}

export interface ArgumentMarkdownExport {
  readonly files: readonly MarkdownExportFile[];
  readonly snapshot: SnapshotDescriptor;
}
