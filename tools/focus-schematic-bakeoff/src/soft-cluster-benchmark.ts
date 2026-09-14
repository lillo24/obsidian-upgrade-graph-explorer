import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compareFocusSchematicLayouts,
  type FocusSchematicLayoutCandidate,
} from '@icarus-graph-explorer/focus-schematic';
import {
  buildEndpointFixture,
  compareFocusSchematicSoftInternalVariants,
  computeFocusSchematicComputedLayoutAttempt,
  computeFocusSchematicSoftClusterLayoutAttempt,
  createFocusSchematicEndpointAttachments,
  measureFocusSchematicAttachmentCrossings,
  createSoftClusterHubFixture,
  createSoftClusterMultiplicityFixture,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  SOFT_ADAPTIVE_COMPASS_FIXTURES,
  FOCUS_SCHEMATIC_SOFT_CLUSTER_BASELINE_SPACING,
  FOCUS_SCHEMATIC_SOFT_SPACING_COMPACT,
  FOCUS_SCHEMATIC_SOFT_SPACING_SELECTED,
  FOCUS_SCHEMATIC_SOFT_SPACING_SPACIOUS,
  SOFT_CLUSTER_FIXTURES,
  SOFT_CLUSTER_STABILITY_PAIRS,
  type EndpointFixtureSpec,
  type FocusSchematicEndpointPlan,
  type FocusSchematicSoftFolderDisplayIntent,
  type FocusSchematicSoftHierarchyForcePolicy,
  type FocusSchematicSoftClusterStrength,
  type FocusSchematicSoftClusterOptions,
  type FocusSchematicSoftClusterSpacingPolicy,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';

const strengths = [0, 25, 50, 75, 100] as const;
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));

function inputFor(spec: EndpointFixtureSpec, bands: boolean) {
  return createLayoutInput(buildEndpointFixture(spec), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: bands,
  });
}

function soft(
  spec: EndpointFixtureSpec,
  strength: FocusSchematicSoftClusterStrength,
  displayIntent: FocusSchematicSoftFolderDisplayIntent = {
    fileParentOverrides: [],
    flattenedFolderKeys: [],
  },
  hierarchyForcePolicy: FocusSchematicSoftHierarchyForcePolicy = 'normalized-decay',
  layoutOptions: Omit<
    FocusSchematicSoftClusterOptions,
    'strength' | 'displayIntent' | 'hierarchyForcePolicy'
  > = {},
) {
  const input = inputFor(spec, false);
  const first = computeFocusSchematicSoftClusterLayoutAttempt(input, {
    ...layoutOptions,
    strength,
    displayIntent,
    hierarchyForcePolicy,
  });
  const second = computeFocusSchematicSoftClusterLayoutAttempt(input, {
    ...layoutOptions,
    strength,
    displayIntent,
    hierarchyForcePolicy,
  });
  if (first.status !== 'success')
    throw new Error(`${spec.id}/${strength}: ${first.reason}`);
  if (second.status !== 'success')
    throw new Error(`${spec.id}/${strength} repeat: ${second.reason}`);
  const root = input.model.modules.find(
    ({ id }) => id === input.model.rootModuleId,
  )!;
  const rootFile = first.result.candidate.nodes.find(
    ({ projectionNodeId }) =>
      projectionNodeId === root.documentProjectionNodeId,
  )!;
  return {
    fixtureId: spec.id,
    fixtureLabel: spec.label,
    strength,
    softSpacing: first.evidence.softSpacing,
    resolvedSpacing: first.evidence.resolvedSpacing,
    deterministic:
      JSON.stringify(first.result.candidate) ===
      JSON.stringify(second.result.candidate),
    rootFileCentered:
      Math.abs(rootFile.x + rootFile.width / 2) < 1e-8 &&
      Math.abs(rootFile.y + rootFile.height / 2) < 1e-8,
    hardGates: {
      overlapFree: first.evidence.metrics.overlapCount === 0,
      nodeContainment: first.result.quality.nodeOutsideModuleIds.length === 0,
      secondaryGeometryInfluence: first.evidence.secondaryGeometryInfluence,
      boundedSchedule:
        JSON.stringify(first.evidence.fixedIterationSchedule) === '[36,18]',
    },
    metrics: first.evidence.metrics,
    runtime: first.evidence.runtime,
    compass: first.evidence.compass,
    internalMetrics: first.result.internalLayoutEvidence.metrics,
    fileParentOverrideCount: first.evidence.fileParentOverrideCount,
    flattenedFolderCount: first.evidence.flattenedFolderCount,
    displayedFolderCount: first.evidence.displayedFolderCount,
    automaticallyCompressedFolderCount:
      first.evidence.automaticallyCompressedFolderCount,
    hierarchyForcePolicy: first.evidence.hierarchyForcePolicy,
    maximumPerFileFolderWeight: first.evidence.maximumPerFileFolderWeight,
    attachmentSideCounts: Object.fromEntries(
      ['left', 'right', 'top', 'bottom'].map((side) => [
        side,
        first.result.attachments.filter(
          (attachment) => attachment.side === side,
        ).length,
      ]),
    ),
    adaptiveRegionUse: (() => {
      const modules = first.result.internalLayoutEvidence.moduleMetrics.filter(
        ({ topLevelBranchCount }) => topLevelBranchCount > 0,
      );
      const regionCounts = modules.map(
        (module) =>
          [
            module.branchesLeftOfFile,
            module.branchesRightOfFile,
            module.branchesAboveFile,
            module.branchesBelowFile,
          ].filter((count) => count > 0).length,
      );
      return {
        modulesByRegionCount: Object.fromEntries(
          [1, 2, 3, 4].map((count) => [
            count,
            regionCounts.filter((value) => value === count).length,
          ]),
        ),
        branches: {
          left: modules.reduce(
            (sum, module) => sum + module.branchesLeftOfFile,
            0,
          ),
          right: modules.reduce(
            (sum, module) => sum + module.branchesRightOfFile,
            0,
          ),
          top: modules.reduce(
            (sum, module) => sum + module.branchesAboveFile,
            0,
          ),
          bottom: modules.reduce(
            (sum, module) => sum + module.branchesBelowFile,
            0,
          ),
        },
        branchRegionChurn: first.evidence.runtime.compassBranchRegionChurn,
      };
    })(),
  };
}

const fix2HierarchyFixture: EndpointFixtureSpec = {
  id: 'SC25',
  label: 'HIER4B-FIX2 nested display stress',
  authored:
    'Synthetic nested exact-folder registry for display-intent benchmarks.',
  expectation: 'Sparse intent remains deterministic and bounded.',
  inspect: 'Compare File promotion, folder flattening, and high-count intent.',
  rootDocumentId: 'Focus',
  documents: [
    { id: 'Focus', path: 'root/Focus.md' },
    { id: 'LanguageParent', path: 'Language/Parent.md' },
    { id: 'Pragmatics', path: 'Language/Pragmatics/File.md' },
    { id: 'Grammar', path: 'Language/Grammar/File.md' },
    { id: 'PatternA', path: 'Pattern Theory/A/File.md' },
    { id: 'PatternB', path: 'Pattern Theory/B/File.md' },
    { id: 'Deep', path: 'A/B/C/File.md' },
    ...Array.from({ length: 30 }, (_, index) => ({
      id: `Team${index}`,
      path: `Teams/Team${index}/Child/File.md`,
    })),
  ],
  references: [
    'LanguageParent',
    'Pragmatics',
    'Grammar',
    'PatternA',
    'PatternB',
    'Deep',
    ...Array.from({ length: 30 }, (_, index) => `Team${index}`),
  ].map((targetEntityId) => ({ sourceEntityId: 'Focus', targetEntityId })),
  hops: 1,
};

const fix2IntentRows = [
  {
    profile: 'mixed-display-intent',
    intent: {
      fileParentOverrides: [
        { fileId: 'Pragmatics', displayParentFolderKey: 'Language' },
      ],
      flattenedFolderKeys: ['Pattern Theory/A', 'Pattern Theory/B'],
    },
  },
  {
    profile: 'promoted-file',
    intent: {
      fileParentOverrides: [
        { fileId: 'Pragmatics', displayParentFolderKey: 'Language' },
      ],
      flattenedFolderKeys: [],
    },
  },
  {
    profile: 'flattened-siblings',
    intent: {
      fileParentOverrides: [],
      flattenedFolderKeys: ['Language/Grammar', 'Language/Pragmatics'],
    },
  },
  {
    profile: 'deep-repeated-file-promotion',
    intent: {
      fileParentOverrides: [{ fileId: 'Deep', displayParentFolderKey: '.' }],
      flattenedFolderKeys: [],
    },
  },
  {
    profile: 'many-flattened-folders',
    intent: {
      fileParentOverrides: [],
      flattenedFolderKeys: Array.from(
        { length: 30 },
        (_, index) => `Teams/Team${index}/Child`,
      ),
    },
  },
].map(({ profile, intent }) => ({
  profile,
  ...soft(fix2HierarchyFixture, 50, intent),
}));

const hierarchyForceFixtures: readonly {
  readonly id: string;
  readonly spec: EndpointFixtureSpec;
  readonly intent: FocusSchematicSoftFolderDisplayIntent;
}[] = [
  {
    id: 'HFA1',
    spec: {
      id: 'HFA1',
      label: 'parent direct File plus two-File child',
      authored: 'Nested hierarchy force fixture.',
      expectation: 'Child and parent coherence are both measurable.',
      inspect: 'Compare bounded hierarchy policies.',
      rootDocumentId: 'Focus',
      documents: [
        { id: 'Focus', path: 'Focus.md' },
        { id: 'Parent', path: 'A/Parent.md' },
        { id: 'Child1', path: 'A/B/Child1.md' },
        { id: 'Child2', path: 'A/B/Child2.md' },
      ],
      references: [
        { sourceEntityId: 'Focus', targetEntityId: 'Parent' },
        { sourceEntityId: 'Parent', targetEntityId: 'Child1' },
        { sourceEntityId: 'Parent', targetEntityId: 'Child2' },
      ],
      hops: 3,
    },
    intent: { fileParentOverrides: [], flattenedFolderKeys: [] },
  },
  {
    id: 'HFA2',
    spec: {
      id: 'HFA2',
      label: 'two sibling nested child folders',
      authored: 'Nested hierarchy force fixture.',
      expectation: 'Sibling child coherence remains useful.',
      inspect: 'Compare both child scopes inside one parent.',
      rootDocumentId: 'Focus',
      documents: [
        { id: 'Focus', path: 'Focus.md' },
        { id: 'B1', path: 'A/B/B1.md' },
        { id: 'B2', path: 'A/B/B2.md' },
        { id: 'C1', path: 'A/C/C1.md' },
        { id: 'C2', path: 'A/C/C2.md' },
      ],
      references: ['B1', 'B2', 'C1', 'C2'].map((targetEntityId) => ({
        sourceEntityId: 'Focus',
        targetEntityId,
      })),
      hops: 2,
    },
    intent: { fileParentOverrides: [], flattenedFolderKeys: [] },
  },
  {
    id: 'HFA3',
    spec: {
      id: 'HFA3',
      label: 'depth-three hierarchy',
      authored: 'Nested hierarchy force fixture.',
      expectation: 'Depth does not amplify total force.',
      inspect: 'Compare Files at each level.',
      rootDocumentId: 'Focus',
      documents: [
        { id: 'Focus', path: 'Focus.md' },
        { id: 'A', path: 'A/A.md' },
        { id: 'B', path: 'A/B/B.md' },
        { id: 'C1', path: 'A/B/C/C1.md' },
        { id: 'C2', path: 'A/B/C/C2.md' },
      ],
      references: ['A', 'B', 'C1', 'C2'].map((targetEntityId) => ({
        sourceEntityId: 'Focus',
        targetEntityId,
      })),
      hops: 3,
    },
    intent: { fileParentOverrides: [], flattenedFolderKeys: [] },
  },
  {
    id: 'HFA4',
    spec: {
      id: 'HFA4',
      label: 'promoted File leaves child folder',
      authored: 'Nested hierarchy force fixture.',
      expectation: 'Only one File changes displayed membership.',
      inspect: 'Compare promoted File with retained siblings.',
      rootDocumentId: 'Focus',
      documents: [
        { id: 'Focus', path: 'Focus.md' },
        { id: 'Parent', path: 'A/Parent.md' },
        { id: 'Move', path: 'A/B/Move.md' },
        { id: 'Stay1', path: 'A/B/Stay1.md' },
        { id: 'Stay2', path: 'A/B/Stay2.md' },
      ],
      references: ['Parent', 'Move', 'Stay1', 'Stay2'].map(
        (targetEntityId) => ({
          sourceEntityId: 'Focus',
          targetEntityId,
        }),
      ),
      hops: 2,
    },
    intent: {
      fileParentOverrides: [{ fileId: 'Move', displayParentFolderKey: 'A' }],
      flattenedFolderKeys: [],
    },
  },
  {
    id: 'HFA5',
    spec: {
      id: 'HFA5',
      label: 'flattened folder with surviving grandchild',
      authored: 'Nested hierarchy force fixture.',
      expectation: 'Flattened layer loses force while grandchild survives.',
      inspect: 'Compare parent and surviving child coherence.',
      rootDocumentId: 'Focus',
      documents: [
        { id: 'Focus', path: 'Focus.md' },
        { id: 'Parent', path: 'A/Parent.md' },
        { id: 'Lifted', path: 'A/B/Lifted.md' },
        { id: 'C1', path: 'A/B/C/C1.md' },
        { id: 'C2', path: 'A/B/C/C2.md' },
      ],
      references: ['Parent', 'Lifted', 'C1', 'C2'].map((targetEntityId) => ({
        sourceEntityId: 'Focus',
        targetEntityId,
      })),
      hops: 2,
    },
    intent: { fileParentOverrides: [], flattenedFolderKeys: ['A/B'] },
  },
  {
    id: 'HFA6',
    spec: {
      id: 'HFA6',
      label: 'disconnected same-folder islands',
      authored: 'Nested hierarchy force fixture.',
      expectation: 'Topology may keep one logical folder spatially split.',
      inspect: 'Compare force without forcing a misleading hull.',
      rootDocumentId: 'Focus',
      documents: [
        { id: 'Focus', path: 'Focus.md' },
        { id: 'A1', path: 'A/A1.md' },
        { id: 'A2', path: 'A/A2.md' },
        { id: 'B1', path: 'B/B1.md' },
        { id: 'B2', path: 'B/B2.md' },
      ],
      references: [
        { sourceEntityId: 'Focus', targetEntityId: 'A1' },
        { sourceEntityId: 'A1', targetEntityId: 'B1' },
        { sourceEntityId: 'B1', targetEntityId: 'B2' },
        { sourceEntityId: 'B2', targetEntityId: 'A2' },
      ],
      hops: 3,
    },
    intent: { fileParentOverrides: [], flattenedFolderKeys: [] },
  },
  {
    id: 'HFA7',
    spec: {
      id: 'HFA7',
      label: 'topology pulls against nesting',
      authored: 'Nested hierarchy force fixture.',
      expectation: 'Hard topology gates remain valid.',
      inspect: 'Compare crossings and coherence.',
      rootDocumentId: 'Focus',
      documents: [
        { id: 'Focus', path: 'Focus.md' },
        { id: 'A1', path: 'A/A1.md' },
        { id: 'A2', path: 'A/A2.md' },
        { id: 'B1', path: 'A/B/B1.md' },
        { id: 'B2', path: 'A/B/B2.md' },
      ],
      references: [
        { sourceEntityId: 'Focus', targetEntityId: 'A1' },
        { sourceEntityId: 'Focus', targetEntityId: 'A2' },
        { sourceEntityId: 'A1', targetEntityId: 'B2' },
        { sourceEntityId: 'A2', targetEntityId: 'B1' },
      ],
      hops: 2,
    },
    intent: { fileParentOverrides: [], flattenedFolderKeys: [] },
  },
];

const hierarchyForcePolicies = [
  'nearest-only',
  'normalized-decay',
  'normalized-equal',
] as const;
const hierarchyForceRows = hierarchyForceFixtures.flatMap(
  ({ id, spec, intent }) =>
    hierarchyForcePolicies.map((policy) => ({
      id,
      policy,
      ...soft(spec, 50, intent, policy),
    })),
);
const hierarchyStrengthRows = hierarchyForceFixtures.flatMap(
  ({ id, spec, intent }) =>
    strengths.map((strength) => ({
      id,
      ...soft(spec, strength, intent, 'normalized-decay'),
    })),
);

function cardinalPlan(
  connections: readonly {
    readonly id: string;
    readonly sourceModuleId: string;
    readonly targetModuleId: string;
  }[],
): FocusSchematicEndpointPlan {
  const endpoint = (moduleId: string) => ({
    kind: 'visible-entity' as const,
    projectionNodeId: `node-${moduleId}`,
    entityId: `entity-${moduleId}`,
    entityKind: 'document' as const,
    moduleId,
    attachmentSide: 'right' as const,
  });
  return {
    schemaVersion: 1,
    rootModuleId: 'root',
    connections: connections.map(({ id, sourceModuleId, targetModuleId }) => ({
      id,
      kind: 'precise',
      relationshipId: `relationship-${id}`,
      projectedEdgeId: `edge-${id}`,
      referenceIds: [`reference-${id}`],
      sourceModuleId,
      targetModuleId,
      source: endpoint(sourceModuleId),
      target: endpoint(targetModuleId),
      role: 'focus-path',
    })),
    nodeDemands: [],
    summary: {
      preciseConnectionCount: connections.length,
      fallbackConnectionCount: 0,
      preciseReferenceIdCount: connections.length,
      fallbackReferenceIdCount: 0,
      totalReferenceIdCount: connections.length,
    },
  };
}

function cardinalCandidate(
  positions: Readonly<Record<string, readonly [number, number]>>,
): FocusSchematicLayoutCandidate {
  const modules = Object.entries(positions).map(([moduleId, [x, y]]) => ({
    moduleId,
    x,
    y,
    width: 100,
    height: 100,
  }));
  return {
    modelSchemaVersion: 1,
    rootModuleId: 'root',
    modules,
    nodes: modules.map((module) => ({
      projectionNodeId: `node-${module.moduleId}`,
      moduleId: module.moduleId,
      x: module.x + 20,
      y: module.y + 20,
      width: 60,
      height: 60,
    })),
    routes: [],
  };
}

const cardinalConnections = ['left', 'right', 'top', 'bottom'].map((side) => ({
  id: side,
  sourceModuleId: 'root',
  targetModuleId: side,
}));
const cardinalGeometryRows = [
  {
    profile: '4-side-root-fan',
    plan: cardinalPlan(cardinalConnections),
    candidate: cardinalCandidate({
      root: [0, 0],
      left: [-300, 0],
      right: [300, 0],
      top: [0, -300],
      bottom: [0, 300],
    }),
  },
  {
    profile: 'vertical-file-fan',
    plan: cardinalPlan(cardinalConnections.slice(2)),
    candidate: cardinalCandidate({
      root: [0, 0],
      top: [0, -300],
      bottom: [0, 300],
    }),
  },
  {
    profile: 'cardinal-crossing-regression',
    plan: cardinalPlan([
      { id: 'descending', sourceModuleId: 'leftA', targetModuleId: 'rightB' },
      { id: 'ascending', sourceModuleId: 'leftB', targetModuleId: 'rightA' },
    ]),
    candidate: cardinalCandidate({
      root: [-600, 0],
      leftA: [-300, -100],
      leftB: [-300, 100],
      rightA: [300, -100],
      rightB: [300, 100],
    }),
  },
].map(({ profile, plan, candidate }) => {
  const attachments = createFocusSchematicEndpointAttachments(
    plan,
    candidate,
    'soft-cardinal-files',
  );
  return {
    profile,
    deterministic:
      JSON.stringify(attachments) ===
      JSON.stringify(
        createFocusSchematicEndpointAttachments(
          plan,
          candidate,
          'soft-cardinal-files',
        ),
      ),
    attachmentSides: attachments.map(
      ({ connectionId, endpoint, side }) =>
        `${connectionId}:${endpoint}:${side}`,
    ),
    exactEndpointCrossingCount: measureFocusSchematicAttachmentCrossings(
      plan,
      attachments,
    ),
  };
});

function directionalReference(spec: EndpointFixtureSpec) {
  const attempt = computeFocusSchematicComputedLayoutAttempt(
    inputFor(spec, true),
    {
      endpointOrderPolicy: 'crossing-optimized',
      internalLayoutVariant: 'adaptive-compass',
    },
  );
  if (attempt.status !== 'success')
    throw new Error(`${spec.id}/directional: ${attempt.reason}`);
  return {
    fixtureId: spec.id,
    exactEndpointCrossingCount:
      attempt.result.quality.exactEndpointCrossingCount,
    boundsArea: attempt.result.quality.totalBoundsArea,
    overlapCount: attempt.result.quality.moduleOverlapPairs.length,
    runtimeMs: attempt.timings.totalMs,
  };
}

function strengthZeroFolderMutation() {
  const spec = SOFT_CLUSTER_FIXTURES.find(({ id }) => id === 'SC2')!;
  const changed: EndpointFixtureSpec = {
    ...spec,
    documents: spec.documents.map((document, index) => ({
      ...document,
      path: `changed-${index}/${document.id}.md`,
    })),
  };
  const before = computeFocusSchematicSoftClusterLayoutAttempt(
    inputFor(spec, false),
    { strength: 0 },
  );
  const after = computeFocusSchematicSoftClusterLayoutAttempt(
    inputFor(changed, false),
    { strength: 0 },
  );
  if (before.status !== 'success' || after.status !== 'success')
    throw new Error('SC2 strength-zero mutation probe failed.');
  return {
    fixtureId: 'SC2',
    byteIdentical:
      JSON.stringify(before.result.candidate) ===
      JSON.stringify(after.result.candidate),
  };
}

function secondaryMutation() {
  const spec = SOFT_CLUSTER_FIXTURES.find(({ id }) => id === 'SC20')!;
  const input = inputFor(spec, false);
  const before = computeFocusSchematicSoftClusterLayoutAttempt(input, {
    strength: 50,
  });
  if (before.status !== 'success')
    throw new Error('SC20 secondary probe failed.');
  const secondaryIds = new Set(
    before.result.endpointPlan.connections
      .filter(({ role }) => role === 'secondary')
      .flatMap(({ referenceIds }) => referenceIds),
  );
  const changed: EndpointFixtureSpec = {
    ...spec,
    references: spec.references.filter(
      (_, index) => !secondaryIds.has(`SC20-reference-${index + 1}`),
    ),
  };
  const after = computeFocusSchematicSoftClusterLayoutAttempt(
    inputFor(changed, false),
    { strength: 50 },
  );
  if (after.status !== 'success')
    throw new Error('SC20 secondary mutation failed.');
  return {
    removedReferenceCount: secondaryIds.size,
    byteIdentical:
      JSON.stringify(before.result.candidate) ===
      JSON.stringify(after.result.candidate),
  };
}

function inputPermutation() {
  const spec = SOFT_CLUSTER_FIXTURES.find(({ id }) => id === 'SC15')!;
  const before = computeFocusSchematicSoftClusterLayoutAttempt(
    inputFor(spec, false),
    { strength: 50 },
  );
  const after = computeFocusSchematicSoftClusterLayoutAttempt(
    inputFor(
      {
        ...spec,
        documents: [...spec.documents].reverse(),
        references: [...spec.references].reverse(),
      },
      false,
    ),
    { strength: 50 },
  );
  if (before.status !== 'success' || after.status !== 'success')
    throw new Error('SC15 permutation probe failed.');
  return {
    byteIdentical:
      JSON.stringify(before.result.candidate) ===
      JSON.stringify(after.result.candidate),
  };
}

function stabilityRows() {
  return SOFT_CLUSTER_STABILITY_PAIRS.flatMap((pair) =>
    strengths.map((strength) => {
      const beforeFixture = buildEndpointFixture(pair.before);
      const afterFixture = buildEndpointFixture(pair.after);
      const before = computeFocusSchematicSoftClusterLayoutAttempt(
        createLayoutInput(beforeFixture, {
          ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
          directionalFolderBandsEnabled: false,
        }),
        { strength },
      );
      const after = computeFocusSchematicSoftClusterLayoutAttempt(
        createLayoutInput(afterFixture, {
          ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
          directionalFolderBandsEnabled: false,
        }),
        { strength },
      );
      if (before.status !== 'success' || after.status !== 'success')
        throw new Error(`${pair.id}/${strength} stability failed.`);
      return {
        id: pair.id,
        label: pair.label,
        strength,
        quality: compareFocusSchematicLayouts({
          beforeModel: beforeFixture.model,
          beforeLayout: before.result.candidate,
          afterModel: afterFixture.model,
          afterLayout: after.result.candidate,
        }),
      };
    }),
  );
}

const emptyDisplayIntent: FocusSchematicSoftFolderDisplayIntent = {
  fileParentOverrides: [],
  flattenedFolderKeys: [],
};

const macroSpacingCandidates = {
  baseline: {
    hopSpacing: 520,
    moduleGap: 72,
    topologyExtraDistance: 155,
    packingStep: 64,
    radialJitter: 90,
  },
  moderate: {
    hopSpacing: 600,
    moduleGap: 88,
    topologyExtraDistance: 180,
    packingStep: 72,
    radialJitter: 104,
  },
  wide: {
    hopSpacing: 680,
    moduleGap: 104,
    topologyExtraDistance: 210,
    packingStep: 84,
    radialJitter: 120,
  },
} as const;

const internalSpacingCandidates = {
  baseline: {
    internalNodeSeparation: 24,
    internalRankSeparation: 48,
    modulePaddingX: 28,
    modulePaddingY: 24,
  },
  moderate: {
    internalNodeSeparation: 30,
    internalRankSeparation: 60,
    modulePaddingX: 34,
    modulePaddingY: 30,
  },
  wide: {
    internalNodeSeparation: 36,
    internalRankSeparation: 72,
    modulePaddingX: 42,
    modulePaddingY: 36,
  },
} as const;

function candidateSpacing(
  macro: keyof typeof macroSpacingCandidates,
  internal: keyof typeof internalSpacingCandidates,
): FocusSchematicSoftClusterSpacingPolicy {
  return {
    ...macroSpacingCandidates[macro],
    ...internalSpacingCandidates[internal],
  };
}

const representativeSpacingFixtures = [
  'SC1',
  'SC2',
  'SC7',
  'SC8',
  'SC11',
  'SC14',
  'SC16',
].map((id) => SOFT_CLUSTER_FIXTURES.find((spec) => spec.id === id)!);

const spacingCandidateRows = Object.keys(macroSpacingCandidates).flatMap(
  (macro) =>
    Object.keys(internalSpacingCandidates).flatMap((internal) =>
      representativeSpacingFixtures.map((spec) => ({
        macro,
        internal,
        ...soft(spec, 50, emptyDisplayIntent, 'normalized-decay', {
          spacing: 50,
          spacingPolicy: candidateSpacing(
            macro as keyof typeof macroSpacingCandidates,
            internal as keyof typeof internalSpacingCandidates,
          ),
        }),
      })),
    ),
);

type SoftRow = ReturnType<typeof soft>;

function numbers(
  rows: readonly SoftRow[],
  read: (row: SoftRow) => number | null,
): number[] {
  return rows.flatMap((row) => {
    const value = read(row);
    return value === null ? [] : [value];
  });
}

function average(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeSpacingRows(rows: readonly SoftRow[]) {
  const metric = (
    read: (row: SoftRow) => number | null,
    worst: 'maximum' | 'minimum' = 'maximum',
  ) => {
    const values = numbers(rows, read);
    return {
      mean: average(values),
      worst:
        values.length === 0
          ? null
          : worst === 'maximum'
            ? Math.max(...values)
            : Math.min(...values),
    };
  };
  return {
    rowCount: rows.length,
    hardGatesPass: rows.every(
      ({ deterministic, rootFileCentered, hardGates }) =>
        deterministic &&
        rootFileCentered &&
        hardGates.overlapFree &&
        hardGates.nodeContainment &&
        hardGates.secondaryGeometryInfluence === 0 &&
        hardGates.boundedSchedule,
    ),
    minimumModuleGap: metric((row) => row.metrics.minimumModuleGap, 'minimum'),
    boundsWidth: metric((row) => row.metrics.boundsWidth),
    boundsHeight: metric((row) => row.metrics.boundsHeight),
    boundsArea: metric((row) => row.metrics.boundsArea),
    connectedPairDistanceMean: metric(
      (row) => row.metrics.connectedPairDistanceMean,
    ),
    connectedPairDistanceP95: metric(
      (row) => row.metrics.connectedPairDistanceP95,
    ),
    exactPrimaryEndpointSpanMean: metric(
      (row) => row.metrics.exactPrimaryEndpointSpanMean,
    ),
    exactPrimaryEndpointSpanP95: metric(
      (row) => row.metrics.exactPrimaryEndpointSpanP95,
    ),
    exactEndpointCrossingCount: metric(
      (row) => row.metrics.exactEndpointCrossingCount,
    ),
    hopMeanAbsoluteRadiusError: metric(
      (row) => row.metrics.hopMeanAbsoluteRadiusError,
    ),
    repeatedFolderRmsRadiusMean: metric(
      (row) => row.metrics.repeatedFolderRmsRadiusMean,
    ),
    repeatedFolderRmsRadiusMedian: metric(
      (row) => row.metrics.repeatedFolderRmsRadiusMedian,
    ),
    repeatedFolderRmsRadiusP95: metric(
      (row) => row.metrics.repeatedFolderRmsRadiusP95,
    ),
    childFolderCoherenceMean: metric(
      (row) => row.metrics.childFolderCoherenceMean,
    ),
    parentFolderCoherenceMean: metric(
      (row) => row.metrics.parentFolderCoherenceMean,
    ),
    collisionCheckCount: metric((row) => row.runtime.collisionCheckCount),
    collisionCorrectionCount: metric(
      (row) => row.runtime.collisionCorrectionCount,
    ),
    layoutMs: metric((row) => row.runtime.layoutMs),
  };
}

const spacingCandidateSummaries = Object.keys(macroSpacingCandidates).flatMap(
  (macro) =>
    Object.keys(internalSpacingCandidates).map((internal) => ({
      macro,
      internal,
      policy: candidateSpacing(
        macro as keyof typeof macroSpacingCandidates,
        internal as keyof typeof internalSpacingCandidates,
      ),
      summary: summarizeSpacingRows(
        spacingCandidateRows.filter(
          (row) => row.macro === macro && row.internal === internal,
        ),
      ),
    })),
);

const spacingSamples = [0, 25, 50, 75, 100] as const;
const spacingRows = spacingSamples.flatMap((spacing) =>
  SOFT_CLUSTER_FIXTURES.map((spec) => ({
    spacing,
    ...soft(spec, 50, emptyDisplayIntent, 'normalized-decay', { spacing }),
  })),
);
const adaptiveSpacingRows = [0, 50, 100].flatMap((spacing) =>
  SOFT_ADAPTIVE_COMPASS_FIXTURES.map((spec) => ({
    spacing,
    ...soft(spec, 50, emptyDisplayIntent, 'normalized-decay', { spacing }),
  })),
);
const spacingAnchorSummaries = spacingSamples.map((spacing) => ({
  spacing,
  policy:
    spacing === 0
      ? FOCUS_SCHEMATIC_SOFT_SPACING_COMPACT
      : spacing === 50
        ? FOCUS_SCHEMATIC_SOFT_SPACING_SELECTED
        : spacing === 100
          ? FOCUS_SCHEMATIC_SOFT_SPACING_SPACIOUS
          : spacingRows.find((row) => row.spacing === spacing)!.resolvedSpacing,
  summary: summarizeSpacingRows(
    spacingRows.filter((row) => row.spacing === spacing),
  ),
  adaptiveObservation: adaptiveSpacingRows
    .filter((row) => row.spacing === spacing)
    .map(({ fixtureId, metrics, adaptiveRegionUse }) => ({
      fixtureId,
      exactEndpointCrossingCount: metrics.exactEndpointCrossingCount,
      ...adaptiveRegionUse,
    })),
}));

const strengthSpacingRows = [0, 50, 100].flatMap((strength) =>
  [0, 50, 100].map((spacing) => ({
    spacing,
    ...soft(
      SOFT_CLUSTER_FIXTURES.find(({ id }) => id === 'SC16')!,
      strength,
      emptyDisplayIntent,
      'normalized-decay',
      { spacing },
    ),
  })),
);

const fixtureRows = SOFT_CLUSTER_FIXTURES.flatMap((spec) =>
  strengths.map((strength) => soft(spec, strength)),
);
const compassDemandBakeoffRows = SOFT_ADAPTIVE_COMPASS_FIXTURES.flatMap(
  (spec) => [
    {
      strategy: 'D0-directional-horizontal',
      ...soft(spec, 50, undefined, undefined, {
        spacing: 0,
        compassDemandPolicy: 'directional-horizontal',
      }),
    },
    {
      strategy: 'S1-dominant-cardinal',
      ...soft(spec, 50, undefined, undefined, {
        spacing: 0,
        compassDemandPolicy: 'spatial-cardinal',
        spatialDemandSummary: 'dominant-cardinal',
      }),
    },
    {
      strategy: 'S2-aggregate-vector',
      ...soft(spec, 50, undefined, undefined, {
        spacing: 0,
        compassDemandPolicy: 'spatial-cardinal',
        spatialDemandSummary: 'aggregate-vector',
      }),
    },
    {
      strategy: 'V-vertical-control',
      ...soft(spec, 50, undefined, undefined, {
        spacing: 0,
        internalLayoutVariant: 'vertical-spine',
      }),
    },
  ],
);
const compassStrengthRows = SOFT_ADAPTIVE_COMPASS_FIXTURES.flatMap((spec) =>
  strengths.map((strength) =>
    soft(spec, strength, undefined, undefined, { spacing: 0 }),
  ),
);
const macroPerturbationRows = SOFT_ADAPTIVE_COMPASS_FIXTURES.map((spec) => ({
  fixtureId: spec.id,
  ...compareFocusSchematicSoftInternalVariants(inputFor(spec, false), {
    spacing: 0,
  }),
}));
const stressRows = [20, 50, 100].flatMap((count) =>
  strengths.map((strength) => ({
    profile: `hub-${count}`,
    ...soft(createSoftClusterHubFixture(count), strength),
  })),
);
const multiplicityRows = [1, 2, 5, 20, 100].map((count) => ({
  multiplicity: count,
  ...soft(createSoftClusterMultiplicityFixture(count), 50),
}));
const referenceRows = SOFT_CLUSTER_FIXTURES.map(directionalReference);
const zeroFolderMutation = strengthZeroFolderMutation();
const secondaryInvariant = secondaryMutation();
const permutationInvariant = inputPermutation();
const stability = stabilityRows();
const hardGatesPass =
  fixtureRows.every(
    ({ deterministic, rootFileCentered, hardGates }) =>
      deterministic &&
      rootFileCentered &&
      hardGates.overlapFree &&
      hardGates.nodeContainment &&
      hardGates.secondaryGeometryInfluence === 0 &&
      hardGates.boundedSchedule,
  ) &&
  stressRows.every(
    ({ deterministic, hardGates }) => deterministic && hardGates.overlapFree,
  ) &&
  hierarchyForceRows.every(
    ({ deterministic, hardGates, maximumPerFileFolderWeight }) =>
      deterministic && hardGates.overlapFree && maximumPerFileFolderWeight <= 1,
  ) &&
  hierarchyStrengthRows.every(
    ({ deterministic, hardGates, maximumPerFileFolderWeight }) =>
      deterministic && hardGates.overlapFree && maximumPerFileFolderWeight <= 1,
  ) &&
  compassDemandBakeoffRows.every(
    ({ deterministic, hardGates }) => deterministic && hardGates.overlapFree,
  ) &&
  compassStrengthRows.every(
    ({ deterministic, hardGates }) => deterministic && hardGates.overlapFree,
  ) &&
  macroPerturbationRows.every(({ semanticNoOpSatisfied }) =>
    Boolean(semanticNoOpSatisfied),
  ) &&
  zeroFolderMutation.byteIdentical;
const completeHardGatesPass =
  hardGatesPass &&
  spacingCandidateSummaries.every(({ summary }) => summary.hardGatesPass) &&
  spacingAnchorSummaries.every(({ summary }) => summary.hardGatesPass) &&
  summarizeSpacingRows(strengthSpacingRows).hardGatesPass &&
  secondaryInvariant.byteIdentical &&
  permutationInvariant.byteIdentical;

const report = {
  schemaVersion: 2,
  title: 'HIER4B-SPACING Soft Folder Clusters bakeoff',
  status: 'UNDER_EVALUATION',
  productionLayoutChanged: true,
  defaultLabConfiguration: {
    macroLayout: 'soft-folder-clusters',
    strength: 50,
    spacing: 50,
    internalLayout: 'adaptive-compass',
    headingOrder: 'crossing-optimized',
  },
  decisionState: completeHardGatesPass
    ? 'REQUIRES_GRAPHICAL_REVIEW'
    : 'SOFT_CLUSTERS_REQUIRE_REDESIGN',
  strengths,
  fixedIterationSchedule: [36, 18],
  oldBaselineSpacing: FOCUS_SCHEMATIC_SOFT_CLUSTER_BASELINE_SPACING,
  spacingCandidateMatrix: {
    representativeFixtureIds: representativeSpacingFixtures.map(({ id }) => id),
    macroCandidates: macroSpacingCandidates,
    internalCandidates: internalSpacingCandidates,
    selected: { macro: 'moderate', internal: 'moderate' },
    summaries: spacingCandidateSummaries,
  },
  spacingAnchors: {
    compact: FOCUS_SCHEMATIC_SOFT_SPACING_COMPACT,
    selected: FOCUS_SCHEMATIC_SOFT_SPACING_SELECTED,
    spacious: FOCUS_SCHEMATIC_SOFT_SPACING_SPACIOUS,
  },
  spacingRows,
  adaptiveSpacingRows,
  spacingAnchorSummaries,
  strengthSpacingRows,
  hardGatesPass: completeHardGatesPass,
  strengthZeroFolderMutation: zeroFolderMutation,
  secondaryMutation: secondaryInvariant,
  inputPermutation: permutationInvariant,
  fixtureRows,
  directionalReferenceRows: referenceRows,
  stabilityRows: stability,
  stressRows,
  multiplicityRows,
  fix2IntentRows,
  hierarchyForceBakeoff: {
    selectedPolicy: 'normalized-decay',
    rationale:
      'Nearest scopes receive more weight while every File has one normalized total folder-force budget.',
    rows: hierarchyForceRows,
  },
  hierarchyStrengthRows,
  cardinalGeometryRows,
  adaptiveCompassPatch: {
    selectedDemandPolicy: 'spatial-cardinal',
    selectedDemandSummary: 'dominant-cardinal',
    rationale:
      'Dominant cardinal count follows authored-reference majority, stays stable near sector boundaries, and retains the bounded two-choice Compass search.',
    demandBakeoffRows: compassDemandBakeoffRows,
    strengthRows: compassStrengthRows,
    macroPerturbationRows,
  },
};

const outIndex = process.argv.indexOf('--out');
const requested =
  outIndex < 0
    ? 'output/hier4b-soft-folder-clusters-benchmark.json'
    : (process.argv[outIndex + 1] ??
      'output/hier4b-soft-folder-clusters-benchmark.json');
const target = isAbsolute(requested)
  ? requested
  : resolve(repositoryRoot, requested);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(
  `${JSON.stringify({ target, decisionState: report.decisionState, hardGatesPass: completeHardGatesPass, fixtureRows: fixtureRows.length, compassDemandRows: compassDemandBakeoffRows.length, compassStrengthRows: compassStrengthRows.length, stressRows: stressRows.length, hierarchyForceRows: hierarchyForceRows.length, hierarchyStrengthRows: hierarchyStrengthRows.length })}\n`,
);
