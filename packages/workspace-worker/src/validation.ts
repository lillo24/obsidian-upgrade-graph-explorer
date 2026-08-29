import {
  WORKSPACE_WORKER_PROTOCOL_VERSION,
  type WorkspaceWorkerRequest,
  type WorkspaceWorkerResponse,
} from './protocol';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validEnvelope(value: Record<string, unknown>): boolean {
  return (
    value.protocolVersion === WORKSPACE_WORKER_PROTOCOL_VERSION &&
    typeof value.requestId === 'string' &&
    value.requestId.length > 0 &&
    typeof value.kind === 'string'
  );
}

function stringArray(value: unknown): boolean {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export function isWorkspaceWorkerRequest(
  value: unknown,
): value is WorkspaceWorkerRequest {
  if (!record(value) || !validEnvelope(value)) return false;
  switch (value.kind) {
    case 'prepare-initialize':
      return (
        record(value.input) &&
        typeof value.input.workspaceId === 'string' &&
        Array.isArray(value.input.documents) &&
        record(value.input.identityCatalog) &&
        stringArray(value.input.nonMarkdownPaths)
      );
    case 'prepare-changes':
      return (
        record(value.input) &&
        Number.isInteger(value.input.expectedRevision) &&
        Array.isArray(value.input.changes) &&
        stringArray(value.input.nonMarkdownPaths)
      );
    case 'prepare-resync':
      return (
        record(value.input) &&
        Array.isArray(value.input.documents) &&
        stringArray(value.input.nonMarkdownPaths)
      );
    case 'build-committed-report':
      return record(value.input) && stringArray(value.input.nonMarkdownPaths);
    case 'commit-candidate':
    case 'discard-candidate':
      return (
        typeof value.candidateId === 'string' && value.candidateId.length > 0
      );
    default:
      return false;
  }
}

export function isWorkspaceWorkerResponse(
  value: unknown,
): value is WorkspaceWorkerResponse {
  if (!record(value) || !validEnvelope(value)) return false;
  switch (value.kind) {
    case 'prepared':
      return (
        record(value.prepared) &&
        typeof value.prepared.candidateId === 'string' &&
        typeof value.prepared.workspaceId === 'string' &&
        (value.prepared.fromRevision === null ||
          Number.isInteger(value.prepared.fromRevision)) &&
        Number.isInteger(value.prepared.toRevision) &&
        record(value.prepared.report) &&
        record(value.prepared.nextIdentityCatalog) &&
        record(value.prepared.identitySummary) &&
        record(value.prepared.parseStats) &&
        record(value.prepared.timings)
      );
    case 'committed-report':
      return (
        Number.isInteger(value.revision) &&
        record(value.report) &&
        record(value.timings)
      );
    case 'candidate-committed':
    case 'candidate-discarded':
      return (
        typeof value.candidateId === 'string' &&
        (value.revision === null || Number.isInteger(value.revision))
      );
    case 'failure':
      return (
        [
          'protocol',
          'workspace',
          'diagnostics',
          'transport',
          'terminated',
          'internal',
        ].includes(String(value.category)) &&
        typeof value.code === 'string' &&
        typeof value.message === 'string'
      );
    default:
      return false;
  }
}
