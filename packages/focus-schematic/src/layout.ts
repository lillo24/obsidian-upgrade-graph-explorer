import type { EntityId } from '@icarus-graph-explorer/core';

import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicLayoutQuality,
  FocusSchematicLayoutValidationIssue,
  FocusSchematicLayoutValidationResult,
  FocusSchematicModel,
  FocusSchematicRectangle,
  FocusSchematicStabilityQuality,
} from './types';

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const center = (rectangle: FocusSchematicRectangle) => ({
  x: rectangle.x + rectangle.width / 2,
  y: rectangle.y + rectangle.height / 2,
});
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const percentile = (values: readonly number[], fraction: number): number => {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(fraction * ordered.length) - 1] ?? 0;
};
const finiteRectangle = (value: FocusSchematicRectangle): boolean =>
  [value.x, value.y, value.width, value.height].every(Number.isFinite) &&
  value.width > 0 &&
  value.height > 0;
const overlap = (
  a: FocusSchematicRectangle,
  b: FocusSchematicRectangle,
  clearance: number,
): boolean =>
  a.x < b.x + b.width + clearance &&
  a.x + a.width + clearance > b.x &&
  a.y < b.y + b.height + clearance &&
  a.y + a.height + clearance > b.y;

function duplicateValues(values: readonly string[]): string[] {
  return [
    ...new Set(
      values.filter((value, index) => values.indexOf(value) !== index),
    ),
  ].sort(compareText);
}

function hasExactKeys(value: unknown, keys: readonly string[]): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).sort().join('|') === [...keys].sort().join('|')
  );
}

export function validateFocusSchematicLayoutCandidate(
  model: FocusSchematicModel,
  value: unknown,
): FocusSchematicLayoutValidationResult {
  const issues: FocusSchematicLayoutValidationIssue[] = [];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {
      valid: false,
      issues: [
        {
          code: 'invalid-shape',
          path: '$',
          message: 'Candidate must be a plain object.',
        },
      ],
    };
  }
  const candidate = value as Partial<FocusSchematicLayoutCandidate>;
  const expectedKeys = [
    'modelSchemaVersion',
    'modules',
    'nodes',
    'rootModuleId',
    'routes',
  ];
  if (
    !hasExactKeys(value, expectedKeys) ||
    candidate.modelSchemaVersion !== 1 ||
    candidate.rootModuleId !== model.rootModuleId ||
    !Array.isArray(candidate.modules) ||
    !Array.isArray(candidate.nodes) ||
    !Array.isArray(candidate.routes)
  ) {
    return {
      valid: false,
      issues: [
        {
          code: 'invalid-shape',
          path: '$',
          message: 'Candidate has unsupported or missing top-level fields.',
        },
      ],
    };
  }
  const moduleIds = candidate.modules.map((item) => item?.moduleId);
  const nodeIds = candidate.nodes.map((item) => item?.projectionNodeId);
  const routeIds = candidate.routes.map((item) => item?.relationshipId);
  const expectedModules = new Set(model.modules.map(({ id }) => id));
  const expectedNodes = new Set(
    model.modules.flatMap(({ visibleEntityNodeIds }) => visibleEntityNodeIds),
  );
  const expectedNodeOwner = new Map(
    model.modules.flatMap((module) =>
      module.visibleEntityNodeIds.map((nodeId) => [nodeId, module.id] as const),
    ),
  );
  const expectedRoutes = new Set(model.relationships.map(({ id }) => id));
  for (const id of duplicateValues(moduleIds))
    issues.push({
      code: 'coverage',
      path: '$.modules',
      message: `Duplicate module "${id}".`,
    });
  for (const id of duplicateValues(nodeIds))
    issues.push({
      code: 'coverage',
      path: '$.nodes',
      message: `Duplicate node "${id}".`,
    });
  for (const id of duplicateValues(routeIds))
    issues.push({
      code: 'coverage',
      path: '$.routes',
      message: `Duplicate route "${id}".`,
    });
  for (const id of expectedModules)
    if (!moduleIds.includes(id))
      issues.push({
        code: 'coverage',
        path: '$.modules',
        message: `Missing module "${id}".`,
      });
  for (const id of moduleIds)
    if (!expectedModules.has(id))
      issues.push({
        code: 'coverage',
        path: '$.modules',
        message: `Unexpected module "${id}".`,
      });
  for (const id of expectedNodes)
    if (!nodeIds.includes(id))
      issues.push({
        code: 'coverage',
        path: '$.nodes',
        message: `Missing node "${id}".`,
      });
  for (const id of nodeIds)
    if (!expectedNodes.has(id))
      issues.push({
        code: 'coverage',
        path: '$.nodes',
        message: `Unexpected node "${id}".`,
      });
  candidate.modules.forEach((item, index) => {
    if (
      !hasExactKeys(item, ['moduleId', 'x', 'y', 'width', 'height']) ||
      !finiteRectangle(item)
    )
      issues.push({
        code: 'invalid-geometry',
        path: `$.modules[${index}]`,
        message: 'Module geometry must be finite with positive dimensions.',
      });
  });
  candidate.nodes.forEach((item, index) => {
    if (
      !hasExactKeys(item, [
        'projectionNodeId',
        'moduleId',
        'x',
        'y',
        'width',
        'height',
      ]) ||
      !finiteRectangle(item) ||
      !expectedModules.has(item.moduleId) ||
      expectedNodeOwner.get(item.projectionNodeId) !== item.moduleId
    )
      issues.push({
        code: 'invalid-geometry',
        path: `$.nodes[${index}]`,
        message: 'Node geometry and module ownership must be valid.',
      });
  });
  candidate.routes.forEach((route, index) => {
    if (
      !hasExactKeys(route, ['relationshipId', 'points']) ||
      !expectedRoutes.has(route.relationshipId) ||
      !Array.isArray(route.points) ||
      route.points.length < 2 ||
      route.points.some(
        (point: { readonly x: number; readonly y: number }) =>
          !hasExactKeys(point, ['x', 'y']) ||
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y),
      )
    ) {
      issues.push({
        code: 'invalid-geometry',
        path: `$.routes[${index}]`,
        message:
          'Route must identify a relationship and contain at least two finite points.',
      });
    }
  });
  return issues.length > 0
    ? { valid: false, issues }
    : {
        valid: true,
        value: candidate as FocusSchematicLayoutCandidate,
        issues: [],
      };
}

function pairOverlaps<T extends FocusSchematicRectangle>(
  values: readonly T[],
  id: (value: T) => string,
  clearance: number,
): string[] {
  const pairs: string[] = [];
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      const a = values[left];
      const b = values[right];
      if (
        a !== undefined &&
        b !== undefined &&
        finiteRectangle(a) &&
        finiteRectangle(b) &&
        overlap(a, b, clearance)
      ) {
        pairs.push([id(a), id(b)].sort(compareText).join('|'));
      }
    }
  }
  return pairs.sort(compareText);
}

type Point = { readonly x: number; readonly y: number };
function orientation(a: Point, b: Point, c: Point): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}
function segmentCrosses(a: Point, b: Point, c: Point, d: Point): boolean {
  return (
    orientation(a, b, c) * orientation(a, b, d) < 0 &&
    orientation(c, d, a) * orientation(c, d, b) < 0
  );
}
function routeCrosses(
  left: readonly Point[],
  right: readonly Point[],
): boolean {
  for (let a = 1; a < left.length; a += 1) {
    for (let b = 1; b < right.length; b += 1) {
      const l0 = left[a - 1],
        l1 = left[a],
        r0 = right[b - 1],
        r1 = right[b];
      if (l0 && l1 && r0 && r1 && segmentCrosses(l0, l1, r0, r1)) return true;
    }
  }
  return false;
}
function segmentIntersectsRectangle(
  a: Point,
  b: Point,
  rectangle: FocusSchematicRectangle,
): boolean {
  const corners = [
    { x: rectangle.x, y: rectangle.y },
    { x: rectangle.x + rectangle.width, y: rectangle.y },
    { x: rectangle.x + rectangle.width, y: rectangle.y + rectangle.height },
    { x: rectangle.x, y: rectangle.y + rectangle.height },
  ];
  return corners.some((corner, index) =>
    segmentCrosses(a, b, corner, corners[(index + 1) % 4] ?? corner),
  );
}

export function evaluateFocusSchematicLayout(
  model: FocusSchematicModel,
  candidate: FocusSchematicLayoutCandidate,
  options: {
    readonly clearance?: number;
    readonly rankTolerance?: number;
  } = {},
): FocusSchematicLayoutQuality {
  const clearance = options.clearance ?? 0;
  const rankTolerance = options.rankTolerance ?? 0;
  const modelIds = new Set(model.modules.map(({ id }) => id));
  const visibleNodeIds = new Set(
    model.modules.flatMap(({ visibleEntityNodeIds }) => visibleEntityNodeIds),
  );
  const moduleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const nodeById = new Map(
    candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const rootRectangle = moduleById.get(model.rootModuleId);
  const rootCenter =
    rootRectangle === undefined ? undefined : center(rootRectangle);
  const finiteModules = candidate.modules.filter(finiteRectangle);
  const nonFiniteGeometryCount =
    [...candidate.modules, ...candidate.nodes].filter(
      (rectangle) => !finiteRectangle(rectangle),
    ).length +
    candidate.routes.reduce(
      (count, route) =>
        count +
        route.points.filter(
          (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
        ).length,
      0,
    );
  const bounds =
    finiteModules.length === 0
      ? undefined
      : {
          minX: Math.min(...finiteModules.map(({ x }) => x)),
          minY: Math.min(...finiteModules.map(({ y }) => y)),
          maxX: Math.max(...finiteModules.map(({ x, width }) => x + width)),
          maxY: Math.max(...finiteModules.map(({ y, height }) => y + height)),
        };
  const totalBoundsWidth = bounds === undefined ? 0 : bounds.maxX - bounds.minX;
  const totalBoundsHeight =
    bounds === undefined ? 0 : bounds.maxY - bounds.minY;
  const totalBoundsArea = totalBoundsWidth * totalBoundsHeight;
  const leftSideViolationModuleIds: EntityId[] = [];
  const rightSideViolationModuleIds: EntityId[] = [];
  const rankOrderViolationModuleIds: EntityId[] = [];
  if (rootCenter !== undefined) {
    for (const module of model.modules) {
      const rectangle = moduleById.get(module.id);
      if (rectangle === undefined || !finiteRectangle(rectangle)) continue;
      const x = center(rectangle).x;
      if (
        module.placement.allowedSides.length === 1 &&
        module.placement.allowedSides[0] === 'left' &&
        x >= rootCenter.x
      )
        leftSideViolationModuleIds.push(module.id);
      if (
        module.placement.allowedSides.length === 1 &&
        module.placement.allowedSides[0] === 'right' &&
        x <= rootCenter.x
      )
        rightSideViolationModuleIds.push(module.id);
      if (
        module.placement.preferredSide === 'left' ||
        module.placement.preferredSide === 'right'
      ) {
        const nearer = model.modules
          .filter(
            (other) =>
              other.placement.preferredSide ===
                module.placement.preferredSide &&
              other.placement.rankMagnitude < module.placement.rankMagnitude,
          )
          .map(({ id }) => moduleById.get(id))
          .filter(
            (item): item is NonNullable<typeof item> => item !== undefined,
          );
        if (
          nearer.some(
            (other) =>
              Math.abs(center(other).x - rootCenter.x) >
              Math.abs(x - rootCenter.x) + rankTolerance,
          )
        ) {
          rankOrderViolationModuleIds.push(module.id);
        }
      }
    }
  }
  const nodeOutsideModuleIds = candidate.nodes
    .filter((node) => {
      const owner = moduleById.get(node.moduleId);
      return (
        owner === undefined ||
        node.x < owner.x ||
        node.y < owner.y ||
        node.x + node.width > owner.x + owner.width ||
        node.y + node.height > owner.y + owner.height
      );
    })
    .map(({ projectionNodeId }) => projectionNodeId)
    .sort(compareText);
  const yOrdered = finiteModules
    .map((rectangle) => ({
      rectangle,
      module: model.modules.find(({ id }) => id === rectangle.moduleId),
    }))
    .filter(
      (
        item,
      ): item is typeof item & {
        module: FocusSchematicModel['modules'][number];
      } => item.module !== undefined,
    )
    .sort(
      (a, b) =>
        center(a.rectangle).y - center(b.rectangle).y ||
        compareText(a.module.id, b.module.id),
    );
  const adjacencySamples = Math.max(0, yOrdered.length - 1);
  const sameAdjacency = yOrdered
    .slice(1)
    .filter(
      (item, index) =>
        item.module.folderKey === yOrdered[index]?.module.folderKey,
    ).length;
  const sameFolderDistances: number[] = [];
  for (let left = 0; left < yOrdered.length; left += 1) {
    for (let right = left + 1; right < yOrdered.length; right += 1) {
      const a = yOrdered[left],
        b = yOrdered[right];
      if (a && b && a.module.folderKey === b.module.folderKey)
        sameFolderDistances.push(
          Math.abs(center(a.rectangle).y - center(b.rectangle).y),
        );
    }
  }
  const rootFolder = model.modules.find(
    ({ id }) => id === model.rootModuleId,
  )?.folderKey;
  const rootFolderCenters = yOrdered
    .filter(({ module }) => module.folderKey === rootFolder)
    .map(({ rectangle }) => center(rectangle).y);
  const allCenterY =
    yOrdered.length === 0
      ? 0
      : yOrdered.reduce((sum, { rectangle }) => sum + center(rectangle).y, 0) /
        yOrdered.length;

  const relationshipById = new Map(
    model.relationships.map((relationship) => [relationship.id, relationship]),
  );
  let focusPathCrossingCount: number | null = null;
  let secondaryCrossingCount: number | null = null;
  let edgeNodeIntersectionCount: number | null = null;
  let approximateCrossingCount: number | null = null;
  if (candidate.routes.length > 0) {
    focusPathCrossingCount = 0;
    secondaryCrossingCount = 0;
    edgeNodeIntersectionCount = 0;
    for (let left = 0; left < candidate.routes.length; left += 1) {
      const a = candidate.routes[left];
      if (a === undefined) continue;
      for (let right = left + 1; right < candidate.routes.length; right += 1) {
        const b = candidate.routes[right];
        if (b === undefined || !routeCrosses(a.points, b.points)) continue;
        const secondary =
          relationshipById.get(a.relationshipId)?.secondary === true ||
          relationshipById.get(b.relationshipId)?.secondary === true;
        if (secondary) secondaryCrossingCount += 1;
        else focusPathCrossingCount += 1;
      }
      for (let index = 1; index < a.points.length; index += 1) {
        const start = a.points[index - 1],
          end = a.points[index];
        const relationship = relationshipById.get(a.relationshipId);
        if (start && end)
          edgeNodeIntersectionCount += candidate.nodes.filter(
            (node) =>
              node.moduleId !== relationship?.sourceModuleId &&
              node.moduleId !== relationship?.targetModuleId &&
              segmentIntersectsRectangle(start, end, node),
          ).length;
      }
    }
  } else {
    const segments = model.relationships.flatMap((relationship) => {
      const source = moduleById.get(relationship.sourceModuleId);
      const target = moduleById.get(relationship.targetModuleId);
      return source === undefined || target === undefined
        ? []
        : [[center(source), center(target)] as const];
    });
    approximateCrossingCount = 0;
    for (let left = 0; left < segments.length; left += 1)
      for (let right = left + 1; right < segments.length; right += 1) {
        const a = segments[left],
          b = segments[right];
        if (a && b && segmentCrosses(a[0], a[1], b[0], b[1]))
          approximateCrossingCount += 1;
      }
  }
  const alignmentErrors = model.relationships.flatMap((relationship) =>
    relationship.visibleEndpointGroups.flatMap((group) => {
      if (
        group.sourcePrecision === 'document' &&
        group.targetPrecision === 'document'
      )
        return [];
      const source = nodeById.get(group.sourceProjectionNodeId);
      const target = nodeById.get(group.targetProjectionNodeId);
      return source === undefined || target === undefined
        ? []
        : [Math.abs(center(source).y - center(target).y)];
    }),
  );

  return {
    moduleOverlapPairs: pairOverlaps(
      candidate.modules,
      ({ moduleId }) => moduleId,
      clearance,
    ),
    nodeOverlapPairs: pairOverlaps(
      candidate.nodes,
      ({ projectionNodeId }) => projectionNodeId,
      clearance,
    ),
    nodeOutsideModuleIds,
    missingModuleIds: [...modelIds]
      .filter((id) => !moduleById.has(id))
      .sort(compareText),
    missingVisibleNodeIds: [...visibleNodeIds]
      .filter((id) => !nodeById.has(id))
      .sort(compareText),
    unexpectedModuleIds: candidate.modules
      .map(({ moduleId }) => moduleId)
      .filter((id) => !modelIds.has(id))
      .sort(compareText),
    unexpectedNodeIds: candidate.nodes
      .map(({ projectionNodeId }) => projectionNodeId)
      .filter((id) => !visibleNodeIds.has(id))
      .sort(compareText),
    nonFiniteGeometryCount,
    rootCenterOffsetX:
      rootCenter === undefined || bounds === undefined
        ? null
        : rootCenter.x - (bounds.minX + bounds.maxX) / 2,
    rootCenterOffsetY:
      rootCenter === undefined || bounds === undefined
        ? null
        : rootCenter.y - (bounds.minY + bounds.maxY) / 2,
    leftSideViolationModuleIds: leftSideViolationModuleIds.sort(compareText),
    rightSideViolationModuleIds: rightSideViolationModuleIds.sort(compareText),
    rankOrderViolationModuleIds: rankOrderViolationModuleIds.sort(compareText),
    totalBoundsWidth,
    totalBoundsHeight,
    totalBoundsArea,
    aspectRatio:
      totalBoundsHeight === 0 ? null : totalBoundsWidth / totalBoundsHeight,
    emptyAreaRatio:
      totalBoundsArea === 0
        ? null
        : Math.max(
            0,
            1 -
              finiteModules.reduce(
                (sum, item) => sum + item.width * item.height,
                0,
              ) /
                totalBoundsArea,
          ),
    sameFolderAdjacencyRatio:
      adjacencySamples === 0 ? null : sameAdjacency / adjacencySamples,
    rootFolderCenterOffset:
      rootFolderCenters.length === 0
        ? null
        : rootFolderCenters.reduce((a, b) => a + b, 0) /
            rootFolderCenters.length -
          allCenterY,
    meanSameFolderVerticalDistance:
      sameFolderDistances.length === 0
        ? null
        : sameFolderDistances.reduce((a, b) => a + b, 0) /
          sameFolderDistances.length,
    routingAvailable: candidate.routes.length > 0,
    focusPathCrossingCount,
    secondaryCrossingCount,
    edgeNodeIntersectionCount,
    approximateCrossingCount,
    meanAttachmentAlignmentError:
      alignmentErrors.length === 0
        ? null
        : alignmentErrors.reduce((a, b) => a + b, 0) / alignmentErrors.length,
    p95AttachmentAlignmentError:
      alignmentErrors.length === 0 ? null : percentile(alignmentErrors, 0.95),
    attachmentSampleCount: alignmentErrors.length,
  };
}

export function compareFocusSchematicLayouts(input: {
  readonly beforeModel: FocusSchematicModel;
  readonly beforeLayout: FocusSchematicLayoutCandidate;
  readonly afterModel: FocusSchematicModel;
  readonly afterLayout: FocusSchematicLayoutCandidate;
  readonly unaffectedModuleIds?: readonly EntityId[];
}): FocusSchematicStabilityQuality {
  const beforeIds = new Set(input.beforeModel.modules.map(({ id }) => id));
  const afterIds = new Set(input.afterModel.modules.map(({ id }) => id));
  const before = new Map(
    input.beforeLayout.modules.map((item) => [item.moduleId, center(item)]),
  );
  const after = new Map(
    input.afterLayout.modules.map((item) => [item.moduleId, center(item)]),
  );
  const shared = [...beforeIds]
    .filter((id) => afterIds.has(id) && before.has(id) && after.has(id))
    .sort(compareText);
  const displacements = shared.map((id) =>
    distance(before.get(id)!, after.get(id)!),
  );
  const beforeRoot = before.get(input.beforeModel.rootModuleId);
  const afterRoot = after.get(input.afterModel.rootModuleId);
  const rootDelta =
    beforeRoot && afterRoot
      ? { x: afterRoot.x - beforeRoot.x, y: afterRoot.y - beforeRoot.y }
      : undefined;
  const rootRelative = shared.map((id) => {
    const a = before.get(id)!,
      b = after.get(id)!;
    return rootDelta === undefined
      ? distance(a, b)
      : Math.hypot(b.x - a.x - rootDelta.x, b.y - a.y - rootDelta.y);
  });
  const unaffected = new Set(input.unaffectedModuleIds ?? shared);
  const unaffectedDisplacements = shared.flatMap((id, index) =>
    unaffected.has(id) ? [displacements[index] ?? 0] : [],
  );
  return {
    rootCenterDisplacement:
      beforeRoot === undefined || afterRoot === undefined
        ? null
        : distance(beforeRoot, afterRoot),
    rootRelativeMedianSharedModuleDisplacement: percentile(rootRelative, 0.5),
    medianSharedModuleDisplacement: percentile(displacements, 0.5),
    p95SharedModuleDisplacement: percentile(displacements, 0.95),
    maximumSharedModuleDisplacement:
      displacements.length === 0 ? 0 : Math.max(...displacements),
    sharedModuleCount: shared.length,
    addedModuleCount: [...afterIds].filter((id) => !beforeIds.has(id)).length,
    removedModuleCount: [...beforeIds].filter((id) => !afterIds.has(id)).length,
    unaffectedModuleCount: unaffectedDisplacements.length,
    medianUnaffectedModuleDisplacement:
      unaffectedDisplacements.length === 0
        ? null
        : percentile(unaffectedDisplacements, 0.5),
  };
}
