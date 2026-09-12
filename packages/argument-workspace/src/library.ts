import { canonicalJson, clonePlainData } from './canonical';
import {
  ARGUMENT_LIBRARY_SCHEMA_VERSION,
  type ArgumentAxiom,
  type ArgumentCounterArgument,
  type ArgumentLibrary,
  type ArgumentRecordKind,
  type ArgumentRuntime,
  type ArgumentTopic,
  type CreateAxiomInput,
  type CreateCounterArgumentInput,
  type CreateTopicInput,
  type EditAxiomInput,
  type EditCounterArgumentInput,
  type EditTopicInput,
  type HumanReviewState,
  type RetrievalMetadata,
  type TopicMembershipKind,
  type UpdateCounterArgumentResponseInput,
} from './types';
import { assertValidArgumentLibrary } from './validation';

function sortedUnique(
  values: readonly string[] | undefined,
): readonly string[] {
  return [...new Set(values ?? [])].sort((left, right) =>
    left.localeCompare(right),
  );
}

function retrieval(
  value: Partial<RetrievalMetadata> | undefined,
): RetrievalMetadata {
  return {
    aliases: sortedUnique(value?.aliases),
    keywords: sortedUnique(value?.keywords),
    phrases: sortedUnique(value?.phrases),
  };
}

function requiredText(value: string, label: string): string {
  if (value.trim() === '') throw new Error(`${label} must not be empty.`);
  return value;
}

function runtimeTimestamp(runtime: ArgumentRuntime): string {
  const value = runtime.now();
  if (value.trim() === '' || !Number.isFinite(Date.parse(value))) {
    throw new Error('Argument Workspace clock returned an invalid timestamp.');
  }
  return value;
}

function nextId(
  library: ArgumentLibrary,
  kind: ArgumentRecordKind,
  supplied: string | undefined,
  runtime: ArgumentRuntime,
): string {
  const id = supplied ?? runtime.createId(kind);
  requiredText(id, `${kind} ID`);
  const exists = [
    ...library.topics,
    ...library.axioms,
    ...library.counterArguments,
  ].some((record) => record.id === id);
  if (exists) throw new Error(`Argument record ID "${id}" already exists.`);
  return id;
}

function adopt(
  previous: ArgumentLibrary,
  runtime: ArgumentRuntime,
  patch: Pick<ArgumentLibrary, 'topics' | 'axioms' | 'counterArguments'>,
): ArgumentLibrary {
  const updatedAt = runtimeTimestamp(runtime);
  const next = clonePlainData<ArgumentLibrary>({
    ...previous,
    libraryRevision: previous.libraryRevision + 1,
    updatedAt,
    topics: [...patch.topics].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    axioms: [...patch.axioms].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    counterArguments: [...patch.counterArguments].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  });
  return assertValidArgumentLibrary(next);
}

function recordUpdate<
  T extends { readonly revision: number; readonly updatedAt: string },
>(
  previous: T,
  nextContent: Readonly<Record<string, unknown>>,
  runtime: ArgumentRuntime,
): T {
  const previousContent = {
    ...previous,
    revision: undefined,
    updatedAt: undefined,
  };
  const candidateContent = {
    ...nextContent,
    revision: undefined,
    updatedAt: undefined,
  };
  if (canonicalJson(previousContent) === canonicalJson(candidateContent))
    return previous;
  return {
    ...nextContent,
    revision: previous.revision + 1,
    updatedAt: runtimeTimestamp(runtime),
  } as unknown as T;
}

export function createEmptyArgumentLibrary(
  runtime: ArgumentRuntime,
  suppliedLibraryId?: string,
): ArgumentLibrary {
  const libraryId = suppliedLibraryId ?? runtime.createId('library');
  requiredText(libraryId, 'Library ID');
  const now = runtimeTimestamp(runtime);
  return assertValidArgumentLibrary({
    schemaVersion: ARGUMENT_LIBRARY_SCHEMA_VERSION,
    libraryId,
    libraryRevision: 1,
    createdAt: now,
    updatedAt: now,
    topics: [],
    axioms: [],
    counterArguments: [],
  });
}

export function createTopic(
  library: ArgumentLibrary,
  input: CreateTopicInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const now = runtimeTimestamp(runtime);
  const topic: ArgumentTopic = {
    id: nextId(library, 'topic', input.id, runtime),
    revision: 1,
    reviewState: input.reviewState ?? 'draft',
    archived: false,
    createdAt: now,
    updatedAt: now,
    title: requiredText(input.title, 'Topic title'),
    summary: requiredText(input.summary, 'Topic summary'),
    retrieval: retrieval(input.retrieval),
    axiomIds: [],
    counterArgumentIds: [],
  };
  return adopt(library, runtime, {
    topics: [...library.topics, topic],
    axioms: library.axioms,
    counterArguments: library.counterArguments,
  });
}

export function editTopic(
  library: ArgumentLibrary,
  topicId: string,
  input: EditTopicInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const previous = library.topics.find(({ id }) => id === topicId);
  if (previous === undefined)
    throw new Error(`Topic "${topicId}" does not exist.`);
  const next = recordUpdate(
    previous,
    {
      ...previous,
      title:
        input.title === undefined
          ? previous.title
          : requiredText(input.title, 'Topic title'),
      summary:
        input.summary === undefined
          ? previous.summary
          : requiredText(input.summary, 'Topic summary'),
      retrieval:
        input.retrieval === undefined
          ? previous.retrieval
          : retrieval(input.retrieval),
    },
    runtime,
  );
  if (next === previous) return library;
  return adopt(library, runtime, {
    topics: library.topics.map((topic) =>
      topic.id === topicId ? next : topic,
    ),
    axioms: library.axioms,
    counterArguments: library.counterArguments,
  });
}

function optionalField(
  current: string | undefined,
  value: string | null | undefined,
  label: string,
): string | undefined {
  if (value === undefined) return current;
  if (value === null) return undefined;
  return requiredText(value, label);
}

export function createAxiom(
  library: ArgumentLibrary,
  input: CreateAxiomInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const now = runtimeTimestamp(runtime);
  const axiom: ArgumentAxiom = {
    id: nextId(library, 'axiom', input.id, runtime),
    revision: 1,
    reviewState: input.reviewState ?? 'draft',
    archived: false,
    createdAt: now,
    updatedAt: now,
    title: requiredText(input.title, 'Axiom title'),
    statement: requiredText(input.statement, 'Axiom statement'),
    ...(input.explanation === undefined
      ? {}
      : { explanation: requiredText(input.explanation, 'Axiom explanation') }),
    ...(input.scope === undefined
      ? {}
      : { scope: requiredText(input.scope, 'Axiom scope') }),
    ...(input.supportingReasoning === undefined
      ? {}
      : {
          supportingReasoning: requiredText(
            input.supportingReasoning,
            'Axiom supporting reasoning',
          ),
        }),
    retrieval: retrieval(input.retrieval),
    sourceReferences: clonePlainData(input.sourceReferences ?? []),
  };
  return adopt(library, runtime, {
    topics: library.topics,
    axioms: [...library.axioms, axiom],
    counterArguments: library.counterArguments,
  });
}

export function editAxiom(
  library: ArgumentLibrary,
  axiomId: string,
  input: EditAxiomInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const previous = library.axioms.find(({ id }) => id === axiomId);
  if (previous === undefined)
    throw new Error(`Axiom "${axiomId}" does not exist.`);
  const explanation = optionalField(
    previous.explanation,
    input.explanation,
    'Axiom explanation',
  );
  const scope = optionalField(previous.scope, input.scope, 'Axiom scope');
  const supportingReasoning = optionalField(
    previous.supportingReasoning,
    input.supportingReasoning,
    'Axiom supporting reasoning',
  );
  const next = recordUpdate(
    previous,
    {
      ...previous,
      title:
        input.title === undefined
          ? previous.title
          : requiredText(input.title, 'Axiom title'),
      statement:
        input.statement === undefined
          ? previous.statement
          : requiredText(input.statement, 'Axiom statement'),
      ...(explanation === undefined
        ? { explanation: undefined }
        : { explanation }),
      ...(scope === undefined ? { scope: undefined } : { scope }),
      ...(supportingReasoning === undefined
        ? { supportingReasoning: undefined }
        : { supportingReasoning }),
      retrieval:
        input.retrieval === undefined
          ? previous.retrieval
          : retrieval(input.retrieval),
      sourceReferences:
        input.sourceReferences === undefined
          ? previous.sourceReferences
          : clonePlainData(input.sourceReferences),
    },
    runtime,
  );
  if (next === previous) return library;
  return adopt(library, runtime, {
    topics: library.topics,
    axioms: library.axioms.map((axiom) =>
      axiom.id === axiomId ? next : axiom,
    ),
    counterArguments: library.counterArguments,
  });
}

export function createCounterArgument(
  library: ArgumentLibrary,
  input: CreateCounterArgumentInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const now = runtimeTimestamp(runtime);
  const counterArgument: ArgumentCounterArgument = {
    id: nextId(library, 'counter-argument', input.id, runtime),
    revision: 1,
    reviewState: input.reviewState ?? 'draft',
    archived: false,
    createdAt: now,
    updatedAt: now,
    title: requiredText(input.title, 'Counter-Argument title'),
    observation: requiredText(
      input.observation,
      'Counter-Argument observation',
    ),
    challengedClaim: requiredText(input.challengedClaim, 'Challenged claim'),
    ...(input.target === undefined
      ? {}
      : { target: clonePlainData(input.target) }),
    retrieval: retrieval(input.retrieval),
    sourceReferences: clonePlainData(input.sourceReferences ?? []),
    response: {
      answeringAxioms: clonePlainData(input.response?.answeringAxioms ?? []),
      explanation: input.response?.explanation ?? '',
      outcome: input.response?.outcome ?? 'unanswered',
      ...(input.response?.boundary === undefined
        ? {}
        : {
            boundary: requiredText(
              input.response.boundary,
              'Response boundary',
            ),
          }),
      ...(input.response?.reopeningCondition === undefined
        ? {}
        : {
            reopeningCondition: requiredText(
              input.response.reopeningCondition,
              'Response reopening condition',
            ),
          }),
    },
  };
  return adopt(library, runtime, {
    topics: library.topics,
    axioms: library.axioms,
    counterArguments: [...library.counterArguments, counterArgument],
  });
}

export function editCounterArgument(
  library: ArgumentLibrary,
  counterArgumentId: string,
  input: EditCounterArgumentInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const previous = library.counterArguments.find(
    ({ id }) => id === counterArgumentId,
  );
  if (previous === undefined) {
    throw new Error(`Counter-Argument "${counterArgumentId}" does not exist.`);
  }
  const target =
    input.target === undefined ? previous.target : (input.target ?? undefined);
  const next = recordUpdate(
    previous,
    {
      ...previous,
      title:
        input.title === undefined
          ? previous.title
          : requiredText(input.title, 'Counter-Argument title'),
      observation:
        input.observation === undefined
          ? previous.observation
          : requiredText(input.observation, 'Counter-Argument observation'),
      challengedClaim:
        input.challengedClaim === undefined
          ? previous.challengedClaim
          : requiredText(input.challengedClaim, 'Challenged claim'),
      ...(target === undefined
        ? { target: undefined }
        : { target: clonePlainData(target) }),
      retrieval:
        input.retrieval === undefined
          ? previous.retrieval
          : retrieval(input.retrieval),
      sourceReferences:
        input.sourceReferences === undefined
          ? previous.sourceReferences
          : clonePlainData(input.sourceReferences),
    },
    runtime,
  );
  if (next === previous) return library;
  return adopt(library, runtime, {
    topics: library.topics,
    axioms: library.axioms,
    counterArguments: library.counterArguments.map((record) =>
      record.id === counterArgumentId ? next : record,
    ),
  });
}

function updateCounterArgument(
  library: ArgumentLibrary,
  counterArgumentId: string,
  runtime: ArgumentRuntime,
  update: (
    record: ArgumentCounterArgument,
  ) => Readonly<Record<string, unknown>>,
): ArgumentLibrary {
  const previous = library.counterArguments.find(
    ({ id }) => id === counterArgumentId,
  );
  if (previous === undefined) {
    throw new Error(`Counter-Argument "${counterArgumentId}" does not exist.`);
  }
  const next = recordUpdate(previous, update(previous), runtime);
  if (next === previous) return library;
  return adopt(library, runtime, {
    topics: library.topics,
    axioms: library.axioms,
    counterArguments: library.counterArguments.map((record) =>
      record.id === counterArgumentId ? next : record,
    ),
  });
}

export function updateCounterArgumentResponse(
  library: ArgumentLibrary,
  counterArgumentId: string,
  input: UpdateCounterArgumentResponseInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  return updateCounterArgument(
    library,
    counterArgumentId,
    runtime,
    (previous) => {
      const boundary = optionalField(
        previous.response.boundary,
        input.boundary,
        'Response boundary',
      );
      const reopeningCondition = optionalField(
        previous.response.reopeningCondition,
        input.reopeningCondition,
        'Response reopening condition',
      );
      return {
        ...previous,
        response: {
          ...previous.response,
          explanation: input.explanation ?? previous.response.explanation,
          outcome: input.outcome ?? previous.response.outcome,
          ...(boundary === undefined ? { boundary: undefined } : { boundary }),
          ...(reopeningCondition === undefined
            ? { reopeningCondition: undefined }
            : { reopeningCondition }),
        },
      };
    },
  );
}

export function attachAnsweringAxiom(
  library: ArgumentLibrary,
  counterArgumentId: string,
  axiomId: string,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const axiom = library.axioms.find(({ id }) => id === axiomId);
  if (axiom === undefined)
    throw new Error(`Axiom "${axiomId}" does not exist.`);
  return updateCounterArgument(
    library,
    counterArgumentId,
    runtime,
    (previous) => {
      const answeringAxioms = previous.response.answeringAxioms.some(
        (reference) => reference.axiomId === axiomId,
      )
        ? previous.response.answeringAxioms
        : [
            ...previous.response.answeringAxioms,
            { axiomId, reliedOnRevision: axiom.revision },
          ].sort((left, right) => left.axiomId.localeCompare(right.axiomId));
      return {
        ...previous,
        response: { ...previous.response, answeringAxioms },
      };
    },
  );
}

export function detachAnsweringAxiom(
  library: ArgumentLibrary,
  counterArgumentId: string,
  axiomId: string,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  return updateCounterArgument(
    library,
    counterArgumentId,
    runtime,
    (previous) => ({
      ...previous,
      response: {
        ...previous.response,
        answeringAxioms: previous.response.answeringAxioms.filter(
          (reference) => reference.axiomId !== axiomId,
        ),
      },
    }),
  );
}

export function setTopicMembership(
  library: ArgumentLibrary,
  topicId: string,
  kind: TopicMembershipKind,
  recordId: string,
  member: boolean,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const topic = library.topics.find(({ id }) => id === topicId);
  if (topic === undefined)
    throw new Error(`Topic "${topicId}" does not exist.`);
  const collection =
    kind === 'axiom' ? library.axioms : library.counterArguments;
  if (!collection.some(({ id }) => id === recordId)) {
    throw new Error(
      `${kind === 'axiom' ? 'Axiom' : 'Counter-Argument'} "${recordId}" does not exist.`,
    );
  }
  const field = kind === 'axiom' ? 'axiomIds' : 'counterArgumentIds';
  const values = topic[field];
  const nextValues = member
    ? sortedUnique([...values, recordId])
    : values.filter((id) => id !== recordId);
  const next = recordUpdate(topic, { ...topic, [field]: nextValues }, runtime);
  if (next === topic) return library;
  return adopt(library, runtime, {
    topics: library.topics.map((record) =>
      record.id === topicId ? next : record,
    ),
    axioms: library.axioms,
    counterArguments: library.counterArguments,
  });
}

export function setRecordArchived(
  library: ArgumentLibrary,
  kind: ArgumentRecordKind,
  recordId: string,
  archived: boolean,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const collectionName =
    kind === 'topic'
      ? 'topics'
      : kind === 'axiom'
        ? 'axioms'
        : 'counterArguments';
  const collection = library[collectionName];
  const previous = collection.find(({ id }) => id === recordId);
  if (previous === undefined)
    throw new Error(`${kind} "${recordId}" does not exist.`);
  const next = recordUpdate(previous, { ...previous, archived }, runtime);
  if (next === previous) return library;
  return adopt(library, runtime, {
    topics:
      kind === 'topic'
        ? library.topics.map((record) =>
            record.id === recordId ? (next as ArgumentTopic) : record,
          )
        : library.topics,
    axioms:
      kind === 'axiom'
        ? library.axioms.map((record) =>
            record.id === recordId ? (next as ArgumentAxiom) : record,
          )
        : library.axioms,
    counterArguments:
      kind === 'counter-argument'
        ? library.counterArguments.map((record) =>
            record.id === recordId ? (next as ArgumentCounterArgument) : record,
          )
        : library.counterArguments,
  });
}

export function setRecordReviewState(
  library: ArgumentLibrary,
  kind: ArgumentRecordKind,
  recordId: string,
  reviewState: HumanReviewState,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const collectionName =
    kind === 'topic'
      ? 'topics'
      : kind === 'axiom'
        ? 'axioms'
        : 'counterArguments';
  const collection = library[collectionName];
  const previous = collection.find(({ id }) => id === recordId);
  if (previous === undefined)
    throw new Error(`${kind} "${recordId}" does not exist.`);
  const next = recordUpdate(previous, { ...previous, reviewState }, runtime);
  if (next === previous) return library;
  return adopt(library, runtime, {
    topics:
      kind === 'topic'
        ? library.topics.map((record) =>
            record.id === recordId ? (next as ArgumentTopic) : record,
          )
        : library.topics,
    axioms:
      kind === 'axiom'
        ? library.axioms.map((record) =>
            record.id === recordId ? (next as ArgumentAxiom) : record,
          )
        : library.axioms,
    counterArguments:
      kind === 'counter-argument'
        ? library.counterArguments.map((record) =>
            record.id === recordId ? (next as ArgumentCounterArgument) : record,
          )
        : library.counterArguments,
  });
}

export function responseStaleness(
  library: ArgumentLibrary,
  counterArgument: ArgumentCounterArgument,
): { readonly stale: boolean; readonly axiomIds: readonly string[] } {
  const revisions = new Map(
    library.axioms.map((axiom) => [axiom.id, axiom.revision]),
  );
  const axiomIds = counterArgument.response.answeringAxioms
    .filter(
      (reference) =>
        revisions.get(reference.axiomId) !== reference.reliedOnRevision,
    )
    .map((reference) => reference.axiomId)
    .sort((left, right) => left.localeCompare(right));
  return { stale: axiomIds.length > 0, axiomIds };
}
