import { computeFocusSchematicComputedLayoutAttempt } from './endpoint-facing';
import { computeFocusSchematicSoftClusterLayoutAttempt } from './soft-clusters';
import { computeFocusSchematicIncrementalLayoutAttempt } from './incremental-layout';
import { createFocusSchematicTransitionEvidence } from './layout-continuity';
import { classifyFocusSchematicLayoutTransition } from './transition-prior';
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
    const classification =
      request.transitionPrior === undefined
        ? null
        : classifyFocusSchematicLayoutTransition(
            request.input,
            request.policies,
            request.transitionPrior,
          );
    const incrementalAttempt =
      request.transitionPrior !== undefined && classification?.eligible === true
        ? computeFocusSchematicIncrementalLayoutAttempt(
            request.input,
            request.policies,
            request.transitionPrior,
            classification,
          )
        : null;
    if (incrementalAttempt?.status === 'success') {
      return {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        kind: 'success',
        result: incrementalAttempt.result,
        softClusterEvidence: null,
        transitionEvidence: incrementalAttempt.evidence,
        timings: incrementalAttempt.timings,
        computeMs: Math.max(0, now() - startedAt),
      };
    }
    const softAttempt =
      request.policies.macroLayout === 'soft-folder-clusters'
        ? computeFocusSchematicSoftClusterLayoutAttempt(request.input, {
            strength: request.policies.softFolderStrength,
            folderScopeMode: request.policies.softFolderScopeMode,
            ancestorDecayBase: request.policies.softAncestorDecayBase,
            displayIntent: request.policies.softFolderDisplayIntent,
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
      transitionEvidence: createFocusSchematicTransitionEvidence({
        mode:
          request.transitionPrior !== undefined &&
          classification?.eligible === true
            ? 'cold-fallback'
            : 'cold',
        eligible: classification?.eligible ?? false,
        rejectionReason:
          incrementalAttempt?.status === 'failure'
            ? incrementalAttempt.reason
            : (classification?.reason ?? 'transition-prior-unavailable'),
        ...(request.transitionPrior === undefined
          ? {}
          : {
              priorInput: request.transitionPrior.input,
              prior: request.transitionPrior.result.candidate,
            }),
        currentInput: request.input,
        current: attempt.result.candidate,
        affectedModuleIds: classification?.affectedModuleIds ?? [],
      }),
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
