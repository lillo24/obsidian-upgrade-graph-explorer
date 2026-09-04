import dagre from '@dagrejs/dagre';
import {
  evaluateFocusSchematicLayout,
  validateFocusSchematicLayoutCandidate,
  type FocusSchematicLayoutCandidate,
  type FocusSchematicModel,
} from '@icarus-graph-explorer/focus-schematic';
import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

import { assertFocusSchematicLayoutInput } from './input';
import { createFocusSchematicLayoutPlan } from './plan';
import { createFocusSchematicSiblingConstraints } from './source-order';
import {
  FILTERED_MODULE_DIMENSIONS,
  FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
} from './settings';
import type {
  FocusSchematicLayoutAttempt,
  FocusSchematicLayoutInput,
  FocusSchematicLayoutPhaseTimings,
  FocusSchematicNativeRoute,
} from './types';

const STRATEGY_ID = 'A-two-stage-dagre';
const now = () => Date.now();
const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

interface LocalModuleLayout {
  readonly moduleId: string;
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly {
    readonly projectionNodeId: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
}

function emptyTimings(totalMs = 0): FocusSchematicLayoutPhaseTimings {
  return {
    inputMs: 0,
    planningMs: 0,
    internalMs: 0,
    macroMs: 0,
    postMs: 0,
    validateMs: 0,
    qualityMs: 0,
    serializeMs: 0,
    totalMs,
  };
}

function internalLayout(
  input: FocusSchematicLayoutInput,
  module: FocusSchematicModel['modules'][number],
  projection: ViewProjection,
): LocalModuleLayout {
  if (module.presentation === 'filtered') {
    const size =
      FILTERED_MODULE_DIMENSIONS[input.settings.filteredModulePolicy];
    return { moduleId: module.id, ...size, nodes: [] };
  }
  const dimensions = new Map(
    input.nodeDimensions.map((item) => [item.projectionNodeId, item]),
  );
  const sourceOrder = new Map(
    projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node.sourceStartLine] as const] : [],
    ),
  );
  const orderedNodeIds = [...module.visibleEntityNodeIds].sort(
    (left, right) =>
      (sourceOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (sourceOrder.get(right) ?? Number.MAX_SAFE_INTEGER) ||
      compareText(left, right),
  );
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: 'LR',
    nodesep: input.settings.internalNodeSeparation,
    ranksep: input.settings.internalRankSeparation,
    ranker: input.settings.ranker,
  });
  for (const nodeId of orderedNodeIds) {
    const dimension = dimensions.get(nodeId);
    if (dimension === undefined)
      throw new Error(`Missing dimension for internal node "${nodeId}".`);
    graph.setNode(nodeId, { width: dimension.width, height: dimension.height });
  }
  const hierarchyIds = new Set(module.hierarchyEdgeIds);
  projection.edges
    .filter(
      (edge) =>
        edge.kind === 'hierarchy' &&
        hierarchyIds.has(edge.id) &&
        graph.hasNode(edge.sourceNodeId) &&
        graph.hasNode(edge.targetNodeId),
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
      projection,
      new Set(module.visibleEntityNodeIds),
    ),
  });
  const positioned = orderedNodeIds.map((projectionNodeId) => {
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
  if (positioned.length === 0)
    throw new Error(
      `Visible module "${module.id}" has no visible entity nodes.`,
    );
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
    nodes: positioned.map((node) => ({
      ...node,
      x: node.x - minX + input.settings.modulePaddingX,
      y: node.y - minY + input.settings.modulePaddingY,
    })),
  };
}

export function computeFocusSchematicLayoutAttempt(
  value: FocusSchematicLayoutInput,
): FocusSchematicLayoutAttempt {
  const started = now();
  const configId = `A-${value.settings.ranker}-i${value.settings.internalNodeSeparation}-${value.settings.internalRankSeparation}-m${value.settings.macroNodeSeparation}-${value.settings.macroRankSeparation}`;
  try {
    const inputStarted = now();
    assertFocusSchematicLayoutInput(value);
    const inputMs = now() - inputStarted;
    const planningStarted = now();
    const plan = createFocusSchematicLayoutPlan(value.model);
    const planningMs = now() - planningStarted;
    const internalStarted = now();
    const localLayouts = value.model.modules
      .map((module) => internalLayout(value, module, value.projection))
      .sort((left, right) => compareText(left.moduleId, right.moduleId));
    const internalMs = now() - internalStarted;

    const macroStarted = now();
    const macro = new dagre.graphlib.Graph({ multigraph: true });
    macro.setDefaultEdgeLabel(() => ({}));
    macro.setGraph({
      rankdir: 'LR',
      nodesep: value.settings.macroNodeSeparation,
      ranksep: value.settings.macroRankSeparation,
      ranker: value.settings.ranker,
    });
    for (const module of localLayouts)
      macro.setNode(module.moduleId, {
        width: module.width,
        height: module.height,
      });
    for (const item of plan.modules) {
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
    const root = macro.node(value.model.rootModuleId) as {
      x: number;
      y: number;
    };
    const nativeRoutes: FocusSchematicNativeRoute[] = plan.modules.flatMap(
      (item) => {
        if (
          item.parentModuleId === null ||
          item.parentRelationshipId === null ||
          item.side === 'center'
        )
          return [];
        const source =
          item.side === 'left' ? item.moduleId : item.parentModuleId;
        const target =
          item.side === 'left' ? item.parentModuleId : item.moduleId;
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
    const candidate: FocusSchematicLayoutCandidate = {
      modelSchemaVersion: 1,
      rootModuleId: value.model.rootModuleId,
      modules: modules.sort((left, right) =>
        compareText(left.moduleId, right.moduleId),
      ),
      nodes: nodes.sort((left, right) =>
        compareText(left.projectionNodeId, right.projectionNodeId),
      ),
      routes: [],
    };
    const macroMs = now() - macroStarted;
    const validateStarted = now();
    const validation = validateFocusSchematicLayoutCandidate(
      value.model,
      candidate,
    );
    const validateMs = now() - validateStarted;
    if (!validation.valid)
      throw new Error(
        `Candidate validation failed: ${validation.issues
          .map(({ path, message }) => `${path}: ${message}`)
          .join('; ')}`,
      );
    const qualityStarted = now();
    const quality = evaluateFocusSchematicLayout(value.model, candidate, {
      clearance: FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
      rankTolerance: 1,
    });
    const qualityMs = now() - qualityStarted;
    const serializeStarted = now();
    JSON.stringify(candidate);
    const serializeMs = now() - serializeStarted;
    const selectedRelationshipCount = new Set(
      plan.modules.flatMap(({ parentRelationshipId }) =>
        parentRelationshipId === null ? [] : [parentRelationshipId],
      ),
    ).size;
    const routedRelationshipCount = new Set(
      nativeRoutes.map(({ relationshipId }) => relationshipId),
    ).size;
    return {
      status: 'success',
      strategyId: STRATEGY_ID,
      configId,
      plan,
      candidate,
      quality,
      nativeRoutes,
      routeCoverage:
        selectedRelationshipCount === 0
          ? 1
          : routedRelationshipCount / selectedRelationshipCount,
      warnings: [
        'Primary candidate routes are intentionally empty; native macro routes are exploratory evidence.',
      ],
      timings: {
        inputMs,
        planningMs,
        internalMs,
        macroMs,
        postMs: 0,
        validateMs,
        qualityMs,
        serializeMs,
        totalMs: now() - started,
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

export function computeFocusSchematicLayout(
  input: FocusSchematicLayoutInput,
): FocusSchematicLayoutCandidate {
  const attempt = computeFocusSchematicLayoutAttempt(input);
  if (attempt.status !== 'success')
    throw new Error(`Focus Schematic layout failed: ${attempt.reason}`);
  return attempt.candidate;
}
