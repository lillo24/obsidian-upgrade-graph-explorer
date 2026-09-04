import {
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  resolveNetworkSettings,
} from './settings';
import { DEFAULT_LOCAL_LAYOUT_SETTINGS } from './local-layout';
import type { LocalLayoutSettings } from './local-types';
import type { ResolvedNetworkSettings } from './types';

export const DEFAULT_LOCAL_LABEL_RENDERED_SIZE_THRESHOLD = 4;

export const DEFAULT_RESOLVED_NETWORK_SETTINGS = resolveNetworkSettings(
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
);

export interface LocalNetworkVisualSettings {
  readonly nodeSizeScale: number;
  readonly linkThicknessScale: number;
  readonly labelRenderedSizeThreshold: number;
}

function positiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number.`);
  }
  return value;
}

/** Keeps Local hierarchy physics fixed while adapting shared Reference Pull. */
export function localLayoutSettingsFromNetworkSettings(
  settings: Pick<ResolvedNetworkSettings, 'referencePull'>,
): LocalLayoutSettings {
  return {
    ...DEFAULT_LOCAL_LAYOUT_SETTINGS,
    referenceWeight: positiveFinite(
      settings.referencePull,
      'Network Reference Pull',
    ),
  };
}

/** Converts shared absolute controls into multipliers over the existing Focus defaults. */
export function resolveLocalNetworkVisualSettings(
  settings: ResolvedNetworkSettings,
): LocalNetworkVisualSettings {
  return {
    nodeSizeScale:
      positiveFinite(settings.nodeSize, 'Network Base node size') /
      DEFAULT_RESOLVED_NETWORK_SETTINGS.nodeSize,
    linkThicknessScale:
      positiveFinite(settings.linkThickness, 'Network Link thickness') /
      DEFAULT_RESOLVED_NETWORK_SETTINGS.linkThickness,
    labelRenderedSizeThreshold:
      (positiveFinite(settings.labelThreshold, 'Network Label threshold') /
        DEFAULT_RESOLVED_NETWORK_SETTINGS.labelThreshold) *
      DEFAULT_LOCAL_LABEL_RENDERED_SIZE_THRESHOLD,
  };
}
