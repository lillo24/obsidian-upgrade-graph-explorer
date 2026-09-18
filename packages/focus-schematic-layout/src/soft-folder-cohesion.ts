import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';

import { FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING } from './soft-cluster-spacing';
import {
  partitionFocusSchematicSoftFolderGuideIslands,
  type FocusSchematicSoftFolderGuideUnit,
} from './soft-folder-guide-geometry';
import type { FocusSchematicSoftFolderDisplayTree } from './types';

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface FocusSchematicSoftFolderCohesionApplicationEvidence {
  readonly immediateFolderGroupCount: number;
  readonly immediateFolderSingletonCount: number;
  readonly immediateFolderCohesionMoveMean: number;
  readonly immediateFolderCohesionMoveP95: number;
  readonly immediateFolderCohesionMoveMax: number;
}

export interface FocusSchematicSoftFolderCohesionQuality {
  readonly immediateFolderRmsRadiusMean: number | null;
  readonly immediateFolderRmsRadiusP95: number | null;
  readonly immediateFolderMaxPairDistanceMean: number | null;
  readonly immediateFolderMaxPairDistanceP95: number | null;
  readonly immediateFolderSplitViolationCount: number;
}

export interface FocusSchematicSoftFolderCohesionResult {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly evidence: FocusSchematicSoftFolderCohesionApplicationEvidence;
}

const center = (rectangle: FocusSchematicRectangle): Point => ({
  x: rectangle.x + rectangle.width / 2,
  y: rectangle.y + rectangle.height / 2,
});

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ]!;
}

function namedImmediateGroups(tree: FocusSchematicSoftFolderDisplayTree) {
  const groups = new Map<string, string[]>();
  for (const file of tree.files) {
    if (file.directDisplayParentFolderKey === '.') continue;
    const members = groups.get(file.directDisplayParentFolderKey) ?? [];
    members.push(file.fileId);
    groups.set(file.directDisplayParentFolderKey, members);
  }
  return [...groups.entries()]
    .map(([folderKey, memberModuleIds]) => ({
      folderKey,
      memberModuleIds: memberModuleIds.sort(compareText),
    }))
    .sort((left, right) => compareText(left.folderKey, right.folderKey));
}

function compactGrid(
  modules: readonly FocusSchematicLayoutCandidate['modules'][number][],
): ReadonlyMap<string, Point> {
  const ordered = [...modules].sort(
    (left, right) =>
      center(left).y - center(right).y ||
      center(left).x - center(right).x ||
      compareText(left.moduleId, right.moduleId),
  );
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
  const rows = Math.ceil(ordered.length / columns);
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);
  ordered.forEach((module, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column]!, module.width);
    rowHeights[row] = Math.max(rowHeights[row]!, module.height);
  });
  const gap = FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING.moduleGap;
  const columnX = columnWidths.map((_, index) =>
    columnWidths.slice(0, index).reduce((sum, width) => sum + width + gap, 0),
  );
  const rowY = rowHeights.map((_, index) =>
    rowHeights.slice(0, index).reduce((sum, height) => sum + height + gap, 0),
  );
  return new Map(
    ordered.map((module, index) => [
      module.moduleId,
      {
        x: columnX[index % columns]!,
        y: rowY[Math.floor(index / columns)]!,
      },
    ]),
  );
}

function compactRow(
  modules: readonly FocusSchematicLayoutCandidate['modules'][number][],
): ReadonlyMap<string, Point> {
  const ordered = [...modules].sort(
    (left, right) =>
      center(left).x - center(right).x ||
      center(left).y - center(right).y ||
      compareText(left.moduleId, right.moduleId),
  );
  const gap = FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING.moduleGap;
  let x = 0;
  const positions = new Map<string, Point>();
  for (const module of ordered) {
    positions.set(module.moduleId, { x, y: 0 });
    x += module.width + gap;
  }
  return positions;
}

function translatedLocalPositions(
  modules: readonly FocusSchematicLayoutCandidate['modules'][number][],
  local: ReadonlyMap<string, Point>,
  rootModuleId: string,
): ReadonlyMap<string, Point> {
  const root = modules.find(({ moduleId }) => moduleId === rootModuleId);
  let dx: number;
  let dy: number;
  if (root !== undefined) {
    const rootLocal = local.get(root.moduleId)!;
    dx = root.x - rootLocal.x;
    dy = root.y - rootLocal.y;
  } else {
    const originalCenter = modules.reduce(
      (sum, module) => {
        const point = center(module);
        return {
          x: sum.x + point.x / modules.length,
          y: sum.y + point.y / modules.length,
        };
      },
      { x: 0, y: 0 },
    );
    const localRectangles = modules.map((module) => {
      const point = local.get(module.moduleId)!;
      return { ...module, ...point };
    });
    const left = Math.min(...localRectangles.map(({ x }) => x));
    const top = Math.min(...localRectangles.map(({ y }) => y));
    const right = Math.max(...localRectangles.map(({ x, width }) => x + width));
    const bottom = Math.max(
      ...localRectangles.map(({ y, height }) => y + height),
    );
    dx = originalCenter.x - (left + right) / 2;
    dy = originalCenter.y - (top + bottom) / 2;
  }
  return new Map(
    [...local].map(([moduleId, point]) => [
      moduleId,
      { x: point.x + dx, y: point.y + dy },
    ]),
  );
}

function guideUnits(
  modules: readonly FocusSchematicLayoutCandidate['modules'][number][],
  positions: ReadonlyMap<string, Point>,
): FocusSchematicSoftFolderGuideUnit[] {
  return modules.map((module) => ({
    id: module.moduleId,
    ...module,
    ...positions.get(module.moduleId)!,
  }));
}

function coherentPositions(
  modules: readonly FocusSchematicLayoutCandidate['modules'][number][],
  rootModuleId: string,
): ReadonlyMap<string, Point> {
  const grid = translatedLocalPositions(
    modules,
    compactGrid(modules),
    rootModuleId,
  );
  if (
    partitionFocusSchematicSoftFolderGuideIslands(guideUnits(modules, grid), [])
      .length === 1
  )
    return grid;
  return translatedLocalPositions(modules, compactRow(modules), rootModuleId);
}

/**
 * Compacts direct members of each named immediate folder before compound-body
 * packing. Only whole-module translations are applied; the Focus module is
 * fixed when its immediate folder is compacted.
 */
export function applyFocusSchematicSoftFolderCohesion(
  candidate: FocusSchematicLayoutCandidate,
  tree: FocusSchematicSoftFolderDisplayTree,
  rootModuleId: string,
): FocusSchematicSoftFolderCohesionResult {
  const groups = namedImmediateGroups(tree);
  let compacted = candidate;
  const movements: number[] = [];
  for (const group of groups) {
    const moduleById = new Map(
      compacted.modules.map((module) => [module.moduleId, module]),
    );
    const modules = group.memberModuleIds.flatMap((moduleId) => {
      const module = moduleById.get(moduleId);
      return module === undefined ? [] : [module];
    });
    if (modules.length <= 1) {
      if (modules.length === 1) movements.push(0);
      continue;
    }
    const positions = coherentPositions(modules, rootModuleId);
    const translations = new Map(
      modules.map((module) => {
        const position = positions.get(module.moduleId)!;
        return [
          module.moduleId,
          { x: position.x - module.x, y: position.y - module.y },
        ];
      }),
    );
    for (const translation of translations.values())
      movements.push(Math.hypot(translation.x, translation.y));
    compacted = {
      ...compacted,
      modules: compacted.modules.map((module) => {
        const translation = translations.get(module.moduleId);
        return translation === undefined
          ? module
          : {
              ...module,
              x: module.x + translation.x,
              y: module.y + translation.y,
            };
      }),
      nodes: compacted.nodes.map((node) => {
        const translation = translations.get(node.moduleId);
        return translation === undefined
          ? node
          : {
              ...node,
              x: node.x + translation.x,
              y: node.y + translation.y,
            };
      }),
      routes: [],
    };
  }
  return {
    candidate: compacted,
    evidence: {
      immediateFolderGroupCount: groups.length,
      immediateFolderSingletonCount: groups.filter(
        ({ memberModuleIds }) => memberModuleIds.length === 1,
      ).length,
      immediateFolderCohesionMoveMean:
        movements.reduce((sum, value) => sum + value, 0) /
        Math.max(1, movements.length),
      immediateFolderCohesionMoveP95: percentile(movements, 0.95),
      immediateFolderCohesionMoveMax: Math.max(0, ...movements),
    },
  };
}

/** Measures the shared renderer island oracle and compactness of direct groups. */
export function measureFocusSchematicSoftFolderCohesion(
  candidate: FocusSchematicLayoutCandidate,
  tree: FocusSchematicSoftFolderDisplayTree,
): FocusSchematicSoftFolderCohesionQuality {
  const moduleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const allUnits = candidate.modules.map((module) => ({
    id: module.moduleId,
    ...module,
  }));
  const radii: number[] = [];
  const maximumPairDistances: number[] = [];
  let violations = 0;
  for (const group of namedImmediateGroups(tree)) {
    const members = group.memberModuleIds.flatMap((moduleId) => {
      const module = moduleById.get(moduleId);
      return module === undefined ? [] : [{ id: moduleId, ...module }];
    });
    if (members.length === 0) continue;
    const memberIds = new Set(members.map(({ id }) => id));
    const blockers = allUnits.filter(({ id }) => !memberIds.has(id));
    if (
      partitionFocusSchematicSoftFolderGuideIslands(members, blockers)
        .length !== 1
    )
      violations += 1;
    const centers = members.map(center);
    const centroid = centers.reduce(
      (sum, point) => ({
        x: sum.x + point.x / centers.length,
        y: sum.y + point.y / centers.length,
      }),
      { x: 0, y: 0 },
    );
    radii.push(
      Math.sqrt(
        centers.reduce(
          (sum, point) =>
            sum + (point.x - centroid.x) ** 2 + (point.y - centroid.y) ** 2,
          0,
        ) / centers.length,
      ),
    );
    let maximum = 0;
    for (let left = 0; left < centers.length; left += 1)
      for (let right = left + 1; right < centers.length; right += 1)
        maximum = Math.max(
          maximum,
          Math.hypot(
            centers[right]!.x - centers[left]!.x,
            centers[right]!.y - centers[left]!.y,
          ),
        );
    maximumPairDistances.push(maximum);
  }
  const mean = (values: readonly number[]): number | null =>
    values.length === 0
      ? null
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    immediateFolderRmsRadiusMean: mean(radii),
    immediateFolderRmsRadiusP95:
      radii.length === 0 ? null : percentile(radii, 0.95),
    immediateFolderMaxPairDistanceMean: mean(maximumPairDistances),
    immediateFolderMaxPairDistanceP95:
      maximumPairDistances.length === 0
        ? null
        : percentile(maximumPairDistances, 0.95),
    immediateFolderSplitViolationCount: violations,
  };
}
