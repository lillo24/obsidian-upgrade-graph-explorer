import { describe, expect, it } from 'vitest';

import {
  customGlobalLayoutSettings,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE,
  folderClusteringStrength,
  globalLayoutSettingsFromPhysics,
  resolveGlobalPhysicsSettings,
  resolveGlobalLayoutSettings,
  resolveGlobalVisualSettings,
  resolveNetworkSettings,
  sameGlobalPhysicsSettings,
  sameGlobalVisualSettings,
  validateGlobalPhysicsSettings,
  validateGlobalLayoutSettings,
  withFolderClusteringStrength,
  withGlobalSpacingPreset,
} from './settings';

describe('Global folder clustering strength', () => {
  it('uses the documented stronger preset cohesion values', () => {
    expect(customGlobalLayoutSettings('compact').folderCohesion).toBe(0.09);
    expect(customGlobalLayoutSettings('normal').folderCohesion).toBe(0.08);
    expect(customGlobalLayoutSettings('spacious').folderCohesion).toBe(0.07);
    expect(
      customGlobalLayoutSettings('normal').referenceDegreeSizeInfluence,
    ).toBe(DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE);
  });

  it('maps the product percentage to folderCohesion only', () => {
    const initial = resolveGlobalLayoutSettings(DEFAULT_GLOBAL_LAYOUT_SETTINGS);
    const changed = withFolderClusteringStrength(
      DEFAULT_GLOBAL_LAYOUT_SETTINGS,
      70,
    );
    const resolved = resolveGlobalLayoutSettings(changed);

    expect(folderClusteringStrength(changed)).toBe(70);
    expect(resolved.folderCohesion).toBe(0.126);
    expect({ ...resolved, folderCohesion: initial.folderCohesion }).toEqual(
      initial,
    );
  });

  it('preserves strength while rebuilding a spacing preset baseline', () => {
    const strong = withFolderClusteringStrength(
      DEFAULT_GLOBAL_LAYOUT_SETTINGS,
      70,
    );
    const spacious = withGlobalSpacingPreset(strong, 'spacious');

    expect(spacious.spacingPreset).toBe('spacious');
    expect(folderClusteringStrength(spacious)).toBe(70);
    expect(resolveGlobalLayoutSettings(spacious)).toMatchObject({
      folderCohesion: 0.126,
      withinFolderSpacing: 1.65,
      betweenFolderSpacing: 4.6,
    });
  });

  it('keeps shared Network choices independent from All spacing presets', () => {
    const custom = {
      ...customGlobalLayoutSettings('normal'),
      linkForce: 1.4,
      nodeSize: 7,
      referenceDegreeSizeInfluence: 85,
      linkThickness: 1.4,
      labelThreshold: 11,
    };
    const spacious = withGlobalSpacingPreset(
      {
        folderClustering: true,
        spacingPreset: 'normal',
        custom,
      },
      'spacious',
    );

    expect(resolveGlobalLayoutSettings(spacious)).toMatchObject({
      linkForce: 1.4,
      withinFolderSpacing: 1.65,
      betweenFolderSpacing: 4.6,
      nodeSize: 7,
      referenceDegreeSizeInfluence: 85,
      linkThickness: 1.4,
      labelThreshold: 11,
    });
  });

  it('resolves a shared subset without exposing All-only folder physics', () => {
    const baseline = {
      folderClustering: true,
      spacingPreset: 'normal' as const,
      custom: {
        ...customGlobalLayoutSettings('normal'),
        linkForce: 1.35,
        nodeSize: 7,
        linkThickness: 1.4,
        labelThreshold: 11,
      },
    };
    const changedAllOnly = {
      ...baseline,
      folderClustering: false,
      custom: {
        ...baseline.custom,
        folderCohesion: 0.16,
        withinFolderSpacing: 2.8,
        betweenFolderSpacing: 7.5,
        referenceDegreeSizeInfluence: 100,
      },
    };

    expect(resolveNetworkSettings(baseline)).toEqual({
      referencePull: 1.35,
      nodeSize: 7,
      linkThickness: 1.4,
      labelThreshold: 11,
    });
    expect(resolveNetworkSettings(changedAllOnly)).toEqual(
      resolveNetworkSettings(baseline),
    );
  });

  it('normalizes legacy custom settings to the old degree-size behavior', () => {
    const current = customGlobalLayoutSettings('compact');
    const legacyCustom = {
      linkForce: current.linkForce,
      folderCohesion: current.folderCohesion,
      withinFolderSpacing: current.withinFolderSpacing,
      betweenFolderSpacing: current.betweenFolderSpacing,
      nodeSize: current.nodeSize,
      linkThickness: current.linkThickness,
      labelThreshold: current.labelThreshold,
    };
    const normalized = validateGlobalLayoutSettings({
      folderClustering: true,
      spacingPreset: 'compact',
      custom: { ...legacyCustom, nodeSize: 6.25 },
    });

    expect(normalized.custom).toEqual({
      ...legacyCustom,
      nodeSize: 6.25,
      referenceDegreeSizeInfluence: DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE,
    });
  });

  it('retains strength while clustering is Off and round-trips old custom data', () => {
    const existing = validateGlobalLayoutSettings({
      folderClustering: false,
      spacingPreset: 'compact',
      custom: {
        ...customGlobalLayoutSettings('compact'),
        folderCohesion: 0.045,
      },
    });

    expect(folderClusteringStrength(existing)).toBe(25);
    const changed = withFolderClusteringStrength(existing, 75);
    expect(changed.folderClustering).toBe(false);
    expect(folderClusteringStrength(changed)).toBe(75);
    expect(validateGlobalLayoutSettings(changed)).toEqual(changed);
  });

  it('rejects percentages outside the normalized product range', () => {
    expect(() =>
      withFolderClusteringStrength(DEFAULT_GLOBAL_LAYOUT_SETTINGS, -1),
    ).toThrow('0 to 100');
    expect(() =>
      withFolderClusteringStrength(DEFAULT_GLOBAL_LAYOUT_SETTINGS, 101),
    ).toThrow('0 to 100');
    expect(() =>
      withFolderClusteringStrength(DEFAULT_GLOBAL_LAYOUT_SETTINGS, NaN),
    ).toThrow('finite');
  });

  it.each([-1, 101, Number.NaN])(
    'rejects invalid link influence %s',
    (referenceDegreeSizeInfluence) => {
      expect(() =>
        validateGlobalLayoutSettings({
          ...DEFAULT_GLOBAL_LAYOUT_SETTINGS,
          custom: {
            ...customGlobalLayoutSettings('normal'),
            referenceDegreeSizeInfluence,
          },
        }),
      ).toThrow('referenceDegreeSizeInfluence');
    },
  );
});

describe('Global physics and visual settings boundary', () => {
  const baseline = {
    folderClustering: true,
    spacingPreset: 'normal' as const,
    custom: customGlobalLayoutSettings('normal'),
  };

  it('classifies the resolved subsets from one persisted settings record', () => {
    expect(resolveGlobalPhysicsSettings(baseline)).toEqual({
      folderClustering: true,
      folderCohesion: 0.08,
      linkForce: 1,
      withinFolderSpacing: 1.15,
      betweenFolderSpacing: 3.2,
    });
    expect(resolveGlobalVisualSettings(baseline)).toEqual({
      nodeSize: 4.5,
      referenceDegreeSizeInfluence: 50,
      linkThickness: 0.7,
      labelThreshold: 7,
    });
  });

  it.each([
    ['nodeSize', 7],
    ['referenceDegreeSizeInfluence', 90],
    ['linkThickness', 1.6],
    ['labelThreshold', 12],
  ] as const)('keeps %s out of physics identity', (key, value) => {
    const changed = {
      ...baseline,
      custom: { ...baseline.custom, [key]: value },
    };
    expect(sameGlobalPhysicsSettings(baseline, changed)).toBe(true);
    expect(sameGlobalVisualSettings(baseline, changed)).toBe(false);
  });

  it.each([
    ['folderCohesion', 0.12],
    ['linkForce', 1.5],
    ['withinFolderSpacing', 1.8],
    ['betweenFolderSpacing', 5],
  ] as const)('keeps %s in physics identity', (key, value) => {
    const changed = {
      ...baseline,
      custom: { ...baseline.custom, [key]: value },
    };
    expect(sameGlobalPhysicsSettings(baseline, changed)).toBe(false);
    expect(sameGlobalVisualSettings(baseline, changed)).toBe(true);
  });

  it('classifies clustering and resolved preset spatial changes as physics', () => {
    expect(
      sameGlobalPhysicsSettings(baseline, {
        ...baseline,
        folderClustering: false,
      }),
    ).toBe(false);
    expect(
      sameGlobalPhysicsSettings(
        baseline,
        withGlobalSpacingPreset(baseline, 'spacious'),
      ),
    ).toBe(false);
  });

  it('adapts physics to legacy soft-attractor settings with a fixed visual baseline', () => {
    const physics = resolveGlobalPhysicsSettings({
      ...baseline,
      custom: {
        ...baseline.custom,
        linkForce: 1.4,
        nodeSize: 8,
      },
    });
    const workerSettings = globalLayoutSettingsFromPhysics(physics);
    expect(resolveGlobalPhysicsSettings(workerSettings)).toEqual(physics);
    expect(resolveGlobalVisualSettings(workerSettings)).toEqual(
      resolveGlobalVisualSettings(DEFAULT_GLOBAL_LAYOUT_SETTINGS),
    );
  });

  it('strictly validates the finite worker spatial contract', () => {
    const physics = resolveGlobalPhysicsSettings(baseline);
    expect(validateGlobalPhysicsSettings(physics)).toEqual(physics);
    expect(() =>
      validateGlobalPhysicsSettings({ ...physics, nodeSize: 8 }),
    ).toThrow('unexpected field nodeSize');
    expect(() =>
      validateGlobalPhysicsSettings({
        ...physics,
        betweenFolderSpacing: undefined,
      }),
    ).toThrow('betweenFolderSpacing');
  });
});
