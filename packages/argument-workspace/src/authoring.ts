import {
  addArgumentExample,
  addArgumentRelation,
  attachAnsweringAxiom,
  createAxiom,
  createArgument,
  createCounterArgument,
  createContext,
  createTopic,
  detachAnsweringAxiom,
  editAxiom,
  editArgument,
  editArgumentExample,
  editArgumentRelation,
  editCounterArgument,
  editContext,
  editTopic,
  reassessCounterArgumentResponse,
  reassessArgumentPremises,
  reassessArgumentRelations,
  moveArgumentExample,
  moveContextAxiom,
  promoteArgumentToCurrent,
  recordTheorySourceVersion,
  removeArgumentExample,
  removeArgumentRelation,
  setRecordArchived,
  setRecordReviewState,
  setContextAxiomMembership,
  setTopicMembership,
  updateCounterArgumentResponse,
} from './library';
import {
  mergeArgumentLibraries,
  previewArgumentLibraryImport,
} from './serialization';
import {
  discardArgumentProposal,
  reviseArgumentProposal,
  resolveProposalAsArgument,
  resolveProposalAsRejected,
  submitArgumentProposal,
} from './proposals';
import { applyCanonicalResolution } from './resolution';
import { sameSnapshot } from './canonical';
import { ArgumentLibraryRepository } from './storage';
import type {
  ArgumentLibrary,
  ArgumentLibraryCommitResult,
  ArgumentLibrarySnapshot,
  ArgumentProposal,
  ArgumentProposalResolutionReceipt,
  ArgumentExample,
  ArgumentRelation,
  ArgumentRecordKind,
  ArgumentRuntime,
  CreateAxiomInput,
  CreateArgumentInput,
  CreateArgumentProposalInput,
  CreateCounterArgumentInput,
  CreateContextInput,
  CreateTopicInput,
  DiscardArgumentProposalInput,
  EditAxiomInput,
  EditArgumentInput,
  EditCounterArgumentInput,
  EditContextInput,
  EditTopicInput,
  HumanReviewState,
  RecordTheorySourceVersionInput,
  ResolveProposalAsArgumentInput,
  ResolveProposalAsRejectedInput,
  ReviseArgumentProposalInput,
  SnapshotDescriptor,
  TopicMembershipKind,
  UpdateCounterArgumentResponseInput,
} from './types';
import type { CanonicalResolutionPlan } from './resolution';

export type ArgumentProposalSubmissionCommitResult =
  | {
      readonly status: 'committed';
      readonly snapshot: ArgumentLibrarySnapshot;
      readonly proposal: ArgumentProposal;
      readonly duplicate: boolean;
    }
  | Exclude<ArgumentLibraryCommitResult, { readonly status: 'committed' }>;

export type CanonicalResolutionCommitResult =
  | {
      readonly status: 'committed';
      readonly snapshot: ArgumentLibrarySnapshot;
      readonly receipt: ArgumentProposalResolutionReceipt;
    }
  | {
      readonly status: 'already-applied';
      readonly snapshot: ArgumentLibrarySnapshot;
      readonly receipt: ArgumentProposalResolutionReceipt;
    }
  | Exclude<ArgumentLibraryCommitResult, { readonly status: 'committed' }>;

/** Explicit canonical package mutation; callers enforce user authorization. */
export class ArgumentCanonicalResolutionService {
  constructor(
    private readonly repository: ArgumentLibraryRepository,
    private readonly runtime: ArgumentRuntime,
  ) {}

  async apply(
    plan: CanonicalResolutionPlan,
  ): Promise<CanonicalResolutionCommitResult> {
    const current = this.repository.current();
    if (current === undefined) {
      return {
        status: 'not-loaded',
        message: 'Argument Library has not been loaded.',
      };
    }
    if (!sameSnapshot(current.descriptor, plan.base)) {
      try {
        const retry = applyCanonicalResolution(
          current.library,
          plan,
          this.runtime,
        );
        if (retry.alreadyApplied) {
          return {
            status: 'already-applied',
            snapshot: current,
            receipt: retry.receipt,
          };
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('stale') && !message.includes('changed')) {
          return { status: 'persistence-error', message };
        }
      }
    }
    let receipt: ArgumentProposalResolutionReceipt | undefined;
    const committed = await this.repository.commit(plan.base, (library) => {
      const outcome = applyCanonicalResolution(library, plan, this.runtime);
      receipt = outcome.receipt;
      return outcome.library;
    });
    if (committed.status !== 'committed') return committed;
    if (receipt === undefined) {
      return {
        status: 'persistence-error',
        message: 'Canonical resolution committed without a receipt.',
      };
    }
    return {
      status: 'committed',
      snapshot: committed.snapshot,
      receipt,
    };
  }
}

/** Non-canonical Proposal staging mutations exposed to Compiler adapters. */
export class ArgumentProposalSubmissionService {
  constructor(
    private readonly repository: ArgumentLibraryRepository,
    private readonly runtime: ArgumentRuntime,
  ) {}

  async submitProposal(
    expected: SnapshotDescriptor,
    input: CreateArgumentProposalInput,
  ): Promise<ArgumentProposalSubmissionCommitResult> {
    let outcome: ReturnType<typeof submitArgumentProposal> | undefined;
    const committed = await this.repository.commit(expected, (library) => {
      outcome = submitArgumentProposal(library, input, this.runtime);
      return outcome.library;
    });
    if (committed.status !== 'committed') return committed;
    if (outcome === undefined) {
      return {
        status: 'persistence-error',
        message: 'Proposal submission did not produce a stored proposal.',
      };
    }
    return {
      status: 'committed',
      snapshot: committed.snapshot,
      proposal: outcome.proposal,
      duplicate: outcome.duplicate,
    };
  }

  reviseProposal(
    expected: SnapshotDescriptor,
    input: ReviseArgumentProposalInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.repository.commit(expected, (library) =>
      reviseArgumentProposal(library, input, this.runtime),
    );
  }

  discardProposal(
    expected: SnapshotDescriptor,
    input: DiscardArgumentProposalInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.repository.commit(expected, (library) =>
      discardArgumentProposal(library, input, this.runtime),
    );
  }
}

/** Mutation-only facade. Knowledge consumers receive KnowledgeReader instead. */
export class ArgumentLibraryAuthoringService {
  constructor(
    private readonly repository: ArgumentLibraryRepository,
    private readonly runtime: ArgumentRuntime,
  ) {}

  private commit(
    expected: SnapshotDescriptor,
    update: (library: ArgumentLibrary) => ArgumentLibrary,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.repository.commit(expected, update);
  }

  createTopic(
    expected: SnapshotDescriptor,
    input: CreateTopicInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      createTopic(library, input, this.runtime),
    );
  }

  editTopic(
    expected: SnapshotDescriptor,
    topicId: string,
    input: EditTopicInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      editTopic(library, topicId, input, this.runtime),
    );
  }

  createAxiom(
    expected: SnapshotDescriptor,
    input: CreateAxiomInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      createAxiom(library, input, this.runtime),
    );
  }

  editAxiom(
    expected: SnapshotDescriptor,
    axiomId: string,
    input: EditAxiomInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      editAxiom(library, axiomId, input, this.runtime),
    );
  }

  createContext(
    expected: SnapshotDescriptor,
    input: CreateContextInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      createContext(library, input, this.runtime),
    );
  }

  editContext(
    expected: SnapshotDescriptor,
    contextId: string,
    input: EditContextInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      editContext(library, contextId, input, this.runtime),
    );
  }

  setContextAxiomMembership(
    expected: SnapshotDescriptor,
    contextId: string,
    axiomId: string,
    member: boolean,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      setContextAxiomMembership(
        library,
        contextId,
        axiomId,
        member,
        this.runtime,
      ),
    );
  }

  moveContextAxiom(
    expected: SnapshotDescriptor,
    contextId: string,
    axiomId: string,
    destinationIndex: number,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      moveContextAxiom(
        library,
        contextId,
        axiomId,
        destinationIndex,
        this.runtime,
      ),
    );
  }

  createArgument(
    expected: SnapshotDescriptor,
    input: CreateArgumentInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      createArgument(library, input, this.runtime),
    );
  }

  editArgument(
    expected: SnapshotDescriptor,
    argumentId: string,
    input: EditArgumentInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      editArgument(library, argumentId, input, this.runtime),
    );
  }

  reassessArgumentPremises(
    expected: SnapshotDescriptor,
    argumentId: string,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      reassessArgumentPremises(library, argumentId, this.runtime),
    );
  }

  reassessArgumentRelations(
    expected: SnapshotDescriptor,
    argumentId: string,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      reassessArgumentRelations(library, argumentId, this.runtime),
    );
  }

  addArgumentExample(
    expected: SnapshotDescriptor,
    argumentId: string,
    example: ArgumentExample,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      addArgumentExample(library, argumentId, example, this.runtime),
    );
  }

  editArgumentExample(
    expected: SnapshotDescriptor,
    argumentId: string,
    exampleId: string,
    text: string,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      editArgumentExample(library, argumentId, exampleId, text, this.runtime),
    );
  }

  moveArgumentExample(
    expected: SnapshotDescriptor,
    argumentId: string,
    exampleId: string,
    destinationIndex: number,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      moveArgumentExample(
        library,
        argumentId,
        exampleId,
        destinationIndex,
        this.runtime,
      ),
    );
  }

  removeArgumentExample(
    expected: SnapshotDescriptor,
    argumentId: string,
    exampleId: string,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      removeArgumentExample(library, argumentId, exampleId, this.runtime),
    );
  }

  addArgumentRelation(
    expected: SnapshotDescriptor,
    argumentId: string,
    relation: ArgumentRelation,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      addArgumentRelation(library, argumentId, relation, this.runtime),
    );
  }

  editArgumentRelation(
    expected: SnapshotDescriptor,
    argumentId: string,
    relationId: string,
    relation: ArgumentRelation,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      editArgumentRelation(
        library,
        argumentId,
        relationId,
        relation,
        this.runtime,
      ),
    );
  }

  removeArgumentRelation(
    expected: SnapshotDescriptor,
    argumentId: string,
    relationId: string,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      removeArgumentRelation(library, argumentId, relationId, this.runtime),
    );
  }

  promoteArgumentToCurrent(
    expected: SnapshotDescriptor,
    topicId: string,
    argumentId: string,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      promoteArgumentToCurrent(library, topicId, argumentId, this.runtime),
    );
  }

  createCounterArgument(
    expected: SnapshotDescriptor,
    input: CreateCounterArgumentInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      createCounterArgument(library, input, this.runtime),
    );
  }

  editCounterArgument(
    expected: SnapshotDescriptor,
    counterArgumentId: string,
    input: EditCounterArgumentInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      editCounterArgument(library, counterArgumentId, input, this.runtime),
    );
  }

  setTopicMembership(
    expected: SnapshotDescriptor,
    topicId: string,
    kind: TopicMembershipKind,
    recordId: string,
    member: boolean,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      setTopicMembership(
        library,
        topicId,
        kind,
        recordId,
        member,
        this.runtime,
      ),
    );
  }

  attachAnsweringAxiom(
    expected: SnapshotDescriptor,
    counterArgumentId: string,
    axiomId: string,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      attachAnsweringAxiom(library, counterArgumentId, axiomId, this.runtime),
    );
  }

  detachAnsweringAxiom(
    expected: SnapshotDescriptor,
    counterArgumentId: string,
    axiomId: string,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      detachAnsweringAxiom(library, counterArgumentId, axiomId, this.runtime),
    );
  }

  updateResponse(
    expected: SnapshotDescriptor,
    counterArgumentId: string,
    input: UpdateCounterArgumentResponseInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      updateCounterArgumentResponse(
        library,
        counterArgumentId,
        input,
        this.runtime,
      ),
    );
  }

  reassessResponse(
    expected: SnapshotDescriptor,
    counterArgumentId: string,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      reassessCounterArgumentResponse(library, counterArgumentId, this.runtime),
    );
  }

  recordSourceVersion(
    expected: SnapshotDescriptor,
    input: RecordTheorySourceVersionInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      recordTheorySourceVersion(library, input, this.runtime),
    );
  }

  setArchived(
    expected: SnapshotDescriptor,
    kind: ArgumentRecordKind,
    recordId: string,
    archived: boolean,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      setRecordArchived(library, kind, recordId, archived, this.runtime),
    );
  }

  setReviewState(
    expected: SnapshotDescriptor,
    kind: ArgumentRecordKind,
    recordId: string,
    state: HumanReviewState,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      setRecordReviewState(library, kind, recordId, state, this.runtime),
    );
  }

  resolveProposalAsArgument(
    expected: SnapshotDescriptor,
    input: ResolveProposalAsArgumentInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      resolveProposalAsArgument(library, input, this.runtime),
    );
  }

  resolveProposalAsRejected(
    expected: SnapshotDescriptor,
    input: ResolveProposalAsRejectedInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      resolveProposalAsRejected(library, input, this.runtime),
    );
  }

  reviseProposal(
    expected: SnapshotDescriptor,
    input: ReviseArgumentProposalInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      reviseArgumentProposal(library, input, this.runtime),
    );
  }

  discardProposal(
    expected: SnapshotDescriptor,
    input: DiscardArgumentProposalInput,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      discardArgumentProposal(library, input, this.runtime),
    );
  }

  /** Persists one previously previewed additive candidate as a single commit. */
  commitInsert(
    expected: SnapshotDescriptor,
    candidate: ArgumentLibrary,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (current) => {
      if (
        candidate.libraryId !== current.libraryId ||
        candidate.schemaVersion !== current.schemaVersion ||
        candidate.libraryRevision !== current.libraryRevision + 1
      ) {
        throw new Error(
          'Prepared Insert JSON candidate does not extend the expected library snapshot.',
        );
      }
      return candidate;
    });
  }

  mergeImport(
    expected: SnapshotDescriptor,
    incoming: ArgumentLibrary,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) =>
      mergeArgumentLibraries(library, incoming, this.runtime),
    );
  }

  replaceImport(
    expected: SnapshotDescriptor,
    incoming: ArgumentLibrary,
  ): Promise<ArgumentLibraryCommitResult> {
    return this.commit(expected, (library) => {
      const preview = previewArgumentLibraryImport(
        library,
        incoming,
        'replace',
      );
      if (preview.status === 'identical') return library;
      if (preview.status !== 'replace-ready') {
        throw new Error(
          'Argument Library replacement conflicts with the current lineage.',
        );
      }
      return incoming;
    });
  }
}
