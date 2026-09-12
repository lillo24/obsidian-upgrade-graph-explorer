import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { buildEndpointFixture } from './endpoint-fixtures';
import { computeFocusSchematicComputedLayoutAttempt } from './endpoint-facing';
import { DIRECTIONAL_FOLDER_BAND_FIXTURES } from './folder-fixtures';
import {
  computeFocusSchematicSoftClusterLayoutAttempt,
  FOCUS_SCHEMATIC_SOFT_CLUSTER_ITERATION_SCHEDULE,
} from './soft-clusters';
import {
  SOFT_CLUSTER_FIXTURES,
  createSoftClusterMultiplicityFixture,
} from './soft-cluster-fixtures';
import { buildFocusSchematicSoftFolderDisplayTree } from './soft-folder-display';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from './settings';
import { layoutInput } from './test-helpers';
import type { EndpointFixtureSpec } from './endpoint-fixtures';
import type { FocusSchematicSoftFolderDisplayIntent } from './types';

function run(
  spec: EndpointFixtureSpec,
  strength: 0 | 25 | 50 | 75 | 100 = 50,
  displayIntent: FocusSchematicSoftFolderDisplayIntent = {
    fileParentOverrides: [],
    flattenedFolderKeys: [],
  },
) {
  const input = layoutInput(buildEndpointFixture(spec), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: false,
  });
  const attempt = computeFocusSchematicSoftClusterLayoutAttempt(input, {
    strength,
    displayIntent,
  });
  if (attempt.status !== 'success')
    throw new Error(`${spec.id}/${strength} failed: ${attempt.reason}`);
  return { input, attempt };
}

const mixedScopeFixture: EndpointFixtureSpec = {
  id: 'SC25',
  label: 'mixed per-folder Soft scope',
  authored: 'Synthetic exact-folder hierarchy for HIER4B-FIX2.',
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

const rootAndOneSameFolderFixture: EndpointFixtureSpec = {
  id: 'SC26',
  label: 'root plus one same-folder File',
  authored: 'Synthetic PATCH2 root-folder force exclusion case.',
  expectation: 'The root and one peer do not form an attraction group.',
  inspect: 'Strength zero and one hundred must produce identical geometry.',
  rootDocumentId: 'Focus',
  documents: [
    { id: 'Focus', path: 'shared/Focus.md' },
    { id: 'Peer', path: 'shared/Peer.md' },
  ],
  references: [{ sourceEntityId: 'Focus', targetEntityId: 'Peer' }],
  hops: 1,
};

const rootAndTwoSameFolderFixture: EndpointFixtureSpec = {
  id: 'SC27',
  label: 'root plus two same-folder Files',
  authored: 'Synthetic PATCH2 root-centroid and descendant exclusion case.',
  expectation: 'Only the two non-root Files attract toward their centroid.',
  inspect:
    'Root display membership remains while force membership excludes it.',
  rootDocumentId: 'Focus',
  documents: [
    { id: 'Focus', path: 'shared/Focus.md' },
    { id: 'B', path: 'shared/B.md' },
    { id: 'C', path: 'shared/C.md' },
  ],
  entities: [
    {
      id: 'Focus-Heading',
      kind: 'section',
      documentId: 'Focus',
      parentId: 'Focus',
      line: 2,
    },
    {
      id: 'Focus-Block',
      kind: 'block',
      documentId: 'Focus',
      parentId: 'Focus-Heading',
      line: 3,
    },
  ],
  references: [
    { sourceEntityId: 'Focus-Block', targetEntityId: 'B' },
    { sourceEntityId: 'Focus-Heading', targetEntityId: 'C' },
  ],
  hops: 1,
};

function moduleDistance(
  attempt: ReturnType<typeof run>['attempt'],
  firstId: string,
  secondId: string,
) {
  const first = attempt.result.candidate.modules.find(
    ({ moduleId }) => moduleId === firstId,
  )!;
  const second = attempt.result.candidate.modules.find(
    ({ moduleId }) => moduleId === secondId,
  )!;
  return Math.hypot(
    second.x + second.width / 2 - (first.x + first.width / 2),
    second.y + second.height / 2 - (first.y + first.height / 2),
  );
}

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

  it('keeps strength zero geometry independent of manual display intent', () => {
    const exact = run(mixedScopeFixture, 0).attempt;
    const promoted = run(mixedScopeFixture, 0, {
      fileParentOverrides: [
        { fileId: 'PragmaticsA', displayParentFolderKey: 'Language' },
      ],
      flattenedFolderKeys: ['Pattern Theory/A'],
    }).attempt;
    expect(promoted.evidence.folderInfluenceEnabled).toBe(false);
    expect(promoted.result.candidate).toEqual(exact.result.candidate);
  });

  it.each([0, 25, 50, 75, 100] as const)(
    'uses the same nested display hierarchy at strength %i',
    (strength) => {
      const displayIntent = {
        fileParentOverrides: [
          { fileId: 'PragmaticsA', displayParentFolderKey: 'Language' },
        ],
        flattenedFolderKeys: ['Pattern Theory/A'],
      } as const;
      const result = run(mixedScopeFixture, strength, displayIntent).attempt;
      expect(
        result.result.internalLayoutEvidence.softClusterPolicyEvidence,
      ).toMatchObject({
        displayIntent,
        strength,
        hierarchyForcePolicy: 'normalized-decay',
      });
      expect(result.evidence).toMatchObject({
        fileParentOverrideCount: 1,
        flattenedFolderCount: 1,
        hierarchyForcePolicy: 'normalized-decay',
        maximumPerFileFolderWeight: 1,
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

  it('excludes the root before a same-folder pair can become an attraction group', () => {
    const withoutFolderForce = run(rootAndOneSameFolderFixture, 0).attempt;
    const fullStrength = run(rootAndOneSameFolderFixture, 100).attempt;

    expect(fullStrength.result.candidate).toEqual(
      withoutFolderForce.result.candidate,
    );
    expect(fullStrength.evidence.metrics).toMatchObject({
      repeatedFolderCount: 0,
      repeatedFolderModuleCount: 0,
    });
    expect(fullStrength.evidence.runtime.repeatedFolderCount).toBe(0);
    expect(fullStrength.evidence.maximumPerFileFolderWeight).toBe(0);
  });

  it('computes same-folder attraction from non-root Files while preserving root display membership', () => {
    const withoutFolderForce = run(rootAndTwoSameFolderFixture, 0);
    const fullStrength = run(rootAndTwoSameFolderFixture, 100);
    const coldRepeat = run(rootAndTwoSameFolderFixture, 100);
    const rootInAnotherFolder = run(
      {
        ...rootAndTwoSameFolderFixture,
        documents: rootAndTwoSameFolderFixture.documents.map((document) =>
          document.id === 'Focus'
            ? { ...document, path: 'focus-only/Focus.md' }
            : document,
        ),
      },
      100,
    );

    expect(fullStrength.attempt.result.candidate).toEqual(
      rootInAnotherFolder.attempt.result.candidate,
    );
    expect(coldRepeat.attempt.result.candidate).toEqual(
      fullStrength.attempt.result.candidate,
    );
    expect(moduleDistance(fullStrength.attempt, 'B', 'C')).toBeLessThan(
      moduleDistance(withoutFolderForce.attempt, 'B', 'C'),
    );
    expect(fullStrength.attempt.evidence.metrics).toMatchObject({
      repeatedFolderCount: 1,
      repeatedFolderModuleCount: 2,
    });
    expect(fullStrength.attempt.evidence.maximumPerFileFolderWeight).toBe(1);

    const tree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: fullStrength.input.model.modules.map(
        ({ id, folderKey }) => ({
          fileId: id,
          exactFolderKey: folderKey,
        }),
      ),
    });
    expect(tree.files.find(({ fileId }) => fileId === 'Focus')).toMatchObject({
      exactFolderKey: 'shared',
      displayParentFolderKey: 'shared',
    });
    expect(
      fullStrength.attempt.result.candidate.nodes.filter(
        ({ moduleId }) => moduleId === 'Focus',
      ),
    ).toHaveLength(3);
    expect(fullStrength.attempt.result.candidate.modules).toHaveLength(3);
  });

  it('keeps non-root repeated-folder geometry byte-identical', () => {
    const attempt = run(fixture('SC16'), 100).attempt;
    expect(
      createHash('sha256')
        .update(JSON.stringify(attempt.result.candidate))
        .digest('hex'),
    ).toBe('009d2186c301d41dfeacd7a015f9158cd17ec2025b0dcb311db39a635a1bc6a9');
  });

  it('keeps representative Directional layouts byte-identical', () => {
    const expected = new Map([
      [
        'DB5',
        'd1a29e0f58549855c30f77e0453f163aac1ced1cccc00e203905a2db1df7768c',
      ],
      [
        'DB11',
        'fda189a732b2e00746699e2635e10ab58e2fc73a8a1c46d183abfd400a2106d5',
      ],
      [
        'DB12',
        '71a889c446f481ce6c373ddd0ceca16d87aedd108981a6574abb4572ddd4c946',
      ],
    ]);
    for (const [id, hash] of expected) {
      const spec = DIRECTIONAL_FOLDER_BAND_FIXTURES.find(
        (item) => item.id === id,
      )!;
      const input = layoutInput(buildEndpointFixture(spec), {
        ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
        directionalFolderBandsEnabled: true,
      });
      const attempt = computeFocusSchematicComputedLayoutAttempt(input, {
        endpointOrderPolicy: 'crossing-optimized',
        internalLayoutVariant: 'adaptive-compass',
      });
      expect(attempt.status, id).toBe('success');
      if (attempt.status !== 'success') continue;
      const payload = JSON.stringify({
        candidate: attempt.result.candidate,
        attachments: attempt.result.attachments,
        folderBandPlan: attempt.result.folderBandPlan,
        quality: attempt.result.quality,
      });
      expect(createHash('sha256').update(payload).digest('hex'), id).toBe(hash);
    }
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
