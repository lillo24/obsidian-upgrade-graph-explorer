import { describe, expect, it } from 'vitest';

import { ENDPOINT_FIXTURES, buildEndpointFixture } from './endpoint-fixtures';
import { layoutInput } from './test-helpers';
import {
  FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
  validateFocusSchematicLayoutWorkerResponse,
} from './worker-protocol';
import { handleFocusSchematicLayoutWorkerRequest } from './worker-runtime';

const input = layoutInput(buildEndpointFixture(ENDPOINT_FIXTURES[0]!));

describe('Focus Schematic layout worker protocol', () => {
  it('validates, computes, and returns the complete A1 payload', () => {
    let now = 0;
    const response = handleFocusSchematicLayoutWorkerRequest(
      {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 7,
        kind: 'layout',
        input,
      },
      () => ++now,
    );

    expect(response).toMatchObject({
      protocolVersion: 1,
      requestId: 7,
      kind: 'success',
      computeMs: 1,
    });
    expect(() =>
      validateFocusSchematicLayoutWorkerResponse(response, 7, input),
    ).not.toThrow();

    const repeated = handleFocusSchematicLayoutWorkerRequest(
      {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 8,
        kind: 'layout',
        input,
      },
      () => 1,
    );
    expect(repeated.kind).toBe('success');
    if (response.kind !== 'success' || repeated.kind !== 'success')
      throw new Error('Expected deterministic worker successes.');
    expect(repeated.result).toEqual(response.result);
  });

  it('returns an explicit failure for malformed input', () => {
    const response = handleFocusSchematicLayoutWorkerRequest(
      {
        protocolVersion: 1,
        requestId: 3,
        kind: 'layout',
        input: {},
      },
      () => 1,
    );
    expect(response).toMatchObject({
      requestId: 3,
      kind: 'failure',
      code: 'invalid-request',
    });
  });

  it('rejects unexpected fields, stale IDs, and invalid computed output', () => {
    const success = handleFocusSchematicLayoutWorkerRequest(
      {
        protocolVersion: 1,
        requestId: 1,
        kind: 'layout',
        input,
      },
      () => 1,
    );
    expect(() =>
      validateFocusSchematicLayoutWorkerResponse(
        { ...success, extra: true },
        1,
        input,
      ),
    ).toThrow(/unexpected or missing fields/);
    expect(() =>
      validateFocusSchematicLayoutWorkerResponse(success, 2, input),
    ).toThrow(/requestId/);
    if (success.kind !== 'success') throw new Error('Expected success.');
    expect(() =>
      validateFocusSchematicLayoutWorkerResponse(
        { ...success, result: { ...success.result, attachments: [] } },
        1,
        input,
      ),
    ).toThrow(/Invalid computed layout/);
  });
});
