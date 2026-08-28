import { describe, expect, it } from 'vitest';

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
  it('defaults to scroll zoom when storage is absent or empty', () => {
    expect(loadGraphPreferences(undefined)).toEqual({
      preferences: DEFAULT_GRAPH_PREFERENCES,
      warning: null,
    });
    expect(loadGraphPreferences(memoryStorage())).toEqual({
      preferences: DEFAULT_GRAPH_PREFERENCES,
      warning: null,
    });
  });

  it.each(['not-json', '{}', '{"trackpadZoomMode":"unknown"}', 'null'])(
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
    expect(loadGraphPreferences(storage).preferences.trackpadZoomMode).toBe(
      'pinch-zoom',
    );

    expect(
      saveGraphPreferences(storage, { trackpadZoomMode: 'scroll-zoom' }),
    ).toEqual({ ok: true });
    expect(storage.value).toBe('{"trackpadZoomMode":"scroll-zoom"}');
  });

  it('keeps the session usable and returns a visible warning on write failure', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('denied');
    };

    expect(
      saveGraphPreferences(storage, { trackpadZoomMode: 'pinch-zoom' }),
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
