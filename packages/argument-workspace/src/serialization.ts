import {
  canonicalJson,
  captureArgumentLibrarySnapshot,
  clonePlainData,
  contentFingerprint,
  describeArgumentLibrary,
  sameSnapshot,
} from './canonical';
import type {
  ArgumentLibrary,
  ArgumentLibraryJsonParseResult,
  ArgumentRecordKind,
  ArgumentRuntime,
  SnapshotDescriptor,
} from './types';
import {
  validateArgumentLibrary,
  validateArgumentLibraryV1,
  validateArgumentLibraryV2,
  validateArgumentLibraryV3,
  validateArgumentLibraryV4,
  validateArgumentLibraryV5,
  validateArgumentLibraryV6,
} from './validation';

export function serializeArgumentLibrary(library: ArgumentLibrary): string {
  const validation = validateArgumentLibrary(library);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Cannot serialize invalid Argument Library${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
    );
  }
  return `${canonicalJson(validation.value)}\n`;
}

export function parseArgumentLibraryJson(
  source: string,
): ArgumentLibraryJsonParseResult {
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch (error: unknown) {
    return {
      status: 'invalid-json',
      message: `Argument Library is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
      issues: [],
      preservedSource: source,
    };
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { readonly schemaVersion?: unknown }).schemaVersion === 1
  ) {
    const migration = migrateArgumentLibraryV1(value);
    if (migration.status === 'valid') {
      return {
        status: 'valid',
        value: migration.value,
        migratedFromSchemaVersion: 1,
      };
    }
    return {
      ...migration,
      preservedSource: source,
    };
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { readonly schemaVersion?: unknown }).schemaVersion === 4
  ) {
    const migration = migrateArgumentLibraryV4(value);
    if (migration.status === 'valid') {
      return {
        status: 'valid',
        value: migration.value,
        migratedFromSchemaVersion: 4,
      };
    }
    return { ...migration, preservedSource: source };
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { readonly schemaVersion?: unknown }).schemaVersion === 6
  ) {
    const migration = migrateArgumentLibraryV6(value);
    if (migration.status === 'valid') {
      return {
        status: 'valid',
        value: migration.value,
        migratedFromSchemaVersion: 6,
      };
    }
    return { ...migration, preservedSource: source };
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { readonly schemaVersion?: unknown }).schemaVersion === 5
  ) {
    const migration = migrateArgumentLibraryV5(value);
    if (migration.status === 'valid') {
      return {
        status: 'valid',
        value: migration.value,
        migratedFromSchemaVersion: 5,
      };
    }
    return { ...migration, preservedSource: source };
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { readonly schemaVersion?: unknown }).schemaVersion === 3
  ) {
    const migration = migrateArgumentLibraryV3(value);
    if (migration.status === 'valid') {
      return {
        status: 'valid',
        value: migration.value,
        migratedFromSchemaVersion: 3,
      };
    }
    return { ...migration, preservedSource: source };
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { readonly schemaVersion?: unknown }).schemaVersion === 2
  ) {
    const migration = migrateArgumentLibraryV2(value);
    if (migration.status === 'valid') {
      return {
        status: 'valid',
        value: migration.value,
        migratedFromSchemaVersion: 2,
      };
    }
    return {
      ...migration,
      preservedSource: source,
    };
  }
  const validation = validateArgumentLibrary(value);
  if (validation.valid) return { status: 'valid', value: validation.value };
  const future = validation.issues.some(({ code }) => code === 'future-schema');
  const first = validation.issues[0];
  return {
    status: future ? 'future-schema' : 'invalid-library',
    message: `Argument Library is ${future ? 'from a future schema' : 'invalid'}${
      first === undefined ? '.' : ` at ${first.path}: ${first.message}`
    }`,
    issues: validation.issues,
    preservedSource: source,
  };
}

type ArgumentLibraryMigrationResult =
  | { readonly status: 'valid'; readonly value: ArgumentLibrary }
  | {
      readonly status: 'invalid-library';
      readonly message: string;
      readonly issues: ReturnType<typeof validateArgumentLibraryV1>['issues'];
    };

/** Deterministically upgrades valid v1 data without inventing theory content. */
export function migrateArgumentLibraryV1(
  value: unknown,
): ArgumentLibraryMigrationResult {
  const legacyValidation = validateArgumentLibraryV1(value);
  if (!legacyValidation.valid) {
    const first = legacyValidation.issues[0];
    return {
      status: 'invalid-library',
      message: `Argument Library v1 is invalid${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
      issues: legacyValidation.issues,
    };
  }
  const legacy = clonePlainData(legacyValidation.value);
  const candidateV2 = {
    ...legacy,
    schemaVersion: 2,
    topics: (legacy.topics as readonly Record<string, unknown>[]).map(
      (topic) => ({ ...topic, argumentIds: [] }),
    ),
    arguments: [],
  };
  const migration = migrateArgumentLibraryV2(candidateV2);
  if (migration.status !== 'valid') {
    const first = migration.issues[0];
    return {
      status: 'invalid-library',
      message: `Migrated Argument Library is invalid${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
      issues: migration.issues,
    };
  }
  return migration;
}

/** Deterministically adds empty v3 structures without inferring semantics. */
export function migrateArgumentLibraryV2(
  value: unknown,
): ArgumentLibraryMigrationResult {
  const legacyValidation = validateArgumentLibraryV2(value);
  if (!legacyValidation.valid) {
    const first = legacyValidation.issues[0];
    return {
      status: 'invalid-library',
      message: `Argument Library v2 is invalid${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
      issues: legacyValidation.issues,
    };
  }
  const legacy = clonePlainData(legacyValidation.value);
  const candidate = {
    ...legacy,
    schemaVersion: 3,
    arguments: (legacy.arguments as readonly Record<string, unknown>[]).map(
      (argument) => ({
        ...argument,
        examples: [],
        relations: [],
      }),
    ),
  };
  return migrateArgumentLibraryV3(candidate);
}

/** Deterministically adds Context storage and empty Argument bindings. */
export function migrateArgumentLibraryV3(
  value: unknown,
): ArgumentLibraryMigrationResult {
  const legacyValidation = validateArgumentLibraryV3(value);
  if (!legacyValidation.valid) {
    const first = legacyValidation.issues[0];
    return {
      status: 'invalid-library',
      message: `Argument Library v3 is invalid${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
      issues: legacyValidation.issues,
    };
  }
  const legacy = clonePlainData(legacyValidation.value);
  const candidate = {
    ...legacy,
    schemaVersion: 4,
    contexts: [],
    arguments: (legacy.arguments as readonly Record<string, unknown>[]).map(
      (argument) => ({ ...argument, contextIds: [] }),
    ),
  };
  return migrateArgumentLibraryV4(candidate);
}

/** Deterministically adds an empty non-canonical Proposal Mailbox. */
export function migrateArgumentLibraryV4(
  value: unknown,
): ArgumentLibraryMigrationResult {
  const legacyValidation = validateArgumentLibraryV4(value);
  if (!legacyValidation.valid) {
    const first = legacyValidation.issues[0];
    return {
      status: 'invalid-library',
      message: `Argument Library v4 is invalid${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
      issues: legacyValidation.issues,
    };
  }
  const legacy = clonePlainData(legacyValidation.value);
  const candidate = {
    ...legacy,
    schemaVersion: 5,
    proposals: [],
  };
  return migrateArgumentLibraryV5(candidate);
}

/** Deterministically separates v5 Proposal roles without inferring references from prose. */
export function migrateArgumentLibraryV5(
  value: unknown,
): ArgumentLibraryMigrationResult {
  const legacyValidation = validateArgumentLibraryV5(value);
  if (!legacyValidation.valid) {
    const first = legacyValidation.issues[0];
    return {
      status: 'invalid-library',
      message: `Argument Library v5 is invalid${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
      issues: legacyValidation.issues,
    };
  }
  const legacy = clonePlainData(legacyValidation.value);
  const axioms = legacy.axioms as readonly Record<string, unknown>[];
  const proposals = (
    legacy.proposals as readonly Record<string, unknown>[]
  ).map((proposal) => {
    const premiseHints = proposal.premiseHints as readonly string[];
    const suggestedAxiomIds = proposal.suggestedAxiomIds as readonly string[];
    const consultedRecords = (
      proposal.consultation as {
        readonly records: readonly {
          readonly kind: string;
          readonly id: string;
          readonly revision: number;
        }[];
      }
    ).records;
    const premises = [
      ...premiseHints.map((text, index) => ({
        id: `legacy-text-${index + 1}`,
        kind: 'text' as const,
        text,
      })),
      ...suggestedAxiomIds.map((axiomId, index) => {
        const axiom = axioms.find(({ id }) => id === axiomId)!;
        return {
          id: `legacy-axiom-${index + 1}`,
          kind: 'axiom' as const,
          axiomId,
          reliedOnRevision:
            consultedRecords.find(
              (record) => record.kind === 'axiom' && record.id === axiomId,
            )?.revision ?? axiom.revision,
        };
      }),
    ];
    const retained = { ...proposal };
    delete retained.premiseHints;
    delete retained.suggestedAxiomIds;
    delete retained.submissionFingerprint;
    const normalized = {
      title: proposal.title,
      ...(proposal.topicId === undefined ? {} : { topicId: proposal.topicId }),
      intent: proposal.target === undefined ? 'new' : 'unspecified',
      ...(proposal.target === undefined ? {} : { target: proposal.target }),
      examples: proposal.examples,
      premises,
      ...(proposal.reasoning === undefined
        ? {}
        : { reasoning: proposal.reasoning }),
      reasoningSteps: [],
      conclusion: proposal.conclusion,
      ...(proposal.boundary === undefined
        ? {}
        : { boundary: proposal.boundary }),
      sourceObservations: [],
      whyNovelOrUnresolved: proposal.whyNovelOrUnresolved,
      consultation: proposal.consultation,
    };
    return {
      ...retained,
      ...normalized,
      submissionFingerprint: contentFingerprint({
        ...normalized,
        ...(proposal.clientSubmissionId === undefined
          ? {}
          : { clientSubmissionId: proposal.clientSubmissionId }),
      }),
    };
  });
  const candidate = {
    ...legacy,
    schemaVersion: 6,
    proposals,
  };
  return migrateArgumentLibraryV6(candidate);
}

/** Adds the optional human-review explanation field without fabricating content. */
export function migrateArgumentLibraryV6(
  value: unknown,
): ArgumentLibraryMigrationResult {
  const legacyValidation = validateArgumentLibraryV6(value);
  if (!legacyValidation.valid) {
    const first = legacyValidation.issues[0];
    return {
      status: 'invalid-library',
      message: `Argument Library v6 is invalid${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
      issues: legacyValidation.issues,
    };
  }
  const candidate = {
    ...clonePlainData(legacyValidation.value),
    schemaVersion: 7,
  };
  const migratedValidation = validateArgumentLibrary(candidate);
  if (!migratedValidation.valid) {
    const first = migratedValidation.issues[0];
    return {
      status: 'invalid-library',
      message: `Migrated Argument Library is invalid${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
      issues: migratedValidation.issues,
    };
  }
  return { status: 'valid', value: migratedValidation.value };
}

export type ArgumentImportPreview =
  | {
      readonly status: 'identical';
      readonly incoming: SnapshotDescriptor;
    }
  | {
      readonly status: 'merge-ready' | 'replace-ready';
      readonly incoming: SnapshotDescriptor;
      readonly additions: readonly {
        readonly kind: ArgumentRecordKind | 'proposal';
        readonly id: string;
      }[];
    }
  | {
      readonly status: 'conflict';
      readonly incoming: SnapshotDescriptor;
      readonly conflicts: readonly {
        readonly kind: 'library-lineage' | ArgumentRecordKind | 'proposal';
        readonly id: string;
        readonly message: string;
      }[];
    };

function recordsByKind(library: ArgumentLibrary): readonly {
  readonly kind: ArgumentRecordKind | 'proposal';
  readonly values: readonly { readonly id: string }[];
}[] {
  return [
    { kind: 'topic', values: library.topics },
    { kind: 'context', values: library.contexts },
    { kind: 'axiom', values: library.axioms },
    { kind: 'argument', values: library.arguments },
    { kind: 'counter-argument', values: library.counterArguments },
    { kind: 'proposal', values: library.proposals },
  ];
}

export function previewArgumentLibraryImport(
  current: ArgumentLibrary,
  incoming: ArgumentLibrary,
  mode: 'merge' | 'replace',
): ArgumentImportPreview {
  const incomingDescriptor = describeArgumentLibrary(incoming);
  if (sameSnapshot(describeArgumentLibrary(current), incomingDescriptor)) {
    return { status: 'identical', incoming: incomingDescriptor };
  }
  if (mode === 'replace') {
    if (
      current.libraryId === incoming.libraryId &&
      current.libraryRevision === incoming.libraryRevision
    ) {
      return {
        status: 'conflict',
        incoming: incomingDescriptor,
        conflicts: [
          {
            kind: 'library-lineage',
            id: incoming.libraryId,
            message:
              'The same library ID and revision identify different content.',
          },
        ],
      };
    }
    return {
      status: 'replace-ready',
      incoming: incomingDescriptor,
      additions: [],
    };
  }
  if (current.libraryId === incoming.libraryId) {
    return {
      status: 'conflict',
      incoming: incomingDescriptor,
      conflicts: [
        {
          kind: 'library-lineage',
          id: incoming.libraryId,
          message:
            'A non-identical snapshot from the current lineage cannot be merged as independent records.',
        },
      ],
    };
  }
  const conflicts: {
    kind: ArgumentRecordKind | 'proposal';
    id: string;
    message: string;
  }[] = [];
  const additions: { kind: ArgumentRecordKind | 'proposal'; id: string }[] = [];
  const currentById = new Map(
    recordsByKind(current).flatMap(({ kind, values }) =>
      values.map(
        (record) =>
          [record.id, { kind, content: canonicalJson(record) }] as const,
      ),
    ),
  );
  for (const incomingKind of recordsByKind(incoming)) {
    for (const record of incomingKind.values) {
      const existing = currentById.get(record.id);
      if (existing === undefined) {
        additions.push({ kind: incomingKind.kind, id: record.id });
      } else if (
        existing.kind !== incomingKind.kind ||
        existing.content !== canonicalJson(record)
      ) {
        conflicts.push({
          kind: incomingKind.kind,
          id: record.id,
          message:
            existing.kind === incomingKind.kind
              ? 'The record ID exists with different content.'
              : `The record ID is already used by a ${existing.kind}.`,
        });
      }
    }
  }
  const sourceOwners = (library: ArgumentLibrary) => [
    ...library.axioms.flatMap((record) =>
      record.sourceReferences.map((source) => ({
        source,
        owner: record.id,
        kind: 'axiom' as const,
      })),
    ),
    ...library.arguments.flatMap((record) =>
      record.sourceReferences.map((source) => ({
        source,
        owner: record.id,
        kind: 'argument' as const,
      })),
    ),
    ...library.counterArguments.flatMap((record) =>
      record.sourceReferences.map((source) => ({
        source,
        owner: record.id,
        kind: 'counter-argument' as const,
      })),
    ),
  ];
  const currentSources = new Map(
    sourceOwners(current).map(({ source, owner }) => [
      source.id,
      { source, owner },
    ]),
  );
  for (const { source, owner, kind } of sourceOwners(incoming)) {
    const existing = currentSources.get(source.id);
    if (
      existing !== undefined &&
      (existing.owner !== owner ||
        canonicalJson(existing.source) !== canonicalJson(source))
    ) {
      conflicts.push({
        kind,
        id: owner,
        message: `Source-reference ID "${source.id}" is already owned by another record or locator.`,
      });
    }
  }
  return conflicts.length > 0
    ? { status: 'conflict', incoming: incomingDescriptor, conflicts }
    : { status: 'merge-ready', incoming: incomingDescriptor, additions };
}

export function mergeArgumentLibraries(
  current: ArgumentLibrary,
  incoming: ArgumentLibrary,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const preview = previewArgumentLibraryImport(current, incoming, 'merge');
  if (preview.status === 'identical') return current;
  if (preview.status === 'conflict') {
    throw new Error(
      `Argument Library import conflicts: ${preview.conflicts
        .map(({ kind, id }) => `${kind}:${id}`)
        .join(', ')}.`,
    );
  }
  const now = runtime.now();
  const merge = <T extends { readonly id: string }>(
    currentValues: readonly T[],
    incomingValues: readonly T[],
  ): readonly T[] => {
    const ids = new Set(currentValues.map(({ id }) => id));
    return [
      ...currentValues,
      ...incomingValues.filter(({ id }) => !ids.has(id)),
    ].sort((left, right) => left.id.localeCompare(right.id));
  };
  const candidate: ArgumentLibrary = {
    ...clonePlainData(current),
    libraryRevision: current.libraryRevision + 1,
    updatedAt: now,
    topics: merge(current.topics, incoming.topics),
    contexts: merge(current.contexts, incoming.contexts),
    axioms: merge(current.axioms, incoming.axioms),
    arguments: merge(current.arguments, incoming.arguments),
    counterArguments: merge(
      current.counterArguments,
      incoming.counterArguments,
    ),
    proposals: merge(current.proposals, incoming.proposals),
  };
  const validation = validateArgumentLibrary(candidate);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Merged Argument Library is invalid${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
    );
  }
  if (preview.status !== 'merge-ready') {
    throw new Error(
      'Argument Library import was prepared for replacement, not merge.',
    );
  }
  return validation.value;
}

export function validatePortableArgumentSnapshot(source: string) {
  const parsed = parseArgumentLibraryJson(source);
  return parsed.status === 'valid'
    ? {
        status: 'valid' as const,
        snapshot: captureArgumentLibrarySnapshot(parsed.value),
      }
    : parsed;
}
