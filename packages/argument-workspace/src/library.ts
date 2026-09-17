import { canonicalJson, clonePlainData } from './canonical';
import {
  ARGUMENT_LIBRARY_SCHEMA_VERSION,
  type Argument,
  type ArgumentAxiom,
  type ArgumentCounterArgument,
  type ArgumentDependencyPathStep,
  type ArgumentDependencyRootCause,
  type ArgumentExample,
  type ArgumentLibrary,
  type ArgumentPremise,
  type ArgumentPremiseStaleness,
  type ArgumentPremiseStalenessCause,
  type ArgumentRecordKind,
  type ArgumentRelation,
  type ArgumentRuntime,
  type ArgumentStalenessResult,
  type ArgumentTopic,
  type CreateAxiomInput,
  type CreateArgumentInput,
  type CreateCounterArgumentInput,
  type CreateTopicInput,
  type EditAxiomInput,
  type EditArgumentInput,
  type EditCounterArgumentInput,
  type EditTopicInput,
  type HumanReviewState,
  type RecordTheorySourceVersionInput,
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
    ...library.arguments,
    ...library.counterArguments,
  ].some((record) => record.id === id);
  if (exists) throw new Error(`Argument record ID "${id}" already exists.`);
  return id;
}

function adopt(
  previous: ArgumentLibrary,
  runtime: ArgumentRuntime,
  patch: Pick<
    ArgumentLibrary,
    'topics' | 'axioms' | 'arguments' | 'counterArguments'
  >,
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
    arguments: [...patch.arguments].sort((left, right) =>
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
    arguments: [],
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
    argumentIds: [],
    counterArgumentIds: [],
  };
  return adopt(library, runtime, {
    topics: [...library.topics, topic],
    axioms: library.axioms,
    arguments: library.arguments,
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
    arguments: library.arguments,
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
    arguments: library.arguments,
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
    arguments: library.arguments,
    counterArguments: library.counterArguments,
  });
}

function updateArgument(
  library: ArgumentLibrary,
  argumentId: string,
  runtime: ArgumentRuntime,
  update: (record: Argument) => Readonly<Record<string, unknown>>,
): ArgumentLibrary {
  const previous = library.arguments.find(({ id }) => id === argumentId);
  if (previous === undefined) {
    throw new Error(`Argument "${argumentId}" does not exist.`);
  }
  const next = recordUpdate(previous, update(previous), runtime);
  if (next === previous) return library;
  return adopt(library, runtime, {
    topics: library.topics,
    axioms: library.axioms,
    arguments: library.arguments.map((record) =>
      record.id === argumentId ? next : record,
    ),
    counterArguments: library.counterArguments,
  });
}

export function createArgument(
  library: ArgumentLibrary,
  input: CreateArgumentInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const now = runtimeTimestamp(runtime);
  const argument: Argument = {
    id: nextId(library, 'argument', input.id, runtime),
    revision: 1,
    reviewState: input.reviewState ?? 'draft',
    archived: false,
    createdAt: now,
    updatedAt: now,
    title: requiredText(input.title, 'Argument title'),
    examples: clonePlainData(input.examples ?? []),
    premises: clonePlainData(input.premises),
    ...(input.reasoning === undefined
      ? {}
      : { reasoning: requiredText(input.reasoning, 'Argument reasoning') }),
    conclusion: requiredText(input.conclusion, 'Argument conclusion'),
    ...(input.boundary === undefined
      ? {}
      : { boundary: requiredText(input.boundary, 'Boundary / Invariance') }),
    relations: clonePlainData(input.relations ?? []),
    retrieval: retrieval(input.retrieval),
    sourceReferences: clonePlainData(input.sourceReferences ?? []),
    ...(input.supersedesArgumentId === undefined
      ? {}
      : {
          supersedesArgumentId: requiredText(
            input.supersedesArgumentId,
            'Superseded Argument ID',
          ),
        }),
  };
  return adopt(library, runtime, {
    topics: library.topics,
    axioms: library.axioms,
    arguments: [...library.arguments, argument],
    counterArguments: library.counterArguments,
  });
}

export function editArgument(
  library: ArgumentLibrary,
  argumentId: string,
  input: EditArgumentInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  return updateArgument(library, argumentId, runtime, (previous) => {
    const reasoning = optionalField(
      previous.reasoning,
      input.reasoning,
      'Argument reasoning',
    );
    const boundary = optionalField(
      previous.boundary,
      input.boundary,
      'Boundary / Invariance',
    );
    const supersedesArgumentId = optionalField(
      previous.supersedesArgumentId,
      input.supersedesArgumentId,
      'Superseded Argument ID',
    );
    return {
      ...previous,
      title:
        input.title === undefined
          ? previous.title
          : requiredText(input.title, 'Argument title'),
      examples:
        input.examples === undefined
          ? previous.examples
          : clonePlainData(input.examples),
      premises:
        input.premises === undefined
          ? previous.premises
          : clonePlainData(input.premises),
      ...(reasoning === undefined ? { reasoning: undefined } : { reasoning }),
      conclusion:
        input.conclusion === undefined
          ? previous.conclusion
          : requiredText(input.conclusion, 'Argument conclusion'),
      ...(boundary === undefined ? { boundary: undefined } : { boundary }),
      relations:
        input.relations === undefined
          ? previous.relations
          : clonePlainData(input.relations),
      retrieval:
        input.retrieval === undefined
          ? previous.retrieval
          : retrieval(input.retrieval),
      sourceReferences:
        input.sourceReferences === undefined
          ? previous.sourceReferences
          : clonePlainData(input.sourceReferences),
      ...(supersedesArgumentId === undefined
        ? { supersedesArgumentId: undefined }
        : { supersedesArgumentId }),
    };
  });
}

function dependencyPathStep(
  argumentId: string,
  premise: Exclude<ArgumentPremise, { readonly kind: 'text' }>,
): ArgumentDependencyPathStep {
  if (premise.kind === 'axiom') {
    return {
      argumentId,
      premiseId: premise.id,
      kind: premise.kind,
      axiomId: premise.axiomId,
    };
  }
  if (premise.kind === 'argument-conclusion') {
    return {
      argumentId,
      premiseId: premise.id,
      kind: premise.kind,
      sourceArgumentId: premise.argumentId,
    };
  }
  return {
    argumentId,
    premiseId: premise.id,
    kind: premise.kind,
    sourceArgumentId: premise.argumentId,
    sourcePremiseId: premise.premiseId,
  };
}

function stalePremiseResult(
  premiseId: string,
  causes: readonly ArgumentPremiseStalenessCause[],
): ArgumentPremiseStaleness {
  return {
    premiseId,
    stale: causes.length > 0,
    direct: causes.some(({ kind }) => kind === 'direct'),
    inherited: causes.some(({ kind }) => kind === 'inherited'),
    causes,
  };
}

/**
 * Creates one memoized evaluator for a library snapshot. Only inference-premise
 * dependencies propagate; relation and supersession state are intentionally
 * excluded from recursive evaluation.
 */
export function createArgumentStalenessEvaluator(
  library: ArgumentLibrary,
): (argument: Argument) => ArgumentStalenessResult {
  const axiomsById = new Map(library.axioms.map((axiom) => [axiom.id, axiom]));
  const argumentsById = new Map(
    library.arguments.map((argument) => [argument.id, argument]),
  );
  const premiseMemo = new Map<string, Map<string, ArgumentPremiseStaleness>>();
  const visiting = new Map<string, Set<string>>();

  const memoized = (
    argumentId: string,
    premiseId: string,
  ): ArgumentPremiseStaleness | undefined =>
    premiseMemo.get(argumentId)?.get(premiseId);

  const remember = (
    argumentId: string,
    result: ArgumentPremiseStaleness,
  ): ArgumentPremiseStaleness => {
    const argumentMemo = premiseMemo.get(argumentId) ?? new Map();
    argumentMemo.set(result.premiseId, result);
    premiseMemo.set(argumentId, argumentMemo);
    return result;
  };

  const markVisiting = (
    argumentId: string,
    premiseId: string,
    active: boolean,
  ): void => {
    const argumentVisiting = visiting.get(argumentId) ?? new Set();
    if (active) {
      argumentVisiting.add(premiseId);
      visiting.set(argumentId, argumentVisiting);
    } else {
      argumentVisiting.delete(premiseId);
      if (argumentVisiting.size === 0) visiting.delete(argumentId);
    }
  };

  const directCause = (
    root: ArgumentDependencyRootCause,
    path: ArgumentDependencyPathStep,
  ): ArgumentPremiseStalenessCause => ({
    kind: 'direct',
    root,
    path: [path],
  });

  const evaluatePremise = (
    argumentId: string,
    premise: ArgumentPremise,
  ): ArgumentPremiseStaleness => {
    const cached = memoized(argumentId, premise.id);
    if (cached !== undefined) return cached;
    if (premise.kind === 'text') {
      return remember(argumentId, stalePremiseResult(premise.id, []));
    }

    const step = dependencyPathStep(argumentId, premise);
    if (visiting.get(argumentId)?.has(premise.id) === true) {
      return stalePremiseResult(premise.id, [
        {
          kind: 'inherited',
          root: { kind: 'dependency-cycle', argumentId, premiseId: premise.id },
          path: [step],
        },
      ]);
    }
    markVisiting(argumentId, premise.id, true);

    const causes: ArgumentPremiseStalenessCause[] = [];
    if (premise.kind === 'axiom') {
      const axiom = axiomsById.get(premise.axiomId);
      if (axiom === undefined) {
        causes.push(
          directCause(
            {
              kind: 'missing-reference',
              recordKind: 'axiom',
              recordId: premise.axiomId,
            },
            step,
          ),
        );
      } else if (axiom.revision !== premise.reliedOnRevision) {
        causes.push(
          directCause(
            {
              kind: 'revision-mismatch',
              recordKind: 'axiom',
              recordId: axiom.id,
              reliedOnRevision: premise.reliedOnRevision,
              currentRevision: axiom.revision,
            },
            step,
          ),
        );
      }
    } else {
      const sourceArgument = argumentsById.get(premise.argumentId);
      if (sourceArgument === undefined) {
        causes.push(
          directCause(
            {
              kind: 'missing-reference',
              recordKind: 'argument',
              recordId: premise.argumentId,
            },
            step,
          ),
        );
      } else {
        if (sourceArgument.revision !== premise.reliedOnRevision) {
          causes.push(
            directCause(
              {
                kind: 'revision-mismatch',
                recordKind: 'argument',
                recordId: sourceArgument.id,
                reliedOnRevision: premise.reliedOnRevision,
                currentRevision: sourceArgument.revision,
              },
              step,
            ),
          );
        }

        const sourcePremises =
          premise.kind === 'argument-conclusion'
            ? sourceArgument.premises
            : sourceArgument.premises.filter(
                ({ id }) => id === premise.premiseId,
              );
        if (
          premise.kind === 'argument-premise' &&
          sourcePremises.length === 0
        ) {
          causes.push(
            directCause(
              {
                kind: 'missing-reference',
                recordKind: 'premise',
                recordId: `${sourceArgument.id}.${premise.premiseId}`,
              },
              step,
            ),
          );
        }
        for (const sourcePremise of sourcePremises) {
          const sourceStaleness = evaluatePremise(
            sourceArgument.id,
            sourcePremise,
          );
          for (const cause of sourceStaleness.causes) {
            causes.push({
              kind: 'inherited',
              root: cause.root,
              path: [step, ...cause.path],
            });
          }
        }
      }
    }

    markVisiting(argumentId, premise.id, false);
    return remember(argumentId, stalePremiseResult(premise.id, causes));
  };

  return (argument) => {
    const premiseStaleness = argument.premises.map((premise) =>
      evaluatePremise(argument.id, premise),
    );
    const premiseIds = premiseStaleness
      .filter(({ stale }) => stale)
      .map(({ premiseId }) => premiseId);
    const relationIds = argument.relations
      .filter(
        (relation) =>
          argumentsById.get(relation.targetArgumentId)?.revision !==
          relation.reliedOnRevision,
      )
      .map(({ id }) => id);
    return {
      stale: premiseIds.length > 0 || relationIds.length > 0,
      premiseIds,
      relationIds,
      premiseStaleness,
    };
  };
}

export function argumentStaleness(
  library: ArgumentLibrary,
  argument: Argument,
): ArgumentStalenessResult {
  return createArgumentStalenessEvaluator(library)(argument);
}

/** Explicitly records that every referenced premise was re-evaluated. */
export function reassessArgumentPremises(
  library: ArgumentLibrary,
  argumentId: string,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const argument = library.arguments.find(({ id }) => id === argumentId);
  if (argument === undefined) {
    throw new Error(`Argument "${argumentId}" does not exist.`);
  }
  const inheritedPremiseIds = argumentStaleness(library, argument)
    .premiseStaleness.filter(({ inherited }) => inherited)
    .map(({ premiseId }) => premiseId);
  if (inheritedPremiseIds.length > 0) {
    throw new Error(
      `Argument "${argumentId}" has inherited stale premises (${inheritedPremiseIds.join(', ')}). Reassess upstream inference dependencies first.`,
    );
  }
  const axiomRevisions = new Map(
    library.axioms.map((axiom) => [axiom.id, axiom.revision]),
  );
  const argumentRevisions = new Map(
    library.arguments.map((argument) => [argument.id, argument.revision]),
  );
  return updateArgument(library, argumentId, runtime, (previous) => ({
    ...previous,
    premises: previous.premises.map((premise) => {
      if (premise.kind === 'text') return premise;
      return {
        ...premise,
        reliedOnRevision:
          premise.kind === 'axiom'
            ? axiomRevisions.get(premise.axiomId)!
            : argumentRevisions.get(premise.argumentId)!,
      };
    }),
  }));
}

/** Explicitly records that every outgoing relation target was re-evaluated. */
export function reassessArgumentRelations(
  library: ArgumentLibrary,
  argumentId: string,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const argumentRevisions = new Map(
    library.arguments.map((argument) => [argument.id, argument.revision]),
  );
  return updateArgument(library, argumentId, runtime, (previous) => ({
    ...previous,
    relations: previous.relations.map((relation) => ({
      ...relation,
      reliedOnRevision: argumentRevisions.get(relation.targetArgumentId)!,
    })),
  }));
}

export function addArgumentExample(
  library: ArgumentLibrary,
  argumentId: string,
  example: ArgumentExample,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  return updateArgument(library, argumentId, runtime, (previous) => ({
    ...previous,
    examples: [...previous.examples, clonePlainData(example)],
  }));
}

export function editArgumentExample(
  library: ArgumentLibrary,
  argumentId: string,
  exampleId: string,
  text: string,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  return updateArgument(library, argumentId, runtime, (previous) => {
    if (!previous.examples.some(({ id }) => id === exampleId)) {
      throw new Error(`Example "${exampleId}" does not exist.`);
    }
    return {
      ...previous,
      examples: previous.examples.map((example) =>
        example.id === exampleId
          ? { ...example, text: requiredText(text, 'Example text') }
          : example,
      ),
    };
  });
}

export function moveArgumentExample(
  library: ArgumentLibrary,
  argumentId: string,
  exampleId: string,
  destinationIndex: number,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  return updateArgument(library, argumentId, runtime, (previous) => {
    const sourceIndex = previous.examples.findIndex(
      ({ id }) => id === exampleId,
    );
    if (sourceIndex < 0)
      throw new Error(`Example "${exampleId}" does not exist.`);
    if (
      !Number.isInteger(destinationIndex) ||
      destinationIndex < 0 ||
      destinationIndex >= previous.examples.length
    ) {
      throw new Error('Example destination index is out of range.');
    }
    const examples = [...previous.examples];
    const [example] = examples.splice(sourceIndex, 1);
    examples.splice(destinationIndex, 0, example!);
    return { ...previous, examples };
  });
}

export function removeArgumentExample(
  library: ArgumentLibrary,
  argumentId: string,
  exampleId: string,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  return updateArgument(library, argumentId, runtime, (previous) => {
    if (!previous.examples.some(({ id }) => id === exampleId)) {
      throw new Error(`Example "${exampleId}" does not exist.`);
    }
    if (
      previous.premises.some(({ exampleIds }) =>
        exampleIds?.includes(exampleId),
      )
    ) {
      throw new Error(
        `Example "${exampleId}" is referenced by a premise and cannot be removed.`,
      );
    }
    return {
      ...previous,
      examples: previous.examples.filter(({ id }) => id !== exampleId),
    };
  });
}

export function addArgumentRelation(
  library: ArgumentLibrary,
  argumentId: string,
  relation: ArgumentRelation,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  return updateArgument(library, argumentId, runtime, (previous) => ({
    ...previous,
    relations: [...previous.relations, clonePlainData(relation)],
  }));
}

export function editArgumentRelation(
  library: ArgumentLibrary,
  argumentId: string,
  relationId: string,
  relation: ArgumentRelation,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  return updateArgument(library, argumentId, runtime, (previous) => {
    if (!previous.relations.some(({ id }) => id === relationId)) {
      throw new Error(`Argument relation "${relationId}" does not exist.`);
    }
    return {
      ...previous,
      relations: previous.relations.map((current) =>
        current.id === relationId
          ? clonePlainData({ ...relation, id: relationId })
          : current,
      ),
    };
  });
}

export function removeArgumentRelation(
  library: ArgumentLibrary,
  argumentId: string,
  relationId: string,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  return updateArgument(library, argumentId, runtime, (previous) => {
    if (!previous.relations.some(({ id }) => id === relationId)) {
      throw new Error(`Argument relation "${relationId}" does not exist.`);
    }
    return {
      ...previous,
      relations: previous.relations.filter(({ id }) => id !== relationId),
    };
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
    arguments: library.arguments,
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
    arguments: library.arguments,
    counterArguments: library.counterArguments.map((record) =>
      record.id === counterArgumentId ? next : record,
    ),
  });
}

/**
 * Records a confirmed full-document source baseline on one existing locator.
 * This is an ordinary record mutation: it never reads or writes source text.
 */
export function recordTheorySourceVersion(
  library: ArgumentLibrary,
  input: RecordTheorySourceVersionInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  requiredText(input.sourceSpaceId, 'Source-space ID');
  requiredText(input.sourceVersion, 'Source version');
  const record =
    input.recordKind === 'axiom'
      ? library.axioms.find(({ id }) => id === input.recordId)
      : input.recordKind === 'argument'
        ? library.arguments.find(({ id }) => id === input.recordId)
        : library.counterArguments.find(({ id }) => id === input.recordId);
  if (record === undefined) {
    throw new Error(`${input.recordKind} "${input.recordId}" does not exist.`);
  }
  const reference = record.sourceReferences.find(
    ({ id }) => id === input.sourceReferenceId,
  );
  if (reference === undefined) {
    throw new Error(
      `Source reference "${input.sourceReferenceId}" is not registered on ${input.recordKind} "${input.recordId}".`,
    );
  }
  if (
    reference.sourceSpaceHint !== undefined &&
    reference.sourceSpaceHint !== input.sourceSpaceId
  ) {
    throw new Error(
      `Source reference "${reference.id}" is bound to a different source space.`,
    );
  }
  const sourceReferences = record.sourceReferences.map((candidate) =>
    candidate.id === reference.id
      ? {
          ...candidate,
          sourceSpaceHint: candidate.sourceSpaceHint ?? input.sourceSpaceId,
          recordedVersion: {
            sourceVersion: input.sourceVersion,
            fingerprintScope: 'file' as const,
          },
        }
      : candidate,
  );
  return input.recordKind === 'axiom'
    ? editAxiom(library, input.recordId, { sourceReferences }, runtime)
    : input.recordKind === 'argument'
      ? editArgument(library, input.recordId, { sourceReferences }, runtime)
      : editCounterArgument(
          library,
          input.recordId,
          { sourceReferences },
          runtime,
        );
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
    arguments: library.arguments,
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

/**
 * Records an explicit human reassessment against the current revisions of every
 * attached answering Axiom. Response prose and outcome remain unchanged.
 */
export function reassessCounterArgumentResponse(
  library: ArgumentLibrary,
  counterArgumentId: string,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const axiomRevisions = new Map(
    library.axioms.map((axiom) => [axiom.id, axiom.revision]),
  );
  return updateCounterArgument(
    library,
    counterArgumentId,
    runtime,
    (previous) => ({
      ...previous,
      response: {
        ...previous.response,
        answeringAxioms: previous.response.answeringAxioms.map((reference) => ({
          ...reference,
          reliedOnRevision: axiomRevisions.get(reference.axiomId)!,
        })),
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
    kind === 'axiom'
      ? library.axioms
      : kind === 'argument'
        ? library.arguments
        : library.counterArguments;
  if (!collection.some(({ id }) => id === recordId)) {
    throw new Error(
      `${kind === 'axiom' ? 'Axiom' : kind === 'argument' ? 'Argument' : 'Counter-Argument'} "${recordId}" does not exist.`,
    );
  }
  const field =
    kind === 'axiom'
      ? 'axiomIds'
      : kind === 'argument'
        ? 'argumentIds'
        : 'counterArgumentIds';
  const values = topic[field];
  if (!member && kind === 'argument' && topic.currentArgumentId === recordId) {
    throw new Error(
      `Current Argument "${recordId}" cannot be removed from Topic "${topicId}".`,
    );
  }
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
    arguments: library.arguments,
    counterArguments: library.counterArguments,
  });
}

export function promoteArgumentToCurrent(
  library: ArgumentLibrary,
  topicId: string,
  argumentId: string,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const topic = library.topics.find(({ id }) => id === topicId);
  if (topic === undefined) {
    throw new Error(`Topic "${topicId}" does not exist.`);
  }
  const candidate = library.arguments.find(({ id }) => id === argumentId);
  if (candidate === undefined) {
    throw new Error(`Argument "${argumentId}" does not exist.`);
  }
  if (!topic.argumentIds.includes(argumentId)) {
    throw new Error(
      `Argument "${argumentId}" must belong to Topic "${topicId}" before promotion.`,
    );
  }
  if (candidate.archived) {
    throw new Error('An archived Argument cannot be promoted to Current.');
  }
  if (candidate.reviewState !== 'accepted') {
    throw new Error('Only an accepted Argument can be promoted to Current.');
  }
  const previousCurrentId = topic.currentArgumentId;
  if (previousCurrentId === argumentId) return library;
  if (
    previousCurrentId !== undefined &&
    candidate.supersedesArgumentId !== undefined &&
    candidate.supersedesArgumentId !== previousCurrentId
  ) {
    throw new Error(
      `Argument "${argumentId}" already supersedes a different predecessor.`,
    );
  }
  const nextArgument =
    previousCurrentId === undefined ||
    candidate.supersedesArgumentId === previousCurrentId
      ? candidate
      : recordUpdate(
          candidate,
          { ...candidate, supersedesArgumentId: previousCurrentId },
          runtime,
        );
  const nextTopic = recordUpdate(
    topic,
    { ...topic, currentArgumentId: argumentId },
    runtime,
  );
  return adopt(library, runtime, {
    topics: library.topics.map((record) =>
      record.id === topicId ? nextTopic : record,
    ),
    axioms: library.axioms,
    arguments: library.arguments.map((record) =>
      record.id === argumentId ? nextArgument : record,
    ),
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
  if (
    kind === 'argument' &&
    archived &&
    library.topics.some(
      ({ currentArgumentId }) => currentArgumentId === recordId,
    )
  ) {
    throw new Error(`Current Argument "${recordId}" cannot be archived.`);
  }
  const collectionName =
    kind === 'topic'
      ? 'topics'
      : kind === 'axiom'
        ? 'axioms'
        : kind === 'argument'
          ? 'arguments'
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
    arguments:
      kind === 'argument'
        ? library.arguments.map((record) =>
            record.id === recordId ? (next as Argument) : record,
          )
        : library.arguments,
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
        : kind === 'argument'
          ? 'arguments'
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
    arguments:
      kind === 'argument'
        ? library.arguments.map((record) =>
            record.id === recordId ? (next as Argument) : record,
          )
        : library.arguments,
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
