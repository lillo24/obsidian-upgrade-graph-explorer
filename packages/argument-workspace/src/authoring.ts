import {
  attachAnsweringAxiom,
  createAxiom,
  createCounterArgument,
  createTopic,
  detachAnsweringAxiom,
  editAxiom,
  editCounterArgument,
  editTopic,
  setRecordArchived,
  setRecordReviewState,
  setTopicMembership,
  updateCounterArgumentResponse,
} from './library';
import {
  mergeArgumentLibraries,
  previewArgumentLibraryImport,
} from './serialization';
import { ArgumentLibraryRepository } from './storage';
import type {
  ArgumentLibrary,
  ArgumentLibraryCommitResult,
  ArgumentRecordKind,
  ArgumentRuntime,
  CreateAxiomInput,
  CreateCounterArgumentInput,
  CreateTopicInput,
  EditAxiomInput,
  EditCounterArgumentInput,
  EditTopicInput,
  HumanReviewState,
  SnapshotDescriptor,
  TopicMembershipKind,
  UpdateCounterArgumentResponseInput,
} from './types';

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
