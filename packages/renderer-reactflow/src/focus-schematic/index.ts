import type { FocusSchematicModel } from '@icarus-graph-explorer/focus-schematic';
import {
  FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
  validateFocusSchematicComputedLayout,
  type FocusSchematicComputedLayout,
  type FocusSchematicConnectionEndpoint,
  type FocusSchematicLayoutInput,
  type FocusSchematicNodeDimension,
} from '@icarus-graph-explorer/focus-schematic-layout';
import type {
  ProjectionEdgeId,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import { rendererNodeId } from '../ids';
import {
  DIAGNOSTIC_NODE_DIMENSIONS,
  ENTITY_NODE_DIMENSIONS,
  mapProjectionToReactFlow,
} from '../mapping';
import type {
  DiagnosticFlowNode,
  FilteredBridgeFlowNode,
  GraphFlowEdge,
  GraphFlowNode,
  GraphVisualVariant,
  ModuleBoundaryFlowNode,
  RendererGraph,
} from '../types';

type HandleSide = 'left' | 'right' | 'top' | 'bottom';

export interface PrepareFocusSchematicRendererGraphInput {
  readonly projection: ViewProjection;
  readonly model: FocusSchematicModel;
  readonly layoutInput: FocusSchematicLayoutInput;
  readonly computedLayout: FocusSchematicComputedLayout;
  readonly rootEntityId: string;
  readonly secondaryRelationshipsVisible: boolean;
  readonly visualVariant?: GraphVisualVariant;
}

export interface FocusSchematicRendererValidationResult {
  readonly valid: boolean;
  readonly message?: string;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Dimensions come from the same fixed card grammar rendered by React Flow. */
export function focusSchematicNodeDimensions(
  projection: ViewProjection,
  model: FocusSchematicModel,
): readonly FocusSchematicNodeDimension[] {
  const visible = new Set(
    model.modules.flatMap(({ visibleEntityNodeIds }) => visibleEntityNodeIds),
  );
  return projection.nodes
    .filter((node) => node.kind === 'entity' && visible.has(node.id))
    .map((node) => {
      if (node.kind !== 'entity') throw new Error('Expected entity node.');
      return {
        projectionNodeId: node.id,
        ...ENTITY_NODE_DIMENSIONS[node.entityKind],
      };
    })
    .sort((left, right) =>
      compareText(left.projectionNodeId, right.projectionNodeId),
    );
}

function moduleNodeId(moduleId: string): string {
  return JSON.stringify(['focus-module', moduleId]);
}

function filteredBridgeNodeId(moduleId: string): string {
  return JSON.stringify(['focus-filtered-bridge', moduleId]);
}

function handle(side: HandleSide, type: 'source' | 'target'): string {
  return `${type}-${side}`;
}

function center(node: GraphFlowNode) {
  return {
    x: node.position.x + (node.width ?? node.measured?.width ?? 0) / 2,
    y: node.position.y + (node.height ?? node.measured?.height ?? 0) / 2,
  };
}

function automaticSides(
  source: GraphFlowNode,
  target: GraphFlowNode,
): { readonly source: HandleSide; readonly target: HandleSide } {
  const a = center(source);
  const b = center(target);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { source: 'right', target: 'left' }
      : { source: 'left', target: 'right' };
  }
  return dy >= 0
    ? { source: 'bottom', target: 'top' }
    : { source: 'top', target: 'bottom' };
}

function endpointNodeId(
  endpoint: FocusSchematicConnectionEndpoint,
  filteredModuleIds: ReadonlySet<string>,
): string {
  if (endpoint.kind === 'visible-entity')
    return rendererNodeId(endpoint.projectionNodeId);
  return filteredModuleIds.has(endpoint.moduleId)
    ? filteredBridgeNodeId(endpoint.moduleId)
    : moduleNodeId(endpoint.moduleId);
}

interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function overlaps(left: Rectangle, right: Rectangle): boolean {
  return (
    left.x < right.x + right.width + FOCUS_SCHEMATIC_LAYOUT_CLEARANCE &&
    left.x + left.width + FOCUS_SCHEMATIC_LAYOUT_CLEARANCE > right.x &&
    left.y < right.y + right.height + FOCUS_SCHEMATIC_LAYOUT_CLEARANCE &&
    left.y + left.height + FOCUS_SCHEMATIC_LAYOUT_CLEARANCE > right.y
  );
}

function placeDiagnostics(
  baseNodes: readonly GraphFlowNode[],
  model: FocusSchematicModel,
  computed: FocusSchematicComputedLayout,
): readonly DiagnosticFlowNode[] {
  const baseById = new Map(
    baseNodes.map((node) => [node.data.projectionNodeId, node]),
  );
  const moduleById = new Map(
    computed.candidate.modules.map((module) => [module.moduleId, module]),
  );
  const occupied: Rectangle[] = [...computed.candidate.modules];
  const placed: DiagnosticFlowNode[] = [];
  for (const diagnostic of [...model.diagnostics].sort((a, b) =>
    compareText(a.id, b.id),
  )) {
    const base = baseById.get(diagnostic.id);
    const owner = moduleById.get(diagnostic.ownerModuleId);
    if (base?.type !== 'diagnostic' || owner === undefined) {
      throw new Error(`Diagnostic "${diagnostic.id}" has no renderer owner.`);
    }
    const width = base.width ?? DIAGNOSTIC_NODE_DIMENSIONS.width;
    const height = base.height ?? DIAGNOSTIC_NODE_DIMENSIONS.height;
    const candidates: Rectangle[] = [];
    for (let step = 0; step < 160; step += 1) {
      const offset = step * (height + FOCUS_SCHEMATIC_LAYOUT_CLEARANCE);
      candidates.push(
        {
          x: owner.x + owner.width + FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
          y: owner.y + offset,
          width,
          height,
        },
        {
          x: owner.x - width - FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
          y: owner.y + offset,
          width,
          height,
        },
        {
          x: owner.x + offset,
          y: owner.y + owner.height + FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
          width,
          height,
        },
      );
    }
    const position = candidates.find((candidate) =>
      occupied.every((item) => !overlaps(candidate, item)),
    );
    if (position === undefined)
      throw new Error(
        `Diagnostic "${diagnostic.id}" could not be placed safely.`,
      );
    occupied.push(position);
    placed.push({
      ...base,
      position: { x: position.x, y: position.y },
      width,
      height,
      measured: { width, height },
    });
  }
  return placed;
}

function edgeFromBase(
  base: GraphFlowEdge,
  sourceNode: GraphFlowNode,
  targetNode: GraphFlowNode,
  sourceSide?: HandleSide,
  targetSide?: HandleSide,
  classSuffix = '',
): GraphFlowEdge {
  const automatic = automaticSides(sourceNode, targetNode);
  return {
    ...base,
    source: sourceNode.id,
    target: targetNode.id,
    sourceHandle: handle(sourceSide ?? automatic.source, 'source'),
    targetHandle: handle(targetSide ?? automatic.target, 'target'),
    className: `${base.className ?? ''}${classSuffix}`,
  };
}

function validatePrepared(
  input: PrepareFocusSchematicRendererGraphInput,
  graph: RendererGraph,
): FocusSchematicRendererValidationResult {
  const computedValidation = validateFocusSchematicComputedLayout(
    input.layoutInput,
    input.computedLayout,
  );
  if (!computedValidation.valid) {
    return {
      valid: false,
      message: `Computed layout is invalid: ${computedValidation.issues[0]?.message ?? 'unknown issue'}`,
    };
  }
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const projectionNodeIds = new Set(input.projection.nodes.map(({ id }) => id));
  const projectionEdgeIds = new Set(input.projection.edges.map(({ id }) => id));
  const candidateById = new Map(
    input.computedLayout.candidate.nodes.map((node) => [
      node.projectionNodeId,
      node,
    ]),
  );
  for (const [projectionNodeId, geometry] of candidateById) {
    const node = nodeById.get(rendererNodeId(projectionNodeId));
    if (
      node === undefined ||
      node.position.x !== geometry.x ||
      node.position.y !== geometry.y ||
      node.width !== geometry.width ||
      node.height !== geometry.height
    ) {
      return {
        valid: false,
        message: `Entity "${projectionNodeId}" geometry is not exact.`,
      };
    }
  }
  const root = graph.nodes.find(
    (node) => node.type === 'entity' && node.data.root,
  );
  if (root === undefined || root.data.entityId !== input.rootEntityId)
    return { valid: false, message: 'Prepared graph has no exact Focus root.' };
  for (const node of graph.nodes) {
    const width = node.width ?? node.measured?.width;
    const height = node.height ?? node.measured?.height;
    if (
      !Number.isFinite(node.position.x) ||
      !Number.isFinite(node.position.y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    )
      return {
        valid: false,
        message: `Node "${node.id}" has invalid geometry.`,
      };
    if (
      node.data.projectionNodeId !== null &&
      !projectionNodeIds.has(node.data.projectionNodeId)
    )
      return {
        valid: false,
        message: `Node "${node.id}" fabricates projection identity.`,
      };
  }
  for (const edge of graph.edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target))
      return {
        valid: false,
        message: `Edge "${edge.id}" has a missing endpoint.`,
      };
    const projectionEdgeId = edge.data?.projectionEdgeId;
    if (
      projectionEdgeId !== null &&
      projectionEdgeId !== undefined &&
      !projectionEdgeIds.has(projectionEdgeId)
    )
      return {
        valid: false,
        message: `Edge "${edge.id}" fabricates projection identity.`,
      };
    if (edge.sourceHandle === undefined || edge.targetHandle === undefined)
      return {
        valid: false,
        message: `Edge "${edge.id}" has no exact handles.`,
      };
  }
  return { valid: true };
}

export function prepareFocusSchematicRendererGraph(
  input: PrepareFocusSchematicRendererGraphInput,
): RendererGraph {
  const visualVariant = input.visualVariant ?? 'extended';
  const base = mapProjectionToReactFlow(input.projection, 'local-structured', {
    rootEntityId: input.rootEntityId,
    visualVariant,
  });
  const baseNodeByProjectionId = new Map(
    base.nodes.map((node) => [node.data.projectionNodeId, node]),
  );
  const baseEdgeByProjectionId = new Map(
    base.edges.map((edge) => [edge.data?.projectionEdgeId, edge]),
  );
  const candidateNodeById = new Map(
    input.computedLayout.candidate.nodes.map((node) => [
      node.projectionNodeId,
      node,
    ]),
  );
  const moduleIdByProjectionNodeId = new Map(
    input.model.modules.flatMap((module) =>
      module.visibleEntityNodeIds.map(
        (projectionNodeId) => [projectionNodeId, module.id] as const,
      ),
    ),
  );
  const entityNodes = [...candidateNodeById]
    .sort(([left], [right]) => compareText(left, right))
    .map(([projectionNodeId, geometry]) => {
      const baseNode = baseNodeByProjectionId.get(projectionNodeId);
      if (baseNode?.type !== 'entity')
        throw new Error(
          `Visible entity "${projectionNodeId}" is missing from React Flow mapping.`,
        );
      const moduleId = moduleIdByProjectionNodeId.get(projectionNodeId);
      if (moduleId === undefined)
        throw new Error(
          `Visible entity "${projectionNodeId}" has no Focus module owner.`,
        );
      return {
        ...baseNode,
        position: { x: geometry.x, y: geometry.y },
        width: geometry.width,
        height: geometry.height,
        measured: { width: geometry.width, height: geometry.height },
        data: {
          ...baseNode.data,
          focusSchematicModuleId: moduleId,
          focusSchematicHoverBehavior:
            baseNode.data.entityKind === 'document'
              ? ('module-aggregate' as const)
              : ('exact' as const),
          hasDirectFileConnectionRing: false,
        },
        zIndex: 2,
      };
    });
  const filteredModuleIds = new Set(
    input.model.modules
      .filter(({ presentation }) => presentation === 'filtered')
      .map(({ id }) => id),
  );
  const moduleNodes: (ModuleBoundaryFlowNode | FilteredBridgeFlowNode)[] = [
    ...input.computedLayout.candidate.modules,
  ]
    .sort((left, right) => compareText(left.moduleId, right.moduleId))
    .map((module) => {
      if (filteredModuleIds.has(module.moduleId)) {
        return {
          id: filteredBridgeNodeId(module.moduleId),
          type: 'filtered-bridge',
          position: { x: module.x, y: module.y },
          width: module.width,
          height: module.height,
          measured: { width: module.width, height: module.height },
          draggable: false,
          connectable: false,
          deletable: false,
          selectable: false,
          focusable: true,
          ariaLabel: 'Filtered File bridge',
          className: 'graph-node graph-node--filtered-bridge',
          data: {
            projectionNodeId: null,
            moduleId: module.moduleId,
            ariaLabel: 'Filtered File bridge',
          },
        } satisfies FilteredBridgeFlowNode;
      }
      return {
        id: moduleNodeId(module.moduleId),
        type: 'module',
        position: { x: module.x, y: module.y },
        width: module.width,
        height: module.height,
        measured: { width: module.width, height: module.height },
        draggable: false,
        connectable: false,
        deletable: false,
        selectable: false,
        focusable: false,
        className: 'graph-node graph-node--focus-module',
        data: {
          projectionNodeId: null,
          moduleId: module.moduleId,
          root: module.moduleId === input.model.rootModuleId,
        },
        zIndex: -1,
      } satisfies ModuleBoundaryFlowNode;
    });
  const diagnosticNodes = placeDiagnostics(
    base.nodes,
    input.model,
    input.computedLayout,
  );
  const nodes: GraphFlowNode[] = [
    ...moduleNodes,
    ...entityNodes,
    ...diagnosticNodes,
  ];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges: GraphFlowEdge[] = [];
  const mappedProjectionEdgeIds = new Set<ProjectionEdgeId>();

  for (const attachment of input.computedLayout.internalLanePlan
    .hierarchyAttachments) {
    const baseEdge = baseEdgeByProjectionId.get(attachment.hierarchyEdgeId);
    const source = nodeById.get(
      rendererNodeId(attachment.sourceProjectionNodeId),
    );
    const target = nodeById.get(
      rendererNodeId(attachment.targetProjectionNodeId),
    );
    if (baseEdge === undefined || source === undefined || target === undefined)
      throw new Error(
        `Hierarchy edge "${attachment.hierarchyEdgeId}" has a missing endpoint.`,
      );
    const automatic = automaticSides(source, target);
    edges.push(
      edgeFromBase(
        baseEdge,
        source,
        target,
        attachment.sourceSide === 'auto'
          ? automatic.source
          : attachment.sourceSide,
        attachment.targetSide === 'auto'
          ? automatic.target
          : attachment.targetSide,
      ),
    );
    mappedProjectionEdgeIds.add(attachment.hierarchyEdgeId);
  }

  const attachmentSide = new Map(
    input.computedLayout.attachments.map((item) => [
      `${item.connectionId}\0${item.endpoint}`,
      item.side,
    ]),
  );
  for (const connection of input.computedLayout.endpointPlan.connections) {
    if (connection.role === 'secondary' && !input.secondaryRelationshipsVisible)
      continue;
    const source = nodeById.get(
      endpointNodeId(connection.source, filteredModuleIds),
    );
    const target = nodeById.get(
      endpointNodeId(connection.target, filteredModuleIds),
    );
    if (source === undefined || target === undefined)
      throw new Error(
        `Connection "${connection.id}" has a missing renderer endpoint.`,
      );
    if (connection.projectedEdgeId !== null) {
      const baseEdge = baseEdgeByProjectionId.get(connection.projectedEdgeId);
      if (baseEdge === undefined)
        throw new Error(`Connection "${connection.id}" has no projected edge.`);
      edges.push(
        edgeFromBase(
          baseEdge,
          source,
          target,
          attachmentSide.get(`${connection.id}\0source`),
          attachmentSide.get(`${connection.id}\0target`),
          connection.role === 'secondary' ? ' graph-edge--secondary' : '',
        ),
      );
      mappedProjectionEdgeIds.add(connection.projectedEdgeId);
      continue;
    }
    const automatic = automaticSides(source, target);
    const ariaLabel = `Fallback reference between File modules, ${connection.referenceIds.length} occurrence${connection.referenceIds.length === 1 ? '' : 's'}`;
    edges.push({
      id: JSON.stringify(['focus-fallback-edge', connection.id]),
      type: 'graph',
      source: source.id,
      target: target.id,
      sourceHandle: handle(
        attachmentSide.get(`${connection.id}\0source`) ?? automatic.source,
        'source',
      ),
      targetHandle: handle(
        attachmentSide.get(`${connection.id}\0target`) ?? automatic.target,
        'target',
      ),
      selectable: false,
      focusable: true,
      deletable: false,
      ariaLabel,
      className: `graph-edge graph-edge--reference graph-edge--focus-fallback${connection.role === 'secondary' ? ' graph-edge--secondary' : ''}`,
      data: {
        projectionEdgeId: null,
        kind: 'reference',
        status: null,
        referenceCount: connection.referenceIds.length,
        ariaLabel,
        visualVariant,
      },
    });
  }

  const hiddenSecondaryEdgeIds = new Set(
    input.computedLayout.endpointPlan.connections
      .filter(
        ({ role, projectedEdgeId }) =>
          role === 'secondary' && projectedEdgeId !== null,
      )
      .map(({ projectedEdgeId }) => projectedEdgeId as ProjectionEdgeId),
  );
  for (const baseEdge of base.edges) {
    const projectionEdgeId = baseEdge.data?.projectionEdgeId;
    if (
      projectionEdgeId === undefined ||
      projectionEdgeId === null ||
      mappedProjectionEdgeIds.has(projectionEdgeId) ||
      (!input.secondaryRelationshipsVisible &&
        hiddenSecondaryEdgeIds.has(projectionEdgeId))
    )
      continue;
    const source = nodeById.get(baseEdge.source);
    const target = nodeById.get(baseEdge.target);
    if (source === undefined || target === undefined) continue;
    edges.push(edgeFromBase(baseEdge, source, target));
    mappedProjectionEdgeIds.add(projectionEdgeId);
  }

  const structuredModuleIds = new Set(
    input.model.modules
      .filter((module) =>
        module.visibleEntityNodeIds.some(
          (projectionNodeId) =>
            projectionNodeId !== module.documentProjectionNodeId,
        ),
      )
      .map(({ id }) => id),
  );
  const directDocumentNodeIds = new Set<string>();
  const nodeByRendererId = new Map(nodes.map((node) => [node.id, node]));
  for (const edge of edges) {
    if (edge.data?.kind !== 'reference') continue;
    for (const endpointId of [edge.source, edge.target]) {
      const endpoint = nodeByRendererId.get(endpointId);
      if (
        endpoint?.type === 'entity' &&
        endpoint.data.entityKind === 'document' &&
        endpoint.data.focusSchematicModuleId !== undefined &&
        structuredModuleIds.has(endpoint.data.focusSchematicModuleId)
      )
        directDocumentNodeIds.add(endpoint.id);
    }
  }
  const decoratedNodes = nodes.map((node): GraphFlowNode =>
    node.type === 'entity' && node.data.entityKind === 'document'
      ? {
          ...node,
          data: {
            ...node.data,
            hasDirectFileConnectionRing: directDocumentNodeIds.has(node.id),
          },
        }
      : node,
  );
  const graph: RendererGraph = {
    nodes: decoratedNodes,
    edges: edges.sort((left, right) => compareText(left.id, right.id)),
    layoutWarning: null,
  };
  const validation = validatePrepared(input, graph);
  if (!validation.valid)
    throw new Error(validation.message ?? 'Prepared modular graph is invalid.');
  return graph;
}

export function validateFocusSchematicRendererGraph(
  input: PrepareFocusSchematicRendererGraphInput,
  graph: RendererGraph,
): FocusSchematicRendererValidationResult {
  return validatePrepared(input, graph);
}
