import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';
import { createFocusSchematicEndpointAttachments } from './attachments';
import {
  computeFocusSchematicRevision2LayoutAttempt,
  evaluateFocusSchematicEndpointLayoutQuality,
  validateFocusSchematicComputedLayout,
} from './endpoint-facing';
import { evaluateFocusSchematicFolderBandQuality } from './folder-bands';
import {
  applyFocusSchematicInternalLayoutVariant,
  createFocusSchematicInternalLayoutEvidence,
  createFocusSchematicInternalLayoutRunStats,
} from './internal-layout-variants';
import {
  createFocusSchematicTransitionEvidence,
  focusSchematicChangedModuleIds,
} from './layout-continuity';
import {
  normalizeFocusSchematicSoftAncestorDecayBase,
  normalizeFocusSchematicSoftFolderDisplayIntent,
  normalizeFocusSchematicSoftFolderStrength,
  type FocusSchematicProductLayoutPolicies,
} from './policies';
import { FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING } from './soft-cluster-spacing';
import {
  buildFocusSchematicSoftFolderDisplayTree,
  projectFocusSchematicSoftFolderGroupingTree,
} from './soft-folder-display';
import {
  applyFocusSchematicSoftFolderCohesion,
  measureFocusSchematicSoftFolderCohesion,
} from './soft-folder-cohesion';
import {
  countFocusSchematicSoftRadialSpreadSafetyViolations,
  createFocusSchematicSoftCompoundBodies,
  packFocusSchematicSoftFolderGroups,
} from './soft-group-packing';
import {
  applyFocusSchematicSoftNestedHierarchyPacking,
  measureFocusSchematicSoftFolderCoverage,
  measureFocusSchematicSoftNestedHierarchy,
} from './soft-nested-hierarchy-packing';
import type {
  FocusSchematicComputedLayout,
  FocusSchematicEndpointLayoutPhaseTimings,
  FocusSchematicLayoutInput,
  FocusSchematicLayoutTransitionEvidence,
  FocusSchematicSoftFolderDisplayTree,
} from './types';
import type {
  FocusSchematicLayoutTransitionPrior,
  FocusSchematicTransitionClassification,
} from './transition-prior';

const EPSILON = 1e-6;
const LOCAL_REPAIR_ROUND_LIMIT = 2;

export type FocusSchematicIncrementalLayoutAttempt =
  | {
      readonly status: 'success';
      readonly result: FocusSchematicComputedLayout;
      readonly evidence: FocusSchematicLayoutTransitionEvidence;
      readonly timings: FocusSchematicEndpointLayoutPhaseTimings;
    }
  | { readonly status: 'failure'; readonly reason: string };

const center = (value: FocusSchematicRectangle) => ({
  x: value.x + value.width / 2,
  y: value.y + value.height / 2,
});

function translateModule(
  candidate: FocusSchematicLayoutCandidate,
  moduleId: string,
  dx: number,
  dy: number,
): FocusSchematicLayoutCandidate {
  return {
    ...candidate,
    modules: candidate.modules.map((module) =>
      module.moduleId === moduleId
        ? { ...module, x: module.x + dx, y: module.y + dy }
        : module,
    ),
    nodes: candidate.nodes.map((node) =>
      node.moduleId === moduleId
        ? { ...node, x: node.x + dx, y: node.y + dy }
        : node,
    ),
    routes: [],
  };
}

function placeAtPriorCenters(
  candidate: FocusSchematicLayoutCandidate,
  prior: FocusSchematicLayoutCandidate,
): FocusSchematicLayoutCandidate {
  const priorById = new Map(
    prior.modules.map((module) => [module.moduleId, module]),
  );
  let placed = candidate;
  for (const module of candidate.modules) {
    const before = priorById.get(module.moduleId);
    if (before === undefined) continue;
    const current = placed.modules.find(
      ({ moduleId }) => moduleId === module.moduleId,
    )!;
    const from = center(current);
    const to = center(before);
    placed = translateModule(
      placed,
      module.moduleId,
      to.x - from.x,
      to.y - from.y,
    );
  }
  return placed;
}

function preservePriorInternalGeometry(
  candidate: FocusSchematicLayoutCandidate,
  prior: FocusSchematicLayoutCandidate,
  affectedModuleIds: ReadonlySet<string>,
): FocusSchematicLayoutCandidate {
  const priorModuleById = new Map(
    prior.modules.map((module) => [module.moduleId, module]),
  );
  const priorNodeById = new Map(
    prior.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const dimensionById = new Map(
    candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const nodes = candidate.nodes.map((node) => {
    const before = priorNodeById.get(node.projectionNodeId);
    if (before === undefined) return node;
    if (!affectedModuleIds.has(node.moduleId)) return before;
    const beforeCenter = center(before);
    const currentDimension = dimensionById.get(node.projectionNodeId)!;
    return {
      ...node,
      x: beforeCenter.x - currentDimension.width / 2,
      y: beforeCenter.y - currentDimension.height / 2,
      width: currentDimension.width,
      height: currentDimension.height,
    };
  });
  const padding = FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING;
  const modules = candidate.modules.map((module) => {
    const before = priorModuleById.get(module.moduleId);
    if (before === undefined) return module;
    if (!affectedModuleIds.has(module.moduleId)) return before;
    const ownNodes = nodes.filter(
      ({ moduleId }) => moduleId === module.moduleId,
    );
    if (ownNodes.length === 0) return { ...module, x: before.x, y: before.y };
    const shrinkOnly = ownNodes.every((node) => {
      const priorNode = priorNodeById.get(node.projectionNodeId);
      return (
        priorNode !== undefined &&
        node.width <= priorNode.width &&
        node.height <= priorNode.height
      );
    });
    const alreadyContained = ownNodes.every(
      (node) =>
        node.x >= before.x + padding.modulePaddingX - EPSILON &&
        node.y >= before.y + padding.modulePaddingY - EPSILON &&
        node.x + node.width <=
          before.x + before.width - padding.modulePaddingX + EPSILON &&
        node.y + node.height <=
          before.y + before.height - padding.modulePaddingY + EPSILON,
    );
    if (alreadyContained && !shrinkOnly) return before;
    const fixedCenter = center(before);
    const left = Math.min(...ownNodes.map(({ x }) => x));
    const right = Math.max(...ownNodes.map(({ x, width }) => x + width));
    const top = Math.min(...ownNodes.map(({ y }) => y));
    const bottom = Math.max(...ownNodes.map(({ y, height }) => y + height));
    const halfWidth = Math.max(
      fixedCenter.x - left + padding.modulePaddingX,
      right - fixedCenter.x + padding.modulePaddingX,
    );
    const halfHeight = Math.max(
      fixedCenter.y - top + padding.modulePaddingY,
      bottom - fixedCenter.y + padding.modulePaddingY,
    );
    const width = shrinkOnly
      ? Math.min(before.width, halfWidth * 2)
      : halfWidth * 2;
    const height = shrinkOnly
      ? Math.min(before.height, halfHeight * 2)
      : halfHeight * 2;
    return {
      ...module,
      x: fixedCenter.x - width / 2,
      y: fixedCenter.y - height / 2,
      width,
      height,
    };
  });
  return { ...candidate, modules, nodes, routes: [] };
}

function overlaps(
  left: FocusSchematicRectangle,
  right: FocusSchematicRectangle,
  gap = 8,
): boolean {
  return (
    left.x < right.x + right.width + gap &&
    left.x + left.width + gap > right.x &&
    left.y < right.y + right.height + gap &&
    left.y + left.height + gap > right.y
  );
}

/** Places only newly revealed structural subtrees; every surviving node remains frozen. */
function placeNewSubtrees(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
  prior: FocusSchematicLayoutCandidate,
): FocusSchematicLayoutCandidate {
  const priorIds = new Set(
    prior.nodes.map(({ projectionNodeId }) => projectionNodeId),
  );
  const newIds = new Set(
    candidate.nodes
      .filter(({ projectionNodeId }) => !priorIds.has(projectionNodeId))
      .map(({ projectionNodeId }) => projectionNodeId),
  );
  if (newIds.size === 0) return candidate;
  const incoming = new Map<string, string>();
  const children = new Map<string, string[]>();
  for (const edge of input.projection.edges) {
    if (edge.kind !== 'hierarchy') continue;
    incoming.set(edge.targetNodeId, edge.sourceNodeId);
    const values = children.get(edge.sourceNodeId) ?? [];
    values.push(edge.targetNodeId);
    children.set(edge.sourceNodeId, values);
  }
  let nodes = [...candidate.nodes];
  const roots = [...newIds]
    .filter((id) => !newIds.has(incoming.get(id) ?? ''))
    .sort();
  for (const rootId of roots) {
    const groupIds = new Set<string>();
    const queue = [rootId];
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index]!;
      if (!newIds.has(id) || groupIds.has(id)) continue;
      groupIds.add(id);
      queue.push(...(children.get(id) ?? []));
    }
    const group = nodes.filter(({ projectionNodeId }) =>
      groupIds.has(projectionNodeId),
    );
    const parent = nodes.find(
      ({ projectionNodeId }) => projectionNodeId === incoming.get(rootId),
    );
    if (group.length === 0 || parent === undefined) continue;
    const left = Math.min(...group.map(({ x }) => x));
    const right = Math.max(...group.map(({ x, width }) => x + width));
    const top = Math.min(...group.map(({ y }) => y));
    const bottom = Math.max(...group.map(({ y, height }) => y + height));
    const envelope = {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
    const obstacles = nodes.filter(
      ({ projectionNodeId }) => !groupIds.has(projectionNodeId),
    );
    const safe = (dx: number, dy: number) =>
      group.every((node) =>
        obstacles.every(
          (obstacle) =>
            !overlaps({ ...node, x: node.x + dx, y: node.y + dy }, obstacle),
        ),
      );
    if (safe(0, 0)) continue;
    const gap =
      FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING.internalNodeSeparation;
    const step = Math.max(40, gap);
    const proposals: { dx: number; dy: number; score: number; key: string }[] =
      [];
    for (let slot = 0; slot <= 16; slot += 1) {
      const offsets = slot === 0 ? [0] : [slot * step, -slot * step];
      for (const offset of offsets) {
        const targets = [
          {
            x: parent.x - gap - envelope.width,
            y: center(parent).y + offset - envelope.height / 2,
            key: 'left',
          },
          {
            x: parent.x + parent.width + gap,
            y: center(parent).y + offset - envelope.height / 2,
            key: 'right',
          },
          {
            x: center(parent).x + offset - envelope.width / 2,
            y: parent.y - gap - envelope.height,
            key: 'top',
          },
          {
            x: center(parent).x + offset - envelope.width / 2,
            y: parent.y + parent.height + gap,
            key: 'bottom',
          },
        ];
        for (const target of targets) {
          const dx = target.x - envelope.x;
          const dy = target.y - envelope.y;
          if (safe(dx, dy))
            proposals.push({
              dx,
              dy,
              score: dx * dx + dy * dy,
              key: `${slot}:${target.key}:${offset}`,
            });
        }
      }
    }
    proposals.sort(
      (a, b) =>
        a.score - b.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    );
    const selected = proposals[0];
    if (selected === undefined) continue;
    nodes = nodes.map((node) =>
      groupIds.has(node.projectionNodeId)
        ? { ...node, x: node.x + selected.dx, y: node.y + selected.dy }
        : node,
    );
  }
  return preservePriorInternalGeometry(
    { ...candidate, nodes },
    prior,
    new Set(
      candidate.modules
        .filter(({ moduleId }) =>
          nodes.some(
            (node) =>
              node.moduleId === moduleId && newIds.has(node.projectionNodeId),
          ),
        )
        .map(({ moduleId }) => moduleId),
    ),
  );
}

function displayTree(
  input: FocusSchematicLayoutInput,
  policies: FocusSchematicProductLayoutPolicies,
): FocusSchematicSoftFolderDisplayTree {
  return projectFocusSchematicSoftFolderGroupingTree(
    buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: input.model.modules
        .filter(({ presentation }) => presentation !== 'filtered')
        .map(({ id, folderKey }) => ({
          fileId: id,
          exactFolderKey: folderKey,
        })),
      intent: normalizeFocusSchematicSoftFolderDisplayIntent(
        policies.softFolderDisplayIntent,
      ),
    }),
    { excludedFileIds: [input.model.rootModuleId] },
  );
}

function softPolicyEvidence(policies: FocusSchematicProductLayoutPolicies) {
  return {
    schemaVersion: 9 as const,
    layoutFamily: 'soft-folder-clusters' as const,
    strength: normalizeFocusSchematicSoftFolderStrength(
      policies.softFolderStrength,
    ),
    structuralSpacing: FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING,
    endpointOrderPolicy: policies.endpointOrderPolicy,
    displayIntent: normalizeFocusSchematicSoftFolderDisplayIntent(
      policies.softFolderDisplayIntent,
    ),
    folderScopeMode: policies.softFolderScopeMode,
    ancestorDecayBase:
      policies.softFolderScopeMode === 'nearest-only'
        ? null
        : normalizeFocusSchematicSoftAncestorDecayBase(
            policies.softAncestorDecayBase,
          ),
    hierarchyForcePolicy:
      policies.softFolderScopeMode === 'nearest-only'
        ? ('nearest-only' as const)
        : ('normalized-decay' as const),
    fileAttachmentPolicy: 'spatial-cardinal' as const,
    compassDemandPolicy: 'spatial-cardinal' as const,
    spatialDemandSummary: 'dominant-cardinal' as const,
  };
}

function buildComputed(
  input: FocusSchematicLayoutInput,
  policies: FocusSchematicProductLayoutPolicies,
  base: FocusSchematicComputedLayout,
  candidate: FocusSchematicLayoutCandidate,
  stats: ReturnType<typeof createFocusSchematicInternalLayoutRunStats>,
): FocusSchematicComputedLayout {
  const attachments = createFocusSchematicEndpointAttachments(
    base.endpointPlan,
    candidate,
    'soft-cardinal-files',
  );
  const quality = evaluateFocusSchematicEndpointLayoutQuality(
    input,
    base.modulePlan,
    base.endpointPlan,
    base.internalLanePlan,
    candidate,
    attachments,
    'soft-cardinal-files',
  );
  const folderBandQuality = evaluateFocusSchematicFolderBandQuality(
    input,
    base.modulePlan,
    base.folderBandPlan,
    candidate,
    base.quality,
    quality,
  );
  const softInput = {
    ...input,
    settings: {
      ...input.settings,
      internalNodeSeparation:
        FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING.internalNodeSeparation,
      internalRankSeparation:
        FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING.internalRankSeparation,
      modulePaddingX:
        FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING.modulePaddingX,
      modulePaddingY:
        FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING.modulePaddingY,
    },
  };
  return {
    ...base,
    candidate,
    attachments,
    quality,
    folderBandQuality,
    internalLayoutEvidence: {
      ...createFocusSchematicInternalLayoutEvidence(
        softInput,
        base.endpointPlan,
        candidate,
        base.candidate,
        policies.internalLayoutVariant,
        stats,
      ),
      softClusterPolicyEvidence: softPolicyEvidence(policies),
    },
  };
}

function hardFailure(
  input: FocusSchematicLayoutInput,
  policies: FocusSchematicProductLayoutPolicies,
  tree: FocusSchematicSoftFolderDisplayTree,
  computed: FocusSchematicComputedLayout,
): string | null {
  const validation = validateFocusSchematicComputedLayout(input, computed);
  if (!validation.valid)
    return validation.issues.map(({ message }) => message).join('; ');
  const quality = computed.quality;
  if (
    quality.moduleOverlapPairs.length > 0 ||
    quality.nodeOverlapPairs.length > 0 ||
    quality.nodeOutsideModuleIds.length > 0
  )
    return 'overlap-or-containment';
  const rootModule = input.model.modules.find(
    ({ id }) => id === input.model.rootModuleId,
  );
  const rootFile = computed.candidate.nodes.find(
    ({ projectionNodeId }) =>
      projectionNodeId === rootModule?.documentProjectionNodeId,
  );
  if (
    rootFile === undefined ||
    Math.abs(center(rootFile).x) > EPSILON ||
    Math.abs(center(rootFile).y) > EPSILON
  )
    return 'focus-anchor-moved';
  const cohesion = measureFocusSchematicSoftFolderCohesion(
    computed.candidate,
    tree,
  );
  if (cohesion.immediateFolderSplitViolationCount > 0)
    return 'immediate-folder-split';
  if (policies.softFolderScopeMode === 'nested') {
    const nested = measureFocusSchematicSoftNestedHierarchy(
      computed.candidate,
      tree,
    );
    if (
      nested.nestedParentContainmentViolationCount > 0 ||
      nested.nestedFolderSplitViolationCount > 0 ||
      nested.nestedGuideBlockerViolationCount > 0
    )
      return 'nested-folder-geometry';
  }
  const coverage = measureFocusSchematicSoftFolderCoverage(tree, {
    focusExemptFileCount: input.model.modules.some(
      ({ id, presentation }) =>
        id === input.model.rootModuleId && presentation !== 'filtered',
    )
      ? 1
      : 0,
    filteredBridgeExemptFileCount: input.model.modules.filter(
      ({ presentation }) => presentation === 'filtered',
    ).length,
    nested: policies.softFolderScopeMode === 'nested',
  });
  if (
    coverage.missingImmediateFolderGuideCount > 0 ||
    coverage.nestedAncestorCoverageViolationCount > 0
  )
    return 'folder-coverage';
  const radial = countFocusSchematicSoftRadialSpreadSafetyViolations(
    createFocusSchematicSoftCompoundBodies(input, computed.candidate, tree, {
      folderScopeMode: policies.softFolderScopeMode,
    }),
  );
  return radial === 0 ? null : 'radial-spread-safety';
}

function locallyRepair(
  input: FocusSchematicLayoutInput,
  policies: FocusSchematicProductLayoutPolicies,
  tree: FocusSchematicSoftFolderDisplayTree,
  initial: FocusSchematicLayoutCandidate,
  accept: (candidate: FocusSchematicLayoutCandidate) => boolean,
): {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly iterations: number;
  readonly candidates: number;
} {
  let candidate = initial;
  let candidates = 0;
  for (
    let iteration = 1;
    iteration <= LOCAL_REPAIR_ROUND_LIMIT;
    iteration += 1
  ) {
    candidate = applyFocusSchematicSoftFolderCohesion(
      candidate,
      tree,
      input.model.rootModuleId,
    ).candidate;
    candidates += 1;
    if (policies.softFolderScopeMode === 'nested') {
      candidate = applyFocusSchematicSoftNestedHierarchyPacking(
        candidate,
        tree,
      ).candidate;
      candidates += 1;
    }
    candidate = packFocusSchematicSoftFolderGroups(input, candidate, tree, {
      folderScopeMode: policies.softFolderScopeMode,
    }).candidate;
    candidates += 1;
    if (accept(candidate))
      return { candidate, iterations: iteration, candidates };
  }
  return { candidate, iterations: LOCAL_REPAIR_ROUND_LIMIT, candidates };
}

export function computeFocusSchematicIncrementalLayoutAttempt(
  input: FocusSchematicLayoutInput,
  policies: FocusSchematicProductLayoutPolicies,
  prior: FocusSchematicLayoutTransitionPrior,
  classification: FocusSchematicTransitionClassification,
): FocusSchematicIncrementalLayoutAttempt {
  const started = performance.now();
  try {
    if (!classification.eligible)
      return { status: 'failure', reason: classification.reason };
    const baseAttempt = computeFocusSchematicRevision2LayoutAttempt(input);
    if (baseAttempt.status !== 'success')
      return { status: 'failure', reason: baseAttempt.reason };
    const base = baseAttempt.result;
    const stats = createFocusSchematicInternalLayoutRunStats();
    const softInput: FocusSchematicLayoutInput = {
      ...input,
      settings: {
        ...input.settings,
        internalNodeSeparation:
          FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING.internalNodeSeparation,
        internalRankSeparation:
          FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING.internalRankSeparation,
        modulePaddingX:
          FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING.modulePaddingX,
        modulePaddingY:
          FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING.modulePaddingY,
      },
    };
    let candidate = placeAtPriorCenters(base.candidate, prior.result.candidate);
    candidate = applyFocusSchematicInternalLayoutVariant(
      softInput,
      base.modulePlan,
      base.endpointPlan,
      candidate,
      policies.internalLayoutVariant,
      policies.endpointOrderPolicy,
      stats,
      'soft-cardinal-files',
      'spatial-cardinal',
      'dominant-cardinal',
    );
    candidate = preservePriorInternalGeometry(
      candidate,
      prior.result.candidate,
      new Set(classification.affectedModuleIds),
    );
    candidate = placeNewSubtrees(input, candidate, prior.result.candidate);
    const tree = displayTree(input, policies);
    let computed = buildComputed(input, policies, base, candidate, stats);
    const fastFailure = hardFailure(input, policies, tree, computed);
    if (fastFailure === null) {
      const elapsed = performance.now() - started;
      return {
        status: 'success',
        result: computed,
        evidence: createFocusSchematicTransitionEvidence({
          mode: 'incremental-no-macro-move',
          eligible: true,
          rejectionReason: null,
          priorInput: prior.input,
          currentInput: input,
          prior: prior.result.candidate,
          current: computed.candidate,
          affectedModuleIds: classification.affectedModuleIds,
        }),
        timings: {
          ...baseAttempt.timings,
          macroMs: 0,
          totalMs: elapsed,
          outputSerializedBytes: new TextEncoder().encode(
            JSON.stringify(computed),
          ).byteLength,
        },
      };
    }
    const repair = locallyRepair(
      input,
      policies,
      tree,
      candidate,
      (proposal) =>
        hardFailure(
          input,
          policies,
          tree,
          buildComputed(input, policies, base, proposal, stats),
        ) === null,
    );
    computed = buildComputed(input, policies, base, repair.candidate, stats);
    const repairFailure = hardFailure(input, policies, tree, computed);
    if (repairFailure !== null)
      return {
        status: 'failure',
        reason: `incremental repair rejected: ${fastFailure}; ${repairFailure}`,
      };
    const frontier = focusSchematicChangedModuleIds(
      candidate,
      repair.candidate,
    );
    return {
      status: 'success',
      result: computed,
      evidence: createFocusSchematicTransitionEvidence({
        mode: 'incremental-local-repair',
        eligible: true,
        rejectionReason: fastFailure,
        priorInput: prior.input,
        currentInput: input,
        prior: prior.result.candidate,
        current: computed.candidate,
        affectedModuleIds: classification.affectedModuleIds,
        localRepairIterations: repair.iterations,
        localRepairCandidates: repair.candidates,
        localRepairFrontierModuleCount: frontier.length,
      }),
      timings: {
        ...baseAttempt.timings,
        macroMs: performance.now() - started,
        totalMs: performance.now() - started,
        outputSerializedBytes: new TextEncoder().encode(
          JSON.stringify(computed),
        ).byteLength,
      },
    };
  } catch (error: unknown) {
    return {
      status: 'failure',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export const FOCUS_SCHEMATIC_INCREMENTAL_LOCAL_REPAIR_ROUND_LIMIT =
  LOCAL_REPAIR_ROUND_LIMIT;
