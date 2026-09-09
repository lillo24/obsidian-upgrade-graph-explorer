import { computeFocusSchematicComputedLayoutAttempt } from './endpoint-facing';
import { computeFocusSchematicSoftClusterLayoutAttempt } from './soft-clusters';
import {
  FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
  FocusSchematicLayoutProtocolError,
  validateFocusSchematicLayoutWorkerRequest,
  type FocusSchematicLayoutWorkerFailureCode,
  type FocusSchematicLayoutWorkerResponse,
} from './worker-protocol';

function failure(
  requestId: number,
  code: FocusSchematicLayoutWorkerFailureCode,
  message: string,
  computeMs: number,
): FocusSchematicLayoutWorkerResponse {
  return {
    protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
    requestId,
    kind: 'failure',
    code,
    message,
    computeMs,
  };
}

export function handleFocusSchematicLayoutWorkerRequest(
  value: unknown,
  now: () => number,
): FocusSchematicLayoutWorkerResponse {
  const startedAt = now();
  let candidateRequestId = 1;
  try {
    if (
      typeof value === 'object' &&
      value !== null &&
      'requestId' in value &&
      Number.isSafeInteger(value.requestId) &&
      Number(value.requestId) > 0
    ) {
      candidateRequestId = Number(value.requestId);
    }
    const request = validateFocusSchematicLayoutWorkerRequest(value);
    const softAttempt =
      request.policies.macroLayout === 'soft-folder-clusters'
        ? computeFocusSchematicSoftClusterLayoutAttempt(request.input, {
            strength: request.policies.softFolderStrength,
            scopeOverrides: request.policies.softFolderScopeOverrides,
            endpointOrderPolicy: request.policies.endpointOrderPolicy,
            internalLayoutVariant: request.policies.internalLayoutVariant,
          })
        : null;
    const attempt =
      softAttempt ??
      computeFocusSchematicComputedLayoutAttempt(
        request.input,
        request.policies,
      );
    const computeMs = Math.max(0, now() - startedAt);
    if (attempt.status !== 'success') {
      return failure(
        request.requestId,
        'computation-failed',
        attempt.reason,
        computeMs,
      );
    }
    return {
      protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      kind: 'success',
      result: attempt.result,
      softClusterEvidence:
        softAttempt?.status === 'success' ? softAttempt.evidence : null,
      timings: attempt.timings,
      computeMs,
    };
  } catch (error: unknown) {
    return failure(
      candidateRequestId,
      error instanceof FocusSchematicLayoutProtocolError
        ? 'invalid-request'
        : 'computation-failed',
      error instanceof Error ? error.message : String(error),
      Math.max(0, now() - startedAt),
    );
  }
}
