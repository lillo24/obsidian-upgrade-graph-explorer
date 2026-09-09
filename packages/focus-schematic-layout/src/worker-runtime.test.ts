import { describe, expect, it } from 'vitest';

import { ENDPOINT_FIXTURES, buildEndpointFixture } from './endpoint-fixtures';
import { computeFocusSchematicComputedLayoutAttempt } from './endpoint-facing';
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

const liveDispatchFixture = buildEndpointFixture({
  id: 'SC99',
  label: 'real worker dispatch matrix',
  authored: 'Synthetic exact endpoints for the production worker boundary.',
  expectation:
    'Both macro layouts preserve exact endpoint identity across the full policy matrix.',
  inspect:
    'Exercise repeated and singleton folders, both directions, secondary context, and direct File references.',
  rootDocumentId: 'Focus',
  documents: [
    { id: 'Focus', path: 'root/Focus.md' },
    { id: 'IncomingA', path: 'alpha/IncomingA.md' },
    { id: 'IncomingB', path: 'alpha/IncomingB.md' },
    { id: 'OutgoingA', path: 'beta/OutgoingA.md' },
    { id: 'OutgoingB', path: 'singleton/OutgoingB.md' },
    { id: 'Bridge', path: 'beta/Bridge.md' },
  ],
  entities: Array.from({ length: 5 }, (_, index) => ({
    id: `focus-heading-${index + 1}`,
    kind: 'section' as const,
    documentId: 'Focus',
    parentId: 'Focus',
    line: index + 2,
    title: `Focus heading ${index + 1}`,
  })),
  references: [
    { sourceEntityId: 'IncomingA', targetEntityId: 'focus-heading-1' },
    { sourceEntityId: 'IncomingB', targetEntityId: 'focus-heading-2' },
    { sourceEntityId: 'focus-heading-3', targetEntityId: 'OutgoingA' },
    { sourceEntityId: 'focus-heading-4', targetEntityId: 'OutgoingB' },
    { sourceEntityId: 'focus-heading-5', targetEntityId: 'Bridge' },
    { sourceEntityId: 'IncomingA', targetEntityId: 'OutgoingA' },
    { sourceEntityId: 'Focus', targetEntityId: 'OutgoingB' },
  ],
  direction: 'both',
  hops: 2,
});

function liveInput(macroLayout: 'directional-bands' | 'soft-folder-clusters') {
  return layoutInput(liveDispatchFixture, {
    ...FOCUS_SCHEMATIC_PRODUCTION_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: macroLayout === 'directional-bands',
  });
}

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
        const selected = {
          ...policies,
          internalLayoutVariant,
          endpointOrderPolicy,
        };
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

  it('dispatches the synthetic real-view fixture through all eight macro/internal/order combinations', () => {
    let requestId = 100;
    let combinations = 0;
    for (const macroLayout of [
      'directional-bands',
      'soft-folder-clusters',
    ] as const)
      for (const internalLayoutVariant of [
        'adaptive-compass',
        'vertical-spine',
      ] as const)
        for (const endpointOrderPolicy of [
          'crossing-optimized',
          'document-order',
        ] as const) {
          const selectedInput = liveInput(macroLayout);
          const selectedPolicies = {
            macroLayout,
            softFolderStrength: 50,
            softFolderDisplayIntent: {
              fileParentOverrides: [],
              flattenedFolderKeys: [],
            },
            internalLayoutVariant,
            endpointOrderPolicy,
          } as const;
          const request = {
            protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
            requestId: requestId++,
            kind: 'layout' as const,
            input: selectedInput,
            policies: selectedPolicies,
          };
          const first = handleFocusSchematicLayoutWorkerRequest(
            request,
            performance.now.bind(performance),
          );
          const second = handleFocusSchematicLayoutWorkerRequest(
            { ...request, requestId: requestId++ },
            performance.now.bind(performance),
          );
          if (first.kind === 'failure')
            throw new Error(
              `${macroLayout}/${internalLayoutVariant}/${endpointOrderPolicy}: ${first.message}`,
            );
          if (second.kind === 'failure') throw new Error(second.message);
          expect(first.kind).toBe('success');
          expect(second.kind).toBe('success');
          if (first.kind !== 'success' || second.kind !== 'success') continue;
          expect(() =>
            validateFocusSchematicLayoutWorkerResponse(
              first,
              request.requestId,
              selectedInput,
              selectedPolicies,
            ),
          ).not.toThrow();
          expect(first.result).toEqual(second.result);
          expect(first.result.internalLayoutEvidence.variant).toBe(
            internalLayoutVariant,
          );
          expect(first.result.quality.moduleOverlapPairs).toEqual([]);
          expect(
            first.result.endpointPlan.connections.some(
              ({ role }) => role === 'secondary',
            ),
          ).toBe(true);
          if (macroLayout === 'directional-bands') {
            expect(first.softClusterEvidence).toBeNull();
            const direct = computeFocusSchematicComputedLayoutAttempt(
              selectedInput,
              selectedPolicies,
            );
            expect(direct.status).toBe('success');
            if (direct.status === 'success')
              expect(first.result).toEqual(direct.result);
          } else {
            expect(first.softClusterEvidence).toMatchObject({
              strength: 50,
              endpointOrderPolicy,
              secondaryGeometryInfluence: 0,
            });
            expect(
              first.result.internalLayoutEvidence.softClusterPolicyEvidence,
            ).toMatchObject({
              layoutFamily: 'soft-folder-clusters',
              strength: 50,
              endpointOrderPolicy,
            });
          }
          combinations += 1;
        }
    expect(combinations).toBe(8);
  }, 30_000);

  it('runs continuous Soft Cluster strengths through the production worker path', () => {
    const selectedInput = liveInput('soft-folder-clusters');
    const candidates = [0, 50, 100].map((softFolderStrength, index) => {
      const response = handleFocusSchematicLayoutWorkerRequest(
        {
          protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
          requestId: 300 + index,
          kind: 'layout',
          input: selectedInput,
          policies: {
            ...policies,
            macroLayout: 'soft-folder-clusters',
            softFolderStrength,
          },
        },
        performance.now.bind(performance),
      );
      if (response.kind === 'failure') throw new Error(response.message);
      expect(response.kind).toBe('success');
      if (response.kind !== 'success') throw new Error('Expected success.');
      expect(response.softClusterEvidence?.strength).toBe(softFolderStrength);
      expect(response.result.quality.moduleOverlapPairs).toEqual([]);
      return response.result.candidate;
    });
    expect(candidates[0]).not.toEqual(candidates[1]);
    expect(candidates[1]).not.toEqual(candidates[2]);
  });

  it('keeps Directional output byte-identical with non-empty Soft display intent', () => {
    const selectedInput = liveInput('directional-bands');
    const request = (requestId: number, withScope: boolean) => ({
      protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
      requestId,
      kind: 'layout' as const,
      input: selectedInput,
      policies: {
        ...policies,
        softFolderDisplayIntent: withScope
          ? {
              fileParentOverrides: [
                { fileId: 'doc-child', displayParentFolderKey: 'alpha' },
              ],
              flattenedFolderKeys: ['alpha/child'],
            }
          : { fileParentOverrides: [], flattenedFolderKeys: [] },
      },
    });
    const exact = handleFocusSchematicLayoutWorkerRequest(
      request(450, false),
      () => 0,
    );
    const ignored = handleFocusSchematicLayoutWorkerRequest(
      request(451, true),
      () => 0,
    );
    if (exact.kind !== 'success' || ignored.kind !== 'success')
      throw new Error('Expected Directional worker success.');
    expect(ignored.result).toEqual(exact.result);
    expect(ignored.softClusterEvidence).toBeNull();
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
