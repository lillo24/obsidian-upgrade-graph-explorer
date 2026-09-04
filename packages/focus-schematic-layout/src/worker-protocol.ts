import { validateFocusSchematicComputedLayout } from './endpoint-facing';
import { validateFocusSchematicLayoutInput } from './input';
import type {
  FocusSchematicComputedLayout,
  FocusSchematicEndpointLayoutPhaseTimings,
  FocusSchematicLayoutInput,
} from './types';

export const FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION = 1 as const;

export interface FocusSchematicLayoutWorkerRequest {
  readonly protocolVersion: typeof FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION;
  readonly requestId: number;
  readonly kind: 'layout';
  readonly input: FocusSchematicLayoutInput;
}

export type FocusSchematicLayoutWorkerFailureCode =
  'invalid-request' | 'invalid-input' | 'computation-failed';

export type FocusSchematicLayoutWorkerResponse =
  | {
      readonly protocolVersion: typeof FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION;
      readonly requestId: number;
      readonly kind: 'success';
      readonly result: FocusSchematicComputedLayout;
      readonly timings: FocusSchematicEndpointLayoutPhaseTimings;
      readonly computeMs: number;
    }
  | {
      readonly protocolVersion: typeof FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION;
      readonly requestId: number;
      readonly kind: 'failure';
      readonly code: FocusSchematicLayoutWorkerFailureCode;
      readonly message: string;
      readonly computeMs: number;
    };

export class FocusSchematicLayoutProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FocusSchematicLayoutProtocolError';
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FocusSchematicLayoutProtocolError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw new FocusSchematicLayoutProtocolError(
      `${label} has unexpected or missing fields.`,
    );
  }
}

function requestId(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new FocusSchematicLayoutProtocolError(
      'requestId must be a positive safe integer.',
    );
  }
  return Number(value);
}

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new FocusSchematicLayoutProtocolError(
      `${label} must be a finite non-negative number.`,
    );
  }
  return value;
}

export function validateFocusSchematicLayoutWorkerRequest(
  value: unknown,
): FocusSchematicLayoutWorkerRequest {
  const candidate = record(value, 'Focus Schematic worker request');
  exactKeys(
    candidate,
    ['protocolVersion', 'requestId', 'kind', 'input'],
    'Focus Schematic worker request',
  );
  if (
    candidate.protocolVersion !== FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION
  ) {
    throw new FocusSchematicLayoutProtocolError(
      'Unsupported Focus Schematic worker protocol version.',
    );
  }
  if (candidate.kind !== 'layout') {
    throw new FocusSchematicLayoutProtocolError(
      'Focus Schematic worker request kind must be layout.',
    );
  }
  const id = requestId(candidate.requestId);
  const validation = validateFocusSchematicLayoutInput(candidate.input);
  if (!validation.valid) {
    throw new FocusSchematicLayoutProtocolError(
      `Invalid Focus Schematic layout input: ${validation.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    );
  }
  return {
    protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
    requestId: id,
    kind: 'layout',
    input: validation.value,
  };
}

export function validateFocusSchematicLayoutWorkerResponse(
  value: unknown,
  expectedRequestId: number,
  input: FocusSchematicLayoutInput,
): FocusSchematicLayoutWorkerResponse {
  const candidate = record(value, 'Focus Schematic worker response');
  if (
    candidate.protocolVersion !== FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION
  ) {
    throw new FocusSchematicLayoutProtocolError(
      'Unsupported Focus Schematic worker response version.',
    );
  }
  if (requestId(candidate.requestId) !== expectedRequestId) {
    throw new FocusSchematicLayoutProtocolError(
      'Focus Schematic worker response requestId does not match.',
    );
  }
  if (candidate.kind === 'success') {
    exactKeys(
      candidate,
      [
        'protocolVersion',
        'requestId',
        'kind',
        'result',
        'timings',
        'computeMs',
      ],
      'Focus Schematic success response',
    );
    finiteNonNegative(candidate.computeMs, 'computeMs');
    const validation = validateFocusSchematicComputedLayout(
      input,
      candidate.result,
    );
    if (!validation.valid) {
      throw new FocusSchematicLayoutProtocolError(
        `Invalid computed layout: ${validation.issues
          .map(({ path, message }) => `${path}: ${message}`)
          .join('; ')}`,
      );
    }
    // Phase timings are part of the attempt API. JSON cloning plus this exact
    // finite-number check prevents partial or embellished timing payloads.
    const timings = record(candidate.timings, 'Focus Schematic timings');
    const timingKeys = [
      'inputMs',
      'modulePlanningMs',
      'endpointConnectionMs',
      'demandCollectionMs',
      'subtreePropagationMs',
      'laneAssignmentMs',
      'centerLayoutMs',
      'leftLayoutMs',
      'rightLayoutMs',
      'compositionMs',
      'macroMs',
      'crossingMinimizationMs',
      'attachmentMs',
      'qualityMs',
      'validationMs',
      'serializationMs',
      'totalMs',
      'dagreCallCount',
      'inputSerializedBytes',
      'outputSerializedBytes',
      'endpointLaneSerializedBytes',
    ] as const;
    exactKeys(timings, timingKeys, 'Focus Schematic timings');
    for (const key of timingKeys) finiteNonNegative(timings[key], key);
    return candidate as unknown as FocusSchematicLayoutWorkerResponse;
  }
  if (candidate.kind === 'failure') {
    exactKeys(
      candidate,
      ['protocolVersion', 'requestId', 'kind', 'code', 'message', 'computeMs'],
      'Focus Schematic failure response',
    );
    if (
      candidate.code !== 'invalid-request' &&
      candidate.code !== 'invalid-input' &&
      candidate.code !== 'computation-failed'
    ) {
      throw new FocusSchematicLayoutProtocolError(
        'Focus Schematic failure response code is invalid.',
      );
    }
    if (
      typeof candidate.message !== 'string' ||
      candidate.message.length === 0
    ) {
      throw new FocusSchematicLayoutProtocolError(
        'Focus Schematic failure response message is required.',
      );
    }
    finiteNonNegative(candidate.computeMs, 'computeMs');
    return candidate as unknown as FocusSchematicLayoutWorkerResponse;
  }
  throw new FocusSchematicLayoutProtocolError(
    'Focus Schematic worker response kind is invalid.',
  );
}
