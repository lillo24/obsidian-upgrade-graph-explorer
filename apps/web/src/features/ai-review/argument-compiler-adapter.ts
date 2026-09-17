import {
  COMPILER_PROTOCOL_VERSION,
  CompilerAccessError,
  type CompilerCapability,
  type CompilerProvider,
  type CompilerReference,
  type CompilerResultEnvelope,
  type CompilerResultStatus,
  type CompilerSnapshotDescriptor,
  type CompilerSnapshotSession,
  type JsonValue,
} from '@icarus-graph-explorer/ai-review';
import {
  ARGUMENT_LIBRARY_SCHEMA_VERSION,
  CONTENT_FINGERPRINT_ALGORITHM,
  canonicalJson,
  captureArgumentLibrarySnapshot,
  createKnowledgeReader,
  sameSnapshot,
  type ArgumentLibrarySnapshot,
  type ConsultationReceipt,
  type IndexPage,
  type KnowledgeReader,
  type ReadArgumentBundleResult,
  type ReadLinkedTheorySourceResult,
  type SnapshotBoundResult,
  type SnapshotDescriptor,
  type TheorySourceReference,
} from '@icarus-graph-explorer/argument-workspace';

import { formatArgumentBundle } from '../arguments/context-export';
import type {
  ArgumentSourceAccess,
  ArgumentSourceCapture,
} from '../arguments/source-capture';

const SNAPSHOT_ID_PREFIX = 'argument-library-snapshot-v2:';
const MAX_SOURCE_CHARACTERS = 100_000;
const LIBRARY_CAPABILITIES: readonly CompilerCapability[] = [
  'list-index',
  'search-index',
  'read-bundle',
];

type SourceAccessDecision =
  | { readonly status: 'available'; readonly capture: ArgumentSourceCapture }
  | {
      readonly status: CompilerResultStatus;
      readonly code: string;
      readonly message: string;
      readonly omissions?: readonly string[];
    };

export interface ArgumentCompilerProviderOptions {
  /** Returns the application's latest confirmed snapshot, never a draft. */
  readonly currentSnapshot: () => ArgumentLibrarySnapshot | undefined;
  /** Already-authorized source access; the adapter never binds it. */
  readonly sourceAccess?: ArgumentSourceAccess;
  readonly clock?: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function encodeUtf16Hex(value: string): string {
  let encoded = '';
  for (let index = 0; index < value.length; index += 1) {
    encoded += value.charCodeAt(index).toString(16).padStart(4, '0');
  }
  return encoded;
}

function decodeUtf16Hex(value: string): string {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[a-f0-9]+$/u.test(value)
  ) {
    throw new Error('Snapshot ID payload is not canonical UTF-16 hexadecimal.');
  }
  let decoded = '';
  for (let index = 0; index < value.length; index += 4) {
    decoded += String.fromCharCode(
      Number.parseInt(value.slice(index, index + 4), 16),
    );
  }
  return decoded;
}

function validateCoreDescriptor(value: unknown): SnapshotDescriptor {
  if (!isRecord(value))
    throw new Error('Snapshot descriptor must be an object.');
  const keys = Object.keys(value).sort();
  if (
    keys.join('\n') !==
    ['contentFingerprint', 'libraryId', 'libraryRevision', 'schemaVersion']
      .sort()
      .join('\n')
  ) {
    throw new Error('Snapshot descriptor fields are malformed.');
  }
  if (typeof value.libraryId !== 'string' || value.libraryId.trim() === '') {
    throw new Error('Snapshot libraryId must be a non-empty string.');
  }
  if (value.schemaVersion !== ARGUMENT_LIBRARY_SCHEMA_VERSION) {
    throw new Error('Snapshot schemaVersion is unsupported.');
  }
  if (
    !Number.isSafeInteger(value.libraryRevision) ||
    Number(value.libraryRevision) < 1
  ) {
    throw new Error(
      'Snapshot libraryRevision must be a positive safe integer.',
    );
  }
  if (!isRecord(value.contentFingerprint)) {
    throw new Error('Snapshot contentFingerprint is malformed.');
  }
  if (
    Object.keys(value.contentFingerprint).sort().join('\n') !==
      ['algorithm', 'value'].join('\n') ||
    value.contentFingerprint.algorithm !== CONTENT_FINGERPRINT_ALGORITHM ||
    typeof value.contentFingerprint.value !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(value.contentFingerprint.value)
  ) {
    throw new Error('Snapshot contentFingerprint is invalid.');
  }
  return value as unknown as SnapshotDescriptor;
}

/**
 * Encodes the complete core descriptor into the Review snapshot ID. The
 * canonical JSON is represented as lowercase hexadecimal UTF-16 code units,
 * so every JavaScript string round-trips without relying on a platform codec.
 * Review's revision field repeats the decimal library revision for display.
 */
export function encodeArgumentCompilerSnapshotDescriptor(
  descriptor: SnapshotDescriptor,
): Pick<CompilerSnapshotDescriptor, 'snapshotId' | 'revision'> {
  const validated = validateCoreDescriptor(descriptor);
  const canonical = canonicalJson({
    libraryId: validated.libraryId,
    schemaVersion: validated.schemaVersion,
    libraryRevision: validated.libraryRevision,
    contentFingerprint: {
      algorithm: validated.contentFingerprint.algorithm,
      value: validated.contentFingerprint.value,
    },
  });
  return {
    snapshotId: `${SNAPSHOT_ID_PREFIX}${encodeUtf16Hex(canonical)}`,
    revision: String(validated.libraryRevision),
  };
}

export function decodeArgumentCompilerSnapshotDescriptor(
  descriptor: Pick<CompilerSnapshotDescriptor, 'snapshotId' | 'revision'>,
): SnapshotDescriptor {
  if (!descriptor.snapshotId.startsWith(SNAPSHOT_ID_PREFIX)) {
    throw new Error('Snapshot ID uses an unsupported encoding.');
  }
  const parsed = JSON.parse(
    decodeUtf16Hex(descriptor.snapshotId.slice(SNAPSHOT_ID_PREFIX.length)),
  ) as unknown;
  const validated = validateCoreDescriptor(parsed);
  const encoded = encodeArgumentCompilerSnapshotDescriptor(validated);
  if (encoded.snapshotId !== descriptor.snapshotId) {
    throw new Error('Snapshot ID is not canonically encoded.');
  }
  if (encoded.revision !== descriptor.revision) {
    throw new Error('Review revision does not match the encoded snapshot.');
  }
  return validated;
}

function sourceReferences(
  snapshot: ArgumentLibrarySnapshot,
): readonly TheorySourceReference[] {
  return [
    ...snapshot.library.axioms.flatMap(
      ({ sourceReferences }) => sourceReferences,
    ),
    ...snapshot.library.arguments.flatMap(
      ({ sourceReferences }) => sourceReferences,
    ),
    ...snapshot.library.counterArguments.flatMap(
      ({ sourceReferences }) => sourceReferences,
    ),
  ];
}

function sourceDecision(
  sourceAccess: ArgumentSourceAccess | undefined,
  workspaceId: string,
  references: readonly TheorySourceReference[],
): SourceAccessDecision {
  if (sourceAccess === undefined || references.length === 0) {
    return {
      status: 'source-unavailable',
      code: 'source-capture-unavailable',
      message: 'No registered source set is available for this snapshot.',
    };
  }
  let state: ReturnType<ArgumentSourceAccess['state']>;
  try {
    state = sourceAccess.state();
  } catch {
    return {
      status: 'unavailable',
      code: 'source-capture-failed',
      message: 'The authorized source state could not be inspected.',
    };
  }
  if (state.status !== 'bound') {
    return {
      status: 'unauthorized',
      code: 'source-not-authorized',
      message:
        'The application source is not explicitly bound for argument reads.',
    };
  }
  if (state.source.sourceSpaceId !== workspaceId) {
    return {
      status: 'unauthorized',
      code: 'source-workspace-mismatch',
      message: 'The bound argument source does not match the Review workspace.',
    };
  }
  if (!state.freshReadAvailable) {
    return {
      status: 'source-unavailable',
      code: 'source-capture-not-committed',
      message: 'The bound source is not at a committed readable state.',
    };
  }
  let result: ReturnType<ArgumentSourceAccess['capture']>;
  try {
    result = sourceAccess.capture(references);
  } catch {
    return {
      status: 'unavailable',
      code: 'source-capture-failed',
      message: 'The complete authorized source set could not be captured.',
    };
  }
  if (result.status !== 'ok') {
    if (result.status === 'wrong-binding') {
      return {
        status: 'unauthorized',
        code: 'source-wrong-binding',
        message: result.message,
      };
    }
    if (result.status === 'limit-exceeded') {
      return {
        status: 'limit-exceeded',
        code: 'source-capture-limit-exceeded',
        message: result.message,
      };
    }
    return {
      status: 'source-unavailable',
      code: 'source-capture-unavailable',
      message: result.message,
    };
  }
  if (result.capture.selectionLimitStatus === 'limit-exceeded') {
    return {
      status: 'limit-exceeded',
      code: 'source-capture-limit-exceeded',
      message:
        'The complete registered source set does not fit the capture limits.',
      omissions: result.capture.limitOmissions,
    };
  }
  return { status: 'available', capture: result.capture };
}

function referencesFromReceipt(
  receipt: ConsultationReceipt,
): CompilerReference[] {
  return receipt.returnedRecords.map((record) => ({
    canonicalId: record.id,
    revision: String(record.revision),
  }));
}

function envelope(
  descriptor: CompilerSnapshotDescriptor,
  fields: Omit<
    CompilerResultEnvelope,
    'protocolVersion' | 'snapshotId' | 'snapshotRevision'
  >,
): CompilerResultEnvelope {
  return {
    protocolVersion: COMPILER_PROTOCOL_VERSION,
    snapshotId: descriptor.snapshotId,
    snapshotRevision: descriptor.revision,
    ...fields,
  };
}

function failure(
  descriptor: CompilerSnapshotDescriptor,
  status: CompilerResultStatus,
  code: string,
  message: string,
  options: {
    readonly content?: JsonValue;
    readonly references?: CompilerReference[];
    readonly completeness?: CompilerResultEnvelope['completeness'];
    readonly omissions?: readonly string[];
    readonly freshness?: CompilerResultEnvelope['freshness'];
  } = {},
): CompilerResultEnvelope {
  return envelope(descriptor, {
    status,
    ...(options.content === undefined ? {} : { content: options.content }),
    references: options.references ?? [],
    completeness: options.completeness ?? 'not-applicable',
    omissions: [...(options.omissions ?? [])],
    freshness:
      options.freshness ??
      (status === 'stale-snapshot' ? 'stale' : 'unavailable'),
    error: { code, message },
  });
}

function cancelled(
  descriptor: CompilerSnapshotDescriptor,
  operation: string,
): CompilerResultEnvelope {
  return failure(
    descriptor,
    'cancelled',
    'attempt-cancelled',
    `${operation} was cancelled.`,
  );
}

function indexEnvelope(
  descriptor: CompilerSnapshotDescriptor,
  result: SnapshotBoundResult<IndexPage>,
): CompilerResultEnvelope {
  if (result.status === 'snapshot-mismatch') {
    return failure(
      descriptor,
      'stale-snapshot',
      'snapshot-mismatch',
      'The reader snapshot does not match the pinned Review snapshot.',
      { content: result as unknown as JsonValue },
    );
  }
  if (result.status === 'invalid-request') {
    return failure(
      descriptor,
      'invalid-request',
      'invalid-index-request',
      result.issues.join(' '),
      { content: result as unknown as JsonValue },
    );
  }
  const page = result.value;
  return envelope(descriptor, {
    status: 'ok',
    content: {
      items: page.candidates.map((candidate) => ({
        id: candidate.id,
        kind: candidate.kind,
        title: candidate.title,
        revision: candidate.revision,
        topicIds: [...candidate.topicIds],
        score: candidate.score,
        matchedFields: [...candidate.matchedFields],
      })),
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      snapshot: page.snapshot,
      receipt: page.receipt,
    } as unknown as JsonValue,
    references: referencesFromReceipt(page.receipt),
    completeness: 'complete',
    omissions: [...page.receipt.omissions],
    freshness: 'retained',
  });
}

function bundleEnvelope(
  descriptor: CompilerSnapshotDescriptor,
  result: ReadArgumentBundleResult,
): CompilerResultEnvelope {
  if (result.status === 'ok') {
    const formatted = formatArgumentBundle(result.value);
    return envelope(descriptor, {
      status: 'ok',
      content: {
        bundle: result.value,
        markdown: formatted.text,
      } as unknown as JsonValue,
      references: referencesFromReceipt(result.value.receipt),
      completeness: 'complete',
      omissions: [...result.value.receipt.omissions],
      freshness: 'retained',
    });
  }
  if (result.status === 'not-found') {
    return failure(
      descriptor,
      'not-found',
      'record-not-found',
      `Argument record ${JSON.stringify(result.id)} was not found.`,
    );
  }
  if (result.status === 'ambiguous-selector') {
    return failure(
      descriptor,
      'invalid-request',
      'ambiguous-record-id',
      `Argument record ID ${JSON.stringify(result.id)} is ambiguous across ${result.kinds.join(', ')}.`,
      { content: result as unknown as JsonValue },
    );
  }
  if (result.status === 'limit-exceeded') {
    return failure(
      descriptor,
      'limit-exceeded',
      'bundle-limit-exceeded',
      'The complete bounded argument closure exceeds the reader limits.',
      {
        content: result as unknown as JsonValue,
        references: referencesFromReceipt(result.receipt),
        completeness: 'incomplete',
        omissions: result.omissions,
        freshness: 'retained',
      },
    );
  }
  if (result.status === 'snapshot-mismatch') {
    return failure(
      descriptor,
      'stale-snapshot',
      'snapshot-mismatch',
      'The reader snapshot does not match the pinned Review snapshot.',
      { content: result as unknown as JsonValue },
    );
  }
  return failure(
    descriptor,
    'invalid-request',
    'invalid-bundle-request',
    result.issues.join(' '),
    { content: result as unknown as JsonValue },
  );
}

function sourceEnvelope(
  descriptor: CompilerSnapshotDescriptor,
  result: ReadLinkedTheorySourceResult,
): CompilerResultEnvelope {
  if (result.status === 'ok') {
    const owner = result.value.receipt.returnedRecords[0];
    const sourceReference: CompilerReference = {
      canonicalId: result.value.sourceReferenceId,
      revision: result.value.sourceVersion!,
      ...(result.value.location.heading === undefined
        ? {}
        : { sourceHeading: result.value.location.heading }),
    };
    return envelope(descriptor, {
      status: 'ok',
      content: {
        source: result.value,
        ...(owner === undefined ? {} : { owner }),
      } as unknown as JsonValue,
      references: [
        ...referencesFromReceipt(result.value.receipt),
        sourceReference,
      ],
      completeness: result.value.complete ? 'complete' : 'incomplete',
      omissions: [...result.value.omissions],
      freshness: 'retained',
    });
  }
  if (result.status === 'snapshot-mismatch') {
    return failure(
      descriptor,
      'stale-snapshot',
      'snapshot-mismatch',
      'The reader snapshot does not match the pinned Review snapshot.',
      { content: result as unknown as JsonValue },
    );
  }
  if (result.status === 'invalid-request') {
    return failure(
      descriptor,
      'invalid-request',
      'invalid-source-request',
      result.issues.join(' '),
      { content: result as unknown as JsonValue },
    );
  }
  const unauthorized =
    result.status === 'denied' || result.status === 'wrong-binding';
  const unavailable = result.status === 'provider-error';
  return failure(
    descriptor,
    unauthorized
      ? 'unauthorized'
      : unavailable
        ? 'unavailable'
        : 'source-unavailable',
    `source-${result.status}`,
    result.message,
    {
      content: result as unknown as JsonValue,
      references: referencesFromReceipt(result.receipt),
      completeness: 'not-applicable',
      omissions: result.receipt.omissions,
      freshness:
        result.status === 'version-mismatch' ||
        result.status === 'version-unavailable'
          ? 'stale'
          : 'unavailable',
    },
  );
}

function createSession(
  snapshot: ArgumentLibrarySnapshot,
  workspaceId: string,
  sourceAccess: ArgumentSourceAccess | undefined,
  openedAt: string,
  now: () => string,
): CompilerSnapshotSession {
  const encoded = encodeArgumentCompilerSnapshotDescriptor(snapshot.descriptor);
  const source = sourceDecision(
    sourceAccess,
    workspaceId,
    sourceReferences(snapshot),
  );
  const capabilities = [
    ...LIBRARY_CAPABILITIES,
    ...(source.status === 'available' ? (['read-source'] as const) : []),
  ];
  const descriptor: CompilerSnapshotDescriptor = Object.freeze({
    protocolVersion: COMPILER_PROTOCOL_VERSION,
    ...encoded,
    capabilities: Object.freeze([...capabilities]) as CompilerCapability[],
    openedAt,
  });
  const reader: KnowledgeReader = createKnowledgeReader(snapshot, {
    ...(source.status === 'available'
      ? { sourceProvider: source.capture.provider }
      : {}),
    now,
  });

  const session: CompilerSnapshotSession = {
    descriptor,
    async listIndex(request, signal) {
      if (signal.aborted) return cancelled(descriptor, 'Index listing');
      try {
        const result = reader.listIndex({
          limit: request.limit,
          ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
          expectedSnapshot: snapshot.descriptor,
        });
        if (signal.aborted) return cancelled(descriptor, 'Index listing');
        return indexEnvelope(descriptor, result);
      } catch (error: unknown) {
        if (signal.aborted) return cancelled(descriptor, 'Index listing');
        return failure(
          descriptor,
          'unavailable',
          'index-list-unavailable',
          `Argument index listing failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    async searchIndex(request, signal) {
      if (signal.aborted) return cancelled(descriptor, 'Index search');
      if (request.filter !== undefined) {
        return failure(
          descriptor,
          'invalid-request',
          'unsupported-search-filter',
          'Argument index filters are not supported by this adapter version.',
        );
      }
      try {
        const result = reader.searchIndex({
          query: request.query,
          limit: request.limit,
          ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
          expectedSnapshot: snapshot.descriptor,
        });
        if (signal.aborted) return cancelled(descriptor, 'Index search');
        return indexEnvelope(descriptor, result);
      } catch (error: unknown) {
        if (signal.aborted) return cancelled(descriptor, 'Index search');
        return failure(
          descriptor,
          'unavailable',
          'index-search-unavailable',
          `Argument index search failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    async readBundle(request, signal) {
      if (signal.aborted) return cancelled(descriptor, 'Argument bundle read');
      try {
        const result = reader.readArgumentBundle({
          id: request.id,
          expectedSnapshot: snapshot.descriptor,
        });
        if (signal.aborted)
          return cancelled(descriptor, 'Argument bundle read');
        return bundleEnvelope(descriptor, result);
      } catch (error: unknown) {
        if (signal.aborted)
          return cancelled(descriptor, 'Argument bundle read');
        return failure(
          descriptor,
          'unavailable',
          'bundle-read-unavailable',
          `Argument bundle read failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    async readSource(request, signal) {
      if (signal.aborted) return cancelled(descriptor, 'Linked source read');
      if (source.status !== 'available') {
        return failure(
          descriptor,
          source.status,
          source.code,
          source.message,
          source.omissions === undefined ? {} : { omissions: source.omissions },
        );
      }
      try {
        const result = await reader.readLinkedTheorySource({
          sourceReferenceId: request.sourceId,
          requireExactVersion: true,
          maxCharacters: MAX_SOURCE_CHARACTERS,
          expectedSnapshot: snapshot.descriptor,
        });
        if (signal.aborted) return cancelled(descriptor, 'Linked source read');
        return sourceEnvelope(descriptor, result);
      } catch (error: unknown) {
        if (signal.aborted) return cancelled(descriptor, 'Linked source read');
        return failure(
          descriptor,
          'unavailable',
          'source-read-unavailable',
          `Linked source read failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
  return Object.freeze(session);
}

/** Read-only application adapter from retained Argument snapshots to Review v1. */
export function createArgumentCompilerProvider(
  options: ArgumentCompilerProviderOptions,
): CompilerProvider {
  const retained = new Map<string, ArgumentLibrarySnapshot>();
  const now = options.clock ?? (() => new Date().toISOString());

  const currentSnapshot = (): ArgumentLibrarySnapshot | undefined => {
    try {
      return options.currentSnapshot();
    } catch {
      throw new CompilerAccessError(
        'compiler-unavailable',
        'The current confirmed Argument Library snapshot could not be read.',
      );
    }
  };

  const retain = (candidate: ArgumentLibrarySnapshot) => {
    const snapshot = captureArgumentLibrarySnapshot(candidate.library);
    if (!sameSnapshot(candidate.descriptor, snapshot.descriptor)) {
      throw new CompilerAccessError(
        'invalid-current-snapshot',
        'The current Argument Library descriptor conflicts with its content.',
      );
    }
    const encoded = encodeArgumentCompilerSnapshotDescriptor(
      snapshot.descriptor,
    );
    retained.set(encoded.snapshotId, snapshot);
    return { snapshot, encoded };
  };

  return {
    async openSnapshot(input) {
      await Promise.resolve();
      if (input.signal.aborted) {
        throw new CompilerAccessError(
          'cancelled',
          'Snapshot opening was cancelled.',
        );
      }
      let selected: ArgumentLibrarySnapshot | undefined;
      if (input.requestedSnapshotId === undefined) {
        const current = currentSnapshot();
        if (current === undefined) {
          throw new CompilerAccessError(
            'compiler-unavailable',
            'No confirmed Argument Library snapshot is currently available.',
          );
        }
        selected = retain(current).snapshot;
      } else {
        let decoded: SnapshotDescriptor;
        try {
          const revision = (() => {
            const payload = JSON.parse(
              decodeUtf16Hex(
                input.requestedSnapshotId.slice(SNAPSHOT_ID_PREFIX.length),
              ),
            ) as unknown;
            return String(validateCoreDescriptor(payload).libraryRevision);
          })();
          decoded = decodeArgumentCompilerSnapshotDescriptor({
            snapshotId: input.requestedSnapshotId,
            revision,
          });
        } catch (error: unknown) {
          throw new CompilerAccessError(
            'invalid-request',
            `Requested compiler snapshot ID is malformed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        selected = retained.get(input.requestedSnapshotId);
        if (selected === undefined) {
          const current = currentSnapshot();
          if (current !== undefined) {
            const currentRetained = retain(current);
            if (
              currentRetained.encoded.snapshotId === input.requestedSnapshotId
            ) {
              selected = currentRetained.snapshot;
            }
          }
        }
        if (
          selected === undefined ||
          !sameSnapshot(selected.descriptor, decoded)
        ) {
          throw new CompilerAccessError(
            'stale-snapshot',
            `Requested compiler snapshot ${input.requestedSnapshotId} is not retained.`,
          );
        }
      }
      if (input.signal.aborted) {
        throw new CompilerAccessError(
          'cancelled',
          'Snapshot opening was cancelled.',
        );
      }
      const openedAt = now();
      if (!Number.isFinite(Date.parse(openedAt))) {
        throw new CompilerAccessError(
          'invalid-clock',
          'The compiler adapter clock must return an ISO timestamp.',
        );
      }
      return createSession(
        selected,
        input.workspaceId,
        options.sourceAccess,
        openedAt,
        now,
      );
    },
  };
}
