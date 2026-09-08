import { describe, expect, it } from 'vitest';

import {
  globalMacroFixtures,
  globalMacroQuality,
  runGlobalMacroCandidate,
} from './global-convergence-candidates';

function spread(values: readonly number[]): number {
  return (
    (Math.max(...values) - Math.min(...values)) /
    Math.max(
      0.05,
      values.reduce((sum, value) => sum + value, 0) / values.length,
    )
  );
}

describe('CONVERGENCE1C candidate evidence', () => {
  it('covers the required private-safe Global matrix', () => {
    const fixtures = globalMacroFixtures();
    expect(fixtures).toHaveLength(18);
    expect(
      fixtures.filter(({ category }) => category === 'reference-only'),
    ).toHaveLength(3);
    expect(fixtures.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'two-folders-weak',
        'two-folders-strong',
        'four-folders-mixed',
        'imbalanced-folders',
        'folder-isolates',
        'root-level-files',
        'one-folder',
        'preset-compact',
        'preset-spacious',
        'low-cohesion',
        'high-cohesion',
        'low-reference-pull',
        'high-reference-pull',
      ]),
    );
  });

  it('makes M2 materially less duration-dependent than repeated M0', () => {
    const fixture = globalMacroFixtures().find(
      ({ id }) => id === 'folder-baseline',
    )!;
    const values = (candidate: 'M0' | 'M2') => {
      const run = runGlobalMacroCandidate({
        fixture,
        candidate,
        macroSteps: 12,
        presettleIterations: 640,
      });
      return [3, 5, 8, 12].map(
        (step) => run.frames[step - 1]!.quality.meanWithinFolderDistance,
      );
    };
    expect(spread(values('M2'))).toBeLessThan(spread(values('M0')));
  });

  it('keeps stronger cross-folder references able to resist the soft field', () => {
    const fixtures = globalMacroFixtures();
    const quality = (id: string) => {
      const fixture = fixtures.find((value) => value.id === id)!;
      const positions = runGlobalMacroCandidate({
        fixture,
        candidate: 'M2',
        macroSteps: 12,
      }).frames.at(-1)!.positions;
      return globalMacroQuality(fixture.request, positions);
    };
    expect(
      quality('two-folders-strong').meanCrossFolderReferenceLength,
    ).toBeLessThan(quality('two-folders-weak').meanCrossFolderReferenceLength);
  });
});
