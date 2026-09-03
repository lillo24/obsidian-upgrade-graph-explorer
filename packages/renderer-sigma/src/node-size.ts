import { isValidNodeSizeScale } from '@icarus-graph-explorer/presentation-overrides';

/** Final display/layout radius bounds, separate from the user multiplier. */
export const NETWORK_NODE_SIZE_RANGE = { min: 2, max: 24 } as const;

/** Auto remains exact. Focus roots cannot shrink below their semantic base. */
export function applyNetworkNodeSizeScale(
  automaticSize: number,
  sizeScale: number | undefined,
  root = false,
): number {
  if (sizeScale === undefined) return automaticSize;
  if (!isValidNodeSizeScale(sizeScale)) {
    throw new Error(
      `Invalid Network node size multiplier: ${String(sizeScale)}.`,
    );
  }
  return Math.min(
    NETWORK_NODE_SIZE_RANGE.max,
    Math.max(
      root ? automaticSize : NETWORK_NODE_SIZE_RANGE.min,
      automaticSize * sizeScale,
    ),
  );
}
