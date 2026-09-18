import type { WorkspaceFolderKey } from '@icarus-graph-explorer/core';
import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';

import {
  FOCUS_SCHEMATIC_SOFT_RADIAL_SPREAD_MAX_SCALE,
  FOCUS_SCHEMATIC_SOFT_RADIAL_SPREAD_MIN_SCALE,
} from './soft-cluster-spacing';
import type {
  FocusSchematicLayoutInput,
  FocusSchematicSoftFolderDisplayTree,
} from './types';
import { FOCUS_SCHEMATIC_LAYOUT_CLEARANCE } from './settings';
import { FOCUS_SCHEMATIC_SOFT_FOLDER_GUIDE_PADDING } from './soft-folder-guide-geometry';

const EPSILON = 1e-9;
const PACKING_STEP = 72;
const PACKING_ANGLE_COUNT = 48;
const PACKING_RING_LIMIT = 180;

interface Point {
  readonly x: number;
  readonly y: number;
}

export type FocusSchematicSoftCompoundBodyKind =
  | 'named-folder'
  | 'workspace-root-singleton'
  | 'workspace-root-group'
  | 'ungrouped-module';

export interface FocusSchematicSoftCompoundBody {
  readonly id: string;
  readonly kind: FocusSchematicSoftCompoundBodyKind;
  readonly folderKey: WorkspaceFolderKey | null;
  readonly memberModuleIds: readonly string[];
  readonly center: Point;
  readonly rectangles: readonly (FocusSchematicRectangle & {
    readonly moduleId: string;
  })[];
  readonly envelope: FocusSchematicRectangle;
  readonly anchored: boolean;
}

export interface FocusSchematicSoftRadialOverlapInterval {
  readonly minimumScale: number;
  readonly maximumScale: number;
}

export interface FocusSchematicSoftGroupPackingEvidence {
  readonly compoundGroupCount: number;
  readonly anchoredGroupCount: number;
  readonly groupPackingIterationCount: number;
  readonly groupPackingCollisionCheckCount: number;
  readonly groupPackingCorrectionCount: number;
  readonly groupPackingMs: number;
  readonly groupTranslationMean: number;
  readonly groupTranslationP95: number;
  readonly groupTranslationMax: number;
  readonly groupEnvelopeAreaMean: number;
  readonly groupEnvelopeAreaP95: number;
  readonly radialSpreadSafetyViolationCount: number;
}

export interface FocusSchematicSoftGroupPackingResult {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly evidence: FocusSchematicSoftGroupPackingEvidence;
}

interface PackingStats {
  iterations: number;
  collisionChecks: number;
  corrections: number;
}

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

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

function bodyEnvelope(
  rectangles: FocusSchematicSoftCompoundBody['rectangles'],
): FocusSchematicRectangle {
  const left = Math.min(...rectangles.map((rectangle) => rectangle.x));
  const top = Math.min(...rectangles.map((rectangle) => rectangle.y));
  const right = Math.max(
    ...rectangles.map((rectangle) => rectangle.x + rectangle.width),
  );
  const bottom = Math.max(
    ...rectangles.map((rectangle) => rectangle.y + rectangle.height),
  );
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function body(
  id: string,
  kind: FocusSchematicSoftCompoundBodyKind,
  folderKey: WorkspaceFolderKey | null,
  memberModuleIds: readonly string[],
  rootModuleId: string,
  moduleById: ReadonlyMap<
    string,
    FocusSchematicLayoutCandidate['modules'][number]
  >,
): FocusSchematicSoftCompoundBody {
  const rectangles = [...memberModuleIds].sort(compareText).map((moduleId) => {
    const rectangle = moduleById.get(moduleId);
    if (rectangle === undefined)
      throw new Error(
        `Soft group packing cannot resolve module "${moduleId}".`,
      );
    return rectangle;
  });
  const reference = rectangles.reduce(
    (sum, rectangle) => {
      const point = center(rectangle);
      return {
        x: sum.x + point.x / rectangles.length,
        y: sum.y + point.y / rectangles.length,
      };
    },
    { x: 0, y: 0 },
  );
  return {
    id,
    kind,
    folderKey,
    memberModuleIds: rectangles.map(({ moduleId }) => moduleId),
    center: reference,
    rectangles,
    envelope: bodyEnvelope(rectangles),
    anchored: memberModuleIds.includes(rootModuleId),
  };
}

/**
 * Builds disjoint immediate-folder bodies. Workspace-root Files remain atomic
 * unless the renderer-only workspace-root grouping option is requested.
 */
export function createFocusSchematicSoftCompoundBodies(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
  tree: FocusSchematicSoftFolderDisplayTree,
  options: { readonly includeWorkspaceRootGroup?: boolean } = {},
): readonly FocusSchematicSoftCompoundBody[] {
  const moduleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const grouped = new Map<
    string,
    {
      kind: FocusSchematicSoftCompoundBodyKind;
      folderKey: WorkspaceFolderKey | null;
      memberModuleIds: string[];
    }
  >();
  const assigned = new Set<string>();
  for (const file of tree.files) {
    if (!moduleById.has(file.fileId)) continue;
    const atWorkspaceRoot = file.directDisplayParentFolderKey === '.';
    const workspaceRootGroup =
      atWorkspaceRoot && options.includeWorkspaceRootGroup === true;
    const id = workspaceRootGroup
      ? 'workspace-root-group'
      : atWorkspaceRoot
        ? `workspace-root-file:${file.fileId}`
        : `folder:${file.directDisplayParentFolderKey}`;
    const value = grouped.get(id) ?? {
      kind: workspaceRootGroup
        ? ('workspace-root-group' as const)
        : atWorkspaceRoot
          ? ('workspace-root-singleton' as const)
          : ('named-folder' as const),
      folderKey: workspaceRootGroup
        ? ('.' as const)
        : atWorkspaceRoot
          ? null
          : file.directDisplayParentFolderKey,
      memberModuleIds: [],
    };
    value.memberModuleIds.push(file.fileId);
    grouped.set(id, value);
    assigned.add(file.fileId);
  }
  for (const moduleId of moduleById.keys()) {
    if (assigned.has(moduleId)) continue;
    grouped.set(`ungrouped-module:${moduleId}`, {
      kind: 'ungrouped-module',
      folderKey: null,
      memberModuleIds: [moduleId],
    });
  }
  return [...grouped.entries()]
    .map(([id, value]) =>
      body(
        id,
        value.kind,
        value.folderKey,
        value.memberModuleIds,
        input.model.rootModuleId,
        moduleById,
      ),
    )
    .sort((left, right) => compareText(left.id, right.id));
}

function linearBandInterval(
  base: number,
  slope: number,
  lower: number,
  upper: number,
  minimumScale: number,
  maximumScale: number,
): FocusSchematicSoftRadialOverlapInterval | null {
  if (Math.abs(slope) <= EPSILON)
    return base >= lower && base <= upper
      ? { minimumScale, maximumScale }
      : null;
  const first = 1 + (lower - base) / slope;
  const second = 1 + (upper - base) / slope;
  const minimum = Math.max(minimumScale, Math.min(first, second));
  const maximum = Math.min(maximumScale, Math.max(first, second));
  return maximum + EPSILON < minimum
    ? null
    : { minimumScale: minimum, maximumScale: maximum };
}

/** Exact affine-scale interval where two cross-group rectangles violate clearance. */
export function radialSpreadOverlapInterval(
  leftBody: FocusSchematicSoftCompoundBody,
  left: FocusSchematicRectangle,
  rightBody: FocusSchematicSoftCompoundBody,
  right: FocusSchematicRectangle,
  minimumScale = FOCUS_SCHEMATIC_SOFT_RADIAL_SPREAD_MIN_SCALE,
  maximumScale = FOCUS_SCHEMATIC_SOFT_RADIAL_SPREAD_MAX_SCALE,
  clearance = FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
): FocusSchematicSoftRadialOverlapInterval | null {
  const leftVelocity = leftBody.anchored ? { x: 0, y: 0 } : leftBody.center;
  const rightVelocity = rightBody.anchored ? { x: 0, y: 0 } : rightBody.center;
  const horizontal = linearBandInterval(
    right.x - left.x,
    rightVelocity.x - leftVelocity.x,
    -(right.width + clearance),
    left.width + clearance,
    minimumScale,
    maximumScale,
  );
  if (horizontal === null) return null;
  const vertical = linearBandInterval(
    right.y - left.y,
    rightVelocity.y - leftVelocity.y,
    -(right.height + clearance),
    left.height + clearance,
    minimumScale,
    maximumScale,
  );
  if (vertical === null) return null;
  const minimum = Math.max(horizontal.minimumScale, vertical.minimumScale);
  const maximum = Math.min(horizontal.maximumScale, vertical.maximumScale);
  return maximum + EPSILON < minimum
    ? null
    : { minimumScale: minimum, maximumScale: maximum };
}

export function countFocusSchematicSoftRadialSpreadSafetyViolations(
  bodies: readonly FocusSchematicSoftCompoundBody[],
  stats?: PackingStats,
): number {
  let violations = 0;
  for (let leftIndex = 0; leftIndex < bodies.length; leftIndex += 1)
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < bodies.length;
      rightIndex += 1
    )
      for (const left of collisionRectangles(bodies[leftIndex]!))
        for (const right of collisionRectangles(bodies[rightIndex]!)) {
          if (stats !== undefined) stats.collisionChecks += 1;
          if (
            radialSpreadOverlapInterval(
              bodies[leftIndex]!,
              left,
              bodies[rightIndex]!,
              right,
            ) !== null
          )
            violations += 1;
        }
  return violations;
}

function collisionRectangles(
  value: FocusSchematicSoftCompoundBody,
): readonly FocusSchematicRectangle[] {
  if (value.kind !== 'named-folder') return value.rectangles;
  const padding = FOCUS_SCHEMATIC_SOFT_FOLDER_GUIDE_PADDING;
  return [
    {
      x: value.envelope.x - padding,
      y: value.envelope.y - padding,
      width: value.envelope.width + padding * 2,
      height: value.envelope.height + padding * 2,
    },
  ];
}

function translateBody(
  value: FocusSchematicSoftCompoundBody,
  dx: number,
  dy: number,
): FocusSchematicSoftCompoundBody {
  const rectangles = value.rectangles.map((rectangle) => ({
    ...rectangle,
    x: rectangle.x + dx,
    y: rectangle.y + dy,
  }));
  return {
    ...value,
    center: { x: value.center.x + dx, y: value.center.y + dy },
    rectangles,
    envelope: bodyEnvelope(rectangles),
  };
}

function bodyIsSafe(
  candidate: FocusSchematicSoftCompoundBody,
  obstacles: readonly FocusSchematicSoftCompoundBody[],
  stats: PackingStats,
): boolean {
  return obstacles.every((obstacle) => {
    for (const own of collisionRectangles(candidate))
      for (const other of collisionRectangles(obstacle)) {
        stats.collisionChecks += 1;
        if (
          radialSpreadOverlapInterval(candidate, own, obstacle, other) !== null
        )
          return false;
      }
    return true;
  });
}

function candidateTranslations(value: FocusSchematicSoftCompoundBody) {
  const preferredAngle = Math.atan2(value.center.y, value.center.x);
  return (function* () {
    yield { x: 0, y: 0, ring: 0 };
    for (let ring = 1; ring <= PACKING_RING_LIMIT; ring += 1) {
      const radius = ring * PACKING_STEP;
      for (let sample = 0; sample < PACKING_ANGLE_COUNT; sample += 1) {
        const angle =
          preferredAngle + (sample / PACKING_ANGLE_COUNT) * Math.PI * 2;
        yield {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          ring,
        };
      }
    }
  })();
}

function placeBody(
  value: FocusSchematicSoftCompoundBody,
  obstacles: readonly FocusSchematicSoftCompoundBody[],
  stats: PackingStats,
): { body: FocusSchematicSoftCompoundBody; translation: Point } {
  if (value.anchored) {
    if (!bodyIsSafe(value, obstacles, stats))
      throw new Error(
        `Anchored Soft compound body "${value.id}" is not radial-spread safe.`,
      );
    return { body: value, translation: { x: 0, y: 0 } };
  }
  for (const translation of candidateTranslations(value)) {
    stats.iterations += 1;
    const candidate = translateBody(value, translation.x, translation.y);
    if (!bodyIsSafe(candidate, obstacles, stats)) continue;
    if (translation.ring > 0) stats.corrections += 1;
    return { body: candidate, translation };
  }
  throw new Error(
    `Soft compound body "${value.id}" could not be packed within the bounded search.`,
  );
}

function translateCandidateModules(
  candidate: FocusSchematicLayoutCandidate,
  moduleIds: ReadonlySet<string>,
  translation: Point,
): FocusSchematicLayoutCandidate {
  if (Math.abs(translation.x) <= EPSILON && Math.abs(translation.y) <= EPSILON)
    return candidate;
  return {
    ...candidate,
    modules: candidate.modules.map((module) =>
      moduleIds.has(module.moduleId)
        ? {
            ...module,
            x: module.x + translation.x,
            y: module.y + translation.y,
          }
        : module,
    ),
    nodes: candidate.nodes.map((node) =>
      moduleIds.has(node.moduleId)
        ? { ...node, x: node.x + translation.x, y: node.y + translation.y }
        : node,
    ),
    routes: [],
  };
}

function orderedForPacking(
  bodies: readonly FocusSchematicSoftCompoundBody[],
): FocusSchematicSoftCompoundBody[] {
  return [...bodies].sort(
    (left, right) =>
      right.envelope.width * right.envelope.height -
        left.envelope.width * left.envelope.height ||
      Math.hypot(left.center.x, left.center.y) -
        Math.hypot(right.center.x, right.center.y) ||
      compareText(left.id, right.id),
  );
}

/**
 * One structural, deterministic compound-body pack. Root-level Files are
 * atomic bodies, while an additional aggregate obstacle makes the same result
 * safe when the renderer-only Workspace-root option is enabled.
 */
export function packFocusSchematicSoftFolderGroups(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
  tree: FocusSchematicSoftFolderDisplayTree,
): FocusSchematicSoftGroupPackingResult {
  const started = performance.now();
  const stats: PackingStats = {
    iterations: 0,
    collisionChecks: 0,
    corrections: 0,
  };
  let packed = candidate;
  let structuralBodies = createFocusSchematicSoftCompoundBodies(
    input,
    packed,
    tree,
  );
  const translations = new Map<string, Point>();
  const anchored = structuralBodies.filter(({ anchored }) => anchored);
  if (anchored.length !== 1)
    throw new Error(
      `Soft group packing requires exactly one Focus-containing body; found ${anchored.length}.`,
    );
  const placed: FocusSchematicSoftCompoundBody[] = [anchored[0]!];

  // Architecture A: root-level Files are structural singleton bodies. Place
  // them first so both their OFF behavior and the optional aggregate ON body
  // become fixed obstacles for every named folder.
  const rootAtoms = orderedForPacking(
    structuralBodies.filter(
      ({ kind, anchored: fixed }) =>
        kind === 'workspace-root-singleton' && !fixed,
    ),
  );
  for (const atom of rootAtoms) {
    const result = placeBody(atom, placed, stats);
    packed = translateCandidateModules(
      packed,
      new Set(atom.memberModuleIds),
      result.translation,
    );
    translations.set(atom.id, result.translation);
    placed.push(result.body);
  }

  structuralBodies = createFocusSchematicSoftCompoundBodies(
    input,
    packed,
    tree,
  );
  const workspaceAggregate = createFocusSchematicSoftCompoundBodies(
    input,
    packed,
    tree,
    { includeWorkspaceRootGroup: true },
  ).find(({ kind }) => kind === 'workspace-root-group');
  const fixedObstacles = [
    ...structuralBodies.filter(
      ({ kind, anchored: fixed }) =>
        fixed || kind === 'workspace-root-singleton',
    ),
    ...(workspaceAggregate === undefined ? [] : [workspaceAggregate]),
  ];
  const moving = orderedForPacking(
    structuralBodies.filter(
      ({ kind, anchored: fixed }) =>
        !fixed && kind !== 'workspace-root-singleton',
    ),
  );
  const finalBodies = [...fixedObstacles];
  for (const value of moving) {
    const result = placeBody(value, finalBodies, stats);
    packed = translateCandidateModules(
      packed,
      new Set(value.memberModuleIds),
      result.translation,
    );
    translations.set(value.id, result.translation);
    finalBodies.push(result.body);
  }

  const offBodies = createFocusSchematicSoftCompoundBodies(input, packed, tree);
  const onBodies = createFocusSchematicSoftCompoundBodies(input, packed, tree, {
    includeWorkspaceRootGroup: true,
  });
  const violations =
    countFocusSchematicSoftRadialSpreadSafetyViolations(offBodies, stats) +
    countFocusSchematicSoftRadialSpreadSafetyViolations(onBodies, stats);
  if (violations > 0)
    throw new Error(
      `Soft group packing left ${violations} continuous radial-spread safety violations.`,
    );
  const translationDistances = offBodies.map((value) => {
    const translation = translations.get(value.id) ?? { x: 0, y: 0 };
    return Math.hypot(translation.x, translation.y);
  });
  const envelopeAreas = offBodies.map(
    ({ envelope }) => envelope.width * envelope.height,
  );
  return {
    candidate: packed,
    evidence: {
      compoundGroupCount: offBodies.length,
      anchoredGroupCount: offBodies.filter(({ anchored: fixed }) => fixed)
        .length,
      groupPackingIterationCount: stats.iterations,
      groupPackingCollisionCheckCount: stats.collisionChecks,
      groupPackingCorrectionCount: stats.corrections,
      groupPackingMs: performance.now() - started,
      groupTranslationMean:
        translationDistances.reduce((sum, value) => sum + value, 0) /
        Math.max(1, translationDistances.length),
      groupTranslationP95: percentile(translationDistances, 0.95),
      groupTranslationMax: Math.max(0, ...translationDistances),
      groupEnvelopeAreaMean:
        envelopeAreas.reduce((sum, value) => sum + value, 0) /
        Math.max(1, envelopeAreas.length),
      groupEnvelopeAreaP95: percentile(envelopeAreas, 0.95),
      radialSpreadSafetyViolationCount: violations,
    },
  };
}
