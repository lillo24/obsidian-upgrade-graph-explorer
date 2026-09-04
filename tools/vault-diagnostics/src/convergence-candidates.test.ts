import { describe, expect, it } from 'vitest';

import { computeLocalLayout } from '@icarus-graph-explorer/renderer-sigma/core';

import {
  convergenceFixtures,
  focusConvergenceFixtures,
  globalConvergenceFixtures,
} from './convergence-fixtures';
import {
  deterministicIterationCap,
  evaluateCandidate,
  fixturePositions,
  globalFolderMacroEvidence,
  movementCurve,
  productionDrift,
  runPublicBatches,
} from './convergence-candidates';
import { measureDisplacement } from './convergence-metrics';

describe('CONVERGENCE1A fixtures and diagnostic lifecycle', () => {
  it('covers the established Focus family and required Global modes', () => {
    const focus = focusConvergenceFixtures();
    const global = globalConvergenceFixtures();
    expect(focus).toHaveLength(15);
    expect(focus.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'focus-two-reference',
        'focus-five-mixed-isolate',
        'focus-root-weak-and-isolated',
        'focus-long-chain',
        'focus-hierarchy-heavy',
        'focus-reference-heavy',
      ]),
    );
    expect(global.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'global-small-connected',
        'global-small-isolates',
        'global-medium-mixed',
        'global-folder-off-reference-only',
        'global-folder-on-chunked-prior',
        'global-multiple-folders-cross-references',
        'global-weak-folder-clusters',
      ]),
    );
    expect(convergenceFixtures()).toHaveLength(22);
    expect(focus.every(({ currentBudget }) => currentBudget === 160)).toBe(
      true,
    );
    expect(global.every(({ currentBudget }) => currentBudget === 100)).toBe(
      true,
    );
  });

  it('keeps reused and rebuilt public batches geometrically equivalent', () => {
    const fixture = focusConvergenceFixtures().find(
      ({ id }) => id === 'focus-five-star',
    )!;
    const start = fixturePositions(fixture);
    const reused = runPublicBatches({
      fixture,
      start,
      totalIterations: 64,
      batchSize: 32,
      form: 'reuse',
    });
    const rebuilt = runPublicBatches({
      fixture,
      start,
      totalIterations: 64,
      batchSize: 32,
      form: 'rebuild',
    });
    const divergence = measureDisplacement({
      before: reused.positions,
      after: rebuilt.positions,
      edges: fixture.request.edges,
      alignment: { kind: 'root', rootKey: fixture.request.rootKey },
    });
    expect(divergence.all.maximum).toBeLessThan(1e-10);
    expect(reused.snapshots).toHaveLength(2);
    expect(rebuilt.snapshots).toHaveLength(2);
  });

  it('reproduces finite-job drift without changing production behavior', () => {
    const fixture = focusConvergenceFixtures().find(
      ({ id }) => id === 'focus-root-weak-and-isolated',
    )!;
    const drift = productionDrift(fixture);
    expect(drift.aToB.all.p90).toBeGreaterThan(0);
    expect(drift.aToB.lowDegree.count).toBeGreaterThan(0);
    expect(drift.bToC.lowDegree.maximum).toBeGreaterThan(0);
  });

  it('declares stable only after K completed batches and keeps the probe hidden', () => {
    const fixture = focusConvergenceFixtures().find(
      ({ id }) => id === 'focus-five-star',
    )!;
    const curve = movementCurve(fixture, 32);
    const candidate = evaluateCandidate({
      fixture,
      curve,
      threshold: 10,
      stableBatchesRequired: 3,
      guard: 'all-p90',
      maxIterations: deterministicIterationCap(
        fixture.mode,
        fixture.request.nodes.length,
      ),
      maxWallTimeMs: 60_000,
    });
    expect(candidate.stopReason).toBe('stable');
    expect(candidate.batchesCompleted).toBe(3);
    expect(candidate.iterationsCompleted).toBe(96);
    expect(candidate.probeMovement).not.toBeNull();
    expect(candidate.probePositions).not.toEqual(candidate.finalPositions);
  });

  it('keeps the selected production stop below its hidden Focus probe guards', () => {
    const fixture = focusConvergenceFixtures().find(
      ({ id }) => id === 'focus-five-star',
    )!;
    const production = computeLocalLayout(
      { ...fixture.request, requestId: 91 },
      { maxWallTimeMs: 60_000 },
    );
    expect(production.stopReason).toBe('stable');
    const probe = runPublicBatches({
      fixture,
      start: production.positions,
      totalIterations: 32,
      batchSize: 32,
      form: 'reuse',
    });
    const movement = measureDisplacement({
      before: production.positions,
      after: probe.positions,
      edges: fixture.request.edges,
      alignment: { kind: 'root', rootKey: fixture.request.rootKey },
    });
    expect(movement.all.p90).toBeLessThanOrEqual(0.00512);
    expect(movement.lowDegree.maximum).toBeLessThanOrEqual(0.01024);
  });

  it('ends a cap case on its deterministic partial batch without counting it stable', () => {
    const fixture = focusConvergenceFixtures().find(
      ({ id }) => id === 'focus-long-chain',
    )!;
    const curve = movementCurve(fixture, 32);
    const candidate = evaluateCandidate({
      fixture,
      curve,
      threshold: Number.MIN_VALUE,
      stableBatchesRequired: 3,
      guard: 'bounded-low-degree-maximum',
      maxIterations: 1_000,
      maxWallTimeMs: 60_000,
    });
    expect(candidate.stopReason).toBe('max-iterations');
    expect(candidate.iterationsCompleted).toBe(1_000);
    expect(
      curve.snapshots.find(
        ({ iterationsCompleted }) => iterationsCompleted === 1_000,
      )?.batchIterations,
    ).toBe(8);
    expect(candidate.stableBatches).toBeLessThan(3);
  });

  it('measures complete folder-prior macro alternatives without folding workers', () => {
    const fixture = globalConvergenceFixtures().find(
      ({ id }) => id === 'global-folder-on-chunked-prior',
    )!;
    const evidence = globalFolderMacroEvidence(fixture, 32);
    expect(evidence.g1RepeatedWholeRun.movement.all.p90).toBeGreaterThan(0);
    expect(evidence.g3PureFa2Tail.movement.all.p90).toBeGreaterThan(0);
    expect(evidence.g3PureFa2Tail.tailIterations).toBe(32);
    expect(evidence.current.positions).toHaveLength(
      fixture.request.nodes.length,
    );
  });
});
