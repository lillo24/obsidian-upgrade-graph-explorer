import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  resolveNetworkSettings,
} from './settings';
import {
  DEFAULT_LOCAL_LABEL_RENDERED_SIZE_THRESHOLD,
  localLayoutSettingsFromNetworkSettings,
  resolveLocalNetworkVisualSettings,
} from './local-network-settings';

describe('Focus adaptation of shared Network settings', () => {
  it('reproduces every current Focus default exactly', () => {
    const network = resolveNetworkSettings(DEFAULT_GLOBAL_LAYOUT_SETTINGS);

    expect(localLayoutSettingsFromNetworkSettings(network)).toEqual({
      hierarchyWeight: 6,
      referenceWeight: 1,
      scalingRatio: 1.35,
    });
    expect(resolveLocalNetworkVisualSettings(network)).toEqual({
      nodeSizeScale: 1,
      linkThicknessScale: 1,
      labelRenderedSizeThreshold: DEFAULT_LOCAL_LABEL_RENDERED_SIZE_THRESHOLD,
    });
  });

  it.each([0.25, 1, 2])(
    'maps Reference Pull %s only to Local reference attraction',
    (referencePull) => {
      const network = {
        ...resolveNetworkSettings(DEFAULT_GLOBAL_LAYOUT_SETTINGS),
        referencePull,
      };

      expect(localLayoutSettingsFromNetworkSettings(network)).toEqual({
        hierarchyWeight: 6,
        referenceWeight: referencePull,
        scalingRatio: 1.35,
      });
    },
  );

  it('scales Focus presentation relative to its established defaults', () => {
    const network = resolveNetworkSettings({
      folderClustering: true,
      spacingPreset: 'normal',
      custom: {
        linkForce: 1,
        folderCohesion: 0.08,
        withinFolderSpacing: 1.15,
        betweenFolderSpacing: 3.2,
        nodeSize: 9,
        referenceDegreeSizeInfluence: 50,
        linkThickness: 1.4,
        labelThreshold: 14,
      },
    });

    expect(resolveLocalNetworkVisualSettings(network)).toEqual({
      nodeSizeScale: 2,
      linkThicknessScale: 2,
      labelRenderedSizeThreshold: 8,
    });
  });
});
