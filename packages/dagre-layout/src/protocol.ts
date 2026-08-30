import {
  DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
  type DagreLayoutInput,
  type DagreLayoutWorkerRequest,
  type DagreLayoutWorkerResponse,
} from './types';
import {
  DagreLayoutValidationError,
  validateDagreLayoutInput,
  validateDagreLayoutOutput,
} from './validation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validRequestId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

export class DagreLayoutProtocolError extends DagreLayoutValidationError {
  override readonly name = 'DagreLayoutProtocolError';
}

export function validateDagreLayoutWorkerRequest(
  value: unknown,
): DagreLayoutWorkerRequest {
  if (
    !isRecord(value) ||
    value.protocolVersion !== DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION ||
    !validRequestId(value.requestId) ||
    value.kind !== 'layout'
  ) {
    throw new DagreLayoutProtocolError(
      'Dagre layout worker request has an unsupported protocol envelope.',
    );
  }
  return {
    protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
    requestId: value.requestId,
    kind: 'layout',
    input: validateDagreLayoutInput(value.input),
  };
}

export function validateDagreLayoutWorkerResponse(
  value: unknown,
  expectedRequestId: number,
  input: DagreLayoutInput,
): DagreLayoutWorkerResponse {
  if (
    !isRecord(value) ||
    value.protocolVersion !== DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION ||
    value.requestId !== expectedRequestId ||
    typeof value.computeMs !== 'number' ||
    !Number.isFinite(value.computeMs) ||
    value.computeMs < 0
  ) {
    throw new DagreLayoutProtocolError(
      'Dagre layout worker response has an invalid protocol envelope.',
    );
  }
  if (value.kind === 'success') {
    return {
      protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
      requestId: expectedRequestId,
      kind: 'success',
      output: validateDagreLayoutOutput(input, value.output),
      computeMs: value.computeMs,
    };
  }
  if (
    value.kind === 'failure' &&
    (value.code === 'invalid-request' ||
      value.code === 'invalid-input' ||
      value.code === 'computation-failed') &&
    typeof value.message === 'string' &&
    value.message.length > 0
  ) {
    return value as unknown as DagreLayoutWorkerResponse;
  }
  throw new DagreLayoutProtocolError(
    'Dagre layout worker response must be a supported success or failure.',
  );
}
