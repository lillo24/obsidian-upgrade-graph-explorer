import { describe, expect, it } from 'vitest';

import {
  customGlobalLayoutSettings,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
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
});
