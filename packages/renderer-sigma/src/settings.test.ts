import { describe, expect, it } from 'vitest';

import {
  customGlobalLayoutSettings,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE,
  folderClusteringStrength,
  resolveGlobalLayoutSettings,
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

  it('keeps advanced visual choices independent from spacing presets', () => {
    const custom = {
      ...customGlobalLayoutSettings('normal'),
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
      linkForce: 0.85,
      withinFolderSpacing: 1.65,
      betweenFolderSpacing: 4.6,
      nodeSize: 7,
      referenceDegreeSizeInfluence: 85,
      linkThickness: 1.4,
      labelThreshold: 11,
    });
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
