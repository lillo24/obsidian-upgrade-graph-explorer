import {
  WORKSPACE_WORKER_PROTOCOL_VERSION,
  type WorkspaceWorkerRequest,
  type WorkspaceWorkerResponse,
} from './protocol';
import {
  isWorkspaceWorkerRequest,
  isWorkspaceWorkerResponse,
} from './validation';

export type WorkspaceWorkerRequestChunkCollection =
  | 'request-documents'
  | 'request-catalog-entities'
  | 'request-catalog-references';

export type WorkspaceWorkerTransportRequest =
  | WorkspaceWorkerRequest
  | {
      readonly protocolVersion: typeof WORKSPACE_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly kind: 'chunked-request-start';
      readonly request: WorkspaceWorkerRequest;
      readonly chunkCount: number;
    }
  | {
      readonly protocolVersion: typeof WORKSPACE_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly kind: 'chunked-request-chunk';
      readonly index: number;
      readonly collection: WorkspaceWorkerRequestChunkCollection;
      readonly values: readonly unknown[];
    }
  | {
      readonly protocolVersion: typeof WORKSPACE_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly kind: 'chunked-request-end';
    };

const REQUEST_COLLECTIONS: readonly WorkspaceWorkerRequestChunkCollection[] = [
  'request-documents',
  'request-catalog-entities',
  'request-catalog-references',
];

export function chunkWorkspaceWorkerRequest(
  request: WorkspaceWorkerRequest,
  options: { readonly chunkSize?: number; readonly threshold?: number } = {},
): readonly WorkspaceWorkerTransportRequest[] {
  if (
    request.kind !== 'prepare-initialize' &&
    request.kind !== 'prepare-resync'
  ) {
    return [request];
  }
  const chunkSize = options.chunkSize ?? 8;
  const threshold = options.threshold ?? 128;
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error('Workspace worker request chunkSize must be positive.');
  }
  const catalog =
    request.kind === 'prepare-initialize'
      ? request.input.identityCatalog
      : undefined;
  const collections: Readonly<
    Record<WorkspaceWorkerRequestChunkCollection, readonly unknown[]>
  > = {
    'request-documents': request.input.documents,
    'request-catalog-entities': catalog?.entities ?? [],
    'request-catalog-references': catalog?.references ?? [],
  };
  const totalValues = REQUEST_COLLECTIONS.reduce(
    (total, collection) => total + collections[collection].length,
    0,
  );
  if (totalValues < threshold) return [request];
  const skeleton: WorkspaceWorkerRequest =
    request.kind === 'prepare-initialize'
      ? {
          ...request,
          input: {
            ...request.input,
            documents: [],
            identityCatalog: {
              ...request.input.identityCatalog,
              entities: [],
              references: [],
            },
          },
        }
      : { ...request, input: { ...request.input, documents: [] } };
  const chunks: WorkspaceWorkerTransportRequest[] = [];
  let index = 0;
  for (const collection of REQUEST_COLLECTIONS) {
    const values = collections[collection];
    for (let offset = 0; offset < values.length; offset += chunkSize) {
      chunks.push({
        protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        kind: 'chunked-request-chunk',
        index,
        collection,
        values: values.slice(offset, offset + chunkSize),
      });
      index += 1;
    }
  }
  return [
    {
      protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      kind: 'chunked-request-start',
      request: skeleton,
      chunkCount: chunks.length,
    },
    ...chunks,
    {
      protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      kind: 'chunked-request-end',
    },
  ];
}

interface RequestAssembly {
  readonly request: WorkspaceWorkerRequest;
  readonly chunkCount: number;
  readonly values: Record<WorkspaceWorkerRequestChunkCollection, unknown[]>;
  nextIndex: number;
}

export type WorkspaceWorkerRequestAssemblyResult =
  | { readonly status: 'pending' }
  | { readonly status: 'complete'; readonly request: WorkspaceWorkerRequest }
  | {
      readonly status: 'invalid';
      readonly requestId: string;
      readonly message: string;
    };

export interface WorkspaceWorkerRequestAssembler {
  accept(value: unknown): WorkspaceWorkerRequestAssemblyResult;
  clear(): void;
}

export function createWorkspaceWorkerRequestAssembler(): WorkspaceWorkerRequestAssembler {
  const assemblies = new Map<string, RequestAssembly>();
  const invalid = (requestId: string, message: string) => ({
    status: 'invalid' as const,
    requestId,
    message,
  });
  return {
    accept(value) {
      if (isWorkspaceWorkerRequest(value)) {
        if (assemblies.has(value.requestId)) {
          return invalid(
            value.requestId,
            'A complete request arrived during chunk assembly.',
          );
        }
        return { status: 'complete', request: value };
      }
      if (
        typeof value !== 'object' ||
        value === null ||
        !('requestId' in value) ||
        typeof value.requestId !== 'string' ||
        !('protocolVersion' in value) ||
        value.protocolVersion !== WORKSPACE_WORKER_PROTOCOL_VERSION ||
        !('kind' in value)
      ) {
        return invalid(
          'invalid-request',
          'The chunked request frame is malformed.',
        );
      }
      const requestId = value.requestId;
      if (value.kind === 'chunked-request-start') {
        if (
          !('request' in value) ||
          !isWorkspaceWorkerRequest(value.request) ||
          value.request.requestId !== requestId ||
          !('chunkCount' in value) ||
          !Number.isInteger(value.chunkCount) ||
          Number(value.chunkCount) < 0 ||
          assemblies.has(requestId)
        ) {
          return invalid(
            requestId,
            'The chunked request start is invalid or duplicated.',
          );
        }
        assemblies.set(requestId, {
          request: value.request,
          chunkCount: Number(value.chunkCount),
          nextIndex: 0,
          values: {
            'request-documents': [],
            'request-catalog-entities': [],
            'request-catalog-references': [],
          },
        });
        return { status: 'pending' };
      }
      const assembly = assemblies.get(requestId);
      if (assembly === undefined) {
        return invalid(
          requestId,
          'A request chunk arrived without a matching start.',
        );
      }
      if (value.kind === 'chunked-request-chunk') {
        if (
          !('index' in value) ||
          !Number.isInteger(value.index) ||
          Number(value.index) !== assembly.nextIndex ||
          !('collection' in value) ||
          !REQUEST_COLLECTIONS.includes(
            value.collection as WorkspaceWorkerRequestChunkCollection,
          ) ||
          !('values' in value) ||
          !Array.isArray(value.values)
        ) {
          assemblies.delete(requestId);
          return invalid(
            requestId,
            'The request chunk is malformed or out of order.',
          );
        }
        assembly.values[
          value.collection as WorkspaceWorkerRequestChunkCollection
        ].push(...value.values);
        assembly.nextIndex += 1;
        return { status: 'pending' };
      }
      if (value.kind !== 'chunked-request-end') {
        assemblies.delete(requestId);
        return invalid(requestId, 'The chunked request kind is unsupported.');
      }
      assemblies.delete(requestId);
      if (assembly.nextIndex !== assembly.chunkCount) {
        return invalid(
          requestId,
          'The chunked workspace worker request is incomplete.',
        );
      }
      const base = assembly.request;
      if (base.kind === 'prepare-initialize') {
        return {
          status: 'complete',
          request: {
            ...base,
            input: {
              ...base.input,
              documents: assembly.values['request-documents'] as never[],
              identityCatalog: {
                ...base.input.identityCatalog,
                entities: assembly.values[
                  'request-catalog-entities'
                ] as never[],
                references: assembly.values[
                  'request-catalog-references'
                ] as never[],
              },
            },
          },
        };
      }
      if (base.kind === 'prepare-resync') {
        return {
          status: 'complete',
          request: {
            ...base,
            input: {
              ...base.input,
              documents: assembly.values['request-documents'] as never[],
            },
          },
        };
      }
      return invalid(requestId, 'The chunked request skeleton is unsupported.');
    },
    clear() {
      assemblies.clear();
    },
  };
}

export type WorkspaceWorkerChunkCollection =
  | 'report-entities'
  | 'report-references'
  | 'report-diagnostics'
  | 'report-probes'
  | 'catalog-entities'
  | 'catalog-references';

export type WorkspaceWorkerTransportResponse =
  | WorkspaceWorkerResponse
  | {
      readonly protocolVersion: typeof WORKSPACE_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly kind: 'chunked-response-start';
      readonly response: WorkspaceWorkerResponse;
      readonly chunkCount: number;
    }
  | {
      readonly protocolVersion: typeof WORKSPACE_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly kind: 'chunked-response-chunk';
      readonly index: number;
      readonly collection: WorkspaceWorkerChunkCollection;
      readonly values: readonly unknown[];
    }
  | {
      readonly protocolVersion: typeof WORKSPACE_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly kind: 'chunked-response-end';
    };

interface ChunkedCollections {
  readonly 'report-entities': readonly unknown[];
  readonly 'report-references': readonly unknown[];
  readonly 'report-diagnostics': readonly unknown[];
  readonly 'report-probes': readonly unknown[];
  readonly 'catalog-entities': readonly unknown[];
  readonly 'catalog-references': readonly unknown[];
}

const COLLECTIONS: readonly WorkspaceWorkerChunkCollection[] = [
  'report-entities',
  'report-references',
  'report-diagnostics',
  'report-probes',
  'catalog-entities',
  'catalog-references',
];

function responseCollections(
  response: WorkspaceWorkerResponse,
): ChunkedCollections | undefined {
  if (response.kind !== 'prepared' && response.kind !== 'committed-report') {
    return undefined;
  }
  const report =
    response.kind === 'prepared' ? response.prepared.report : response.report;
  const catalog =
    response.kind === 'prepared'
      ? response.prepared.nextIdentityCatalog
      : undefined;
  return {
    'report-entities': report.snapshot.entities,
    'report-references': report.snapshot.references,
    'report-diagnostics': report.diagnostics,
    'report-probes': report.probes,
    'catalog-entities': catalog?.entities ?? [],
    'catalog-references': catalog?.references ?? [],
  };
}

function responseSkeleton(
  response: WorkspaceWorkerResponse,
): WorkspaceWorkerResponse {
  if (response.kind === 'prepared') {
    return {
      ...response,
      prepared: {
        ...response.prepared,
        report: {
          ...response.prepared.report,
          snapshot: {
            ...response.prepared.report.snapshot,
            entities: [],
            references: [],
          },
          diagnostics: [],
          probes: [],
        },
        nextIdentityCatalog: {
          ...response.prepared.nextIdentityCatalog,
          entities: [],
          references: [],
        },
      },
    };
  }
  if (response.kind === 'committed-report') {
    return {
      ...response,
      report: {
        ...response.report,
        snapshot: { ...response.report.snapshot, entities: [], references: [] },
        diagnostics: [],
        probes: [],
      },
    };
  }
  return response;
}

/**
 * Splits large report/catalog arrays into separate tasks. This preserves native
 * structured clone while preventing one large response delivery from monopolizing
 * the main event loop. Small acknowledgements remain one ordinary response.
 */
export function chunkWorkspaceWorkerResponse(
  response: WorkspaceWorkerResponse,
  options: { readonly chunkSize?: number; readonly threshold?: number } = {},
): readonly WorkspaceWorkerTransportResponse[] {
  const chunkSize = options.chunkSize ?? 1_024;
  const threshold = options.threshold ?? 1_024;
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error('Workspace worker response chunkSize must be positive.');
  }
  const collections = responseCollections(response);
  if (collections === undefined) return [response];
  const totalValues = COLLECTIONS.reduce(
    (total, collection) => total + collections[collection].length,
    0,
  );
  if (totalValues < threshold) return [response];

  const chunks: WorkspaceWorkerTransportResponse[] = [];
  let index = 0;
  for (const collection of COLLECTIONS) {
    const values = collections[collection];
    for (let offset = 0; offset < values.length; offset += chunkSize) {
      chunks.push({
        protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
        requestId: response.requestId,
        kind: 'chunked-response-chunk',
        index,
        collection,
        values: values.slice(offset, offset + chunkSize),
      });
      index += 1;
    }
  }
  return [
    {
      protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
      requestId: response.requestId,
      kind: 'chunked-response-start',
      response: responseSkeleton(response),
      chunkCount: chunks.length,
    },
    ...chunks,
    {
      protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
      requestId: response.requestId,
      kind: 'chunked-response-end',
    },
  ];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isWorkspaceWorkerTransportResponse(
  value: unknown,
): value is WorkspaceWorkerTransportResponse {
  if (isWorkspaceWorkerResponse(value)) return true;
  if (
    !record(value) ||
    value.protocolVersion !== WORKSPACE_WORKER_PROTOCOL_VERSION ||
    typeof value.requestId !== 'string'
  ) {
    return false;
  }
  switch (value.kind) {
    case 'chunked-response-start':
      return (
        Number.isInteger(value.chunkCount) &&
        Number(value.chunkCount) >= 0 &&
        isWorkspaceWorkerResponse(value.response) &&
        value.response.requestId === value.requestId
      );
    case 'chunked-response-chunk':
      return (
        Number.isInteger(value.index) &&
        Number(value.index) >= 0 &&
        COLLECTIONS.includes(
          value.collection as WorkspaceWorkerChunkCollection,
        ) &&
        Array.isArray(value.values)
      );
    case 'chunked-response-end':
      return true;
    default:
      return false;
  }
}

interface Assembly {
  readonly response: WorkspaceWorkerResponse;
  readonly chunkCount: number;
  readonly values: Record<WorkspaceWorkerChunkCollection, unknown[]>;
  nextIndex: number;
}

export type WorkspaceWorkerAssemblyResult =
  | { readonly status: 'pending' }
  | { readonly status: 'complete'; readonly response: WorkspaceWorkerResponse }
  | { readonly status: 'invalid'; readonly message: string };

export interface WorkspaceWorkerResponseAssembler {
  accept(value: unknown): WorkspaceWorkerAssemblyResult;
  clear(): void;
}

export function createWorkspaceWorkerResponseAssembler(): WorkspaceWorkerResponseAssembler {
  const assemblies = new Map<string, Assembly>();

  function invalid(message: string): WorkspaceWorkerAssemblyResult {
    return { status: 'invalid', message };
  }

  return {
    accept(value) {
      if (!isWorkspaceWorkerTransportResponse(value)) {
        return invalid('The workspace worker returned a malformed response.');
      }
      if (
        value.kind !== 'chunked-response-start' &&
        value.kind !== 'chunked-response-chunk' &&
        value.kind !== 'chunked-response-end'
      ) {
        if (assemblies.has(value.requestId)) {
          return invalid('A complete response arrived during chunk assembly.');
        }
        return { status: 'complete', response: value };
      }
      if (value.kind === 'chunked-response-start') {
        if (
          assemblies.has(value.requestId) ||
          (value.response.kind !== 'prepared' &&
            value.response.kind !== 'committed-report')
        ) {
          return invalid(
            'The chunked response start is invalid or duplicated.',
          );
        }
        assemblies.set(value.requestId, {
          response: value.response,
          chunkCount: value.chunkCount,
          nextIndex: 0,
          values: {
            'report-entities': [],
            'report-references': [],
            'report-diagnostics': [],
            'report-probes': [],
            'catalog-entities': [],
            'catalog-references': [],
          },
        });
        return { status: 'pending' };
      }
      const assembly = assemblies.get(value.requestId);
      if (assembly === undefined) {
        return invalid('A response chunk arrived without a matching start.');
      }
      if (value.kind === 'chunked-response-chunk') {
        if (value.index !== assembly.nextIndex) {
          assemblies.delete(value.requestId);
          return invalid(
            'Workspace worker response chunks arrived out of order.',
          );
        }
        assembly.values[value.collection].push(...value.values);
        assembly.nextIndex += 1;
        return { status: 'pending' };
      }
      assemblies.delete(value.requestId);
      if (assembly.nextIndex !== assembly.chunkCount) {
        return invalid('The chunked workspace worker response is incomplete.');
      }
      const base = assembly.response;
      if (base.kind === 'prepared') {
        return {
          status: 'complete',
          response: {
            ...base,
            prepared: {
              ...base.prepared,
              report: {
                ...base.prepared.report,
                snapshot: {
                  ...base.prepared.report.snapshot,
                  entities: assembly.values['report-entities'] as never[],
                  references: assembly.values['report-references'] as never[],
                },
                diagnostics: assembly.values['report-diagnostics'] as never[],
                probes: assembly.values['report-probes'] as never[],
              },
              nextIdentityCatalog: {
                ...base.prepared.nextIdentityCatalog,
                entities: assembly.values['catalog-entities'] as never[],
                references: assembly.values['catalog-references'] as never[],
              },
            },
          },
        };
      }
      if (base.kind === 'committed-report') {
        return {
          status: 'complete',
          response: {
            ...base,
            report: {
              ...base.report,
              snapshot: {
                ...base.report.snapshot,
                entities: assembly.values['report-entities'] as never[],
                references: assembly.values['report-references'] as never[],
              },
              diagnostics: assembly.values['report-diagnostics'] as never[],
              probes: assembly.values['report-probes'] as never[],
            },
          },
        };
      }
      return invalid('The chunked response skeleton is unsupported.');
    },
    clear() {
      assemblies.clear();
    },
  };
}
