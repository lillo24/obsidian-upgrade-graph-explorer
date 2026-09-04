import { describe, expect, it } from 'vitest';

import {
  customGlobalLayoutSettings,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
} from '@icarus-graph-explorer/renderer-sigma/settings';

import { DEFAULT_GRAPH_PREFERENCES } from './graph-preferences';
import {
  DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH,
  resetGraphSandbox,
} from './sandbox-settings';

describe('Settings Sandbox reset', () => {
  it('resets only Sandbox-owned presentation controls', () => {
    const reset = resetGraphSandbox({
      focusAppearance: 'minimal',
      globalLayoutSettings: {
        folderClustering: false,
        spacingPreset: 'spacious',
        custom: customGlobalLayoutSettings('spacious'),
      },
      localLayoutMode: 'structured',
      showExperimentalAllHierarchy: true,
      trackpadZoomMode: 'pinch-zoom',
    });

    expect(reset).toEqual({
      densityFramingStrength: 100,
      preferences: {
        focusAppearance: DEFAULT_GRAPH_PREFERENCES.focusAppearance,
        globalLayoutSettings: DEFAULT_GLOBAL_LAYOUT_SETTINGS,
        localLayoutMode: 'structured',
        showExperimentalAllHierarchy: false,
        trackpadZoomMode: 'pinch-zoom',
      },
    });
    expect(DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH).toBe(100);
  });
});
