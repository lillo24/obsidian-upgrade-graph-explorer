import { Worker } from 'node:worker_threads';

import {
  evaluateFocusSchematicLayout,
  compareFocusSchematicLayouts,
} from '@icarus-graph-explorer/focus-schematic';
import {
  buildEndpointFixture,
  computeFocusSchematicComputedLayoutAttempt,
  computeFocusSchematicUniformLayoutAttempt,
  createFocusSchematicEndpointAttachments,
  ENDPOINT_FIXTURES,
  ENDPOINT_STABILITY_PAIRS,
  evaluateFocusSchematicEndpointLayoutQuality,
  FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
  type EndpointFixtureSpec,
  type FocusSchematicComputedLayoutAttempt,
  type FocusSchematicLayoutInput,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';

type Profile = 'fixtures' | 'small' | 'medium' | 'hub' | 'stability';

function profileFromArgs(): Profile {
  const index = process.argv.indexOf('--profile');
  const value = index < 0 ? 'small' : process.argv[index + 1];
  if (
    !['fixtures', 'small', 'medium', 'hub', 'stability'].includes(value ?? '')
  )
    throw new Error('Expected --profile fixtures|small|medium|hub|stability.');
  return value as Profile;
}

const document = (id: string) => ({ id });
const section = (
  id: string,
  documentId: string,
  line: number,
  parentId = documentId,
) => ({ id, kind: 'section' as const, documentId, parentId, line });
const reference = (sourceEntityId: string, targetEntityId: string) => ({
  sourceEntityId,
  targetEntityId,
});

function hubSpec(moduleCount: number): EndpointFixtureSpec {
  const leaves = Array.from(
    { length: moduleCount - 1 },
    (_, index) => `Leaf-${String(index + 1).padStart(3, '0')}`,
  );
  return {
    id: `EP${800 + moduleCount}`,
    label: `${moduleCount}-module endpoint hub`,
    authored: `Atlas points to ${leaves.length} File endpoints.`,
    expectation: 'Bounded deterministic hub evidence.',
    inspect: 'Performance profile only.',
    rootDocumentId: 'Atlas',
    documents: [document('Atlas'), ...leaves.map(document)],
    references: leaves.map((target) => reference('Atlas', target)),
    direction: 'outgoing',
    hops: 1,
  };
}

function largeModuleSpec(sectionCount: number): EndpointFixtureSpec {
  const atlasSections = Array.from({ length: sectionCount }, (_, index) =>
    section(`Atlas-section-${index + 1}`, 'Atlas', index + 2),
  );
  const beaconSections = Array.from({ length: 12 }, (_, index) =>
    section(`Beacon-section-${index + 1}`, 'Beacon', index + 2),
  );
  return {
    id: `EP${900 + sectionCount}`,
    label: `${sectionCount}-Heading mixed module`,
    authored:
      'A bounded sample of Headings receives and sends exact references.',
    expectation: 'Large single-module hierarchy performance evidence.',
    inspect: 'Performance profile only.',
    rootDocumentId: 'Atlas',
    documents: [document('Near'), document('Atlas'), document('Beacon')],
    entities: [
      section('Near-source', 'Near', 2),
      ...atlasSections,
      ...beaconSections,
    ],
    references: [
      reference('Near-source', 'Atlas-section-1'),
      ...beaconSections
        .slice(0, 10)
        .map((target, index) =>
          reference(`Atlas-section-${index + 2}`, target.id),
        ),
    ],
    direction: 'both',
    hops: 1,
  };
}

function manySmallModulesSpec(moduleCount: number): EndpointFixtureSpec {
  const leaves = Array.from(
    { length: moduleCount - 1 },
    (_, index) => `Note-${String(index + 1).padStart(3, '0')}`,
  );
  return {
    id: `EP${1000 + moduleCount}`,
    label: `${moduleCount} small Heading modules`,
    authored: 'Atlas > Links points to one Heading in every neighbouring File.',
    expectation: 'Many small internal Dagre calls remain bounded.',
    inspect: 'Performance profile only.',
    rootDocumentId: 'Atlas',
    documents: [document('Atlas'), ...leaves.map(document)],
    entities: [
      section('Atlas-links', 'Atlas', 2),
      ...leaves.map((id) => section(`${id}-target`, id, 2)),
    ],
    references: leaves.map((id) => reference('Atlas-links', `${id}-target`)),
    direction: 'outgoing',
    hops: 1,
  };
}

function hardGates(
  input: FocusSchematicLayoutInput,
  attempt: Extract<FocusSchematicComputedLayoutAttempt, { status: 'success' }>,
) {
  const base = evaluateFocusSchematicLayout(
    input.model,
    attempt.result.candidate,
    {
      clearance: FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
      rankTolerance: 1,
    },
  );
  const selected = new Set(
    attempt.result.endpointPlan.connections
      .filter(({ role }) => role === 'selected-backbone')
      .map(({ id }) => id),
  );
  const failures = [
    ...(base.moduleOverlapPairs.length > 0
      ? [`module-overlap:${base.moduleOverlapPairs.length}`]
      : []),
    ...(base.nodeOverlapPairs.length > 0
      ? [`node-overlap:${base.nodeOverlapPairs.length}`]
      : []),
    ...(base.nodeOutsideModuleIds.length > 0
      ? [`node-outside:${base.nodeOutsideModuleIds.length}`]
      : []),
    ...(base.nonFiniteGeometryCount > 0
      ? [`non-finite:${base.nonFiniteGeometryCount}`]
      : []),
    ...(base.leftSideViolationModuleIds.length > 0
      ? [`left-rank:${base.leftSideViolationModuleIds.length}`]
      : []),
    ...(base.rightSideViolationModuleIds.length > 0
      ? [`right-rank:${base.rightSideViolationModuleIds.length}`]
      : []),
    ...(base.rankOrderViolationModuleIds.length > 0
      ? [`rank-order:${base.rankOrderViolationModuleIds.length}`]
      : []),
    ...(attempt.result.quality.leftDemandViolationNodeIds.length > 0
      ? [
          `left-demand:${attempt.result.quality.leftDemandViolationNodeIds.length}`,
        ]
      : []),
    ...(attempt.result.quality.rightDemandViolationNodeIds.length > 0
      ? [
          `right-demand:${attempt.result.quality.rightDemandViolationNodeIds.length}`,
        ]
      : []),
    ...(attempt.result.quality.invalidLaneTransitionEdgeIds.length > 0
      ? [
          `lane-transition:${attempt.result.quality.invalidLaneTransitionEdgeIds.length}`,
        ]
      : []),
    ...(attempt.result.quality.obstructedSourceAttachmentConnectionIds.filter(
      (id) => selected.has(id),
    ).length > 0
      ? ['selected-source-obstruction']
      : []),
    ...(attempt.result.quality.obstructedTargetAttachmentConnectionIds.filter(
      (id) => selected.has(id),
    ).length > 0
      ? ['selected-target-obstruction']
      : []),
  ];
  return { passed: failures.length === 0, failures };
}

async function isolatedAttempt(
  input: FocusSchematicLayoutInput,
  timeoutMs: number,
): Promise<FocusSchematicComputedLayoutAttempt> {
  return await new Promise((resolveAttempt) => {
    const worker = new Worker(
      new URL('./endpoint-attempt-worker.ts', import.meta.url),
      { workerData: { input }, execArgv: process.execArgv },
    );
    const timer = setTimeout(() => {
      void worker.terminate();
      resolveAttempt({
        status: 'failure',
        strategyId: 'A1-endpoint-facing-split-lanes',
        configId: 'isolated-timeout',
        reason: `Endpoint attempt exceeded ${timeoutMs} ms.`,
        timings: {
          inputMs: 0,
          modulePlanningMs: 0,
          endpointConnectionMs: 0,
          demandCollectionMs: 0,
          subtreePropagationMs: 0,
          laneAssignmentMs: 0,
          centerLayoutMs: 0,
          leftLayoutMs: 0,
          rightLayoutMs: 0,
          compositionMs: 0,
          macroMs: 0,
          attachmentMs: 0,
          qualityMs: 0,
          validationMs: 0,
          serializationMs: 0,
          totalMs: timeoutMs,
          dagreCallCount: 0,
          inputSerializedBytes: 0,
          outputSerializedBytes: 0,
          endpointLaneSerializedBytes: 0,
        },
      });
    }, timeoutMs);
    worker.once('message', (attempt: FocusSchematicComputedLayoutAttempt) => {
      clearTimeout(timer);
      resolveAttempt(attempt);
    });
    worker.once('error', (error) => {
      clearTimeout(timer);
      resolveAttempt({
        status: 'failure',
        strategyId: 'A1-endpoint-facing-split-lanes',
        configId: 'isolated-worker-failure',
        reason: error.message,
        timings: {
          inputMs: 0,
          modulePlanningMs: 0,
          endpointConnectionMs: 0,
          demandCollectionMs: 0,
          subtreePropagationMs: 0,
          laneAssignmentMs: 0,
          centerLayoutMs: 0,
          leftLayoutMs: 0,
          rightLayoutMs: 0,
          compositionMs: 0,
          macroMs: 0,
          attachmentMs: 0,
          qualityMs: 0,
          validationMs: 0,
          serializationMs: 0,
          totalMs: 0,
          dagreCallCount: 0,
          inputSerializedBytes: 0,
          outputSerializedBytes: 0,
          endpointLaneSerializedBytes: 0,
        },
      });
    });
  });
}

async function summarize(spec: EndpointFixtureSpec, isolated = false) {
  const fixture = buildEndpointFixture(spec);
  const input = createLayoutInput(fixture);
  const a0 = computeFocusSchematicUniformLayoutAttempt(input);
  const a1 = isolated
    ? await isolatedAttempt(input, 20_000)
    : computeFocusSchematicComputedLayoutAttempt(input);
  if (a0.status !== 'success')
    return {
      fixtureId: spec.id,
      A0: { status: a0.status, reason: a0.reason },
      A1: a1,
    };
  if (a1.status !== 'success')
    return {
      fixtureId: spec.id,
      moduleCount: input.model.modules.length,
      visibleNodeCount: input.nodeDimensions.length,
      A0: {
        status: 'success',
        totalMs: a0.timings.totalMs,
        area: a0.quality.totalBoundsArea,
      },
      A1: { status: a1.status, reason: a1.reason, totalMs: a1.timings.totalMs },
    };
  const a0Attachments = createFocusSchematicEndpointAttachments(
    a1.result.endpointPlan,
    a0.candidate,
  );
  const a0EndpointQuality = evaluateFocusSchematicEndpointLayoutQuality(
    input,
    a1.result.endpointPlan,
    a1.result.internalLanePlan,
    a0.candidate,
    a0Attachments,
  );
  const repeated = computeFocusSchematicComputedLayoutAttempt(input);
  return {
    fixtureId: spec.id,
    label: spec.label,
    moduleCount: input.model.modules.length,
    visibleNodeCount: input.nodeDimensions.length,
    A0: {
      status: 'success',
      totalMs: a0.timings.totalMs,
      area: a0EndpointQuality.totalBoundsArea,
      sideViolations:
        a0EndpointQuality.leftDemandViolationNodeIds.length +
        a0EndpointQuality.rightDemandViolationNodeIds.length,
      obstructions:
        a0EndpointQuality.obstructedSourceAttachmentConnectionIds.length +
        a0EndpointQuality.obstructedTargetAttachmentConnectionIds.length,
      dagreCallCount:
        input.model.modules.filter(
          ({ presentation }) => presentation !== 'filtered',
        ).length + 1,
      outputSerializedBytes: new TextEncoder().encode(
        JSON.stringify(a0.candidate),
      ).byteLength,
    },
    A1: {
      status: 'success',
      hardGates: hardGates(input, a1),
      deterministic:
        repeated.status === 'success' &&
        JSON.stringify(repeated.result) === JSON.stringify(a1.result),
      totalMs: a1.timings.totalMs,
      phases: a1.timings,
      area: a1.result.quality.totalBoundsArea,
      sideViolations:
        a1.result.quality.leftDemandViolationNodeIds.length +
        a1.result.quality.rightDemandViolationNodeIds.length,
      obstructions:
        a1.result.quality.obstructedSourceAttachmentConnectionIds.length +
        a1.result.quality.obstructedTargetAttachmentConnectionIds.length,
      preciseReferenceCoverage: a1.result.quality.preciseReferenceCoverage,
    },
  };
}

async function stabilityEvidence() {
  return ENDPOINT_STABILITY_PAIRS.map((pair) => {
    const beforeFixture = buildEndpointFixture(pair.before);
    const afterFixture = buildEndpointFixture(pair.after);
    const before = computeFocusSchematicComputedLayoutAttempt(
      createLayoutInput(beforeFixture),
    );
    const after = computeFocusSchematicComputedLayoutAttempt(
      createLayoutInput(afterFixture),
    );
    if (before.status !== 'success' || after.status !== 'success')
      return { id: pair.id, status: 'failure' };
    const moduleStability = compareFocusSchematicLayouts({
      beforeModel: beforeFixture.model,
      beforeLayout: before.result.candidate,
      afterModel: afterFixture.model,
      afterLayout: after.result.candidate,
    });
    const beforeNodes = new Map(
      before.result.candidate.nodes.map((node) => [
        node.projectionNodeId,
        center(node),
      ]),
    );
    const afterNodes = new Map(
      after.result.candidate.nodes.map((node) => [
        node.projectionNodeId,
        center(node),
      ]),
    );
    const sharedNodeDisplacements = [...beforeNodes]
      .filter(([id]) => afterNodes.has(id))
      .map(([id, point]) => {
        const next = afterNodes.get(id)!;
        return Math.hypot(next.x - point.x, next.y - point.y);
      });
    const beforeLanes = new Map(
      before.result.internalLanePlan.nodes.map((node) => [
        node.projectionNodeId,
        node.lane,
      ]),
    );
    const laneChanges = after.result.internalLanePlan.nodes.filter(
      (node) =>
        beforeLanes.has(node.projectionNodeId) &&
        beforeLanes.get(node.projectionNodeId) !== node.lane,
    ).length;
    return {
      id: pair.id,
      status: 'success',
      moduleStability,
      sharedNodeCount: sharedNodeDisplacements.length,
      maximumSharedNodeDisplacement: Math.max(0, ...sharedNodeDisplacements),
      laneChanges,
      geometryByteIdentical:
        JSON.stringify(before.result.candidate) ===
        JSON.stringify(after.result.candidate),
    };
  });
}

function center(rectangle: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}) {
  return {
    x: rectangle.x + rectangle.width / 2,
    y: rectangle.y + rectangle.height / 2,
  };
}

const profile = profileFromArgs();
let rows: unknown;
if (profile === 'fixtures')
  rows = await Promise.all(ENDPOINT_FIXTURES.map((spec) => summarize(spec)));
else if (profile === 'small')
  rows = await Promise.all(
    ['EP4', 'EP7', 'EP9', 'EP10', 'EP12', 'EP18', 'EP22'].map((id) =>
      summarize(ENDPOINT_FIXTURES.find((spec) => spec.id === id)!),
    ),
  );
else if (profile === 'medium')
  rows = await Promise.all([
    summarize(hubSpec(120)),
    summarize(largeModuleSpec(120)),
    summarize(manySmallModulesSpec(120)),
  ]);
else if (profile === 'hub') rows = [await summarize(hubSpec(500), true)];
else rows = await stabilityEvidence();

process.stdout.write(
  `${JSON.stringify(
    {
      schemaVersion: 1,
      profile,
      dagreVersion: '3.1.1',
      coldStateless: true,
      timingThresholdAdded: false,
      rows,
    },
    null,
    2,
  )}\n`,
);
