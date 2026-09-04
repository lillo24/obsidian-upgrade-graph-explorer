import { DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH } from '@icarus-graph-explorer/renderer-sigma/local-density-framing';

import {
  DEFAULT_GRAPH_PREFERENCES,
  type GraphPreferences,
} from './graph-preferences';

export interface GraphSandboxReset {
  readonly densityFramingStrength: number;
  readonly preferences: GraphPreferences;
}

/** Resets presentation experiments without touching ordinary or view state. */
export function resetGraphSandbox(
  current: GraphPreferences,
): GraphSandboxReset {
  return {
    densityFramingStrength: DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH,
    preferences: {
      ...current,
      focusAppearance: DEFAULT_GRAPH_PREFERENCES.focusAppearance,
      globalLayoutSettings: DEFAULT_GRAPH_PREFERENCES.globalLayoutSettings,
      showExperimentalAllHierarchy:
        DEFAULT_GRAPH_PREFERENCES.showExperimentalAllHierarchy,
    },
  };
}

export { DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH };
