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
import { assertFocusSchematicLayoutInput } from './input';
import {
  createFocusSchematicInternalLanePlan,
  validateFocusSchematicInternalLanePlan,
} from './lane-plan';
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
  FocusSchematicConnectionEndpoint,
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

const STRATEGY_ID = 'A1-endpoint-facing-split-lanes' as const;
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
    macroMs: 0,
    attachmentMs: 0,
    qualityMs: 0,
    validationMs: 0,
    serializationMs: 0,
    totalMs,
    dagreCallCount: 0,
    inputSerializedBytes: 0,
    outputSerializedBytes: 0,
    endpointLaneSerializedBytes: 0,
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
  const centerRegion = layoutRegion(input, centerIds, hierarchyIds, 'TB');
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
  let dagreCallCount = centerIds.length > 0 ? 1 : 0;
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

function resolveAutoSide(
  own: FocusSchematicRectangle,
  counterpart: FocusSchematicRectangle,
): 'left' | 'right' | 'top' | 'bottom' {
  const ownCenter = center(own);
  const counterpartCenter = center(counterpart);
  if (counterpartCenter.x < ownCenter.x) return 'left';
  if (counterpartCenter.x > ownCenter.x) return 'right';
  return counterpartCenter.y < ownCenter.y ? 'top' : 'bottom';
}

function attachmentPoint(
  rectangle: FocusSchematicRectangle,
  side: 'left' | 'right' | 'top' | 'bottom',
) {
  return side === 'left'
    ? { x: rectangle.x, y: rectangle.y + rectangle.height / 2 }
    : side === 'right'
      ? {
          x: rectangle.x + rectangle.width,
          y: rectangle.y + rectangle.height / 2,
        }
      : side === 'top'
        ? { x: rectangle.x + rectangle.width / 2, y: rectangle.y }
        : {
            x: rectangle.x + rectangle.width / 2,
            y: rectangle.y + rectangle.height,
          };
}

export function createFocusSchematicEndpointAttachments(
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
): readonly FocusSchematicEndpointAttachmentGeometry[] {
  const moduleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const nodeById = new Map(
    candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const one = (
    connectionId: string,
    endpointName: 'source' | 'target',
    endpoint: FocusSchematicConnectionEndpoint,
    counterpartModuleId: string,
  ): FocusSchematicEndpointAttachmentGeometry => {
    const ownModule = moduleById.get(endpoint.moduleId);
    const counterpart = moduleById.get(counterpartModuleId);
    if (ownModule === undefined || counterpart === undefined)
      throw new Error(
        `Attachment "${connectionId}" references a missing module.`,
      );
    const rectangle =
      endpoint.kind === 'visible-entity'
        ? nodeById.get(endpoint.projectionNodeId)
        : ownModule;
    if (rectangle === undefined)
      throw new Error(
        `Attachment "${connectionId}" references a missing node.`,
      );
    const side =
      endpoint.attachmentSide === 'auto'
        ? resolveAutoSide(ownModule, counterpart)
        : endpoint.attachmentSide;
    return {
      connectionId,
      endpoint: endpointName,
      kind:
        endpoint.kind === 'visible-entity' ? 'visible-node' : 'module-anchor',
      projectionNodeId:
        endpoint.kind === 'visible-entity' ? endpoint.projectionNodeId : null,
      moduleId: endpoint.moduleId,
      side,
      ...attachmentPoint(rectangle, side),
    };
  };
  return endpointPlan.connections
    .flatMap((connection) => [
      one(
        connection.id,
        'source',
        connection.source,
        connection.targetModuleId,
      ),
      one(
        connection.id,
        'target',
        connection.target,
        connection.sourceModuleId,
      ),
    ])
    .sort(
      (left, right) =>
        compareText(left.connectionId, right.connectionId) ||
        compareText(left.endpoint, right.endpoint),
    );
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
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  candidate: FocusSchematicLayoutCandidate,
  attachments: readonly FocusSchematicEndpointAttachmentGeometry[],
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
  const expectedAttachments = createFocusSchematicEndpointAttachments(
    computed.endpointPlan,
    computed.candidate,
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
    computed.endpointPlan,
    computed.internalLanePlan,
    computed.candidate,
    computed.attachments,
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
  return { valid: true, value: computed, issues: [] };
}

export function computeFocusSchematicComputedLayoutAttempt(
  value: FocusSchematicLayoutInput,
): FocusSchematicComputedLayoutAttempt {
  const started = now();
  const configId = `A1-${value.settings.ranker}-i${value.settings.internalNodeSeparation}-${value.settings.internalRankSeparation}-m${value.settings.macroNodeSeparation}-${value.settings.macroRankSeparation}`;
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
    const { candidate, nativeRoutes } = macroLayout(
      value,
      modulePlan,
      localLayouts,
    );
    const macroMs = now() - macroStarted;
    const attachmentStarted = now();
    const attachments = createFocusSchematicEndpointAttachments(
      endpointPlan,
      candidate,
    );
    const attachmentMs = now() - attachmentStarted;
    const qualityStarted = now();
    const quality = evaluateFocusSchematicEndpointLayoutQuality(
      value,
      endpointPlan,
      internalLanePlan,
      candidate,
      attachments,
    );
    const qualityMs = now() - qualityStarted;
    const result: FocusSchematicComputedLayout = {
      candidate,
      modulePlan,
      endpointPlan,
      internalLanePlan,
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
        macroMs,
        attachmentMs,
        qualityMs,
        validationMs,
        serializationMs,
        totalMs: now() - started,
        dagreCallCount:
          1 + localLayouts.reduce((sum, item) => sum + item.dagreCallCount, 0),
        inputSerializedBytes,
        outputSerializedBytes,
        endpointLaneSerializedBytes,
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
