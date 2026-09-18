import {
  isThemePreference,
  type ThemePreference,
} from '@icarus-graph-explorer/theme';

import type { StorageLike } from '../persistence/storage';

export const APPEARANCE_PREFERENCES_STORAGE_KEY =
  'icarus.graph-explorer.appearance.v1';
export const APPEARANCE_PREFERENCES_SCHEMA_VERSION = 1;
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

interface StoredAppearancePreferences {
  readonly version: typeof APPEARANCE_PREFERENCES_SCHEMA_VERSION;
  readonly preference: ThemePreference;
}

export interface AppearancePreferenceLoadResult {
  readonly preference: ThemePreference;
  readonly warning: string | null;
}

export type AppearancePreferenceSaveResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredAppearancePreferences(
  value: unknown,
): value is StoredAppearancePreferences {
  if (!isPlainRecord(value)) return false;
  const keys = Object.keys(value).sort();
  return (
    keys.length === 2 &&
    keys[0] === 'preference' &&
    keys[1] === 'version' &&
    value.version === APPEARANCE_PREFERENCES_SCHEMA_VERSION &&
    isThemePreference(value.preference)
  );
}

export function serializeAppearancePreference(
  preference: ThemePreference,
): string {
  if (!isThemePreference(preference)) {
    throw new Error('Appearance preference is invalid.');
  }
  return JSON.stringify({
    version: APPEARANCE_PREFERENCES_SCHEMA_VERSION,
    preference,
  } satisfies StoredAppearancePreferences);
}

export function loadAppearancePreference(
  storage: StorageLike | undefined,
): AppearancePreferenceLoadResult {
  if (storage === undefined) {
    return {
      preference: DEFAULT_THEME_PREFERENCE,
      warning:
        'Appearance settings are unavailable; System is active for this session.',
    };
  }

  let serialized: string | null;
  try {
    serialized = storage.getItem(APPEARANCE_PREFERENCES_STORAGE_KEY);
  } catch {
    return {
      preference: DEFAULT_THEME_PREFERENCE,
      warning:
        'Could not read the saved appearance setting; System is active for this session.',
    };
  }
  if (serialized === null) {
    return { preference: DEFAULT_THEME_PREFERENCE, warning: null };
  }

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (isStoredAppearancePreferences(parsed)) {
      return { preference: parsed.preference, warning: null };
    }
  } catch {
    // Corrupt data is preserved and treated as an unavailable preference.
  }
  return {
    preference: DEFAULT_THEME_PREFERENCE,
    warning:
      'The saved appearance setting is invalid; System is active for this session.',
  };
}

export function saveAppearancePreference(
  storage: StorageLike | undefined,
  preference: ThemePreference,
): AppearancePreferenceSaveResult {
  if (storage === undefined) {
    return {
      ok: false,
      message:
        'Could not save the appearance setting; it will reset when the app closes.',
    };
  }
  try {
    storage.setItem(
      APPEARANCE_PREFERENCES_STORAGE_KEY,
      serializeAppearancePreference(preference),
    );
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        'Could not save the appearance setting; it will reset when the app closes.',
    };
  }
}
