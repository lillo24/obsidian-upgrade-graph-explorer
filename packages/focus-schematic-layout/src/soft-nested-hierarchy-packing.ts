import type { WorkspaceFolderKey } from '@icarus-graph-explorer/core';
import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';

import {
  focusSchematicSoftFolderGuideConvexHull,
  focusSchematicSoftFolderGuidePaddedCorners,
  focusSchematicSoftFolderGuidePointInsidePolygon,
  partitionFocusSchematicSoftFolderGuideIslands,
} from './soft-folder-guide-geometry';
import type { FocusSchematicSoftFolderDisplayTree } from './types';

const UNIT_GAP = 72;
const EPSILON = 1e-9;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface PackingUnit {
  readonly id: string;
  readonly memberModuleIds: readonly string[];
  readonly envelope: FocusSchematicRectangle;
}

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

function namedFolders(tree: FocusSchematicSoftFolderDisplayTree) {
  return tree.folders.filter(({ folderKey }) => folderKey !== '.');
}

function hierarchyQuality(
  candidate: FocusSchematicLayoutCandidate,
  tree: FocusSchematicSoftFolderDisplayTree,
): Pick<
  FocusSchematicSoftNestedHierarchyEvidence,
  | 'nestedParentContainmentViolationCount'
  | 'nestedFolderSplitViolationCount'
  | 'nestedGuideBlockerViolationCount'
> {
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
  for (const folder of namedFolders(tree)) {
    const memberIds = new Set(folder.descendantFileIds);
    const members = all.filter(({ id }) => memberIds.has(id));
    const blockers = all.filter(({ id }) => !memberIds.has(id));
    if (members.length === 0) {
      containmentViolations += 1;
      continue;
    }
    if (
      partitionFocusSchematicSoftFolderGuideIslands(members, blockers)
        .length !== 1
    )
      splitViolations += 1;
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
  };
}

/** Packs every retained named folder deepest-first using rigid child subtrees. */
export function applyFocusSchematicSoftNestedHierarchyPacking(
  candidate: FocusSchematicLayoutCandidate,
  tree: FocusSchematicSoftFolderDisplayTree,
): FocusSchematicSoftNestedHierarchyResult {
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
    },
  };
}

export function measureFocusSchematicSoftNestedHierarchy(
  candidate: FocusSchematicLayoutCandidate,
  tree: FocusSchematicSoftFolderDisplayTree,
): Pick<
  FocusSchematicSoftNestedHierarchyEvidence,
  | 'nestedParentContainmentViolationCount'
  | 'nestedFolderSplitViolationCount'
  | 'nestedGuideBlockerViolationCount'
> {
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
