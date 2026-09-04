import dagre from '@dagrejs/dagre';
import { computeDagreLayout } from '@icarus-graph-explorer/dagre-layout/compute';
import {
  evaluateFocusSchematicLayout,
  validateFocusSchematicLayoutCandidate,
  type FocusSchematicLayoutCandidate,
  type FocusSchematicModel,
} from '@icarus-graph-explorer/focus-schematic';
import {
  createFocusSchematicLayoutPlan,
  createFocusSchematicSiblingConstraints,
  FILTERED_MODULE_DIMENSIONS,
  FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
  type FocusSchematicLayoutAttempt,
  type FocusSchematicLayoutInput,
  type FocusSchematicLayoutPhaseTimings,
  type FocusSchematicNativeRoute,
} from '@icarus-graph-explorer/focus-schematic-layout';

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const now = () => Date.now();

function timings(
  started: number,
  values: Partial<FocusSchematicLayoutPhaseTimings> = {},
): FocusSchematicLayoutPhaseTimings {
  return {
    inputMs: values.inputMs ?? 0,
    planningMs: values.planningMs ?? 0,
    internalMs: values.internalMs ?? 0,
    macroMs: values.macroMs ?? 0,
    postMs: values.postMs ?? 0,
    validateMs: values.validateMs ?? 0,
    qualityMs: values.qualityMs ?? 0,
    serializeMs: values.serializeMs ?? 0,
    totalMs: now() - started,
  };
}

function finalAttempt(input: {
  readonly started: number;
  readonly strategyId: string;
  readonly configId: string;
  readonly model: FocusSchematicModel;
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly nativeRoutes: readonly FocusSchematicNativeRoute[];
  readonly warnings: readonly string[];
  readonly phaseTimings: Partial<FocusSchematicLayoutPhaseTimings>;
}): FocusSchematicLayoutAttempt {
  const validateStarted = now();
  const validation = validateFocusSchematicLayoutCandidate(
    input.model,
    input.candidate,
  );
  const validateMs = now() - validateStarted;
  if (!validation.valid)
    throw new Error(
      `Candidate validation failed: ${validation.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    );
  const qualityStarted = now();
  const quality = evaluateFocusSchematicLayout(input.model, input.candidate, {
    clearance: FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
    rankTolerance: 1,
  });
  const qualityMs = now() - qualityStarted;
  const serializeStarted = now();
  JSON.stringify(input.candidate);
  const serializeMs = now() - serializeStarted;
  const plan = createFocusSchematicLayoutPlan(input.model);
  const selected = new Set(
    plan.modules.flatMap(({ parentRelationshipId }) =>
      parentRelationshipId === null ? [] : [parentRelationshipId],
    ),
  );
  const routed = new Set(
    input.nativeRoutes.map(({ relationshipId }) => relationshipId),
  );
  return {
    status: 'success',
    strategyId: input.strategyId,
    configId: input.configId,
    plan,
    candidate: input.candidate,
    quality,
    nativeRoutes: input.nativeRoutes,
    routeCoverage: selected.size === 0 ? 1 : routed.size / selected.size,
    warnings: input.warnings,
    timings: timings(input.started, {
      ...input.phaseTimings,
      validateMs,
      qualityMs,
      serializeMs,
    }),
  };
}

function failure(
  started: number,
  strategyId: string,
  configId: string,
  error: unknown,
): FocusSchematicLayoutAttempt {
  return {
    status: 'failure',
    strategyId,
    configId,
    reason: error instanceof Error ? error.message : String(error),
    timings: timings(started),
  };
}

export function computeClassicBaselineAttempt(
  input: FocusSchematicLayoutInput,
): FocusSchematicLayoutAttempt {
  const started = now();
  const strategyId = 'D0-current-flat-dagre';
  const configId = 'production-focus-wrapper-3.1.1';
  if (
    input.model.modules.some(({ presentation }) => presentation === 'filtered')
  )
    return {
      status: 'unsupported',
      strategyId,
      configId,
      reason:
        'Current flat production mapping has no positive-geometry filtered-module representation.',
      timings: timings(started),
    };
  try {
    const planningStarted = now();
    const plan = createFocusSchematicLayoutPlan(input.model);
    const planningMs = now() - planningStarted;
    const dimensions = new Map(
      input.nodeDimensions.map((item) => [item.projectionNodeId, item]),
    );
    const visible = new Set(dimensions.keys());
    const layoutStarted = now();
    const output = computeDagreLayout({
      mode: 'focus',
      nodes: input.nodeDimensions.map((item) => ({
        id: item.projectionNodeId,
        width: item.width,
        height: item.height,
      })),
      edges: input.projection.edges
        .filter(
          (edge) =>
            visible.has(edge.sourceNodeId) && visible.has(edge.targetNodeId),
        )
        .map((edge) => ({
          id: edge.id,
          source: edge.sourceNodeId,
          target: edge.targetNodeId,
          kind: edge.kind,
        })),
    });
    const positionById = new Map(
      output.positions.map((item) => [item.id, item]),
    );
    const provisionalNodes = input.nodeDimensions.map((dimension) => {
      const position = positionById.get(dimension.projectionNodeId);
      const owner = input.model.modules.find(({ visibleEntityNodeIds }) =>
        visibleEntityNodeIds.includes(dimension.projectionNodeId),
      );
      if (position === undefined || owner === undefined)
        throw new Error(
          `Classic baseline omitted "${dimension.projectionNodeId}".`,
        );
      return {
        projectionNodeId: dimension.projectionNodeId,
        moduleId: owner.id,
        x: position.x,
        y: position.y,
        width: dimension.width,
        height: dimension.height,
      };
    });
    const provisionalModules = input.model.modules.map((module) => {
      const nodes = provisionalNodes.filter(
        ({ moduleId }) => moduleId === module.id,
      );
      if (nodes.length === 0)
        throw new Error(`Classic baseline module "${module.id}" has no node.`);
      const minX = Math.min(...nodes.map(({ x }) => x));
      const minY = Math.min(...nodes.map(({ y }) => y));
      const maxX = Math.max(...nodes.map(({ x, width }) => x + width));
      const maxY = Math.max(...nodes.map(({ y, height }) => y + height));
      return {
        moduleId: module.id,
        x: minX - input.settings.modulePaddingX,
        y: minY - input.settings.modulePaddingY,
        width: maxX - minX + input.settings.modulePaddingX * 2,
        height:
          maxY -
          minY +
          input.settings.modulePaddingY * 2 +
          (module.diagnosticIds.length > 0
            ? input.settings.diagnosticReserveHeight
            : 0),
      };
    });
    const root = provisionalModules.find(
      ({ moduleId }) => moduleId === input.model.rootModuleId,
    );
    if (root === undefined)
      throw new Error('Classic baseline omitted the root module.');
    const offsetX = root.x + root.width / 2;
    const offsetY = root.y + root.height / 2;
    const candidate: FocusSchematicLayoutCandidate = {
      modelSchemaVersion: 1,
      rootModuleId: input.model.rootModuleId,
      modules: provisionalModules
        .map((module) => ({
          ...module,
          x: module.x - offsetX,
          y: module.y - offsetY,
        }))
        .sort((left, right) => compareText(left.moduleId, right.moduleId)),
      nodes: provisionalNodes
        .map((node) => ({ ...node, x: node.x - offsetX, y: node.y - offsetY }))
        .sort((left, right) =>
          compareText(left.projectionNodeId, right.projectionNodeId),
        ),
      routes: [],
    };
    const macroMs = now() - layoutStarted;
    const attempt = finalAttempt({
      started,
      strategyId,
      configId,
      model: input.model,
      candidate,
      nativeRoutes: [],
      warnings: [
        'D0 measures the current flat production Dagre topology; derived module rectangles may overlap.',
        'D0 is the Classic Focus Hierarchy preservation baseline, not a modular adoption candidate.',
      ],
      phaseTimings: { planningMs, macroMs },
    });
    return attempt.status === 'success' ? { ...attempt, plan } : attempt;
  } catch (error) {
    return failure(started, strategyId, configId, error);
  }
}

function moduleEndpoint(
  input: FocusSchematicLayoutInput,
  moduleId: string,
  relationshipId: string,
  endpoint: 'source' | 'target',
  anchorByModule: ReadonlyMap<string, string>,
): string {
  const module = input.model.modules.find(({ id }) => id === moduleId);
  const relationship = input.model.relationships.find(
    ({ id }) => id === relationshipId,
  );
  if (module === undefined || relationship === undefined)
    throw new Error(
      `Compound endpoint owner is missing for "${relationshipId}".`,
    );
  const visible = new Set(module.visibleEntityNodeIds);
  const precise = [...relationship.visibleEndpointGroups]
    .sort((left, right) => {
      const specificity = (group: typeof left) =>
        Number(group.sourcePrecision !== 'document') +
        Number(group.targetPrecision !== 'document');
      return (
        specificity(right) - specificity(left) ||
        compareText(left.projectedEdgeId, right.projectedEdgeId)
      );
    })
    .map((group) =>
      endpoint === 'source'
        ? group.sourceProjectionNodeId
        : group.targetProjectionNodeId,
    )
    .find((nodeId) => visible.has(nodeId));
  return (
    precise ??
    module.documentProjectionNodeId ??
    anchorByModule.get(moduleId) ??
    (() => {
      throw new Error(
        `Compound module "${moduleId}" has no public edge endpoint.`,
      );
    })()
  );
}

export function computeCompoundAttempt(
  input: FocusSchematicLayoutInput,
): FocusSchematicLayoutAttempt {
  const started = now();
  const strategyId = 'B-compound-dagre';
  const configId = `B-${input.settings.ranker}-i${input.settings.internalNodeSeparation}-${input.settings.internalRankSeparation}-m${input.settings.macroNodeSeparation}-${input.settings.macroRankSeparation}`;
  try {
    const planningStarted = now();
    const plan = createFocusSchematicLayoutPlan(input.model);
    const planningMs = now() - planningStarted;
    const graph = new dagre.graphlib.Graph({
      compound: true,
      multigraph: true,
    });
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({
      rankdir: 'LR',
      nodesep: input.settings.macroNodeSeparation,
      ranksep: input.settings.macroRankSeparation,
      ranker: input.settings.ranker,
    });
    const dimensions = new Map(
      input.nodeDimensions.map((item) => [item.projectionNodeId, item]),
    );
    const sourceOrder = new Map(
      input.projection.nodes.flatMap((node) =>
        node.kind === 'entity'
          ? [[node.id, node.sourceStartLine] as const]
          : [],
      ),
    );
    const clusterByModule = new Map<string, string>();
    const anchorByModule = new Map<string, string>();
    for (const module of [...input.model.modules].sort((left, right) =>
      compareText(left.id, right.id),
    )) {
      const clusterId = `__hier2_cluster__${module.id}`;
      clusterByModule.set(module.id, clusterId);
      graph.setNode(clusterId, {
        width: 0,
        height: 0,
        rankdir: 'LR',
        nodesep: input.settings.internalNodeSeparation,
        ranksep: input.settings.internalRankSeparation,
      });
      if (module.presentation === 'filtered') {
        const anchorId = `__hier2_filtered_anchor__${module.id}`;
        anchorByModule.set(module.id, anchorId);
        graph.setNode(
          anchorId,
          FILTERED_MODULE_DIMENSIONS[input.settings.filteredModulePolicy],
        );
        graph.setParent(anchorId, clusterId);
      } else {
        for (const nodeId of [...module.visibleEntityNodeIds].sort(
          (left, right) =>
            (sourceOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
              (sourceOrder.get(right) ?? Number.MAX_SAFE_INTEGER) ||
            compareText(left, right),
        )) {
          const dimension = dimensions.get(nodeId);
          if (dimension === undefined)
            throw new Error(`Missing compound dimension for "${nodeId}".`);
          graph.setNode(nodeId, {
            width: dimension.width,
            height: dimension.height,
          });
          graph.setParent(nodeId, clusterId);
        }
      }
    }
    const hierarchyIds = new Set(
      input.model.modules.flatMap(({ hierarchyEdgeIds }) => hierarchyEdgeIds),
    );
    input.projection.edges
      .filter((edge) => edge.kind === 'hierarchy' && hierarchyIds.has(edge.id))
      .sort((left, right) => compareText(left.id, right.id))
      .forEach((edge) =>
        graph.setEdge(
          edge.sourceNodeId,
          edge.targetNodeId,
          { minlen: 1, weight: 8 },
          edge.id,
        ),
      );
    for (const item of plan.modules) {
      if (item.parentModuleId === null || item.parentRelationshipId === null)
        continue;
      const relationship = input.model.relationships.find(
        ({ id }) => id === item.parentRelationshipId,
      );
      if (relationship === undefined)
        throw new Error(`Missing relationship "${item.parentRelationshipId}".`);
      const source = moduleEndpoint(
        input,
        relationship.sourceModuleId,
        relationship.id,
        'source',
        anchorByModule,
      );
      const target = moduleEndpoint(
        input,
        relationship.targetModuleId,
        relationship.id,
        'target',
        anchorByModule,
      );
      graph.setEdge(
        source,
        target,
        { minlen: 1, weight: 10 },
        `backbone:${item.moduleId}`,
      );
    }
    const layoutStarted = now();
    dagre.layout(graph, {
      useDynamic: false,
      constraints: createFocusSchematicSiblingConstraints(
        input.projection,
        new Set(
          input.model.modules.flatMap(
            ({ visibleEntityNodeIds }) => visibleEntityNodeIds,
          ),
        ),
      ),
    });
    const macroMs = now() - layoutStarted;
    const provisionalNodes = input.model.modules.flatMap((module) =>
      module.visibleEntityNodeIds.map((projectionNodeId) => {
        const geometry = graph.node(projectionNodeId) as
          { x: number; y: number; width: number; height: number } | undefined;
        if (
          geometry === undefined ||
          !Number.isFinite(geometry.x) ||
          !Number.isFinite(geometry.y)
        )
          throw new Error(
            `Compound Dagre omitted child position "${projectionNodeId}".`,
          );
        return {
          projectionNodeId,
          moduleId: module.id,
          x: geometry.x - geometry.width / 2,
          y: geometry.y - geometry.height / 2,
          width: geometry.width,
          height: geometry.height,
        };
      }),
    );
    const provisionalModules = input.model.modules.map((module) => {
      const clusterId = clusterByModule.get(module.id)!;
      const cluster = graph.node(clusterId) as
        { x: number; y: number; width: number; height: number } | undefined;
      if (
        cluster === undefined ||
        !Number.isFinite(cluster.x) ||
        !Number.isFinite(cluster.y)
      )
        throw new Error(
          `Compound Dagre omitted cluster geometry "${module.id}".`,
        );
      if (module.presentation === 'filtered') {
        const size =
          FILTERED_MODULE_DIMENSIONS[input.settings.filteredModulePolicy];
        return {
          moduleId: module.id,
          x: cluster.x - size.width / 2,
          y: cluster.y - size.height / 2,
          ...size,
        };
      }
      const nodes = provisionalNodes.filter(
        ({ moduleId }) => moduleId === module.id,
      );
      const minX = Math.min(...nodes.map(({ x }) => x));
      const minY = Math.min(...nodes.map(({ y }) => y));
      const maxX = Math.max(...nodes.map(({ x, width }) => x + width));
      const maxY = Math.max(...nodes.map(({ y, height }) => y + height));
      return {
        moduleId: module.id,
        x: minX - input.settings.modulePaddingX,
        y: minY - input.settings.modulePaddingY,
        width: maxX - minX + input.settings.modulePaddingX * 2,
        height:
          maxY -
          minY +
          input.settings.modulePaddingY * 2 +
          (module.diagnosticIds.length > 0
            ? input.settings.diagnosticReserveHeight
            : 0),
      };
    });
    const root = provisionalModules.find(
      ({ moduleId }) => moduleId === input.model.rootModuleId,
    );
    if (root === undefined)
      throw new Error('Compound Dagre omitted root cluster.');
    const offsetX = root.x + root.width / 2;
    const offsetY = root.y + root.height / 2;
    const candidate: FocusSchematicLayoutCandidate = {
      modelSchemaVersion: 1,
      rootModuleId: input.model.rootModuleId,
      modules: provisionalModules
        .map((module) => ({
          ...module,
          x: module.x - offsetX,
          y: module.y - offsetY,
        }))
        .sort((left, right) => compareText(left.moduleId, right.moduleId)),
      nodes: provisionalNodes
        .map((node) => ({ ...node, x: node.x - offsetX, y: node.y - offsetY }))
        .sort((left, right) =>
          compareText(left.projectionNodeId, right.projectionNodeId),
        ),
      routes: [],
    };
    const nativeRoutes: FocusSchematicNativeRoute[] = plan.modules.flatMap(
      (item) => {
        if (item.parentRelationshipId === null || item.parentModuleId === null)
          return [];
        const relationship = input.model.relationships.find(
          ({ id }) => id === item.parentRelationshipId,
        );
        if (relationship === undefined) return [];
        const source = moduleEndpoint(
          input,
          relationship.sourceModuleId,
          relationship.id,
          'source',
          anchorByModule,
        );
        const target = moduleEndpoint(
          input,
          relationship.targetModuleId,
          relationship.id,
          'target',
          anchorByModule,
        );
        const edge = graph.edge({
          v: source,
          w: target,
          name: `backbone:${item.moduleId}`,
        }) as { points?: readonly { x: number; y: number }[] } | undefined;
        return edge?.points === undefined
          ? []
          : [
              {
                relationshipId: relationship.id,
                points: edge.points.map(({ x, y }) => ({
                  x: x - offsetX,
                  y: y - offsetY,
                })),
              },
            ];
      },
    );
    return finalAttempt({
      started,
      strategyId,
      configId,
      model: input.model,
      candidate,
      nativeRoutes,
      warnings: [
        'Candidate module rectangles are re-derived from public child geometry plus the shared padding; native cluster rectangles are evidence only.',
        'Primary candidate routes remain empty for fair A/B comparison.',
      ],
      phaseTimings: { planningMs, macroMs },
    });
  } catch (error) {
    return failure(started, strategyId, configId, error);
  }
}

export interface HardGateResult {
  readonly passed: boolean;
  readonly failures: readonly string[];
}

export function evaluateHardGates(
  attempt: FocusSchematicLayoutAttempt,
): HardGateResult {
  if (attempt.status !== 'success')
    return { passed: false, failures: [`attempt:${attempt.status}`] };
  const quality = attempt.quality;
  const root = attempt.candidate.modules.find(
    ({ moduleId }) => moduleId === attempt.candidate.rootModuleId,
  );
  const planById = new Map(
    attempt.plan.modules.map((item) => [item.moduleId, item]),
  );
  const candidateById = new Map(
    attempt.candidate.modules.map((item) => [item.moduleId, item]),
  );
  const planSideFailures = attempt.plan.modules.flatMap((item) => {
    const module = candidateById.get(item.moduleId);
    if (module === undefined || item.side === 'center') return [];
    const centerX = module.x + module.width / 2;
    return item.side === 'left'
      ? centerX < 0
        ? []
        : [item.moduleId]
      : centerX > 0
        ? []
        : [item.moduleId];
  });
  const parentFailures = attempt.plan.modules.flatMap((item) => {
    if (item.parentModuleId === null) return [];
    const parent = planById.get(item.parentModuleId);
    return parent !== undefined &&
      Math.abs(parent.signedRank) === Math.abs(item.signedRank) - 1
      ? []
      : [item.moduleId];
  });
  const checks: readonly [string, number][] = [
    ['missing-modules', quality.missingModuleIds.length],
    ['missing-nodes', quality.missingVisibleNodeIds.length],
    ['unexpected-modules', quality.unexpectedModuleIds.length],
    ['unexpected-nodes', quality.unexpectedNodeIds.length],
    ['nonfinite', quality.nonFiniteGeometryCount],
    ['module-overlap', quality.moduleOverlapPairs.length],
    ['node-overlap', quality.nodeOverlapPairs.length],
    ['node-outside', quality.nodeOutsideModuleIds.length],
    ['left-side', quality.leftSideViolationModuleIds.length],
    ['right-side', quality.rightSideViolationModuleIds.length],
    ['rank-order', quality.rankOrderViolationModuleIds.length],
    ['plan-side', planSideFailures.length],
    ['plan-parent', parentFailures.length],
    [
      'root-origin',
      root === undefined
        ? 1
        : Math.hypot(root.x + root.width / 2, root.y + root.height / 2) > 0.001
          ? 1
          : 0,
    ],
  ];
  const failures = checks
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}:${count}`);
  return { passed: failures.length === 0, failures };
}
