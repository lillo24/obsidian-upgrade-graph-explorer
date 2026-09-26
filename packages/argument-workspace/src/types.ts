export const ARGUMENT_LIBRARY_SCHEMA_VERSION = 9 as const;
export const KNOWLEDGE_READER_CONTRACT_VERSION = 5 as const;
export const CONTENT_FINGERPRINT_ALGORITHM =
  'sha256-canonical-json-v1' as const;

export type ArgumentRecordKind =
  'topic' | 'context' | 'axiom' | 'argument' | 'counter-argument';
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

export interface RecordTheorySourceVersionInput {
  readonly recordKind: 'axiom' | 'argument' | 'counter-argument';
  readonly recordId: string;
  readonly sourceReferenceId: string;
  readonly sourceSpaceId: string;
  /** Namespaced content identity for the complete captured source document. */
  readonly sourceVersion: string;
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

export interface ArgumentExample {
  readonly id: string;
  readonly text: string;
}

export interface ArgumentPremiseExampleProvenance {
  readonly exampleIds?: readonly string[];
}

export interface TextArgumentPremise extends ArgumentPremiseExampleProvenance {
  readonly id: string;
  readonly kind: 'text';
  readonly text: string;
}

export interface AxiomArgumentPremise extends ArgumentPremiseExampleProvenance {
  readonly id: string;
  readonly kind: 'axiom';
  readonly axiomId: string;
  readonly reliedOnRevision: number;
}

export interface ArgumentConclusionPremise extends ArgumentPremiseExampleProvenance {
  readonly id: string;
  readonly kind: 'argument-conclusion';
  readonly argumentId: string;
  readonly reliedOnRevision: number;
}

export interface ArgumentPremiseReference extends ArgumentPremiseExampleProvenance {
  readonly id: string;
  readonly kind: 'argument-premise';
  readonly argumentId: string;
  readonly premiseId: string;
  readonly reliedOnRevision: number;
}

export type ArgumentPremise =
  | TextArgumentPremise
  | AxiomArgumentPremise
  | ArgumentConclusionPremise
  | ArgumentPremiseReference;

export type ArgumentDependencyPathStep =
  | {
      readonly argumentId: string;
      readonly premiseId: string;
      readonly kind: 'axiom';
      readonly axiomId: string;
    }
  | {
      readonly argumentId: string;
      readonly premiseId: string;
      readonly kind: 'argument-conclusion';
      readonly sourceArgumentId: string;
    }
  | {
      readonly argumentId: string;
      readonly premiseId: string;
      readonly kind: 'argument-premise';
      readonly sourceArgumentId: string;
      readonly sourcePremiseId: string;
    };

export type ArgumentDependencyRootCause =
  | {
      readonly kind: 'revision-mismatch';
      readonly recordKind: 'axiom' | 'argument';
      readonly recordId: string;
      readonly reliedOnRevision: number;
      readonly currentRevision: number;
    }
  | {
      readonly kind: 'missing-reference';
      readonly recordKind: 'axiom' | 'argument' | 'premise';
      readonly recordId: string;
    }
  | {
      readonly kind: 'dependency-cycle';
      readonly argumentId: string;
      readonly premiseId: string;
    };

export interface ArgumentPremiseStalenessCause {
  readonly kind: 'direct' | 'inherited';
  readonly root: ArgumentDependencyRootCause;
  readonly path: readonly ArgumentDependencyPathStep[];
}

export interface ArgumentPremiseStaleness {
  readonly premiseId: string;
  readonly stale: boolean;
  readonly direct: boolean;
  readonly inherited: boolean;
  readonly causes: readonly ArgumentPremiseStalenessCause[];
}

export interface ArgumentStalenessResult {
  readonly stale: boolean;
  readonly premiseIds: readonly string[];
  readonly relationIds: readonly string[];
  readonly premiseStaleness: readonly ArgumentPremiseStaleness[];
}

export interface ArgumentTopic extends ArgumentRecordMetadata {
  readonly title: string;
  readonly summary: string;
  readonly retrieval: RetrievalMetadata;
  readonly axiomIds: readonly string[];
  readonly argumentIds: readonly string[];
  readonly currentArgumentId?: string;
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

/**
 * Human-curated background that can be attached to Arguments without becoming
 * an inference premise. Parent Contexts contribute only their effective axioms;
 * descriptive metadata is never inherited.
 */
export interface ArgumentContext extends ArgumentRecordMetadata {
  readonly title: string;
  readonly description?: string;
  readonly retrieval: RetrievalMetadata;
  readonly axiomIds: readonly string[];
  readonly parentContextId?: string;
}

export type ArgumentTargetPart =
  | { readonly kind: 'argument' }
  | { readonly kind: 'premise'; readonly premiseId: string }
  | { readonly kind: 'reasoning' }
  | { readonly kind: 'conclusion' };

export type ArgumentRelationKind = 'attack' | 'support';

export interface ArgumentRelation {
  readonly id: string;
  readonly kind: ArgumentRelationKind;
  readonly targetArgumentId: string;
  readonly targetPart: ArgumentTargetPart;
  readonly reliedOnRevision: number;
}

export type ProposalStatus = 'pending' | 'discarded' | 'stored';

/** Review intent only; canonical attack/support/supersession remains a human choice. */
export type ArgumentProposalIntent =
  | 'unspecified'
  | 'new'
  | 'attack'
  | 'support'
  | 'refine'
  | 'extend'
  | 'add-boundary'
  | 'supersede';

export interface ArgumentProposalTarget {
  readonly argumentId: string;
  readonly part: ArgumentTargetPart;
  readonly reliedOnRevision: number;
}

export type ProposalConsultedRecordKind =
  'topic' | 'axiom' | 'argument' | 'counter-argument';

export interface ProposalConsultedRecord {
  readonly kind: ProposalConsultedRecordKind;
  readonly id: string;
  readonly revision?: number;
}

export interface ArgumentProposalConsultation {
  readonly libraryId: string;
  readonly libraryRevision: number;
  readonly contentFingerprint?: ContentFingerprint;
  readonly records: readonly ProposalConsultedRecord[];
}

export interface ArgumentProposalResultingRecord {
  readonly kind: 'argument' | 'counter-argument';
  readonly id: string;
}

export interface ArgumentProposalResolutionReceipt {
  readonly id: string;
  readonly planFingerprint: ContentFingerprint;
  readonly proposalRevisions: readonly {
    readonly proposalId: string;
    readonly revision: number;
  }[];
  readonly resultingRecords: readonly ArgumentProposalResultingRecord[];
}

export interface ArgumentProposalDecision {
  readonly decidedAt: string;
  readonly note?: string;
  readonly resultingRecords: readonly ArgumentProposalResultingRecord[];
  readonly resolutionReceipt?: ArgumentProposalResolutionReceipt;
}

export type ArgumentProposalPremise = ArgumentPremise;

export type ArgumentProposalReasoningReference =
  | { readonly kind: 'premise'; readonly premiseId: string }
  | { readonly kind: 'reasoning-step'; readonly stepId: string };

export interface ArgumentProposalReasoningStep {
  readonly id: string;
  readonly text: string;
  readonly uses: readonly ArgumentProposalReasoningReference[];
}

/** Drafting provenance that never becomes a canonical premise implicitly. */
export interface ArgumentProposalSourceObservation {
  readonly id: string;
  readonly observation: string;
  readonly label?: string;
  readonly repository?: string;
  readonly url?: string;
  readonly commitSha?: string;
  readonly sourceVersion?: string;
  readonly filePath?: string;
  readonly heading?: string;
  readonly span?: string;
}

/** Non-canonical intent between two Proposal revisions in the staging area. */
export type ArgumentProposalDraftRelationKind =
  'attack' | 'support' | 'refine' | 'extend' | 'supersede' | 'related';

export interface ArgumentProposalDraftRelation {
  readonly id: string;
  readonly kind: ArgumentProposalDraftRelationKind;
  readonly targetProposalId: string;
  readonly targetProposalRevision: number;
}

/** The mutable, non-canonical content of one Proposal revision. */
export interface ArgumentProposalDraft {
  readonly title: string;
  /** Optional non-canonical Markdown written only for human review. */
  readonly softExplanationMarkdown?: string;
  readonly intent: ArgumentProposalIntent;
  readonly topicId?: string;
  readonly target?: ArgumentProposalTarget;
  readonly examples: readonly string[];
  readonly premises: readonly ArgumentProposalPremise[];
  readonly reasoning?: string;
  readonly reasoningSteps: readonly ArgumentProposalReasoningStep[];
  readonly conclusion: string;
  readonly boundary?: string;
  readonly sourceObservations: readonly ArgumentProposalSourceObservation[];
  readonly whyNovelOrUnresolved: string;
  readonly consultation: ArgumentProposalConsultation;
  readonly draftRelations: readonly ArgumentProposalDraftRelation[];
}

/** Recoverable prior content retained when an active Proposal is revised. */
export interface ArgumentProposalRevision {
  readonly revision: number;
  readonly replacedAt: string;
  readonly revisionReason: string;
  readonly content: ArgumentProposalDraft;
}

/**
 * Non-canonical AI-authored candidate retained in the same durable snapshot.
 * Only human resolution may link it to a canonical Argument or Counter-Argument.
 */
export interface ArgumentProposal extends ArgumentProposalDraft {
  readonly id: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: ProposalStatus;
  readonly revisionHistory: readonly ArgumentProposalRevision[];
  readonly clientSubmissionId?: string;
  readonly submissionFingerprint: ContentFingerprint;
  readonly decision?: ArgumentProposalDecision;
}

export interface Argument extends ArgumentRecordMetadata {
  readonly title: string;
  readonly examples: readonly ArgumentExample[];
  readonly premises: readonly ArgumentPremise[];
  readonly reasoning?: string;
  readonly conclusion: string;
  readonly boundary?: string;
  readonly relations: readonly ArgumentRelation[];
  readonly contextIds: readonly string[];
  readonly retrieval: RetrievalMetadata;
  readonly sourceReferences: readonly TheorySourceReference[];
  readonly supersedesArgumentId?: string;
}

export type CounterArgumentTarget =
  | { readonly kind: 'topic-claim'; readonly topicId: string }
  | { readonly kind: 'axiom'; readonly axiomId: string }
  | {
      readonly kind: 'counter-argument';
      readonly counterArgumentId: string;
    }
  | {
      readonly kind: 'argument';
      readonly argumentId: string;
      readonly part: ArgumentTargetPart;
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
  readonly contexts: readonly ArgumentContext[];
  readonly axioms: readonly ArgumentAxiom[];
  readonly arguments: readonly Argument[];
  readonly counterArguments: readonly ArgumentCounterArgument[];
  readonly proposals: readonly ArgumentProposal[];
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
    | 'dependency-cycle'
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
    kind:
      | 'library'
      | ArgumentRecordKind
      | 'source'
      | 'example'
      | 'premise'
      | 'relation'
      | 'proposal',
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

export interface CreateContextInput {
  readonly id?: string;
  readonly title: string;
  readonly description?: string;
  readonly retrieval?: Partial<RetrievalMetadata>;
  readonly axiomIds?: readonly string[];
  readonly parentContextId?: string;
  readonly reviewState?: HumanReviewState;
}

export interface EditContextInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly retrieval?: RetrievalMetadata;
  readonly axiomIds?: readonly string[];
  readonly parentContextId?: string | null;
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

export interface CreateArgumentInput {
  readonly id?: string;
  readonly title: string;
  readonly examples?: readonly ArgumentExample[];
  readonly premises: readonly ArgumentPremise[];
  readonly reasoning?: string;
  readonly conclusion: string;
  readonly boundary?: string;
  readonly relations?: readonly ArgumentRelation[];
  readonly contextIds?: readonly string[];
  readonly retrieval?: Partial<RetrievalMetadata>;
  readonly sourceReferences?: readonly TheorySourceReference[];
  readonly supersedesArgumentId?: string;
  readonly reviewState?: HumanReviewState;
}

export interface EditArgumentInput {
  readonly title?: string;
  readonly examples?: readonly ArgumentExample[];
  readonly premises?: readonly ArgumentPremise[];
  readonly reasoning?: string | null;
  readonly conclusion?: string;
  readonly boundary?: string | null;
  readonly relations?: readonly ArgumentRelation[];
  readonly contextIds?: readonly string[];
  readonly retrieval?: RetrievalMetadata;
  readonly sourceReferences?: readonly TheorySourceReference[];
  readonly supersedesArgumentId?: string | null;
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

export interface CreateArgumentProposalInput {
  readonly clientSubmissionId?: string;
  readonly title: string;
  /** Optional non-canonical Markdown written only for human review. */
  readonly softExplanationMarkdown?: string;
  readonly intent?: ArgumentProposalIntent;
  readonly topicId?: string;
  readonly target?: ArgumentProposalTarget;
  readonly examples: readonly string[];
  readonly premises?: readonly ArgumentProposalPremise[];
  /** Transitional input only; normalized immediately into text premises. */
  readonly premiseHints?: readonly string[];
  /** Transitional input only; normalized immediately into Axiom premises. */
  readonly suggestedAxiomIds?: readonly string[];
  readonly reasoning?: string;
  readonly reasoningSteps?: readonly ArgumentProposalReasoningStep[];
  readonly conclusion: string;
  readonly boundary?: string;
  readonly sourceObservations?: readonly ArgumentProposalSourceObservation[];
  readonly draftRelations?: readonly ArgumentProposalDraftRelation[];
  readonly whyNovelOrUnresolved: string;
  readonly consultation: ArgumentProposalConsultation;
}

export interface ReviseArgumentProposalInput {
  readonly proposalId: string;
  readonly expectedRevision: number;
  readonly revisionReason: string;
  readonly title: string;
  /** Optional non-canonical Markdown written only for human review. */
  readonly softExplanationMarkdown?: string;
  readonly intent?: ArgumentProposalIntent;
  readonly topicId?: string;
  readonly target?: ArgumentProposalTarget;
  readonly examples: readonly string[];
  readonly premises: readonly ArgumentProposalPremise[];
  readonly reasoning?: string;
  readonly reasoningSteps?: readonly ArgumentProposalReasoningStep[];
  readonly conclusion: string;
  readonly boundary?: string;
  readonly sourceObservations?: readonly ArgumentProposalSourceObservation[];
  readonly draftRelations?: readonly ArgumentProposalDraftRelation[];
  readonly whyNovelOrUnresolved: string;
  readonly consultation: ArgumentProposalConsultation;
}

export interface DiscardArgumentProposalInput {
  readonly proposalId: string;
  readonly expectedRevision: number;
  readonly note?: string;
}

export interface ResolveProposalAsArgumentInput {
  readonly proposalId: string;
  readonly argument: CreateArgumentInput & { readonly id: string };
  readonly topicIds: readonly string[];
  readonly promoteTopicId?: string;
  readonly note?: string;
}

export interface ResolveProposalAsRejectedInput {
  readonly proposalId: string;
  readonly counterArgument: CreateCounterArgumentInput & {
    readonly id: string;
  };
  readonly topicIds: readonly string[];
  readonly note?: string;
}

export type TopicMembershipKind = 'axiom' | 'argument' | 'counter-argument';

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
  readonly contexts: readonly (ArgumentContext & {
    readonly parentContextIds: readonly string[];
    readonly inheritedAxiomIds: readonly string[];
    readonly effectiveAxiomIds: readonly string[];
  })[];
  readonly axioms: readonly (ArgumentAxiom & {
    readonly linkedCounterArgumentIds: readonly string[];
  })[];
  readonly arguments: readonly (Argument & {
    readonly argumentStale: boolean;
    readonly stalePremiseIds: readonly string[];
    readonly staleRelationIds: readonly string[];
    readonly premiseStaleness: readonly ArgumentPremiseStaleness[];
    readonly topicIds: readonly string[];
    readonly currentTopicIds: readonly string[];
    readonly supersededByArgumentIds: readonly string[];
    readonly targetingCounterArgumentIds: readonly string[];
    readonly incomingRelationIds: readonly string[];
    /** Resolved background only; these records are not premises. */
    readonly resolvedContexts: readonly {
      readonly contextId: string;
      readonly parentContextIds: readonly string[];
      readonly directAxiomIds: readonly string[];
      readonly effectiveAxiomIds: readonly string[];
    }[];
    readonly backgroundAxioms: readonly {
      readonly axiomId: string;
      readonly revision: number;
      readonly title: string;
      readonly archived: boolean;
      readonly viaContextIds: readonly string[];
    }[];
    readonly resolvedPremises: readonly {
      readonly premiseId: string;
      readonly kind: ArgumentPremise['kind'];
      readonly referencedRecord?: {
        readonly kind: 'axiom' | 'argument';
        readonly id: string;
        readonly revision: number;
        readonly title: string;
        readonly archived: boolean;
      };
      readonly referencedPremise?: ArgumentPremise;
    }[];
    readonly resolvedRelations: readonly {
      readonly relationId: string;
      readonly kind: ArgumentRelationKind;
      readonly stale: boolean;
      readonly targetArgument: {
        readonly id: string;
        readonly revision: number;
        readonly title: string;
        readonly archived: boolean;
      };
      readonly targetPart: ArgumentTargetPart;
    }[];
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
  | {
      readonly status: 'valid';
      readonly value: ArgumentLibrary;
      readonly migratedFromSchemaVersion?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    }
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
