import { describe, expect, it } from 'vitest';

import type { StorageLike } from '../persistence/storage';

import {
  APPEARANCE_PREFERENCES_STORAGE_KEY,
  loadAppearancePreference,
  saveAppearancePreference,
  serializeAppearancePreference,
} from './appearance-preferences';

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('appearance preferences', () => {
  it.each(['system', 'light', 'dark'] as const)(
    'round-trips the %s preference through the versioned record',
    (preference) => {
      const storage = new MemoryStorage();

      expect(saveAppearancePreference(storage, preference)).toEqual({
        ok: true,
      });
      expect(loadAppearancePreference(storage)).toEqual({
        preference,
        warning: null,
      });
      expect(storage.values.get(APPEARANCE_PREFERENCES_STORAGE_KEY)).toBe(
        serializeAppearancePreference(preference),
      );
    },
  );

  it.each([
    '{not-json',
    JSON.stringify({ version: 2, preference: 'dark' }),
    JSON.stringify({ version: 1, preference: 'sepia' }),
    JSON.stringify({ version: 1, preference: 'dark', extra: true }),
  ])(
    'preserves corrupt or incompatible data and falls back to System',
    (raw) => {
      const storage = new MemoryStorage();
      storage.values.set(APPEARANCE_PREFERENCES_STORAGE_KEY, raw);

      expect(loadAppearancePreference(storage)).toEqual({
        preference: 'system',
        warning: expect.stringContaining('invalid'),
      });
      expect(storage.values.get(APPEARANCE_PREFERENCES_STORAGE_KEY)).toBe(raw);
    },
  );

  it('keeps the session usable when storage cannot be read or written', () => {
    const unavailable: StorageLike = {
      getItem() {
        throw new Error('read denied');
      },
      removeItem() {
        throw new Error('remove denied');
      },
      setItem() {
        throw new Error('quota exceeded');
      },
    };

    expect(loadAppearancePreference(unavailable)).toEqual({
      preference: 'system',
      warning: expect.stringContaining('Could not read'),
    });
    expect(saveAppearancePreference(unavailable, 'dark')).toEqual({
      ok: false,
      message: expect.stringContaining('reset when the app closes'),
    });
  });
});
