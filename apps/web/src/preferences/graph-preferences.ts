import type { TrackpadZoomMode } from '@icarus-graph-explorer/renderer-reactflow';

import type { StorageLike } from '../persistence/storage';

export const GRAPH_PREFERENCES_STORAGE_KEY =
  'icarus.graph-explorer.preferences.v1';

export interface GraphPreferences {
  readonly trackpadZoomMode: TrackpadZoomMode;
}

export const DEFAULT_GRAPH_PREFERENCES: GraphPreferences = {
  trackpadZoomMode: 'scroll-zoom',
};

export interface GraphPreferencesLoadResult {
  readonly preferences: GraphPreferences;
  readonly warning: string | null;
}

export type GraphPreferencesSaveResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

const SESSION_ONLY_WARNING =
  'Could not save this setting; it will reset when the app closes.';

function isTrackpadZoomMode(value: unknown): value is TrackpadZoomMode {
  return value === 'scroll-zoom' || value === 'pinch-zoom';
}

function defaultLoadResult(
  warning: string | null = null,
): GraphPreferencesLoadResult {
  return { preferences: DEFAULT_GRAPH_PREFERENCES, warning };
}

export function loadGraphPreferences(
  storage: StorageLike | undefined,
): GraphPreferencesLoadResult {
  if (storage === undefined) return defaultLoadResult();

  let serialized: string | null;
  try {
    serialized = storage.getItem(GRAPH_PREFERENCES_STORAGE_KEY);
  } catch {
    return defaultLoadResult(
      'Could not read saved graph settings; defaults are active for this session.',
    );
  }
  if (serialized === null) return defaultLoadResult();

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      isTrackpadZoomMode(
        (parsed as { readonly trackpadZoomMode?: unknown }).trackpadZoomMode,
      )
    ) {
      return {
        preferences: {
          trackpadZoomMode: (
            parsed as { readonly trackpadZoomMode: TrackpadZoomMode }
          ).trackpadZoomMode,
        },
        warning: null,
      };
    }
  } catch {
    // A malformed preference is equivalent to an absent preference.
  }
  return defaultLoadResult();
}

export function saveGraphPreferences(
  storage: StorageLike | undefined,
  preferences: GraphPreferences,
): GraphPreferencesSaveResult {
  if (storage === undefined) {
    return { ok: false, message: SESSION_ONLY_WARNING };
  }
  try {
    storage.setItem(GRAPH_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    return { ok: true };
  } catch {
    return { ok: false, message: SESSION_ONLY_WARNING };
  }
}
