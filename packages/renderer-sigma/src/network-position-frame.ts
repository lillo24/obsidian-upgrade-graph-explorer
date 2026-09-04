export interface NetworkPositionPoint {
  readonly x: number;
  readonly y: number;
}

export interface NetworkPositionExtent {
  readonly x: [number, number];
  readonly y: [number, number];
}

/** Raw coordinate frame Sigma should keep after the graph is first presented. */
export function networkPositionExtent(
  positions: readonly NetworkPositionPoint[],
): NetworkPositionExtent {
  if (positions.length === 0) {
    throw new Error('Network position framing requires at least one node.');
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const position of positions) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      throw new Error('Network position framing requires finite coordinates.');
    }
    minX = Math.min(minX, position.x);
    maxX = Math.max(maxX, position.x);
    minY = Math.min(minY, position.y);
    maxY = Math.max(maxY, position.y);
  }
  return { x: [minX, maxX], y: [minY, maxY] };
}
