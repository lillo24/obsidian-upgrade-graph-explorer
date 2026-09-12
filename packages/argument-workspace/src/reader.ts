import { assembleArgumentBundle } from './bundle';
import {
  canonicalJson,
  captureArgumentLibrarySnapshot,
  clonePlainData,
  contentFingerprint,
  sameSnapshot,
} from './canonical';
import { buildDescriptiveIndex, readDescriptiveIndex } from './search';
import {
  serializeArgumentLibrary,
  validatePortableArgumentSnapshot,
} from './serialization';
import type {
  ArgumentLibrary,
  ArgumentLibrarySnapshot,
  ConsultationReceipt,
  IndexPage,
  KnowledgeCall,
  KnowledgeReader,
  LinkedTheorySourcePayload,
  LinkedTheorySourceProvider,
  LinkedTheorySourceProviderResult,
  LinkedTheorySourceReadRequest,
  ListIndexRequest,
  ReadArgumentBundleRequest,
  ReadArgumentBundleResult,
  ReadLinkedTheorySourceResult,
  ReturnedRecordIdentity,
  SearchIndexRequest,
  SnapshotBoundResult,
  SnapshotDescriptor,
  TheorySourceReference,
} from './types';
import { KNOWLEDGE_READER_CONTRACT_VERSION } from './types';
import { assertValidArgumentLibrary } from './validation';

export interface KnowledgeReaderOptions {
  readonly sourceProvider?: LinkedTheorySourceProvider;
  readonly now?: () => string;
}

type PlainRecord = Record<string, unknown>;

function isRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactFields(
  value: PlainRecord,
  required: readonly string[],
  optional: readonly string[],
): readonly string[] {
  const issues: string[] = [];
  const allowed = new Set([...required, ...optional]);
  for (const field of required) {
    if (!Object.hasOwn(value, field))
      issues.push(`Missing required field "${field}".`);
  }
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) issues.push(`Unknown field "${field}".`);
  }
  return issues;
}

function snapshotMatches(
  actual: SnapshotDescriptor,
  expected: unknown,
): expected is SnapshotDescriptor {
  return (
    isRecord(expected) &&
    sameSnapshot(actual, expected as unknown as SnapshotDescriptor)
  );
}

function expectedSnapshotResult(
  actual: SnapshotDescriptor,
  expected: unknown,
):
  | { readonly ok: true }
  | { readonly ok: false; readonly expected: SnapshotDescriptor } {
  if (expected === undefined) return { ok: true };
  return snapshotMatches(actual, expected)
    ? { ok: true }
    : { ok: false, expected: clonePlainData(expected as SnapshotDescriptor) };
}

function boundedInteger(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
  issues: string[],
): void {
  if (
    value !== undefined &&
    (!Number.isSafeInteger(value) ||
      Number(value) < minimum ||
      Number(value) > maximum)
  ) {
    issues.push(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
}

function validateExpectedSnapshot(value: unknown, issues: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.push('expectedSnapshot must be a snapshot descriptor.');
    return;
  }
  issues.push(
    ...exactFields(
      value,
      ['libraryId', 'schemaVersion', 'libraryRevision', 'contentFingerprint'],
      [],
    ).map((entry) => `expectedSnapshot: ${entry}`),
  );
  if (typeof value.libraryId !== 'string' || value.libraryId.trim() === '') {
    issues.push('expectedSnapshot.libraryId must be a non-empty string.');
  }
  if (value.schemaVersion !== 1) {
    issues.push('expectedSnapshot.schemaVersion must be 1.');
  }
  boundedInteger(
    value.libraryRevision,
    'expectedSnapshot.libraryRevision',
    1,
    Number.MAX_SAFE_INTEGER,
    issues,
  );
  if (!isRecord(value.contentFingerprint)) {
    issues.push('expectedSnapshot.contentFingerprint must be a fingerprint.');
  } else if (
    value.contentFingerprint.algorithm !== 'sha256-canonical-json-v1' ||
    typeof value.contentFingerprint.value !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(value.contentFingerprint.value)
  ) {
    issues.push('expectedSnapshot.contentFingerprint is invalid.');
  }
}

function validateIndexInput(
  value: unknown,
  search: boolean,
):
  | { readonly valid: true; readonly value: PlainRecord }
  | { readonly valid: false; readonly issues: readonly string[] } {
  if (!isRecord(value))
    return { valid: false, issues: ['Expected an input object.'] };
  const issues = [
    ...exactFields(value, search ? ['query'] : [], [
      'limit',
      'cursor',
      'includeArchived',
      'expectedSnapshot',
    ]),
  ];
  if (search && typeof value.query !== 'string')
    issues.push('query must be a string.');
  boundedInteger(value.limit, 'limit', 1, 100, issues);
  if (
    value.cursor !== undefined &&
    (typeof value.cursor !== 'string' || value.cursor === '')
  ) {
    issues.push('cursor must be a non-empty string.');
  }
  if (
    value.includeArchived !== undefined &&
    typeof value.includeArchived !== 'boolean'
  ) {
    issues.push('includeArchived must be a boolean.');
  }
  validateExpectedSnapshot(value.expectedSnapshot, issues);
  return issues.length === 0
    ? { valid: true, value }
    : { valid: false, issues };
}

function validateBundleInput(
  value: unknown,
):
  | { readonly valid: true; readonly value: ReadArgumentBundleRequest }
  | { readonly valid: false; readonly issues: readonly string[] } {
  if (!isRecord(value))
    return { valid: false, issues: ['Expected an input object.'] };
  const issues = [
    ...exactFields(
      value,
      ['id'],
      ['kind', 'maxRecords', 'maxDepth', 'expectedSnapshot'],
    ),
  ];
  if (typeof value.id !== 'string' || value.id.trim() === '')
    issues.push('id must be a non-empty string.');
  if (
    value.kind !== undefined &&
    value.kind !== 'topic' &&
    value.kind !== 'axiom' &&
    value.kind !== 'counter-argument'
  ) {
    issues.push('kind is unsupported.');
  }
  boundedInteger(value.maxRecords, 'maxRecords', 1, 500, issues);
  boundedInteger(value.maxDepth, 'maxDepth', 0, 32, issues);
  validateExpectedSnapshot(value.expectedSnapshot, issues);
  return issues.length === 0
    ? { valid: true, value: value as unknown as ReadArgumentBundleRequest }
    : { valid: false, issues };
}

function validateSourceInput(
  value: unknown,
):
  | { readonly valid: true; readonly value: LinkedTheorySourceReadRequest }
  | { readonly valid: false; readonly issues: readonly string[] } {
  if (!isRecord(value))
    return { valid: false, issues: ['Expected an input object.'] };
  const issues = [
    ...exactFields(
      value,
      ['sourceReferenceId'],
      [
        'expectedSourceVersion',
        'requireExactVersion',
        'maxCharacters',
        'expectedSnapshot',
      ],
    ),
  ];
  if (
    typeof value.sourceReferenceId !== 'string' ||
    value.sourceReferenceId.trim() === ''
  ) {
    issues.push('sourceReferenceId must be a non-empty registered ID.');
  }
  if (
    value.expectedSourceVersion !== undefined &&
    (typeof value.expectedSourceVersion !== 'string' ||
      value.expectedSourceVersion.trim() === '')
  ) {
    issues.push('expectedSourceVersion must be a non-empty string.');
  }
  if (
    value.requireExactVersion !== undefined &&
    typeof value.requireExactVersion !== 'boolean'
  ) {
    issues.push('requireExactVersion must be a boolean.');
  }
  boundedInteger(value.maxCharacters, 'maxCharacters', 1, 100_000, issues);
  validateExpectedSnapshot(value.expectedSnapshot, issues);
  return issues.length === 0
    ? { valid: true, value: value as unknown as LinkedTheorySourceReadRequest }
    : { valid: false, issues };
}

function receipt(
  operation: ConsultationReceipt['operation'],
  normalizedRequest: Readonly<Record<string, unknown>>,
  snapshot: SnapshotDescriptor,
  returnedRecords: readonly ReturnedRecordIdentity[],
  payload: unknown,
  options: {
    readonly sourceObservations?: ConsultationReceipt['sourceObservations'];
    readonly completeness?: ConsultationReceipt['completeness'];
    readonly omissions?: readonly string[];
    readonly warnings?: readonly string[];
    readonly observedAt?: string;
  } = {},
): ConsultationReceipt {
  return {
    contractVersion: KNOWLEDGE_READER_CONTRACT_VERSION,
    operation,
    normalizedRequest: clonePlainData(normalizedRequest),
    snapshot,
    returnedRecords: clonePlainData(returnedRecords),
    sourceObservations: clonePlainData(options.sourceObservations ?? []),
    payloadFingerprint: contentFingerprint(payload),
    completeness: options.completeness ?? 'complete',
    omissions: [...(options.omissions ?? [])],
    warnings: [...(options.warnings ?? [])],
    ...(options.observedAt === undefined
      ? {}
      : { observedAt: options.observedAt }),
  };
}

function sourceReferences(library: ArgumentLibrary): ReadonlyMap<
  string,
  {
    readonly locator: TheorySourceReference;
    readonly owner: ReturnedRecordIdentity;
  }
> {
  const result = new Map<
    string,
    { locator: TheorySourceReference; owner: ReturnedRecordIdentity }
  >();
  for (const axiom of library.axioms) {
    for (const locator of axiom.sourceReferences) {
      result.set(locator.id, {
        locator,
        owner: { kind: 'axiom', id: axiom.id, revision: axiom.revision },
      });
    }
  }
  for (const counter of library.counterArguments) {
    for (const locator of counter.sourceReferences) {
      result.set(locator.id, {
        locator,
        owner: {
          kind: 'counter-argument',
          id: counter.id,
          revision: counter.revision,
        },
      });
    }
  }
  return result;
}

function sameSpan(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function freshness(
  locator: TheorySourceReference,
  result: Extract<LinkedTheorySourceProviderResult, { readonly status: 'ok' }>,
  actualFingerprint: ReturnType<typeof contentFingerprint>,
): 'matches-recorded-version' | 'changed' | 'unknown' {
  const recorded = locator.recordedVersion;
  if (recorded === undefined) return 'unknown';
  if (
    recorded.sourceVersion !== undefined &&
    result.sourceVersion !== undefined
  ) {
    return recorded.sourceVersion === result.sourceVersion
      ? 'matches-recorded-version'
      : 'changed';
  }
  if (
    recorded.contentFingerprint !== undefined &&
    recorded.fingerprintScope === 'span' &&
    recorded.span !== undefined &&
    result.location.span !== undefined &&
    sameSpan(recorded.span, result.location.span)
  ) {
    return recorded.contentFingerprint.value === actualFingerprint.value
      ? 'matches-recorded-version'
      : 'changed';
  }
  return 'unknown';
}

function normalizedSourceRequest(
  input: LinkedTheorySourceReadRequest,
): Readonly<Record<string, unknown>> {
  return {
    sourceReferenceId: input.sourceReferenceId,
    requireExactVersion: input.requireExactVersion ?? false,
    maxCharacters: input.maxCharacters ?? 12_000,
    ...(input.expectedSourceVersion === undefined
      ? {}
      : { expectedSourceVersion: input.expectedSourceVersion }),
  };
}

function providerSuccessIsValid(
  result: Extract<LinkedTheorySourceProviderResult, { readonly status: 'ok' }>,
): boolean {
  return (
    typeof result.text === 'string' &&
    (result.sourceSpaceId === undefined ||
      (typeof result.sourceSpaceId === 'string' &&
        result.sourceSpaceId.trim() !== '')) &&
    (result.sourceVersion === undefined ||
      (typeof result.sourceVersion === 'string' &&
        result.sourceVersion.trim() !== '')) &&
    typeof result.complete === 'boolean' &&
    Array.isArray(result.omissions) &&
    result.omissions.every((value) => typeof value === 'string') &&
    (result.complete
      ? result.omissions.length === 0
      : result.omissions.length > 0) &&
    typeof result.observedAt === 'string' &&
    Number.isFinite(Date.parse(result.observedAt)) &&
    typeof result.location === 'object' &&
    result.location !== null &&
    typeof result.location.path === 'string' &&
    result.location.path !== '' &&
    (result.location.heading === undefined ||
      (typeof result.location.heading === 'string' &&
        result.location.heading.trim() !== '')) &&
    (result.location.block === undefined ||
      (typeof result.location.block === 'string' &&
        result.location.block.trim() !== '')) &&
    !result.location.path.startsWith('/') &&
    !result.location.path.includes('\\') &&
    !/^[A-Za-z]:\//u.test(result.location.path) &&
    !result.location.path
      .split('/')
      .some((segment) => segment === '' || segment === '.' || segment === '..')
  );
}

const PROVIDER_FAILURE_STATUSES = new Set([
  'source-missing',
  'heading-unresolved',
  'heading-ambiguous',
  'denied',
  'wrong-binding',
  'version-unavailable',
  'unsupported',
]);

function sourceFailure(
  status: Exclude<
    ReadLinkedTheorySourceResult,
    { readonly status: 'ok' }
  >['status'],
  message: string,
  input: LinkedTheorySourceReadRequest,
  snapshot: SnapshotDescriptor,
  sourceReferenceId: string,
  locator: TheorySourceReference | undefined,
  owner: ReturnedRecordIdentity | undefined,
  observedAt?: string,
): ReadLinkedTheorySourceResult {
  if (status === 'snapshot-mismatch' || status === 'invalid-request') {
    throw new Error('Internal source failure status is not receiptable.');
  }
  const payload = {
    status,
    sourceReferenceId,
    ...(locator === undefined ? {} : { locator }),
    message,
    snapshot,
  };
  return {
    ...payload,
    receipt: receipt(
      'read-linked-theory-source',
      normalizedSourceRequest(input),
      snapshot,
      owner === undefined ? [] : [owner],
      payload,
      {
        completeness: 'unavailable',
        warnings: [message],
        ...(observedAt === undefined ? {} : { observedAt }),
      },
    ),
  } as ReadLinkedTheorySourceResult;
}

export function createKnowledgeReader(
  retainedSnapshot: ArgumentLibrarySnapshot,
  options: KnowledgeReaderOptions = {},
): KnowledgeReader {
  const validated = assertValidArgumentLibrary(retainedSnapshot.library);
  const snapshot = captureArgumentLibrarySnapshot(validated);
  if (!sameSnapshot(retainedSnapshot.descriptor, snapshot.descriptor)) {
    throw new Error(
      'Retained Argument Library descriptor conflicts with its supplied content.',
    );
  }
  const library = snapshot.library;
  const descriptor = snapshot.descriptor;
  const index = buildDescriptiveIndex(library, descriptor);
  const references = sourceReferences(library);
  const now = options.now ?? (() => new Date().toISOString());

  const readIndex = (
    operation: 'list-index' | 'search-index',
    rawInput: unknown,
    query: string,
  ): SnapshotBoundResult<IndexPage> => {
    const validation = validateIndexInput(
      rawInput,
      operation === 'search-index',
    );
    if (!validation.valid)
      return { status: 'invalid-request', issues: validation.issues };
    const expected = expectedSnapshotResult(
      descriptor,
      validation.value.expectedSnapshot,
    );
    if (!expected.ok) {
      return {
        status: 'snapshot-mismatch',
        expected: expected.expected,
        actual: descriptor,
      };
    }
    const limit = (validation.value.limit as number | undefined) ?? 20;
    const includeArchived =
      (validation.value.includeArchived as boolean | undefined) ?? false;
    const page = readDescriptiveIndex(index, {
      query,
      limit,
      includeArchived,
      ...(validation.value.cursor === undefined
        ? {}
        : { cursor: validation.value.cursor as string }),
    });
    if ('error' in page)
      return { status: 'invalid-request', issues: [page.error] };
    const normalizedRequest: Readonly<Record<string, unknown>> = {
      query,
      limit,
      includeArchived,
      ...(validation.value.cursor === undefined
        ? {}
        : { cursor: validation.value.cursor }),
    };
    const payload = {
      candidates: page.candidates,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      snapshot: descriptor,
    };
    return {
      status: 'ok',
      value: clonePlainData({
        ...payload,
        receipt: receipt(
          operation,
          normalizedRequest,
          descriptor,
          page.candidates.map(({ kind, id, revision }) => ({
            kind,
            id,
            revision,
          })),
          payload,
        ),
      }),
    };
  };

  return {
    snapshot: descriptor,
    listIndex(input: ListIndexRequest = {}) {
      return readIndex('list-index', input, '');
    },
    searchIndex(input: SearchIndexRequest) {
      const query =
        isRecord(input) && typeof input.query === 'string' ? input.query : '';
      return readIndex('search-index', input, query);
    },
    readArgumentBundle(
      rawInput: ReadArgumentBundleRequest,
    ): ReadArgumentBundleResult {
      const validation = validateBundleInput(rawInput);
      if (!validation.valid)
        return { status: 'invalid-request', issues: validation.issues };
      const expected = expectedSnapshotResult(
        descriptor,
        validation.value.expectedSnapshot,
      );
      if (!expected.ok) {
        return {
          status: 'snapshot-mismatch',
          expected: expected.expected,
          actual: descriptor,
        };
      }
      const assembled = assembleArgumentBundle(
        library,
        descriptor,
        validation.value,
      );
      if (
        assembled.status === 'not-found' ||
        assembled.status === 'ambiguous-selector'
      ) {
        return assembled;
      }
      const normalizedRequest: Readonly<Record<string, unknown>> = {
        id: validation.value.id,
        ...(validation.value.kind === undefined
          ? {}
          : { kind: validation.value.kind }),
        maxRecords: validation.value.maxRecords ?? 100,
        maxDepth: validation.value.maxDepth ?? 8,
      };
      if (assembled.status === 'limit-exceeded') {
        const payload = {
          status: 'limit-exceeded' as const,
          snapshot: descriptor,
          requiredRecordIds: assembled.requiredRecordIds,
          omissions: assembled.omissions,
        };
        return clonePlainData({
          ...payload,
          receipt: receipt(
            'read-argument-bundle',
            normalizedRequest,
            descriptor,
            assembled.returnedRecords,
            payload,
            { completeness: 'incomplete', omissions: assembled.omissions },
          ),
        });
      }
      const payload = assembled.value;
      return {
        status: 'ok',
        value: clonePlainData({
          ...payload,
          receipt: receipt(
            'read-argument-bundle',
            normalizedRequest,
            descriptor,
            assembled.returnedRecords,
            payload,
            { warnings: payload.completeness.warnings },
          ),
        }),
      };
    },
    async readLinkedTheorySource(rawInput: LinkedTheorySourceReadRequest) {
      const validation = validateSourceInput(rawInput);
      if (!validation.valid)
        return {
          status: 'invalid-request' as const,
          issues: validation.issues,
        };
      const input = validation.value;
      const expected = expectedSnapshotResult(
        descriptor,
        input.expectedSnapshot,
      );
      if (!expected.ok) {
        return {
          status: 'snapshot-mismatch' as const,
          expected: expected.expected,
          actual: descriptor,
        };
      }
      const reference = references.get(input.sourceReferenceId);
      if (reference === undefined) {
        return sourceFailure(
          'source-reference-not-found',
          'The source-reference ID is not registered in this library snapshot.',
          input,
          descriptor,
          input.sourceReferenceId,
          undefined,
          undefined,
        );
      }
      const { locator, owner } = reference;
      const provider = options.sourceProvider;
      if (provider === undefined) {
        return sourceFailure(
          'provider-unavailable',
          'No authorized linked-source provider is bound to this reader.',
          input,
          descriptor,
          input.sourceReferenceId,
          locator,
          owner,
        );
      }
      if (
        locator.sourceSpaceHint !== undefined &&
        locator.sourceSpaceHint !== provider.sourceSpaceId
      ) {
        return sourceFailure(
          'wrong-binding',
          'The registered source reference belongs to a different source binding.',
          input,
          descriptor,
          input.sourceReferenceId,
          locator,
          owner,
        );
      }
      const requireExactVersion = input.requireExactVersion ?? false;
      const effectiveExpectedVersion =
        input.expectedSourceVersion ??
        (requireExactVersion
          ? locator.recordedVersion?.sourceVersion
          : undefined);
      if (requireExactVersion && effectiveExpectedVersion === undefined) {
        return sourceFailure(
          'version-unavailable',
          'An exact read was requested, but neither the call nor recorded locator identifies a source version.',
          input,
          descriptor,
          input.sourceReferenceId,
          locator,
          owner,
          now(),
        );
      }
      let providerResult: unknown;
      try {
        providerResult = await provider.read({
          sourceReferenceId: input.sourceReferenceId,
          locator: clonePlainData(locator),
          ...(effectiveExpectedVersion === undefined
            ? {}
            : { expectedSourceVersion: effectiveExpectedVersion }),
          requireExactVersion,
          maxCharacters: input.maxCharacters ?? 12_000,
        });
      } catch (error: unknown) {
        return sourceFailure(
          'provider-error',
          `Linked-source provider failed: ${error instanceof Error ? error.message : String(error)}`,
          input,
          descriptor,
          input.sourceReferenceId,
          locator,
          owner,
          now(),
        );
      }
      if (
        !isRecord(providerResult) ||
        typeof providerResult.status !== 'string'
      ) {
        return sourceFailure(
          'provider-error',
          'Linked-source provider returned an invalid result.',
          input,
          descriptor,
          input.sourceReferenceId,
          locator,
          owner,
          now(),
        );
      }
      if (providerResult.status !== 'ok') {
        if (
          !PROVIDER_FAILURE_STATUSES.has(providerResult.status) ||
          typeof providerResult.message !== 'string' ||
          providerResult.message.trim() === ''
        ) {
          return sourceFailure(
            'provider-error',
            'Linked-source provider returned an invalid failure payload.',
            input,
            descriptor,
            input.sourceReferenceId,
            locator,
            owner,
            now(),
          );
        }
        return sourceFailure(
          providerResult.status as Exclude<
            LinkedTheorySourceProviderResult['status'],
            'ok'
          >,
          providerResult.message,
          input,
          descriptor,
          input.sourceReferenceId,
          locator,
          owner,
          now(),
        );
      }
      const successResult = providerResult as unknown as Extract<
        LinkedTheorySourceProviderResult,
        { readonly status: 'ok' }
      >;
      if (!providerSuccessIsValid(successResult)) {
        return sourceFailure(
          'provider-error',
          'Linked-source provider returned an invalid success payload.',
          input,
          descriptor,
          input.sourceReferenceId,
          locator,
          owner,
          now(),
        );
      }
      if (successResult.text.length > (input.maxCharacters ?? 12_000)) {
        return sourceFailure(
          'provider-error',
          'Linked-source provider exceeded the requested character limit.',
          input,
          descriptor,
          input.sourceReferenceId,
          locator,
          owner,
          successResult.observedAt,
        );
      }
      if (
        provider.sourceSpaceId !== undefined &&
        successResult.sourceSpaceId !== provider.sourceSpaceId
      ) {
        return sourceFailure(
          'wrong-binding',
          'The provider result does not match the reader source binding.',
          input,
          descriptor,
          input.sourceReferenceId,
          locator,
          owner,
          successResult.observedAt,
        );
      }
      if (effectiveExpectedVersion !== undefined) {
        if (successResult.sourceVersion === undefined) {
          return sourceFailure(
            'version-unavailable',
            'The provider cannot establish the requested source version.',
            input,
            descriptor,
            input.sourceReferenceId,
            locator,
            owner,
            successResult.observedAt,
          );
        }
        if (successResult.sourceVersion !== effectiveExpectedVersion) {
          return sourceFailure(
            'version-mismatch',
            `Expected source version "${effectiveExpectedVersion}" but observed "${successResult.sourceVersion}".`,
            input,
            descriptor,
            input.sourceReferenceId,
            locator,
            owner,
            successResult.observedAt,
          );
        }
      }
      const actualFingerprint = contentFingerprint(successResult.text);
      const payloadWithoutReceipt = {
        sourceReferenceId: input.sourceReferenceId,
        locator,
        ...(successResult.sourceSpaceId === undefined
          ? {}
          : { sourceSpaceId: successResult.sourceSpaceId }),
        location: successResult.location,
        text: successResult.text,
        ...(successResult.sourceVersion === undefined
          ? {}
          : { sourceVersion: successResult.sourceVersion }),
        contentFingerprint: actualFingerprint,
        fingerprintScope: 'returned-excerpt' as const,
        ...(locator.recordedVersion === undefined
          ? {}
          : { recordedVersion: locator.recordedVersion }),
        freshness: freshness(locator, successResult, actualFingerprint),
        complete: successResult.complete,
        omissions: successResult.omissions,
        observedAt: successResult.observedAt,
        snapshot: descriptor,
      };
      const sourceObservation = {
        sourceReferenceId: input.sourceReferenceId,
        ...(successResult.sourceVersion === undefined
          ? {}
          : { sourceVersion: successResult.sourceVersion }),
        contentFingerprint: actualFingerprint,
      };
      const value: LinkedTheorySourcePayload = {
        ...payloadWithoutReceipt,
        receipt: receipt(
          'read-linked-theory-source',
          normalizedSourceRequest(input),
          descriptor,
          [owner],
          { ...payloadWithoutReceipt, observedAt: undefined },
          {
            sourceObservations: [sourceObservation],
            completeness: successResult.complete ? 'complete' : 'incomplete',
            omissions: successResult.omissions,
            observedAt: successResult.observedAt,
          },
        ),
      };
      return { status: 'ok' as const, value: clonePlainData(value) };
    },
    exportRetainedSnapshot() {
      return serializeArgumentLibrary(library);
    },
  };
}

export function createKnowledgeReaderFromLibrary(
  library: ArgumentLibrary,
  options: KnowledgeReaderOptions = {},
): KnowledgeReader {
  return createKnowledgeReader(
    captureArgumentLibrarySnapshot(library),
    options,
  );
}

export function createKnowledgeReaderFromJson(
  source: string,
  options: KnowledgeReaderOptions = {},
): KnowledgeReader {
  const validated = validatePortableArgumentSnapshot(source);
  if (validated.status !== 'valid') throw new Error(validated.message);
  return createKnowledgeReader(validated.snapshot, options);
}

export async function dispatchKnowledgeCall(
  reader: KnowledgeReader,
  value: unknown,
): Promise<unknown> {
  if (!isRecord(value)) {
    return {
      status: 'invalid-request',
      issues: ['Expected a knowledge call object.'],
    };
  }
  const fields = exactFields(value, ['operation', 'input'], []);
  if (fields.length > 0) return { status: 'invalid-request', issues: fields };
  const call = value as unknown as KnowledgeCall;
  if (call.operation === 'listIndex') return reader.listIndex(call.input);
  if (call.operation === 'searchIndex') return reader.searchIndex(call.input);
  if (call.operation === 'readArgumentBundle')
    return reader.readArgumentBundle(call.input);
  if (call.operation === 'readLinkedTheorySource') {
    return reader.readLinkedTheorySource(call.input);
  }
  return {
    status: 'invalid-request',
    issues: ['Unsupported knowledge operation.'],
  };
}
