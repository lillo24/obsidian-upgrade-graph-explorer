import {
  evaluateFocusSchematicLayout,
  type FocusSchematicLayoutCandidate,
  type FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';

import {
  FOCUS_SCHEMATIC_CENTER_STACK_ORDERING_SWEEP_COUNT,
  measureFocusSchematicEndpointOrder,
  measureFocusSchematicVisualSiblingOrder,
  minimizeFocusSchematicInternalBranchCrossings,
} from './crossing-minimization';
import {
  refineFocusSchematicInternalLayoutOrder,
  type FocusSchematicInternalLayoutRunStats,
} from './internal-layout-variants';
import {
  FOCUS_SCHEMATIC_DIRECTIONAL_FOLDER_BAND_PADDING_Y,
  FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
} from './settings';
import type {
  FocusSchematicEndpointLayoutQuality,
  FocusSchematicEndpointOrderPolicy,
  FocusSchematicEndpointPlan,
  FocusSchematicEndpointValidationResult,
  FocusSchematicFolderBand,
  FocusSchematicFolderBandException,
  FocusSchematicFolderBandExceptionReason,
  FocusSchematicFolderBandPlan,
  FocusSchematicFolderBandCandidateMetrics,
  FocusSchematicFolderBandQuality,
  FocusSchematicFolderModulePlacement,
  FocusSchematicInternalLanePlan,
  FocusSchematicInternalLayoutVariant,
  FocusSchematicLayoutInput,
  FocusSchematicLayoutPlan,
} from './types';
import { FOCUS_SCHEMATIC_FOLDER_BAND_PLAN_SCHEMA_VERSION } from './types';

/** Two forward and two backward passes bound both ordering refinements. */
export const FOCUS_SCHEMATIC_FOLDER_ORDERING_SWEEP_COUNT = 4;
/** Folder placement and legal branch order alternate exactly twice per candidate. */
export const FOCUS_SCHEMATIC_FOLDER_JOINT_ROUND_COUNT = 2 as const;
/** Exhaustive side assignment is intentionally limited to small review-sized sets. */
export const FOCUS_SCHEMATIC_FOLDER_SIDE_ASSIGNMENT_CAP = 6;
/** Large ranks use one deterministic direct folder-order proposal per round. */
export const FOCUS_SCHEMATIC_FOLDER_DIRECT_RANK_THRESHOLD = 64;

const EPSILON = 1e-6;
const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const centerY = (rectangle: FocusSchematicRectangle): number =>
  rectangle.y + rectangle.height / 2;

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1]! + ordered[middle]!) / 2
    : ordered[middle]!;
}

function percentile(
  values: readonly number[],
  quantile: number,
): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(quantile * ordered.length) - 1] ?? null;
}

function rectangleDistanceToBand(
  rectangle: FocusSchematicRectangle,
  band: FocusSchematicFolderBand,
): number {
  const top = rectangle.y;
  const bottom = rectangle.y + rectangle.height;
  if (top < band.topY - EPSILON) return band.topY - top;
  if (bottom > band.bottomY + EPSILON) return bottom - band.bottomY;
  return 0;
}

function insideBand(
  rectangle: FocusSchematicRectangle,
  band: FocusSchematicFolderBand,
): boolean {
  return rectangleDistanceToBand(rectangle, band) <= EPSILON;
}

interface FolderDraft {
  readonly folderKey: string;
  readonly root: boolean;
  readonly moduleIds: readonly string[];
  readonly requiredHeight: number;
  readonly bandHeight: number;
  readonly baselineMedianCenterY: number;
}

interface FolderInventory {
  readonly rootFolderKey: string;
  readonly drafts: readonly FolderDraft[];
  readonly visibleModuleIds: readonly string[];
  readonly filteredCount: number;
  readonly rootFolderVisibleModuleCount: number;
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

function rankOrders(
  modulePlan: FocusSchematicLayoutPlan,
  candidate: FocusSchematicLayoutCandidate,
): ReadonlyMap<number, readonly string[]> {
  const rankById = rankByModuleId(modulePlan);
  const rectangleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const result = new Map<number, string[]>();
  for (const module of candidate.modules) {
    const rank = rankById.get(module.moduleId);
    if (rank === undefined) continue;
    const ids = result.get(rank) ?? [];
    ids.push(module.moduleId);
    result.set(rank, ids);
  }
  for (const ids of result.values())
    ids.sort((left, right) => {
      const leftRectangle = rectangleById.get(left)!;
      const rightRectangle = rectangleById.get(right)!;
      return (
        centerY(leftRectangle) - centerY(rightRectangle) ||
        compareText(left, right)
      );
    });
  return result;
}

function deriveInventory(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  baseline: FocusSchematicLayoutCandidate,
): FolderInventory {
  const rootModule = input.model.modules.find(
    ({ id }) => id === input.model.rootModuleId,
  );
  if (rootModule === undefined)
    throw new Error('Directional Folder Bands cannot find the root module.');
  const baselineById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  const rankById = rankByModuleId(modulePlan);
  const visibleModules = input.model.modules.filter(
    ({ presentation }) => presentation !== 'filtered',
  );
  const grouped = new Map<string, string[]>();
  for (const module of visibleModules) {
    const ids = grouped.get(module.folderKey) ?? [];
    ids.push(module.id);
    grouped.set(module.folderKey, ids);
  }
  const baselineOrders = rankOrders(modulePlan, baseline);
  const drafts = [...grouped].map(([folderKey, ids]): FolderDraft => {
    const modules = ids.map((moduleId) => {
      const rectangle = baselineById.get(moduleId);
      const rank = rankById.get(moduleId);
      if (rectangle === undefined || rank === undefined)
        throw new Error(
          `Directional folder module "${moduleId}" is missing geometry or rank.`,
        );
      return { moduleId, rectangle, rank };
    });
    let requiredHeight = 0;
    for (const [, rankIds] of baselineOrders) {
      const ranked = rankIds
        .filter((moduleId) => ids.includes(moduleId))
        .map((moduleId) => baselineById.get(moduleId)!);
      if (ranked.length === 0) continue;
      let height =
        ranked.reduce((sum, rectangle) => sum + rectangle.height, 0) +
        input.settings.macroNodeSeparation * Math.max(0, ranked.length - 1);
      if (
        ranked.some(
          (rectangle) => rectangle.moduleId === input.model.rootModuleId,
        )
      ) {
        const folderIds = rankIds.filter((moduleId) => ids.includes(moduleId));
        const folderRootIndex = folderIds.indexOf(input.model.rootModuleId);
        const rootRectangle = baselineById.get(input.model.rootModuleId)!;
        const before = folderIds
          .slice(0, folderRootIndex)
          .reduce(
            (sum, moduleId) =>
              sum +
              baselineById.get(moduleId)!.height +
              input.settings.macroNodeSeparation,
            rootRectangle.height / 2,
          );
        const after = folderIds
          .slice(folderRootIndex + 1)
          .reduce(
            (sum, moduleId) =>
              sum +
              baselineById.get(moduleId)!.height +
              input.settings.macroNodeSeparation,
            rootRectangle.height / 2,
          );
        height = 2 * Math.max(before, after);
      }
      requiredHeight = Math.max(requiredHeight, height);
    }
    return {
      folderKey,
      root: folderKey === rootModule.folderKey,
      moduleIds: modules.map(({ moduleId }) => moduleId).sort(compareText),
      requiredHeight,
      bandHeight:
        requiredHeight + FOCUS_SCHEMATIC_DIRECTIONAL_FOLDER_BAND_PADDING_Y * 2,
      baselineMedianCenterY: median(
        modules.map(({ rectangle }) => centerY(rectangle)),
      ),
    };
  });
  return {
    rootFolderKey: rootModule.folderKey,
    drafts,
    visibleModuleIds: visibleModules.map(({ id }) => id).sort(compareText),
    filteredCount: input.model.modules.length - visibleModules.length,
    rootFolderVisibleModuleCount:
      grouped.get(rootModule.folderKey)?.length ?? 0,
  };
}

function initialFolderOrder(inventory: FolderInventory): readonly string[] {
  return [...inventory.drafts]
    .sort(
      (left, right) =>
        left.baselineMedianCenterY - right.baselineMedianCenterY ||
        compareText(left.folderKey, right.folderKey),
    )
    .map(({ folderKey }) => folderKey);
}

function packBands(
  input: FocusSchematicLayoutInput,
  inventory: FolderInventory,
  folderOrder: readonly string[],
): readonly FocusSchematicFolderBand[] {
  const draftByKey = new Map(
    inventory.drafts.map((draft) => [draft.folderKey, draft]),
  );
  const rootIndex = folderOrder.indexOf(inventory.rootFolderKey);
  if (rootIndex < 0)
    throw new Error('Directional folder order omitted the root folder.');
  const root = draftByKey.get(inventory.rootFolderKey)!;
  const centerByKey = new Map<string, number>([[root.folderKey, 0]]);
  let cursor = -root.bandHeight / 2 - input.settings.macroNodeSeparation;
  for (let index = rootIndex - 1; index >= 0; index -= 1) {
    const draft = draftByKey.get(folderOrder[index]!)!;
    const bandCenterY = cursor - draft.bandHeight / 2;
    centerByKey.set(draft.folderKey, bandCenterY);
    cursor -= draft.bandHeight + input.settings.macroNodeSeparation;
  }
  cursor = root.bandHeight / 2 + input.settings.macroNodeSeparation;
  for (let index = rootIndex + 1; index < folderOrder.length; index += 1) {
    const draft = draftByKey.get(folderOrder[index]!)!;
    const bandCenterY = cursor + draft.bandHeight / 2;
    centerByKey.set(draft.folderKey, bandCenterY);
    cursor += draft.bandHeight + input.settings.macroNodeSeparation;
  }
  return folderOrder.map((folderKey, order) => {
    const draft = draftByKey.get(folderKey);
    if (draft === undefined)
      throw new Error(`Unknown exact folder "${folderKey}" in folder order.`);
    const bandCenterY = centerByKey.get(folderKey)!;
    return {
      folderKey,
      root: draft.root,
      order,
      topY: bandCenterY - draft.bandHeight / 2,
      bottomY: bandCenterY + draft.bandHeight / 2,
      centerY: bandCenterY,
      height: draft.bandHeight,
      moduleIds: draft.moduleIds,
      requiredHeight: draft.requiredHeight,
      baselineMedianCenterY: draft.baselineMedianCenterY,
      singleton: draft.moduleIds.length === 1,
    };
  });
}

function measureRootBalance(
  bands: readonly FocusSchematicFolderBand[],
  rootFolderKey: string,
) {
  const root = bands.find(({ folderKey }) => folderKey === rootFolderKey);
  if (root === undefined)
    throw new Error(
      'Directional folder bands cannot measure a missing root band.',
    );
  const above = bands.filter(({ bottomY }) => bottomY <= root.topY + EPSILON);
  const below = bands.filter(({ topY }) => topY >= root.bottomY - EPSILON);
  const abovePackedExtent =
    above.length === 0
      ? 0
      : root.topY - Math.min(...above.map(({ topY }) => topY));
  const belowPackedExtent =
    below.length === 0
      ? 0
      : Math.max(...below.map(({ bottomY }) => bottomY)) - root.bottomY;
  return {
    aboveFolderKeys: above.map(({ folderKey }) => folderKey),
    belowFolderKeys: below.map(({ folderKey }) => folderKey),
    abovePackedExtent,
    belowPackedExtent,
    packedExtentImbalance: Math.abs(abovePackedExtent - belowPackedExtent),
  };
}

function preferredCenters(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  candidate: FocusSchematicLayoutCandidate,
  bands: readonly FocusSchematicFolderBand[],
): ReadonlyMap<string, number> {
  const rankById = rankByModuleId(modulePlan);
  const rectangleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const orderPosition = new Map<string, number>();
  for (const ids of rankOrders(modulePlan, candidate).values())
    ids.forEach((moduleId, index) => orderPosition.set(moduleId, index));
  const result = new Map<string, number>();
  for (const band of bands) {
    const idsByRank = new Map<number, string[]>();
    for (const moduleId of band.moduleIds) {
      const rank = rankById.get(moduleId);
      if (rank === undefined) continue;
      const ids = idsByRank.get(rank) ?? [];
      ids.push(moduleId);
      idsByRank.set(rank, ids);
    }
    for (const ids of idsByRank.values()) {
      ids.sort(
        (left, right) =>
          (orderPosition.get(left) ?? 0) - (orderPosition.get(right) ?? 0) ||
          compareText(left, right),
      );
      const rootIndex = ids.indexOf(input.model.rootModuleId);
      if (rootIndex >= 0) {
        result.set(input.model.rootModuleId, 0);
        let cursor = 0;
        let nextHeight = rectangleById.get(input.model.rootModuleId)!.height;
        for (let index = rootIndex - 1; index >= 0; index -= 1) {
          const moduleId = ids[index]!;
          const rectangle = rectangleById.get(moduleId)!;
          cursor -=
            nextHeight / 2 +
            input.settings.macroNodeSeparation +
            rectangle.height / 2;
          result.set(moduleId, cursor);
          nextHeight = rectangle.height;
        }
        cursor = 0;
        nextHeight = rectangleById.get(input.model.rootModuleId)!.height;
        for (let index = rootIndex + 1; index < ids.length; index += 1) {
          const moduleId = ids[index]!;
          const rectangle = rectangleById.get(moduleId)!;
          cursor +=
            nextHeight / 2 +
            input.settings.macroNodeSeparation +
            rectangle.height / 2;
          result.set(moduleId, cursor);
          nextHeight = rectangle.height;
        }
        continue;
      }
      const stackHeight =
        ids.reduce(
          (sum, moduleId) => sum + rectangleById.get(moduleId)!.height,
          0,
        ) +
        input.settings.macroNodeSeparation * Math.max(0, ids.length - 1);
      let cursor = band.centerY - stackHeight / 2;
      for (const moduleId of ids) {
        const rectangle = rectangleById.get(moduleId)!;
        result.set(moduleId, cursor + rectangle.height / 2);
        cursor += rectangle.height + input.settings.macroNodeSeparation;
      }
    }
  }
  return result;
}

function packRankCenters(
  input: FocusSchematicLayoutInput,
  orderedIds: readonly string[],
  candidate: FocusSchematicLayoutCandidate,
  desiredById: ReadonlyMap<string, number>,
): ReadonlyMap<string, number> {
  const rectangleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const rootIndex = orderedIds.indexOf(input.model.rootModuleId);
  const result = new Map<string, number>();
  if (rootIndex >= 0) {
    const root = rectangleById.get(input.model.rootModuleId)!;
    result.set(input.model.rootModuleId, 0);
    let nextCenter = 0;
    let nextHeight = root.height;
    for (let index = rootIndex - 1; index >= 0; index -= 1) {
      const id = orderedIds[index]!;
      const rectangle = rectangleById.get(id)!;
      const maximum =
        nextCenter -
        nextHeight / 2 -
        input.settings.macroNodeSeparation -
        rectangle.height / 2;
      const value = Math.min(
        desiredById.get(id) ?? centerY(rectangle),
        maximum,
      );
      result.set(id, value);
      nextCenter = value;
      nextHeight = rectangle.height;
    }
    nextCenter = 0;
    nextHeight = root.height;
    for (let index = rootIndex + 1; index < orderedIds.length; index += 1) {
      const id = orderedIds[index]!;
      const rectangle = rectangleById.get(id)!;
      const minimum =
        nextCenter +
        nextHeight / 2 +
        input.settings.macroNodeSeparation +
        rectangle.height / 2;
      const value = Math.max(
        desiredById.get(id) ?? centerY(rectangle),
        minimum,
      );
      result.set(id, value);
      nextCenter = value;
      nextHeight = rectangle.height;
    }
    return result;
  }
  let cursor = Number.NEGATIVE_INFINITY;
  const packed = orderedIds.map((id) => {
    const rectangle = rectangleById.get(id)!;
    const desired = desiredById.get(id) ?? centerY(rectangle);
    const top =
      cursor === Number.NEGATIVE_INFINITY
        ? desired - rectangle.height / 2
        : Math.max(
            desired - rectangle.height / 2,
            cursor + input.settings.macroNodeSeparation,
          );
    cursor = top + rectangle.height;
    return { id, desired, center: top + rectangle.height / 2 };
  });
  const translation = median(
    packed.map(({ center, desired }) => center - desired),
  );
  for (const item of packed) result.set(item.id, item.center - translation);
  return result;
}

function moveRank(
  candidate: FocusSchematicLayoutCandidate,
  centers: ReadonlyMap<string, number>,
): FocusSchematicLayoutCandidate {
  const deltaById = new Map(
    candidate.modules.flatMap((module) => {
      const target = centers.get(module.moduleId);
      return target === undefined
        ? []
        : [[module.moduleId, target - centerY(module)] as const];
    }),
  );
  return {
    ...candidate,
    modules: candidate.modules.map((module) => ({
      ...module,
      y: module.y + (deltaById.get(module.moduleId) ?? 0),
    })),
    nodes: candidate.nodes.map((node) => ({
      ...node,
      y: node.y + (deltaById.get(node.moduleId) ?? 0),
    })),
  };
}

function desiredWithFilteredBaseline(
  input: FocusSchematicLayoutInput,
  baseline: FocusSchematicLayoutCandidate,
  preferred: ReadonlyMap<string, number>,
): ReadonlyMap<string, number> {
  const result = new Map(preferred);
  const baselineById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  for (const module of input.model.modules)
    if (module.presentation === 'filtered') {
      const rectangle = baselineById.get(module.id);
      if (rectangle !== undefined) result.set(module.id, centerY(rectangle));
    }
  return result;
}

function packAllRanks(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  candidate: FocusSchematicLayoutCandidate,
  desiredById: ReadonlyMap<string, number>,
): FocusSchematicLayoutCandidate {
  let result = candidate;
  for (const [, ids] of [...rankOrders(modulePlan, candidate)].sort(
    ([left], [right]) => left - right,
  ))
    result = moveRank(result, packRankCenters(input, ids, result, desiredById));
  return result;
}

function hardOrder(
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
) {
  return measureFocusSchematicEndpointOrder(
    modulePlan,
    endpointPlan,
    candidate,
  );
}

function primaryReferenceSpans(
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
): readonly number[] {
  const moduleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const nodeById = new Map(
    candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const endpointCenterY = (
    endpoint: FocusSchematicEndpointPlan['connections'][number]['source'],
  ) => {
    const rectangle =
      endpoint.kind === 'visible-entity'
        ? nodeById.get(endpoint.projectionNodeId)
        : moduleById.get(endpoint.moduleId);
    return rectangle === undefined ? undefined : centerY(rectangle);
  };
  return endpointPlan.connections.flatMap((connection) => {
    if (
      connection.kind !== 'precise' ||
      connection.role === 'secondary' ||
      connection.sourceModuleId === connection.targetModuleId
    )
      return [];
    const sourceY = endpointCenterY(connection.source);
    const targetY = endpointCenterY(connection.target);
    return sourceY === undefined || targetY === undefined
      ? []
      : [Math.abs(sourceY - targetY)];
  });
}

function doesNotRegress(
  baseline: ReturnType<typeof hardOrder>,
  candidate: ReturnType<typeof hardOrder>,
): boolean {
  return (
    candidate.exactEndpointCrossingCount <=
      baseline.exactEndpointCrossingCount &&
    candidate.adjacentRankOrderInversionCount <=
      baseline.adjacentRankOrderInversionCount
  );
}

interface RankScore {
  readonly folderOrderInversions: number;
  readonly fragments: number;
  readonly preferredDistance: number;
  readonly displacement: number;
  readonly stableOrder: string;
}

function rankScore(
  input: FocusSchematicLayoutInput,
  ids: readonly string[],
  candidate: FocusSchematicLayoutCandidate,
  baseline: FocusSchematicLayoutCandidate,
  preferredById: ReadonlyMap<string, number>,
  folderOrder: readonly string[],
): RankScore {
  const modelById = new Map(
    input.model.modules.map((module) => [module.id, module]),
  );
  const folderPosition = new Map(
    folderOrder.map((folderKey, index) => [folderKey, index]),
  );
  const visible = ids.filter(
    (id) => modelById.get(id)?.presentation !== 'filtered',
  );
  let folderOrderInversions = 0;
  for (let left = 0; left < visible.length; left += 1)
    for (let right = left + 1; right < visible.length; right += 1) {
      const leftFolder = modelById.get(visible[left]!)!.folderKey;
      const rightFolder = modelById.get(visible[right]!)!.folderKey;
      if (
        (folderPosition.get(leftFolder) ?? 0) >
        (folderPosition.get(rightFolder) ?? 0)
      )
        folderOrderInversions += 1;
    }
  let fragments = 0;
  const runs = new Map<string, number>();
  let previous: string | null = null;
  for (const id of visible) {
    const folderKey = modelById.get(id)!.folderKey;
    if (folderKey !== previous)
      runs.set(folderKey, (runs.get(folderKey) ?? 0) + 1);
    previous = folderKey;
  }
  for (const count of runs.values()) fragments += Math.max(0, count - 1);
  const candidateById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const baselineById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  let preferredDistance = 0;
  let displacement = 0;
  for (const id of visible) {
    const rectangle = candidateById.get(id)!;
    preferredDistance += Math.abs(
      centerY(rectangle) - (preferredById.get(id) ?? centerY(rectangle)),
    );
    displacement += Math.abs(
      centerY(rectangle) - centerY(baselineById.get(id)!),
    );
  }
  return {
    folderOrderInversions,
    fragments,
    preferredDistance,
    displacement,
    stableOrder: ids.join('|'),
  };
}

function improvesRank(left: RankScore, right: RankScore): boolean {
  for (const key of [
    'folderOrderInversions',
    'fragments',
    'preferredDistance',
    'displacement',
  ] as const) {
    const delta = left[key] - right[key];
    if (Math.abs(delta) > EPSILON) return delta < 0;
  }
  return compareText(left.stableOrder, right.stableOrder) < 0;
}

interface FolderBarrierProof {
  readonly reason: 'crossing-guard' | 'rank-order-inversion-guard';
  readonly evidence: FocusSchematicFolderBandException['evidence'];
}

function hardGuardProof(
  baseline: ReturnType<typeof hardOrder>,
  candidate: ReturnType<typeof hardOrder>,
): FolderBarrierProof | null {
  if (
    candidate.exactEndpointCrossingCount > baseline.exactEndpointCrossingCount
  )
    return {
      reason: 'crossing-guard',
      evidence: {
        baselineCrossings: baseline.exactEndpointCrossingCount,
        candidateCrossings: candidate.exactEndpointCrossingCount,
        baselineInversions: baseline.adjacentRankOrderInversionCount,
        candidateInversions: candidate.adjacentRankOrderInversionCount,
      },
    };
  if (
    candidate.adjacentRankOrderInversionCount >
    baseline.adjacentRankOrderInversionCount
  )
    return {
      reason: 'rank-order-inversion-guard',
      evidence: {
        baselineCrossings: baseline.exactEndpointCrossingCount,
        candidateCrossings: candidate.exactEndpointCrossingCount,
        baselineInversions: baseline.adjacentRankOrderInversionCount,
        candidateInversions: candidate.adjacentRankOrderInversionCount,
      },
    };
  return null;
}

function recordMovedBarriers(
  target: Map<string, FolderBarrierProof>,
  input: FocusSchematicLayoutInput,
  before: FocusSchematicLayoutCandidate,
  proposal: FocusSchematicLayoutCandidate,
  proof: FolderBarrierProof,
) {
  const beforeById = new Map(
    before.modules.map((module) => [module.moduleId, module]),
  );
  for (const module of input.model.modules) {
    if (module.presentation === 'filtered') continue;
    const oldRectangle = beforeById.get(module.id);
    const newRectangle = proposal.modules.find(
      ({ moduleId }) => moduleId === module.id,
    );
    if (
      oldRectangle !== undefined &&
      newRectangle !== undefined &&
      Math.abs(centerY(oldRectangle) - centerY(newRectangle)) > EPSILON &&
      !target.has(module.id)
    )
      target.set(module.id, proof);
  }
}

function safelyOrderRanks(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  baseline: FocusSchematicLayoutCandidate,
  initial: FocusSchematicLayoutCandidate,
  preferredById: ReadonlyMap<string, number>,
  folderOrder: readonly string[],
  endpointOrderPolicy: FocusSchematicEndpointOrderPolicy,
  phases: FolderPhaseAccumulator,
): {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly barriers: ReadonlyMap<string, FolderBarrierProof>;
  readonly rankSweeps: number;
} {
  const modelById = new Map(
    input.model.modules.map((module) => [module.id, module]),
  );
  const folderPosition = new Map(
    folderOrder.map((folderKey, index) => [folderKey, index]),
  );
  let candidate = initial;
  phases.crossingMetricEvaluations += 1;
  let candidateHard = hardOrder(modulePlan, endpointPlan, candidate);
  const barriers = new Map<string, FolderBarrierProof>();
  if (
    candidate.modules.length > FOCUS_SCHEMATIC_FOLDER_DIRECT_RANK_THRESHOLD &&
    input.model.modules.every(({ presentation }) => presentation !== 'filtered')
  ) {
    for (const [, ids] of [...rankOrders(modulePlan, candidate)].sort(
      ([left], [right]) => left - right,
    )) {
      const proposedIds = [...ids].sort((leftId, rightId) => {
        const leftFolder = modelById.get(leftId)?.folderKey ?? '';
        const rightFolder = modelById.get(rightId)?.folderKey ?? '';
        return (
          (folderPosition.get(leftFolder) ?? 0) -
            (folderPosition.get(rightFolder) ?? 0) ||
          compareText(leftId, rightId)
        );
      });
      let proposal = moveRank(
        candidate,
        packRankCenters(input, proposedIds, candidate, preferredById),
      );
      if (endpointOrderPolicy === 'crossing-optimized')
        proposal = minimizeFocusSchematicInternalBranchCrossings(
          input,
          modulePlan,
          endpointPlan,
          lanePlan,
          proposal,
          {
            onOrderingMetricEvaluation: () => {
              phases.crossingMetricEvaluations += 1;
            },
          },
        );
      phases.crossingMetricEvaluations += 1;
      const proposalHard = hardOrder(modulePlan, endpointPlan, proposal);
      if (!doesNotRegress(candidateHard, proposalHard)) {
        const proof = hardGuardProof(candidateHard, proposalHard);
        if (proof !== null)
          recordMovedBarriers(barriers, input, candidate, proposal, proof);
        continue;
      }
      if (
        improvesRank(
          rankScore(
            input,
            proposedIds,
            proposal,
            baseline,
            preferredById,
            folderOrder,
          ),
          rankScore(
            input,
            ids,
            candidate,
            baseline,
            preferredById,
            folderOrder,
          ),
        )
      ) {
        candidate = proposal;
        candidateHard = proposalHard;
      }
    }
    return { candidate, barriers, rankSweeps: 1 };
  }
  for (
    let sweep = 0;
    sweep < FOCUS_SCHEMATIC_FOLDER_ORDERING_SWEEP_COUNT;
    sweep += 1
  ) {
    const forward = sweep % 2 === 0;
    for (const [, initialIds] of [...rankOrders(modulePlan, candidate)].sort(
      ([left], [right]) => left - right,
    )) {
      let ids = initialIds;
      const indexes = Array.from(
        { length: Math.max(0, ids.length - 1) },
        (_, index) => index,
      );
      if (!forward) indexes.reverse();
      for (const index of indexes) {
        const leftId = ids[index];
        const rightId = ids[index + 1];
        if (leftId === undefined || rightId === undefined) continue;
        const left = modelById.get(leftId);
        const right = modelById.get(rightId);
        if (
          left === undefined ||
          right === undefined ||
          left.presentation === 'filtered' ||
          right.presentation === 'filtered' ||
          leftId === input.model.rootModuleId ||
          rightId === input.model.rootModuleId ||
          left.folderKey === right.folderKey ||
          (folderPosition.get(left.folderKey) ?? 0) <=
            (folderPosition.get(right.folderKey) ?? 0)
        )
          continue;
        const swapped = [...ids];
        swapped[index] = rightId;
        swapped[index + 1] = leftId;
        let proposal = moveRank(
          candidate,
          packRankCenters(input, swapped, candidate, preferredById),
        );
        if (endpointOrderPolicy === 'crossing-optimized')
          proposal = minimizeFocusSchematicInternalBranchCrossings(
            input,
            modulePlan,
            endpointPlan,
            lanePlan,
            proposal,
            {
              onOrderingMetricEvaluation: () => {
                phases.crossingMetricEvaluations += 1;
              },
            },
          );
        phases.crossingMetricEvaluations += 1;
        const proposalHard = hardOrder(modulePlan, endpointPlan, proposal);
        if (!doesNotRegress(candidateHard, proposalHard)) {
          const proof: FolderBarrierProof = {
            reason:
              proposalHard.exactEndpointCrossingCount >
              candidateHard.exactEndpointCrossingCount
                ? 'crossing-guard'
                : 'rank-order-inversion-guard',
            evidence: {
              baselineCrossings: candidateHard.exactEndpointCrossingCount,
              candidateCrossings: proposalHard.exactEndpointCrossingCount,
              baselineInversions: candidateHard.adjacentRankOrderInversionCount,
              candidateInversions: proposalHard.adjacentRankOrderInversionCount,
            },
          };
          if (!barriers.has(leftId)) barriers.set(leftId, proof);
          if (!barriers.has(rightId)) barriers.set(rightId, proof);
          continue;
        }
        if (
          improvesRank(
            rankScore(
              input,
              swapped,
              proposal,
              baseline,
              preferredById,
              folderOrder,
            ),
            rankScore(
              input,
              ids,
              candidate,
              baseline,
              preferredById,
              folderOrder,
            ),
          )
        ) {
          candidate = proposal;
          candidateHard = proposalHard;
          ids = swapped;
        }
      }
    }
  }
  return {
    candidate,
    barriers,
    rankSweeps: FOCUS_SCHEMATIC_FOLDER_ORDERING_SWEEP_COUNT,
  };
}

function exceptionReason(
  modulePlan: FocusSchematicLayoutPlan,
  moduleId: string,
  barriers: ReadonlyMap<string, FolderBarrierProof>,
  finalHard: ReturnType<typeof hardOrder>,
): {
  readonly reason: FocusSchematicFolderBandExceptionReason;
  readonly evidence: FocusSchematicFolderBandException['evidence'];
} {
  const unchanged = {
    baselineCrossings: finalHard.exactEndpointCrossingCount,
    candidateCrossings: finalHard.exactEndpointCrossingCount,
    baselineInversions: finalHard.adjacentRankOrderInversionCount,
    candidateInversions: finalHard.adjacentRankOrderInversionCount,
  };
  const barrier = barriers.get(moduleId);
  if (barrier !== undefined) return barrier;
  if (rankByModuleId(modulePlan).get(moduleId) === 0)
    return { reason: 'root-anchor', evidence: unchanged };
  return { reason: 'unsatisfiable-order-cycle', evidence: unchanged };
}

function createDisabledPlan(
  inventory: FolderInventory,
): FocusSchematicFolderBandPlan {
  return {
    schemaVersion: FOCUS_SCHEMATIC_FOLDER_BAND_PLAN_SCHEMA_VERSION,
    enabled: false,
    rootFolderKey: inventory.rootFolderKey,
    folderOrder: [],
    bands: [],
    modulePlacements: [],
    exceptions: [],
    rootBalance: null,
    optimization: null,
    summary: {
      visibleFolderCount: inventory.drafts.length,
      visibleModuleCount: inventory.visibleModuleIds.length,
      satisfiedModuleCount: 0,
      exceptionModuleCount: 0,
      satisfactionRatio: null,
      rootFolderVisibleModuleCount: inventory.rootFolderVisibleModuleCount,
      filteredExcludedModuleCount: inventory.filteredCount,
    },
  };
}

function createEnabledPlan(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  baseline: FocusSchematicLayoutCandidate,
  candidate: FocusSchematicLayoutCandidate,
  inventory: FolderInventory,
  bands: readonly FocusSchematicFolderBand[],
  folderOrder: readonly string[],
  preferredById: ReadonlyMap<string, number>,
  barriers: ReadonlyMap<string, FolderBarrierProof>,
): FocusSchematicFolderBandPlan {
  const rankById = rankByModuleId(modulePlan);
  const baselineById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  const candidateById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const bandByFolder = new Map(bands.map((band) => [band.folderKey, band]));
  const finalHard = hardOrder(modulePlan, endpointPlan, candidate);
  const exceptions: FocusSchematicFolderBandException[] = [];
  const modulePlacements = inventory.visibleModuleIds.map(
    (moduleId): FocusSchematicFolderModulePlacement => {
      const module = input.model.modules.find(({ id }) => id === moduleId)!;
      const before = baselineById.get(moduleId)!;
      const after = candidateById.get(moduleId)!;
      const band = bandByFolder.get(module.folderKey)!;
      const distanceToOwnBand = rectangleDistanceToBand(after, band);
      const satisfied = insideBand(after, band);
      const exceptionId = satisfied
        ? null
        : `directional-folder-band:${moduleId}`;
      if (exceptionId !== null) {
        const reason = exceptionReason(
          modulePlan,
          moduleId,
          barriers,
          finalHard,
        );
        exceptions.push({
          id: exceptionId,
          moduleId,
          folderKey: module.folderKey,
          reason: reason.reason,
          distanceToOwnBand,
          evidence: reason.evidence,
        });
      }
      return {
        moduleId,
        folderKey: module.folderKey,
        signedRank: rankById.get(moduleId) as -3 | -2 | -1 | 0 | 1 | 2 | 3,
        baselineCenterY: centerY(before),
        preferredBandCenterY: preferredById.get(moduleId) ?? band.centerY,
        finalCenterY: centerY(after),
        displacementY: centerY(after) - centerY(before),
        distanceToOwnBand,
        status: satisfied ? 'inside-own-band' : 'exception-outside-own-band',
        exceptionId,
      };
    },
  );
  const satisfiedModuleCount = modulePlacements.filter(
    ({ status }) => status === 'inside-own-band',
  ).length;
  const rootBalance = measureRootBalance(bands, inventory.rootFolderKey);
  return {
    schemaVersion: FOCUS_SCHEMATIC_FOLDER_BAND_PLAN_SCHEMA_VERSION,
    enabled: true,
    rootFolderKey: inventory.rootFolderKey,
    folderOrder,
    bands,
    modulePlacements,
    exceptions: exceptions.sort((left, right) =>
      compareText(left.id, right.id),
    ),
    rootBalance: {
      ...rootBalance,
      bestUnconstrainedImbalance: rootBalance.packedExtentImbalance,
      topologyOverride: null,
    },
    optimization: null,
    summary: {
      visibleFolderCount: inventory.drafts.length,
      visibleModuleCount: inventory.visibleModuleIds.length,
      satisfiedModuleCount,
      exceptionModuleCount: exceptions.length,
      satisfactionRatio:
        inventory.visibleModuleIds.length === 0
          ? null
          : satisfiedModuleCount / inventory.visibleModuleIds.length,
      rootFolderVisibleModuleCount: inventory.rootFolderVisibleModuleCount,
      filteredExcludedModuleCount: inventory.filteredCount,
    },
  };
}

interface OrderLayout {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly bands: readonly FocusSchematicFolderBand[];
  readonly preferredById: ReadonlyMap<string, number>;
  readonly plan: FocusSchematicFolderBandPlan;
  readonly metrics: FocusSchematicFolderBandCandidateMetrics;
  readonly hardGuardProof: FolderBarrierProof | null;
}

interface FolderPhaseAccumulator {
  folderBandPackingMs: number;
  folderRankOrderingMs: number;
  folderModuleAssignmentMs: number;
  folderExceptionAnalysisMs: number;
  folderPartitionsEvaluated: number;
  folderOrderCandidatesEvaluated: number;
  candidateLocalHeadingReorderSweeps: number;
  rankOrderSweeps: number;
  jointRounds: number;
  crossingMetricEvaluations: number;
  readonly cache: Map<string, OrderLayout>;
}

function candidateMetrics(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  candidate: FocusSchematicLayoutCandidate,
  plan: FocusSchematicFolderBandPlan,
  phases: FolderPhaseAccumulator,
): FocusSchematicFolderBandCandidateMetrics {
  phases.crossingMetricEvaluations += 1;
  const hard = hardOrder(modulePlan, endpointPlan, candidate);
  const spans = primaryReferenceSpans(endpointPlan, candidate);
  const rootBalance = plan.rootBalance;
  const nonRootCount = Math.max(0, plan.bands.length - 1);
  const oneSidedRootPenalty =
    nonRootCount >= 2 &&
    (rootBalance?.aboveFolderKeys.length === 0 ||
      rootBalance?.belowFolderKeys.length === 0)
      ? 1
      : 0;
  const siblingOrder = measureFocusSchematicVisualSiblingOrder(
    input,
    lanePlan,
    candidate,
  );
  return {
    exactEndpointCrossingCount: hard.exactEndpointCrossingCount,
    adjacentRankOrderInversionCount: hard.adjacentRankOrderInversionCount,
    folderBandExceptionModuleCount: plan.exceptions.length,
    oneSidedRootPenalty,
    rootBalanceImbalance: rootBalance?.packedExtentImbalance ?? 0,
    totalPrimaryReferenceVerticalSpan: spans.reduce(
      (sum, value) => sum + value,
      0,
    ),
    meanPrimaryReferenceVerticalSpan:
      spans.length === 0
        ? null
        : spans.reduce((sum, value) => sum + value, 0) / spans.length,
    p95PrimaryReferenceVerticalSpan: percentile(spans, 0.95),
    maximumPrimaryReferenceVerticalSpan:
      spans.length === 0 ? null : Math.max(...spans),
    totalExceptionDistanceToOwnBand: plan.exceptions.reduce(
      (sum, exception) => sum + exception.distanceToOwnBand,
      0,
    ),
    totalModuleDisplacementFromPureA1: plan.modulePlacements.reduce(
      (sum, placement) => sum + Math.abs(placement.displacementY),
      0,
    ),
    visualSiblingOrderDeviationFromSource:
      siblingOrder.visualSiblingOrderDeviationFromSource,
  };
}

function layoutForOrder(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  baseline: FocusSchematicLayoutCandidate,
  inventory: FolderInventory,
  folderOrder: readonly string[],
  endpointOrderPolicy: FocusSchematicEndpointOrderPolicy,
  internalLayoutVariant: FocusSchematicInternalLayoutVariant,
  internalLayoutStats: FocusSchematicInternalLayoutRunStats,
  phases: FolderPhaseAccumulator,
): OrderLayout {
  const cacheKey = `${endpointOrderPolicy}:${internalLayoutVariant}:${folderOrder.join('\u0000')}`;
  const cached = phases.cache.get(cacheKey);
  if (cached !== undefined) return cached;
  phases.folderOrderCandidatesEvaluated += 1;
  const bandStarted = Date.now();
  const bands = packBands(input, inventory, folderOrder);
  phases.folderBandPackingMs += Date.now() - bandStarted;
  const initialAssignmentStarted = Date.now();
  let preferredById = preferredCenters(input, modulePlan, baseline, bands);
  let desiredById = desiredWithFilteredBaseline(input, baseline, preferredById);
  phases.folderModuleAssignmentMs += Date.now() - initialAssignmentStarted;
  const rankStarted = Date.now();
  let candidate = packAllRanks(input, modulePlan, baseline, desiredById);
  const barriers = new Map<string, FolderBarrierProof>();
  const baselineHard = hardOrder(modulePlan, endpointPlan, baseline);
  phases.crossingMetricEvaluations += 1;
  for (
    let round = 0;
    round < FOCUS_SCHEMATIC_FOLDER_JOINT_ROUND_COUNT;
    round += 1
  ) {
    phases.jointRounds += 1;
    preferredById = preferredCenters(input, modulePlan, candidate, bands);
    desiredById = desiredWithFilteredBaseline(input, baseline, preferredById);
    const ordered = safelyOrderRanks(
      input,
      modulePlan,
      endpointPlan,
      lanePlan,
      baseline,
      candidate,
      desiredById,
      folderOrder,
      endpointOrderPolicy,
      phases,
    );
    phases.rankOrderSweeps += ordered.rankSweeps;
    candidate = ordered.candidate;
    for (const [moduleId, proof] of ordered.barriers)
      if (!barriers.has(moduleId)) barriers.set(moduleId, proof);
    candidate = packAllRanks(input, modulePlan, candidate, desiredById);
    if (endpointOrderPolicy === 'crossing-optimized') {
      candidate =
        internalLayoutVariant === 'current'
          ? minimizeFocusSchematicInternalBranchCrossings(
              input,
              modulePlan,
              endpointPlan,
              lanePlan,
              candidate,
              {
                onOrderingMetricEvaluation: () => {
                  phases.crossingMetricEvaluations += 1;
                },
              },
            )
          : refineFocusSchematicInternalLayoutOrder(
              input,
              modulePlan,
              endpointPlan,
              candidate,
              internalLayoutVariant,
              endpointOrderPolicy,
              internalLayoutStats,
            );
      phases.candidateLocalHeadingReorderSweeps +=
        FOCUS_SCHEMATIC_CENTER_STACK_ORDERING_SWEEP_COUNT;
    }
  }
  phases.folderRankOrderingMs += Date.now() - rankStarted;
  const finalAssignmentStarted = Date.now();
  preferredById = preferredCenters(input, modulePlan, candidate, bands);
  phases.folderModuleAssignmentMs += Date.now() - finalAssignmentStarted;
  phases.crossingMetricEvaluations += 1;
  const candidateHard = hardOrder(modulePlan, endpointPlan, candidate);
  const candidateHardGuardProof = hardGuardProof(baselineHard, candidateHard);
  if (candidateHardGuardProof !== null) {
    recordMovedBarriers(
      barriers,
      input,
      baseline,
      candidate,
      candidateHardGuardProof,
    );
    candidate = baseline;
    preferredById = preferredCenters(input, modulePlan, candidate, bands);
  }
  const exceptionStarted = Date.now();
  const plan = createEnabledPlan(
    input,
    modulePlan,
    endpointPlan,
    baseline,
    candidate,
    inventory,
    bands,
    folderOrder,
    preferredById,
    barriers,
  );
  phases.folderExceptionAnalysisMs += Date.now() - exceptionStarted;
  const metrics = candidateMetrics(
    input,
    modulePlan,
    endpointPlan,
    lanePlan,
    candidate,
    plan,
    phases,
  );
  const result = {
    candidate,
    bands,
    preferredById,
    plan,
    metrics,
    hardGuardProof: candidateHardGuardProof,
  };
  phases.cache.set(cacheKey, result);
  return result;
}

function scoreValues(layout: OrderLayout): readonly (number | string)[] {
  const metrics = layout.metrics;
  return [
    metrics.exactEndpointCrossingCount,
    metrics.adjacentRankOrderInversionCount,
    metrics.folderBandExceptionModuleCount,
    metrics.oneSidedRootPenalty,
    metrics.rootBalanceImbalance,
    metrics.totalPrimaryReferenceVerticalSpan,
    metrics.p95PrimaryReferenceVerticalSpan ?? 0,
    metrics.totalExceptionDistanceToOwnBand,
    metrics.totalModuleDisplacementFromPureA1,
    metrics.visualSiblingOrderDeviationFromSource,
    layout.plan.folderOrder.join('|'),
  ];
}

function improvesOrder(left: OrderLayout, right: OrderLayout): boolean {
  const leftValues = scoreValues(left);
  const rightValues = scoreValues(right);
  for (let index = 0; index < leftValues.length - 1; index += 1) {
    const delta =
      (leftValues[index] as number) - (rightValues[index] as number);
    if (Math.abs(delta) > EPSILON) return delta < 0;
  }
  return (
    compareText(
      leftValues[leftValues.length - 1] as string,
      rightValues[rightValues.length - 1] as string,
    ) < 0
  );
}

function rejectionReason(selected: OrderLayout, rejected: OrderLayout): string {
  const labels = [
    'more exact endpoint crossings',
    'more adjacent-rank order inversions',
    'more folder-band exceptions',
    'one-sided root partition',
    'worse packed-height root balance',
    'longer total primary endpoint span',
    'longer p95 primary endpoint span',
    'greater exception distance',
    'greater displacement from pure A1',
    'greater visual deviation from source order',
  ];
  const selectedValues = scoreValues(selected);
  const rejectedValues = scoreValues(rejected);
  for (let index = 0; index < labels.length; index += 1)
    if (
      Math.abs(
        (selectedValues[index] as number) - (rejectedValues[index] as number),
      ) > EPSILON
    )
      return labels[index]!;
  return 'stable deterministic folder ID tie-break';
}

function refineFolderOrder(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  baseline: FocusSchematicLayoutCandidate,
  inventory: FolderInventory,
  initialOrder: readonly string[],
  endpointOrderPolicy: FocusSchematicEndpointOrderPolicy,
  internalLayoutVariant: FocusSchematicInternalLayoutVariant,
  internalLayoutStats: FocusSchematicInternalLayoutRunStats,
  phases: FolderPhaseAccumulator,
): OrderLayout {
  let order = initialOrder;
  const initialLayout = layoutForOrder(
    input,
    modulePlan,
    endpointPlan,
    lanePlan,
    baseline,
    inventory,
    order,
    endpointOrderPolicy,
    internalLayoutVariant,
    internalLayoutStats,
    phases,
  );
  let layout = initialLayout;
  for (
    let sweep = 0;
    sweep < FOCUS_SCHEMATIC_FOLDER_ORDERING_SWEEP_COUNT;
    sweep += 1
  ) {
    const indexes = Array.from(
      { length: Math.max(0, order.length - 1) },
      (_, index) => index,
    );
    if (sweep % 2 === 1) indexes.reverse();
    for (const index of indexes) {
      const swapped = [...order];
      [swapped[index], swapped[index + 1]] = [
        swapped[index + 1]!,
        swapped[index]!,
      ];
      const proposal = layoutForOrder(
        input,
        modulePlan,
        endpointPlan,
        lanePlan,
        baseline,
        inventory,
        swapped,
        endpointOrderPolicy,
        internalLayoutVariant,
        internalLayoutStats,
        phases,
      );
      if (improvesOrder(proposal, layout)) {
        order = swapped;
        layout = proposal;
      }
    }
  }
  return layout;
}

function sameFolderOrder(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function refineRootPartition(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  baseline: FocusSchematicLayoutCandidate,
  inventory: FolderInventory,
  refined: OrderLayout,
  endpointOrderPolicy: FocusSchematicEndpointOrderPolicy,
  internalLayoutVariant: FocusSchematicInternalLayoutVariant,
  internalLayoutStats: FocusSchematicInternalLayoutRunStats,
  phases: FolderPhaseAccumulator,
): OrderLayout {
  const nonRootOrder = refined.plan.folderOrder.filter(
    (folderKey) => folderKey !== inventory.rootFolderKey,
  );
  const rawOrders =
    nonRootOrder.length <= FOCUS_SCHEMATIC_FOLDER_SIDE_ASSIGNMENT_CAP
      ? Array.from({ length: 2 ** nonRootOrder.length }, (_, mask) => {
          const above = nonRootOrder.filter(
            (_folderKey, index) => (mask & (1 << index)) !== 0,
          );
          const below = nonRootOrder.filter(
            (_folderKey, index) => (mask & (1 << index)) === 0,
          );
          return [...above, inventory.rootFolderKey, ...below];
        })
      : Array.from({ length: nonRootOrder.length + 1 }, (_, cut) => [
          ...nonRootOrder.slice(0, cut),
          inventory.rootFolderKey,
          ...nonRootOrder.slice(cut),
        ]);
  const orderByKey = new Map(
    [...rawOrders, refined.plan.folderOrder].map((order) => [
      order.join('\u0000'),
      order,
    ]),
  );
  const orders = [...orderByKey.values()];
  phases.folderPartitionsEvaluated += orders.length;
  const layouts = orders.map((order) =>
    sameFolderOrder(order, refined.plan.folderOrder)
      ? refined
      : layoutForOrder(
          input,
          modulePlan,
          endpointPlan,
          lanePlan,
          baseline,
          inventory,
          order,
          endpointOrderPolicy,
          internalLayoutVariant,
          internalLayoutStats,
          phases,
        ),
  );
  const bestUnconstrainedImbalance = Math.min(
    ...layouts.map(({ plan }) => plan.rootBalance?.packedExtentImbalance ?? 0),
  );
  const bestBalancedLayouts = layouts.filter(
    ({ plan }) =>
      Math.abs(
        (plan.rootBalance?.packedExtentImbalance ?? 0) -
          bestUnconstrainedImbalance,
      ) <= EPSILON,
  );
  const bestBalanced = bestBalancedLayouts.reduce((best, candidate) =>
    improvesOrder(candidate, best) ? candidate : best,
  );
  const selected = layouts.reduce((best, candidate) =>
    improvesOrder(candidate, best) ? candidate : best,
  );
  const selectedBalance = measureRootBalance(
    selected.bands,
    inventory.rootFolderKey,
  );
  let topologyOverride = null;
  if (
    selectedBalance.packedExtentImbalance >
    bestUnconstrainedImbalance + EPSILON
  ) {
    const exceptionProof = bestBalanced.plan.exceptions.find(
      (
        exception,
      ): exception is typeof exception & {
        readonly reason: 'crossing-guard' | 'rank-order-inversion-guard';
      } =>
        exception.reason === 'crossing-guard' ||
        exception.reason === 'rank-order-inversion-guard',
    );
    const directProof = hardGuardProof(
      hardOrder(modulePlan, endpointPlan, selected.candidate),
      hardOrder(modulePlan, endpointPlan, bestBalanced.candidate),
    );
    const proof =
      bestBalanced.hardGuardProof ?? exceptionProof ?? directProof ?? null;
    if (proof === null)
      throw new Error(
        'Directional folder bands left root balance unexplained after candidate-local endpoint ordering.',
      );
    topologyOverride = {
      reason: proof.reason,
      attemptedFolderOrder: bestBalanced.plan.folderOrder,
      attemptedPackedExtentImbalance: bestUnconstrainedImbalance,
      evidence: proof.evidence,
    };
  }
  const rejected = layouts
    .filter(
      (layout) =>
        !sameFolderOrder(layout.plan.folderOrder, selected.plan.folderOrder),
    )
    .reduce<OrderLayout | null>(
      (best, candidate) =>
        best === null || improvesOrder(candidate, best) ? candidate : best,
      null,
    );
  const selectedSiblingOrder = measureFocusSchematicVisualSiblingOrder(
    input,
    lanePlan,
    selected.candidate,
  );
  return {
    ...selected,
    plan: {
      ...selected.plan,
      rootBalance: {
        ...selectedBalance,
        bestUnconstrainedImbalance,
        topologyOverride,
      },
      optimization: {
        endpointOrderPolicy,
        internalLayoutVariant,
        jointRoundLimit: FOCUS_SCHEMATIC_FOLDER_JOINT_ROUND_COUNT,
        folderPartitionsEvaluated: phases.folderPartitionsEvaluated,
        folderOrderCandidatesEvaluated: phases.folderOrderCandidatesEvaluated,
        candidateLocalHeadingReorderSweeps:
          phases.candidateLocalHeadingReorderSweeps,
        rankOrderSweeps: phases.rankOrderSweeps,
        jointRounds: phases.jointRounds,
        crossingMetricEvaluations: phases.crossingMetricEvaluations,
        visuallyReorderedBranchCount:
          selectedSiblingOrder.visuallyReorderedBranchCount,
        selectedCandidate: {
          folderOrder: selected.plan.folderOrder,
          metrics: selected.metrics,
          rejectionReason: null,
        },
        nearestRejectedCandidate:
          rejected === null
            ? null
            : {
                folderOrder: rejected.plan.folderOrder,
                metrics: rejected.metrics,
                rejectionReason: rejectionReason(selected, rejected),
              },
      },
    },
  };
}

export interface FocusSchematicFolderBandTimings {
  readonly folderInventoryMs: number;
  readonly folderInitialOrderMs: number;
  readonly folderOrderRefinementMs: number;
  readonly folderRankOrderingMs: number;
  readonly folderBandPackingMs: number;
  readonly folderModuleAssignmentMs: number;
  readonly folderExceptionAnalysisMs: number;
}

export interface FocusSchematicFolderBandApplication {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly plan: FocusSchematicFolderBandPlan;
  readonly timings: FocusSchematicFolderBandTimings;
}

export function applyFocusSchematicFolderBands(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  baseline: FocusSchematicLayoutCandidate,
  endpointOrderPolicy: FocusSchematicEndpointOrderPolicy,
  internalLayoutVariant: FocusSchematicInternalLayoutVariant,
  internalLayoutStats: FocusSchematicInternalLayoutRunStats,
): FocusSchematicFolderBandApplication {
  const inventoryStarted = Date.now();
  const inventory = deriveInventory(input, modulePlan, baseline);
  const folderInventoryMs = Date.now() - inventoryStarted;
  if (!input.settings.directionalFolderBandsEnabled) {
    return {
      candidate: baseline,
      plan: createDisabledPlan(inventory),
      timings: {
        folderInventoryMs,
        folderInitialOrderMs: 0,
        folderOrderRefinementMs: 0,
        folderRankOrderingMs: 0,
        folderBandPackingMs: 0,
        folderModuleAssignmentMs: 0,
        folderExceptionAnalysisMs: 0,
      },
    };
  }
  const initialOrderStarted = Date.now();
  const order = initialFolderOrder(inventory);
  const folderInitialOrderMs = Date.now() - initialOrderStarted;
  const refinementStarted = Date.now();
  const phases: FolderPhaseAccumulator = {
    folderBandPackingMs: 0,
    folderRankOrderingMs: 0,
    folderModuleAssignmentMs: 0,
    folderExceptionAnalysisMs: 0,
    folderPartitionsEvaluated: 0,
    folderOrderCandidatesEvaluated: 0,
    candidateLocalHeadingReorderSweeps: 0,
    rankOrderSweeps: 0,
    jointRounds: 0,
    crossingMetricEvaluations: 0,
    cache: new Map(),
  };
  const refinedOrder = refineFolderOrder(
    input,
    modulePlan,
    endpointPlan,
    lanePlan,
    baseline,
    inventory,
    order,
    endpointOrderPolicy,
    internalLayoutVariant,
    internalLayoutStats,
    phases,
  );
  const layout = refineRootPartition(
    input,
    modulePlan,
    endpointPlan,
    lanePlan,
    baseline,
    inventory,
    refinedOrder,
    endpointOrderPolicy,
    internalLayoutVariant,
    internalLayoutStats,
    phases,
  );
  const refinementElapsed = Date.now() - refinementStarted;
  const measuredPhaseMs =
    phases.folderBandPackingMs +
    phases.folderRankOrderingMs +
    phases.folderModuleAssignmentMs +
    phases.folderExceptionAnalysisMs;
  const application: FocusSchematicFolderBandApplication = {
    candidate: layout.candidate,
    plan: layout.plan,
    timings: {
      folderInventoryMs,
      folderInitialOrderMs,
      folderOrderRefinementMs: Math.max(0, refinementElapsed - measuredPhaseMs),
      folderRankOrderingMs: phases.folderRankOrderingMs,
      folderBandPackingMs: phases.folderBandPackingMs,
      folderModuleAssignmentMs: phases.folderModuleAssignmentMs,
      folderExceptionAnalysisMs: phases.folderExceptionAnalysisMs,
    },
  };
  const validation = validateFocusSchematicFolderBandLayout(
    input,
    modulePlan,
    endpointPlan,
    baseline,
    application.plan,
    application.candidate,
  );
  if (!validation.valid)
    throw new Error(
      `Directional Folder Band validation failed: ${validation.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    );
  return application;
}

function expectedVisibleInventory(input: FocusSchematicLayoutInput) {
  const visible = input.model.modules.filter(
    ({ presentation }) => presentation !== 'filtered',
  );
  return {
    moduleIds: visible.map(({ id }) => id).sort(compareText),
    folderKeys: [...new Set(visible.map(({ folderKey }) => folderKey))].sort(
      compareText,
    ),
  };
}

/** Validates the renderer/worker-facing categorical folder-band payload. */
export function validateSerializedFocusSchematicFolderBandPlan(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  candidate: FocusSchematicLayoutCandidate,
  plan: FocusSchematicFolderBandPlan,
): FocusSchematicEndpointValidationResult<FocusSchematicFolderBandPlan> {
  const issues: { path: string; message: string }[] = [];
  const rootModule = input.model.modules.find(
    ({ id }) => id === input.model.rootModuleId,
  );
  const modelById = new Map(
    input.model.modules.map((module) => [module.id, module]),
  );
  const candidateById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const rankById = rankByModuleId(modulePlan);
  const expected = expectedVisibleInventory(input);
  if (
    plan.schemaVersion !== FOCUS_SCHEMATIC_FOLDER_BAND_PLAN_SCHEMA_VERSION ||
    plan.enabled !== input.settings.directionalFolderBandsEnabled
  )
    issues.push({
      path: '$.folderBandPlan',
      message: 'Directional folder-band schema or enabled state is invalid.',
    });
  if (rootModule === undefined || plan.rootFolderKey !== rootModule.folderKey)
    issues.push({
      path: '$.folderBandPlan.rootFolderKey',
      message: 'Root folder does not match the focused module.',
    });
  if (!plan.enabled) {
    if (
      plan.folderOrder.length !== 0 ||
      plan.bands.length !== 0 ||
      plan.modulePlacements.length !== 0 ||
      plan.exceptions.length !== 0 ||
      plan.rootBalance !== null ||
      plan.optimization !== null
    )
      issues.push({
        path: '$.folderBandPlan',
        message:
          'Disabled Directional Folder Bands must carry no band geometry.',
      });
  } else {
    const optimization = plan.optimization;
    if (
      optimization === null ||
      (optimization.endpointOrderPolicy !== 'document-order' &&
        optimization.endpointOrderPolicy !== 'crossing-optimized') ||
      (optimization.internalLayoutVariant !== 'current' &&
        optimization.internalLayoutVariant !== 'vertical-spine' &&
        optimization.internalLayoutVariant !== 'adaptive-compass') ||
      optimization.jointRoundLimit !==
        FOCUS_SCHEMATIC_FOLDER_JOINT_ROUND_COUNT ||
      optimization.folderPartitionsEvaluated < 1 ||
      optimization.folderOrderCandidatesEvaluated < 1 ||
      optimization.jointRounds !==
        optimization.folderOrderCandidatesEvaluated *
          FOCUS_SCHEMATIC_FOLDER_JOINT_ROUND_COUNT ||
      optimization.rankOrderSweeps < optimization.jointRounds ||
      optimization.rankOrderSweeps >
        optimization.jointRounds *
          FOCUS_SCHEMATIC_FOLDER_ORDERING_SWEEP_COUNT ||
      (optimization.endpointOrderPolicy === 'document-order' &&
        optimization.candidateLocalHeadingReorderSweeps !== 0) ||
      (optimization.endpointOrderPolicy === 'crossing-optimized' &&
        optimization.candidateLocalHeadingReorderSweeps !==
          optimization.jointRounds *
            FOCUS_SCHEMATIC_CENTER_STACK_ORDERING_SWEEP_COUNT) ||
      JSON.stringify(optimization.selectedCandidate.folderOrder) !==
        JSON.stringify(plan.folderOrder) ||
      optimization.selectedCandidate.rejectionReason !== null ||
      optimization.nearestRejectedCandidate?.rejectionReason === null
    )
      issues.push({
        path: '$.folderBandPlan.optimization',
        message:
          'Joint folder/endpoint optimization evidence is missing or inconsistent.',
      });
    if (
      JSON.stringify([...plan.folderOrder].sort(compareText)) !==
      JSON.stringify(expected.folderKeys)
    )
      issues.push({
        path: '$.folderBandPlan.folderOrder',
        message: 'Folder order must contain every visible exact folder once.',
      });
    if (plan.bands.length !== plan.folderOrder.length)
      issues.push({
        path: '$.folderBandPlan.bands',
        message: 'Every visible exact folder must own one band.',
      });
    for (let index = 0; index < plan.bands.length; index += 1) {
      const band = plan.bands[index]!;
      if (
        band.order !== index ||
        band.folderKey !== plan.folderOrder[index] ||
        !Number.isFinite(band.topY) ||
        !Number.isFinite(band.bottomY) ||
        !Number.isFinite(band.centerY) ||
        !Number.isFinite(band.height) ||
        band.topY >= band.bottomY ||
        Math.abs(band.bottomY - band.topY - band.height) > EPSILON ||
        Math.abs((band.topY + band.bottomY) / 2 - band.centerY) > EPSILON ||
        band.singleton !== (band.moduleIds.length === 1) ||
        (index > 0 && plan.bands[index - 1]!.bottomY >= band.topY)
      )
        issues.push({
          path: '$.folderBandPlan.bands',
          message: `Band "${band.folderKey}" has invalid geometry or order.`,
        });
      const expectedIds = input.model.modules
        .filter(
          (module) =>
            module.presentation !== 'filtered' &&
            module.folderKey === band.folderKey,
        )
        .map(({ id }) => id)
        .sort(compareText);
      if (JSON.stringify(band.moduleIds) !== JSON.stringify(expectedIds))
        issues.push({
          path: '$.folderBandPlan.bands',
          message: `Band "${band.folderKey}" has incorrect exact-folder membership.`,
        });
    }
    const expectedBalance = plan.bands.some(
      ({ folderKey }) => folderKey === plan.rootFolderKey,
    )
      ? measureRootBalance(plan.bands, plan.rootFolderKey)
      : null;
    const balance = plan.rootBalance;
    const override = balance?.topologyOverride ?? null;
    const overrideProofValid =
      override === null ||
      (override.reason === 'crossing-guard'
        ? override.evidence.candidateCrossings >
          override.evidence.baselineCrossings
        : override.evidence.candidateInversions >
          override.evidence.baselineInversions);
    if (
      balance === null ||
      expectedBalance === null ||
      JSON.stringify(balance.aboveFolderKeys) !==
        JSON.stringify(expectedBalance?.aboveFolderKeys) ||
      JSON.stringify(balance.belowFolderKeys) !==
        JSON.stringify(expectedBalance?.belowFolderKeys) ||
      Math.abs(
        balance.abovePackedExtent - (expectedBalance?.abovePackedExtent ?? 0),
      ) > EPSILON ||
      Math.abs(
        balance.belowPackedExtent - (expectedBalance?.belowPackedExtent ?? 0),
      ) > EPSILON ||
      Math.abs(
        balance.packedExtentImbalance -
          (expectedBalance?.packedExtentImbalance ?? 0),
      ) > EPSILON ||
      !Number.isFinite(balance.bestUnconstrainedImbalance) ||
      balance.bestUnconstrainedImbalance < 0 ||
      balance.bestUnconstrainedImbalance >
        balance.packedExtentImbalance + EPSILON ||
      balance.packedExtentImbalance >
        balance.bestUnconstrainedImbalance + EPSILON !==
        (override !== null) ||
      (override !== null &&
        (JSON.stringify(
          [...override.attemptedFolderOrder].sort(compareText),
        ) !== JSON.stringify(expected.folderKeys) ||
          Math.abs(
            override.attemptedPackedExtentImbalance -
              balance.bestUnconstrainedImbalance,
          ) > EPSILON ||
          !overrideProofValid))
    )
      issues.push({
        path: '$.folderBandPlan.rootBalance',
        message:
          'Root-centered band balance is inconsistent or lacks topology evidence.',
      });
    const placementIds = plan.modulePlacements
      .map(({ moduleId }) => moduleId)
      .sort(compareText);
    if (JSON.stringify(placementIds) !== JSON.stringify(expected.moduleIds))
      issues.push({
        path: '$.folderBandPlan.modulePlacements',
        message: 'Every visible non-filtered File needs one placement.',
      });
    const bandByKey = new Map(plan.bands.map((band) => [band.folderKey, band]));
    const exceptionById = new Map(
      plan.exceptions.map((exception) => [exception.id, exception]),
    );
    for (const placement of plan.modulePlacements) {
      const module = modelById.get(placement.moduleId);
      const rectangle = candidateById.get(placement.moduleId);
      const band = bandByKey.get(placement.folderKey);
      const distance =
        rectangle === undefined || band === undefined
          ? Number.NaN
          : rectangleDistanceToBand(rectangle, band);
      const satisfied = distance <= EPSILON;
      if (
        module === undefined ||
        module.presentation === 'filtered' ||
        module.folderKey !== placement.folderKey ||
        rectangle === undefined ||
        band === undefined ||
        rankById.get(placement.moduleId) !== placement.signedRank ||
        !Number.isFinite(placement.preferredBandCenterY) ||
        Math.abs(centerY(rectangle) - placement.finalCenterY) > EPSILON ||
        Math.abs(distance - placement.distanceToOwnBand) > EPSILON ||
        (satisfied &&
          (placement.status !== 'inside-own-band' ||
            placement.exceptionId !== null)) ||
        (!satisfied &&
          (placement.status !== 'exception-outside-own-band' ||
            placement.exceptionId === null ||
            !exceptionById.has(placement.exceptionId)))
      )
        issues.push({
          path: '$.folderBandPlan.modulePlacements',
          message: `Placement "${placement.moduleId}" is invalid or ambiguous.`,
        });
    }
    const exceptionModuleIds = new Set<string>();
    for (const exception of plan.exceptions) {
      const placement = plan.modulePlacements.find(
        ({ moduleId }) => moduleId === exception.moduleId,
      );
      const proofValid =
        exception.reason === 'crossing-guard'
          ? exception.evidence.candidateCrossings >
            exception.evidence.baselineCrossings
          : exception.reason === 'rank-order-inversion-guard'
            ? exception.evidence.candidateInversions >
              exception.evidence.baselineInversions
            : true;
      if (
        exceptionModuleIds.has(exception.moduleId) ||
        placement?.exceptionId !== exception.id ||
        placement.folderKey !== exception.folderKey ||
        placement.status !== 'exception-outside-own-band' ||
        Math.abs(placement.distanceToOwnBand - exception.distanceToOwnBand) >
          EPSILON ||
        !proofValid
      )
        issues.push({
          path: '$.folderBandPlan.exceptions',
          message: `Exception "${exception.id}" lacks a unique placement or hard-guard proof.`,
        });
      exceptionModuleIds.add(exception.moduleId);
    }
  }
  const satisfied = plan.modulePlacements.filter(
    ({ status }) => status === 'inside-own-band',
  ).length;
  const expectedRatio =
    plan.enabled && expected.moduleIds.length > 0
      ? satisfied / expected.moduleIds.length
      : null;
  if (
    plan.summary.visibleFolderCount !== expected.folderKeys.length ||
    plan.summary.visibleModuleCount !== expected.moduleIds.length ||
    plan.summary.satisfiedModuleCount !== satisfied ||
    plan.summary.exceptionModuleCount !== plan.exceptions.length ||
    plan.summary.satisfactionRatio !== expectedRatio ||
    plan.summary.filteredExcludedModuleCount !==
      input.model.modules.filter(
        ({ presentation }) => presentation === 'filtered',
      ).length
  )
    issues.push({
      path: '$.folderBandPlan.summary',
      message: 'Directional folder-band summary is inconsistent.',
    });
  const rootRectangle = candidateById.get(input.model.rootModuleId);
  if (rootRectangle === undefined || centerY(rootRectangle) !== 0)
    issues.push({
      path: '$.candidate.modules',
      message: 'Directional Folder Bands moved the root away from Y=0.',
    });
  if (plan.enabled) {
    const rootBand = plan.bands.find(({ root }) => root);
    if (
      rootBand === undefined ||
      rootBand.folderKey !== plan.rootFolderKey ||
      rootBand.centerY !== 0 ||
      rootRectangle === undefined ||
      !insideBand(rootRectangle, rootBand)
    )
      issues.push({
        path: '$.folderBandPlan.bands',
        message:
          'The root exact folder must own the central band and contain Focus.',
      });
  }
  return issues.length === 0
    ? { valid: true, value: plan, issues: [] }
    : { valid: false, issues };
}

export function validateFocusSchematicFolderBandPlan(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  baseline: FocusSchematicLayoutCandidate,
  final: FocusSchematicLayoutCandidate,
  plan: FocusSchematicFolderBandPlan,
): FocusSchematicEndpointValidationResult<FocusSchematicFolderBandPlan> {
  const serialized = validateSerializedFocusSchematicFolderBandPlan(
    input,
    modulePlan,
    final,
    plan,
  );
  if (!serialized.valid) return serialized;
  const baselineById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  for (const placement of plan.modulePlacements) {
    const before = baselineById.get(placement.moduleId);
    if (
      before === undefined ||
      Math.abs(centerY(before) - placement.baselineCenterY) > EPSILON ||
      Math.abs(
        placement.finalCenterY -
          placement.baselineCenterY -
          placement.displacementY,
      ) > EPSILON
    )
      return {
        valid: false,
        issues: [
          {
            path: '$.folderBandPlan.modulePlacements',
            message: `Placement "${placement.moduleId}" has invalid baseline geometry.`,
          },
        ],
      };
  }
  if (!plan.enabled && JSON.stringify(final) !== JSON.stringify(baseline))
    return {
      valid: false,
      issues: [
        {
          path: '$.candidate',
          message:
            'Folder Bands Off must be byte-identical to pure A1 geometry.',
        },
      ],
    };
  return { valid: true, value: plan, issues: [] };
}

export function validateFocusSchematicFolderBandLayout(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  baseline: FocusSchematicLayoutCandidate,
  plan: FocusSchematicFolderBandPlan,
  candidate: FocusSchematicLayoutCandidate,
): FocusSchematicEndpointValidationResult<FocusSchematicLayoutCandidate> {
  const planValidation = validateFocusSchematicFolderBandPlan(
    input,
    modulePlan,
    baseline,
    candidate,
    plan,
  );
  if (!planValidation.valid) return planValidation;
  const beforeModules = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  const afterModules = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const beforeNodes = new Map(
    baseline.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const issues: { path: string; message: string }[] = [];
  for (const [moduleId, before] of beforeModules) {
    const after = afterModules.get(moduleId);
    if (
      after === undefined ||
      after.x !== before.x ||
      after.width !== before.width ||
      after.height !== before.height
    )
      issues.push({
        path: '$.candidate.modules',
        message: `Folder movement changed X or dimensions for "${moduleId}".`,
      });
  }
  for (const after of candidate.nodes) {
    const before = beforeNodes.get(after.projectionNodeId);
    const beforeModule =
      before === undefined ? undefined : beforeModules.get(before.moduleId);
    const afterModule = afterModules.get(after.moduleId);
    const permitsInternalReorder =
      plan.optimization?.endpointOrderPolicy === 'crossing-optimized';
    if (
      before === undefined ||
      beforeModule === undefined ||
      afterModule === undefined ||
      after.x !== before.x ||
      after.width !== before.width ||
      after.height !== before.height ||
      after.x - afterModule.x !== before.x - beforeModule.x ||
      (!permitsInternalReorder &&
        Math.abs(after.y - afterModule.y - (before.y - beforeModule.y)) >
          EPSILON)
    )
      issues.push({
        path: '$.candidate.nodes',
        message: `Folder movement changed disallowed local geometry for "${after.projectionNodeId}".`,
      });
  }
  if (JSON.stringify(candidate.routes) !== JSON.stringify(baseline.routes))
    issues.push({
      path: '$.candidate.routes',
      message: 'Directional Folder Bands cannot create or change routes.',
    });
  if (
    !doesNotRegress(
      hardOrder(modulePlan, endpointPlan, baseline),
      hardOrder(modulePlan, endpointPlan, candidate),
    )
  )
    issues.push({
      path: '$.candidate',
      message: 'Folder movement increased exact crossings or rank inversions.',
    });
  if (plan.enabled && plan.optimization !== null) {
    const measuredHard = hardOrder(modulePlan, endpointPlan, candidate);
    const spans = primaryReferenceSpans(endpointPlan, candidate);
    const metrics = plan.optimization.selectedCandidate.metrics;
    const totalSpan = spans.reduce((sum, value) => sum + value, 0);
    if (
      metrics.exactEndpointCrossingCount !==
        measuredHard.exactEndpointCrossingCount ||
      metrics.adjacentRankOrderInversionCount !==
        measuredHard.adjacentRankOrderInversionCount ||
      metrics.folderBandExceptionModuleCount !== plan.exceptions.length ||
      Math.abs(metrics.totalPrimaryReferenceVerticalSpan - totalSpan) >
        EPSILON ||
      metrics.p95PrimaryReferenceVerticalSpan !== percentile(spans, 0.95) ||
      metrics.maximumPrimaryReferenceVerticalSpan !==
        (spans.length === 0 ? null : Math.max(...spans))
    )
      issues.push({
        path: '$.folderBandPlan.optimization.selectedCandidate.metrics',
        message:
          'Selected joint candidate metrics do not match final geometry.',
      });
  }
  const quality = evaluateFocusSchematicLayout(input.model, candidate, {
    clearance: FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
    rankTolerance: 1,
  });
  if (
    quality.moduleOverlapPairs.length > 0 ||
    quality.nodeOverlapPairs.length > 0 ||
    quality.nodeOutsideModuleIds.length > 0 ||
    quality.nonFiniteGeometryCount > 0
  )
    issues.push({
      path: '$.candidate',
      message:
        'Folder movement caused overlap, containment, or non-finite geometry.',
    });
  return issues.length === 0
    ? { valid: true, value: candidate, issues: [] }
    : { valid: false, issues };
}

function fragmentCount(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  candidate: FocusSchematicLayoutCandidate,
): number {
  const modelById = new Map(
    input.model.modules.map((module) => [module.id, module]),
  );
  let fragments = 0;
  for (const ids of rankOrders(modulePlan, candidate).values()) {
    const runs = new Map<string, number>();
    let previous: string | null = null;
    for (const id of ids) {
      const module = modelById.get(id);
      const folderKey =
        module?.presentation === 'filtered'
          ? null
          : (module?.folderKey ?? null);
      if (folderKey !== null && folderKey !== previous)
        runs.set(folderKey, (runs.get(folderKey) ?? 0) + 1);
      previous = folderKey;
    }
    for (const count of runs.values()) fragments += Math.max(0, count - 1);
  }
  return fragments;
}

function adjacencyCounts(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  candidate: FocusSchematicLayoutCandidate,
): { readonly same: number; readonly total: number } {
  const modelById = new Map(
    input.model.modules.map((module) => [module.id, module]),
  );
  let same = 0;
  let total = 0;
  for (const ids of rankOrders(modulePlan, candidate).values()) {
    const visible = ids
      .map((id) => modelById.get(id))
      .filter((module) => module?.presentation !== 'filtered');
    for (let index = 1; index < visible.length; index += 1) {
      total += 1;
      if (visible[index - 1]!.folderKey === visible[index]!.folderKey)
        same += 1;
    }
  }
  return { same, total };
}

export function evaluateFocusSchematicFolderBandQuality(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  plan: FocusSchematicFolderBandPlan,
  candidate: FocusSchematicLayoutCandidate,
  baselineEndpointQuality: FocusSchematicEndpointLayoutQuality,
  finalEndpointQuality: FocusSchematicEndpointLayoutQuality,
): FocusSchematicFolderBandQuality {
  const adjacency = adjacencyCounts(input, modulePlan, candidate);
  const distances = plan.modulePlacements.map(
    ({ distanceToOwnBand }) => distanceToOwnBand,
  );
  const exceptionDistances = plan.exceptions.map(
    ({ distanceToOwnBand }) => distanceToOwnBand,
  );
  const displacement = plan.modulePlacements.map((module) =>
    Math.abs(module.displacementY),
  );
  const rootOffsets = plan.modulePlacements
    .filter(({ folderKey }) => folderKey === plan.rootFolderKey)
    .map(({ finalCenterY }) => Math.abs(finalCenterY));
  return {
    visibleFolderCount: plan.summary.visibleFolderCount,
    visibleModuleCount: plan.summary.visibleModuleCount,
    folderBandSatisfiedModuleCount: plan.summary.satisfiedModuleCount,
    folderBandExceptionModuleCount: plan.summary.exceptionModuleCount,
    folderBandSatisfactionRatio: plan.summary.satisfactionRatio,
    rankFolderFragmentCount: plan.enabled
      ? fragmentCount(input, modulePlan, candidate)
      : 0,
    sameFolderAdjacencyRatioWithinRanks:
      !plan.enabled || adjacency.total === 0
        ? null
        : adjacency.same / adjacency.total,
    meanDistanceToOwnBand:
      distances.length === 0
        ? null
        : distances.reduce((sum, value) => sum + value, 0) / distances.length,
    p95DistanceToOwnBand: percentile(distances, 0.95),
    maximumDistanceToOwnBand:
      distances.length === 0 ? null : Math.max(...distances),
    totalExceptionDistance: exceptionDistances.reduce(
      (sum, value) => sum + value,
      0,
    ),
    maximumExceptionDistance: Math.max(0, ...exceptionDistances),
    meanFolderModuleDisplacement:
      displacement.length === 0
        ? 0
        : displacement.reduce((sum, value) => sum + value, 0) /
          displacement.length,
    p95FolderModuleDisplacement: percentile(displacement, 0.95) ?? 0,
    maximumFolderModuleDisplacement: Math.max(0, ...displacement),
    rootFolderMeanAbsoluteOffset:
      rootOffsets.length === 0
        ? null
        : rootOffsets.reduce((sum, value) => sum + value, 0) /
          rootOffsets.length,
    baselineExactEndpointCrossingCount:
      baselineEndpointQuality.exactEndpointCrossingCount,
    finalExactEndpointCrossingCount:
      finalEndpointQuality.exactEndpointCrossingCount,
    baselineAdjacentRankOrderInversionCount:
      baselineEndpointQuality.adjacentRankOrderInversionCount,
    finalAdjacentRankOrderInversionCount:
      finalEndpointQuality.adjacentRankOrderInversionCount,
    baselineMeanEndpointVerticalError:
      baselineEndpointQuality.meanPreciseEndpointVerticalError,
    finalMeanEndpointVerticalError:
      finalEndpointQuality.meanPreciseEndpointVerticalError,
    baselineP95EndpointVerticalError:
      baselineEndpointQuality.p95PreciseEndpointVerticalError,
    finalP95EndpointVerticalError:
      finalEndpointQuality.p95PreciseEndpointVerticalError,
  };
}
