import { describe, expect, it } from 'vitest';

import {
  customGlobalLayoutSettings,
  DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE,
  resolveNetworkSettings,
} from '@icarus-graph-explorer/renderer-sigma/settings';

import type { StorageLike } from '../persistence/storage';
import {
  DEFAULT_GRAPH_PREFERENCES,
  GRAPH_PREFERENCES_STORAGE_KEY,
  loadGraphPreferences,
  saveGraphPreferences,
} from './graph-preferences';

function memoryStorage(
  initial?: string,
): StorageLike & { value: string | null } {
  return {
    value: initial ?? null,
    getItem(key) {
      expect(key).toBe(GRAPH_PREFERENCES_STORAGE_KEY);
      return this.value;
    },
    removeItem() {
      this.value = null;
    },
    setItem(key, value) {
      expect(key).toBe(GRAPH_PREFERENCES_STORAGE_KEY);
      this.value = value;
    },
  };
}

describe('graph preferences', () => {
  it('defaults to scroll zoom and the inverted focus root when storage is absent or empty', () => {
    expect(loadGraphPreferences(undefined)).toEqual({
      preferences: DEFAULT_GRAPH_PREFERENCES,
      warning: null,
    });
    expect(loadGraphPreferences(memoryStorage())).toEqual({
      preferences: DEFAULT_GRAPH_PREFERENCES,
      warning: null,
    });
  });

  it.each(['not-json', 'null'])(
    'falls back safely for malformed or invalid payload %s',
    (serialized) => {
      expect(loadGraphPreferences(memoryStorage(serialized))).toEqual({
        preferences: DEFAULT_GRAPH_PREFERENCES,
        warning: null,
      });
    },
  );

  it('loads and persists the exact global v1 payload', () => {
    const storage = memoryStorage('{"trackpadZoomMode":"pinch-zoom"}');
    expect(loadGraphPreferences(storage).preferences).toEqual({
      focusAppearance: 'inverted',
      focusHierarchyImplementation: 'classic',
      globalLayoutSettings: DEFAULT_GRAPH_PREFERENCES.globalLayoutSettings,
      localLayoutMode: 'free',
      showExperimentalAllHierarchy: false,
      trackpadZoomMode: 'pinch-zoom',
    });

    expect(
      saveGraphPreferences(storage, {
        focusAppearance: 'minimal',
        focusHierarchyImplementation: 'modular-preview',
        globalLayoutSettings: DEFAULT_GRAPH_PREFERENCES.globalLayoutSettings,
        localLayoutMode: 'free',
        showExperimentalAllHierarchy: false,
        trackpadZoomMode: 'scroll-zoom',
      }),
    ).toEqual({ ok: true });
    expect(storage.value).toBe(
      '{"focusAppearance":"minimal","focusHierarchyImplementation":"modular-preview","globalLayoutSettings":{"folderClustering":true,"spacingPreset":"normal"},"localLayoutMode":"free","showExperimentalAllHierarchy":false,"trackpadZoomMode":"scroll-zoom"}',
    );
  });

  it('restores Structured from the existing preference key without changing Local view schema', () => {
    const storage = memoryStorage(
      '{"localLayoutMode":"structured","trackpadZoomMode":"pinch-zoom"}',
    );

    expect(loadGraphPreferences(storage).preferences).toMatchObject({
      localLayoutMode: 'structured',
      trackpadZoomMode: 'pinch-zoom',
    });
    expect(
      saveGraphPreferences(storage, {
        ...DEFAULT_GRAPH_PREFERENCES,
        localLayoutMode: 'structured',
      }),
    ).toEqual({ ok: true });
    expect(storage.value).toContain('"localLayoutMode":"structured"');
  });

  it('falls back each invalid v1 field independently without changing the key', () => {
    expect(
      loadGraphPreferences(
        memoryStorage(
          '{"focusAppearance":"unknown","trackpadZoomMode":"pinch-zoom"}',
        ),
      ).preferences,
    ).toEqual({
      focusAppearance: 'inverted',
      focusHierarchyImplementation: 'classic',
      globalLayoutSettings: DEFAULT_GRAPH_PREFERENCES.globalLayoutSettings,
      localLayoutMode: 'free',
      showExperimentalAllHierarchy: false,
      trackpadZoomMode: 'pinch-zoom',
    });
    expect(
      loadGraphPreferences(
        memoryStorage(
          '{"focusAppearance":"inverted","trackpadZoomMode":"unknown"}',
        ),
      ).preferences,
    ).toEqual({
      focusAppearance: 'inverted',
      focusHierarchyImplementation: 'classic',
      globalLayoutSettings: DEFAULT_GRAPH_PREFERENCES.globalLayoutSettings,
      localLayoutMode: 'free',
      showExperimentalAllHierarchy: false,
      trackpadZoomMode: 'scroll-zoom',
    });
  });

  it('restores serializable Global layout settings and bounds invalid values', () => {
    const valid = loadGraphPreferences(
      memoryStorage(
        JSON.stringify({
          globalLayoutSettings: {
            folderClustering: false,
            spacingPreset: 'spacious',
          },
        }),
      ),
    );
    expect(valid.preferences.globalLayoutSettings).toEqual({
      folderClustering: false,
      spacingPreset: 'spacious',
    });

    const invalid = loadGraphPreferences(
      memoryStorage(
        JSON.stringify({
          globalLayoutSettings: {
            folderClustering: true,
            spacingPreset: 'normal',
            custom: {
              linkForce: 1,
              folderCohesion: 99,
              withinFolderSpacing: 1,
              betweenFolderSpacing: 3,
              nodeSize: 4,
              linkThickness: 1,
              labelThreshold: 7,
            },
          },
        }),
      ),
    );
    expect(invalid.preferences.globalLayoutSettings).toBe(
      DEFAULT_GRAPH_PREFERENCES.globalLayoutSettings,
    );
  });

  it('normalizes a legacy custom v1 payload without discarding its values', () => {
    const legacyCustom = {
      linkForce: 1.25,
      folderCohesion: 0.06,
      withinFolderSpacing: 1.4,
      betweenFolderSpacing: 4,
      nodeSize: 6,
      linkThickness: 1.2,
      labelThreshold: 9,
    };
    const loaded = loadGraphPreferences(
      memoryStorage(
        JSON.stringify({
          globalLayoutSettings: {
            folderClustering: false,
            spacingPreset: 'normal',
            custom: legacyCustom,
          },
        }),
      ),
    );

    expect(loaded.warning).toBeNull();
    expect(loaded.preferences.globalLayoutSettings).toEqual({
      folderClustering: false,
      spacingPreset: 'normal',
      custom: {
        ...legacyCustom,
        referenceDegreeSizeInfluence: DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE,
      },
    });
  });

  it('round-trips shared Network settings through the unchanged v1 record', () => {
    const storage = memoryStorage();
    const globalLayoutSettings = {
      folderClustering: true,
      spacingPreset: 'compact' as const,
      custom: {
        ...customGlobalLayoutSettings('compact'),
        linkForce: 1.6,
        nodeSize: 7.5,
        referenceDegreeSizeInfluence: 82,
        linkThickness: 1.35,
        labelThreshold: 10.5,
      },
    };

    expect(
      saveGraphPreferences(storage, {
        ...DEFAULT_GRAPH_PREFERENCES,
        globalLayoutSettings,
      }),
    ).toEqual({ ok: true });
    const restored =
      loadGraphPreferences(storage).preferences.globalLayoutSettings;
    expect(restored).toEqual(globalLayoutSettings);
    expect(resolveNetworkSettings(restored)).toEqual({
      referencePull: 1.6,
      nodeSize: 7.5,
      linkThickness: 1.35,
      labelThreshold: 10.5,
    });
    expect(storage.value).toContain('"referenceDegreeSizeInfluence":82');
    expect(storage.value).toContain('"linkForce":1.6');
  });

  it('falls back only Global settings when persisted influence is malformed', () => {
    const invalid = loadGraphPreferences(
      memoryStorage(
        JSON.stringify({
          focusAppearance: 'minimal',
          globalLayoutSettings: {
            folderClustering: true,
            spacingPreset: 'normal',
            custom: {
              ...customGlobalLayoutSettings('normal'),
              referenceDegreeSizeInfluence: 101,
            },
          },
        }),
      ),
    );

    expect(invalid.preferences.focusAppearance).toBe('minimal');
    expect(invalid.preferences.globalLayoutSettings).toBe(
      DEFAULT_GRAPH_PREFERENCES.globalLayoutSettings,
    );
  });

  it('keeps the session usable and returns a visible warning on write failure', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('denied');
    };

    expect(
      saveGraphPreferences(storage, {
        focusAppearance: 'inverted',
        focusHierarchyImplementation: 'classic',
        globalLayoutSettings: DEFAULT_GRAPH_PREFERENCES.globalLayoutSettings,
        localLayoutMode: 'free',
        showExperimentalAllHierarchy: false,
        trackpadZoomMode: 'pinch-zoom',
      }),
    ).toEqual({
      ok: false,
      message:
        'Could not save this setting; it will reset when the app closes.',
    });
  });

  it('falls back with a warning when storage cannot be read', () => {
    const storage = memoryStorage();
    storage.getItem = () => {
      throw new Error('denied');
    };
    expect(loadGraphPreferences(storage)).toEqual({
      preferences: DEFAULT_GRAPH_PREFERENCES,
      warning:
        'Could not read saved graph settings; defaults are active for this session.',
    });
  });
});

describe('Modular Focus Hierarchy preview preference compatibility', () => {
  it.each([undefined, null, false, true, 1, 'modular', {}, []])(
    'defaults malformed/absent field %j to Classic',
    (field) => {
      const storage = memoryStorage(
        JSON.stringify({
          focusHierarchyImplementation: field,
          focusAppearance: 'minimal',
        }),
      );
      expect(loadGraphPreferences(storage).preferences).toMatchObject({
        focusHierarchyImplementation: 'classic',
        focusAppearance: 'minimal',
      });
    },
  );

  it.each(['classic', 'modular-preview'] as const)(
    'round trips %s under the unchanged v1 key',
    (implementation) => {
      const storage = memoryStorage();
      expect(
        saveGraphPreferences(storage, {
          ...DEFAULT_GRAPH_PREFERENCES,
          focusHierarchyImplementation: implementation,
        }).ok,
      ).toBe(true);
      expect(
        loadGraphPreferences(storage).preferences.focusHierarchyImplementation,
      ).toBe(implementation);
    },
  );

  it('retains the implementation when another preference is saved', () => {
    const storage = memoryStorage(
      '{"focusHierarchyImplementation":"modular-preview"}',
    );
    const current = loadGraphPreferences(storage).preferences;
    saveGraphPreferences(storage, {
      ...current,
      trackpadZoomMode: 'pinch-zoom',
    });
    expect(loadGraphPreferences(storage).preferences).toMatchObject({
      focusHierarchyImplementation: 'modular-preview',
      trackpadZoomMode: 'pinch-zoom',
    });
  });
});

describe('Experimental All Hierarchy preference compatibility', () => {
  it.each([undefined, null, 0, 1, 'true', {}, [], false])(
    'defaults malformed/absent field %j to Off',
    (field) => {
      const storage = memoryStorage(
        JSON.stringify({
          showExperimentalAllHierarchy: field,
          focusAppearance: 'minimal',
        }),
      );
      expect(loadGraphPreferences(storage).preferences).toMatchObject({
        showExperimentalAllHierarchy: false,
        focusAppearance: 'minimal',
      });
    },
  );
  it('round trips true and false under the unchanged v1 key', () => {
    const storage = memoryStorage();
    for (const show of [true, false]) {
      expect(
        saveGraphPreferences(storage, {
          ...DEFAULT_GRAPH_PREFERENCES,
          showExperimentalAllHierarchy: show,
        }).ok,
      ).toBe(true);
      expect(
        loadGraphPreferences(storage).preferences.showExperimentalAllHierarchy,
      ).toBe(show);
    }
    expect(GRAPH_PREFERENCES_STORAGE_KEY).toBe(
      'icarus.graph-explorer.preferences.v1',
    );
  });
  it('retains the experimental field when another setting patches the complete record', () => {
    const storage = memoryStorage('{"showExperimentalAllHierarchy":true}');
    const current = loadGraphPreferences(storage).preferences;
    saveGraphPreferences(storage, {
      ...current,
      trackpadZoomMode: 'pinch-zoom',
    });
    expect(loadGraphPreferences(storage).preferences).toMatchObject({
      showExperimentalAllHierarchy: true,
      trackpadZoomMode: 'pinch-zoom',
    });
  });
});
