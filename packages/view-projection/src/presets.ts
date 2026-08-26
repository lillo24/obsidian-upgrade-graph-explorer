import type { ViewProjectionState } from './types';

export function documentOnlyProjectionState(): ViewProjectionState {
  return {
    disclosure: {
      defaultDepth: 0,
      expandedEntityIds: [],
      collapsedEntityIds: [],
      includeBlocks: false,
    },
  };
}

export function topLevelSectionProjectionState(): ViewProjectionState {
  return {
    disclosure: {
      defaultDepth: 1,
      expandedEntityIds: [],
      collapsedEntityIds: [],
      includeBlocks: false,
    },
  };
}
