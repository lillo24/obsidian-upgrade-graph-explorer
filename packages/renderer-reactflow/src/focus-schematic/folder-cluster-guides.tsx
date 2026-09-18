import { useState } from 'react';
import { ViewportPortal } from '@xyflow/react';
import type {
  FocusSchematicSoftFolderDisplayTree,
  FocusSchematicSoftFolderDisplayNode,
} from '@icarus-graph-explorer/focus-schematic-layout';
import {
  focusSchematicSoftFolderGuideConvexHull as convexHull,
  focusSchematicSoftFolderGuidePaddedCorners as paddedCorners,
  focusSchematicSoftFolderGuidePointInsidePolygon as pointInsidePolygon,
  partitionFocusSchematicSoftFolderGuideIslands as splitIntoIslands,
} from '@icarus-graph-explorer/focus-schematic-layout';

import type { GraphFlowNode } from '../types';

const GUIDE_CORNER_RADIUS = 18;

export interface FocusSchematicFolderGuidePoint {
  readonly x: number;
  readonly y: number;
}

type Point = FocusSchematicFolderGuidePoint;

interface GuideUnit {
  readonly id: string;
  readonly memberModuleIds: readonly string[];
  /** Rendered descendant guides that should inherit pass-through ancestry. */
  readonly representedGuideIds: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface FolderGuideBuildResult {
  readonly guides: readonly FocusSchematicFolderClusterGuide[];
  /** One unit per region exposed to the immediate logical parent. */
  readonly unitsForParent: readonly GuideUnit[];
}

export interface FocusSchematicFolderClusterGuideOptions {
  /** Render each displayed folder from its direct Files without child regions. */
  readonly directFoldersOnly?: boolean;
  /** Expose the structural workspace root as one visible folder. */
  readonly includeWorkspaceRootGroup?: boolean;
}

export interface FocusSchematicFolderClusterGuide {
  readonly folderKey: string;
  readonly parentFolderKey: string | null;
  readonly siblingFolderKeys: readonly string[];
  readonly suppressedAncestorFolderKeys: readonly string[];
  readonly label: string;
  readonly parentLabel: string | null;
  readonly root: boolean;
  readonly depth: number;
  readonly depthStyle: '0' | '1' | '2' | '3+';
  readonly regionIndex: number;
  readonly regionCount: number;
  readonly directVisualUnitCount: number;
  readonly shape: 'singleton' | 'capsule' | 'hull';
  readonly memberModuleIds: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly path: string | null;
  readonly hullPoints: readonly FocusSchematicFolderGuidePoint[];
  readonly area: number;
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

const guideId = (folderKey: string, regionIndex: number): string =>
  `${folderKey}\0${regionIndex}`;

const folderKeyDepth = (folderKey: string): number =>
  folderKey === '.' ? 0 : folderKey.split('/').length;

function shortFolderLabel(folderKey: string): string {
  return folderKey === '.' ? 'Workspace root' : folderKey.split('/').at(-1)!;
}

function accessibleFolderLabel(folderKey: string): string {
  return folderKey === '.' ? 'Workspace root' : `${folderKey}/`;
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

function polygonArea(points: readonly Point[]): number {
  return (
    Math.abs(
      points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length]!;
        return sum + point.x * next.y - next.x * point.y;
      }, 0),
    ) / 2
  );
}

function pointInsideRoundedRectangle(
  point: Point,
  guide: FocusSchematicFolderClusterGuide,
): boolean {
  if (
    point.x < guide.x ||
    point.x > guide.x + guide.width ||
    point.y < guide.y ||
    point.y > guide.y + guide.height
  )
    return false;
  const radius = Math.min(guide.radius, guide.width / 2, guide.height / 2);
  const nearestX = Math.max(
    guide.x + radius,
    Math.min(point.x, guide.x + guide.width - radius),
  );
  const nearestY = Math.max(
    guide.y + radius,
    Math.min(point.y, guide.y + guide.height - radius),
  );
  return Math.hypot(point.x - nearestX, point.y - nearestY) <= radius;
}

function guideContainsPoint(
  guide: FocusSchematicFolderClusterGuide,
  point: Point,
): boolean {
  return guide.shape === 'singleton'
    ? pointInsideRoundedRectangle(point, guide)
    : pointInsidePolygon(point, guide.hullPoints);
}

/** Selects the deepest actual rendered region, then the smallest and stable ID. */
export function hitTestFocusSchematicFolderGuideRegion(
  guides: readonly FocusSchematicFolderClusterGuide[],
  point: FocusSchematicFolderGuidePoint,
): FocusSchematicFolderClusterGuide | null {
  return (
    guides
      .filter((guide) => guideContainsPoint(guide, point))
      .sort(
        (left, right) =>
          right.depth - left.depth ||
          left.area - right.area ||
          compareText(left.folderKey, right.folderKey) ||
          left.regionIndex - right.regionIndex,
      )[0] ?? null
  );
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

interface RoundedPolygonGeometry {
  readonly path: string;
  readonly hitPoints: readonly Point[];
  readonly straightSegments: readonly {
    readonly start: Point;
    readonly end: Point;
  }[];
}

function roundedPolygonGeometry(
  points: readonly Point[],
  radius: number,
): RoundedPolygonGeometry {
  if (points.length < 3)
    return { path: '', hitPoints: points, straightSegments: [] };
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
  return {
    path: [
      `M ${last.end.x} ${last.end.y}`,
      ...entries.flatMap(({ point, start, end }) => [
        `L ${start.x} ${start.y}`,
        `Q ${point.x} ${point.y} ${end.x} ${end.y}`,
      ]),
      'Z',
    ].join(' '),
    hitPoints: entries.flatMap(({ point, start, end }) => [
      start,
      ...Array.from({ length: 6 }, (_, step) => {
        const t = (step + 1) / 6;
        const inverse = 1 - t;
        return {
          x:
            inverse * inverse * start.x +
            2 * inverse * t * point.x +
            t * t * end.x,
          y:
            inverse * inverse * start.y +
            2 * inverse * t * point.y +
            t * t * end.y,
        };
      }),
    ]),
    straightSegments: entries.map((entry, index) => ({
      start: entries[(index + entries.length - 1) % entries.length]!.end,
      end: entry.start,
    })),
  };
}

function upperHorizontalSegmentStart(
  geometry: RoundedPolygonGeometry,
): Point | undefined {
  return geometry.straightSegments
    .filter(
      ({ start, end }) =>
        Math.abs(start.y - end.y) <= 1e-7 &&
        Math.hypot(end.x - start.x, end.y - start.y) > 1e-7,
    )
    .map(({ start, end }) => ({
      x: Math.min(start.x, end.x),
      y: (start.y + end.y) / 2,
    }))
    .sort((left, right) => left.y - right.y || left.x - right.x)[0];
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
  const radius = GUIDE_CORNER_RADIUS;
  const rounded =
    shape === 'singleton' ? undefined : roundedPolygonGeometry(hull, radius);
  const hitPolygon = rounded?.hitPoints ?? hull;
  const labelAnchor =
    rounded === undefined ? undefined : upperHorizontalSegmentStart(rounded);
  const area =
    shape === 'singleton'
      ? (right - x) * (bottom - y) - (4 - Math.PI) * radius ** 2
      : polygonArea(hitPolygon);
  return {
    folderKey: folder.folderKey,
    parentFolderKey: folder.displayParentFolderKey,
    siblingFolderKeys: siblings,
    suppressedAncestorFolderKeys: folder.suppressedAncestorFolderKeys,
    label: shortFolderLabel(folder.folderKey),
    parentLabel:
      folder.displayParentFolderKey === null ||
      folder.displayParentFolderKey === '.'
        ? null
        : shortFolderLabel(folder.displayParentFolderKey),
    root: folder.folderKey === '.',
    depth: folder.displayDepth,
    depthStyle:
      folder.displayDepth >= 3
        ? '3+'
        : (String(folder.displayDepth) as '0' | '1' | '2'),
    regionIndex,
    regionCount,
    directVisualUnitCount: units.length,
    shape,
    memberModuleIds,
    x,
    y,
    width: right - x,
    height: bottom - y,
    radius,
    path: rounded?.path ?? null,
    hullPoints: hitPolygon,
    area,
    labelX: (labelAnchor?.x ?? x) + 12,
    labelY: (labelAnchor?.y ?? y) - 9,
  };
}

/** Builds child regions first, then encloses them with their logical parent. */
export function focusSchematicFolderClusterGuides(
  tree: FocusSchematicSoftFolderDisplayTree,
  nodes: readonly GraphFlowNode[],
  options: FocusSchematicFolderClusterGuideOptions = {},
): readonly FocusSchematicFolderClusterGuide[] {
  const directFoldersOnly = options.directFoldersOnly === true;
  const includeWorkspaceRootGroup = options.includeWorkspaceRootGroup === true;
  const rectangleByModuleId = new Map<string, GuideUnit>();
  for (const node of nodes) {
    if (node.type !== 'module') continue;
    const size = rectangleSize(node);
    if (size === undefined) continue;
    rectangleByModuleId.set(node.data.moduleId, {
      id: `file:${node.data.moduleId}`,
      memberModuleIds: [node.data.moduleId],
      representedGuideIds: [],
      x: node.position.x,
      y: node.position.y,
      ...size,
    });
  }
  const displayedFolders = (
    directFoldersOnly ? tree.preCompressionFolders : tree.folders
  ).filter(({ folderKey }) => folderKey !== '.' || includeWorkspaceRootGroup);
  const byKey = new Map(
    displayedFolders.map((folder) => [folder.folderKey, folder]),
  );
  const resultByFolder = new Map<string, FolderGuideBuildResult>();
  const localSuppressedAncestorsByGuideId = new Map<string, Set<string>>();
  const ordered = [...displayedFolders].sort(
    (left, right) =>
      right.displayDepth - left.displayDepth ||
      compareText(left.folderKey, right.folderKey),
  );
  for (const folder of ordered) {
    const direct = folder.directFileIds.flatMap((fileId) => {
      const rectangle = rectangleByModuleId.get(fileId);
      return rectangle === undefined ? [] : [rectangle];
    });
    const children = directFoldersOnly
      ? []
      : folder.childFolderKeys.flatMap(
          (childKey) => resultByFolder.get(childKey)?.unitsForParent ?? [],
        );
    const units = [...direct, ...children];
    // Workspace root is structural unless it contains a directly displayed File.
    if (
      units.length === 0 ||
      (folder.folderKey === '.' && direct.length === 0)
    ) {
      resultByFolder.set(folder.folderKey, {
        guides: [],
        unitsForParent: [],
      });
      continue;
    }
    const descendants = new Set(
      directFoldersOnly ? folder.directFileIds : folder.descendantFileIds,
    );
    const blockers = [...rectangleByModuleId]
      .filter(([moduleId]) => !descendants.has(moduleId))
      .map(([, rectangle]) => rectangle);
    if (
      folder.folderKey !== '.' &&
      direct.length > 0 &&
      splitIntoIslands(direct, blockers).length !== 1
    )
      throw new Error(
        `Soft folder guide received a split immediate named folder "${folder.folderKey}".`,
      );
    const islands = splitIntoIslands(units, blockers);
    // Nested keeps its accepted local wrapper suppression. Direct renders every
    // truthful group because a singleton is that File's only folder identity.
    const renderedIslands = directFoldersOnly
      ? islands
      : islands.filter(
          (island) =>
            folder.folderKey === '.' ||
            folder.directFileIds.some((fileId) =>
              island.some(({ memberModuleIds }) =>
                memberModuleIds.includes(fileId),
              ),
            ) ||
            island.length >= 2,
        );
    const guides = renderedIslands.map((island, regionIndex) =>
      guideForIsland(
        folder,
        byKey,
        regionIndex,
        renderedIslands.length,
        island,
      ),
    );
    const unitByIsland = new Map<readonly GuideUnit[], GuideUnit>();
    for (const [regionIndex, island] of renderedIslands.entries()) {
      const guide = guides[regionIndex]!;
      const id = guideId(folder.folderKey, regionIndex);
      unitByIsland.set(island, {
        id: `folder:${id}`,
        memberModuleIds: guide.memberModuleIds,
        representedGuideIds: [id],
        x: guide.x,
        y: guide.y,
        width: guide.width,
        height: guide.height,
      });
    }
    const unitsForParent = directFoldersOnly
      ? []
      : islands.map((island) => {
          const rendered = unitByIsland.get(island);
          if (rendered !== undefined) return rendered;
          const survivingUnit = island[0]!;
          for (const representedGuideId of survivingUnit.representedGuideIds) {
            const ancestors =
              localSuppressedAncestorsByGuideId.get(representedGuideId) ??
              new Set<string>();
            ancestors.add(folder.folderKey);
            localSuppressedAncestorsByGuideId.set(
              representedGuideId,
              ancestors,
            );
          }
          return survivingUnit;
        });
    resultByFolder.set(folder.folderKey, { guides, unitsForParent });
  }
  return [...resultByFolder.values()]
    .flatMap(({ guides }) => guides)
    .map((guide) => ({
      ...guide,
      suppressedAncestorFolderKeys: [
        ...new Set([
          ...guide.suppressedAncestorFolderKeys,
          ...(localSuppressedAncestorsByGuideId.get(
            guideId(guide.folderKey, guide.regionIndex),
          ) ?? []),
        ]),
      ].sort(
        (left, right) =>
          folderKeyDepth(left) - folderKeyDepth(right) ||
          compareText(left, right),
      ),
    }))
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
  guides,
  onFolderContextMenu,
}: {
  readonly guides: readonly FocusSchematicFolderClusterGuide[];
  readonly onFolderContextMenu: (
    request: FocusSchematicFolderGuideContextRequest,
  ) => void;
}) {
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
              <g
                data-folder-depth={guide.depth}
                data-folder-depth-style={guide.depthStyle}
                key={`${guide.folderKey}\0${guide.regionIndex}`}
              >
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
                    {guide.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {guides
          .filter(({ regionIndex }) => regionIndex === 0)
          .map((guide) => {
            const regionDescription =
              guide.regionCount === 1
                ? ''
                : ` ${guide.regionCount} disconnected regions.`;
            const parentDescription =
              guide.suppressedAncestorFolderKeys.length > 0
                ? `Compressed ancestry: ${guide.suppressedAncestorFolderKeys.map(shortFolderLabel).join(' › ')}`
                : `Parent: ${guide.parentFolderKey === null ? 'none' : shortFolderLabel(guide.parentFolderKey)}`;
            const siblingDescription =
              guide.siblingFolderKeys.length === 0
                ? 'No displayed sibling folders'
                : `Siblings: ${guide.siblingFolderKeys.map(shortFolderLabel).join(', ')}`;
            return (
              <div
                className="focus-schematic-folder-guide-controls nodrag nopan nowheel"
                data-graph-wheel-ignore
                data-folder-depth={guide.depth}
                data-folder-depth-style={guide.depthStyle}
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
                  aria-label={`Folder ${accessibleFolderLabel(guide.folderKey)}. Display depth ${guide.depth}.${regionDescription} ${parentDescription}. ${siblingDescription}`}
                  className="focus-schematic-folder-guide-controls__chip"
                  data-folder-label-presentation="passive"
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
                  title={`${accessibleFolderLabel(guide.folderKey)} — Right-click for folder display actions`}
                  type="button"
                >
                  <span className="focus-schematic-folder-guide-controls__name">
                    {guide.label}
                  </span>
                  {guide.parentLabel === null ? null : (
                    <small className="focus-schematic-folder-guide-controls__parent">
                      {guide.parentLabel}
                    </small>
                  )}
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
