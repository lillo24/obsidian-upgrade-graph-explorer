import type { FocusSchematicPrototypeSettings } from './types';

/** Frozen HIER2 comparison settings. They are global, not fixture-specific. */
export const FOCUS_SCHEMATIC_LAYOUT_SETTINGS = {
  filteredModulePolicy: 'compact-bridge',
  modulePaddingX: 28,
  modulePaddingY: 24,
  diagnosticReserveHeight: 34,
  internalNodeSeparation: 24,
  internalRankSeparation: 48,
  macroNodeSeparation: 36,
  macroRankSeparation: 80,
  // HIER4A review starts from pure A1. Production selection follows approval.
  directionalFolderBandsEnabled: false,
  ranker: 'network-simplex',
} as const satisfies FocusSchematicPrototypeSettings;

export const FOCUS_SCHEMATIC_LAYOUT_CLEARANCE = 16;

/** Interior breathing room between a module edge and its exact band guide. */
export const FOCUS_SCHEMATIC_DIRECTIONAL_FOLDER_BAND_PADDING_Y = 16;

export const FILTERED_MODULE_DIMENSIONS = {
  'compact-bridge': { width: 72, height: 40 },
  'context-card': { width: 200, height: 80 },
} as const;
