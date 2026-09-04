import { describe, expect, it } from 'vitest';

import {
  createFocusSchematicEndpointPlan,
  validateFocusSchematicEndpointPlan,
} from './endpoint-plan';
import {
  computeFocusSchematicComputedLayoutAttempt,
  createFocusSchematicEndpointAttachments,
  evaluateFocusSchematicEndpointLayoutQuality,
  validateFocusSchematicComputedLayout,
} from './endpoint-facing';
import {
  buildEndpointFixture,
  CENTER_SPINE_FIXTURES,
  ENDPOINT_FIXTURES,
  ENDPOINT_STABILITY_PAIRS,
  type EndpointFixtureSpec,
} from './endpoint-fixtures';
import { validateFocusSchematicInternalLanePlan } from './lane-plan';
import {
  measureFocusSchematicEndpointOrder,
  minimizeFocusSchematicCenterStackCrossings,
} from './crossing-minimization';
import { validateFocusSchematicLayoutInput } from './input';
import { createFocusSchematicLayoutPlan } from './plan';
import { layoutInput } from './test-helpers';
import {
  computeFocusSchematicLayout,
  computeFocusSchematicLayoutAttempt,
  computeFocusSchematicUniformLayoutAttempt,
} from './index';

const spec = (id: `EP${number}`): EndpointFixtureSpec => {
  const value = ENDPOINT_FIXTURES.find((fixture) => fixture.id === id);
  if (value === undefined) throw new Error(`Missing endpoint fixture ${id}.`);
  return value;
};

const run = (id: `EP${number}`) => {
  const fixture = buildEndpointFixture(spec(id));
  const input = layoutInput(fixture);
  const attempt = computeFocusSchematicComputedLayoutAttempt(input);
  if (attempt.status !== 'success') throw new Error(attempt.reason);
  return { fixture, input, attempt, result: attempt.result };
};

const projectionNodeId = (
  fixture: ReturnType<typeof buildEndpointFixture>,
  entityId: string,
) => {
  const node = fixture.projection.nodes.find(
    (candidate) =>
      candidate.kind === 'entity' && candidate.entityId === entityId,
  );
  if (node === undefined)
    throw new Error(`Missing projected entity ${entityId}.`);
  return node.id;
};

describe('HIER3A endpoint plan and endpoint-facing layout', () => {
  it('preserves exact Heading endpoints, authored direction, signed-rank sides, and lanes', () => {
    const { result } = run('EP4');
    expect(result.endpointPlan.summary).toMatchObject({
      preciseConnectionCount: 1,
      fallbackConnectionCount: 0,
      preciseReferenceIdCount: 1,
      fallbackReferenceIdCount: 0,
    });
    const connection = result.endpointPlan.connections[0]!;
    expect(connection).toMatchObject({
      kind: 'precise',
      role: 'selected-backbone',
      source: {
        kind: 'visible-entity',
        entityId: 'Atlas-launch',
        entityKind: 'section',
        attachmentSide: 'right',
      },
      target: {
        kind: 'visible-entity',
        entityId: 'Beacon-arrival',
        entityKind: 'section',
        attachmentSide: 'left',
      },
    });
    expect(
      result.internalLanePlan.nodes.find(
        ({ projectionNodeId: id }) =>
          connection.source.kind === 'visible-entity' &&
          id === connection.source.projectionNodeId,
      )?.lane,
    ).toBe('right');
    expect(
      result.internalLanePlan.nodes.find(
        ({ projectionNodeId: id }) =>
          connection.target.kind === 'visible-entity' &&
          id === connection.target.projectionNodeId,
      )?.lane,
    ).toBe('left');
    expect(result.attachments).toHaveLength(2);
    expect(result.candidate.routes).toEqual([]);
  });

  it('creates independent left and right lanes in a multi-hop module', () => {
    const { fixture, result } = run('EP7');
    const targetId = projectionNodeId(fixture, 'Beacon-target');
    const sourceId = projectionNodeId(fixture, 'Beacon-source');
    expect(
      result.internalLanePlan.nodes.find(
        ({ projectionNodeId: id }) => id === targetId,
      ),
    ).toMatchObject({ lane: 'left', directDemand: 'left' });
    expect(
      result.internalLanePlan.nodes.find(
        ({ projectionNodeId: id }) => id === sourceId,
      ),
    ).toMatchObject({ lane: 'right', directDemand: 'right' });
  });

  it('keeps a dual-purpose Heading unique and centered with two attachments', () => {
    const { fixture, result } = run('EP9');
    const relayId = projectionNodeId(fixture, 'Beacon-relay');
    expect(
      result.internalLanePlan.nodes.find(
        ({ projectionNodeId: id }) => id === relayId,
      ),
    ).toMatchObject({
      lane: 'center',
      directDemand: 'both',
      subtreeDemand: 'both',
    });
    expect(
      result.candidate.nodes.filter(
        ({ projectionNodeId: id }) => id === relayId,
      ),
    ).toHaveLength(1);
    expect(
      result.attachments.filter(({ projectionNodeId: id }) => id === relayId),
    ).toHaveLength(2);
  });

  it('propagates mixed subtree demand through a centered ancestor', () => {
    const { fixture, result } = run('EP10');
    const lanes = Object.fromEntries(
      ['Beacon-parent', 'Beacon-left', 'Beacon-right'].map((entityId) => {
        const id = projectionNodeId(fixture, entityId);
        return [
          entityId,
          result.internalLanePlan.nodes.find(
            ({ projectionNodeId: nodeId }) => nodeId === id,
          ),
        ];
      }),
    );
    expect(lanes['Beacon-parent']).toMatchObject({
      lane: 'center',
      directDemand: 'none',
      subtreeDemand: 'both',
      reason: 'mixed-ancestor',
    });
    expect(lanes['Beacon-left']).toMatchObject({ lane: 'left' });
    expect(lanes['Beacon-right']).toMatchObject({ lane: 'right' });
  });

  it('preserves all File, Heading, and Block endpoint combinations exactly', () => {
    const simpleExpected = new Map([
      ['EP1', ['document', 'document']],
      ['EP2', ['section', 'document']],
      ['EP3', ['document', 'section']],
      ['EP4', ['section', 'section']],
    ]);
    for (const [fixtureId, expected] of simpleExpected) {
      const connection = run(fixtureId as `EP${number}`).result.endpointPlan
        .connections[0]!;
      expect([
        connection.source.kind === 'visible-entity'
          ? connection.source.entityKind
          : connection.source.kind,
        connection.target.kind === 'visible-entity'
          ? connection.target.entityKind
          : connection.target.kind,
      ]).toEqual(expected);
    }
    const blockPairs = run('EP12').result.endpointPlan.connections.map(
      ({ source, target }) =>
        `${source.kind === 'visible-entity' ? source.entityKind : source.kind}->${
          target.kind === 'visible-entity' ? target.entityKind : target.kind
        }`,
    );
    expect(blockPairs).toEqual(
      expect.arrayContaining([
        'block->document',
        'document->block',
        'block->section',
        'section->block',
        'block->block',
      ]),
    );
  });

  it('uses the actual rolled-up visible ancestor and retains aggregation/grouping truth', () => {
    const rolledUp = run('EP13').result.endpointPlan.connections[0]!;
    expect(rolledUp.target).toMatchObject({
      kind: 'visible-entity',
      entityId: 'Beacon-parent',
    });
    expect(JSON.stringify(rolledUp)).not.toContain('Beacon-hidden');

    const aggregated = run('EP14').result.endpointPlan.connections.filter(
      ({ kind }) => kind === 'precise',
    );
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]?.referenceIds).toHaveLength(2);

    const multiple = run('EP15').result.endpointPlan.connections.filter(
      ({ kind }) => kind === 'precise',
    );
    expect(multiple).toHaveLength(2);
    expect(
      new Set(multiple.map(({ relationshipId }) => relationshipId)).size,
    ).toBe(1);
    expect(
      new Set(multiple.map(({ projectedEdgeId }) => projectedEdgeId)).size,
    ).toBe(2);
  });

  it('keeps neutral structure centered and diagnostics outside semantic endpoint records', () => {
    const neutral = run('EP11').result;
    expect(
      neutral.internalLanePlan.nodes
        .filter(({ reason }) => reason.startsWith('neutral'))
        .every(({ lane }) => lane === 'center'),
    ).toBe(true);
    const diagnostics = run('EP20');
    expect(diagnostics.fixture.model.diagnostics).toHaveLength(1);
    expect(
      diagnostics.result.endpointPlan.connections.some((connection) =>
        connection.id.includes('diagnostic'),
      ),
    ).toBe(false);
  });

  it('uses exact endpoint order to remove an obvious module inversion', () => {
    const { result } = run('EP25');
    const birch = result.candidate.modules.find(
      ({ moduleId }) => moduleId === 'Birch',
    );
    const cedar = result.candidate.modules.find(
      ({ moduleId }) => moduleId === 'Cedar',
    );
    expect(birch).toBeDefined();
    expect(cedar).toBeDefined();
    expect(cedar!.y).toBeLessThan(birch!.y);
    expect(result.quality).toMatchObject({
      exactEndpointCrossingCount: 0,
      adjacentRankOrderInversionCount: 0,
      adjacentRankOrderingConnectionCount: 2,
    });
  });

  it('removes the exact endpoint inversions exposed by EP12', () => {
    const { input, result } = run('EP12');
    const uniform = computeFocusSchematicUniformLayoutAttempt(input);
    expect(uniform.status).toBe('success');
    if (uniform.status !== 'success') return;
    const uniformAttachments = createFocusSchematicEndpointAttachments(
      result.endpointPlan,
      uniform.candidate,
    );
    const uniformQuality = evaluateFocusSchematicEndpointLayoutQuality(
      input,
      result.modulePlan,
      result.endpointPlan,
      result.internalLanePlan,
      uniform.candidate,
      uniformAttachments,
    );
    expect(uniformQuality).toMatchObject({
      exactEndpointCrossingCount: 3,
      adjacentRankOrderInversionCount: 3,
    });
    expect(result.quality).toMatchObject({
      exactEndpointCrossingCount: 0,
      adjacentRankOrderInversionCount: 0,
    });
  });

  it('uses exact endpoint order to swap sibling structural branches', () => {
    const { fixture, result } = run('EP26');
    const atlasFirst = result.candidate.nodes.find(
      ({ projectionNodeId: id }) =>
        id === projectionNodeId(fixture, 'Atlas-first'),
    );
    const atlasSecond = result.candidate.nodes.find(
      ({ projectionNodeId: id }) =>
        id === projectionNodeId(fixture, 'Atlas-second'),
    );
    const beaconFirst = result.candidate.nodes.find(
      ({ projectionNodeId: id }) =>
        id === projectionNodeId(fixture, 'Beacon-first'),
    );
    const beaconSecond = result.candidate.nodes.find(
      ({ projectionNodeId: id }) =>
        id === projectionNodeId(fixture, 'Beacon-second'),
    );
    expect(atlasSecond!.y).toBeLessThan(atlasFirst!.y);
    expect(beaconFirst!.y).toBeLessThan(beaconSecond!.y);
    expect(result.quality).toMatchObject({
      exactEndpointCrossingCount: 0,
      adjacentRankOrderInversionCount: 0,
      adjacentRankOrderingConnectionCount: 2,
    });
  });

  it('covers EP1–EP26 with valid deterministic plain-data results and hard geometry gates', () => {
    expect(ENDPOINT_FIXTURES.map(({ id }) => id)).toEqual(
      Array.from({ length: 26 }, (_, index) => `EP${index + 1}`),
    );
    for (const endpointSpec of ENDPOINT_FIXTURES) {
      const fixture = buildEndpointFixture(endpointSpec);
      const input = layoutInput(fixture);
      const first = computeFocusSchematicComputedLayoutAttempt(input);
      const second = computeFocusSchematicComputedLayoutAttempt(input);
      expect(first.status, endpointSpec.id).toBe('success');
      expect(second.status, endpointSpec.id).toBe('success');
      if (first.status !== 'success' || second.status !== 'success') continue;
      expect(first.result, endpointSpec.id).toEqual(second.result);
      expect(first.result.quality, endpointSpec.id).toMatchObject({
        leftDemandViolationNodeIds: [],
        rightDemandViolationNodeIds: [],
        invalidLaneTransitionEdgeIds: [],
        moduleOverlapPairs: [],
        nodeOverlapPairs: [],
        nodeOutsideModuleIds: [],
        ownModuleTraversalConnectionIds: [],
      });
      const selectedIds = new Set(
        first.result.endpointPlan.connections
          .filter(({ role }) => role === 'selected-backbone')
          .map(({ id }) => id),
      );
      expect(
        first.result.quality.obstructedSourceAttachmentConnectionIds.filter(
          (id) => selectedIds.has(id),
        ),
        endpointSpec.id,
      ).toEqual([]);
      expect(
        first.result.quality.obstructedTargetAttachmentConnectionIds.filter(
          (id) => selectedIds.has(id),
        ),
        endpointSpec.id,
      ).toEqual([]);
      expect(
        validateFocusSchematicComputedLayout(
          input,
          JSON.parse(JSON.stringify(first.result)),
        ).valid,
        endpointSpec.id,
      ).toBe(true);
    }
  });

  it('retains fallback provenance and uses a filtered module anchor without inventing an entity', () => {
    const { result } = run('EP18');
    expect(result.endpointPlan.summary.fallbackConnectionCount).toBeGreaterThan(
      0,
    );
    const filtered = result.endpointPlan.connections.find(
      (connection) =>
        connection.source.kind === 'module-anchor' ||
        connection.target.kind === 'module-anchor',
    );
    expect(filtered).toBeDefined();
    expect(
      filtered?.source.kind === 'module-anchor'
        ? filtered.source.reason
        : filtered?.target.kind === 'module-anchor'
          ? filtered.target.reason
          : null,
    ).toBe('filtered-module');
    expect(
      result.endpointPlan.summary.preciseReferenceIdCount +
        result.endpointPlan.summary.fallbackReferenceIdCount,
    ).toBe(result.endpointPlan.summary.totalReferenceIdCount);
  });

  it('records the current visible-document precondition for structural modules', () => {
    const { fixture } = run('EP19');
    expect(
      fixture.model.modules
        .filter(({ presentation }) => presentation !== 'filtered')
        .every(
          ({ documentProjectionNodeId }) => documentProjectionNodeId !== null,
        ),
    ).toBe(true);
  });

  it('keeps a same-rank secondary connection display-only and geometry-invariant', () => {
    const endpointSpec = spec('EP16');
    const withSecondary = buildEndpointFixture(endpointSpec);
    const withoutSecondary = buildEndpointFixture({
      ...endpointSpec,
      references: endpointSpec.references.slice(0, 2),
    });
    const withAttempt = computeFocusSchematicComputedLayoutAttempt(
      layoutInput(withSecondary),
    );
    const withoutAttempt = computeFocusSchematicComputedLayoutAttempt(
      layoutInput(withoutSecondary),
    );
    expect(withAttempt.status).toBe('success');
    expect(withoutAttempt.status).toBe('success');
    if (withAttempt.status !== 'success' || withoutAttempt.status !== 'success')
      return;
    expect(
      withAttempt.result.endpointPlan.connections.find(
        ({ role }) => role === 'secondary',
      ),
    ).toMatchObject({
      source: { attachmentSide: 'auto' },
      target: { attachmentSide: 'auto' },
    });
    expect(withAttempt.result.candidate).toEqual(
      withoutAttempt.result.candidate,
    );
  });

  it('preserves both authored directions in an equal-mutual relationship on the HIER2-selected side', () => {
    const { result } = run('EP17');
    expect(result.endpointPlan.connections).toHaveLength(2);
    const authoredPairs = result.endpointPlan.connections.map((connection) => [
      connection.source.kind === 'visible-entity'
        ? connection.source.entityId
        : connection.source.moduleId,
      connection.target.kind === 'visible-entity'
        ? connection.target.entityId
        : connection.target.moduleId,
    ]);
    expect(authoredPairs).toEqual(
      expect.arrayContaining([
        ['Atlas-exchange', 'Beacon-exchange'],
        ['Beacon-exchange', 'Atlas-exchange'],
      ]),
    );
    const beaconRank = result.modulePlan.modules.find(
      ({ moduleId }) => moduleId === 'Beacon',
    )?.signedRank;
    expect(Math.abs(beaconRank ?? 0)).toBe(1);
    for (const connection of result.endpointPlan.connections) {
      const atlas =
        connection.sourceModuleId === 'Atlas'
          ? connection.source
          : connection.target;
      const beacon =
        connection.sourceModuleId === 'Beacon'
          ? connection.source
          : connection.target;
      expect(atlas.attachmentSide).toBe(beaconRank === 1 ? 'right' : 'left');
      expect(beacon.attachmentSide).toBe(beaconRank === 1 ? 'left' : 'right');
    }
  });

  it('rejects altered endpoint, lane, quality, and attachment records', () => {
    const { input, result } = run('EP4');
    const endpointPlan = {
      ...result.endpointPlan,
      connections: result.endpointPlan.connections.map((connection, index) =>
        index === 0
          ? { ...connection, role: 'secondary' as const }
          : connection,
      ),
    };
    expect(
      validateFocusSchematicEndpointPlan(input, result.modulePlan, endpointPlan)
        .valid,
    ).toBe(false);
    expect(
      validateFocusSchematicInternalLanePlan(input, result.endpointPlan, {
        ...result.internalLanePlan,
        nodes: result.internalLanePlan.nodes.slice(1),
      }).valid,
    ).toBe(false);
    expect(
      validateFocusSchematicComputedLayout(input, {
        ...result,
        attachments: result.attachments.map((attachment, index) =>
          index === 0 ? { ...attachment, x: attachment.x + 1 } : attachment,
        ),
      }).valid,
    ).toBe(false);
    expect(
      validateFocusSchematicComputedLayout(input, {
        ...result,
        quality: { ...result.quality, preciseConnectionCount: 999 },
      }).valid,
    ).toBe(false);
  });

  it('selects A1 while preserving A0 as explicit development evidence', () => {
    const fixture = buildEndpointFixture(spec('EP7'));
    const input = layoutInput(fixture);
    const selected = computeFocusSchematicLayoutAttempt(input);
    const computed = computeFocusSchematicComputedLayoutAttempt(input);
    const uniform = computeFocusSchematicUniformLayoutAttempt(input);
    expect(selected.status).toBe('success');
    expect(computed.status).toBe('success');
    expect(uniform.status).toBe('success');
    if (
      selected.status !== 'success' ||
      computed.status !== 'success' ||
      uniform.status !== 'success'
    )
      return;
    expect(selected.strategyId).toBe('A1-endpoint-facing-split-lanes');
    expect(selected.candidate).toEqual(computed.result.candidate);
    expect(selected.plan).toEqual(computed.result.modulePlan);
    expect(computeFocusSchematicLayout(input)).toEqual(
      computed.result.candidate,
    );
    expect(selected.candidate).not.toEqual(uniform.candidate);
    expect(uniform.strategyId).toBe('A-two-stage-dagre');
  });

  it('builds and measures all ES1–ES8 stability pairs with stable shared IDs', () => {
    expect(ENDPOINT_STABILITY_PAIRS.map(({ id }) => id)).toEqual(
      Array.from({ length: 8 }, (_, index) => `ES${index + 1}`),
    );
    for (const pair of ENDPOINT_STABILITY_PAIRS) {
      const before = buildEndpointFixture(pair.before);
      const after = buildEndpointFixture(pair.after);
      const beforeAttempt = computeFocusSchematicComputedLayoutAttempt(
        layoutInput(before),
      );
      const afterAttempt = computeFocusSchematicComputedLayoutAttempt(
        layoutInput(after),
      );
      expect(beforeAttempt.status, `${pair.id} before`).toBe('success');
      expect(afterAttempt.status, `${pair.id} after`).toBe('success');
      if (
        beforeAttempt.status !== 'success' ||
        afterAttempt.status !== 'success'
      )
        continue;
      const beforeIds = new Set(
        beforeAttempt.result.candidate.nodes.map(
          ({ projectionNodeId: id }) => id,
        ),
      );
      expect(
        afterAttempt.result.candidate.nodes.some(({ projectionNodeId: id }) =>
          beforeIds.has(id),
        ),
        pair.id,
      ).toBe(true);
      if (pair.id === 'ES6')
        expect(afterAttempt.result.candidate).toEqual(
          beforeAttempt.result.candidate,
        );
    }
  });

  it('creates the same endpoint plan from the same canonical input and rejects semantic mutation', () => {
    const fixture = buildEndpointFixture(spec('EP15'));
    const input = layoutInput(fixture);
    const modulePlan = createFocusSchematicLayoutPlan(input.model);
    const first = createFocusSchematicEndpointPlan(input, modulePlan);
    const second = createFocusSchematicEndpointPlan(input, modulePlan);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    const changed = JSON.parse(JSON.stringify(first));
    changed.connections[0].referenceIds = [];
    expect(
      validateFocusSchematicEndpointPlan(input, modulePlan, changed).valid,
    ).toBe(false);
  });

  it('is byte-identical under independent model and projection permutations while rejecting unordered dimensions', () => {
    const fixture = buildEndpointFixture(spec('EP15'));
    const input = layoutInput(fixture);
    const baseline = computeFocusSchematicComputedLayoutAttempt(input);
    const permuted = computeFocusSchematicComputedLayoutAttempt({
      ...input,
      model: {
        ...input.model,
        modules: [...input.model.modules].reverse(),
        relationships: [...input.model.relationships]
          .reverse()
          .map((relationship) => ({
            ...relationship,
            referenceIds: [...relationship.referenceIds].reverse(),
            visibleEndpointGroups: [...relationship.visibleEndpointGroups]
              .reverse()
              .map((group) => ({
                ...group,
                referenceIds: [...group.referenceIds].reverse(),
              })),
          })),
        parentCandidates: [...input.model.parentCandidates].reverse(),
      },
      projection: {
        ...input.projection,
        nodes: [...input.projection.nodes].reverse(),
        edges: [...input.projection.edges].reverse(),
      },
    });
    expect(baseline.status).toBe('success');
    expect(permuted.status).toBe('success');
    if (baseline.status !== 'success' || permuted.status !== 'success') return;
    expect(JSON.stringify(permuted.result)).toBe(
      JSON.stringify(baseline.result),
    );
    expect(
      validateFocusSchematicLayoutInput({
        ...input,
        nodeDimensions: [...input.nodeDimensions].reverse(),
      }).valid,
    ).toBe(false);
  });
});

describe('HIER3B-FIX1 center-spine layout', () => {
  it('covers CS1–CS6 with deterministic, valid geometry', () => {
    expect(CENTER_SPINE_FIXTURES.map(({ id }) => id)).toEqual(
      Array.from({ length: 6 }, (_, index) => `CS${index + 1}`),
    );
    for (const fixtureSpec of CENTER_SPINE_FIXTURES) {
      const fixture = buildEndpointFixture(fixtureSpec);
      const input = layoutInput(fixture);
      const first = computeFocusSchematicComputedLayoutAttempt(input);
      const second = computeFocusSchematicComputedLayoutAttempt(input);
      expect(first.status, fixtureSpec.id).toBe('success');
      expect(second.status, fixtureSpec.id).toBe('success');
      if (first.status !== 'success' || second.status !== 'success') continue;
      expect(first.configId, fixtureSpec.id).toContain('A1v2-');
      expect(second.result, fixtureSpec.id).toEqual(first.result);
      expect(first.result.quality, fixtureSpec.id).toMatchObject({
        moduleOverlapPairs: [],
        nodeOverlapPairs: [],
        nodeOutsideModuleIds: [],
        invalidLaneTransitionEdgeIds: [],
        obstructedSourceAttachmentConnectionIds: [],
        obstructedTargetAttachmentConnectionIds: [],
      });
    }
  });

  it('CS1 replaces the five-wide row with a source-contiguous spine around the File', () => {
    const fixture = buildEndpointFixture(CENTER_SPINE_FIXTURES[0]!);
    const input = layoutInput(fixture);
    const attempt = computeFocusSchematicComputedLayoutAttempt(input);
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    const fileId = projectionNodeId(fixture, 'Atlas');
    const file = attempt.result.candidate.nodes.find(
      ({ projectionNodeId: id }) => id === fileId,
    )!;
    const headingIds = Array.from({ length: 5 }, (_, index) =>
      projectionNodeId(fixture, `Atlas-center-${index + 1}`),
    );
    const headings = headingIds.map((id) =>
      attempt.result.candidate.nodes.find(
        ({ projectionNodeId }) => projectionNodeId === id,
      ),
    );
    expect(new Set(headings.map((node) => node?.y)).size).toBe(5);
    expect(
      headings.filter((node) => node !== undefined && node.y < file.y),
    ).toHaveLength(2);
    expect(
      headings.filter(
        (node) => node !== undefined && node.y > file.y + file.height,
      ),
    ).toHaveLength(3);

    const atlasModule = attempt.result.candidate.modules.find(
      ({ moduleId }) => moduleId === 'Atlas',
    )!;
    const headingDimensions = input.nodeDimensions.filter(
      ({ projectionNodeId }) => headingIds.includes(projectionNodeId),
    );
    const oldFiveWideWidth =
      headingDimensions.reduce((sum, item) => sum + item.width, 0) +
      input.settings.internalNodeSeparation * (headingDimensions.length - 1) +
      input.settings.modulePaddingX * 2;
    expect(atlasModule.width).toBeLessThanOrEqual(oldFiveWideWidth);
    expect(attempt.result.quality.exactEndpointCrossingCount).toBe(0);
    expect(attempt.result.quality.adjacentRankOrderInversionCount).toBe(0);
  });

  it('CS5 applies the same center-spine rule to a non-root module', () => {
    const fixture = buildEndpointFixture(CENTER_SPINE_FIXTURES[4]!);
    const attempt = computeFocusSchematicComputedLayoutAttempt(
      layoutInput(fixture),
    );
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    const beacon = attempt.result.candidate.modules.find(
      ({ moduleId }) => moduleId === 'Beacon',
    )!;
    const beaconNodeYs = attempt.result.candidate.nodes
      .filter(({ moduleId }) => moduleId === 'Beacon')
      .map(({ y }) => y);
    expect(new Set(beaconNodeYs).size).toBe(6);
    expect(beacon.width).toBeLessThan(300);
  });

  it('accepts a within-stack swap only when exact endpoint crossings improve', () => {
    const entities = Array.from({ length: 4 }, (_, index) => ({
      id: `Atlas-center-${index + 1}`,
      kind: 'section' as const,
      documentId: 'Atlas',
      parentId: 'Atlas',
      line: 2 + index * 2,
    }));
    const fixture = buildEndpointFixture({
      id: 'CS7',
      label: 'Endpoint-driven center swap',
      authored: 'Four dual-demand branches connect matching left/right Files.',
      expectation: 'A crossing pair swaps only inside its existing stack.',
      inspect: 'The File remains between the above and below stacks.',
      rootDocumentId: 'Atlas',
      documents: [
        { id: 'Atlas' },
        ...Array.from({ length: 4 }, (_, index) => ({
          id: `Left-${index + 1}`,
        })),
        ...Array.from({ length: 4 }, (_, index) => ({
          id: `Right-${index + 1}`,
        })),
      ],
      entities,
      references: entities.flatMap((entity, index) => [
        {
          sourceEntityId: `Left-${index + 1}`,
          targetEntityId: entity.id,
        },
        {
          sourceEntityId: entity.id,
          targetEntityId: `Right-${index + 1}`,
        },
      ]),
      hops: 1,
    });
    const input = layoutInput(fixture);
    const attempt = computeFocusSchematicComputedLayoutAttempt(input);
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    const ids = entities.map(({ id }) => projectionNodeId(fixture, id));
    const fileId = projectionNodeId(fixture, 'Atlas');
    const file = attempt.result.candidate.nodes.find(
      ({ projectionNodeId: id }) => id === fileId,
    )!;
    const above = attempt.result.candidate.nodes
      .filter(({ projectionNodeId: id, y }) => ids.includes(id) && y < file.y)
      .sort((left, right) => left.y - right.y);
    expect(above).toHaveLength(2);
    const [first, second] = above;
    const crossed = {
      ...attempt.result.candidate,
      nodes: attempt.result.candidate.nodes.map((node) =>
        node.projectionNodeId === first!.projectionNodeId
          ? { ...node, y: second!.y }
          : node.projectionNodeId === second!.projectionNodeId
            ? { ...node, y: first!.y }
            : node,
      ),
    };
    const before = measureFocusSchematicEndpointOrder(
      attempt.result.modulePlan,
      attempt.result.endpointPlan,
      crossed,
    );
    const repaired = minimizeFocusSchematicCenterStackCrossings(
      input,
      attempt.result.modulePlan,
      attempt.result.endpointPlan,
      attempt.result.internalLanePlan,
      crossed,
    );
    const after = measureFocusSchematicEndpointOrder(
      attempt.result.modulePlan,
      attempt.result.endpointPlan,
      repaired,
    );
    expect(before.exactEndpointCrossingCount).toBeGreaterThan(
      after.exactEndpointCrossingCount,
    );
    expect(
      repaired.nodes
        .filter(({ projectionNodeId: id }) => ids.includes(id))
        .every(
          (node) =>
            node.y + node.height <= file.y || node.y >= file.y + file.height,
        ),
    ).toBe(true);
  });
});
