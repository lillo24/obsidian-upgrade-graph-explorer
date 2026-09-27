import { describe, expect, it } from 'vitest';
import { createFocusSchematicModel } from '@icarus-graph-explorer/focus-schematic';
import { projectLocalView } from '@icarus-graph-explorer/view-projection';

import {
  buildEndpointFixture,
  type EndpointFixtureSpec,
} from './endpoint-fixtures';
import { computeFocusSchematicIncrementalLayoutAttempt } from './incremental-layout';
import { validateFocusSchematicComputedLayout } from './endpoint-facing';
import { computeFocusSchematicComputedLayoutAttempt } from './endpoint-facing';
import { measureFocusSchematicSurvivingNodeContinuity } from './layout-continuity';
import { computeFocusSchematicSoftClusterLayoutAttempt } from './soft-clusters';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from './settings';
import { layoutInput } from './test-helpers';
import { FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION } from './worker-protocol';
import { handleFocusSchematicLayoutWorkerRequest } from './worker-runtime';
import {
  classifyFocusSchematicLayoutTransition,
  createFocusSchematicLayoutTransitionPrior,
  validateFocusSchematicLayoutTransitionPrior,
} from './transition-prior';
import type {
  FocusSchematicLayoutInput,
  FocusSchematicProductLayoutPolicies,
} from './index';

const policies: FocusSchematicProductLayoutPolicies = {
  macroLayout: 'soft-folder-clusters',
  softFolderStrength: 50,
  softFolderScopeMode: 'nested',
  softAncestorDecayBase: 3,
  softFolderDisplayIntent: {
    fileParentOverrides: [],
    flattenedFolderKeys: [],
  },
  endpointOrderPolicy: 'crossing-optimized',
  internalLayoutVariant: 'adaptive-compass',
};

const fixture: EndpointFixtureSpec = {
  id: 'SS20-before',
  label: 'HIERSTAB1 local disclosure',
  authored: 'Synthetic local Heading hide fixture.',
  expectation: 'Only Focus internal geometry changes.',
  inspect: 'Unrelated File centers remain exact.',
  rootDocumentId: 'Focus',
  documents: [
    { id: 'Focus', path: 'root/Focus.md' },
    { id: 'Alpha', path: 'science/Alpha.md' },
    { id: 'Beta', path: 'science/Beta.md' },
    { id: 'Gamma', path: 'language/Gamma.md' },
  ],
  entities: [
    {
      id: 'H1',
      kind: 'section',
      documentId: 'Focus',
      parentId: 'Focus',
      line: 2,
    },
    {
      id: 'H2',
      kind: 'section',
      documentId: 'Focus',
      parentId: 'Focus',
      line: 4,
    },
    {
      id: 'H3',
      kind: 'section',
      documentId: 'Focus',
      parentId: 'Focus',
      line: 6,
    },
    {
      id: 'H4',
      kind: 'section',
      documentId: 'Focus',
      parentId: 'Focus',
      line: 8,
    },
    {
      id: 'A-target',
      kind: 'section',
      documentId: 'Alpha',
      parentId: 'Alpha',
      line: 2,
    },
    {
      id: 'B-target',
      kind: 'section',
      documentId: 'Beta',
      parentId: 'Beta',
      line: 2,
    },
    {
      id: 'G-target',
      kind: 'section',
      documentId: 'Gamma',
      parentId: 'Gamma',
      line: 2,
    },
  ],
  references: [
    { sourceEntityId: 'H1', targetEntityId: 'A-target' },
    { sourceEntityId: 'H2', targetEntityId: 'B-target' },
    { sourceEntityId: 'Focus', targetEntityId: 'G-target' },
  ],
  hops: 1,
};

const nestedFixture: EndpointFixtureSpec = {
  id: 'SS23-before',
  label: 'Nested disclosure continuity',
  authored: 'Synthetic nested Heading and Block disclosure fixture.',
  expectation: 'Nested disclosure remains local.',
  inspect: 'Surviving branches and other Files remain exact.',
  rootDocumentId: 'Focus',
  documents: [
    { id: 'Focus', path: 'root/Focus.md' },
    { id: 'Alpha', path: 'science/Alpha.md' },
    { id: 'Beta', path: 'science/Beta.md' },
  ],
  entities: [
    {
      id: 'N-H1',
      kind: 'section',
      documentId: 'Focus',
      parentId: 'Focus',
      line: 2,
    },
    {
      id: 'N-H2',
      kind: 'section',
      documentId: 'Focus',
      parentId: 'N-H1',
      line: 3,
    },
    {
      id: 'N-H3',
      kind: 'section',
      documentId: 'Focus',
      parentId: 'N-H2',
      line: 4,
    },
    {
      id: 'N-H4',
      kind: 'section',
      documentId: 'Focus',
      parentId: 'N-H3',
      line: 5,
    },
    {
      id: 'N-block',
      kind: 'block',
      documentId: 'Focus',
      parentId: 'N-H3',
      line: 6,
    },
  ],
  references: [
    { sourceEntityId: 'N-H1', targetEntityId: 'Alpha' },
    { sourceEntityId: 'Focus', targetEntityId: 'Beta' },
  ],
  hops: 1,
};

function inputs(hiddenEntityId: string | readonly string[] = 'H4'): {
  before: FocusSchematicLayoutInput;
  after: FocusSchematicLayoutInput;
} {
  const built = buildEndpointFixture(fixture);
  const settings = {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: false,
  };
  const before = layoutInput(built, settings);
  const state = {
    ...built.state,
    disclosure: {
      ...built.state.disclosure,
      hiddenEntityIds:
        typeof hiddenEntityId === 'string' ? [hiddenEntityId] : hiddenEntityId,
    },
  };
  const projection = projectLocalView(built.workspace, state);
  const model = createFocusSchematicModel({
    workspace: built.workspace,
    state,
    projection,
  });
  const after = layoutInput({ ...built, state, projection, model }, settings);
  return { before, after };
}

function nestedInputs(kind: 'heading' | 'block') {
  const built = buildEndpointFixture(nestedFixture);
  const settings = {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: false,
  };
  const before = layoutInput(built, settings);
  const state = {
    ...built.state,
    disclosure: {
      ...built.state.disclosure,
      ...(kind === 'heading' ? { hiddenEntityIds: ['N-H3'] } : {}),
      ...(kind === 'block'
        ? {
            expandedEntityIds: built.state.disclosure.expandedEntityIds.filter(
              (id) => id !== 'N-H3',
            ),
          }
        : {}),
    },
  };
  const projection = projectLocalView(built.workspace, state);
  const model = createFocusSchematicModel({
    workspace: built.workspace,
    state,
    projection,
  });
  return {
    before,
    after: layoutInput({ ...built, projection, model }, settings),
  };
}

function cold(
  input: FocusSchematicLayoutInput,
  resolvedPolicies: FocusSchematicProductLayoutPolicies = policies,
) {
  const attempt = computeFocusSchematicSoftClusterLayoutAttempt(input, {
    strength: resolvedPolicies.softFolderStrength,
    folderScopeMode: resolvedPolicies.softFolderScopeMode,
    ancestorDecayBase: resolvedPolicies.softAncestorDecayBase,
    displayIntent: resolvedPolicies.softFolderDisplayIntent,
    endpointOrderPolicy: resolvedPolicies.endpointOrderPolicy,
    internalLayoutVariant: resolvedPolicies.internalLayoutVariant,
  });
  if (attempt.status !== 'success') throw new Error(attempt.reason);
  return attempt.result;
}

describe('HIERSTAB1 continuity-preserving incremental layout', () => {
  it('ST1 keeps every unaffected File and internal rectangle exact for an unconnected Heading hide', () => {
    const { before, after } = inputs();
    const prior = createFocusSchematicLayoutTransitionPrior(
      before,
      policies,
      cold(before),
    );
    expect(
      validateFocusSchematicLayoutTransitionPrior(structuredClone(prior)),
    ).toEqual(prior);
    const classification = classifyFocusSchematicLayoutTransition(
      after,
      policies,
      prior,
    );
    expect(classification).toMatchObject({
      eligible: true,
      classification: 'local-internal-change',
      affectedModuleIds: ['Focus'],
    });
    const attempt = computeFocusSchematicIncrementalLayoutAttempt(
      after,
      policies,
      prior,
      classification,
    );
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    expect(attempt.evidence.mode).toBe('incremental-no-macro-move');
    expect(attempt.evidence.movedUnaffectedModuleCount).toBe(0);
    expect(attempt.evidence.maxUnaffectedModuleDisplacement).toBe(0);
    expect(attempt.evidence.changedSurvivingCompassBranchCount).toBe(0);
    const nodeContinuity = measureFocusSchematicSurvivingNodeContinuity(
      prior.result.candidate,
      attempt.result.candidate,
    );
    expect(nodeContinuity.movedSurvivingNodeCount).toBe(0);
    expect(nodeContinuity.maxSurvivingNodeDisplacement).toBe(0);
    expect(
      attempt.result.candidate.nodes.some(
        ({ projectionNodeId }) => projectionNodeId === 'entity:H4',
      ),
    ).toBe(false);
    expect(
      validateFocusSchematicComputedLayout(after, attempt.result).valid,
    ).toBe(true);
    for (const module of attempt.result.candidate.modules.filter(
      ({ moduleId }) => moduleId !== 'Focus',
    ))
      expect(module).toEqual(
        prior.result.candidate.modules.find(
          ({ moduleId }) => moduleId === module.moduleId,
        ),
      );
    for (const node of attempt.result.candidate.nodes.filter(
      ({ moduleId }) => moduleId !== 'Focus',
    ))
      expect(node).toEqual(
        prior.result.candidate.nodes.find(
          ({ projectionNodeId }) => projectionNodeId === node.projectionNodeId,
        ),
      );
  });

  it.each([
    [
      'reroot',
      (after: FocusSchematicLayoutInput) => ({
        ...after,
        model: { ...after.model, rootModuleId: 'Alpha' },
      }),
    ],
    ['policy', (after: FocusSchematicLayoutInput) => after],
    [
      'module-set',
      (after: FocusSchematicLayoutInput) => ({
        ...after,
        model: { ...after.model, modules: after.model.modules.slice(0, -1) },
      }),
    ],
  ] as const)(
    'ST11-ST13 classifies %s changes as cold-required',
    (kind, change) => {
      const { before, after } = inputs();
      const prior = createFocusSchematicLayoutTransitionPrior(
        before,
        policies,
        cold(before),
      );
      const nextPolicies =
        kind === 'policy' ? { ...policies, softFolderStrength: 75 } : policies;
      expect(
        classifyFocusSchematicLayoutTransition(
          change(after),
          nextPolicies,
          prior,
        ).eligible,
      ).toBe(false);
    },
  );

  it('rejects malformed or non-finite transition priors', () => {
    const { before } = inputs();
    const prior = structuredClone(
      createFocusSchematicLayoutTransitionPrior(before, policies, cold(before)),
    );
    (prior.result.candidate.modules[0]! as { x: number }).x = Number.NaN;
    expect(() => validateFocusSchematicLayoutTransitionPrior(prior)).toThrow(
      'computed layout is invalid',
    );
  });

  it('carries the clone-safe prior through protocol v15 and reports incremental evidence', () => {
    const { before, after } = inputs();
    const prior = createFocusSchematicLayoutTransitionPrior(
      before,
      policies,
      cold(before),
    );
    const response = handleFocusSchematicLayoutWorkerRequest(
      {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 1,
        kind: 'layout',
        input: after,
        policies,
        transitionPrior: structuredClone(prior),
      },
      () => 0,
    );
    expect(FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION).toBe(15);
    expect(response.kind).toBe('success');
    if (response.kind !== 'success') return;
    expect(response.transitionEvidence.mode).toBe('incremental-no-macro-move');
    expect(response.softClusterEvidence).toBeNull();
  });

  it('ST6 restores a branch without moving unrelated Files when the prior centers remain valid', () => {
    const { before, after } = inputs();
    const prior = createFocusSchematicLayoutTransitionPrior(
      after,
      policies,
      cold(after),
    );
    const classification = classifyFocusSchematicLayoutTransition(
      before,
      policies,
      prior,
    );
    const attempt = computeFocusSchematicIncrementalLayoutAttempt(
      before,
      policies,
      prior,
      classification,
    );
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    expect(attempt.evidence.movedUnaffectedModuleCount).toBe(0);
    expect(attempt.evidence.changedSurvivingCompassBranchCount).toBe(0);
  });

  it('ST3 rolls a hidden precise endpoint up without moving the opposite or unrelated Files', () => {
    const { before, after } = inputs('H1');
    const prior = createFocusSchematicLayoutTransitionPrior(
      before,
      policies,
      cold(before),
    );
    const classification = classifyFocusSchematicLayoutTransition(
      after,
      policies,
      prior,
    );
    const attempt = computeFocusSchematicIncrementalLayoutAttempt(
      after,
      policies,
      prior,
      classification,
    );
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    expect(attempt.evidence.movedUnaffectedModuleCount).toBe(0);
    const rolled = attempt.result.endpointPlan.connections.find(
      ({ referenceIds }) => referenceIds.includes('SS20-before-reference-1'),
    );
    expect(rolled?.source).toMatchObject({
      kind: 'visible-entity',
      moduleId: 'Focus',
      projectionNodeId: expect.stringContaining('Focus'),
    });
  });

  it('ST2 hides an unconnected nested Heading subtree without changing established regions', () => {
    const { before, after } = nestedInputs('heading');
    const prior = createFocusSchematicLayoutTransitionPrior(
      before,
      policies,
      cold(before),
    );
    const classification = classifyFocusSchematicLayoutTransition(
      after,
      policies,
      prior,
    );
    const attempt = computeFocusSchematicIncrementalLayoutAttempt(
      after,
      policies,
      prior,
      classification,
    );
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    expect(attempt.evidence).toMatchObject({
      movedUnaffectedModuleCount: 0,
      changedSurvivingCompassBranchCount: 0,
    });
    const visibleEntities = new Set(
      after.projection.nodes.flatMap((node) =>
        node.kind === 'entity' ? [node.entityId] : [],
      ),
    );
    expect(visibleEntities.has('N-H3')).toBe(false);
    expect(visibleEntities.has('N-H4')).toBe(false);
  });

  it('ST4 handles Block disclosure locally', () => {
    const { before, after } = nestedInputs('block');
    const prior = createFocusSchematicLayoutTransitionPrior(
      before,
      policies,
      cold(before),
    );
    const classification = classifyFocusSchematicLayoutTransition(
      after,
      policies,
      prior,
    );
    const attempt = computeFocusSchematicIncrementalLayoutAttempt(
      after,
      policies,
      prior,
      classification,
    );
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    expect(attempt.evidence.movedUnaffectedModuleCount).toBe(0);
    expect(
      after.projection.nodes.some(
        (node) => node.kind === 'entity' && node.entityId === 'N-block',
      ),
    ).toBe(false);
  });

  it('ST7 uses bounded local repair when growth first collides with macro neighbors', () => {
    const { before } = inputs();
    const prior = createFocusSchematicLayoutTransitionPrior(
      before,
      policies,
      cold(before),
    );
    const h4 = before.projection.nodes.find(
      (node) => node.kind === 'entity' && node.entityId === 'H4',
    );
    const observed: string[] = [];
    let repaired = false;
    for (const width of [240, 300, 360, 420, 480, 560, 640, 720]) {
      const changed = {
        ...before,
        nodeDimensions: before.nodeDimensions.map((dimension) =>
          dimension.projectionNodeId === h4?.id
            ? { ...dimension, width }
            : dimension,
        ),
      };
      const classification = classifyFocusSchematicLayoutTransition(
        changed,
        policies,
        prior,
      );
      const attempt = computeFocusSchematicIncrementalLayoutAttempt(
        changed,
        policies,
        prior,
        classification,
      );
      observed.push(
        attempt.status === 'success' ? attempt.evidence.mode : 'failure',
      );
      if (
        attempt.status === 'success' &&
        attempt.evidence.mode === 'incremental-local-repair'
      ) {
        repaired = true;
        expect(attempt.evidence.localRepairIterations).toBeLessThanOrEqual(2);
        expect(attempt.evidence.localRepairCandidates).toBeLessThanOrEqual(6);
        break;
      }
    }
    expect(repaired, observed.join(', ')).toBe(true);
  });

  it('ST8 repairs only the affected immediate folder when shrink splits its guide region', () => {
    const { before, after } = inputs(['A-target', 'B-target']);
    const prior = createFocusSchematicLayoutTransitionPrior(
      before,
      policies,
      cold(before),
    );
    const shrunkenFiles = new Set(
      after.projection.nodes
        .filter(
          (node) =>
            node.kind === 'entity' &&
            (node.entityId === 'Alpha' || node.entityId === 'Beta'),
        )
        .map(({ id }) => id),
    );
    const changed = {
      ...after,
      nodeDimensions: after.nodeDimensions.map((dimension) =>
        shrunkenFiles.has(dimension.projectionNodeId)
          ? { ...dimension, width: 1 }
          : dimension,
      ),
    };
    const classification = classifyFocusSchematicLayoutTransition(
      changed,
      policies,
      prior,
    );
    const attempt = computeFocusSchematicIncrementalLayoutAttempt(
      changed,
      policies,
      prior,
      classification,
    );
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    expect(attempt.evidence).toMatchObject({
      mode: 'incremental-local-repair',
      rejectionReason: 'immediate-folder-split',
      movedUnaffectedModuleCount: 0,
      localRepairFrontierModuleCount: 2,
      localRepairIterations: 1,
    });
  });

  it('ST15 lets secondary endpoint changes update attachments with zero geometry influence', () => {
    const beforeBuilt = buildEndpointFixture(fixture);
    const afterBuilt = buildEndpointFixture({
      ...fixture,
      references: [
        ...fixture.references,
        { sourceEntityId: 'A-target', targetEntityId: 'B-target' },
      ],
    });
    const settings = {
      ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
      directionalFolderBandsEnabled: false,
    };
    const before = layoutInput(beforeBuilt, settings);
    const after = layoutInput(afterBuilt, settings);
    const prior = createFocusSchematicLayoutTransitionPrior(
      before,
      policies,
      cold(before),
    );
    const classification = classifyFocusSchematicLayoutTransition(
      after,
      policies,
      prior,
    );
    expect(classification.eligible).toBe(true);
    const attempt = computeFocusSchematicIncrementalLayoutAttempt(
      after,
      policies,
      prior,
      classification,
    );
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    expect(attempt.result.candidate).toEqual(prior.result.candidate);
    expect(attempt.result.endpointPlan.connections.length).toBeGreaterThan(
      prior.result.endpointPlan.connections.length,
    );
  });

  it.each(['nested', 'nearest-only'] as const)(
    'ST16 preserves hard folder geometry in %s Soft scope',
    (softFolderScopeMode) => {
      const scopedPolicies: FocusSchematicProductLayoutPolicies = {
        ...policies,
        softFolderScopeMode,
      };
      const { before, after } = inputs();
      const prior = createFocusSchematicLayoutTransitionPrior(
        before,
        scopedPolicies,
        cold(before, scopedPolicies),
      );
      const classification = classifyFocusSchematicLayoutTransition(
        after,
        scopedPolicies,
        prior,
      );
      const attempt = computeFocusSchematicIncrementalLayoutAttempt(
        after,
        scopedPolicies,
        prior,
        classification,
      );
      if (attempt.status !== 'success') throw new Error(attempt.reason);
      expect(
        validateFocusSchematicComputedLayout(after, attempt.result).valid,
      ).toBe(true);
      expect(attempt.result.quality.moduleOverlapPairs).toEqual([]);
    },
  );

  it('ST10 deterministically rejects an impossible internal overlap for cold fallback', () => {
    const { before } = inputs();
    const prior = createFocusSchematicLayoutTransitionPrior(
      before,
      policies,
      cold(before),
    );
    const h4 = before.projection.nodes.find(
      (node) => node.kind === 'entity' && node.entityId === 'H4',
    );
    expect(h4).toBeDefined();
    const changed = {
      ...before,
      nodeDimensions: before.nodeDimensions.map((dimension) =>
        dimension.projectionNodeId === h4?.id
          ? { ...dimension, width: 1_600, height: 1_600 }
          : dimension,
      ),
    };
    const classification = classifyFocusSchematicLayoutTransition(
      changed,
      policies,
      prior,
    );
    const first = computeFocusSchematicIncrementalLayoutAttempt(
      changed,
      policies,
      prior,
      classification,
    );
    const second = computeFocusSchematicIncrementalLayoutAttempt(
      changed,
      policies,
      prior,
      classification,
    );
    expect(first.status).toBe('failure');
    expect(second).toEqual(first);
    const coldResult = cold(changed);
    const response = handleFocusSchematicLayoutWorkerRequest(
      {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 2,
        kind: 'layout',
        input: changed,
        policies,
        transitionPrior: prior,
      },
      () => 0,
    );
    expect(response.kind).toBe('success');
    if (response.kind !== 'success') return;
    expect(response.transitionEvidence.mode).toBe('cold-fallback');
    expect(response.transitionEvidence.coldFallbackUsed).toBe(true);
    expect(response.result).toEqual(coldResult);
  });

  it('keeps the Directional cold oracle byte-identical when a prior is supplied', () => {
    const { before, after } = inputs();
    const directionalPolicies: FocusSchematicProductLayoutPolicies = {
      ...policies,
      macroLayout: 'directional-bands',
    };
    const directional = (input: FocusSchematicLayoutInput) => ({
      ...input,
      settings: { ...input.settings, directionalFolderBandsEnabled: true },
    });
    const beforeInput = directional(before);
    const afterInput = directional(after);
    const beforeAttempt = computeFocusSchematicComputedLayoutAttempt(
      beforeInput,
      directionalPolicies,
    );
    if (beforeAttempt.status !== 'success')
      throw new Error(beforeAttempt.reason);
    const prior = createFocusSchematicLayoutTransitionPrior(
      beforeInput,
      directionalPolicies,
      beforeAttempt.result,
    );
    const request = {
      protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
      requestId: 3,
      kind: 'layout' as const,
      input: afterInput,
      policies: directionalPolicies,
    };
    const coldResponse = handleFocusSchematicLayoutWorkerRequest(
      request,
      () => 0,
    );
    const priorResponse = handleFocusSchematicLayoutWorkerRequest(
      { ...request, requestId: 4, transitionPrior: prior },
      () => 0,
    );
    expect(coldResponse.kind).toBe('success');
    expect(priorResponse.kind).toBe('success');
    if (coldResponse.kind !== 'success' || priorResponse.kind !== 'success')
      return;
    expect(priorResponse.transitionEvidence).toMatchObject({
      mode: 'cold',
      eligible: false,
      rejectionReason: 'macro-family-not-supported-incrementally',
    });
    expect(priorResponse.result).toEqual(coldResponse.result);
  });

  it('keeps local disclosure movement bounded in a 32-File / 96-Heading sequence', () => {
    const documents = Array.from({ length: 32 }, (_, index) => ({
      id: index === 0 ? 'Focus32' : `File${index}`,
      path: `${index % 4 === 0 ? 'science' : index % 4 === 1 ? 'language' : index % 4 === 2 ? 'design' : 'history'}/${index === 0 ? 'Focus32' : `File${index}`}.md`,
    }));
    const entities = documents.flatMap((document, fileIndex) =>
      Array.from({ length: 3 }, (_, headingIndex) => ({
        id: `F${fileIndex}-H${headingIndex + 1}`,
        kind: 'section' as const,
        documentId: document.id,
        parentId: document.id,
        line: 2 + headingIndex * 2,
      })),
    );
    const large = buildEndpointFixture({
      id: 'SS21-before',
      label: '32 File continuity sequence',
      authored: 'Synthetic scale fixture.',
      expectation: 'Local disclosure remains local.',
      inspect: 'Measure incremental movement and fallback frequency.',
      rootDocumentId: 'Focus32',
      documents,
      entities,
      references: documents.slice(1).map((document) => ({
        sourceEntityId: 'Focus32',
        targetEntityId: document.id,
      })),
      hops: 1,
    });
    const settings = {
      ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
      directionalFolderBandsEnabled: false,
    };
    let currentInput = layoutInput(large, settings);
    let currentResult = cold(currentInput);
    let fallbackCount = 0;
    const hidden: string[] = [];
    for (const entityId of ['F5-H3', 'F12-H3', 'F20-H3', 'F27-H3']) {
      hidden.push(entityId);
      const state = {
        ...large.state,
        disclosure: { ...large.state.disclosure, hiddenEntityIds: [...hidden] },
      };
      const projection = projectLocalView(large.workspace, state);
      const model = createFocusSchematicModel({
        workspace: large.workspace,
        state,
        projection,
      });
      const nextInput = layoutInput(
        { ...large, state, projection, model },
        settings,
      );
      const prior = createFocusSchematicLayoutTransitionPrior(
        currentInput,
        policies,
        currentResult,
      );
      const classification = classifyFocusSchematicLayoutTransition(
        nextInput,
        policies,
        prior,
      );
      const attempt = computeFocusSchematicIncrementalLayoutAttempt(
        nextInput,
        policies,
        prior,
        classification,
      );
      if (attempt.status !== 'success') {
        fallbackCount += 1;
        currentResult = cold(nextInput);
      } else {
        expect(
          attempt.evidence.movedUnaffectedModuleCount,
          JSON.stringify(attempt.evidence),
        ).toBe(0);
        expect(attempt.evidence.changedSurvivingCompassBranchCount).toBe(0);
        currentResult = attempt.result;
      }
      currentInput = nextInput;
    }
    expect(currentInput.model.modules).toHaveLength(32);
    expect(currentInput.nodeDimensions).toHaveLength(124);
    expect(fallbackCount).toBe(0);
  }, 60_000);
});
