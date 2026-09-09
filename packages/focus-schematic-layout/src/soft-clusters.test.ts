import { describe, expect, it } from 'vitest';

import { buildEndpointFixture } from './endpoint-fixtures';
import {
  computeFocusSchematicSoftClusterLayoutAttempt,
  FOCUS_SCHEMATIC_SOFT_CLUSTER_ITERATION_SCHEDULE,
} from './soft-clusters';
import {
  SOFT_CLUSTER_FIXTURES,
  createSoftClusterMultiplicityFixture,
} from './soft-cluster-fixtures';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from './settings';
import { layoutInput } from './test-helpers';
import type { EndpointFixtureSpec } from './endpoint-fixtures';
import type { FocusSchematicSoftFolderScopeOverride } from './types';

function run(
  spec: EndpointFixtureSpec,
  strength: 0 | 25 | 50 | 75 | 100 = 50,
  scopeOverrides: readonly FocusSchematicSoftFolderScopeOverride[] = [],
) {
  const input = layoutInput(buildEndpointFixture(spec), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: false,
  });
  const attempt = computeFocusSchematicSoftClusterLayoutAttempt(input, {
    strength,
    scopeOverrides,
  });
  if (attempt.status !== 'success')
    throw new Error(`${spec.id}/${strength} failed: ${attempt.reason}`);
  return { input, attempt };
}

const mixedScopeFixture: EndpointFixtureSpec = {
  id: 'SC25',
  label: 'mixed per-folder Soft scope',
  authored: 'Synthetic exact-folder hierarchy for HIER4B-FIX1.',
  expectation: 'Only explicitly promoted branches share a Soft spatial group.',
  inspect: 'Compare exact, one-child, sibling, and mixed-granularity grouping.',
  rootDocumentId: 'Focus',
  documents: [
    { id: 'Focus', path: 'root/Focus.md' },
    { id: 'LanguageParent', path: 'Language/Parent.md' },
    { id: 'PragmaticsA', path: 'Language/Pragmatics/A.md' },
    { id: 'PragmaticsB', path: 'Language/Pragmatics/B.md' },
    { id: 'GrammarA', path: 'Language/Grammar/A.md' },
    { id: 'GrammarB', path: 'Language/Grammar/B.md' },
    { id: 'PatternA', path: 'Pattern Theory/A/A.md' },
    { id: 'PatternB', path: 'Pattern Theory/B/B.md' },
  ],
  references: [
    { sourceEntityId: 'Focus', targetEntityId: 'LanguageParent' },
    { sourceEntityId: 'Focus', targetEntityId: 'PragmaticsA' },
    { sourceEntityId: 'PragmaticsA', targetEntityId: 'PragmaticsB' },
    { sourceEntityId: 'Focus', targetEntityId: 'GrammarA' },
    { sourceEntityId: 'GrammarA', targetEntityId: 'GrammarB' },
    { sourceEntityId: 'Focus', targetEntityId: 'PatternA' },
    { sourceEntityId: 'Focus', targetEntityId: 'PatternB' },
  ],
  hops: 2,
};

function fixture(id: `SC${number}`) {
  const value = SOFT_CLUSTER_FIXTURES.find((item) => item.id === id);
  if (value === undefined) throw new Error(`Missing fixture ${id}.`);
  return value;
}

describe('HIER4B Soft Folder Clusters', () => {
  it('owns the complete SC1-SC24 fixture inventory', () => {
    expect(SOFT_CLUSTER_FIXTURES.map(({ id }) => id)).toEqual(
      Array.from({ length: 24 }, (_, index) => `SC${index + 1}`),
    );
  });

  it('uses a fixed two-round schedule, anchors the root File, and clears overlaps', () => {
    for (const id of [
      'SC3',
      'SC7',
      'SC11',
      'SC14',
      'SC21',
      'SC22',
      'SC24',
    ] as const) {
      const { input, attempt } = run(fixture(id));
      const root = input.model.modules.find(
        ({ id: moduleId }) => moduleId === input.model.rootModuleId,
      )!;
      const file = attempt.result.candidate.nodes.find(
        ({ projectionNodeId }) =>
          projectionNodeId === root.documentProjectionNodeId,
      )!;
      expect(file.x + file.width / 2).toBeCloseTo(0, 8);
      expect(file.y + file.height / 2).toBeCloseTo(0, 8);
      expect(attempt.evidence.fixedIterationSchedule).toEqual(
        FOCUS_SCHEMATIC_SOFT_CLUSTER_ITERATION_SCHEDULE,
      );
      expect(attempt.evidence.runtime.iterationCount).toBe(54);
      expect(attempt.evidence.runtime.jointRoundCount).toBe(2);
      expect(attempt.evidence.metrics.overlapCount).toBe(0);
    }
  }, 30_000);

  it('is byte-deterministic and independent of input document ordering', () => {
    const spec = fixture('SC15');
    const first = run(spec).attempt;
    const second = run(spec).attempt;
    const permuted = run({
      ...spec,
      documents: [...spec.documents].reverse(),
    }).attempt;
    const fullyPermuted = run({
      ...spec,
      documents: [...spec.documents].reverse(),
      references: [...spec.references].reverse(),
    }).attempt;
    expect(JSON.stringify(first.result.candidate)).toBe(
      JSON.stringify(second.result.candidate),
    );
    expect(JSON.stringify(first.result.candidate)).toBe(
      JSON.stringify(permuted.result.candidate),
    );
    expect(JSON.stringify(first.result.candidate)).toBe(
      JSON.stringify(fullyPermuted.result.candidate),
    );
  });

  it('makes strength zero exactly independent of exact folder identity', () => {
    const spec = fixture('SC2');
    const changed: EndpointFixtureSpec = {
      ...spec,
      documents: spec.documents.map((document, index) => ({
        ...document,
        path: `mutated-${index}/${document.id}.md`,
      })),
    };
    const before = run(spec, 0).attempt;
    const after = run(changed, 0).attempt;
    expect(before.evidence.folderInfluenceEnabled).toBe(false);
    expect(JSON.stringify(before.result.candidate)).toBe(
      JSON.stringify(after.result.candidate),
    );
  });

  it('keeps strength zero geometry independent of promoted spatial scope', () => {
    const exact = run(mixedScopeFixture, 0).attempt;
    const promoted = run(mixedScopeFixture, 0, [
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
    ]).attempt;
    expect(promoted.evidence.folderInfluenceEnabled).toBe(false);
    expect(promoted.result.candidate).toEqual(exact.result.candidate);
  });

  it.each([0, 25, 50, 75, 100] as const)(
    'uses the same mixed effective groups at strength %i',
    (strength) => {
      const scopeOverrides = [
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
      ] as const;
      const result = run(mixedScopeFixture, strength, scopeOverrides).attempt;
      expect(
        result.result.internalLayoutEvidence.softClusterPolicyEvidence,
      ).toMatchObject({ scopeOverrides, strength });
      expect(result.evidence).toMatchObject({
        effectiveGroupCount: 4,
        scopeOverrideCount: 3,
      });
    },
    20_000,
  );

  it('keeps singleton folders force-free and improves repeated-folder cohesion at full strength', () => {
    const singleton0 = run(fixture('SC6'), 0).attempt;
    const singleton100 = run(fixture('SC6'), 100).attempt;
    expect(JSON.stringify(singleton0.result.candidate)).toBe(
      JSON.stringify(singleton100.result.candidate),
    );

    const loose = run(fixture('SC16'), 0).attempt.evidence.metrics;
    const cohesive = run(fixture('SC16'), 100).attempt.evidence.metrics;
    expect(cohesive.repeatedFolderRmsRadiusMean).not.toBeNull();
    expect(cohesive.repeatedFolderRmsRadiusMean!).toBeLessThan(
      loose.repeatedFolderRmsRadiusMean!,
    );
  });

  it('excludes filtered bridge identity from folder centroids', () => {
    const result = run(fixture('SC13')).attempt;
    expect(result.evidence.metrics.repeatedFolderCount).toBe(1);
    expect(result.evidence.metrics.repeatedFolderModuleCount).toBe(2);
    expect(result.result.candidate.modules).toHaveLength(4);
  });

  it('caps multiplicity influence after the documented logarithmic saturation', () => {
    const twenty = run(createSoftClusterMultiplicityFixture(20)).attempt;
    const hundred = run(createSoftClusterMultiplicityFixture(100)).attempt;
    expect(JSON.stringify(twenty.result.candidate)).toBe(
      JSON.stringify(hundred.result.candidate),
    );
  });

  it('gives secondary relationships zero geometry influence', () => {
    const spec = fixture('SC20');
    const baseline = run(spec).attempt;
    const secondaryReferenceIds = new Set(
      baseline.result.endpointPlan.connections
        .filter(({ role }) => role === 'secondary')
        .flatMap(({ referenceIds }) => referenceIds),
    );
    expect(secondaryReferenceIds.size).toBeGreaterThan(0);
    const withoutSecondary: EndpointFixtureSpec = {
      ...spec,
      references: spec.references.filter(
        (_, index) => !secondaryReferenceIds.has(`SC20-reference-${index + 1}`),
      ),
    };
    const changed = run(withoutSecondary).attempt;
    expect(JSON.stringify(baseline.result.candidate)).toBe(
      JSON.stringify(changed.result.candidate),
    );
  });
});
