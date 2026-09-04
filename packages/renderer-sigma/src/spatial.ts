import {
  applyResolvedFolderPlacements,
  applyFolderClusterAnchors,
  resolveFolderSpatialRules,
  type FolderClusterAnchorMap,
  type FolderSpatialRule,
  type ResolvedFolderSpatialRules,
  type SpatialCompositionResult,
  type SpatialPosition,
} from '@icarus-graph-explorer/spatial-overrides';

import type { GlobalRendererInput } from './types';

/** Sigma 3.0.3 maps positive graph Y upward in viewport coordinates. */
export const SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN = -1 as const;

export function globalFolderKeyByNodeKey(
  input: GlobalRendererInput,
): ReadonlyMap<string, string> {
  return new Map(
    input.nodes.flatMap((node) =>
      node.attributes.nodeKind === 'document' &&
      node.attributes.folderKey !== null
        ? [[node.key, node.attributes.folderKey] as const]
        : [],
    ),
  );
}

export function composeGlobalSpatialOverrides(
  automaticPositions: readonly SpatialPosition[],
  input: GlobalRendererInput,
  anchors: FolderClusterAnchorMap,
): SpatialCompositionResult {
  return applyFolderClusterAnchors({
    automaticPositions,
    folderKeyByNodeKey: globalFolderKeyByNodeKey(input),
    anchors,
    visualDownGraphYSign: SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
  });
}

export function resolveGlobalFolderSpatialRules(
  input: GlobalRendererInput,
  rules: readonly FolderSpatialRule[],
): ResolvedFolderSpatialRules {
  return resolveFolderSpatialRules({
    rules,
    folderKeyByNodeKey: globalFolderKeyByNodeKey(input),
  });
}

export function composeGlobalFolderSpatialRules(
  baseAutomaticPositions: readonly SpatialPosition[],
  dynamicPositions: readonly SpatialPosition[],
  input: GlobalRendererInput,
  resolved: ResolvedFolderSpatialRules,
): SpatialCompositionResult {
  return applyResolvedFolderPlacements({
    baseAutomaticPositions,
    currentPositions: dynamicPositions,
    documentNodeKeys: globalFolderKeyByNodeKey(input).keys(),
    resolved,
    visualDownGraphYSign: SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
  });
}
