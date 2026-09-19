import type { WorkspaceFolderKey } from '@icarus-graph-explorer/core';
import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';

import {
  focusSchematicSoftFolderGuideConvexHull,
  focusSchematicSoftFolderGuidePaddedCorners,
  focusSchematicSoftFolderGuidePointInsidePolygon,
  focusSchematicSoftFolderGuideRectangleGap,
  partitionFocusSchematicSoftFolderGuideIslands,
} from './soft-folder-guide-geometry';
import { FOCUS_SCHEMATIC_LAYOUT_CLEARANCE } from './settings';
import type { FocusSchematicSoftFolderDisplayTree } from './types';

const UNIT_GAP = 72;
const EPSILON = 1e-9;
const TANGENTIAL_OFFSETS = [
  0, -36, 36, -72, 72, -108, 108, -144, 144, -180, 180, -216, 216, -288, 288,
  -360, 360,
] as const;
const CONNECTION_GAPS = [72, 36, 108, 144, 180, 216] as const;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface PackingUnit {
  readonly id: string;
  readonly memberModuleIds: readonly string[];
  readonly envelope: FocusSchematicRectangle;
}

class NestedSoftPackingJoinError extends Error {}

export interface FocusSchematicSoftFolderCoverageEvidence {
  readonly groupableVisibleFileCount: number;
  readonly workspaceRootExemptFileCount: number;
  readonly focusExemptFileCount: number;
  readonly filteredBridgeExemptFileCount: number;
  readonly immediateFolderCoveredFileCount: number;
  readonly missingImmediateFolderGuideCount: number;
  readonly nestedAncestorCoverageViolationCount: number;
}

export interface FocusSchematicSoftNestedHierarchyEvidence {
  readonly retainedNestedFolderCount: number;
  readonly nestedFolderPackingMoveMean: number;
  readonly nestedFolderPackingMoveP95: number;
  readonly nestedFolderPackingMoveMax: number;
  readonly nestedFolderPackingDepth: number;
  readonly nestedParentContainmentViolationCount: number;
  readonly nestedFolderSplitViolationCount: number;
  readonly nestedGuideBlockerViolationCount: number;
  readonly nestedFolderMaxRegionCount: number;
  readonly nestedFolderMemberCountMin: number;
  readonly nestedFolderMemberCountMax: number;
  readonly nestedClosestInterIslandGap: number | null;
  readonly postCohesionNestedParentContainmentViolationCount: number;
  readonly postCohesionNestedFolderSplitViolationCount: number;
  readonly postCohesionNestedGuideBlockerViolationCount: number;
  readonly postNestedNestedParentContainmentViolationCount: number;
  readonly postNestedNestedFolderSplitViolationCount: number;
  readonly postNestedNestedGuideBlockerViolationCount: number;
  readonly postGroupNestedParentContainmentViolationCount: number;
  readonly postGroupNestedFolderSplitViolationCount: number;
  readonly postGroupNestedGuideBlockerViolationCount: number;
  readonly nestedFirstSplitStage:
    'post-cohesion' | 'post-nested' | 'post-group' | null;
}

export interface FocusSchematicSoftNestedHierarchyQuality {
  readonly nestedParentContainmentViolationCount: number;
  readonly nestedFolderSplitViolationCount: number;
  readonly nestedGuideBlockerViolationCount: number;
  readonly nestedFolderMaxRegionCount: number;
  readonly nestedFolderMemberCountMin: number;
  readonly nestedFolderMemberCountMax: number;
  readonly nestedClosestInterIslandGap: number | null;
}

export interface FocusSchematicSoftNestedHierarchyResult {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly evidence: FocusSchematicSoftNestedHierarchyEvidence;
}

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[
    Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)
  ]!;
}

function envelope(
  rectangles: readonly FocusSchematicRectangle[],
): FocusSchematicRectangle {
  if (rectangles.length === 0)
    throw new Error('Nested Soft packing cannot envelope an empty unit.');
  const x = Math.min(...rectangles.map((rectangle) => rectangle.x));
  const y = Math.min(...rectangles.map((rectangle) => rectangle.y));
  const right = Math.max(
    ...rectangles.map((rectangle) => rectangle.x + rectangle.width),
  );
  const bottom = Math.max(
    ...rectangles.map((rectangle) => rectangle.y + rectangle.height),
  );
  return { x, y, width: right - x, height: bottom - y };
}

function center(rectangle: FocusSchematicRectangle): Point {
  return {
    x: rectangle.x + rectangle.width / 2,
    y: rectangle.y + rectangle.height / 2,
  };
}

function moduleEnvelope(
  candidate: FocusSchematicLayoutCandidate,
  moduleIds: readonly string[],
): FocusSchematicRectangle {
  const wanted = new Set(moduleIds);
  return envelope(
    candidate.modules.filter(({ moduleId }) => wanted.has(moduleId)),
  );
}

function translateModules(
  candidate: FocusSchematicLayoutCandidate,
  moduleIds: readonly string[],
  translation: Point,
): FocusSchematicLayoutCandidate {
  if (Math.abs(translation.x) <= EPSILON && Math.abs(translation.y) <= EPSILON)
    return candidate;
  const wanted = new Set(moduleIds);
  return {
    ...candidate,
    modules: candidate.modules.map((module) =>
      wanted.has(module.moduleId)
        ? {
            ...module,
            x: module.x + translation.x,
            y: module.y + translation.y,
          }
        : module,
    ),
    nodes: candidate.nodes.map((node) =>
      wanted.has(node.moduleId)
        ? { ...node, x: node.x + translation.x, y: node.y + translation.y }
        : node,
    ),
    routes: [],
  };
}

function packUnits(
  candidate: FocusSchematicLayoutCandidate,
  units: readonly PackingUnit[],
): FocusSchematicLayoutCandidate {
  if (units.length <= 1) return candidate;
  const ordered = [...units].sort(
    (left, right) =>
      center(left.envelope).y - center(right.envelope).y ||
      center(left.envelope).x - center(right.envelope).x ||
      compareText(left.id, right.id),
  );
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
  const rows = Math.ceil(ordered.length / columns);
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);
  ordered.forEach((unit, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column]!, unit.envelope.width);
    rowHeights[row] = Math.max(rowHeights[row]!, unit.envelope.height);
  });
  const width =
    columnWidths.reduce((sum, value) => sum + value, 0) +
    UNIT_GAP * (columns - 1);
  const height =
    rowHeights.reduce((sum, value) => sum + value, 0) + UNIT_GAP * (rows - 1);
  const original = envelope(ordered.map(({ envelope: value }) => value));
  const origin = {
    x: center(original).x - width / 2,
    y: center(original).y - height / 2,
  };
  const columnX = columnWidths.map((_, index) =>
    columnWidths
      .slice(0, index)
      .reduce((sum, value) => sum + value + UNIT_GAP, origin.x),
  );
  const rowY = rowHeights.map((_, index) =>
    rowHeights
      .slice(0, index)
      .reduce((sum, value) => sum + value + UNIT_GAP, origin.y),
  );
  let packed = candidate;
  ordered.forEach((unit, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const target = {
      x: columnX[column]! + (columnWidths[column]! - unit.envelope.width) / 2,
      y: rowY[row]! + (rowHeights[row]! - unit.envelope.height) / 2,
    };
    packed = translateModules(packed, unit.memberModuleIds, {
      x: target.x - unit.envelope.x,
      y: target.y - unit.envelope.y,
    });
  });
  return packed;
}

function moduleRectangles(
  candidate: FocusSchematicLayoutCandidate,
  moduleIds: ReadonlySet<string>,
) {
  return candidate.modules
    .filter(({ moduleId }) => moduleIds.has(moduleId))
    .map((module) => ({ id: module.moduleId, ...module }))
    .sort((left, right) => compareText(left.id, right.id));
}

function overlapsWithClearance(
  left: FocusSchematicRectangle,
  right: FocusSchematicRectangle,
): boolean {
  return !(
    left.x + left.width + FOCUS_SCHEMATIC_LAYOUT_CLEARANCE <= right.x ||
    right.x + right.width + FOCUS_SCHEMATIC_LAYOUT_CLEARANCE <= left.x ||
    left.y + left.height + FOCUS_SCHEMATIC_LAYOUT_CLEARANCE <= right.y ||
    right.y + right.height + FOCUS_SCHEMATIC_LAYOUT_CLEARANCE <= left.y
  );
}

function hullSwallowsBlocker(
  members: ReturnType<typeof moduleRectangles>,
  blockers: ReturnType<typeof moduleRectangles>,
): boolean {
  const hull = focusSchematicSoftFolderGuideConvexHull(
    members.flatMap(focusSchematicSoftFolderGuidePaddedCorners),
  );
  return blockers.some((blocker) =>
    focusSchematicSoftFolderGuidePointInsidePolygon(center(blocker), hull),
  );
}

function rectanglesOverlap(
  left: ReturnType<typeof moduleRectangles>,
  right: ReturnType<typeof moduleRectangles>,
): boolean {
  return left.some((first) =>
    right.some((second) => overlapsWithClearance(first, second)),
  );
}

function stabilizeRigidUnit(
  candidate: FocusSchematicLayoutCandidate,
  unit: PackingUnit,
  blockers: ReturnType<typeof moduleRectangles>,
): FocusSchematicLayoutCandidate {
  const unitIds = new Set(unit.memberModuleIds);
  const valid = (trial: FocusSchematicLayoutCandidate): boolean => {
    const members = moduleRectangles(trial, unitIds);
    return (
      !rectanglesOverlap(members, blockers) &&
      partitionFocusSchematicSoftFolderGuideIslands(members, blockers)
        .length === 1 &&
      !hullSwallowsBlocker(members, blockers)
    );
  };
  if (valid(candidate)) return candidate;
  const translations: Point[] = [];
  for (let ring = 1; ring <= 24; ring += 1)
    for (let x = -ring; x <= ring; x += 1)
      for (const y of [-ring, ring])
        translations.push({ x: x * UNIT_GAP, y: y * UNIT_GAP });
  for (let ring = 1; ring <= 24; ring += 1)
    for (let y = -ring + 1; y < ring; y += 1)
      for (const x of [-ring, ring])
        translations.push({ x: x * UNIT_GAP, y: y * UNIT_GAP });
  translations.sort(
    (left, right) =>
      Math.hypot(left.x, left.y) - Math.hypot(right.x, right.y) ||
      left.y - right.y ||
      left.x - right.x,
  );
  for (const translation of translations) {
    const trial = translateModules(
      candidate,
      unit.memberModuleIds,
      translation,
    );
    if (valid(trial)) return trial;
  }
  throw new Error(
    `Nested Soft packing could not stabilize a ${unit.memberModuleIds.length}-module rigid unit around ${blockers.length} blockers.`,
  );
}

function repairFolderConnectivity(
  candidate: FocusSchematicLayoutCandidate,
  units: readonly PackingUnit[],
  folderMemberIds: readonly string[],
  allowWholeFolderRelocation = true,
): FocusSchematicLayoutCandidate {
  if (units.length <= 1) return candidate;
  const ordered = [...units].sort((left, right) =>
    compareText(left.id, right.id),
  );
  const folderIds = new Set(folderMemberIds);
  const blockers = moduleRectangles(
    candidate,
    new Set(
      candidate.modules
        .map(({ moduleId }) => moduleId)
        .filter((moduleId) => !folderIds.has(moduleId)),
    ),
  );
  let repaired = candidate;
  const connectedIds = new Set(ordered[0]!.memberModuleIds);

  for (const unit of ordered.slice(1)) {
    const movingIds = new Set(unit.memberModuleIds);
    const connected = () => moduleRectangles(repaired, connectedIds);
    const moving = () => moduleRectangles(repaired, movingIds);
    const combined = () => [...connected(), ...moving()];
    if (
      !rectanglesOverlap(connected(), moving()) &&
      partitionFocusSchematicSoftFolderGuideIslands(combined(), blockers)
        .length === 1 &&
      !hullSwallowsBlocker(combined(), blockers)
    ) {
      unit.memberModuleIds.forEach((moduleId) => connectedIds.add(moduleId));
      continue;
    }

    const proposals: Point[] = [];
    for (const target of connected()) {
      for (const source of moving()) {
        for (const gap of CONNECTION_GAPS)
          for (const offset of TANGENTIAL_OFFSETS) {
            proposals.push(
              {
                x: target.x + target.width + gap - source.x,
                y:
                  target.y +
                  target.height / 2 -
                  source.height / 2 +
                  offset -
                  source.y,
              },
              {
                x: target.x - gap - source.width - source.x,
                y:
                  target.y +
                  target.height / 2 -
                  source.height / 2 +
                  offset -
                  source.y,
              },
              {
                x:
                  target.x +
                  target.width / 2 -
                  source.width / 2 +
                  offset -
                  source.x,
                y: target.y + target.height + gap - source.y,
              },
              {
                x:
                  target.x +
                  target.width / 2 -
                  source.width / 2 +
                  offset -
                  source.x,
                y: target.y - gap - source.height - source.y,
              },
            );
          }
      }
    }
    const unique = [
      ...new Map(
        proposals.map((value) => [`${value.x}:${value.y}`, value]),
      ).values(),
    ].sort(
      (left, right) =>
        Math.hypot(left.x, left.y) - Math.hypot(right.x, right.y) ||
        left.y - right.y ||
        left.x - right.x,
    );
    let accepted: FocusSchematicLayoutCandidate | null = null;
    let overlapRejectCount = 0;
    let islandRejectCount = 0;
    let blockerRejectCount = 0;
    for (const translation of unique) {
      const trial = translateModules(
        repaired,
        unit.memberModuleIds,
        translation,
      );
      const moved = moduleRectangles(trial, movingIds);
      const stationaryIds = new Set([
        ...connectedIds,
        ...blockers.map(({ id }) => id),
      ]);
      const stationary = trial.modules.filter(({ moduleId }) =>
        stationaryIds.has(moduleId),
      );
      if (
        moved.some((left) =>
          stationary.some((right) => overlapsWithClearance(left, right)),
        )
      ) {
        overlapRejectCount += 1;
        continue;
      }
      const members = [...moduleRectangles(trial, connectedIds), ...moved];
      if (
        partitionFocusSchematicSoftFolderGuideIslands(members, blockers)
          .length !== 1
      ) {
        islandRejectCount += 1;
        continue;
      }
      if (hullSwallowsBlocker(members, blockers)) {
        blockerRejectCount += 1;
        continue;
      }
      accepted = trial;
      break;
    }
    if (
      accepted === null &&
      allowWholeFolderRelocation &&
      blockers.length > 0
    ) {
      const memberEnvelope = moduleEnvelope(repaired, folderMemberIds);
      const blockerEnvelope = envelope(blockers);
      const translations = [
        {
          x:
            blockerEnvelope.x +
            blockerEnvelope.width +
            UNIT_GAP -
            memberEnvelope.x,
          y: center(blockerEnvelope).y - center(memberEnvelope).y,
        },
        {
          x:
            blockerEnvelope.x -
            UNIT_GAP -
            memberEnvelope.width -
            memberEnvelope.x,
          y: center(blockerEnvelope).y - center(memberEnvelope).y,
        },
        {
          x: center(blockerEnvelope).x - center(memberEnvelope).x,
          y:
            blockerEnvelope.y +
            blockerEnvelope.height +
            UNIT_GAP -
            memberEnvelope.y,
        },
        {
          x: center(blockerEnvelope).x - center(memberEnvelope).x,
          y:
            blockerEnvelope.y -
            UNIT_GAP -
            memberEnvelope.height -
            memberEnvelope.y,
        },
      ].sort(
        (left, right) =>
          Math.hypot(left.x, left.y) - Math.hypot(right.x, right.y) ||
          left.y - right.y ||
          left.x - right.x,
      );
      for (const translation of translations) {
        const relocated = translateModules(
          repaired,
          folderMemberIds,
          translation,
        );
        if (rectanglesOverlap(moduleRectangles(relocated, folderIds), blockers))
          continue;
        try {
          return repairFolderConnectivity(
            relocated,
            units,
            folderMemberIds,
            false,
          );
        } catch (error: unknown) {
          if (!(error instanceof NestedSoftPackingJoinError)) throw error;
        }
      }
    }
    if (accepted === null)
      throw new NestedSoftPackingJoinError(
        `Nested Soft packing could not join ${ordered.length} rigid units: anchorKind=${ordered[0]!.id.startsWith('child:') ? 'child' : 'direct'}, connectedMembers=${connected().length}, connectedRegions=${partitionFocusSchematicSoftFolderGuideIslands(connected(), blockers).length}, movingMembers=${moving().length}, movingRegions=${partitionFocusSchematicSoftFolderGuideIslands(moving(), blockers).length}, blockerCount=${blockers.length}, candidates=${unique.length}, overlaps=${overlapRejectCount}, disconnected=${islandRejectCount}, blockers=${blockerRejectCount}.`,
      );
    repaired = accepted;
    unit.memberModuleIds.forEach((moduleId) => connectedIds.add(moduleId));
  }
  return repaired;
}

function namedFolders(tree: FocusSchematicSoftFolderDisplayTree) {
  return tree.folders.filter(({ folderKey }) => folderKey !== '.');
}

function hierarchyQuality(
  candidate: FocusSchematicLayoutCandidate,
  tree: FocusSchematicSoftFolderDisplayTree,
): FocusSchematicSoftNestedHierarchyQuality {
  const all = candidate.modules.map((module) => ({
    id: module.moduleId,
    ...module,
  }));
  const folderByKey = new Map(
    tree.folders.map((folder) => [folder.folderKey, folder]),
  );
  let containmentViolations = 0;
  let splitViolations = 0;
  let blockerViolations = 0;
  let maxRegionCount = 0;
  let closestInterIslandGap: number | null = null;
  const memberCounts: number[] = [];
  for (const folder of namedFolders(tree)) {
    const memberIds = new Set(folder.descendantFileIds);
    const members = all.filter(({ id }) => memberIds.has(id));
    const blockers = all.filter(({ id }) => !memberIds.has(id));
    if (members.length === 0) {
      containmentViolations += 1;
      continue;
    }
    memberCounts.push(members.length);
    const islands = partitionFocusSchematicSoftFolderGuideIslands(
      members,
      blockers,
    );
    maxRegionCount = Math.max(maxRegionCount, islands.length);
    if (islands.length !== 1) {
      splitViolations += 1;
      for (let leftIndex = 0; leftIndex < islands.length; leftIndex += 1)
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < islands.length;
          rightIndex += 1
        )
          for (const left of islands[leftIndex]!)
            for (const right of islands[rightIndex]!) {
              const gap = focusSchematicSoftFolderGuideRectangleGap(
                left,
                right,
              );
              closestInterIslandGap =
                closestInterIslandGap === null
                  ? gap
                  : Math.min(closestInterIslandGap, gap);
            }
    }
    const hull = focusSchematicSoftFolderGuideConvexHull(
      members.flatMap(focusSchematicSoftFolderGuidePaddedCorners),
    );
    if (
      blockers.some((blocker) =>
        focusSchematicSoftFolderGuidePointInsidePolygon(center(blocker), hull),
      )
    )
      blockerViolations += 1;
    for (const childKey of folder.childFolderKeys) {
      const child = folderByKey.get(childKey);
      if (
        child === undefined ||
        child.descendantFileIds.some((fileId) => !memberIds.has(fileId))
      )
        containmentViolations += 1;
    }
  }
  return {
    nestedParentContainmentViolationCount: containmentViolations,
    nestedFolderSplitViolationCount: splitViolations,
    nestedGuideBlockerViolationCount: blockerViolations,
    nestedFolderMaxRegionCount: maxRegionCount,
    nestedFolderMemberCountMin:
      memberCounts.length === 0 ? 0 : Math.min(...memberCounts),
    nestedFolderMemberCountMax: Math.max(0, ...memberCounts),
    nestedClosestInterIslandGap: closestInterIslandGap,
  };
}

/** Packs every retained named folder deepest-first using rigid child subtrees. */
export function applyFocusSchematicSoftNestedHierarchyPacking(
  candidate: FocusSchematicLayoutCandidate,
  tree: FocusSchematicSoftFolderDisplayTree,
): FocusSchematicSoftNestedHierarchyResult {
  const postCohesionQuality = hierarchyQuality(candidate, tree);
  const beforeById = new Map(
    candidate.modules.map((module) => [
      module.moduleId,
      { x: module.x, y: module.y },
    ]),
  );
  const folderByKey = new Map(
    tree.folders.map((folder) => [folder.folderKey, folder]),
  );
  let packed = candidate;
  for (const folder of [...namedFolders(tree)].sort(
    (left, right) =>
      right.displayDepth - left.displayDepth ||
      compareText(left.folderKey, right.folderKey),
  )) {
    const units: PackingUnit[] = [];
    if (folder.directFileIds.length > 0)
      units.push({
        id: `direct:${folder.folderKey}`,
        memberModuleIds: folder.directFileIds,
        envelope: moduleEnvelope(packed, folder.directFileIds),
      });
    for (const childKey of folder.childFolderKeys) {
      const child = folderByKey.get(childKey);
      if (child === undefined || child.descendantFileIds.length === 0)
        throw new Error(
          `Nested Soft packing cannot resolve child folder "${childKey}" of "${folder.folderKey}".`,
        );
      units.push({
        id: `child:${childKey}`,
        memberModuleIds: child.descendantFileIds,
        envelope: moduleEnvelope(packed, child.descendantFileIds),
      });
    }
    packed = packUnits(packed, units);
    const folderIds = new Set(folder.descendantFileIds);
    const allIds = new Set(packed.modules.map(({ moduleId }) => moduleId));
    const blockers = moduleRectangles(
      packed,
      new Set([...allIds].filter((moduleId) => !folderIds.has(moduleId))),
    );
    for (const unit of [...units].sort((left, right) =>
      compareText(left.id, right.id),
    ))
      packed = stabilizeRigidUnit(packed, unit, blockers);
    packed = repairFolderConnectivity(packed, units, folder.descendantFileIds);
    const members = moduleRectangles(packed, folderIds);
    const finalBlockers = moduleRectangles(
      packed,
      new Set([...allIds].filter((moduleId) => !folderIds.has(moduleId))),
    );
    if (
      units.length > 1 &&
      partitionFocusSchematicSoftFolderGuideIslands(members, finalBlockers)
        .length !== 1
    )
      throw new Error(
        'Nested Soft packing left a retained parent folder geometrically split.',
      );
  }
  const movements = packed.modules.map((module) => {
    const before = beforeById.get(module.moduleId)!;
    return Math.hypot(module.x - before.x, module.y - before.y);
  });
  const quality = hierarchyQuality(packed, tree);
  return {
    candidate: packed,
    evidence: {
      retainedNestedFolderCount: namedFolders(tree).length,
      nestedFolderPackingMoveMean:
        movements.reduce((sum, value) => sum + value, 0) /
        Math.max(1, movements.length),
      nestedFolderPackingMoveP95: percentile(movements, 0.95),
      nestedFolderPackingMoveMax: Math.max(0, ...movements),
      nestedFolderPackingDepth: Math.max(
        0,
        ...namedFolders(tree).map(({ displayDepth }) => displayDepth),
      ),
      ...quality,
      nestedFolderMaxRegionCount: Math.max(
        postCohesionQuality.nestedFolderMaxRegionCount,
        quality.nestedFolderMaxRegionCount,
      ),
      nestedFolderMemberCountMin: Math.min(
        postCohesionQuality.nestedFolderMemberCountMin,
        quality.nestedFolderMemberCountMin,
      ),
      nestedFolderMemberCountMax: Math.max(
        postCohesionQuality.nestedFolderMemberCountMax,
        quality.nestedFolderMemberCountMax,
      ),
      nestedClosestInterIslandGap:
        postCohesionQuality.nestedClosestInterIslandGap ??
        quality.nestedClosestInterIslandGap,
      postCohesionNestedParentContainmentViolationCount:
        postCohesionQuality.nestedParentContainmentViolationCount,
      postCohesionNestedFolderSplitViolationCount:
        postCohesionQuality.nestedFolderSplitViolationCount,
      postCohesionNestedGuideBlockerViolationCount:
        postCohesionQuality.nestedGuideBlockerViolationCount,
      postNestedNestedParentContainmentViolationCount:
        quality.nestedParentContainmentViolationCount,
      postNestedNestedFolderSplitViolationCount:
        quality.nestedFolderSplitViolationCount,
      postNestedNestedGuideBlockerViolationCount:
        quality.nestedGuideBlockerViolationCount,
      postGroupNestedParentContainmentViolationCount:
        quality.nestedParentContainmentViolationCount,
      postGroupNestedFolderSplitViolationCount:
        quality.nestedFolderSplitViolationCount,
      postGroupNestedGuideBlockerViolationCount:
        quality.nestedGuideBlockerViolationCount,
      nestedFirstSplitStage:
        postCohesionQuality.nestedFolderSplitViolationCount > 0
          ? 'post-cohesion'
          : quality.nestedFolderSplitViolationCount > 0
            ? 'post-nested'
            : null,
    },
  };
}

export function measureFocusSchematicSoftNestedHierarchy(
  candidate: FocusSchematicLayoutCandidate,
  tree: FocusSchematicSoftFolderDisplayTree,
): FocusSchematicSoftNestedHierarchyQuality {
  return hierarchyQuality(candidate, tree);
}

/** Audits visible membership independently of renderer geometry. */
export function measureFocusSchematicSoftFolderCoverage(
  tree: FocusSchematicSoftFolderDisplayTree,
  options: {
    readonly focusExemptFileCount: number;
    readonly filteredBridgeExemptFileCount: number;
    readonly nested: boolean;
  },
): FocusSchematicSoftFolderCoverageEvidence {
  const preCompressionByKey = new Map(
    tree.preCompressionFolders.map((folder) => [folder.folderKey, folder]),
  );
  const folderByKey = new Map(
    tree.folders.map((folder) => [folder.folderKey, folder]),
  );
  let groupable = 0;
  let rootExempt = 0;
  let covered = 0;
  let missing = 0;
  let ancestorViolations = 0;
  for (const file of tree.files) {
    if (file.directDisplayParentFolderKey === '.') {
      rootExempt += 1;
      continue;
    }
    groupable += 1;
    const immediate = preCompressionByKey.get(
      file.directDisplayParentFolderKey,
    );
    if (immediate?.directFileIds.includes(file.fileId)) covered += 1;
    else missing += 1;
    if (!options.nested) continue;
    let current: WorkspaceFolderKey | null = file.displayParentFolderKey;
    while (current !== null && current !== '.') {
      const folder = folderByKey.get(current);
      if (
        folder === undefined ||
        !folder.descendantFileIds.includes(file.fileId)
      ) {
        ancestorViolations += 1;
        break;
      }
      current = folder.displayParentFolderKey;
    }
  }
  return {
    groupableVisibleFileCount: groupable,
    workspaceRootExemptFileCount: rootExempt,
    focusExemptFileCount: options.focusExemptFileCount,
    filteredBridgeExemptFileCount: options.filteredBridgeExemptFileCount,
    immediateFolderCoveredFileCount: covered,
    missingImmediateFolderGuideCount: missing,
    nestedAncestorCoverageViolationCount: ancestorViolations,
  };
}
