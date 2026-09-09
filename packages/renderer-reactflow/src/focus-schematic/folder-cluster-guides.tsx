import { useMemo, useState } from 'react';
import { ViewportPortal } from '@xyflow/react';
import type {
  FocusSchematicSoftFolderDisplayTree,
  FocusSchematicSoftFolderDisplayNode,
} from '@icarus-graph-explorer/focus-schematic-layout';

import type { GraphFlowNode } from '../types';

const GUIDE_PADDING = 24;
const GUIDE_CORNER_RADIUS = 18;
const GUIDE_ISLAND_GAP = 216;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface GuideUnit {
  readonly id: string;
  readonly memberModuleIds: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FocusSchematicFolderClusterGuide {
  readonly folderKey: string;
  readonly parentFolderKey: string | null;
  readonly siblingFolderKeys: readonly string[];
  readonly suppressedAncestorFolderKeys: readonly string[];
  readonly label: string;
  readonly root: boolean;
  readonly depth: number;
  readonly regionIndex: number;
  readonly regionCount: number;
  readonly shape: 'singleton' | 'capsule' | 'hull';
  readonly memberModuleIds: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly path: string | null;
  readonly labelX: number;
  readonly labelY: number;
}

export interface FocusSchematicFolderGuideContextRequest {
  readonly folderKey: string;
  readonly x: number;
  readonly y: number;
  readonly origin: HTMLElement | null;
}

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function folderLabel(folderKey: string): string {
  return folderKey === '.' ? 'Root folder' : folderKey;
}

function rectangleSize(
  node: GraphFlowNode,
): { readonly width: number; readonly height: number } | undefined {
  const width = node.width ?? node.measured?.width;
  const height = node.height ?? node.measured?.height;
  return width === undefined ||
    height === undefined ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
    ? undefined
    : { width, height };
}

function rectangleGap(left: GuideUnit, right: GuideUnit): number {
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

function cross(origin: Point, left: Point, right: Point): number {
  return (
    (left.x - origin.x) * (right.y - origin.y) -
    (left.y - origin.y) * (right.x - origin.x)
  );
}

function convexHull(points: readonly Point[]): readonly Point[] {
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
  const lower: Point[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0)
      lower.pop();
    lower.push(point);
  }
  const upper: Point[] = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0)
      upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function pointInsidePolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const left = polygon[index]!;
    const right = polygon[previous]!;
    if (
      left.y > point.y !== right.y > point.y &&
      point.x <
        ((right.x - left.x) * (point.y - left.y)) / (right.y - left.y) + left.x
    )
      inside = !inside;
  }
  return inside;
}

function paddedCorners(unit: GuideUnit): readonly Point[] {
  const left = unit.x - GUIDE_PADDING;
  const top = unit.y - GUIDE_PADDING;
  const right = unit.x + unit.width + GUIDE_PADDING;
  const bottom = unit.y + unit.height + GUIDE_PADDING;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function connectionSwallowsBlocker(
  left: GuideUnit,
  right: GuideUnit,
  blockers: readonly GuideUnit[],
): boolean {
  const envelope = convexHull([
    ...paddedCorners(left),
    ...paddedCorners(right),
  ]);
  return blockers.some((blocker) =>
    pointInsidePolygon(
      {
        x: blocker.x + blocker.width / 2,
        y: blocker.y + blocker.height / 2,
      },
      envelope,
    ),
  );
}

function splitIntoIslands(
  units: readonly GuideUnit[],
  blockers: readonly GuideUnit[],
): readonly (readonly GuideUnit[])[] {
  const ordered = [...units].sort((left, right) =>
    compareText(left.id, right.id),
  );
  const remaining = new Set(ordered.map(({ id }) => id));
  const byId = new Map(ordered.map((item) => [item.id, item]));
  const islands: GuideUnit[][] = [];
  for (const seed of ordered) {
    if (!remaining.delete(seed.id)) continue;
    const island: GuideUnit[] = [];
    const pending = [seed];
    while (pending.length > 0) {
      const current = pending.shift()!;
      island.push(current);
      for (const candidateId of [...remaining].sort(compareText)) {
        const candidate = byId.get(candidateId)!;
        if (
          rectangleGap(current, candidate) > GUIDE_ISLAND_GAP ||
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

function toward(from: Point, to: Point, distance: number): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length === 0) return from;
  const ratio = Math.min(0.5, distance / length);
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

function roundedPolygonPath(points: readonly Point[], radius: number): string {
  if (points.length < 3) return '';
  const entries = points.map((point, index) => {
    const previous = points[(index + points.length - 1) % points.length]!;
    const next = points[(index + 1) % points.length]!;
    return {
      point,
      start: toward(point, previous, radius),
      end: toward(point, next, radius),
    };
  });
  const last = entries.at(-1)!;
  return [
    `M ${last.end.x} ${last.end.y}`,
    ...entries.flatMap(({ point, start, end }) => [
      `L ${start.x} ${start.y}`,
      `Q ${point.x} ${point.y} ${end.x} ${end.y}`,
    ]),
    'Z',
  ].join(' ');
}

function folderDepth(
  folder: FocusSchematicSoftFolderDisplayNode,
  byKey: ReadonlyMap<string, FocusSchematicSoftFolderDisplayNode>,
): number {
  let depth = 0;
  let current = folder.displayParentFolderKey;
  while (current !== null) {
    depth += 1;
    current = byKey.get(current)?.displayParentFolderKey ?? null;
  }
  return depth;
}

function guideForIsland(
  folder: FocusSchematicSoftFolderDisplayNode,
  byKey: ReadonlyMap<string, FocusSchematicSoftFolderDisplayNode>,
  regionIndex: number,
  regionCount: number,
  units: readonly GuideUnit[],
): FocusSchematicFolderClusterGuide {
  const memberModuleIds = [
    ...new Set(units.flatMap(({ memberModuleIds }) => memberModuleIds)),
  ].sort(compareText);
  const hull = convexHull(units.flatMap(paddedCorners));
  const x = Math.min(...hull.map((point) => point.x));
  const y = Math.min(...hull.map((point) => point.y));
  const right = Math.max(...hull.map((point) => point.x));
  const bottom = Math.max(...hull.map((point) => point.y));
  const shape =
    units.length === 1 ? 'singleton' : units.length === 2 ? 'capsule' : 'hull';
  const siblings = [
    ...(byKey.get(folder.displayParentFolderKey ?? '')?.childFolderKeys ?? []),
  ]
    .filter((key) => key !== folder.folderKey)
    .sort(compareText);
  return {
    folderKey: folder.folderKey,
    parentFolderKey: folder.displayParentFolderKey,
    siblingFolderKeys: siblings,
    suppressedAncestorFolderKeys: folder.suppressedAncestorFolderKeys,
    label: folderLabel(folder.folderKey),
    root: folder.folderKey === '.',
    depth: folderDepth(folder, byKey),
    regionIndex,
    regionCount,
    shape,
    memberModuleIds,
    x,
    y,
    width: right - x,
    height: bottom - y,
    radius: GUIDE_CORNER_RADIUS,
    path:
      shape === 'singleton'
        ? null
        : roundedPolygonPath(hull, GUIDE_CORNER_RADIUS),
    labelX: x + 12,
    labelY: y - 9,
  };
}

/** Builds child regions first, then encloses them with their logical parent. */
export function focusSchematicFolderClusterGuides(
  tree: FocusSchematicSoftFolderDisplayTree,
  nodes: readonly GraphFlowNode[],
): readonly FocusSchematicFolderClusterGuide[] {
  const rectangleByModuleId = new Map<string, GuideUnit>();
  for (const node of nodes) {
    if (node.type !== 'module') continue;
    const size = rectangleSize(node);
    if (size === undefined) continue;
    rectangleByModuleId.set(node.data.moduleId, {
      id: `file:${node.data.moduleId}`,
      memberModuleIds: [node.data.moduleId],
      x: node.position.x,
      y: node.position.y,
      ...size,
    });
  }
  const byKey = new Map(
    tree.folders.map((folder) => [folder.folderKey, folder]),
  );
  const guidesByFolder = new Map<string, FocusSchematicFolderClusterGuide[]>();
  const ordered = [...tree.folders].sort(
    (left, right) =>
      folderDepth(right, byKey) - folderDepth(left, byKey) ||
      compareText(left.folderKey, right.folderKey),
  );
  for (const folder of ordered) {
    const direct = folder.directFileIds.flatMap((fileId) => {
      const rectangle = rectangleByModuleId.get(fileId);
      return rectangle === undefined ? [] : [rectangle];
    });
    const children = folder.childFolderKeys.flatMap((childKey) =>
      (guidesByFolder.get(childKey) ?? []).map((guide) => ({
        id: `folder:${childKey}:${guide.regionIndex}`,
        memberModuleIds: guide.memberModuleIds,
        x: guide.x,
        y: guide.y,
        width: guide.width,
        height: guide.height,
      })),
    );
    const units = [...direct, ...children];
    // Workspace root is structural unless it contains a directly displayed File.
    if (
      units.length === 0 ||
      (folder.folderKey === '.' && direct.length === 0)
    ) {
      guidesByFolder.set(folder.folderKey, []);
      continue;
    }
    const descendants = new Set(folder.descendantFileIds);
    const blockers = [...rectangleByModuleId]
      .filter(([moduleId]) => !descendants.has(moduleId))
      .map(([, rectangle]) => rectangle);
    const islands = splitIntoIslands(units, blockers);
    guidesByFolder.set(
      folder.folderKey,
      islands.map((island, regionIndex) =>
        guideForIsland(folder, byKey, regionIndex, islands.length, island),
      ),
    );
  }
  return [...guidesByFolder.values()]
    .flat()
    .sort(
      (left, right) =>
        left.depth - right.depth ||
        compareText(left.folderKey, right.folderKey) ||
        left.regionIndex - right.regionIndex,
    );
}

function emphasisClass(
  guide: FocusSchematicFolderClusterGuide,
  active: FocusSchematicFolderClusterGuide | undefined,
): string {
  if (active === undefined) return '';
  if (guide.folderKey === active.folderKey)
    return ' focus-schematic-folder-guide--active';
  if (guide.folderKey === active.parentFolderKey)
    return ' focus-schematic-folder-guide--parent';
  if (active.siblingFolderKeys.includes(guide.folderKey))
    return ' focus-schematic-folder-guide--sibling';
  return '';
}

export function FocusSchematicFolderClusterGuides({
  displayTree,
  nodes,
  onFolderContextMenu,
}: {
  readonly displayTree: FocusSchematicSoftFolderDisplayTree;
  readonly nodes: readonly GraphFlowNode[];
  readonly onFolderContextMenu: (
    request: FocusSchematicFolderGuideContextRequest,
  ) => void;
}) {
  const guides = useMemo(
    () => focusSchematicFolderClusterGuides(displayTree, nodes),
    [displayTree, nodes],
  );
  const [activeFolderKey, setActiveFolderKey] = useState<string | null>(null);
  const active = guides.find(
    (guide) => guide.folderKey === activeFolderKey && guide.regionIndex === 0,
  );
  if (guides.length === 0) return null;
  return (
    <ViewportPortal>
      <>
        <svg
          aria-hidden="true"
          className="focus-schematic-folder-guides"
          focusable="false"
          style={{ pointerEvents: 'none' }}
        >
          {guides.map((guide) => {
            const className = `focus-schematic-folder-guide focus-schematic-folder-guide--${guide.shape}${guide.root ? ' focus-schematic-folder-guide--root' : ''}${emphasisClass(guide, active)}`;
            return (
              <g key={`${guide.folderKey}\0${guide.regionIndex}`}>
                {guide.path === null ? (
                  <rect
                    className={className}
                    height={guide.height}
                    rx={guide.radius}
                    width={guide.width}
                    x={guide.x}
                    y={guide.y}
                  />
                ) : (
                  <path className={className} d={guide.path} />
                )}
                {guide.regionIndex === 0 ? null : (
                  <text
                    className="focus-schematic-folder-guide__label"
                    x={guide.labelX}
                    y={guide.labelY}
                  >
                    {`${guide.label} — island ${guide.regionIndex + 1} of ${guide.regionCount}`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {guides
          .filter(({ regionIndex }) => regionIndex === 0)
          .map((guide) => {
            const islandDescription =
              guide.regionCount === 1
                ? ''
                : `, ${guide.regionCount} spatial islands`;
            const parentDescription =
              guide.suppressedAncestorFolderKeys.length > 0
                ? `Compressed ancestry: ${guide.suppressedAncestorFolderKeys.map(folderLabel).join(' › ')}`
                : `Parent: ${guide.parentFolderKey === null ? 'none' : folderLabel(guide.parentFolderKey)}`;
            const siblingDescription =
              guide.siblingFolderKeys.length === 0
                ? 'No displayed sibling folders'
                : `Siblings: ${guide.siblingFolderKeys.map(folderLabel).join(', ')}`;
            return (
              <div
                className="focus-schematic-folder-guide-controls nodrag nopan nowheel"
                data-graph-wheel-ignore
                key={guide.folderKey}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    setActiveFolderKey(null);
                }}
                onFocus={() => setActiveFolderKey(guide.folderKey)}
                onMouseEnter={() => setActiveFolderKey(guide.folderKey)}
                onMouseLeave={() => setActiveFolderKey(null)}
                style={{
                  transform: `translate(${guide.labelX}px, ${guide.labelY - 18}px)`,
                }}
              >
                <button
                  aria-haspopup="menu"
                  aria-label={`Folder ${guide.label}${islandDescription}. ${parentDescription}. ${siblingDescription}`}
                  className="focus-schematic-folder-guide-controls__chip"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onFolderContextMenu({
                      folderKey: guide.folderKey,
                      x: event.clientX,
                      y: event.clientY,
                      origin: event.currentTarget,
                    });
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key !== 'ContextMenu' &&
                      !(event.key === 'F10' && event.shiftKey)
                    )
                      return;
                    event.preventDefault();
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    onFolderContextMenu({
                      folderKey: guide.folderKey,
                      x: rect.left + 16,
                      y: rect.bottom,
                      origin: event.currentTarget,
                    });
                  }}
                  title="Right-click for folder display actions"
                  type="button"
                >
                  {guide.label}
                </button>
                {activeFolderKey === guide.folderKey ? (
                  <div
                    className="focus-schematic-folder-guide-controls__context"
                    role="status"
                  >
                    <span>{parentDescription}</span>
                    <span>{siblingDescription}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
      </>
    </ViewportPortal>
  );
}
