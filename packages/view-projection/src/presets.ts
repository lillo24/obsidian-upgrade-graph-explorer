import type { StructuralDepth, ViewProjectionState } from './types';

export function structuralDepthProjectionState(
  defaultDepth: StructuralDepth,
): ViewProjectionState {
  return {
    disclosure: {
      defaultDepth,
      expandedEntityIds: [],
      collapsedEntityIds: [],
      includeBlocks: false,
    },
  };
}

export function documentOnlyProjectionState(): ViewProjectionState {
  return structuralDepthProjectionState(0);
}

export function topLevelSectionProjectionState(): ViewProjectionState {
  return structuralDepthProjectionState(1);
}
