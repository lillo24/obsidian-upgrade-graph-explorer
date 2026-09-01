import type {
  FocusAppearance,
  TrackpadZoomMode,
} from '@icarus-graph-explorer/renderer-reactflow';
import {
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  validateGlobalLayoutSettings,
  type GlobalLayoutSettings,
} from '@icarus-graph-explorer/renderer-sigma/settings';
import type { LocalLayoutMode } from '@icarus-graph-explorer/view-state';

import type { StorageLike } from '../persistence/storage';

export const GRAPH_PREFERENCES_STORAGE_KEY =
  'icarus.graph-explorer.preferences.v1';

export interface GraphPreferences {
  readonly focusAppearance: FocusAppearance;
  readonly globalLayoutSettings: GlobalLayoutSettings;
  readonly localLayoutMode: LocalLayoutMode;
  readonly trackpadZoomMode: TrackpadZoomMode;
}

export const DEFAULT_GRAPH_PREFERENCES: GraphPreferences = {
  focusAppearance: 'inverted',
  globalLayoutSettings: DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  localLayoutMode: 'free',
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

function isFocusAppearance(value: unknown): value is FocusAppearance {
  return value === 'outline' || value === 'inverted' || value === 'minimal';
}

function isLocalLayoutMode(value: unknown): value is LocalLayoutMode {
  return value === 'free' || value === 'structured';
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
    if (typeof parsed === 'object' && parsed !== null) {
      const stored = parsed as {
        readonly focusAppearance?: unknown;
        readonly globalLayoutSettings?: unknown;
        readonly localLayoutMode?: unknown;
        readonly trackpadZoomMode?: unknown;
      };
      let globalLayoutSettings = DEFAULT_GLOBAL_LAYOUT_SETTINGS;
      if (stored.globalLayoutSettings !== undefined) {
        try {
          globalLayoutSettings = validateGlobalLayoutSettings(
            stored.globalLayoutSettings,
          );
        } catch {
          globalLayoutSettings = DEFAULT_GLOBAL_LAYOUT_SETTINGS;
        }
      }
      return {
        preferences: {
          focusAppearance: isFocusAppearance(stored.focusAppearance)
            ? stored.focusAppearance
            : DEFAULT_GRAPH_PREFERENCES.focusAppearance,
          globalLayoutSettings,
          // KG13B2A implements Free only. A persisted future Structured value
          // remains a valid preference seam but falls back until B2B ships.
          localLayoutMode:
            isLocalLayoutMode(stored.localLayoutMode) &&
            stored.localLayoutMode === 'free'
              ? stored.localLayoutMode
              : DEFAULT_GRAPH_PREFERENCES.localLayoutMode,
          trackpadZoomMode: isTrackpadZoomMode(stored.trackpadZoomMode)
            ? stored.trackpadZoomMode
            : DEFAULT_GRAPH_PREFERENCES.trackpadZoomMode,
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
