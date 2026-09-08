import { describe, expect, it } from 'vitest';

import { ENDPOINT_FIXTURES, buildEndpointFixture } from './endpoint-fixtures';
import { layoutInput } from './test-helpers';
import { DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES } from './policies';
import { FOCUS_SCHEMATIC_PRODUCTION_LAYOUT_SETTINGS } from './settings';
import {
  FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
  validateFocusSchematicLayoutWorkerResponse,
} from './worker-protocol';
import { handleFocusSchematicLayoutWorkerRequest } from './worker-runtime';

const input = layoutInput(
  buildEndpointFixture(ENDPOINT_FIXTURES[0]!),
  FOCUS_SCHEMATIC_PRODUCTION_LAYOUT_SETTINGS,
);
const policies = DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES;

describe('Focus Schematic layout worker protocol', () => {
  it('computes the exact four product policy combinations deterministically', () => {
    let requestId = 20;
    for (const internalLayoutVariant of [
      'adaptive-compass',
      'vertical-spine',
    ] as const)
      for (const endpointOrderPolicy of [
        'crossing-optimized',
        'document-order',
      ] as const) {
        const selected = { internalLayoutVariant, endpointOrderPolicy };
        const request = {
          protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
          requestId: requestId++,
          kind: 'layout' as const,
          input,
          policies: selected,
        };
        const first = handleFocusSchematicLayoutWorkerRequest(request, () => 0);
        const second = handleFocusSchematicLayoutWorkerRequest(
          { ...request, requestId: requestId++ },
          () => 0,
        );
        expect(first.kind).toBe('success');
        expect(second.kind).toBe('success');
        if (first.kind !== 'success' || second.kind !== 'success') continue;
        expect(first.result.internalLayoutEvidence.variant).toBe(
          internalLayoutVariant,
        );
        expect(
          first.result.folderBandPlan.optimization?.endpointOrderPolicy,
        ).toBe(endpointOrderPolicy);
        expect(second.result).toEqual(first.result);
      }
  });

  it('validates, computes, and returns the complete A1 payload', () => {
    let now = 0;
    const response = handleFocusSchematicLayoutWorkerRequest(
      {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 7,
        kind: 'layout',
        input,
        policies,
      },
      () => ++now,
    );

    expect(response).toMatchObject({
      protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
      requestId: 7,
      kind: 'success',
      computeMs: 1,
    });
    expect(() =>
      validateFocusSchematicLayoutWorkerResponse(response, 7, input, policies),
    ).not.toThrow();

    const repeated = handleFocusSchematicLayoutWorkerRequest(
      {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 8,
        kind: 'layout',
        input,
        policies,
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
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 3,
        kind: 'layout',
        input: {},
        policies,
      },
      () => 1,
    );
    expect(response).toMatchObject({
      requestId: 3,
      kind: 'failure',
      code: 'invalid-request',
    });
  });

  it('rejects missing, lab-only, and unknown production policies', () => {
    for (const invalidPolicies of [
      undefined,
      {
        endpointOrderPolicy: 'crossing-optimized',
        internalLayoutVariant: 'current',
      },
      {
        endpointOrderPolicy: 'source-ish',
        internalLayoutVariant: 'adaptive-compass',
      },
    ]) {
      const response = handleFocusSchematicLayoutWorkerRequest(
        {
          protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
          requestId: 4,
          kind: 'layout',
          input,
          ...(invalidPolicies === undefined
            ? {}
            : { policies: invalidPolicies }),
        },
        () => 1,
      );
      expect(response).toMatchObject({
        kind: 'failure',
        code: 'invalid-request',
      });
    }
  });

  it('rejects unexpected fields, stale IDs, and invalid computed output', () => {
    const success = handleFocusSchematicLayoutWorkerRequest(
      {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 1,
        kind: 'layout',
        input,
        policies,
      },
      () => 1,
    );
    expect(() =>
      validateFocusSchematicLayoutWorkerResponse(
        { ...success, extra: true },
        1,
        input,
        policies,
      ),
    ).toThrow(/unexpected or missing fields/);
    expect(() =>
      validateFocusSchematicLayoutWorkerResponse(success, 2, input, policies),
    ).toThrow(/requestId/);
    expect(() =>
      validateFocusSchematicLayoutWorkerResponse(
        { ...success, protocolVersion: 1 },
        1,
        input,
        policies,
      ),
    ).toThrow(/version/);
    if (success.kind !== 'success') throw new Error('Expected success.');
    expect(() =>
      validateFocusSchematicLayoutWorkerResponse(
        {
          ...success,
          result: {
            ...success.result,
            folderBandPlan: {
              ...success.result.folderBandPlan,
              rootFolderKey: 'wrong-folder',
            },
          },
        },
        1,
        input,
        policies,
      ),
    ).toThrow(/Invalid computed layout/);
    expect(() =>
      validateFocusSchematicLayoutWorkerResponse(
        { ...success, result: { ...success.result, attachments: [] } },
        1,
        input,
        policies,
      ),
    ).toThrow(/Invalid computed layout/);
  });
});
