import { DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH } from '@icarus-graph-explorer/renderer-sigma/local-density-framing';
import { DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH } from '@icarus-graph-explorer/renderer-sigma/global-density-framing';

import {
  DEFAULT_GRAPH_PREFERENCES,
  type GraphPreferences,
} from './graph-preferences';

export interface GraphSandboxReset {
  readonly allNetworkDensityFramingStrength: number;
  readonly focusNetworkDensityFramingStrength: number;
  readonly preferences: GraphPreferences;
}

/** Resets presentation experiments without touching ordinary or view state. */
export function resetGraphSandbox(
  current: GraphPreferences,
): GraphSandboxReset {
  return {
    allNetworkDensityFramingStrength: DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH,
    focusNetworkDensityFramingStrength: DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH,
    preferences: {
      ...current,
      focusAppearance: DEFAULT_GRAPH_PREFERENCES.focusAppearance,
      focusHierarchyImplementation:
        DEFAULT_GRAPH_PREFERENCES.focusHierarchyImplementation,
      globalLayoutSettings: DEFAULT_GRAPH_PREFERENCES.globalLayoutSettings,
      modularFocusInternalLayout:
        DEFAULT_GRAPH_PREFERENCES.modularFocusInternalLayout,
      modularFocusHeadingOrder:
        DEFAULT_GRAPH_PREFERENCES.modularFocusHeadingOrder,
      modularFocusMacroLayout:
        DEFAULT_GRAPH_PREFERENCES.modularFocusMacroLayout,
      modularFocusSoftFolderStrength:
        DEFAULT_GRAPH_PREFERENCES.modularFocusSoftFolderStrength,
      modularFolderStripsVisible:
        DEFAULT_GRAPH_PREFERENCES.modularFolderStripsVisible,
      modularConnectionStyle: DEFAULT_GRAPH_PREFERENCES.modularConnectionStyle,
      showExperimentalAllHierarchy:
        DEFAULT_GRAPH_PREFERENCES.showExperimentalAllHierarchy,
    },
  };
}

export {
  DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH,
  DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH,
};
