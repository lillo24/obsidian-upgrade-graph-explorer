import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compareFocusSchematicLayouts,
  type FocusSchematicLayoutCandidate,
} from '@icarus-graph-explorer/focus-schematic';
import {
  buildEndpointFixture,
  computeFocusSchematicComputedLayoutAttempt,
  computeFocusSchematicSoftClusterLayoutAttempt,
  createFocusSchematicEndpointAttachments,
  measureFocusSchematicAttachmentCrossings,
  createSoftClusterHubFixture,
  createSoftClusterMultiplicityFixture,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  SOFT_CLUSTER_FIXTURES,
  SOFT_CLUSTER_STABILITY_PAIRS,
  type EndpointFixtureSpec,
  type FocusSchematicEndpointPlan,
  type FocusSchematicSoftFolderScopeOverride,
  type FocusSchematicSoftClusterStrength,
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
  scopeOverrides: readonly FocusSchematicSoftFolderScopeOverride[] = [],
) {
  const input = inputFor(spec, false);
  const first = computeFocusSchematicSoftClusterLayoutAttempt(input, {
    strength,
    scopeOverrides,
  });
  const second = computeFocusSchematicSoftClusterLayoutAttempt(input, {
    strength,
    scopeOverrides,
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
    scopeOverrideCount: first.evidence.scopeOverrideCount,
    effectiveGroupCount: first.evidence.effectiveGroupCount,
    attachmentSideCounts: Object.fromEntries(
      ['left', 'right', 'top', 'bottom'].map((side) => [
        side,
        first.result.attachments.filter(
          (attachment) => attachment.side === side,
        ).length,
      ]),
    ),
  };
}

const fix1ScopeFixture: EndpointFixtureSpec = {
  id: 'SC25',
  label: 'HIER4B-FIX1 scope stress',
  authored: 'Synthetic nested exact-folder registry for scope benchmarks.',
  expectation: 'Sparse overrides remain deterministic and bounded.',
  inspect: 'Compare mixed, sibling, repeated, and high-count scope rules.',
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

const fix1ScopeRows = [
  {
    profile: 'mixed-spatial-scope',
    overrides: [
      {
        exactFolderKey: 'Language/Pragmatics',
        spatialGroupKey: 'Language',
      },
      {
        exactFolderKey: 'Pattern Theory/A',
        spatialGroupKey: 'Pattern Theory',
      },
      {
        exactFolderKey: 'Pattern Theory/B',
        spatialGroupKey: 'Pattern Theory',
      },
    ],
  },
  {
    profile: 'promoted-parent',
    overrides: [
      {
        exactFolderKey: 'Language/Pragmatics',
        spatialGroupKey: 'Language',
      },
    ],
  },
  {
    profile: 'promoted-siblings',
    overrides: [
      {
        exactFolderKey: 'Language/Grammar',
        spatialGroupKey: 'Language',
      },
      {
        exactFolderKey: 'Language/Pragmatics',
        spatialGroupKey: 'Language',
      },
    ],
  },
  {
    profile: 'deep-repeated-promotion',
    overrides: [{ exactFolderKey: 'A/B/C', spatialGroupKey: '.' }],
  },
  {
    profile: 'many-folder-overrides',
    overrides: Array.from({ length: 30 }, (_, index) => ({
      exactFolderKey: `Teams/Team${index}/Child`,
      spatialGroupKey: `Teams/Team${index}`,
    })),
  },
].map(({ profile, overrides }) => ({
  profile,
  ...soft(fix1ScopeFixture, 50, overrides),
}));

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

const fixtureRows = SOFT_CLUSTER_FIXTURES.flatMap((spec) =>
  strengths.map((strength) => soft(spec, strength)),
);
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
  zeroFolderMutation.byteIdentical;
const completeHardGatesPass =
  hardGatesPass &&
  secondaryInvariant.byteIdentical &&
  permutationInvariant.byteIdentical;

const report = {
  schemaVersion: 1,
  title: 'HIER4B Soft Folder Clusters bakeoff',
  status: 'UNDER_EVALUATION',
  productionLayoutChanged: false,
  defaultLabConfiguration: {
    macroLayout: 'soft-folder-clusters',
    strength: 50,
    internalLayout: 'adaptive-compass',
    headingOrder: 'crossing-optimized',
  },
  decisionState: completeHardGatesPass
    ? 'REQUIRES_GRAPHICAL_REVIEW'
    : 'SOFT_CLUSTERS_REQUIRE_REDESIGN',
  strengths,
  fixedIterationSchedule: [36, 18],
  hardGatesPass: completeHardGatesPass,
  strengthZeroFolderMutation: zeroFolderMutation,
  secondaryMutation: secondaryInvariant,
  inputPermutation: permutationInvariant,
  fixtureRows,
  directionalReferenceRows: referenceRows,
  stabilityRows: stability,
  stressRows,
  multiplicityRows,
  fix1ScopeRows,
  cardinalGeometryRows,
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
  `${JSON.stringify({ target, decisionState: report.decisionState, hardGatesPass: completeHardGatesPass, fixtureRows: fixtureRows.length, stressRows: stressRows.length })}\n`,
);
