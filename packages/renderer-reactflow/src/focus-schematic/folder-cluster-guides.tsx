import { useMemo, useState } from 'react';
import { ViewportPortal } from '@xyflow/react';
import type { FocusSchematicModule } from '@icarus-graph-explorer/focus-schematic';
import {
  createFocusSchematicSoftFolderGroupResolver,
  focusSchematicParentFolderKey,
  type FocusSchematicSoftFolderScopeOverride,
} from '@icarus-graph-explorer/focus-schematic-layout';

import type { GraphFlowNode } from '../types';

const GUIDE_PADDING = 30;
const GUIDE_CORNER_RADIUS = 18;
// The Soft solver normally leaves 72px between modules. Three clearances join
// a coherent local group while allowing widely separated same-folder islands.
const GUIDE_ISLAND_GAP = 216;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface ModuleRectangle {
  readonly moduleId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FocusSchematicFolderClusterGuide {
  readonly spatialGroupKey: string;
  readonly exactFolderKeys: readonly string[];
  readonly label: string;
  readonly root: boolean;
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

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

function rectangleGap(left: ModuleRectangle, right: ModuleRectangle): number {
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

function connectionSwallowsBlocker(
  left: ModuleRectangle,
  right: ModuleRectangle,
  blockers: readonly ModuleRectangle[],
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
  rectangles: readonly ModuleRectangle[],
  blockers: readonly ModuleRectangle[],
): readonly (readonly ModuleRectangle[])[] {
  const ordered = [...rectangles].sort((left, right) =>
    compareText(left.moduleId, right.moduleId),
  );
  const remaining = new Set(ordered.map(({ moduleId }) => moduleId));
  const byId = new Map(ordered.map((item) => [item.moduleId, item]));
  const islands: ModuleRectangle[][] = [];
  for (const seed of ordered) {
    if (!remaining.delete(seed.moduleId)) continue;
    const island: ModuleRectangle[] = [];
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
          compareText(left.moduleId, right.moduleId),
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

function paddedCorners(rectangle: ModuleRectangle): readonly Point[] {
  const left = rectangle.x - GUIDE_PADDING;
  const top = rectangle.y - GUIDE_PADDING;
  const right = rectangle.x + rectangle.width + GUIDE_PADDING;
  const bottom = rectangle.y + rectangle.height + GUIDE_PADDING;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function guideForIsland(
  spatialGroupKey: string,
  exactFolderKeys: readonly string[],
  root: boolean,
  regionIndex: number,
  regionCount: number,
  rectangles: readonly ModuleRectangle[],
): FocusSchematicFolderClusterGuide {
  const memberModuleIds = rectangles
    .map(({ moduleId }) => moduleId)
    .sort(compareText);
  const hull = convexHull(rectangles.flatMap(paddedCorners));
  const x = Math.min(...hull.map((point) => point.x));
  const y = Math.min(...hull.map((point) => point.y));
  const right = Math.max(...hull.map((point) => point.x));
  const bottom = Math.max(...hull.map((point) => point.y));
  const shape =
    rectangles.length === 1
      ? 'singleton'
      : rectangles.length === 2
        ? 'capsule'
        : 'hull';
  return {
    spatialGroupKey,
    exactFolderKeys,
    label: folderLabel(spatialGroupKey),
    root,
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

/**
 * Uses exact visible HIER1 membership and final renderer module rectangles.
 * Filtered bridge modules never enter the guide inventory.
 */
export function focusSchematicFolderClusterGuides(
  modules: readonly FocusSchematicModule[],
  nodes: readonly GraphFlowNode[],
  rootModuleId: string,
  scopeOverrides: readonly FocusSchematicSoftFolderScopeOverride[] = [],
): readonly FocusSchematicFolderClusterGuide[] {
  const rectangleByModuleId = new Map<string, ModuleRectangle>();
  for (const node of nodes) {
    if (node.type !== 'module') continue;
    const size = rectangleSize(node);
    if (size === undefined) continue;
    rectangleByModuleId.set(node.data.moduleId, {
      moduleId: node.data.moduleId,
      x: node.position.x,
      y: node.position.y,
      ...size,
    });
  }
  const byFolder = new Map<
    string,
    { rectangles: ModuleRectangle[]; exactFolderKeys: Set<string> }
  >();
  const resolveGroup =
    createFocusSchematicSoftFolderGroupResolver(scopeOverrides);
  for (const module of [...modules].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    if (module.presentation === 'filtered') continue;
    const rectangle = rectangleByModuleId.get(module.id);
    if (rectangle === undefined) continue;
    const spatialGroupKey = resolveGroup(module.folderKey);
    const folder = byFolder.get(spatialGroupKey) ?? {
      rectangles: [],
      exactFolderKeys: new Set(),
    };
    folder.rectangles.push(rectangle);
    folder.exactFolderKeys.add(module.folderKey);
    byFolder.set(spatialGroupKey, folder);
  }
  return [...byFolder]
    .sort(([left], [right]) => compareText(left, right))
    .flatMap(([spatialGroupKey, group]) => {
      const root = modules.some(
        (module) =>
          module.id === rootModuleId &&
          resolveGroup(module.folderKey) === spatialGroupKey,
      );
      const blockers = [...byFolder]
        .filter(([otherFolderKey]) => otherFolderKey !== spatialGroupKey)
        .flatMap(([, { rectangles }]) => rectangles);
      const islands = splitIntoIslands(group.rectangles, blockers);
      const exactFolderKeys = [...group.exactFolderKeys].sort(compareText);
      return islands.map((island, regionIndex) =>
        guideForIsland(
          spatialGroupKey,
          exactFolderKeys,
          root,
          regionIndex,
          islands.length,
          island,
        ),
      );
    });
}

export function FocusSchematicFolderClusterGuides({
  modules,
  nodes,
  rootModuleId,
  scopeOverrides,
  persistenceStatus,
  persistenceError,
  onPromoteGroup,
  onPromoteGroupWithSiblings,
  onResetGroup,
}: {
  readonly modules: readonly FocusSchematicModule[];
  readonly nodes: readonly GraphFlowNode[];
  readonly rootModuleId: string;
  readonly scopeOverrides: readonly FocusSchematicSoftFolderScopeOverride[];
  readonly persistenceStatus: string;
  readonly persistenceError: string | undefined;
  readonly onPromoteGroup: (spatialGroupKey: string) => void;
  readonly onPromoteGroupWithSiblings: (spatialGroupKey: string) => void;
  readonly onResetGroup: (spatialGroupKey: string) => void;
}) {
  const guides = useMemo(
    () =>
      focusSchematicFolderClusterGuides(
        modules,
        nodes,
        rootModuleId,
        scopeOverrides,
      ),
    [modules, nodes, rootModuleId, scopeOverrides],
  );
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  if (guides.length === 0) return null;
  return (
    <ViewportPortal>
      <>
        <svg
          aria-hidden="true"
          className="focus-schematic-folder-guides"
          focusable="false"
        >
          {guides.map((guide) => {
            const className = `focus-schematic-folder-guide focus-schematic-folder-guide--${guide.shape}${guide.root ? ' focus-schematic-folder-guide--root' : ''}`;
            return (
              <g key={`${guide.spatialGroupKey}\0${guide.regionIndex}`}>
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
            const parent = focusSchematicParentFolderKey(guide.spatialGroupKey);
            const open = openGroupKey === guide.spatialGroupKey;
            const resettable = scopeOverrides.some(
              ({ spatialGroupKey }) =>
                spatialGroupKey === guide.spatialGroupKey,
            );
            const islandDescription =
              guide.regionCount === 1
                ? ''
                : `, ${guide.regionCount} spatial islands`;
            return (
              <div
                className="focus-schematic-folder-guide-controls nodrag nopan nowheel"
                data-graph-wheel-ignore
                key={guide.spatialGroupKey}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    setOpenGroupKey(null);
                }}
                onFocus={() => setOpenGroupKey(guide.spatialGroupKey)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    setOpenGroupKey(null);
                  }
                }}
                onMouseEnter={() => setOpenGroupKey(guide.spatialGroupKey)}
                onMouseLeave={() => setOpenGroupKey(null)}
                style={{
                  transform: `translate(${guide.labelX}px, ${guide.labelY - 18}px)`,
                }}
              >
                <button
                  aria-expanded={open}
                  aria-label={`Spatial group ${guide.label}, ${guide.exactFolderKeys.length} visible source folder${guide.exactFolderKeys.length === 1 ? '' : 's'}${islandDescription}`}
                  className="focus-schematic-folder-guide-controls__chip"
                  onClick={() =>
                    setOpenGroupKey(open ? null : guide.spatialGroupKey)
                  }
                  type="button"
                >
                  {guide.label}
                </button>
                {open ? (
                  <div
                    aria-label={`Spatial group controls for ${guide.label}`}
                    className="focus-schematic-folder-guide-controls__popover"
                    role="group"
                  >
                    <strong>Spatial group</strong>
                    <span>{guide.label}</span>
                    <span>
                      {guide.exactFolderKeys.length} visible source folder
                      {guide.exactFolderKeys.length === 1 ? '' : 's'}
                    </span>
                    {guide.exactFolderKeys.length <= 3 ? (
                      <small>
                        {guide.exactFolderKeys.map(folderLabel).join(', ')}
                      </small>
                    ) : null}
                    <span>
                      {parent === null
                        ? 'Already at workspace root'
                        : `Parent: ${folderLabel(parent)}`}
                    </span>
                    <button
                      aria-label={`Promote only this spatial group into ${parent === null ? 'workspace root' : folderLabel(parent)}`}
                      disabled={parent === null}
                      onClick={() => onPromoteGroup(guide.spatialGroupKey)}
                      type="button"
                    >
                      ↑ This group
                    </button>
                    <button
                      aria-label={`Promote this group and sibling folders into ${parent === null ? 'workspace root' : folderLabel(parent)}`}
                      disabled={parent === null}
                      onClick={() =>
                        onPromoteGroupWithSiblings(guide.spatialGroupKey)
                      }
                      type="button"
                    >
                      ↑ This + sibling folders
                    </button>
                    <button
                      aria-label={`Reset this spatial group ${guide.label}`}
                      disabled={!resettable}
                      onClick={() => onResetGroup(guide.spatialGroupKey)}
                      type="button"
                    >
                      Reset
                    </button>
                    <small>Sibling folders share the same parent.</small>
                    <small>{persistenceStatus}</small>
                    {persistenceError === undefined ? null : (
                      <small role="alert">{persistenceError}</small>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
      </>
    </ViewportPortal>
  );
}
