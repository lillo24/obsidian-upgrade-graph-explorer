import { describe, expect, it } from 'vitest';

import {
  allPresentationMode,
  explorationLayout,
  explorationScope,
  focusLayoutMode,
  globalLayoutSettingsApplyImmediately,
  globalLayoutSettingsRequireImmediateLayout,
  hierarchyVisualVariantForScope,
} from './exploration-model';

describe('Scope and Layout mapping', () => {
  it.each([
    ['global', 'free', 'all', 'network'],
    ['structure', 'free', 'all', 'hierarchy'],
    ['local', 'free', 'focus', 'network'],
    ['local', 'structured', 'focus', 'hierarchy'],
  ] as const)(
    'maps %s/%s to %s/%s',
    (presentation, localLayout, scope, layout) => {
      expect(explorationScope(presentation)).toBe(scope);
      expect(explorationLayout(presentation, localLayout)).toBe(layout);
    },
  );

  it('maps exposed layouts back to the compatible internal modes', () => {
    expect(allPresentationMode('network')).toBe('global');
    expect(allPresentationMode('hierarchy')).toBe('structure');
    expect(focusLayoutMode('network')).toBe('free');
    expect(focusLayoutMode('hierarchy')).toBe('structured');
  });

  it('assigns compact hierarchy cards to All and extended cards to Focus', () => {
    expect(hierarchyVisualVariantForScope('all')).toBe('compact-schematic');
    expect(hierarchyVisualVariantForScope('focus')).toBe('extended');
  });

  it.each([
    ['all', 'network', true],
    ['all', 'hierarchy', false],
    ['focus', 'network', false],
    ['focus', 'hierarchy', false],
  ] as const)(
    'applies Global settings immediately for %s/%s: %s',
    (scope, layout, expected) => {
      expect(globalLayoutSettingsApplyImmediately(scope, layout)).toBe(
        expected,
      );
    },
  );

  it('requests active All Network layout only for resolved physics changes', () => {
    const current = {
      folderClustering: true,
      spacingPreset: 'normal' as const,
    };
    expect(
      globalLayoutSettingsRequireImmediateLayout('all', 'network', current, {
        ...current,
        custom: {
          linkForce: 1,
          folderCohesion: 0.08,
          withinFolderSpacing: 1.15,
          betweenFolderSpacing: 3.2,
          nodeSize: 8,
          referenceDegreeSizeInfluence: 50,
          linkThickness: 0.7,
          labelThreshold: 7,
        },
      }),
    ).toBe(false);
    expect(
      globalLayoutSettingsRequireImmediateLayout('all', 'network', current, {
        ...current,
        custom: {
          linkForce: 1.25,
          folderCohesion: 0.08,
          withinFolderSpacing: 1.15,
          betweenFolderSpacing: 3.2,
          nodeSize: 4.5,
          referenceDegreeSizeInfluence: 50,
          linkThickness: 0.7,
          labelThreshold: 7,
        },
      }),
    ).toBe(true);
    expect(
      globalLayoutSettingsRequireImmediateLayout('focus', 'network', current, {
        ...current,
        folderClustering: false,
      }),
    ).toBe(false);
  });
});
