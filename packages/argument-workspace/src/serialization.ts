import {
  canonicalJson,
  captureArgumentLibrarySnapshot,
  clonePlainData,
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
        readonly kind: ArgumentRecordKind;
        readonly id: string;
      }[];
    }
  | {
      readonly status: 'conflict';
      readonly incoming: SnapshotDescriptor;
      readonly conflicts: readonly {
        readonly kind: 'library-lineage' | ArgumentRecordKind;
        readonly id: string;
        readonly message: string;
      }[];
    };

function recordsByKind(library: ArgumentLibrary): readonly {
  readonly kind: ArgumentRecordKind;
  readonly values: readonly { readonly id: string }[];
}[] {
  return [
    { kind: 'topic', values: library.topics },
    { kind: 'axiom', values: library.axioms },
    { kind: 'argument', values: library.arguments },
    { kind: 'counter-argument', values: library.counterArguments },
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
    kind: ArgumentRecordKind;
    id: string;
    message: string;
  }[] = [];
  const additions: { kind: ArgumentRecordKind; id: string }[] = [];
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
    axioms: merge(current.axioms, incoming.axioms),
    arguments: merge(current.arguments, incoming.arguments),
    counterArguments: merge(
      current.counterArguments,
      incoming.counterArguments,
    ),
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
