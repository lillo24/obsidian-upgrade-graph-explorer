import {
  assertPlainData,
  clonePlainData,
  deepFreeze,
  plainDataByteLength,
  stableStringify,
} from './plain-data';
import {
  COMPILER_PROTOCOL_VERSION,
  COMPILER_TOOL_NAMES,
  type CompilerCounterArgumentBundle,
  type CompilerCapability,
  type CompilerIndexEntry,
  type CompilerProvider,
  type CompilerResultEnvelope,
  type CompilerResultStatus,
  type CompilerSnapshotDescriptor,
  type CompilerSnapshotSession,
  type CompilerToolName,
  type JsonValue,
  type ProviderToolDefinition,
  type ReviewResourceLimits,
} from './types';

const COMPILER_CAPABILITIES = new Set<CompilerCapability>([
  'list-index',
  'search-index',
  'read-bundle',
  'read-source',
]);
const COMPILER_RESULT_STATUSES = new Set<CompilerResultStatus>([
  'ok',
  'unavailable',
  'not-found',
  'source-unavailable',
  'stale-snapshot',
  'unauthorized',
  'invalid-request',
  'limit-exceeded',
  'cancelled',
]);

export const COMPILER_TOOL_DEFINITIONS: ProviderToolDefinition[] = [
  {
    name: 'compiler_list_index',
    description:
      'List a bounded page of compiler index descriptions. This is not a logical verdict.',
    inputSchema: {
      type: 'object',
      properties: {
        cursor: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'compiler_search_index',
    description:
      'Search bounded compiler index descriptions for relevant context. A successful empty result is valid.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        filter: { type: 'string' },
        cursor: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['query', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'compiler_read_bundle',
    description:
      'Read a retained compiler record together with its argument context and completeness markers.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'compiler_read_source',
    description:
      'Read an authorized linked theory passage from the already-bound retained snapshot.',
    inputSchema: {
      type: 'object',
      properties: { sourceId: { type: 'string' } },
      required: ['sourceId'],
      additionalProperties: false,
    },
  },
];

export function compilerToolDefinitionsFor(
  capabilities: CompilerCapability[],
): ProviderToolDefinition[] {
  const available = new Set(capabilities);
  return COMPILER_TOOL_DEFINITIONS.filter((definition) =>
    available.has(capabilityFor(definition.name)),
  );
}

export class CompilerAccessError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CompilerAccessError';
  }
}

function errorEnvelope(
  descriptor: CompilerSnapshotDescriptor | undefined,
  status: CompilerResultStatus,
  code: string,
  message: string,
): CompilerResultEnvelope {
  return {
    protocolVersion: COMPILER_PROTOCOL_VERSION,
    snapshotId: descriptor?.snapshotId ?? 'unavailable',
    snapshotRevision: descriptor?.revision ?? 'unavailable',
    status,
    references: [],
    completeness: 'not-applicable',
    omissions: [],
    freshness: status === 'stale-snapshot' ? 'stale' : 'unavailable',
    error: { code, message },
  };
}

function exactObject(
  value: JsonValue,
  allowedKeys: string[],
  requiredKeys: string[],
): Record<string, JsonValue> | undefined {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    return undefined;
  }
  const keys = Object.keys(value);
  if (
    keys.some((key) => !allowedKeys.includes(key)) ||
    requiredKeys.some((key) => !(key in value))
  ) {
    return undefined;
  }
  return value;
}

function stringField(
  object: Record<string, JsonValue>,
  key: string,
  required: boolean,
): string | undefined {
  const value = object[key];
  if (value === undefined && !required) return undefined;
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function limitField(object: Record<string, JsonValue>): number | undefined {
  const value = object.limit;
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 100
    ? value
    : undefined;
}

function validateToolInput(
  name: CompilerToolName,
  value: JsonValue,
):
  | { ok: true; value: Record<string, JsonValue> }
  | { ok: false; message: string } {
  const shapes: Record<
    CompilerToolName,
    { allowed: string[]; required: string[] }
  > = {
    compiler_list_index: {
      allowed: ['cursor', 'limit'],
      required: ['limit'],
    },
    compiler_search_index: {
      allowed: ['query', 'filter', 'cursor', 'limit'],
      required: ['query', 'limit'],
    },
    compiler_read_bundle: { allowed: ['id'], required: ['id'] },
    compiler_read_source: { allowed: ['sourceId'], required: ['sourceId'] },
  };
  const shape = shapes[name];
  const object = exactObject(value, shape.allowed, shape.required);
  if (!object) {
    return {
      ok: false,
      message: `${name} received malformed or unauthorized arguments.`,
    };
  }
  if (
    (name === 'compiler_list_index' || name === 'compiler_search_index') &&
    limitField(object) === undefined
  ) {
    return {
      ok: false,
      message: `${name} limit must be an integer from 1 to 100.`,
    };
  }
  for (const optional of ['cursor', 'filter']) {
    if (
      object[optional] !== undefined &&
      stringField(object, optional, false) === undefined
    ) {
      return {
        ok: false,
        message: `${name} ${optional} must be a non-empty string.`,
      };
    }
  }
  const requiredString =
    name === 'compiler_search_index'
      ? 'query'
      : name === 'compiler_read_bundle'
        ? 'id'
        : name === 'compiler_read_source'
          ? 'sourceId'
          : undefined;
  if (
    requiredString !== undefined &&
    stringField(object, requiredString, true) === undefined
  ) {
    return {
      ok: false,
      message: `${name} ${requiredString} must be a non-empty string.`,
    };
  }
  return { ok: true, value: object };
}

function isCompilerToolName(name: string): name is CompilerToolName {
  return (COMPILER_TOOL_NAMES as readonly string[]).includes(name);
}

function validateEnvelope(
  envelope: CompilerResultEnvelope,
  descriptor: CompilerSnapshotDescriptor,
): CompilerResultEnvelope {
  assertPlainData(envelope, 'Compiler result envelope');
  if (envelope.protocolVersion !== COMPILER_PROTOCOL_VERSION) {
    throw new CompilerAccessError(
      'protocol-mismatch',
      `Compiler returned protocol ${envelope.protocolVersion}; expected ${COMPILER_PROTOCOL_VERSION}.`,
    );
  }
  if (
    envelope.snapshotId !== descriptor.snapshotId ||
    envelope.snapshotRevision !== descriptor.revision
  ) {
    throw new CompilerAccessError(
      'snapshot-mismatch',
      'Compiler result does not belong to the run-bound snapshot.',
    );
  }
  if (!COMPILER_RESULT_STATUSES.has(envelope.status)) {
    throw new CompilerAccessError(
      'invalid-envelope',
      `Compiler returned unknown status ${String(envelope.status)}.`,
    );
  }
  if (
    !['complete', 'incomplete', 'not-applicable'].includes(
      envelope.completeness,
    )
  ) {
    throw new CompilerAccessError(
      'invalid-envelope',
      'Compiler result has an invalid completeness value.',
    );
  }
  if (!['retained', 'stale', 'unavailable'].includes(envelope.freshness)) {
    throw new CompilerAccessError(
      'invalid-envelope',
      'Compiler result has an invalid freshness value.',
    );
  }
  if (
    !Array.isArray(envelope.omissions) ||
    !envelope.omissions.every((omission) => typeof omission === 'string') ||
    !Array.isArray(envelope.references) ||
    !envelope.references.every(
      (reference) =>
        typeof reference.canonicalId === 'string' &&
        reference.canonicalId.length > 0 &&
        typeof reference.revision === 'string' &&
        reference.revision.length > 0,
    )
  ) {
    throw new CompilerAccessError(
      'invalid-envelope',
      'Compiler result references or omissions are malformed.',
    );
  }
  if (envelope.status === 'ok' && envelope.content === undefined) {
    throw new CompilerAccessError(
      'invalid-envelope',
      'A successful compiler result must contain explicit content, including an explicit empty result.',
    );
  }
  if (
    envelope.status !== 'ok' &&
    (!envelope.error ||
      envelope.error.code.trim().length === 0 ||
      envelope.error.message.trim().length === 0)
  ) {
    throw new CompilerAccessError(
      'invalid-envelope',
      'A non-success compiler result must include an actionable error.',
    );
  }
  return deepFreeze(clonePlainData(envelope));
}

export function validateCompilerSnapshotDescriptor(
  descriptor: CompilerSnapshotDescriptor,
): CompilerSnapshotDescriptor {
  assertPlainData(descriptor, 'Compiler snapshot descriptor');
  if (descriptor.protocolVersion !== COMPILER_PROTOCOL_VERSION) {
    throw new CompilerAccessError(
      'protocol-mismatch',
      `Compiler snapshot protocol ${descriptor.protocolVersion} is unsupported.`,
    );
  }
  if (
    descriptor.snapshotId.trim().length === 0 ||
    descriptor.revision.trim().length === 0 ||
    descriptor.openedAt.trim().length === 0
  ) {
    throw new CompilerAccessError(
      'invalid-snapshot-descriptor',
      'Compiler snapshot identity, revision, and openedAt are required.',
    );
  }
  if (
    !Array.isArray(descriptor.capabilities) ||
    descriptor.capabilities.some(
      (capability) => !COMPILER_CAPABILITIES.has(capability),
    ) ||
    new Set(descriptor.capabilities).size !== descriptor.capabilities.length
  ) {
    throw new CompilerAccessError(
      'invalid-snapshot-descriptor',
      'Compiler snapshot capabilities are invalid or duplicated.',
    );
  }
  return deepFreeze(clonePlainData(descriptor));
}

export interface ToolDispatchResult {
  result: CompilerResultEnvelope;
  duplicate: boolean;
}

export class CompilerToolDispatcher {
  readonly #delivered = new Map<
    string,
    { signature: string; result: CompilerResultEnvelope; deliveries: number }
  >();
  #callCount = 0;

  public constructor(
    private readonly session: CompilerSnapshotSession | undefined,
    private readonly limits: ReviewResourceLimits,
    private readonly signal: AbortSignal,
  ) {}

  public async dispatch(
    toolCallId: string,
    name: string,
    argumentsValue: JsonValue,
  ): Promise<ToolDispatchResult> {
    const signature = `${name}:${stableStringify(argumentsValue)}`;
    const delivered = this.#delivered.get(toolCallId);
    if (delivered) {
      delivered.deliveries += 1;
      if (delivered.signature === signature) {
        return { result: delivered.result, duplicate: true };
      }
      return {
        result: errorEnvelope(
          this.session?.descriptor,
          'invalid-request',
          'conflicting-tool-call-id',
          `Tool call ID ${toolCallId} was reused with different arguments.`,
        ),
        duplicate: true,
      };
    }
    this.#callCount += 1;
    if (this.#callCount > this.limits.maxToolCalls) {
      const result = errorEnvelope(
        this.session?.descriptor,
        'limit-exceeded',
        'tool-count-limit',
        `Tool count exceeded configured maximum ${this.limits.maxToolCalls}.`,
      );
      this.#delivered.set(toolCallId, { signature, result, deliveries: 1 });
      return { result, duplicate: false };
    }
    if (this.signal.aborted) {
      const result = errorEnvelope(
        this.session?.descriptor,
        'cancelled',
        'attempt-cancelled',
        'The review attempt was cancelled before the tool could run.',
      );
      this.#delivered.set(toolCallId, { signature, result, deliveries: 1 });
      return { result, duplicate: false };
    }
    if (!isCompilerToolName(name)) {
      const result = errorEnvelope(
        this.session?.descriptor,
        'invalid-request',
        'unknown-or-write-tool',
        `Tool ${name} is not an authorized read-only compiler operation.`,
      );
      this.#delivered.set(toolCallId, { signature, result, deliveries: 1 });
      return { result, duplicate: false };
    }
    if (!this.session) {
      const result = errorEnvelope(
        undefined,
        'unavailable',
        'compiler-unavailable',
        'Compiler access was requested but no immutable snapshot is available.',
      );
      this.#delivered.set(toolCallId, { signature, result, deliveries: 1 });
      return { result, duplicate: false };
    }
    if (!this.session.descriptor.capabilities.includes(capabilityFor(name))) {
      const result = errorEnvelope(
        this.session.descriptor,
        'unauthorized',
        'capability-unavailable',
        `Snapshot does not authorize ${name}.`,
      );
      this.#delivered.set(toolCallId, { signature, result, deliveries: 1 });
      return { result, duplicate: false };
    }
    const validated = validateToolInput(name, argumentsValue);
    if (!validated.ok) {
      const result = errorEnvelope(
        this.session.descriptor,
        'invalid-request',
        'malformed-tool-input',
        validated.message,
      );
      this.#delivered.set(toolCallId, { signature, result, deliveries: 1 });
      return { result, duplicate: false };
    }

    let result: CompilerResultEnvelope;
    try {
      result = validateEnvelope(
        await invokeTool(this.session, name, validated.value, this.signal),
        this.session.descriptor,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = errorEnvelope(
        this.session.descriptor,
        this.signal.aborted ? 'cancelled' : 'unavailable',
        error instanceof CompilerAccessError
          ? error.code
          : 'compiler-call-failed',
        message,
      );
    }
    if (plainDataByteLength(result) > this.limits.maxToolResultBytes) {
      result = errorEnvelope(
        this.session.descriptor,
        'limit-exceeded',
        'tool-result-byte-limit',
        `Compiler result exceeded maxToolResultBytes (${this.limits.maxToolResultBytes}); no content was truncated.`,
      );
    }
    this.#delivered.set(toolCallId, { signature, result, deliveries: 1 });
    return { result, duplicate: false };
  }
}

function capabilityFor(name: CompilerToolName) {
  const mapping = {
    compiler_list_index: 'list-index',
    compiler_search_index: 'search-index',
    compiler_read_bundle: 'read-bundle',
    compiler_read_source: 'read-source',
  } as const;
  return mapping[name];
}

async function invokeTool(
  session: CompilerSnapshotSession,
  name: CompilerToolName,
  input: Record<string, JsonValue>,
  signal: AbortSignal,
): Promise<CompilerResultEnvelope> {
  switch (name) {
    case 'compiler_list_index':
      return session.listIndex(
        {
          limit: input.limit as number,
          ...(typeof input.cursor === 'string' ? { cursor: input.cursor } : {}),
        },
        signal,
      );
    case 'compiler_search_index':
      return session.searchIndex(
        {
          query: input.query as string,
          limit: input.limit as number,
          ...(typeof input.filter === 'string' ? { filter: input.filter } : {}),
          ...(typeof input.cursor === 'string' ? { cursor: input.cursor } : {}),
        },
        signal,
      );
    case 'compiler_read_bundle':
      return session.readBundle({ id: input.id as string }, signal);
    case 'compiler_read_source':
      return session.readSource({ sourceId: input.sourceId as string }, signal);
  }
}

export class UnavailableCompilerProvider implements CompilerProvider {
  public constructor(
    private readonly reason = 'No compiler provider is configured.',
  ) {}

  public async openSnapshot(): Promise<CompilerSnapshotSession> {
    await Promise.resolve();
    throw new CompilerAccessError('compiler-unavailable', this.reason);
  }
}

export interface SyntheticCompilerSource {
  id: string;
  revision: string;
  content: string;
  authorized: boolean;
  retained: boolean;
}

export interface SyntheticCompilerFixture {
  descriptor: Omit<CompilerSnapshotDescriptor, 'protocolVersion' | 'openedAt'>;
  entries: CompilerIndexEntry[];
  bundles: CompilerCounterArgumentBundle[];
  sources: SyntheticCompilerSource[];
}

function page<T>(values: T[], cursor: string | undefined, limit: number) {
  const start = cursor === undefined ? 0 : Number(cursor);
  if (!Number.isSafeInteger(start) || start < 0 || start > values.length) {
    return undefined;
  }
  const items = values.slice(start, start + limit);
  const next = start + items.length;
  return {
    items,
    ...(next < values.length ? { nextCursor: String(next) } : {}),
  };
}

export class SyntheticCompilerProvider implements CompilerProvider {
  readonly #fixture: SyntheticCompilerFixture;

  public constructor(fixture: SyntheticCompilerFixture) {
    this.#fixture = deepFreeze(clonePlainData(fixture));
  }

  public async openSnapshot(input: {
    workspaceId: string;
    requestedSnapshotId?: string;
    signal: AbortSignal;
  }): Promise<CompilerSnapshotSession> {
    await Promise.resolve();
    if (input.signal.aborted) {
      throw new CompilerAccessError(
        'cancelled',
        'Snapshot opening was cancelled.',
      );
    }
    if (
      input.requestedSnapshotId !== undefined &&
      input.requestedSnapshotId !== this.#fixture.descriptor.snapshotId
    ) {
      throw new CompilerAccessError(
        'stale-snapshot',
        `Requested compiler snapshot ${input.requestedSnapshotId} is not retained.`,
      );
    }
    const openedAt = new Date(0).toISOString();
    const descriptor: CompilerSnapshotDescriptor = deepFreeze({
      protocolVersion: COMPILER_PROTOCOL_VERSION,
      ...this.#fixture.descriptor,
      capabilities: [...this.#fixture.descriptor.capabilities],
      openedAt,
    });
    const entries = clonePlainData(this.#fixture.entries);
    const bundles = new Map(
      clonePlainData(this.#fixture.bundles).map((bundle) => [
        bundle.id,
        bundle,
      ]),
    );
    const sources = new Map(
      clonePlainData(this.#fixture.sources).map((source) => [
        source.id,
        source,
      ]),
    );
    const envelope = (
      fields: Omit<
        CompilerResultEnvelope,
        'protocolVersion' | 'snapshotId' | 'snapshotRevision'
      >,
    ): CompilerResultEnvelope => ({
      protocolVersion: COMPILER_PROTOCOL_VERSION,
      snapshotId: descriptor.snapshotId,
      snapshotRevision: descriptor.revision,
      ...fields,
    });

    return deepFreeze({
      descriptor,
      listIndex: async (request, signal) => {
        await Promise.resolve();
        if (signal.aborted) {
          return errorEnvelope(
            descriptor,
            'cancelled',
            'attempt-cancelled',
            'Index listing was cancelled.',
          );
        }
        const result = page(entries, request.cursor, request.limit);
        if (!result) {
          return errorEnvelope(
            descriptor,
            'invalid-request',
            'invalid-cursor',
            'Index cursor is invalid for this retained snapshot.',
          );
        }
        return envelope({
          status: 'ok',
          content: result as unknown as JsonValue,
          references: result.items.map((entry) => ({
            canonicalId: entry.id,
            revision: descriptor.revision,
          })),
          completeness: 'complete',
          omissions: [],
          freshness: 'retained',
        });
      },
      searchIndex: async (request, signal) => {
        await Promise.resolve();
        if (signal.aborted) {
          return errorEnvelope(
            descriptor,
            'cancelled',
            'attempt-cancelled',
            'Index search was cancelled.',
          );
        }
        const query = request.query.toLocaleLowerCase();
        const matching = entries.filter((entry) => {
          const filterMatches =
            request.filter === undefined || entry.kind === request.filter;
          return (
            filterMatches &&
            `${entry.title}\n${entry.summary}`
              .toLocaleLowerCase()
              .includes(query)
          );
        });
        const result = page(matching, request.cursor, request.limit);
        if (!result) {
          return errorEnvelope(
            descriptor,
            'invalid-request',
            'invalid-cursor',
            'Search cursor is invalid for this retained snapshot.',
          );
        }
        return envelope({
          status: 'ok',
          content: result as unknown as JsonValue,
          references: result.items.map((entry) => ({
            canonicalId: entry.id,
            revision: descriptor.revision,
          })),
          completeness: 'complete',
          omissions: [],
          freshness: 'retained',
        });
      },
      readBundle: async (request, signal) => {
        await Promise.resolve();
        if (signal.aborted) {
          return errorEnvelope(
            descriptor,
            'cancelled',
            'attempt-cancelled',
            'Bundle read was cancelled.',
          );
        }
        const bundle = bundles.get(request.id);
        if (!bundle) {
          return errorEnvelope(
            descriptor,
            'not-found',
            'record-not-found',
            `Compiler record ${request.id} is absent from the retained snapshot.`,
          );
        }
        const omissions = [
          ...bundle.missingMaterial,
          ...bundle.dependentMaterial,
        ];
        return envelope({
          status: 'ok',
          content: bundle as unknown as JsonValue,
          references: [
            { canonicalId: bundle.id, revision: descriptor.revision },
          ],
          completeness: omissions.length === 0 ? 'complete' : 'incomplete',
          omissions,
          freshness: 'retained',
        });
      },
      readSource: async (request, signal) => {
        await Promise.resolve();
        if (signal.aborted) {
          return errorEnvelope(
            descriptor,
            'cancelled',
            'attempt-cancelled',
            'Source read was cancelled.',
          );
        }
        const source = sources.get(request.sourceId);
        if (!source) {
          return errorEnvelope(
            descriptor,
            'source-unavailable',
            'source-not-retained',
            `Source ${request.sourceId} is unavailable in the retained snapshot.`,
          );
        }
        if (!source.authorized) {
          return errorEnvelope(
            descriptor,
            'unauthorized',
            'source-unauthorized',
            `Source ${request.sourceId} is outside the authorized snapshot view.`,
          );
        }
        if (!source.retained || source.revision !== descriptor.revision) {
          return errorEnvelope(
            descriptor,
            'stale-snapshot',
            'source-revision-unavailable',
            `Source ${request.sourceId} is not retained at revision ${descriptor.revision}.`,
          );
        }
        return envelope({
          status: 'ok',
          content: { sourceId: source.id, content: source.content },
          references: [{ canonicalId: source.id, revision: source.revision }],
          completeness: 'complete',
          omissions: [],
          freshness: 'retained',
        });
      },
    });
  }
}
