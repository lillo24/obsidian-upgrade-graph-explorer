import { clonePlainData } from './canonical';
import {
  type AnsweringAxiomReference,
  type Argument,
  type ArgumentAxiom,
  type ArgumentCounterArgument,
  type ArgumentLibrary,
  type ArgumentLibrarySnapshot,
  type ArgumentLibraryValidationIssue,
  type ArgumentPremise,
  type ArgumentRelation,
  type ArgumentRuntime,
  type ArgumentTopic,
  type CreateArgumentInput,
  type CreateAxiomInput,
  type CreateCounterArgumentInput,
  type CreateTopicInput,
  type SnapshotDescriptor,
  type TopicMembershipKind,
} from './types';
import { validateArgumentLibrary } from './validation';

export const ARGUMENT_WORKSPACE_INSERT_FORMAT =
  'argument-workspace-insert-v1' as const;

type PlainRecord = Record<string, unknown>;

export type InsertArgumentPremise =
  | Extract<ArgumentPremise, { readonly kind: 'text' }>
  | (Omit<
      Exclude<ArgumentPremise, { readonly kind: 'text' }>,
      'reliedOnRevision'
    > & { readonly reliedOnRevision?: number });

export type InsertArgumentRelation = Omit<
  ArgumentRelation,
  'reliedOnRevision'
> & { readonly reliedOnRevision?: number };

export type InsertAnsweringAxiomReference = Omit<
  AnsweringAxiomReference,
  'reliedOnRevision'
> & { readonly reliedOnRevision?: number };

export interface ArgumentWorkspaceInsertTopic extends Omit<
  CreateTopicInput,
  'id'
> {
  readonly id: string;
}

export interface ArgumentWorkspaceInsertAxiom extends Omit<
  CreateAxiomInput,
  'id'
> {
  readonly id: string;
}

export interface ArgumentWorkspaceInsertArgument extends Omit<
  CreateArgumentInput,
  'id' | 'premises' | 'relations'
> {
  readonly id: string;
  readonly premises: readonly InsertArgumentPremise[];
  readonly relations?: readonly InsertArgumentRelation[];
}

export interface ArgumentWorkspaceInsertCounterArgument extends Omit<
  CreateCounterArgumentInput,
  'id' | 'response'
> {
  readonly id: string;
  readonly response?: Omit<
    NonNullable<CreateCounterArgumentInput['response']>,
    'answeringAxioms'
  > & {
    readonly answeringAxioms?: readonly InsertAnsweringAxiomReference[];
  };
}

export interface ArgumentWorkspaceInsertMembership {
  readonly topicId: string;
  readonly kind: TopicMembershipKind;
  readonly recordId: string;
  /** V1 is additive. Omitted and true both mean add. */
  readonly present?: true;
}

export interface ArgumentWorkspaceInsertPromotion {
  readonly topicId: string;
  readonly argumentId: string;
}

export interface ArgumentWorkspaceInsertDocument {
  readonly format: typeof ARGUMENT_WORKSPACE_INSERT_FORMAT;
  readonly topics?: readonly ArgumentWorkspaceInsertTopic[];
  readonly axioms?: readonly ArgumentWorkspaceInsertAxiom[];
  readonly arguments?: readonly ArgumentWorkspaceInsertArgument[];
  readonly counterArguments?: readonly ArgumentWorkspaceInsertCounterArgument[];
  readonly memberships?: readonly ArgumentWorkspaceInsertMembership[];
  readonly currentPromotions?: readonly ArgumentWorkspaceInsertPromotion[];
}

export interface ArgumentWorkspaceInsertResolvedPin {
  readonly path: string;
  readonly targetKind: 'axiom' | 'argument';
  readonly targetId: string;
  readonly revision: number;
  readonly suppliedExplicitly: boolean;
}

export interface ArgumentWorkspaceInsertRecordPreview {
  readonly kind: 'topic' | 'axiom' | 'argument' | 'counter-argument';
  readonly id: string;
  readonly title: string;
}

export interface ArgumentWorkspaceInsertPreview {
  readonly format: typeof ARGUMENT_WORKSPACE_INSERT_FORMAT;
  readonly counts: {
    readonly topics: number;
    readonly axioms: number;
    readonly arguments: number;
    readonly counterArguments: number;
  };
  readonly records: readonly ArgumentWorkspaceInsertRecordPreview[];
  readonly memberships: readonly (ArgumentWorkspaceInsertMembership & {
    readonly alreadyPresent: boolean;
  })[];
  readonly currentPromotions: readonly ArgumentWorkspaceInsertPromotion[];
  readonly supersessions: readonly {
    readonly argumentId: string;
    readonly supersedesArgumentId: string;
  }[];
  readonly relations: readonly {
    readonly argumentId: string;
    readonly relation: ArgumentRelation;
  }[];
  readonly referencedExistingRecords: readonly {
    readonly kind: 'topic' | 'axiom' | 'argument' | 'counter-argument';
    readonly id: string;
  }[];
  readonly resolvedPins: readonly ArgumentWorkspaceInsertResolvedPin[];
  readonly warnings: readonly string[];
}

export interface ArgumentWorkspaceInsertPlan {
  readonly base: SnapshotDescriptor;
  readonly candidate: ArgumentLibrary;
  readonly preview: ArgumentWorkspaceInsertPreview;
}

export type ArgumentWorkspaceInsertParseResult =
  | { readonly status: 'valid'; readonly plan: ArgumentWorkspaceInsertPlan }
  | {
      readonly status: 'invalid';
      readonly message: string;
      readonly issues: readonly ArgumentLibraryValidationIssue[];
    };

const ROOT_FIELDS = [
  'format',
  'topics',
  'axioms',
  'arguments',
  'counterArguments',
  'memberships',
  'currentPromotions',
] as const;
const TOPIC_FIELDS = [
  'id',
  'title',
  'summary',
  'retrieval',
  'reviewState',
] as const;
const AXIOM_FIELDS = [
  'id',
  'title',
  'statement',
  'explanation',
  'scope',
  'supportingReasoning',
  'retrieval',
  'sourceReferences',
  'reviewState',
] as const;
const ARGUMENT_FIELDS = [
  'id',
  'title',
  'examples',
  'premises',
  'reasoning',
  'conclusion',
  'boundary',
  'relations',
  'retrieval',
  'sourceReferences',
  'supersedesArgumentId',
  'reviewState',
] as const;
const COUNTER_ARGUMENT_FIELDS = [
  'id',
  'title',
  'observation',
  'challengedClaim',
  'target',
  'retrieval',
  'sourceReferences',
  'response',
  'reviewState',
] as const;
const MEMBERSHIP_FIELDS = ['topicId', 'kind', 'recordId', 'present'] as const;
const PROMOTION_FIELDS = ['topicId', 'argumentId'] as const;

function isRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addIssue(
  issues: ArgumentLibraryValidationIssue[],
  path: string,
  code: ArgumentLibraryValidationIssue['code'],
  message: string,
): void {
  issues.push({ path, code, message });
}

function checkFields(
  value: PlainRecord,
  allowed: readonly string[],
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  const accepted = new Set(allowed);
  for (const field of Object.keys(value)) {
    if (!accepted.has(field)) {
      addIssue(issues, `${path}.${field}`, 'unknown-field', 'Unknown field.');
    }
  }
}

function nonEmptyString(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): value is string {
  if (typeof value === 'string' && value.trim() !== '') return true;
  addIssue(issues, path, 'invalid-type', 'Expected a non-empty string.');
  return false;
}

function arrayField(
  root: PlainRecord,
  field: string,
  issues: ArgumentLibraryValidationIssue[],
): readonly unknown[] {
  const value = root[field];
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  addIssue(issues, `$.${field}`, 'invalid-type', 'Expected an array.');
  return [];
}

function recordArray(
  values: readonly unknown[],
  path: string,
  allowed: readonly string[],
  issues: ArgumentLibraryValidationIssue[],
): PlainRecord[] {
  return values.flatMap((value, index) => {
    if (!isRecord(value)) {
      addIssue(
        issues,
        `${path}[${index}]`,
        'invalid-type',
        'Expected an object.',
      );
      return [];
    }
    checkFields(value, allowed, `${path}[${index}]`, issues);
    return [value];
  });
}

function runtimeTimestamp(
  runtime: ArgumentRuntime,
  issues: ArgumentLibraryValidationIssue[],
): string | undefined {
  const now = runtime.now();
  if (now.trim() !== '' && Number.isFinite(Date.parse(now))) return now;
  addIssue(
    issues,
    '$',
    'invalid-value',
    'Argument Workspace clock returned an invalid timestamp.',
  );
  return undefined;
}

function normalizeRetrieval(value: unknown): unknown {
  if (value === undefined) return { aliases: [], keywords: [], phrases: [] };
  if (!isRecord(value)) return value;
  const normalize = (items: unknown): unknown =>
    Array.isArray(items)
      ? [...new Set(items)].sort((left, right) =>
          String(left).localeCompare(String(right)),
        )
      : items;
  return {
    ...value,
    aliases: normalize(value.aliases ?? []),
    keywords: normalize(value.keywords ?? []),
    phrases: normalize(value.phrases ?? []),
  };
}

function newMetadata(input: PlainRecord, now: string): PlainRecord {
  return {
    ...input,
    revision: 1,
    reviewState: input.reviewState ?? 'draft',
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
}

function buildTopic(input: PlainRecord, now: string): PlainRecord {
  return {
    ...newMetadata(input, now),
    retrieval: normalizeRetrieval(input.retrieval),
    axiomIds: [],
    argumentIds: [],
    counterArgumentIds: [],
  };
}

function buildAxiom(input: PlainRecord, now: string): PlainRecord {
  return {
    ...newMetadata(input, now),
    retrieval: normalizeRetrieval(input.retrieval),
    sourceReferences: input.sourceReferences ?? [],
  };
}

function buildArgument(input: PlainRecord, now: string): PlainRecord {
  return {
    ...newMetadata(input, now),
    examples: input.examples ?? [],
    relations: input.relations ?? [],
    retrieval: normalizeRetrieval(input.retrieval),
    sourceReferences: input.sourceReferences ?? [],
  };
}

function buildCounterArgument(input: PlainRecord, now: string): PlainRecord {
  const response = input.response;
  const normalizedResponse = isRecord(response)
    ? {
        ...response,
        answeringAxioms: response.answeringAxioms ?? [],
        explanation: response.explanation ?? '',
        outcome: response.outcome ?? 'unanswered',
      }
    : response === undefined
      ? { answeringAxioms: [], explanation: '', outcome: 'unanswered' }
      : response;
  return {
    ...newMetadata(input, now),
    retrieval: normalizeRetrieval(input.retrieval),
    sourceReferences: input.sourceReferences ?? [],
    response: normalizedResponse,
  };
}

function sortRecords<T extends { readonly id: string }>(
  values: readonly T[],
): readonly T[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}

function invalid(
  issues: readonly ArgumentLibraryValidationIssue[],
): ArgumentWorkspaceInsertParseResult {
  const first = issues[0];
  return {
    status: 'invalid',
    message:
      first === undefined
        ? 'Insert JSON is invalid.'
        : `${first.path}: ${first.message}`,
    issues,
  };
}

function normalizePin(
  owner: PlainRecord,
  field: 'premises' | 'relations',
  path: string,
  axiomRevisions: ReadonlyMap<string, number>,
  argumentRevisions: ReadonlyMap<string, number>,
  issues: ArgumentLibraryValidationIssue[],
  pins: ArgumentWorkspaceInsertResolvedPin[],
): void {
  const values = owner[field];
  if (!Array.isArray(values)) return;
  owner[field] = values.map((entry, index) => {
    if (!isRecord(entry)) return entry;
    let targetKind: 'axiom' | 'argument' | undefined;
    let targetId: unknown;
    if (field === 'premises' && entry.kind === 'axiom') {
      targetKind = 'axiom';
      targetId = entry.axiomId;
    } else if (
      field === 'relations' ||
      entry.kind === 'argument-conclusion' ||
      entry.kind === 'argument-premise'
    ) {
      targetKind = 'argument';
      targetId =
        field === 'relations' ? entry.targetArgumentId : entry.argumentId;
    }
    if (targetKind === undefined || typeof targetId !== 'string') return entry;
    const revision =
      targetKind === 'axiom'
        ? axiomRevisions.get(targetId)
        : argumentRevisions.get(targetId);
    if (revision === undefined) return entry;
    const pinPath = `${path}.${field}[${index}].reliedOnRevision`;
    const suppliedExplicitly = Object.hasOwn(entry, 'reliedOnRevision');
    if (
      suppliedExplicitly &&
      (!Number.isSafeInteger(entry.reliedOnRevision) ||
        entry.reliedOnRevision !== revision)
    ) {
      addIssue(
        issues,
        pinPath,
        'invalid-value',
        `Explicit revision pin must equal ${targetKind} "${targetId}" revision ${revision}.`,
      );
    }
    pins.push({
      path: pinPath,
      targetKind,
      targetId,
      revision,
      suppliedExplicitly,
    });
    return { ...entry, reliedOnRevision: revision };
  });
}

function normalizeAnsweringAxiomPins(
  counter: PlainRecord,
  path: string,
  axiomRevisions: ReadonlyMap<string, number>,
  issues: ArgumentLibraryValidationIssue[],
  pins: ArgumentWorkspaceInsertResolvedPin[],
): void {
  if (!isRecord(counter.response)) return;
  const answers = counter.response.answeringAxioms;
  if (!Array.isArray(answers)) return;
  counter.response = {
    ...counter.response,
    answeringAxioms: answers.map((entry, index) => {
      if (!isRecord(entry) || typeof entry.axiomId !== 'string') return entry;
      const revision = axiomRevisions.get(entry.axiomId);
      if (revision === undefined) return entry;
      const pinPath = `${path}.response.answeringAxioms[${index}].reliedOnRevision`;
      const suppliedExplicitly = Object.hasOwn(entry, 'reliedOnRevision');
      if (
        suppliedExplicitly &&
        (!Number.isSafeInteger(entry.reliedOnRevision) ||
          entry.reliedOnRevision !== revision)
      ) {
        addIssue(
          issues,
          pinPath,
          'invalid-value',
          `Explicit revision pin must equal axiom "${entry.axiomId}" revision ${revision}.`,
        );
      }
      pins.push({
        path: pinPath,
        targetKind: 'axiom',
        targetId: entry.axiomId,
        revision,
        suppliedExplicitly,
      });
      return { ...entry, reliedOnRevision: revision };
    }),
  };
}

function addExistingReference(
  output: Map<
    string,
    ArgumentWorkspaceInsertPreview['referencedExistingRecords'][number]
  >,
  existing: ReadonlySet<string>,
  kind: ArgumentWorkspaceInsertPreview['referencedExistingRecords'][number]['kind'],
  id: unknown,
): void {
  if (typeof id === 'string' && existing.has(`${kind}:${id}`)) {
    output.set(`${kind}:${id}`, { kind, id });
  }
}

/**
 * Parses and plans one additive authoring transaction against an immutable
 * snapshot. The returned candidate is complete and can be persisted as-is.
 */
export function previewArgumentWorkspaceInsert(
  snapshot: ArgumentLibrarySnapshot,
  source: string,
  runtime: ArgumentRuntime,
): ArgumentWorkspaceInsertParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch (error: unknown) {
    return invalid([
      {
        path: '$',
        code: 'invalid-value',
        message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      },
    ]);
  }
  const issues: ArgumentLibraryValidationIssue[] = [];
  if (!isRecord(parsed)) {
    return invalid([
      { path: '$', code: 'invalid-type', message: 'Expected an object.' },
    ]);
  }
  checkFields(parsed, ROOT_FIELDS, '$', issues);
  if (parsed.format !== ARGUMENT_WORKSPACE_INSERT_FORMAT) {
    addIssue(
      issues,
      '$.format',
      'invalid-value',
      `Expected "${ARGUMENT_WORKSPACE_INSERT_FORMAT}".`,
    );
  }

  const topics = recordArray(
    arrayField(parsed, 'topics', issues),
    '$.topics',
    TOPIC_FIELDS,
    issues,
  );
  const axioms = recordArray(
    arrayField(parsed, 'axioms', issues),
    '$.axioms',
    AXIOM_FIELDS,
    issues,
  );
  const argumentsInput = recordArray(
    arrayField(parsed, 'arguments', issues),
    '$.arguments',
    ARGUMENT_FIELDS,
    issues,
  );
  const counterArguments = recordArray(
    arrayField(parsed, 'counterArguments', issues),
    '$.counterArguments',
    COUNTER_ARGUMENT_FIELDS,
    issues,
  );
  const memberships = recordArray(
    arrayField(parsed, 'memberships', issues),
    '$.memberships',
    MEMBERSHIP_FIELDS,
    issues,
  );
  const promotions = recordArray(
    arrayField(parsed, 'currentPromotions', issues),
    '$.currentPromotions',
    PROMOTION_FIELDS,
    issues,
  );
  if (
    topics.length +
      axioms.length +
      argumentsInput.length +
      counterArguments.length +
      memberships.length +
      promotions.length ===
    0
  ) {
    addIssue(
      issues,
      '$',
      'invalid-value',
      'Insert JSON must contain at least one record or operation.',
    );
  }

  const existingKeys = new Set<string>();
  for (const [kind, records] of [
    ['topic', snapshot.library.topics],
    ['axiom', snapshot.library.axioms],
    ['argument', snapshot.library.arguments],
    ['counter-argument', snapshot.library.counterArguments],
  ] as const) {
    for (const record of records) existingKeys.add(`${kind}:${record.id}`);
  }
  const allExistingIds = new Set(
    [
      ...snapshot.library.topics,
      ...snapshot.library.axioms,
      ...snapshot.library.arguments,
      ...snapshot.library.counterArguments,
    ].map(({ id }) => id),
  );
  const payloadIds = new Set<string>();
  for (const [path, records] of [
    ['$.topics', topics],
    ['$.axioms', axioms],
    ['$.arguments', argumentsInput],
    ['$.counterArguments', counterArguments],
  ] as const) {
    records.forEach((record, index) => {
      if (!nonEmptyString(record.id, `${path}[${index}].id`, issues)) return;
      if (payloadIds.has(record.id)) {
        addIssue(
          issues,
          `${path}[${index}].id`,
          'duplicate-id',
          `Record ID "${record.id}" is duplicated in the insert payload.`,
        );
      } else if (allExistingIds.has(record.id)) {
        addIssue(
          issues,
          `${path}[${index}].id`,
          'duplicate-id',
          `Record ID "${record.id}" already exists in the library.`,
        );
      }
      payloadIds.add(record.id);
    });
  }

  const membershipKeys = new Set<string>();
  memberships.forEach((entry, index) => {
    const path = `$.memberships[${index}]`;
    const topicValid = nonEmptyString(entry.topicId, `${path}.topicId`, issues);
    const recordValid = nonEmptyString(
      entry.recordId,
      `${path}.recordId`,
      issues,
    );
    if (
      !['axiom', 'argument', 'counter-argument'].includes(String(entry.kind))
    ) {
      addIssue(
        issues,
        `${path}.kind`,
        'invalid-value',
        'Expected axiom, argument, or counter-argument.',
      );
    }
    if (Object.hasOwn(entry, 'present') && entry.present !== true) {
      addIssue(
        issues,
        `${path}.present`,
        'invalid-value',
        'Insert v1 supports additive membership only; present must be true.',
      );
    }
    if (topicValid && recordValid && typeof entry.kind === 'string') {
      const key = `${entry.topicId}:${entry.kind}:${entry.recordId}`;
      if (membershipKeys.has(key)) {
        addIssue(
          issues,
          path,
          'duplicate-id',
          'Duplicate membership operation.',
        );
      }
      membershipKeys.add(key);
    }
  });
  const promotionTopicIds = new Set<string>();
  promotions.forEach((entry, index) => {
    const path = `$.currentPromotions[${index}]`;
    const topicValid = nonEmptyString(entry.topicId, `${path}.topicId`, issues);
    nonEmptyString(entry.argumentId, `${path}.argumentId`, issues);
    const topicId = typeof entry.topicId === 'string' ? entry.topicId : '';
    if (topicValid && promotionTopicIds.has(topicId)) {
      addIssue(
        issues,
        path,
        'duplicate-id',
        'A Topic may have only one Current promotion per insert payload.',
      );
    }
    if (topicValid) promotionTopicIds.add(topicId);
  });
  if (issues.length > 0) return invalid(issues);

  const now = runtimeTimestamp(runtime, issues);
  if (now === undefined) return invalid(issues);
  const newTopics = topics.map((input) => buildTopic(input, now));
  const newAxioms = axioms.map((input) => buildAxiom(input, now));
  const newArguments = argumentsInput.map((input) => buildArgument(input, now));
  const newCounterArguments = counterArguments.map((input) =>
    buildCounterArgument(input, now),
  );
  const topicRecords = [
    ...snapshot.library.topics.map((record) => ({ ...record })),
    ...newTopics,
  ];
  const axiomRecords = [
    ...snapshot.library.axioms.map((record) => ({ ...record })),
    ...newAxioms,
  ];
  const argumentRecords = [
    ...snapshot.library.arguments.map((record) => ({ ...record })),
    ...newArguments,
  ];
  const counterRecords = [
    ...snapshot.library.counterArguments.map((record) => ({ ...record })),
    ...newCounterArguments,
  ];
  const topicById = new Map(topicRecords.map((record) => [record.id, record]));
  const axiomById = new Map(axiomRecords.map((record) => [record.id, record]));
  const argumentById = new Map(
    argumentRecords.map((record) => [record.id, record]),
  );
  const counterById = new Map(
    counterRecords.map((record) => [record.id, record]),
  );
  const newTopicIds = new Set(newTopics.map(({ id }) => String(id)));
  const newArgumentIds = new Set(newArguments.map(({ id }) => String(id)));
  const bumpedTopics = new Set<string>();
  const bumpedArguments = new Set<string>();
  const warnings: string[] = [];
  const membershipPreview: (ArgumentWorkspaceInsertMembership & {
    readonly alreadyPresent: boolean;
  })[] = [];

  const bumpExisting = (
    record: PlainRecord,
    newIds: ReadonlySet<string>,
    bumped: Set<string>,
  ): void => {
    const id = String(record.id);
    if (newIds.has(id) || bumped.has(id)) return;
    record.revision = Number(record.revision) + 1;
    record.updatedAt = now;
    bumped.add(id);
  };

  memberships.forEach((entry, index) => {
    const path = `$.memberships[${index}]`;
    const topic = topicById.get(String(entry.topicId));
    if (topic === undefined) {
      addIssue(
        issues,
        `${path}.topicId`,
        'missing-reference',
        `Unknown Topic "${String(entry.topicId)}".`,
      );
      return;
    }
    const kind = entry.kind as TopicMembershipKind;
    const collection =
      kind === 'axiom'
        ? axiomById
        : kind === 'argument'
          ? argumentById
          : counterById;
    if (!collection.has(String(entry.recordId))) {
      addIssue(
        issues,
        `${path}.recordId`,
        'missing-reference',
        `Unknown ${kind} "${String(entry.recordId)}".`,
      );
      return;
    }
    const field =
      kind === 'axiom'
        ? 'axiomIds'
        : kind === 'argument'
          ? 'argumentIds'
          : 'counterArgumentIds';
    const values = Array.isArray(topic[field])
      ? (topic[field] as unknown[])
      : [];
    const alreadyPresent = values.includes(entry.recordId);
    membershipPreview.push({
      topicId: String(entry.topicId),
      kind,
      recordId: String(entry.recordId),
      ...(Object.hasOwn(entry, 'present') ? { present: true as const } : {}),
      alreadyPresent,
    });
    if (alreadyPresent) {
      warnings.push(
        `Membership ${String(entry.topicId)} → ${kind}:${String(entry.recordId)} already exists.`,
      );
      return;
    }
    topic[field] = [...values, entry.recordId].sort((left, right) =>
      String(left).localeCompare(String(right)),
    );
    bumpExisting(topic, newTopicIds, bumpedTopics);
  });

  promotions.forEach((entry, index) => {
    const path = `$.currentPromotions[${index}]`;
    const topic = topicById.get(String(entry.topicId));
    const argument = argumentById.get(String(entry.argumentId));
    if (topic === undefined) {
      addIssue(
        issues,
        `${path}.topicId`,
        'missing-reference',
        `Unknown Topic "${String(entry.topicId)}".`,
      );
      return;
    }
    if (argument === undefined) {
      addIssue(
        issues,
        `${path}.argumentId`,
        'missing-reference',
        `Unknown Argument "${String(entry.argumentId)}".`,
      );
      return;
    }
    if (
      !Array.isArray(topic.argumentIds) ||
      !topic.argumentIds.includes(entry.argumentId)
    ) {
      addIssue(
        issues,
        path,
        'invalid-value',
        `Argument "${String(entry.argumentId)}" must belong to Topic "${String(entry.topicId)}" before promotion.`,
      );
      return;
    }
    if (argument.archived === true || argument.reviewState !== 'accepted') {
      addIssue(
        issues,
        `${path}.argumentId`,
        'invalid-value',
        'Only a non-archived accepted Argument can be promoted to Current.',
      );
      return;
    }
    const previousCurrentId = topic.currentArgumentId;
    if (previousCurrentId === entry.argumentId) {
      warnings.push(
        `Argument "${String(entry.argumentId)}" is already Current for Topic "${String(entry.topicId)}".`,
      );
      return;
    }
    if (
      typeof previousCurrentId === 'string' &&
      argument.supersedesArgumentId !== undefined &&
      argument.supersedesArgumentId !== previousCurrentId
    ) {
      addIssue(
        issues,
        `${path}.argumentId`,
        'invalid-value',
        `Argument "${String(entry.argumentId)}" already supersedes a different predecessor.`,
      );
      return;
    }
    if (
      typeof previousCurrentId === 'string' &&
      argument.supersedesArgumentId === undefined
    ) {
      argument.supersedesArgumentId = previousCurrentId;
      bumpExisting(argument, newArgumentIds, bumpedArguments);
    }
    topic.currentArgumentId = String(entry.argumentId);
    bumpExisting(topic, newTopicIds, bumpedTopics);
  });
  if (issues.length > 0) return invalid(issues);

  const axiomRevisions = new Map(
    axiomRecords.flatMap((record) =>
      typeof record.id === 'string' && typeof record.revision === 'number'
        ? [[record.id, record.revision] as const]
        : [],
    ),
  );
  const argumentRevisions = new Map(
    argumentRecords.flatMap((record) =>
      typeof record.id === 'string' && typeof record.revision === 'number'
        ? [[record.id, record.revision] as const]
        : [],
    ),
  );
  const pins: ArgumentWorkspaceInsertResolvedPin[] = [];
  newArguments.forEach((record, index) => {
    normalizePin(
      record,
      'premises',
      `$.arguments[${index}]`,
      axiomRevisions,
      argumentRevisions,
      issues,
      pins,
    );
    normalizePin(
      record,
      'relations',
      `$.arguments[${index}]`,
      axiomRevisions,
      argumentRevisions,
      issues,
      pins,
    );
  });
  newCounterArguments.forEach((record, index) =>
    normalizeAnsweringAxiomPins(
      record,
      `$.counterArguments[${index}]`,
      axiomRevisions,
      issues,
      pins,
    ),
  );

  const candidate = clonePlainData<ArgumentLibrary>({
    ...snapshot.library,
    libraryRevision: snapshot.library.libraryRevision + 1,
    updatedAt: now,
    topics: sortRecords(topicRecords as unknown as ArgumentTopic[]),
    axioms: sortRecords(axiomRecords as unknown as ArgumentAxiom[]),
    arguments: sortRecords(argumentRecords as unknown as Argument[]),
    counterArguments: sortRecords(
      counterRecords as unknown as ArgumentCounterArgument[],
    ),
  });
  const validation = validateArgumentLibrary(candidate);
  if (!validation.valid) return invalid([...issues, ...validation.issues]);
  if (issues.length > 0) return invalid(issues);

  const existingReferences = new Map<
    string,
    ArgumentWorkspaceInsertPreview['referencedExistingRecords'][number]
  >();
  for (const pin of pins) {
    addExistingReference(
      existingReferences,
      existingKeys,
      pin.targetKind,
      pin.targetId,
    );
  }
  memberships.forEach((entry) => {
    addExistingReference(
      existingReferences,
      existingKeys,
      'topic',
      entry.topicId,
    );
    addExistingReference(
      existingReferences,
      existingKeys,
      entry.kind as TopicMembershipKind,
      entry.recordId,
    );
  });
  promotions.forEach((entry) => {
    addExistingReference(
      existingReferences,
      existingKeys,
      'topic',
      entry.topicId,
    );
    addExistingReference(
      existingReferences,
      existingKeys,
      'argument',
      entry.argumentId,
    );
  });
  newArguments.forEach((argument) => {
    addExistingReference(
      existingReferences,
      existingKeys,
      'argument',
      argument.supersedesArgumentId,
    );
  });
  newCounterArguments.forEach((counter) => {
    if (!isRecord(counter.target)) return;
    if (counter.target.kind === 'topic-claim') {
      addExistingReference(
        existingReferences,
        existingKeys,
        'topic',
        counter.target.topicId,
      );
    } else if (counter.target.kind === 'axiom') {
      addExistingReference(
        existingReferences,
        existingKeys,
        'axiom',
        counter.target.axiomId,
      );
    } else if (counter.target.kind === 'counter-argument') {
      addExistingReference(
        existingReferences,
        existingKeys,
        'counter-argument',
        counter.target.counterArgumentId,
      );
    } else if (counter.target.kind === 'argument') {
      addExistingReference(
        existingReferences,
        existingKeys,
        'argument',
        counter.target.argumentId,
      );
    }
  });
  const records: ArgumentWorkspaceInsertRecordPreview[] = [
    ...newTopics.map((record) => ({
      kind: 'topic' as const,
      id: String(record.id),
      title: String(record.title),
    })),
    ...newAxioms.map((record) => ({
      kind: 'axiom' as const,
      id: String(record.id),
      title: String(record.title),
    })),
    ...newArguments.map((record) => ({
      kind: 'argument' as const,
      id: String(record.id),
      title: String(record.title),
    })),
    ...newCounterArguments.map((record) => ({
      kind: 'counter-argument' as const,
      id: String(record.id),
      title: String(record.title),
    })),
  ];
  const finalNewArguments = new Map<string, Argument>(
    validation.value.arguments
      .filter(({ id }) => newArgumentIds.has(id))
      .map((record) => [record.id, record]),
  );
  return {
    status: 'valid',
    plan: {
      base: snapshot.descriptor,
      candidate: validation.value,
      preview: {
        format: ARGUMENT_WORKSPACE_INSERT_FORMAT,
        counts: {
          topics: newTopics.length,
          axioms: newAxioms.length,
          arguments: newArguments.length,
          counterArguments: newCounterArguments.length,
        },
        records,
        memberships: membershipPreview,
        currentPromotions: promotions.map((entry) => ({
          topicId: String(entry.topicId),
          argumentId: String(entry.argumentId),
        })),
        supersessions: [...finalNewArguments.values()].flatMap((argument) =>
          argument.supersedesArgumentId === undefined
            ? []
            : [
                {
                  argumentId: argument.id,
                  supersedesArgumentId: argument.supersedesArgumentId,
                },
              ],
        ),
        relations: [...finalNewArguments.values()].flatMap((argument) =>
          argument.relations.map((relation) => ({
            argumentId: argument.id,
            relation,
          })),
        ),
        referencedExistingRecords: [...existingReferences.values()].sort(
          (left, right) =>
            `${left.kind}:${left.id}`.localeCompare(
              `${right.kind}:${right.id}`,
            ),
        ),
        resolvedPins: pins,
        warnings,
      },
    },
  };
}

export const ARGUMENT_WORKSPACE_INSERT_TEMPLATE = JSON.stringify(
  {
    format: ARGUMENT_WORKSPACE_INSERT_FORMAT,
    topics: [
      {
        id: 'TOP-DEMO',
        title: 'Demo Topic',
        summary: 'Synthetic insert example',
        reviewState: 'accepted',
      },
    ],
    arguments: [
      {
        id: 'ARG-DEMO',
        title: 'Demo Argument',
        premises: [
          { id: 'P-DEMO', kind: 'text', text: 'A synthetic premise.' },
        ],
        conclusion: 'A synthetic conclusion.',
        reviewState: 'accepted',
      },
    ],
    memberships: [
      { topicId: 'TOP-DEMO', kind: 'argument', recordId: 'ARG-DEMO' },
    ],
    currentPromotions: [{ topicId: 'TOP-DEMO', argumentId: 'ARG-DEMO' }],
  } satisfies ArgumentWorkspaceInsertDocument,
  null,
  2,
);
