import { clonePlainData } from './canonical';
import { responseStaleness } from './library';
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
  if (library.axioms.some((record) => record.id === id)) kinds.push('axiom');
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
  const axioms = new Map(library.axioms.map((record) => [record.id, record]));
  const counters = new Map(
    library.counterArguments.map((record) => [record.id, record]),
  );
  const topicIds = new Set<string>();
  const axiomIds = new Set<string>();
  const counterIds = new Set<string>();
  const warnings = new Set<string>();
  const omissions = new Set<string>();

  const addMembershipTopics = (
    recordKind: 'axiom' | 'counter-argument',
    id: string,
  ) => {
    for (const topic of library.topics) {
      if (
        (recordKind === 'axiom' && topic.axiomIds.includes(id)) ||
        (recordKind === 'counter-argument' &&
          topic.counterArgumentIds.includes(id))
      ) {
        topicIds.add(topic.id);
      }
    }
  };

  const visiting = new Set<string>();
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
    } else if (target?.kind === 'counter-argument') {
      if (visiting.has(target.counterArgumentId)) {
        warnings.add(
          `Counter-Argument target cycle detected at ${target.counterArgumentId}.`,
        );
        return;
      }
      if (depth >= maxDepth) {
        omissions.add(`Target chain beyond depth ${maxDepth} from ${id}.`);
        return;
      }
      visiting.add(id);
      addCounter(target.counterArgumentId, depth + 1);
      visiting.delete(id);
    }
  };

  if (kind === 'topic') {
    const topic = topics.get(request.id)!;
    topicIds.add(topic.id);
    topic.axiomIds.forEach((id) => axiomIds.add(id));
    topic.counterArgumentIds.forEach((id) => addCounter(id, 0));
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
  } else {
    addCounter(request.id, 0);
  }

  const returnedRecords = [
    ...[...topicIds].map((id) => ({
      kind: 'topic' as const,
      record: topics.get(id)!,
    })),
    ...[...axiomIds].map((id) => ({
      kind: 'axiom' as const,
      record: axioms.get(id)!,
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
  for (const record of [...bundleTopics, ...bundleAxioms, ...bundleCounters]) {
    if (record.archived) warnings.add(`${record.id} is archived.`);
    if (record.reviewState !== 'accepted') {
      warnings.add(`${record.id} human review state is ${record.reviewState}.`);
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
      axioms: bundleAxioms,
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
