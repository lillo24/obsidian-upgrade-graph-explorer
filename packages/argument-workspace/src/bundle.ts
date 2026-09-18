import { clonePlainData } from './canonical';
import { createContextResolver, resolveArgumentBackground } from './contexts';
import { createArgumentStalenessEvaluator, responseStaleness } from './library';
import type {
  ArgumentBundle,
  ArgumentLibrary,
  ArgumentRecordKind,
  ReadArgumentBundleRequest,
  SnapshotDescriptor,
} from './types';

export type AssembleArgumentBundleResult =
  | {
      readonly status: 'ok';
      readonly value: Omit<ArgumentBundle, 'receipt'>;
      readonly returnedRecords: readonly {
        readonly kind: ArgumentRecordKind;
        readonly id: string;
        readonly revision: number;
      }[];
    }
  | { readonly status: 'not-found'; readonly id: string }
  | {
      readonly status: 'ambiguous-selector';
      readonly id: string;
      readonly kinds: readonly ArgumentRecordKind[];
    }
  | {
      readonly status: 'limit-exceeded';
      readonly requiredRecordIds: readonly string[];
      readonly omissions: readonly string[];
      readonly returnedRecords: readonly {
        readonly kind: ArgumentRecordKind;
        readonly id: string;
        readonly revision: number;
      }[];
    };

function recordKinds(
  library: ArgumentLibrary,
  id: string,
): readonly ArgumentRecordKind[] {
  const kinds: ArgumentRecordKind[] = [];
  if (library.topics.some((record) => record.id === id)) kinds.push('topic');
  if (library.contexts.some((record) => record.id === id))
    kinds.push('context');
  if (library.axioms.some((record) => record.id === id)) kinds.push('axiom');
  if (library.arguments.some((record) => record.id === id)) {
    kinds.push('argument');
  }
  if (library.counterArguments.some((record) => record.id === id)) {
    kinds.push('counter-argument');
  }
  return kinds;
}

export function assembleArgumentBundle(
  library: ArgumentLibrary,
  descriptor: SnapshotDescriptor,
  request: ReadArgumentBundleRequest,
): AssembleArgumentBundleResult {
  const kinds = recordKinds(library, request.id);
  const kind = request.kind ?? (kinds.length === 1 ? kinds[0] : undefined);
  if (kind === undefined) {
    return kinds.length === 0
      ? { status: 'not-found', id: request.id }
      : { status: 'ambiguous-selector', id: request.id, kinds };
  }
  if (!kinds.includes(kind)) return { status: 'not-found', id: request.id };

  const maxRecords = request.maxRecords ?? 100;
  const maxDepth = request.maxDepth ?? 8;
  const topics = new Map(library.topics.map((record) => [record.id, record]));
  const contexts = new Map(
    library.contexts.map((record) => [record.id, record]),
  );
  const resolveContext = createContextResolver(library);
  const axioms = new Map(library.axioms.map((record) => [record.id, record]));
  const argumentsById = new Map(
    library.arguments.map((record) => [record.id, record]),
  );
  const evaluateArgumentStaleness = createArgumentStalenessEvaluator(library);
  const counters = new Map(
    library.counterArguments.map((record) => [record.id, record]),
  );
  const topicIds = new Set<string>();
  const contextIds = new Set<string>();
  const axiomIds = new Set<string>();
  const argumentIds = new Set<string>();
  const counterIds = new Set<string>();
  const warnings = new Set<string>();
  const omissions = new Set<string>();

  const addMembershipTopics = (
    recordKind: 'axiom' | 'argument' | 'counter-argument',
    id: string,
  ): void => {
    for (const topic of library.topics) {
      if (
        (recordKind === 'axiom' && topic.axiomIds.includes(id)) ||
        (recordKind === 'argument' && topic.argumentIds.includes(id)) ||
        (recordKind === 'counter-argument' &&
          topic.counterArgumentIds.includes(id))
      ) {
        topicIds.add(topic.id);
      }
    }
  };

  const visitingArguments = new Set<string>();
  const visitingCounters = new Set<string>();

  const addContext = (id: string, depth: number): void => {
    const context = contexts.get(id);
    if (context === undefined) return;
    contextIds.add(id);
    context.axiomIds.forEach((axiomId) => axiomIds.add(axiomId));
    if (context.parentContextId === undefined) return;
    if (depth >= maxDepth) {
      omissions.add(
        `Context parent chain beyond depth ${maxDepth} from ${id}.`,
      );
      return;
    }
    addContext(context.parentContextId, depth + 1);
  };

  const addArgument = (
    id: string,
    depth: number,
    includeSupersession: boolean,
    includeRelations = true,
  ): void => {
    const argument = argumentsById.get(id);
    if (argument === undefined) return;
    argumentIds.add(id);
    addMembershipTopics('argument', id);
    if (visitingArguments.has(id)) {
      warnings.add(`Argument dependency cycle detected at ${id}.`);
      return;
    }
    visitingArguments.add(id);
    argument.contextIds.forEach((contextId) => addContext(contextId, depth));
    for (const premise of argument.premises) {
      if (premise.kind === 'axiom') {
        axiomIds.add(premise.axiomId);
        addMembershipTopics('axiom', premise.axiomId);
      } else if (
        premise.kind === 'argument-conclusion' ||
        premise.kind === 'argument-premise'
      ) {
        if (depth >= maxDepth) {
          omissions.add(`Premise chain beyond depth ${maxDepth} from ${id}.`);
        } else {
          addArgument(premise.argumentId, depth + 1, false);
        }
      }
    }
    if (includeRelations) {
      for (const relation of argument.relations) {
        if (depth >= maxDepth) {
          omissions.add(`Relation target beyond depth ${maxDepth} from ${id}.`);
        } else {
          addArgument(relation.targetArgumentId, depth + 1, false, false);
        }
      }
    }
    if (includeSupersession) {
      const relatedIds = [
        ...(argument.supersedesArgumentId === undefined
          ? []
          : [argument.supersedesArgumentId]),
        ...library.arguments
          .filter(({ supersedesArgumentId }) => supersedesArgumentId === id)
          .map(({ id: successorId }) => successorId),
      ].sort();
      for (const relatedId of relatedIds) {
        if (depth >= maxDepth) {
          omissions.add(
            `Supersession chain beyond depth ${maxDepth} from ${id}.`,
          );
        } else {
          addArgument(relatedId, depth + 1, true);
        }
      }
    }
    visitingArguments.delete(id);
  };

  const addCounter = (id: string, depth: number): void => {
    const counter = counters.get(id);
    if (counter === undefined) return;
    counterIds.add(id);
    addMembershipTopics('counter-argument', id);
    for (const answer of counter.response.answeringAxioms) {
      axiomIds.add(answer.axiomId);
      addMembershipTopics('axiom', answer.axiomId);
    }
    const target = counter.target;
    if (target?.kind === 'topic-claim') {
      topicIds.add(target.topicId);
    } else if (target?.kind === 'axiom') {
      axiomIds.add(target.axiomId);
      addMembershipTopics('axiom', target.axiomId);
    } else if (target?.kind === 'argument') {
      if (depth >= maxDepth) {
        omissions.add(`Target chain beyond depth ${maxDepth} from ${id}.`);
      } else {
        addArgument(target.argumentId, depth + 1, false);
      }
    } else if (target?.kind === 'counter-argument') {
      if (visitingCounters.has(target.counterArgumentId)) {
        warnings.add(
          `Counter-Argument target cycle detected at ${target.counterArgumentId}.`,
        );
        return;
      }
      if (depth >= maxDepth) {
        omissions.add(`Target chain beyond depth ${maxDepth} from ${id}.`);
        return;
      }
      visitingCounters.add(id);
      addCounter(target.counterArgumentId, depth + 1);
      visitingCounters.delete(id);
    }
  };

  const addDirectArgumentCounters = (argumentId: string): void => {
    for (const counter of library.counterArguments) {
      if (
        counter.target?.kind === 'argument' &&
        counter.target.argumentId === argumentId
      ) {
        addCounter(counter.id, 0);
      }
    }
  };

  if (kind === 'topic') {
    const topic = topics.get(request.id)!;
    topicIds.add(topic.id);
    topic.axiomIds.forEach((id) => axiomIds.add(id));
    topic.counterArgumentIds.forEach((id) => addCounter(id, 0));
    if (topic.currentArgumentId !== undefined) {
      addArgument(topic.currentArgumentId, 0, false);
      addDirectArgumentCounters(topic.currentArgumentId);
    }
  } else if (kind === 'context') {
    addContext(request.id, 0);
  } else if (kind === 'axiom') {
    axiomIds.add(request.id);
    addMembershipTopics('axiom', request.id);
    for (const counter of library.counterArguments) {
      if (
        (counter.target?.kind === 'axiom' &&
          counter.target.axiomId === request.id) ||
        counter.response.answeringAxioms.some(
          ({ axiomId }) => axiomId === request.id,
        )
      ) {
        addCounter(counter.id, 0);
      }
    }
  } else if (kind === 'argument') {
    addArgument(request.id, 0, true);
    addDirectArgumentCounters(request.id);
  } else {
    addCounter(request.id, 0);
  }

  const returnedRecords = [
    ...[...topicIds].map((id) => ({
      kind: 'topic' as const,
      record: topics.get(id)!,
    })),
    ...[...contextIds].map((id) => ({
      kind: 'context' as const,
      record: contexts.get(id)!,
    })),
    ...[...axiomIds].map((id) => ({
      kind: 'axiom' as const,
      record: axioms.get(id)!,
    })),
    ...[...argumentIds].map((id) => ({
      kind: 'argument' as const,
      record: argumentsById.get(id)!,
    })),
    ...[...counterIds].map((id) => ({
      kind: 'counter-argument' as const,
      record: counters.get(id)!,
    })),
  ]
    .sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.record.id.localeCompare(right.record.id),
    )
    .map(({ kind: recordKind, record }) => ({
      kind: recordKind,
      id: record.id,
      revision: record.revision,
    }));
  if (returnedRecords.length > maxRecords || omissions.size > 0) {
    const overflow = returnedRecords
      .slice(maxRecords)
      .map(
        ({ kind: recordKind, id }) =>
          `Record limit omitted ${recordKind}:${id}.`,
      );
    return {
      status: 'limit-exceeded',
      requiredRecordIds: returnedRecords.map(({ id }) => id),
      omissions: [...omissions, ...overflow].sort(),
      returnedRecords: [],
    };
  }

  const bundleTopics = [...topicIds]
    .map((id) => topics.get(id)!)
    .sort((left, right) => left.id.localeCompare(right.id));
  const bundleContexts = [...contextIds]
    .map((id) => {
      const resolved = resolveContext(id);
      return {
        ...resolved.context,
        parentContextIds: resolved.parentContextIds,
        inheritedAxiomIds: resolved.inheritedAxiomIds,
        effectiveAxiomIds: resolved.effectiveAxiomIds,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const bundleAxioms = [...axiomIds]
    .map((id) => {
      const axiom = axioms.get(id)!;
      const linkedCounterArgumentIds = library.counterArguments
        .filter(
          (counter) =>
            (counter.target?.kind === 'axiom' &&
              counter.target.axiomId === id) ||
            counter.response.answeringAxioms.some(
              ({ axiomId }) => axiomId === id,
            ),
        )
        .map(({ id: counterId }) => counterId)
        .sort();
      return { ...axiom, linkedCounterArgumentIds };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const bundleArguments = [...argumentIds]
    .map((id) => {
      const argument = argumentsById.get(id)!;
      const stale = evaluateArgumentStaleness(argument);
      const membershipTopics = library.topics
        .filter(({ argumentIds: memberIds }) => memberIds.includes(id))
        .map(({ id: topicId }) => topicId)
        .sort();
      const currentTopicIds = library.topics
        .filter(({ currentArgumentId }) => currentArgumentId === id)
        .map(({ id: topicId }) => topicId)
        .sort();
      const supersededByArgumentIds = library.arguments
        .filter(({ supersedesArgumentId }) => supersedesArgumentId === id)
        .map(({ id: successorId }) => successorId)
        .sort();
      const targetingCounterArgumentIds = library.counterArguments
        .filter(
          ({ target }) =>
            target?.kind === 'argument' && target.argumentId === id,
        )
        .map(({ id: counterId }) => counterId)
        .sort();
      const incomingRelationIds = library.arguments
        .flatMap((source) =>
          source.relations
            .filter(({ targetArgumentId }) => targetArgumentId === id)
            .map((relation) => `${source.id}:${relation.id}`),
        )
        .sort();
      const resolvedPremises = argument.premises.map((premise) => {
        const referenced =
          premise.kind === 'axiom'
            ? axioms.get(premise.axiomId)
            : premise.kind === 'argument-conclusion' ||
                premise.kind === 'argument-premise'
              ? argumentsById.get(premise.argumentId)
              : undefined;
        const referencedPremise =
          premise.kind === 'argument-premise'
            ? argumentsById
                .get(premise.argumentId)
                ?.premises.find(
                  ({ id: premiseId }) => premiseId === premise.premiseId,
                )
            : undefined;
        return {
          premiseId: premise.id,
          kind: premise.kind,
          ...(referenced === undefined
            ? {}
            : {
                referencedRecord: {
                  kind:
                    premise.kind === 'axiom'
                      ? ('axiom' as const)
                      : ('argument' as const),
                  id: referenced.id,
                  revision: referenced.revision,
                  title: referenced.title,
                  archived: referenced.archived,
                },
              }),
          ...(referencedPremise === undefined ? {} : { referencedPremise }),
        };
      });
      const resolvedRelations = argument.relations.map((relation) => {
        const target = argumentsById.get(relation.targetArgumentId)!;
        return {
          relationId: relation.id,
          kind: relation.kind,
          stale: relation.reliedOnRevision !== target.revision,
          targetArgument: {
            id: target.id,
            revision: target.revision,
            title: target.title,
            archived: target.archived,
          },
          targetPart: relation.targetPart,
        };
      });
      const background = resolveArgumentBackground(
        library,
        argument.contextIds,
      );
      const resolvedContexts = background.contexts.map((resolved) => ({
        contextId: resolved.context.id,
        parentContextIds: resolved.parentContextIds,
        directAxiomIds: resolved.context.axiomIds,
        effectiveAxiomIds: resolved.effectiveAxiomIds,
      }));
      const backgroundAxioms = background.axioms.map(
        ({ axiomId, viaContextIds }) => {
          const axiom = axioms.get(axiomId)!;
          return {
            axiomId,
            revision: axiom.revision,
            title: axiom.title,
            archived: axiom.archived,
            viaContextIds,
          };
        },
      );
      return {
        ...argument,
        argumentStale: stale.stale,
        stalePremiseIds: stale.premiseIds,
        staleRelationIds: stale.relationIds,
        premiseStaleness: stale.premiseStaleness,
        topicIds: membershipTopics,
        currentTopicIds,
        supersededByArgumentIds,
        targetingCounterArgumentIds,
        incomingRelationIds,
        resolvedContexts,
        backgroundAxioms,
        resolvedPremises,
        resolvedRelations,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const bundleCounters = [...counterIds]
    .map((id) => {
      const counter = counters.get(id)!;
      const stale = responseStaleness(library, counter);
      return {
        ...counter,
        responseStale: stale.stale,
        staleAxiomIds: stale.axiomIds,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const record of [
    ...bundleTopics,
    ...bundleContexts,
    ...bundleAxioms,
    ...bundleArguments,
    ...bundleCounters,
  ]) {
    if (record.archived) warnings.add(`${record.id} is archived.`);
    if (record.reviewState !== 'accepted') {
      warnings.add(`${record.id} human review state is ${record.reviewState}.`);
    }
  }
  for (const argument of bundleArguments) {
    if (argument.argumentStale) {
      if (argument.stalePremiseIds.length > 0) {
        const directIds = argument.premiseStaleness
          .filter(({ direct }) => direct)
          .map(({ premiseId }) => premiseId);
        const inheritedIds = argument.premiseStaleness
          .filter(({ inherited }) => inherited)
          .map(({ premiseId }) => premiseId);
        if (directIds.length > 0) {
          warnings.add(
            `${argument.id} has direct premise revision mismatches: ${directIds.join(', ')}.`,
          );
        }
        if (inheritedIds.length > 0) {
          warnings.add(
            `${argument.id} inherits stale inference support: ${inheritedIds.join(', ')}.`,
          );
        }
      }
      if (argument.staleRelationIds.length > 0) {
        warnings.add(
          `${argument.id} relations target older revisions: ${argument.staleRelationIds.join(', ')}.`,
        );
      }
    }
  }
  for (const counter of bundleCounters) {
    if (counter.responseStale) {
      warnings.add(
        `${counter.id} response relies on older revisions of: ${counter.staleAxiomIds.join(', ')}.`,
      );
    }
  }
  return {
    status: 'ok',
    value: clonePlainData({
      selector: { kind, id: request.id },
      topics: bundleTopics,
      contexts: bundleContexts,
      axioms: bundleAxioms,
      arguments: bundleArguments,
      counterArguments: bundleCounters,
      completeness: {
        status: 'complete',
        libraryContext: 'bounded-closure',
        theorySources: 'not-read',
        warnings: [...warnings].sort(),
      },
      snapshot: descriptor,
    }),
    returnedRecords,
  };
}
