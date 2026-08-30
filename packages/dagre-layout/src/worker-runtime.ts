import { computeDagreLayout } from './compute';
import {
  DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
  type DagreLayoutWorkerFailure,
  type DagreLayoutWorkerResponse,
} from './types';
import {
  DagreLayoutProtocolError,
  validateDagreLayoutWorkerRequest,
} from './protocol';
import { DagreLayoutValidationError } from './validation';

function failure(
  requestId: number,
  code: DagreLayoutWorkerFailure['code'],
  message: string,
  computeMs: number,
): DagreLayoutWorkerFailure {
  return {
    protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
    requestId,
    kind: 'failure',
    code,
    message,
    computeMs,
  };
}

export function handleDagreLayoutWorkerRequest(
  value: unknown,
  now: () => number,
): DagreLayoutWorkerResponse {
  const startedAt = now();
  let requestId = 1;
  try {
    if (
      typeof value === 'object' &&
      value !== null &&
      'requestId' in value &&
      Number.isSafeInteger(value.requestId) &&
      Number(value.requestId) > 0
    ) {
      requestId = Number(value.requestId);
    }
    const request = validateDagreLayoutWorkerRequest(value);
    const output = computeDagreLayout(request.input);
    return {
      protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      kind: 'success',
      output,
      computeMs: Math.max(0, now() - startedAt),
    };
  } catch (error: unknown) {
    const computeMs = Math.max(0, now() - startedAt);
    if (error instanceof DagreLayoutProtocolError) {
      return failure(requestId, 'invalid-request', error.message, computeMs);
    }
    if (error instanceof DagreLayoutValidationError) {
      return failure(requestId, 'invalid-input', error.message, computeMs);
    }
    return failure(
      requestId,
      'computation-failed',
      error instanceof Error ? error.message : String(error),
      computeMs,
    );
  }
}
