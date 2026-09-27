import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';
import type {
  FocusSchematicLayoutInput,
  FocusSchematicLayoutTransitionEvidence,
  FocusSchematicTransitionMode,
} from './types';

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const center = (value: FocusSchematicRectangle) => ({
  x: value.x + value.width / 2,
  y: value.y + value.height / 2,
});
const displacement = (
  before: FocusSchematicRectangle,
  after: FocusSchematicRectangle,
) => {
  const a = center(before);
  const b = center(after);
  return Math.hypot(b.x - a.x, b.y - a.y);
};
const percentile = (values: readonly number[], fraction: number): number => {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[
    Math.min(ordered.length - 1, Math.ceil(values.length * fraction) - 1)
  ]!;
};

export function focusSchematicCompassBranchRegions(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
): ReadonlyMap<string, 'top' | 'bottom' | 'left' | 'right'> {
  const nodeById = new Map(
    candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const result = new Map<string, 'top' | 'bottom' | 'left' | 'right'>();
  for (const module of input.model.modules) {
    const file =
      module.documentProjectionNodeId === null
        ? undefined
        : nodeById.get(module.documentProjectionNodeId);
    if (file === undefined) continue;
    const fileCenter = center(file);
    for (const edgeId of module.hierarchyEdgeIds) {
      const edge = input.projection.edges.find(
        (item) => item.id === edgeId && item.kind === 'hierarchy',
      );
      if (
        edge === undefined ||
        edge.sourceNodeId !== module.documentProjectionNodeId
      )
        continue;
      const branch = nodeById.get(edge.targetNodeId);
      if (branch === undefined) continue;
      const branchCenter = center(branch);
      const dx = branchCenter.x - fileCenter.x;
      const dy = branchCenter.y - fileCenter.y;
      result.set(
        edge.targetNodeId,
        Math.abs(dx) > Math.abs(dy)
          ? dx < 0
            ? 'left'
            : 'right'
          : dy < 0
            ? 'top'
            : 'bottom',
      );
    }
  }
  return result;
}

export function countFocusSchematicSurvivingCompassBranchChanges(
  priorInput: FocusSchematicLayoutInput,
  currentInput: FocusSchematicLayoutInput,
  prior: FocusSchematicLayoutCandidate,
  current: FocusSchematicLayoutCandidate,
): number {
  const before = focusSchematicCompassBranchRegions(priorInput, prior);
  const after = focusSchematicCompassBranchRegions(currentInput, current);
  return [...after].filter(
    ([id, region]) => before.has(id) && before.get(id) !== region,
  ).length;
}

export interface FocusSchematicSurvivingNodeContinuityMetrics {
  readonly survivingNodeCount: number;
  readonly movedSurvivingNodeCount: number;
  readonly meanSurvivingNodeDisplacement: number;
  readonly p95SurvivingNodeDisplacement: number;
  readonly maxSurvivingNodeDisplacement: number;
}

/** Rectangle-center continuity for stable projection-node IDs. */
export function measureFocusSchematicSurvivingNodeContinuity(
  prior: FocusSchematicLayoutCandidate,
  current: FocusSchematicLayoutCandidate,
): FocusSchematicSurvivingNodeContinuityMetrics {
  const priorById = new Map(
    prior.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const values = current.nodes.flatMap((node) => {
    const before = priorById.get(node.projectionNodeId);
    return before === undefined ? [] : [displacement(before, node)];
  });
  return {
    survivingNodeCount: values.length,
    movedSurvivingNodeCount: values.filter((value) => value > 1e-6).length,
    meanSurvivingNodeDisplacement:
      values.length === 0
        ? 0
        : values.reduce((sum, value) => sum + value, 0) / values.length,
    p95SurvivingNodeDisplacement: percentile(values, 0.95),
    maxSurvivingNodeDisplacement: values.length === 0 ? 0 : Math.max(...values),
  };
}

export function createFocusSchematicTransitionEvidence(args: {
  readonly mode: FocusSchematicTransitionMode;
  readonly eligible: boolean;
  readonly rejectionReason: string | null;
  readonly priorInput?: FocusSchematicLayoutInput;
  readonly currentInput: FocusSchematicLayoutInput;
  readonly prior?: FocusSchematicLayoutCandidate;
  readonly current: FocusSchematicLayoutCandidate;
  readonly affectedModuleIds: readonly string[];
  readonly localRepairIterations?: number;
  readonly localRepairCandidates?: number;
  readonly localRepairFrontierModuleCount?: number;
}): FocusSchematicLayoutTransitionEvidence {
  const priorById = new Map(
    (args.prior?.modules ?? []).map((module) => [module.moduleId, module]),
  );
  const affected = new Set(args.affectedModuleIds);
  const displacements = args.current.modules
    .filter(
      ({ moduleId }) => !affected.has(moduleId) && priorById.has(moduleId),
    )
    .map((module) => displacement(priorById.get(module.moduleId)!, module));
  return {
    schemaVersion: 1,
    mode: args.mode,
    eligible: args.eligible,
    classification: args.eligible ? 'local-internal-change' : 'cold-required',
    rejectionReason: args.rejectionReason,
    priorModuleCount: args.prior?.modules.length ?? 0,
    survivingModuleCount: args.current.modules.filter(({ moduleId }) =>
      priorById.has(moduleId),
    ).length,
    affectedModuleCount: affected.size,
    unchangedModuleCount: Math.max(
      0,
      args.current.modules.length - affected.size,
    ),
    movedUnaffectedModuleCount: displacements.filter((value) => value > 1e-6)
      .length,
    meanUnaffectedModuleDisplacement:
      displacements.length === 0
        ? 0
        : displacements.reduce((sum, value) => sum + value, 0) /
          displacements.length,
    p95UnaffectedModuleDisplacement: percentile(displacements, 0.95),
    maxUnaffectedModuleDisplacement:
      displacements.length === 0 ? 0 : Math.max(...displacements),
    changedSurvivingCompassBranchCount:
      args.prior === undefined || args.priorInput === undefined
        ? 0
        : countFocusSchematicSurvivingCompassBranchChanges(
            args.priorInput,
            args.currentInput,
            args.prior,
            args.current,
          ),
    localRepairFrontierModuleCount: args.localRepairFrontierModuleCount ?? 0,
    localRepairIterations: args.localRepairIterations ?? 0,
    localRepairCandidates: args.localRepairCandidates ?? 0,
    coldFallbackUsed: args.mode === 'cold-fallback',
  };
}

export function focusSchematicChangedModuleIds(
  before: FocusSchematicLayoutCandidate,
  after: FocusSchematicLayoutCandidate,
): readonly string[] {
  const beforeById = new Map(
    before.modules.map((item) => [item.moduleId, item]),
  );
  return after.modules
    .filter((item) => {
      const prior = beforeById.get(item.moduleId);
      return prior === undefined || displacement(prior, item) > 1e-6;
    })
    .map(({ moduleId }) => moduleId)
    .sort(compareText);
}
