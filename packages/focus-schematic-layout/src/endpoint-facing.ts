import dagre from '@dagrejs/dagre';
import {
  evaluateFocusSchematicLayout,
  validateFocusSchematicLayoutCandidate,
  type FocusSchematicLayoutCandidate,
  type FocusSchematicModel,
  type FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';
import type { ProjectionNodeId } from '@icarus-graph-explorer/view-projection';

import {
  createFocusSchematicEndpointPlan,
  validateFocusSchematicEndpointPlan,
} from './endpoint-plan';
import {
  measureFocusSchematicEndpointOrder,
  minimizeFocusSchematicEndpointCrossings,
} from './crossing-minimization';
import { assertFocusSchematicLayoutInput } from './input';
import {
  applyFocusSchematicFolderBands,
  evaluateFocusSchematicFolderBandQuality,
  validateSerializedFocusSchematicFolderBandPlan,
} from './folder-bands';
import {
  createFocusSchematicInternalLanePlan,
  validateFocusSchematicInternalLanePlan,
} from './lane-plan';
import {
  applyFocusSchematicInternalLayoutVariant,
  createFocusSchematicInternalLayoutEvidence,
  createFocusSchematicInternalLayoutRunStats,
  FOCUS_SCHEMATIC_INTERNAL_FOLDER_JOINT_ROUND_LIMIT,
} from './internal-layout-variants';
import {
  createFocusSchematicEndpointAttachments,
  measureFocusSchematicAttachmentCrossings,
  type FocusSchematicEndpointAttachmentPolicy,
} from './attachments';
import {
  createFocusSchematicLayoutPlan,
  validateFocusSchematicLayoutPlan,
} from './plan';
import { createFocusSchematicSiblingConstraints } from './source-order';
import {
  FILTERED_MODULE_DIMENSIONS,
  FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
} from './settings';
import type {
  FocusSchematicComputedLayout,
  FocusSchematicComputedLayoutAttempt,
  FocusSchematicComputedLayoutOptions,
  FocusSchematicEndpointAttachmentGeometry,
  FocusSchematicEndpointLayoutPhaseTimings,
  FocusSchematicEndpointLayoutQuality,
  FocusSchematicEndpointPlan,
  FocusSchematicEndpointValidationResult,
  FocusSchematicInternalLanePlan,
  FocusSchematicLayoutInput,
  FocusSchematicLayoutPlan,
  FocusSchematicNativeRoute,
} from './types';
import { validateFocusSchematicSoftFolderDisplayIntent } from './soft-folder-display';

export { createFocusSchematicEndpointAttachments } from './attachments';

const STRATEGY_ID = 'A1-endpoint-facing-split-lanes' as const;
/** Cache/evidence revision for the selected A1 implementation. */
export const FOCUS_SCHEMATIC_SELECTED_LAYOUT_ALGORITHM_VERSION = 3 as const;
const now = () => Date.now();
const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const center = (rectangle: FocusSchematicRectangle) => ({
  x: rectangle.x + rectangle.width / 2,
  y: rectangle.y + rectangle.height / 2,
});
const byteLength = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

interface LocalNode extends FocusSchematicRectangle {
  readonly projectionNodeId: ProjectionNodeId;
}

interface LocalModuleLayout {
  readonly moduleId: string;
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly LocalNode[];
  readonly dagreCallCount: number;
  readonly centerLayoutMs: number;
  readonly leftLayoutMs: number;
  readonly rightLayoutMs: number;
  readonly compositionMs: number;
}

interface RegionLayout {
  readonly nodes: readonly LocalNode[];
  readonly width: number;
  readonly height: number;
}

interface CenterRegionLayout extends RegionLayout {
  readonly dagreCallCount: number;
}

function emptyTimings(totalMs = 0): FocusSchematicEndpointLayoutPhaseTimings {
  return {
    inputMs: 0,
    modulePlanningMs: 0,
    endpointConnectionMs: 0,
    demandCollectionMs: 0,
    subtreePropagationMs: 0,
    laneAssignmentMs: 0,
    centerLayoutMs: 0,
    leftLayoutMs: 0,
    rightLayoutMs: 0,
    compositionMs: 0,
    internalVariantMs: 0,
    macroMs: 0,
    crossingMinimizationMs: 0,
    folderInventoryMs: 0,
    folderInitialOrderMs: 0,
    folderOrderRefinementMs: 0,
    folderRankOrderingMs: 0,
    folderBandPackingMs: 0,
    folderModuleAssignmentMs: 0,
    folderExceptionAnalysisMs: 0,
    folderQualityMs: 0,
    attachmentMs: 0,
    qualityMs: 0,
    validationMs: 0,
    serializationMs: 0,
    totalMs,
    dagreCallCount: 0,
    inputSerializedBytes: 0,
    outputSerializedBytes: 0,
    endpointLaneSerializedBytes: 0,
    folderBandSerializedBytes: 0,
  };
}

function layoutRegion(
  input: FocusSchematicLayoutInput,
  nodeIds: readonly ProjectionNodeId[],
  hierarchyEdgeIds: ReadonlySet<string>,
  rankdir: 'TB' | 'LR' | 'RL',
): RegionLayout {
  if (nodeIds.length === 0) return { nodes: [], width: 0, height: 0 };
  const included = new Set(nodeIds);
  const dimensions = new Map(
    input.nodeDimensions.map((item) => [item.projectionNodeId, item]),
  );
  const sourceOrder = new Map(
    input.projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node.sourceStartLine] as const] : [],
    ),
  );
  const ordered = [...nodeIds].sort(
    (left, right) =>
      (sourceOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (sourceOrder.get(right) ?? Number.MAX_SAFE_INTEGER) ||
      compareText(left, right),
  );
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir,
    nodesep: input.settings.internalNodeSeparation,
    ranksep: input.settings.internalRankSeparation,
    ranker: input.settings.ranker,
  });
  for (const nodeId of ordered) {
    const dimension = dimensions.get(nodeId);
    if (dimension === undefined)
      throw new Error(`Missing dimension for internal node "${nodeId}".`);
    graph.setNode(nodeId, { width: dimension.width, height: dimension.height });
  }
  input.projection.edges
    .filter(
      (edge) =>
        edge.kind === 'hierarchy' &&
        hierarchyEdgeIds.has(edge.id) &&
        included.has(edge.sourceNodeId) &&
        included.has(edge.targetNodeId),
    )
    .sort((left, right) => compareText(left.id, right.id))
    .forEach((edge) =>
      graph.setEdge(
        edge.sourceNodeId,
        edge.targetNodeId,
        { minlen: 1, weight: 8 },
        edge.id,
      ),
    );
  dagre.layout(graph, {
    useDynamic: false,
    constraints: createFocusSchematicSiblingConstraints(
      input.projection,
      included,
    ),
  });
  const raw = ordered.map((projectionNodeId) => {
    const geometry = graph.node(projectionNodeId) as {
      width: number;
      height: number;
      x: number;
      y: number;
    };
    return {
      projectionNodeId,
      x: geometry.x - geometry.width / 2,
      y: geometry.y - geometry.height / 2,
      width: geometry.width,
      height: geometry.height,
    };
  });
  const minX = Math.min(...raw.map(({ x }) => x));
  const minY = Math.min(...raw.map(({ y }) => y));
  const maxX = Math.max(...raw.map(({ x, width }) => x + width));
  const maxY = Math.max(...raw.map(({ y, height }) => y + height));
  return {
    nodes: raw.map((node) => ({
      ...node,
      x: node.x - minX,
      y: node.y - minY,
    })),
    width: maxX - minX,
    height: maxY - minY,
  };
}

function dimensionNode(
  input: FocusSchematicLayoutInput,
  projectionNodeId: ProjectionNodeId,
): LocalNode {
  const dimension = input.nodeDimensions.find(
    (item) => item.projectionNodeId === projectionNodeId,
  );
  if (dimension === undefined)
    throw new Error(
      `Missing dimension for internal node "${projectionNodeId}".`,
    );
  return {
    projectionNodeId,
    x: 0,
    y: 0,
    width: dimension.width,
    height: dimension.height,
  };
}

function stackHeight(
  regions: readonly RegionLayout[],
  separation: number,
): number {
  return regions.reduce(
    (height, region, index) =>
      height + region.height + (index === 0 ? 0 : separation),
    0,
  );
}

/**
 * Composes independent top-level structural branches around one central File.
 * The contiguous source-order cut is chosen from geometry alone, before any
 * endpoint-aware post-pass, so secondary relationships cannot affect it.
 */
function layoutCenterRegion(
  input: FocusSchematicLayoutInput,
  module: FocusSchematicModel['modules'][number],
  centerIds: readonly ProjectionNodeId[],
  hierarchyEdgeIds: ReadonlySet<string>,
  parentByNodeId: ReadonlyMap<ProjectionNodeId, ProjectionNodeId>,
  childrenByNodeId: ReadonlyMap<ProjectionNodeId, readonly ProjectionNodeId[]>,
): CenterRegionLayout {
  const documentId = module.documentProjectionNodeId;
  if (documentId === null || !centerIds.includes(documentId)) {
    const region = layoutRegion(input, centerIds, hierarchyEdgeIds, 'TB');
    return { ...region, dagreCallCount: centerIds.length === 0 ? 0 : 1 };
  }
  const included = new Set(centerIds);
  const roots = (childrenByNodeId.get(documentId) ?? []).filter((nodeId) =>
    included.has(nodeId),
  );
  const branchIds = roots.map((rootId) => {
    const ids: ProjectionNodeId[] = [];
    const visit = (nodeId: ProjectionNodeId) => {
      if (!included.has(nodeId)) return;
      ids.push(nodeId);
      for (const childId of childrenByNodeId.get(nodeId) ?? []) visit(childId);
    };
    visit(rootId);
    return ids;
  });
  const covered = new Set(branchIds.flat());
  const isExactFileForest = centerIds.every(
    (nodeId) =>
      nodeId === documentId ||
      (covered.has(nodeId) && parentByNodeId.has(nodeId)),
  );
  if (roots.length < 2 || !isExactFileForest) {
    const region = layoutRegion(input, centerIds, hierarchyEdgeIds, 'TB');
    return { ...region, dagreCallCount: centerIds.length === 0 ? 0 : 1 };
  }

  const branches = branchIds.map((ids) =>
    layoutRegion(input, ids, hierarchyEdgeIds, 'TB'),
  );
  const document = dimensionNode(input, documentId);
  const stackSeparation = input.settings.internalNodeSeparation;
  const fileSeparation = input.settings.internalRankSeparation;
  let bestCut = 0;
  let bestScore: readonly number[] | null = null;
  for (let cut = 0; cut <= branches.length; cut += 1) {
    const aboveHeight = stackHeight(branches.slice(0, cut), stackSeparation);
    const belowHeight = stackHeight(branches.slice(cut), stackSeparation);
    const aboveExtent = aboveHeight === 0 ? 0 : aboveHeight + fileSeparation;
    const belowExtent = belowHeight === 0 ? 0 : belowHeight + fileSeparation;
    const score = [
      Math.max(aboveExtent, belowExtent),
      Math.abs(aboveExtent - belowExtent),
      aboveExtent + belowExtent,
      cut,
    ] as const;
    if (
      bestScore === null ||
      score.some(
        (value, index) =>
          value < bestScore![index]! &&
          score
            .slice(0, index)
            .every((item, prior) => item === bestScore![prior]),
      )
    ) {
      bestCut = cut;
      bestScore = score;
    }
  }

  const above = branches.slice(0, bestCut);
  const below = branches.slice(bestCut);
  const aboveHeight = stackHeight(above, stackSeparation);
  const belowHeight = stackHeight(below, stackSeparation);
  const width = Math.max(
    document.width,
    ...branches.map((branch) => branch.width),
  );
  const documentY = aboveHeight === 0 ? 0 : aboveHeight + fileSeparation;
  const nodes: LocalNode[] = [
    { ...document, x: (width - document.width) / 2, y: documentY },
  ];
  let cursor = 0;
  for (const branch of above) {
    nodes.push(
      ...branch.nodes.map((node) => ({
        ...node,
        x: node.x + (width - branch.width) / 2,
        y: node.y + cursor,
      })),
    );
    cursor += branch.height + stackSeparation;
  }
  cursor =
    documentY + document.height + (below.length === 0 ? 0 : fileSeparation);
  for (const branch of below) {
    nodes.push(
      ...branch.nodes.map((node) => ({
        ...node,
        x: node.x + (width - branch.width) / 2,
        y: node.y + cursor,
      })),
    );
    cursor += branch.height + stackSeparation;
  }
  const height =
    documentY +
    document.height +
    (belowHeight === 0 ? 0 : fileSeparation + belowHeight);
  return { nodes, width, height, dagreCallCount: branches.length };
}

function internalLayout(
  input: FocusSchematicLayoutInput,
  module: FocusSchematicModel['modules'][number],
  lanePlan: FocusSchematicInternalLanePlan,
): LocalModuleLayout {
  if (module.presentation === 'filtered') {
    const size =
      FILTERED_MODULE_DIMENSIONS[input.settings.filteredModulePolicy];
    return {
      moduleId: module.id,
      ...size,
      nodes: [],
      dagreCallCount: 0,
      centerLayoutMs: 0,
      leftLayoutMs: 0,
      rightLayoutMs: 0,
      compositionMs: 0,
    };
  }
  const laneByNodeId = new Map(
    lanePlan.nodes
      .filter(({ moduleId }) => moduleId === module.id)
      .map((node) => [node.projectionNodeId, node.lane]),
  );
  if (laneByNodeId.size !== module.visibleEntityNodeIds.length)
    throw new Error(`Lane plan does not cover module "${module.id}" exactly.`);
  const hierarchyIds = new Set(module.hierarchyEdgeIds);
  const parentByNodeId = new Map<ProjectionNodeId, ProjectionNodeId>();
  const childrenByNodeId = new Map<ProjectionNodeId, ProjectionNodeId[]>();
  for (const edge of input.projection.edges) {
    if (edge.kind !== 'hierarchy' || !hierarchyIds.has(edge.id)) continue;
    parentByNodeId.set(edge.targetNodeId, edge.sourceNodeId);
    const children = childrenByNodeId.get(edge.sourceNodeId) ?? [];
    children.push(edge.targetNodeId);
    childrenByNodeId.set(edge.sourceNodeId, children);
  }
  const sourceOrder = new Map(
    input.projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node.sourceStartLine] as const] : [],
    ),
  );
  const order = (left: string, right: string) =>
    (sourceOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (sourceOrder.get(right) ?? Number.MAX_SAFE_INTEGER) ||
    compareText(left, right);
  for (const children of childrenByNodeId.values()) children.sort(order);

  const centerIds = [...laneByNodeId]
    .filter(([, lane]) => lane === 'center')
    .map(([nodeId]) => nodeId)
    .sort(order);
  const centerStarted = now();
  const centerRegion = layoutCenterRegion(
    input,
    module,
    centerIds,
    hierarchyIds,
    parentByNodeId,
    childrenByNodeId,
  );
  const centerLayoutMs = now() - centerStarted;
  const centerById = new Map(
    centerRegion.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const documentLaneNode = lanePlan.nodes.find(
    (node) =>
      node.moduleId === module.id &&
      node.projectionNodeId === module.documentProjectionNodeId,
  );
  const documentGeometry =
    module.documentProjectionNodeId === null
      ? undefined
      : centerById.get(module.documentProjectionNodeId);

  const sideComponents = (lane: 'left' | 'right') => {
    const roots = [...laneByNodeId]
      .filter(
        ([nodeId, nodeLane]) =>
          nodeLane === lane &&
          laneByNodeId.get(parentByNodeId.get(nodeId) ?? '') !== lane,
      )
      .map(([nodeId]) => nodeId)
      .sort(order);
    return roots.map((rootId) => {
      const ids: ProjectionNodeId[] = [];
      const visit = (nodeId: ProjectionNodeId) => {
        if (laneByNodeId.get(nodeId) !== lane) return;
        ids.push(nodeId);
        for (const childId of childrenByNodeId.get(nodeId) ?? [])
          visit(childId);
      };
      visit(rootId);
      return { rootId, parentId: parentByNodeId.get(rootId) ?? null, ids };
    });
  };

  let leftLayoutMs = 0;
  let rightLayoutMs = 0;
  let dagreCallCount = centerRegion.dagreCallCount;
  const positioned: LocalNode[] = [...centerRegion.nodes];
  const centerMinX = 0;
  const centerMaxX = centerRegion.width;
  const centerAnchorY = centerRegion.height / 2;
  const compositionStarted = now();
  for (const lane of ['left', 'right'] as const) {
    const regions = sideComponents(lane).map((component) => {
      const started = now();
      const region = layoutRegion(
        input,
        component.ids,
        hierarchyIds,
        lane === 'left' ? 'RL' : 'LR',
      );
      if (lane === 'left') leftLayoutMs += now() - started;
      else rightLayoutMs += now() - started;
      dagreCallCount += 1;
      const rootNode = region.nodes.find(
        ({ projectionNodeId }) => projectionNodeId === component.rootId,
      );
      if (rootNode === undefined)
        throw new Error(`Side subtree omitted root "${component.rootId}".`);
      const parentNode =
        component.parentId === null
          ? undefined
          : centerById.get(component.parentId);
      return {
        ...component,
        region,
        rootCenterY: rootNode.y + rootNode.height / 2,
        preferredY:
          (parentNode === undefined ? centerAnchorY : center(parentNode).y) -
          (rootNode.y + rootNode.height / 2),
      };
    });
    regions.sort(
      (left, right) =>
        left.preferredY - right.preferredY ||
        compareText(left.rootId, right.rootId),
    );
    let previousBottom = Number.NEGATIVE_INFINITY;
    for (const item of regions) {
      let y = Math.max(
        item.preferredY,
        previousBottom === Number.NEGATIVE_INFINITY
          ? item.preferredY
          : previousBottom + input.settings.internalNodeSeparation,
      );
      const documentProtectsSide =
        documentGeometry !== undefined &&
        (documentLaneNode?.directDemand === lane ||
          documentLaneNode?.directDemand === 'both');
      const documentMidY =
        documentGeometry === undefined ? 0 : center(documentGeometry).y;
      if (
        documentProtectsSide &&
        y < documentMidY &&
        y + item.region.height > documentMidY
      )
        y =
          documentGeometry.y +
          documentGeometry.height +
          input.settings.internalNodeSeparation;
      const x =
        lane === 'left'
          ? centerMinX -
            input.settings.internalRankSeparation -
            item.region.width
          : centerMaxX + input.settings.internalRankSeparation;
      positioned.push(
        ...item.region.nodes.map((node) => ({
          ...node,
          x: node.x + x,
          y: node.y + y,
        })),
      );
      previousBottom = y + item.region.height;
    }
  }
  const compositionMs = now() - compositionStarted;
  if (positioned.length === 0)
    throw new Error(`Visible module "${module.id}" has no positioned nodes.`);
  const minX = Math.min(...positioned.map(({ x }) => x));
  const minY = Math.min(...positioned.map(({ y }) => y));
  const maxX = Math.max(...positioned.map(({ x, width }) => x + width));
  const maxY = Math.max(...positioned.map(({ y, height }) => y + height));
  const reserve =
    module.diagnosticIds.length > 0
      ? input.settings.diagnosticReserveHeight
      : 0;
  return {
    moduleId: module.id,
    width: maxX - minX + input.settings.modulePaddingX * 2,
    height: maxY - minY + input.settings.modulePaddingY * 2 + reserve,
    nodes: positioned
      .map((node) => ({
        ...node,
        x: node.x - minX + input.settings.modulePaddingX,
        y: node.y - minY + input.settings.modulePaddingY,
      }))
      .sort((left, right) =>
        compareText(left.projectionNodeId, right.projectionNodeId),
      ),
    dagreCallCount,
    centerLayoutMs,
    leftLayoutMs,
    rightLayoutMs,
    compositionMs,
  };
}

function localLayoutsFromCandidate(
  candidate: FocusSchematicLayoutCandidate,
  timings: readonly LocalModuleLayout[],
): readonly LocalModuleLayout[] {
  const timingById = new Map(timings.map((item) => [item.moduleId, item]));
  return candidate.modules
    .map((module) => {
      const timing = timingById.get(module.moduleId);
      if (timing === undefined)
        throw new Error(
          `Internal-layout candidate omitted module timing "${module.moduleId}".`,
        );
      return {
        ...timing,
        width: module.width,
        height: module.height,
        nodes: candidate.nodes
          .filter(({ moduleId }) => moduleId === module.moduleId)
          .map((node) => ({
            projectionNodeId: node.projectionNodeId,
            x: node.x - module.x,
            y: node.y - module.y,
            width: node.width,
            height: node.height,
          })),
      };
    })
    .sort((left, right) => compareText(left.moduleId, right.moduleId));
}

function macroLayout(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  localLayouts: readonly LocalModuleLayout[],
): {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly nativeRoutes: readonly FocusSchematicNativeRoute[];
} {
  const macro = new dagre.graphlib.Graph({ multigraph: true });
  macro.setDefaultEdgeLabel(() => ({}));
  macro.setGraph({
    rankdir: 'LR',
    nodesep: input.settings.macroNodeSeparation,
    ranksep: input.settings.macroRankSeparation,
    ranker: input.settings.ranker,
  });
  for (const module of localLayouts)
    macro.setNode(module.moduleId, {
      width: module.width,
      height: module.height,
    });
  for (const item of modulePlan.modules) {
    if (
      item.parentModuleId === null ||
      item.parentRelationshipId === null ||
      item.side === 'center'
    )
      continue;
    const source = item.side === 'left' ? item.moduleId : item.parentModuleId;
    const target = item.side === 'left' ? item.parentModuleId : item.moduleId;
    macro.setEdge(source, target, { minlen: 1, weight: 10 }, item.moduleId);
  }
  dagre.layout(macro, { useDynamic: false });
  const root = macro.node(input.model.rootModuleId) as { x: number; y: number };
  const nativeRoutes: FocusSchematicNativeRoute[] = modulePlan.modules.flatMap(
    (item) => {
      if (
        item.parentModuleId === null ||
        item.parentRelationshipId === null ||
        item.side === 'center'
      )
        return [];
      const source = item.side === 'left' ? item.moduleId : item.parentModuleId;
      const target = item.side === 'left' ? item.parentModuleId : item.moduleId;
      const edge = macro.edge({
        v: source,
        w: target,
        name: item.moduleId,
      }) as {
        points?: readonly { x: number; y: number }[];
      };
      return edge.points === undefined
        ? []
        : [
            {
              relationshipId: item.parentRelationshipId,
              points: edge.points.map(({ x, y }) => ({
                x: x - root.x,
                y: y - root.y,
              })),
            },
          ];
    },
  );
  const modules = localLayouts.map((local) => {
    const geometry = macro.node(local.moduleId) as { x: number; y: number };
    return {
      moduleId: local.moduleId,
      x: geometry.x - root.x - local.width / 2,
      y: geometry.y - root.y - local.height / 2,
      width: local.width,
      height: local.height,
    };
  });
  const moduleById = new Map(
    modules.map((module) => [module.moduleId, module]),
  );
  const nodes = localLayouts.flatMap((local) => {
    const owner = moduleById.get(local.moduleId);
    if (owner === undefined)
      throw new Error(`Missing macro module "${local.moduleId}".`);
    return local.nodes.map((node) => ({
      ...node,
      moduleId: local.moduleId,
      x: owner.x + node.x,
      y: owner.y + node.y,
    }));
  });
  return {
    candidate: {
      modelSchemaVersion: 1,
      rootModuleId: input.model.rootModuleId,
      modules: modules.sort((left, right) =>
        compareText(left.moduleId, right.moduleId),
      ),
      nodes: nodes.sort((left, right) =>
        compareText(left.projectionNodeId, right.projectionNodeId),
      ),
      routes: [],
    },
    nativeRoutes,
  };
}

function percentile(
  values: readonly number[],
  quantile: number,
): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return (
    sorted[
      Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)
    ] ?? null
  );
}

function stubObstructed(
  attachment: FocusSchematicEndpointAttachmentGeometry,
  candidate: FocusSchematicLayoutCandidate,
): boolean {
  if (attachment.kind === 'module-anchor') return false;
  const module = candidate.modules.find(
    ({ moduleId }) => moduleId === attachment.moduleId,
  );
  if (module === undefined) return true;
  const nodes = candidate.nodes.filter(
    (node) =>
      node.moduleId === attachment.moduleId &&
      node.projectionNodeId !== attachment.projectionNodeId,
  );
  if (attachment.side === 'left' || attachment.side === 'right') {
    const edgeX =
      attachment.side === 'left' ? module.x : module.x + module.width;
    const minX = Math.min(edgeX, attachment.x);
    const maxX = Math.max(edgeX, attachment.x);
    return nodes.some(
      (node) =>
        attachment.y > node.y &&
        attachment.y < node.y + node.height &&
        maxX > node.x &&
        minX < node.x + node.width,
    );
  }
  const edgeY = attachment.side === 'top' ? module.y : module.y + module.height;
  const minY = Math.min(edgeY, attachment.y);
  const maxY = Math.max(edgeY, attachment.y);
  return nodes.some(
    (node) =>
      attachment.x > node.x &&
      attachment.x < node.x + node.width &&
      maxY > node.y &&
      minY < node.y + node.height,
  );
}

export function evaluateFocusSchematicEndpointLayoutQuality(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  candidate: FocusSchematicLayoutCandidate,
  attachments: readonly FocusSchematicEndpointAttachmentGeometry[],
  attachmentPolicy: FocusSchematicEndpointAttachmentPolicy = 'directional',
): FocusSchematicEndpointLayoutQuality {
  const base = evaluateFocusSchematicLayout(input.model, candidate, {
    clearance: FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
    rankTolerance: 1,
  });
  const nodeById = new Map(
    candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const moduleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const semanticModuleById = new Map(
    input.model.modules.map((module) => [module.id, module]),
  );
  const projectionById = new Map(
    input.projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node] as const] : [],
    ),
  );
  const leftDemandViolationNodeIds: string[] = [];
  const rightDemandViolationNodeIds: string[] = [];
  const dualDemandNodeIds: string[] = [];
  for (const laneNode of lanePlan.nodes) {
    const node = nodeById.get(laneNode.projectionNodeId);
    const module = moduleById.get(laneNode.moduleId);
    const semanticModule = semanticModuleById.get(laneNode.moduleId);
    if (
      node === undefined ||
      module === undefined ||
      semanticModule === undefined
    )
      continue;
    const document =
      semanticModule.documentProjectionNodeId === null
        ? undefined
        : nodeById.get(semanticModule.documentProjectionNodeId);
    const coreX = center(document ?? module).x;
    const nodeKind = projectionById.get(laneNode.projectionNodeId)?.entityKind;
    if (laneNode.directDemand === 'both')
      dualDemandNodeIds.push(laneNode.projectionNodeId);
    if (nodeKind === 'document') continue;
    if (laneNode.directDemand === 'left' && center(node).x >= coreX)
      leftDemandViolationNodeIds.push(laneNode.projectionNodeId);
    if (laneNode.directDemand === 'right' && center(node).x <= coreX)
      rightDemandViolationNodeIds.push(laneNode.projectionNodeId);
  }
  const laneByNodeId = new Map(
    lanePlan.nodes.map((node) => [node.projectionNodeId, node.lane]),
  );
  const invalidLaneTransitionEdgeIds = input.projection.edges
    .filter((edge) => {
      if (edge.kind !== 'hierarchy') return false;
      const source = laneByNodeId.get(edge.sourceNodeId);
      const target = laneByNodeId.get(edge.targetNodeId);
      return (
        (source === 'left' && target === 'right') ||
        (source === 'right' && target === 'left')
      );
    })
    .map(({ id }) => id)
    .sort(compareText);
  const obstructedSourceAttachmentConnectionIds: string[] = [];
  const obstructedTargetAttachmentConnectionIds: string[] = [];
  for (const attachment of attachments) {
    if (!stubObstructed(attachment, candidate)) continue;
    (attachment.endpoint === 'source'
      ? obstructedSourceAttachmentConnectionIds
      : obstructedTargetAttachmentConnectionIds
    ).push(attachment.connectionId);
  }
  const connectionById = new Map(
    endpointPlan.connections.map((connection) => [connection.id, connection]),
  );
  const ownModuleTraversalConnectionIds = [
    ...new Set(
      [
        ...obstructedSourceAttachmentConnectionIds,
        ...obstructedTargetAttachmentConnectionIds,
      ].filter((id) => connectionById.get(id)?.role !== 'secondary'),
    ),
  ].sort(compareText);
  const endpointNodeIds = new Set(
    endpointPlan.connections.flatMap((connection) =>
      [connection.source, connection.target].flatMap((endpoint) =>
        endpoint.kind === 'visible-entity' ? [endpoint.projectionNodeId] : [],
      ),
    ),
  );
  const verticalErrors = endpointPlan.connections.flatMap((connection) => {
    if (connection.kind !== 'precise') return [];
    const sourceAttachment = attachments.find(
      (item) =>
        item.connectionId === connection.id && item.endpoint === 'source',
    );
    const targetAttachment = attachments.find(
      (item) =>
        item.connectionId === connection.id && item.endpoint === 'target',
    );
    return sourceAttachment === undefined || targetAttachment === undefined
      ? []
      : [Math.abs(sourceAttachment.y - targetAttachment.y)];
  });
  const totalReferenceIds = endpointPlan.summary.totalReferenceIdCount;
  const orderMetrics = measureFocusSchematicEndpointOrder(
    modulePlan,
    endpointPlan,
    candidate,
  );
  return {
    preciseConnectionCount: endpointPlan.summary.preciseConnectionCount,
    fallbackConnectionCount: endpointPlan.summary.fallbackConnectionCount,
    preciseReferenceCoverage:
      totalReferenceIds === 0
        ? 1
        : endpointPlan.summary.preciseReferenceIdCount / totalReferenceIds,
    leftDemandViolationNodeIds: leftDemandViolationNodeIds.sort(compareText),
    rightDemandViolationNodeIds: rightDemandViolationNodeIds.sort(compareText),
    dualDemandNodeIds: dualDemandNodeIds.sort(compareText),
    invalidLaneTransitionEdgeIds,
    obstructedSourceAttachmentConnectionIds: [
      ...new Set(obstructedSourceAttachmentConnectionIds),
    ].sort(compareText),
    obstructedTargetAttachmentConnectionIds: [
      ...new Set(obstructedTargetAttachmentConnectionIds),
    ].sort(compareText),
    ownModuleTraversalConnectionIds,
    endpointNodeOverlapPairs: base.nodeOverlapPairs.filter((pair) =>
      pair.split('|').every((id) => endpointNodeIds.has(id)),
    ),
    moduleOverlapPairs: base.moduleOverlapPairs,
    nodeOverlapPairs: base.nodeOverlapPairs,
    nodeOutsideModuleIds: base.nodeOutsideModuleIds,
    totalBoundsArea: base.totalBoundsArea,
    ...orderMetrics,
    exactEndpointCrossingCount:
      attachmentPolicy === 'soft-cardinal-files'
        ? measureFocusSchematicAttachmentCrossings(endpointPlan, attachments)
        : orderMetrics.exactEndpointCrossingCount,
    meanPreciseEndpointVerticalError:
      verticalErrors.length === 0
        ? null
        : verticalErrors.reduce((sum, value) => sum + value, 0) /
          verticalErrors.length,
    p95PreciseEndpointVerticalError: percentile(verticalErrors, 0.95),
  };
}

function pointOnBoundary(
  point: { readonly x: number; readonly y: number },
  rectangle: FocusSchematicRectangle,
): boolean {
  const epsilon = 1e-6;
  const withinX =
    point.x >= rectangle.x - epsilon &&
    point.x <= rectangle.x + rectangle.width + epsilon;
  const withinY =
    point.y >= rectangle.y - epsilon &&
    point.y <= rectangle.y + rectangle.height + epsilon;
  return (
    withinX &&
    withinY &&
    (Math.abs(point.x - rectangle.x) <= epsilon ||
      Math.abs(point.x - (rectangle.x + rectangle.width)) <= epsilon ||
      Math.abs(point.y - rectangle.y) <= epsilon ||
      Math.abs(point.y - (rectangle.y + rectangle.height)) <= epsilon)
  );
}

function canonicalJson(value: unknown): string {
  const canonicalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (
      item !== null &&
      typeof item === 'object' &&
      Object.getPrototypeOf(item) === Object.prototype
    )
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => compareText(left, right))
          .map(([key, child]) => [key, canonicalize(child)]),
      );
    return item;
  };
  return JSON.stringify(canonicalize(value));
}

function validSoftClusterPolicyEvidence(
  evidence: FocusSchematicComputedLayout['internalLayoutEvidence']['softClusterPolicyEvidence'],
): boolean {
  if (evidence === undefined) return true;
  if (evidence === null || typeof evidence !== 'object') return false;
  const intentValidation = validateFocusSchematicSoftFolderDisplayIntent(
    evidence.displayIntent,
  );
  return (
    evidence.schemaVersion === 3 &&
    evidence.layoutFamily === 'soft-folder-clusters' &&
    Number.isFinite(evidence.strength) &&
    evidence.strength >= 0 &&
    evidence.strength <= 100 &&
    (evidence.endpointOrderPolicy === 'crossing-optimized' ||
      evidence.endpointOrderPolicy === 'document-order') &&
    intentValidation.valid &&
    JSON.stringify(intentValidation.value) ===
      JSON.stringify(evidence.displayIntent) &&
    (evidence.hierarchyForcePolicy === 'nearest-only' ||
      evidence.hierarchyForcePolicy === 'normalized-decay' ||
      evidence.hierarchyForcePolicy === 'normalized-equal') &&
    evidence.fileAttachmentPolicy === 'spatial-cardinal' &&
    (evidence.compassDemandPolicy === 'directional-horizontal' ||
      evidence.compassDemandPolicy === 'spatial-cardinal') &&
    (evidence.spatialDemandSummary === 'dominant-cardinal' ||
      evidence.spatialDemandSummary === 'aggregate-vector')
  );
}

export function validateFocusSchematicComputedLayout(
  input: FocusSchematicLayoutInput,
  value: unknown,
): FocusSchematicEndpointValidationResult<FocusSchematicComputedLayout> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return {
      valid: false,
      issues: [
        { path: '$', message: 'Computed layout must be a plain object.' },
      ],
    };
  if (
    Object.keys(value as Record<string, unknown>)
      .sort(compareText)
      .join('|') !==
    [
      'attachments',
      'candidate',
      'endpointPlan',
      'folderBandPlan',
      'folderBandQuality',
      'internalLayoutEvidence',
      'internalLanePlan',
      'modulePlan',
      'quality',
    ]
      .sort(compareText)
      .join('|')
  )
    return {
      valid: false,
      issues: [{ path: '$', message: 'Computed layout shape is invalid.' }],
    };
  const computed = value as FocusSchematicComputedLayout;
  const candidateValidation = validateFocusSchematicLayoutCandidate(
    input.model,
    computed.candidate,
  );
  if (!candidateValidation.valid)
    return {
      valid: false,
      issues: candidateValidation.issues.map(({ path, message }) => ({
        path,
        message,
      })),
    };
  const modulePlanValidation = validateFocusSchematicLayoutPlan(
    input.model,
    computed.modulePlan,
  );
  if (!modulePlanValidation.valid) return modulePlanValidation;
  const endpointValidation = validateFocusSchematicEndpointPlan(
    input,
    computed.modulePlan,
    computed.endpointPlan,
  );
  if (!endpointValidation.valid) return endpointValidation;
  const laneValidation = validateFocusSchematicInternalLanePlan(
    input,
    computed.endpointPlan,
    computed.internalLanePlan,
  );
  if (!laneValidation.valid) return laneValidation;
  const internalEvidence = computed.internalLayoutEvidence;
  const softClusterEvidence = internalEvidence?.softClusterPolicyEvidence;
  const folderPlanValidation = validateSerializedFocusSchematicFolderBandPlan(
    input,
    computed.modulePlan,
    computed.candidate,
    computed.folderBandPlan,
    softClusterEvidence === undefined ? 'module' : 'file',
  );
  if (!folderPlanValidation.valid) return folderPlanValidation;
  const expectedInternalVariant =
    softClusterEvidence === undefined
      ? (computed.folderBandPlan.optimization?.internalLayoutVariant ??
        'current')
      : internalEvidence.variant;
  if (
    internalEvidence === null ||
    typeof internalEvidence !== 'object' ||
    internalEvidence.developmentOnly !==
      (internalEvidence.variant === 'current') ||
    internalEvidence.variant !== expectedInternalVariant ||
    internalEvidence.verticalSpinePlacementCandidateCap !== 64 ||
    internalEvidence.compassAssignmentCap !== 64 ||
    internalEvidence.compassLocalRelocationSweepLimit !== 4 ||
    internalEvidence.jointFolderRoundLimit !== 2 ||
    internalEvidence.jointFolderRounds > 2 ||
    !Number.isSafeInteger(internalEvidence.largeModuleFallbackCount) ||
    internalEvidence.largeModuleFallbackCount < 0 ||
    !validSoftClusterPolicyEvidence(softClusterEvidence) ||
    (softClusterEvidence !== undefined &&
      (input.settings.directionalFolderBandsEnabled ||
        computed.folderBandPlan.enabled ||
        internalEvidence.variant === 'current'))
  )
    return {
      valid: false,
      issues: [
        {
          path: '$.internalLayoutEvidence',
          message:
            'Internal-layout bakeoff evidence is missing, unbounded, or inconsistent with the folder candidate.',
        },
      ],
    };
  if (
    !Array.isArray(computed.attachments) ||
    computed.attachments.length !== computed.endpointPlan.connections.length * 2
  )
    return {
      valid: false,
      issues: [
        {
          path: '$.attachments',
          message: 'Every connection needs two attachments.',
        },
      ],
    };
  const attachmentPolicy =
    softClusterEvidence === undefined ? 'directional' : 'soft-cardinal-files';
  const expectedAttachments = createFocusSchematicEndpointAttachments(
    computed.endpointPlan,
    computed.candidate,
    attachmentPolicy,
  );
  if (
    canonicalJson(expectedAttachments) !== canonicalJson(computed.attachments)
  )
    return {
      valid: false,
      issues: [
        {
          path: '$.attachments',
          message:
            'Attachments do not exactly match endpoint identity, module ownership, deterministic side selection, or boundary geometry.',
        },
      ],
    };
  const moduleById = new Map(
    computed.candidate.modules.map((module) => [module.moduleId, module]),
  );
  const nodeById = new Map(
    computed.candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  for (const attachment of computed.attachments) {
    const rectangle =
      attachment.kind === 'visible-node'
        ? nodeById.get(attachment.projectionNodeId ?? '')
        : moduleById.get(attachment.moduleId);
    if (
      rectangle === undefined ||
      !Number.isFinite(attachment.x) ||
      !Number.isFinite(attachment.y) ||
      !pointOnBoundary(attachment, rectangle)
    )
      return {
        valid: false,
        issues: [
          {
            path: '$.attachments',
            message: `Attachment "${attachment.connectionId}:${attachment.endpoint}" is missing, non-finite, or off-boundary.`,
          },
        ],
      };
  }
  const expectedQuality = evaluateFocusSchematicEndpointLayoutQuality(
    input,
    computed.modulePlan,
    computed.endpointPlan,
    computed.internalLanePlan,
    computed.candidate,
    computed.attachments,
    attachmentPolicy,
  );
  if (canonicalJson(expectedQuality) !== canonicalJson(computed.quality))
    return {
      valid: false,
      issues: [
        {
          path: '$.quality',
          message: 'Endpoint quality does not match computed geometry.',
        },
      ],
    };
  const baselineEndpointQuality: FocusSchematicEndpointLayoutQuality = {
    ...computed.quality,
    exactEndpointCrossingCount:
      computed.folderBandQuality.baselineExactEndpointCrossingCount,
    adjacentRankOrderInversionCount:
      computed.folderBandQuality.baselineAdjacentRankOrderInversionCount,
    meanPreciseEndpointVerticalError:
      computed.folderBandQuality.baselineMeanEndpointVerticalError,
    p95PreciseEndpointVerticalError:
      computed.folderBandQuality.baselineP95EndpointVerticalError,
  };
  const expectedFolderQuality = evaluateFocusSchematicFolderBandQuality(
    input,
    computed.modulePlan,
    computed.folderBandPlan,
    computed.candidate,
    baselineEndpointQuality,
    computed.quality,
  );
  if (
    canonicalJson(expectedFolderQuality) !==
    canonicalJson(computed.folderBandQuality)
  )
    return {
      valid: false,
      issues: [
        {
          path: '$.folderBandQuality',
          message: 'Folder-band quality does not match computed geometry.',
        },
      ],
    };
  return { valid: true, value: computed, issues: [] };
}

export function computeFocusSchematicComputedLayoutAttempt(
  value: FocusSchematicLayoutInput,
  options: FocusSchematicComputedLayoutOptions = {},
): FocusSchematicComputedLayoutAttempt {
  const started = now();
  const endpointOrderPolicy =
    options.endpointOrderPolicy ?? 'crossing-optimized';
  const internalLayoutVariant = value.settings.directionalFolderBandsEnabled
    ? (options.internalLayoutVariant ?? 'adaptive-compass')
    : 'current';
  const internalVariantConfig =
    internalLayoutVariant === 'current' ? '' : `-il${internalLayoutVariant}`;
  const configId = `A1v${FOCUS_SCHEMATIC_SELECTED_LAYOUT_ALGORITHM_VERSION}-${value.settings.ranker}-i${value.settings.internalNodeSeparation}-${value.settings.internalRankSeparation}-m${value.settings.macroNodeSeparation}-${value.settings.macroRankSeparation}-db${value.settings.directionalFolderBandsEnabled ? 'on' : 'off'}-ho${endpointOrderPolicy}${internalVariantConfig}`;
  try {
    const inputStarted = now();
    assertFocusSchematicLayoutInput(value);
    const inputSerializedBytes = byteLength(value);
    const inputMs = now() - inputStarted;
    const modulePlanningStarted = now();
    const modulePlan = createFocusSchematicLayoutPlan(value.model);
    const modulePlanningMs = now() - modulePlanningStarted;
    const endpointStarted = now();
    const endpointPlan = createFocusSchematicEndpointPlan(value, modulePlan);
    const endpointConnectionMs = now() - endpointStarted;
    const laneStarted = now();
    const internalLanePlan = createFocusSchematicInternalLanePlan(
      value,
      endpointPlan,
    );
    const laneAssignmentMs = now() - laneStarted;
    const localLayouts = value.model.modules
      .map((module) => internalLayout(value, module, internalLanePlan))
      .sort((left, right) => compareText(left.moduleId, right.moduleId));
    const macroStarted = now();
    const currentMacro = macroLayout(value, modulePlan, localLayouts);
    let macroMs = now() - macroStarted;
    let internalVariantMs = 0;
    const crossingMinimizationStarted = now();
    const revision2Candidate = minimizeFocusSchematicEndpointCrossings(
      value,
      modulePlan,
      endpointPlan,
      internalLanePlan,
      currentMacro.candidate,
    );
    const crossingMinimizationMs = now() - crossingMinimizationStarted;
    const internalLayoutStats = createFocusSchematicInternalLayoutRunStats();
    let baselineCandidate = revision2Candidate;
    let nativeRoutes = currentMacro.nativeRoutes;
    let folderApplication:
      ReturnType<typeof applyFocusSchematicFolderBands> | undefined;
    if (internalLayoutVariant === 'current') {
      folderApplication = applyFocusSchematicFolderBands(
        value,
        modulePlan,
        endpointPlan,
        internalLanePlan,
        baselineCandidate,
        endpointOrderPolicy,
        internalLayoutVariant,
        internalLayoutStats,
      );
    } else {
      let demandCandidate = revision2Candidate;
      for (
        let round = 0;
        round < FOCUS_SCHEMATIC_INTERNAL_FOLDER_JOINT_ROUND_LIMIT;
        round += 1
      ) {
        const internalVariantStarted = now();
        const internalCandidate = applyFocusSchematicInternalLayoutVariant(
          value,
          modulePlan,
          endpointPlan,
          demandCandidate,
          internalLayoutVariant,
          endpointOrderPolicy,
          internalLayoutStats,
        );
        internalVariantMs += now() - internalVariantStarted;
        const variantMacroStarted = now();
        const variantMacro = macroLayout(
          value,
          modulePlan,
          localLayoutsFromCandidate(internalCandidate, localLayouts),
        );
        macroMs += now() - variantMacroStarted;
        baselineCandidate = variantMacro.candidate;
        nativeRoutes = variantMacro.nativeRoutes;
        folderApplication = applyFocusSchematicFolderBands(
          value,
          modulePlan,
          endpointPlan,
          internalLanePlan,
          baselineCandidate,
          endpointOrderPolicy,
          internalLayoutVariant,
          internalLayoutStats,
        );
        demandCandidate = folderApplication.candidate;
        internalLayoutStats.jointFolderRounds += 1;
      }
    }
    if (folderApplication === undefined)
      throw new Error('Internal/folder joint layout produced no candidate.');
    const baselineAttachments = createFocusSchematicEndpointAttachments(
      endpointPlan,
      baselineCandidate,
    );
    const baselineQuality = evaluateFocusSchematicEndpointLayoutQuality(
      value,
      modulePlan,
      endpointPlan,
      internalLanePlan,
      baselineCandidate,
      baselineAttachments,
    );
    const candidate = folderApplication.candidate;
    const attachmentStarted = now();
    const attachments = createFocusSchematicEndpointAttachments(
      endpointPlan,
      candidate,
    );
    const attachmentMs = now() - attachmentStarted;
    const qualityStarted = now();
    const quality = evaluateFocusSchematicEndpointLayoutQuality(
      value,
      modulePlan,
      endpointPlan,
      internalLanePlan,
      candidate,
      attachments,
    );
    const qualityMs = now() - qualityStarted;
    const folderQualityStarted = now();
    const folderBandQuality = evaluateFocusSchematicFolderBandQuality(
      value,
      modulePlan,
      folderApplication.plan,
      candidate,
      baselineQuality,
      quality,
    );
    const folderQualityMs = now() - folderQualityStarted;
    const result: FocusSchematicComputedLayout = {
      candidate,
      modulePlan,
      endpointPlan,
      internalLanePlan,
      folderBandPlan: folderApplication.plan,
      folderBandQuality,
      internalLayoutEvidence: createFocusSchematicInternalLayoutEvidence(
        value,
        endpointPlan,
        candidate,
        revision2Candidate,
        internalLayoutVariant,
        internalLayoutStats,
      ),
      attachments,
      quality,
    };
    const validationStarted = now();
    const validation = validateFocusSchematicComputedLayout(value, result);
    const validationMs = now() - validationStarted;
    if (!validation.valid)
      throw new Error(
        `Computed-layout validation failed: ${validation.issues
          .map(({ path, message }) => `${path}: ${message}`)
          .join('; ')}`,
      );
    const serializationStarted = now();
    const outputSerializedBytes = byteLength(result);
    const endpointLaneSerializedBytes = byteLength({
      endpointPlan,
      internalLanePlan,
      attachments,
    });
    const folderBandSerializedBytes = byteLength({
      folderBandPlan: folderApplication.plan,
      folderBandQuality,
    });
    const serializationMs = now() - serializationStarted;
    return {
      status: 'success',
      strategyId: STRATEGY_ID,
      configId,
      result,
      nativeRoutes,
      warnings: [
        'Candidate routes remain empty; endpoint attachments and simple lab connectors are HIER3A evidence, while complete routing remains HIER5.',
      ],
      timings: {
        inputMs,
        modulePlanningMs,
        endpointConnectionMs,
        demandCollectionMs: 0,
        subtreePropagationMs: 0,
        laneAssignmentMs,
        centerLayoutMs: localLayouts.reduce(
          (sum, item) => sum + item.centerLayoutMs,
          0,
        ),
        leftLayoutMs: localLayouts.reduce(
          (sum, item) => sum + item.leftLayoutMs,
          0,
        ),
        rightLayoutMs: localLayouts.reduce(
          (sum, item) => sum + item.rightLayoutMs,
          0,
        ),
        compositionMs: localLayouts.reduce(
          (sum, item) => sum + item.compositionMs,
          0,
        ),
        internalVariantMs,
        macroMs,
        crossingMinimizationMs,
        ...folderApplication.timings,
        attachmentMs,
        qualityMs,
        folderQualityMs,
        validationMs,
        serializationMs,
        totalMs: now() - started,
        dagreCallCount:
          1 + localLayouts.reduce((sum, item) => sum + item.dagreCallCount, 0),
        inputSerializedBytes,
        outputSerializedBytes,
        endpointLaneSerializedBytes,
        folderBandSerializedBytes,
      },
    };
  } catch (error) {
    return {
      status: 'failure',
      strategyId: STRATEGY_ID,
      configId,
      reason: error instanceof Error ? error.message : String(error),
      timings: emptyTimings(now() - started),
    };
  }
}

export function computeFocusSchematicComputedLayout(
  input: FocusSchematicLayoutInput,
): FocusSchematicComputedLayout {
  const attempt = computeFocusSchematicComputedLayoutAttempt(input);
  if (attempt.status !== 'success')
    throw new Error(
      `Focus Schematic endpoint-facing layout failed: ${attempt.reason}`,
    );
  return attempt.result;
}

/** Development-only oracle for the accepted revision-2 candidate geometry. */
export function computeFocusSchematicRevision2LayoutAttempt(
  input: FocusSchematicLayoutInput,
): FocusSchematicComputedLayoutAttempt {
  return computeFocusSchematicComputedLayoutAttempt({
    ...input,
    settings: { ...input.settings, directionalFolderBandsEnabled: false },
  });
}
