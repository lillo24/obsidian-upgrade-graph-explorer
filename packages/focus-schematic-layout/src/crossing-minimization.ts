import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';
import type { ProjectionNodeId } from '@icarus-graph-explorer/view-projection';

import type {
  FocusSchematicConnectionEndpoint,
  FocusSchematicEndpointConnection,
  FocusSchematicEndpointPlan,
  FocusSchematicInternalLanePlan,
  FocusSchematicLayoutInput,
  FocusSchematicLayoutPlan,
} from './types';

/** Two outward and two inward passes keep endpoint ordering work bounded. */
export const FOCUS_SCHEMATIC_ENDPOINT_ORDERING_SWEEP_COUNT = 4;
/** One forward and one backward adjacent-swap pass inside each center stack. */
export const FOCUS_SCHEMATIC_CENTER_STACK_ORDERING_SWEEP_COUNT = 2;

const EPSILON = 1e-6;
const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const rectangleCenterY = (rectangle: FocusSchematicRectangle): number =>
  rectangle.y + rectangle.height / 2;

type CandidateNode = FocusSchematicLayoutCandidate['nodes'][number];

interface OrderingSegment {
  readonly connectionId: string;
  readonly lowerRank: number;
  readonly upperRank: number;
  readonly lowerY: number;
  readonly upperY: number;
}

export interface FocusSchematicEndpointOrderMetrics {
  readonly exactEndpointCrossingCount: number;
  readonly adjacentRankOrderInversionCount: number;
  readonly adjacentRankOrderingConnectionCount: number;
}

export interface FocusSchematicVisualSiblingOrderMetrics {
  /** Inverted legal same-parent sibling pairs relative to Markdown source order. */
  readonly visualSiblingOrderDeviationFromSource: number;
  /** Sibling branch roots that participate in at least one visual inversion. */
  readonly visuallyReorderedBranchCount: number;
}

export interface FocusSchematicCrossingMinimizationInstrumentation {
  readonly onOrderingMetricEvaluation?: () => void;
}

interface OrderingScore extends FocusSchematicEndpointOrderMetrics {
  readonly totalVerticalError: number;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1]! + ordered[middle]!) / 2
    : ordered[middle]!;
}

function rankByModuleId(
  modulePlan: FocusSchematicLayoutPlan,
): ReadonlyMap<string, number> {
  return new Map(
    modulePlan.modules.map(({ moduleId, signedRank }) => [
      moduleId,
      signedRank,
    ]),
  );
}

function orderingConnections(
  endpointPlan: FocusSchematicEndpointPlan,
): readonly FocusSchematicEndpointConnection[] {
  return endpointPlan.connections.filter(
    (connection) =>
      connection.kind === 'precise' && connection.role !== 'secondary',
  );
}

function endpointNode(
  candidate: FocusSchematicLayoutCandidate,
  endpoint: FocusSchematicConnectionEndpoint,
): CandidateNode | undefined {
  return endpoint.kind === 'visible-entity'
    ? candidate.nodes.find(
        ({ projectionNodeId }) =>
          projectionNodeId === endpoint.projectionNodeId,
      )
    : undefined;
}

function endpointY(
  candidate: FocusSchematicLayoutCandidate,
  endpoint: FocusSchematicConnectionEndpoint,
): number | undefined {
  const node = endpointNode(candidate, endpoint);
  if (node !== undefined) return rectangleCenterY(node);
  const module = candidate.modules.find(
    ({ moduleId }) => moduleId === endpoint.moduleId,
  );
  return module === undefined ? undefined : rectangleCenterY(module);
}

function orderingSegments(
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
): readonly OrderingSegment[] {
  const ranks = rankByModuleId(modulePlan);
  const nodeById = new Map(
    candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const moduleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const resolvedEndpointY = (
    endpoint: FocusSchematicConnectionEndpoint,
  ): number | undefined => {
    const rectangle =
      endpoint.kind === 'visible-entity'
        ? nodeById.get(endpoint.projectionNodeId)
        : moduleById.get(endpoint.moduleId);
    return rectangle === undefined ? undefined : rectangleCenterY(rectangle);
  };
  return orderingConnections(endpointPlan)
    .flatMap((connection): OrderingSegment[] => {
      const sourceRank = ranks.get(connection.sourceModuleId);
      const targetRank = ranks.get(connection.targetModuleId);
      const sourceY = resolvedEndpointY(connection.source);
      const targetY = resolvedEndpointY(connection.target);
      if (
        sourceRank === undefined ||
        targetRank === undefined ||
        sourceRank === targetRank ||
        sourceY === undefined ||
        targetY === undefined
      )
        return [];
      return sourceRank < targetRank
        ? [
            {
              connectionId: connection.id,
              lowerRank: sourceRank,
              upperRank: targetRank,
              lowerY: sourceY,
              upperY: targetY,
            },
          ]
        : [
            {
              connectionId: connection.id,
              lowerRank: targetRank,
              upperRank: sourceRank,
              lowerY: targetY,
              upperY: sourceY,
            },
          ];
    })
    .sort(
      (left, right) =>
        left.lowerRank - right.lowerRank ||
        left.upperRank - right.upperRank ||
        compareText(left.connectionId, right.connectionId),
    );
}

function inversionCount(segments: readonly OrderingSegment[]): number {
  const byRankPair = new Map<string, OrderingSegment[]>();
  for (const segment of segments) {
    const key = `${segment.lowerRank}:${segment.upperRank}`;
    const group = byRankPair.get(key) ?? [];
    group.push(segment);
    byRankPair.set(key, group);
  }
  let count = 0;
  for (const group of byRankPair.values()) {
    const ordered = [...group].sort(
      (left, right) =>
        left.lowerY - right.lowerY ||
        left.upperY - right.upperY ||
        compareText(left.connectionId, right.connectionId),
    );
    const upperValues = [...new Set(ordered.map(({ upperY }) => upperY))].sort(
      (left, right) => left - right,
    );
    const upperIndex = new Map(
      upperValues.map((value, index) => [value, index + 1]),
    );
    const tree = new Array<number>(upperValues.length + 1).fill(0);
    const add = (index: number) => {
      for (let cursor = index; cursor < tree.length; cursor += cursor & -cursor)
        tree[cursor] = (tree[cursor] ?? 0) + 1;
    };
    const prefix = (index: number) => {
      let total = 0;
      for (let cursor = index; cursor > 0; cursor -= cursor & -cursor)
        total += tree[cursor] ?? 0;
      return total;
    };
    let inserted = 0;
    for (let start = 0; start < ordered.length;) {
      let end = start + 1;
      while (
        end < ordered.length &&
        ordered[end]!.lowerY === ordered[start]!.lowerY
      )
        end += 1;
      for (let index = start; index < end; index += 1) {
        const position = upperIndex.get(ordered[index]!.upperY)!;
        count += inserted - prefix(position);
      }
      for (let index = start; index < end; index += 1) {
        add(upperIndex.get(ordered[index]!.upperY)!);
        inserted += 1;
      }
      start = end;
    }
  }
  return count;
}

export function measureFocusSchematicEndpointOrder(
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
): FocusSchematicEndpointOrderMetrics {
  const segments = orderingSegments(modulePlan, endpointPlan, candidate);
  const adjacent = segments.filter(
    ({ lowerRank, upperRank }) => upperRank - lowerRank === 1,
  );
  return {
    exactEndpointCrossingCount: inversionCount(segments),
    adjacentRankOrderInversionCount: inversionCount(adjacent),
    adjacentRankOrderingConnectionCount: adjacent.length,
  };
}

function orderingScore(
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
  instrumentation?: FocusSchematicCrossingMinimizationInstrumentation,
): OrderingScore {
  instrumentation?.onOrderingMetricEvaluation?.();
  const metrics = measureFocusSchematicEndpointOrder(
    modulePlan,
    endpointPlan,
    candidate,
  );
  const ranks = rankByModuleId(modulePlan);
  const totalVerticalError = orderingConnections(endpointPlan).reduce(
    (sum, connection) => {
      const sourceRank = ranks.get(connection.sourceModuleId);
      const targetRank = ranks.get(connection.targetModuleId);
      if (
        sourceRank === undefined ||
        targetRank === undefined ||
        Math.abs(sourceRank - targetRank) !== 1
      )
        return sum;
      const sourceY = endpointY(candidate, connection.source);
      const targetY = endpointY(candidate, connection.target);
      return sourceY === undefined || targetY === undefined
        ? sum
        : sum + Math.abs(sourceY - targetY);
    },
    0,
  );
  return { ...metrics, totalVerticalError };
}

function improves(left: OrderingScore, right: OrderingScore): boolean {
  return (
    left.exactEndpointCrossingCount < right.exactEndpointCrossingCount ||
    (left.exactEndpointCrossingCount === right.exactEndpointCrossingCount &&
      (left.adjacentRankOrderInversionCount <
        right.adjacentRankOrderInversionCount ||
        (left.adjacentRankOrderInversionCount ===
          right.adjacentRankOrderInversionCount &&
          left.totalVerticalError < right.totalVerticalError - EPSILON)))
  );
}

function translateNodes(
  candidate: FocusSchematicLayoutCandidate,
  deltaByNodeId: ReadonlyMap<ProjectionNodeId, number>,
): FocusSchematicLayoutCandidate {
  return {
    ...candidate,
    nodes: candidate.nodes.map((node) => ({
      ...node,
      y: node.y + (deltaByNodeId.get(node.projectionNodeId) ?? 0),
    })),
  };
}

function descendants(
  rootId: ProjectionNodeId,
  childrenByNodeId: ReadonlyMap<ProjectionNodeId, readonly ProjectionNodeId[]>,
): readonly ProjectionNodeId[] {
  const result: ProjectionNodeId[] = [];
  const visit = (nodeId: ProjectionNodeId) => {
    result.push(nodeId);
    for (const childId of childrenByNodeId.get(nodeId) ?? []) visit(childId);
  };
  visit(rootId);
  return result;
}

export function minimizeFocusSchematicCenterStackCrossings(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  initial: FocusSchematicLayoutCandidate,
  instrumentation?: FocusSchematicCrossingMinimizationInstrumentation,
): FocusSchematicLayoutCandidate {
  const laneByNodeId = new Map(
    lanePlan.nodes.map(({ projectionNodeId, lane }) => [
      projectionNodeId,
      lane,
    ]),
  );
  const moduleByNodeId = new Map(
    input.model.modules.flatMap((module) =>
      module.visibleEntityNodeIds.map((nodeId) => [nodeId, module.id] as const),
    ),
  );
  const childrenByNodeId = new Map<ProjectionNodeId, ProjectionNodeId[]>();
  for (const edge of input.projection.edges) {
    if (
      edge.kind !== 'hierarchy' ||
      moduleByNodeId.get(edge.sourceNodeId) !==
        moduleByNodeId.get(edge.targetNodeId)
    )
      continue;
    const children = childrenByNodeId.get(edge.sourceNodeId) ?? [];
    children.push(edge.targetNodeId);
    childrenByNodeId.set(edge.sourceNodeId, children);
  }
  const sourceLineByNodeId = new Map(
    input.projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node.sourceStartLine] as const] : [],
    ),
  );
  const sourceOrder = (left: ProjectionNodeId, right: ProjectionNodeId) =>
    (sourceLineByNodeId.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (sourceLineByNodeId.get(right) ?? Number.MAX_SAFE_INTEGER) ||
    compareText(left, right);
  for (const children of childrenByNodeId.values()) children.sort(sourceOrder);

  const modules = input.model.modules
    .filter(
      (module) =>
        module.presentation !== 'filtered' &&
        module.documentProjectionNodeId !== null,
    )
    .sort((left, right) => compareText(left.id, right.id));
  let candidate = initial;
  for (
    let sweep = 0;
    sweep < FOCUS_SCHEMATIC_CENTER_STACK_ORDERING_SWEEP_COUNT;
    sweep += 1
  ) {
    for (const module of modules) {
      const documentId = module.documentProjectionNodeId;
      if (documentId === null) continue;
      const documentNode = candidate.nodes.find(
        ({ projectionNodeId }) => projectionNodeId === documentId,
      );
      if (documentNode === undefined) continue;
      const roots = (childrenByNodeId.get(documentId) ?? []).filter(
        (nodeId) => laneByNodeId.get(nodeId) === 'center',
      );
      if (roots.length < 2) continue;
      const branchNodeIds = roots.map((rootId) => {
        const ids: ProjectionNodeId[] = [];
        const visit = (nodeId: ProjectionNodeId) => {
          if (laneByNodeId.get(nodeId) !== 'center') return;
          ids.push(nodeId);
          for (const childId of childrenByNodeId.get(nodeId) ?? [])
            visit(childId);
        };
        visit(rootId);
        return { rootId, nodeIds: ids };
      });

      for (const side of ['above', 'below'] as const) {
        const branches = () =>
          branchNodeIds
            .map((branch) => {
              const nodes = candidate.nodes.filter(({ projectionNodeId }) =>
                branch.nodeIds.includes(projectionNodeId),
              );
              if (nodes.length !== branch.nodeIds.length) return null;
              return {
                ...branch,
                top: Math.min(...nodes.map(({ y }) => y)),
                bottom: Math.max(...nodes.map(({ y, height }) => y + height)),
              };
            })
            .filter((branch) => branch !== null)
            .filter((branch) =>
              side === 'above'
                ? branch.bottom <= documentNode.y + EPSILON
                : branch.top >= documentNode.y + documentNode.height - EPSILON,
            )
            .sort(
              (left, right) =>
                left.top - right.top || sourceOrder(left.rootId, right.rootId),
            );
        const initialBranches = branches();
        if (initialBranches.length < 2) continue;
        const indexes = Array.from(
          { length: initialBranches.length - 1 },
          (_, index) => index,
        );
        if (sweep % 2 === 1) indexes.reverse();
        for (const index of indexes) {
          const current = branches();
          const upper = current[index];
          const lower = current[index + 1];
          if (upper === undefined || lower === undefined) continue;
          const gap = lower.top - upper.bottom;
          if (gap < -EPSILON) continue;
          const lowerHeight = lower.bottom - lower.top;
          const deltaByNodeId = new Map<ProjectionNodeId, number>();
          for (const nodeId of lower.nodeIds)
            deltaByNodeId.set(nodeId, upper.top - lower.top);
          for (const nodeId of upper.nodeIds)
            deltaByNodeId.set(
              nodeId,
              upper.top + lowerHeight + gap - upper.top,
            );
          const proposal = translateNodes(candidate, deltaByNodeId);
          if (
            improves(
              orderingScore(
                modulePlan,
                endpointPlan,
                proposal,
                instrumentation,
              ),
              orderingScore(
                modulePlan,
                endpointPlan,
                candidate,
                instrumentation,
              ),
            )
          )
            candidate = proposal;
        }
      }
    }
  }
  return candidate;
}

function reorderSiblingBranches(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  initial: FocusSchematicLayoutCandidate,
  instrumentation?: FocusSchematicCrossingMinimizationInstrumentation,
): FocusSchematicLayoutCandidate {
  const laneByNodeId = new Map(
    lanePlan.nodes.map(({ projectionNodeId, lane }) => [
      projectionNodeId,
      lane,
    ]),
  );
  const sourceLineByNodeId = new Map(
    input.projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node.sourceStartLine] as const] : [],
    ),
  );
  const moduleByNodeId = new Map(
    input.model.modules.flatMap((module) =>
      module.visibleEntityNodeIds.map((nodeId) => [nodeId, module.id] as const),
    ),
  );
  const childrenByNodeId = new Map<ProjectionNodeId, ProjectionNodeId[]>();
  for (const edge of input.projection.edges) {
    if (
      edge.kind !== 'hierarchy' ||
      moduleByNodeId.get(edge.sourceNodeId) !==
        moduleByNodeId.get(edge.targetNodeId)
    )
      continue;
    const children = childrenByNodeId.get(edge.sourceNodeId) ?? [];
    children.push(edge.targetNodeId);
    childrenByNodeId.set(edge.sourceNodeId, children);
  }
  for (const children of childrenByNodeId.values())
    children.sort(
      (left, right) =>
        (sourceLineByNodeId.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (sourceLineByNodeId.get(right) ?? Number.MAX_SAFE_INTEGER) ||
        compareText(left, right),
    );

  let candidate = initial;
  const parents = [...childrenByNodeId]
    .filter(([, children]) => children.length > 1)
    .map(([parentId]) => parentId)
    .sort((left, right) => {
      const leftModule = moduleByNodeId.get(left) ?? '';
      const rightModule = moduleByNodeId.get(right) ?? '';
      return (
        compareText(leftModule, rightModule) ||
        (sourceLineByNodeId.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (sourceLineByNodeId.get(right) ?? Number.MAX_SAFE_INTEGER) ||
        compareText(left, right)
      );
    });

  for (const parentId of parents) {
    const childIds = childrenByNodeId.get(parentId) ?? [];
    for (const lane of ['left', 'right'] as const) {
      const branches = childIds
        .map((rootId) => ({
          rootId,
          nodeIds: descendants(rootId, childrenByNodeId),
        }))
        .filter(
          ({ nodeIds }) =>
            nodeIds.length > 0 &&
            nodeIds.every((nodeId) => laneByNodeId.get(nodeId) === lane),
        )
        .map((branch) => {
          const nodes = candidate.nodes.filter(({ projectionNodeId }) =>
            branch.nodeIds.includes(projectionNodeId),
          );
          return nodes.length !== branch.nodeIds.length
            ? null
            : {
                ...branch,
                top: Math.min(...nodes.map(({ y }) => y)),
                bottom: Math.max(...nodes.map(({ y, height }) => y + height)),
              };
        })
        .filter((branch) => branch !== null);
      if (branches.length < 2) continue;
      const current = [...branches].sort(
        (left, right) =>
          left.top - right.top || compareText(left.rootId, right.rootId),
      );
      if (
        current.some(
          (branch, index) =>
            index > 0 && branch.top < current[index - 1]!.bottom - EPSILON,
        )
      )
        continue;

      const preferred = branches.map((branch) => {
        const nodeIds = new Set(branch.nodeIds);
        const desiredCenters = orderingConnections(endpointPlan).flatMap(
          (connection) => {
            const sourceInBranch =
              connection.source.kind === 'visible-entity' &&
              nodeIds.has(connection.source.projectionNodeId);
            const targetInBranch =
              connection.target.kind === 'visible-entity' &&
              nodeIds.has(connection.target.projectionNodeId);
            if (sourceInBranch === targetInBranch) return [];
            const own = sourceInBranch ? connection.source : connection.target;
            const counterpart = sourceInBranch
              ? connection.target
              : connection.source;
            const ownY = endpointY(candidate, own);
            const counterpartY = endpointY(candidate, counterpart);
            return ownY === undefined || counterpartY === undefined
              ? []
              : [
                  counterpartY -
                    (ownY - branch.top) +
                    (branch.bottom - branch.top) / 2,
                ];
          },
        );
        return {
          ...branch,
          preferredCenter:
            desiredCenters.length === 0
              ? (branch.top + branch.bottom) / 2
              : median(desiredCenters),
        };
      });
      const ordered = [...preferred].sort(
        (left, right) =>
          left.preferredCenter - right.preferredCenter ||
          (sourceLineByNodeId.get(left.rootId) ?? Number.MAX_SAFE_INTEGER) -
            (sourceLineByNodeId.get(right.rootId) ?? Number.MAX_SAFE_INTEGER) ||
          compareText(left.rootId, right.rootId),
      );
      if (
        ordered.every(
          (branch, index) => branch.rootId === current[index]?.rootId,
        )
      )
        continue;

      const groupTop = Math.min(...branches.map(({ top }) => top));
      const groupBottom = Math.max(...branches.map(({ bottom }) => bottom));
      let cursor = groupTop;
      const deltaByNodeId = new Map<ProjectionNodeId, number>();
      for (const branch of ordered) {
        const delta = cursor - branch.top;
        for (const nodeId of branch.nodeIds) deltaByNodeId.set(nodeId, delta);
        cursor +=
          branch.bottom - branch.top + input.settings.internalNodeSeparation;
      }
      cursor -= input.settings.internalNodeSeparation;
      if (cursor > groupBottom + EPSILON) continue;
      const proposal = translateNodes(candidate, deltaByNodeId);
      if (
        improves(
          orderingScore(modulePlan, endpointPlan, proposal, instrumentation),
          orderingScore(modulePlan, endpointPlan, candidate, instrumentation),
        )
      )
        candidate = proposal;
    }
  }
  return candidate;
}

/**
 * Reuses the accepted HIER3B-FIX1 branch movers against the candidate's current
 * external endpoint positions. Only whole, same-parent branches move, and the
 * fixed sweep counts keep this candidate-local pass deterministic and bounded.
 */
export function minimizeFocusSchematicInternalBranchCrossings(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  initial: FocusSchematicLayoutCandidate,
  instrumentation?: FocusSchematicCrossingMinimizationInstrumentation,
): FocusSchematicLayoutCandidate {
  return reorderSiblingBranches(
    input,
    modulePlan,
    endpointPlan,
    lanePlan,
    minimizeFocusSchematicCenterStackCrossings(
      input,
      modulePlan,
      endpointPlan,
      lanePlan,
      initial,
      instrumentation,
    ),
    instrumentation,
  );
}

export function measureFocusSchematicVisualSiblingOrder(
  input: FocusSchematicLayoutInput,
  lanePlan: FocusSchematicInternalLanePlan,
  candidate: FocusSchematicLayoutCandidate,
): FocusSchematicVisualSiblingOrderMetrics {
  const laneByNodeId = new Map(
    lanePlan.nodes.map(({ projectionNodeId, lane }) => [
      projectionNodeId,
      lane,
    ]),
  );
  const nodeById = new Map(
    candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const moduleByNodeId = new Map(
    input.model.modules.flatMap((module) =>
      module.visibleEntityNodeIds.map((nodeId) => [nodeId, module.id] as const),
    ),
  );
  const sourceLineByNodeId = new Map(
    input.projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node.sourceStartLine] as const] : [],
    ),
  );
  const childrenByParent = new Map<ProjectionNodeId, ProjectionNodeId[]>();
  for (const edge of input.projection.edges) {
    if (
      edge.kind !== 'hierarchy' ||
      moduleByNodeId.get(edge.sourceNodeId) !==
        moduleByNodeId.get(edge.targetNodeId)
    )
      continue;
    const children = childrenByParent.get(edge.sourceNodeId) ?? [];
    children.push(edge.targetNodeId);
    childrenByParent.set(edge.sourceNodeId, children);
  }
  let visualSiblingOrderDeviationFromSource = 0;
  const reordered = new Set<ProjectionNodeId>();
  for (const children of childrenByParent.values()) {
    for (const lane of ['left', 'center', 'right'] as const) {
      const group = children
        .filter((nodeId) => laneByNodeId.get(nodeId) === lane)
        .filter((nodeId) => nodeById.has(nodeId));
      for (let left = 0; left < group.length; left += 1)
        for (let right = left + 1; right < group.length; right += 1) {
          const leftId = group[left]!;
          const rightId = group[right]!;
          const sourceDelta =
            (sourceLineByNodeId.get(leftId) ?? Number.MAX_SAFE_INTEGER) -
              (sourceLineByNodeId.get(rightId) ?? Number.MAX_SAFE_INTEGER) ||
            compareText(leftId, rightId);
          const visualDelta =
            rectangleCenterY(nodeById.get(leftId)!) -
              rectangleCenterY(nodeById.get(rightId)!) ||
            compareText(leftId, rightId);
          if (Math.sign(sourceDelta) !== Math.sign(visualDelta)) {
            visualSiblingOrderDeviationFromSource += 1;
            reordered.add(leftId);
            reordered.add(rightId);
          }
        }
    }
  }
  return {
    visualSiblingOrderDeviationFromSource,
    visuallyReorderedBranchCount: reordered.size,
  };
}

function repackRank(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  initial: FocusSchematicLayoutCandidate,
  signedRank: number,
  adjacentRank: number,
): FocusSchematicLayoutCandidate {
  const ranks = rankByModuleId(modulePlan);
  const rankModules = initial.modules.filter(
    ({ moduleId }) => ranks.get(moduleId) === signedRank,
  );
  if (rankModules.length < 2) return initial;
  const connected = orderingConnections(endpointPlan).filter((connection) => {
    const sourceRank = ranks.get(connection.sourceModuleId);
    const targetRank = ranks.get(connection.targetModuleId);
    return (
      (sourceRank === signedRank && targetRank === adjacentRank) ||
      (targetRank === signedRank && sourceRank === adjacentRank)
    );
  });
  if (connected.length === 0) return initial;

  const sourceLineByModuleId = new Map(
    input.model.modules.map((module) => {
      const document = input.projection.nodes.find(
        (node) =>
          node.kind === 'entity' && node.id === module.documentProjectionNodeId,
      );
      return [
        module.id,
        document?.kind === 'entity'
          ? document.sourceStartLine
          : Number.MAX_SAFE_INTEGER,
      ];
    }),
  );
  const withPreferences = rankModules.map((module) => {
    const desiredCenters = connected.flatMap((connection) => {
      const sourceIsOwn = connection.sourceModuleId === module.moduleId;
      const targetIsOwn = connection.targetModuleId === module.moduleId;
      if (!sourceIsOwn && !targetIsOwn) return [];
      const own = sourceIsOwn ? connection.source : connection.target;
      const counterpart = sourceIsOwn ? connection.target : connection.source;
      const ownY = endpointY(initial, own);
      const counterpartY = endpointY(initial, counterpart);
      return ownY === undefined || counterpartY === undefined
        ? []
        : [counterpartY - (ownY - module.y) + module.height / 2];
    });
    return {
      module,
      influenced: desiredCenters.length > 0,
      preferredCenter:
        desiredCenters.length === 0
          ? rectangleCenterY(module)
          : median(desiredCenters),
    };
  });
  if (!withPreferences.some(({ influenced }) => influenced)) return initial;
  const ordered = [...withPreferences].sort(
    (left, right) =>
      left.preferredCenter - right.preferredCenter ||
      rectangleCenterY(left.module) - rectangleCenterY(right.module) ||
      (sourceLineByModuleId.get(left.module.moduleId) ??
        Number.MAX_SAFE_INTEGER) -
        (sourceLineByModuleId.get(right.module.moduleId) ??
          Number.MAX_SAFE_INTEGER) ||
      compareText(left.module.moduleId, right.module.moduleId),
  );

  let cursor = Number.NEGATIVE_INFINITY;
  const packed = ordered.map((item) => {
    const preferredTop = item.preferredCenter - item.module.height / 2;
    const top =
      cursor === Number.NEGATIVE_INFINITY
        ? preferredTop
        : Math.max(preferredTop, cursor + input.settings.macroNodeSeparation);
    cursor = top + item.module.height;
    return { ...item, top };
  });
  const translation = median(
    packed.map(
      ({ module, preferredCenter, top }) =>
        top + module.height / 2 - preferredCenter,
    ),
  );
  const deltaByModuleId = new Map(
    packed.map(({ module, top }) => [
      module.moduleId,
      top - translation - module.y,
    ]),
  );
  const proposal: FocusSchematicLayoutCandidate = {
    ...initial,
    modules: initial.modules.map((module) => ({
      ...module,
      y: module.y + (deltaByModuleId.get(module.moduleId) ?? 0),
    })),
    nodes: initial.nodes.map((node) => ({
      ...node,
      y: node.y + (deltaByModuleId.get(node.moduleId) ?? 0),
    })),
  };
  return improves(
    orderingScore(modulePlan, endpointPlan, proposal),
    orderingScore(modulePlan, endpointPlan, initial),
  )
    ? proposal
    : initial;
}

function sweepMacroRanks(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  initial: FocusSchematicLayoutCandidate,
): FocusSchematicLayoutCandidate {
  const ranks = [
    ...new Set(
      modulePlan.modules
        .map(({ signedRank }) => signedRank)
        .filter((rank) => rank !== 0),
    ),
  ];
  const available = new Set<number>([
    ...ranks,
    ...modulePlan.modules
      .filter(({ signedRank }) => signedRank === 0)
      .map(({ signedRank }) => signedRank),
  ]);
  let candidate = initial;
  for (
    let sweep = 0;
    sweep < FOCUS_SCHEMATIC_ENDPOINT_ORDERING_SWEEP_COUNT;
    sweep += 1
  ) {
    const outward = sweep % 2 === 0;
    for (const sign of [-1, 1] as const) {
      const sideRanks = ranks
        .filter((rank) => Math.sign(rank) === sign)
        .sort((left, right) =>
          outward
            ? Math.abs(left) - Math.abs(right)
            : Math.abs(right) - Math.abs(left),
        );
      for (const rank of sideRanks) {
        const adjacentRank = outward ? rank - sign : rank + sign;
        if (!available.has(adjacentRank)) continue;
        candidate = repackRank(
          input,
          modulePlan,
          endpointPlan,
          candidate,
          rank,
          adjacentRank,
        );
      }
    }
  }
  return candidate;
}

/**
 * Reorders existing A1 rectangles only. It neither creates route waypoints nor
 * lets display-only secondary connections influence geometry.
 */
export function minimizeFocusSchematicEndpointCrossings(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  initial: FocusSchematicLayoutCandidate,
): FocusSchematicLayoutCandidate {
  const macroOrdered = sweepMacroRanks(
    input,
    modulePlan,
    endpointPlan,
    initial,
  );
  return minimizeFocusSchematicInternalBranchCrossings(
    input,
    modulePlan,
    endpointPlan,
    lanePlan,
    macroOrdered,
  );
}
