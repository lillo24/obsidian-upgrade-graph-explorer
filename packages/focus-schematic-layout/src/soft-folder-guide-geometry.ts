import type { FocusSchematicRectangle } from '@icarus-graph-explorer/focus-schematic';

export const FOCUS_SCHEMATIC_SOFT_FOLDER_GUIDE_PADDING = 24;
export const FOCUS_SCHEMATIC_SOFT_FOLDER_GUIDE_ISLAND_GAP = 216;

export interface FocusSchematicSoftFolderGuidePoint {
  readonly x: number;
  readonly y: number;
}

export interface FocusSchematicSoftFolderGuideUnit extends FocusSchematicRectangle {
  readonly id: string;
}

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function rectangleGap(
  left: FocusSchematicRectangle,
  right: FocusSchematicRectangle,
): number {
  const dx = Math.max(
    0,
    left.x - (right.x + right.width),
    right.x - (left.x + left.width),
  );
  const dy = Math.max(
    0,
    left.y - (right.y + right.height),
    right.y - (left.y + left.height),
  );
  return Math.hypot(dx, dy);
}

function cross(
  origin: FocusSchematicSoftFolderGuidePoint,
  left: FocusSchematicSoftFolderGuidePoint,
  right: FocusSchematicSoftFolderGuidePoint,
): number {
  return (
    (left.x - origin.x) * (right.y - origin.y) -
    (left.y - origin.y) * (right.x - origin.x)
  );
}

export function focusSchematicSoftFolderGuideConvexHull(
  points: readonly FocusSchematicSoftFolderGuidePoint[],
): readonly FocusSchematicSoftFolderGuidePoint[] {
  const ordered = [...points].sort(
    (left, right) => left.x - right.x || left.y - right.y,
  );
  const unique = ordered.filter(
    (point, index) =>
      index === 0 ||
      point.x !== ordered[index - 1]!.x ||
      point.y !== ordered[index - 1]!.y,
  );
  if (unique.length <= 2) return unique;
  const lower: FocusSchematicSoftFolderGuidePoint[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0)
      lower.pop();
    lower.push(point);
  }
  const upper: FocusSchematicSoftFolderGuidePoint[] = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0)
      upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function focusSchematicSoftFolderGuidePointInsidePolygon(
  point: FocusSchematicSoftFolderGuidePoint,
  polygon: readonly FocusSchematicSoftFolderGuidePoint[],
): boolean {
  const onSegment = (
    left: FocusSchematicSoftFolderGuidePoint,
    right: FocusSchematicSoftFolderGuidePoint,
  ) => {
    const crossProduct =
      (point.x - left.x) * (right.y - left.y) -
      (point.y - left.y) * (right.x - left.x);
    return (
      Math.abs(crossProduct) <= 1e-7 &&
      point.x >= Math.min(left.x, right.x) &&
      point.x <= Math.max(left.x, right.x) &&
      point.y >= Math.min(left.y, right.y) &&
      point.y <= Math.max(left.y, right.y)
    );
  };
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const left = polygon[index]!;
    const right = polygon[previous]!;
    if (onSegment(left, right)) return true;
    if (
      left.y > point.y !== right.y > point.y &&
      point.x <
        ((right.x - left.x) * (point.y - left.y)) / (right.y - left.y) + left.x
    )
      inside = !inside;
  }
  return inside;
}

export function focusSchematicSoftFolderGuidePaddedCorners(
  unit: FocusSchematicRectangle,
): readonly FocusSchematicSoftFolderGuidePoint[] {
  const left = unit.x - FOCUS_SCHEMATIC_SOFT_FOLDER_GUIDE_PADDING;
  const top = unit.y - FOCUS_SCHEMATIC_SOFT_FOLDER_GUIDE_PADDING;
  const right = unit.x + unit.width + FOCUS_SCHEMATIC_SOFT_FOLDER_GUIDE_PADDING;
  const bottom =
    unit.y + unit.height + FOCUS_SCHEMATIC_SOFT_FOLDER_GUIDE_PADDING;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function connectionSwallowsBlocker(
  left: FocusSchematicSoftFolderGuideUnit,
  right: FocusSchematicSoftFolderGuideUnit,
  blockers: readonly FocusSchematicSoftFolderGuideUnit[],
): boolean {
  const envelope = focusSchematicSoftFolderGuideConvexHull([
    ...focusSchematicSoftFolderGuidePaddedCorners(left),
    ...focusSchematicSoftFolderGuidePaddedCorners(right),
  ]);
  return blockers.some((blocker) =>
    focusSchematicSoftFolderGuidePointInsidePolygon(
      {
        x: blocker.x + blocker.width / 2,
        y: blocker.y + blocker.height / 2,
      },
      envelope,
    ),
  );
}

/** Pure layout/renderer oracle for the folder-guide island partition. */
export function partitionFocusSchematicSoftFolderGuideIslands<
  Unit extends FocusSchematicSoftFolderGuideUnit,
>(
  units: readonly Unit[],
  blockers: readonly FocusSchematicSoftFolderGuideUnit[],
): readonly (readonly Unit[])[] {
  const ordered = [...units].sort((left, right) =>
    compareText(left.id, right.id),
  );
  const remaining = new Set(ordered.map(({ id }) => id));
  const byId = new Map(ordered.map((item) => [item.id, item]));
  const islands: Unit[][] = [];
  for (const seed of ordered) {
    if (!remaining.delete(seed.id)) continue;
    const island: Unit[] = [];
    const pending = [seed];
    while (pending.length > 0) {
      const current = pending.shift()!;
      island.push(current);
      for (const candidateId of [...remaining].sort(compareText)) {
        const candidate = byId.get(candidateId)!;
        if (
          rectangleGap(current, candidate) >
            FOCUS_SCHEMATIC_SOFT_FOLDER_GUIDE_ISLAND_GAP ||
          connectionSwallowsBlocker(current, candidate, blockers)
        )
          continue;
        remaining.delete(candidateId);
        pending.push(candidate);
      }
    }
    islands.push(
      island.sort(
        (left, right) =>
          left.y - right.y ||
          left.x - right.x ||
          compareText(left.id, right.id),
      ),
    );
  }
  return islands.sort((left, right) => {
    const leftY = Math.min(...left.map(({ y }) => y));
    const rightY = Math.min(...right.map(({ y }) => y));
    const leftX = Math.min(...left.map(({ x }) => x));
    const rightX = Math.min(...right.map(({ x }) => x));
    return leftY - rightY || leftX - rightX;
  });
}
