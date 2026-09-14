import {
  evaluateFocusSchematicLayout,
  type FocusSchematicLayoutCandidate,
  type FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';

import {
  measureFocusSchematicEndpointOrder,
  measureFocusSchematicVisualSiblingOrder,
} from './crossing-minimization';
import {
  FOCUS_SCHEMATIC_DIRECTIONAL_FOLDER_BAND_PADDING_Y,
  FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
} from './settings';
import type {
  FocusSchematicDirectionalFolderHierarchyPlan,
  FocusSchematicDirectionalInternalUnit,
  FocusSchematicDirectionalNestedModulePlacement,
  FocusSchematicDirectionalParentContainer,
  FocusSchematicDirectionalTopLevelFolderUnit,
  FocusSchematicEndpointOrderPolicy,
  FocusSchematicEndpointPlan,
  FocusSchematicEndpointValidationResult,
  FocusSchematicFolderBand,
  FocusSchematicFolderBandCandidateMetrics,
  FocusSchematicFolderBandPlan,
  FocusSchematicFolderModulePlacement,
  FocusSchematicInternalLanePlan,
  FocusSchematicInternalLayoutVariant,
  FocusSchematicLayoutInput,
  FocusSchematicLayoutPlan,
} from './types';
import { FOCUS_SCHEMATIC_FOLDER_BAND_PLAN_SCHEMA_VERSION } from './types';

export const FOCUS_SCHEMATIC_DIRECTIONAL_NESTED_ORDERING_SWEEP_COUNT = 4;

const PARENT_PADDING_X = 48;
const PARENT_PADDING_Y = 24;
const INTERNAL_UNIT_PADDING_X = 16;
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

function parentFolderKey(folderKey: string): string | null {
  if (folderKey === '.') return null;
  const index = folderKey.lastIndexOf('/');
  return index < 0 ? '.' : folderKey.slice(0, index);
}

function folderDepth(folderKey: string): number {
  return folderKey === '.' ? 0 : folderKey.split('/').length;
}

function shortFolderLabel(folderKey: string): string {
  if (folderKey === '.') return 'Root folder';
  return folderKey.slice(folderKey.lastIndexOf('/') + 1);
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

interface ExactFolderDraft {
  readonly folderKey: string;
  readonly moduleIds: readonly string[];
}

interface InternalUnitDraft {
  readonly id: string;
  readonly kind: 'direct-parent' | 'child-band';
  readonly folderKey: string;
  readonly moduleIds: readonly string[];
  readonly simplifiedModuleIds: readonly string[];
  readonly requiredHeight: number;
  readonly height: number;
}

interface ParentDraft {
  readonly id: string;
  readonly folderKey: string;
  readonly internalUnits: readonly InternalUnitDraft[];
  readonly moduleIds: readonly string[];
  readonly height: number;
}

interface TopLevelDraft {
  readonly id: string;
  readonly kind: 'root-band' | 'standalone-band' | 'parent-container';
  readonly folderKey: string;
  readonly moduleIds: readonly string[];
  readonly simplifiedModuleIds: readonly string[];
  readonly height: number;
  readonly baselineMedianCenterY: number;
  readonly parent: ParentDraft | null;
}

interface HierarchyDraft {
  readonly rootFolderKey: string;
  readonly exactFolders: readonly ExactFolderDraft[];
  readonly topLevel: readonly TopLevelDraft[];
  readonly filteredModuleIds: readonly string[];
  readonly simplifiedSingletonChildCount: number;
}

function requiredHeight(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  candidate: FocusSchematicLayoutCandidate,
  moduleIds: readonly string[],
): number {
  const moduleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const rankById = rankByModuleId(modulePlan);
  const byRank = new Map<number, string[]>();
  for (const moduleId of moduleIds) {
    const rank = rankById.get(moduleId);
    if (rank === undefined) continue;
    const ids = byRank.get(rank) ?? [];
    ids.push(moduleId);
    byRank.set(rank, ids);
  }
  let result = 0;
  for (const ids of byRank.values()) {
    ids.sort(
      (left, right) =>
        centerY(moduleById.get(left)!) - centerY(moduleById.get(right)!) ||
        compareText(left, right),
    );
    if (ids.includes(input.model.rootModuleId)) {
      const rootIndex = ids.indexOf(input.model.rootModuleId);
      const root = moduleById.get(input.model.rootModuleId)!;
      const before = ids
        .slice(0, rootIndex)
        .reduce(
          (sum, moduleId) =>
            sum +
            moduleById.get(moduleId)!.height +
            input.settings.macroNodeSeparation,
          root.height / 2,
        );
      const after = ids
        .slice(rootIndex + 1)
        .reduce(
          (sum, moduleId) =>
            sum +
            moduleById.get(moduleId)!.height +
            input.settings.macroNodeSeparation,
          root.height / 2,
        );
      result = Math.max(result, 2 * Math.max(before, after));
      continue;
    }
    result = Math.max(
      result,
      ids.reduce((sum, moduleId) => sum + moduleById.get(moduleId)!.height, 0) +
        input.settings.macroNodeSeparation * Math.max(0, ids.length - 1),
    );
  }
  return result;
}

function deriveHierarchyDraft(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  baseline: FocusSchematicLayoutCandidate,
): HierarchyDraft {
  const rootModule = input.model.modules.find(
    ({ id }) => id === input.model.rootModuleId,
  );
  if (rootModule === undefined)
    throw new Error(
      'Nested Directional Bands cannot find the root File module.',
    );
  const visible = input.model.modules.filter(
    ({ presentation }) => presentation !== 'filtered',
  );
  const grouped = new Map<string, string[]>();
  for (const module of visible) {
    const ids = grouped.get(module.folderKey) ?? [];
    ids.push(module.id);
    grouped.set(module.folderKey, ids);
  }
  const exactFolders = [...grouped]
    .map(([folderKey, moduleIds]) => ({
      folderKey,
      moduleIds: [...moduleIds].sort(compareText),
    }))
    .sort((left, right) => compareText(left.folderKey, right.folderKey));
  const exactByKey = new Map(
    exactFolders.map((folder) => [folder.folderKey, folder]),
  );
  const baselineById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  const claimed = new Set<string>([rootModule.folderKey]);
  const topLevel: TopLevelDraft[] = [];
  let simplifiedSingletonChildCount = 0;

  const rootExact = exactByKey.get(rootModule.folderKey);
  if (rootExact === undefined)
    throw new Error(
      'Nested Directional Bands cannot find the root exact folder.',
    );
  const rootRequired = requiredHeight(
    input,
    modulePlan,
    baseline,
    rootExact.moduleIds,
  );
  topLevel.push({
    id: `root-band:${rootExact.folderKey}`,
    kind: 'root-band',
    folderKey: rootExact.folderKey,
    moduleIds: rootExact.moduleIds,
    simplifiedModuleIds: [],
    height:
      rootRequired + FOCUS_SCHEMATIC_DIRECTIONAL_FOLDER_BAND_PADDING_Y * 2,
    baselineMedianCenterY: 0,
    parent: null,
  });

  const parentCandidates = [
    ...new Set(
      exactFolders.flatMap(({ folderKey }) => {
        if (folderKey === rootModule.folderKey) return [];
        const parent = parentFolderKey(folderKey);
        return parent === null || parent === rootModule.folderKey
          ? []
          : [parent];
      }),
    ),
  ].sort(
    (left, right) =>
      folderDepth(right) - folderDepth(left) || compareText(left, right),
  );

  for (const parentKey of parentCandidates) {
    if (claimed.has(parentKey)) continue;
    const direct = exactByKey.get(parentKey);
    const directIds =
      direct === undefined || claimed.has(parentKey) ? [] : direct.moduleIds;
    const childFolders = exactFolders.filter(
      ({ folderKey }) =>
        !claimed.has(folderKey) &&
        folderKey !== rootModule.folderKey &&
        parentFolderKey(folderKey) === parentKey,
    );
    if (childFolders.length === 0) continue;

    if (
      directIds.length > 0 &&
      childFolders.length === 1 &&
      childFolders[0]!.moduleIds.length === 1
    ) {
      const child = childFolders[0]!;
      const moduleIds = [...directIds, ...child.moduleIds].sort(compareText);
      const height =
        requiredHeight(input, modulePlan, baseline, moduleIds) +
        FOCUS_SCHEMATIC_DIRECTIONAL_FOLDER_BAND_PADDING_Y * 2;
      topLevel.push({
        id: `band:${parentKey}`,
        kind: 'standalone-band',
        folderKey: parentKey,
        moduleIds,
        simplifiedModuleIds: child.moduleIds,
        height,
        baselineMedianCenterY: median(
          moduleIds.map((moduleId) => centerY(baselineById.get(moduleId)!)),
        ),
        parent: null,
      });
      claimed.add(parentKey);
      claimed.add(child.folderKey);
      simplifiedSingletonChildCount += 1;
      continue;
    }

    const internalUnits: InternalUnitDraft[] = [];
    if (directIds.length > 0) {
      const directRequired = requiredHeight(
        input,
        modulePlan,
        baseline,
        directIds,
      );
      internalUnits.push({
        id: `direct:${parentKey}`,
        kind: 'direct-parent',
        folderKey: parentKey,
        moduleIds: directIds,
        simplifiedModuleIds: [],
        requiredHeight: directRequired,
        height:
          directRequired +
          FOCUS_SCHEMATIC_DIRECTIONAL_FOLDER_BAND_PADDING_Y * 2,
      });
    }
    for (const child of childFolders) {
      const childRequired = requiredHeight(
        input,
        modulePlan,
        baseline,
        child.moduleIds,
      );
      internalUnits.push({
        id: `child:${parentKey}:${child.folderKey}`,
        kind: 'child-band',
        folderKey: child.folderKey,
        moduleIds: child.moduleIds,
        simplifiedModuleIds: [],
        requiredHeight: childRequired,
        height:
          childRequired + FOCUS_SCHEMATIC_DIRECTIONAL_FOLDER_BAND_PADDING_Y * 2,
      });
    }
    if (internalUnits.length < 2) continue;
    // Canonical folder identity is the stable starting order. Endpoint metrics
    // may then swap whole units without making insertion order authoritative.
    const orderedInternal = [...internalUnits].sort((left, right) =>
      compareText(left.id, right.id),
    );
    const moduleIds = orderedInternal
      .flatMap(({ moduleIds: ids }) => ids)
      .sort(compareText);
    const parent: ParentDraft = {
      id: `parent:${parentKey}`,
      folderKey: parentKey,
      internalUnits: orderedInternal,
      moduleIds,
      height:
        PARENT_PADDING_Y * 2 +
        orderedInternal.reduce((sum, unit) => sum + unit.height, 0) +
        input.settings.macroNodeSeparation *
          Math.max(0, orderedInternal.length - 1),
    };
    topLevel.push({
      id: parent.id,
      kind: 'parent-container',
      folderKey: parentKey,
      moduleIds,
      simplifiedModuleIds: [],
      height: parent.height,
      baselineMedianCenterY: median(
        moduleIds.map((moduleId) => centerY(baselineById.get(moduleId)!)),
      ),
      parent,
    });
    if (directIds.length > 0) claimed.add(parentKey);
    for (const child of childFolders) claimed.add(child.folderKey);
  }

  for (const exact of exactFolders) {
    if (claimed.has(exact.folderKey)) continue;
    const exactRequired = requiredHeight(
      input,
      modulePlan,
      baseline,
      exact.moduleIds,
    );
    topLevel.push({
      id: `band:${exact.folderKey}`,
      kind: 'standalone-band',
      folderKey: exact.folderKey,
      moduleIds: exact.moduleIds,
      simplifiedModuleIds: [],
      height:
        exactRequired + FOCUS_SCHEMATIC_DIRECTIONAL_FOLDER_BAND_PADDING_Y * 2,
      baselineMedianCenterY: median(
        exact.moduleIds.map((moduleId) => centerY(baselineById.get(moduleId)!)),
      ),
      parent: null,
    });
  }

  return {
    rootFolderKey: rootModule.folderKey,
    exactFolders,
    topLevel: topLevel.sort(
      (left, right) =>
        left.baselineMedianCenterY - right.baselineMedianCenterY ||
        compareText(left.id, right.id),
    ),
    filteredModuleIds: input.model.modules
      .filter(({ presentation }) => presentation === 'filtered')
      .map(({ id }) => id)
      .sort(compareText),
    simplifiedSingletonChildCount,
  };
}

interface GeometryState {
  readonly topOrder: readonly string[];
  readonly internalOrderByParent: ReadonlyMap<string, readonly string[]>;
}

interface NestedLayout {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly topLevelUnits: readonly FocusSchematicDirectionalTopLevelFolderUnit[];
  readonly parentContainers: readonly FocusSchematicDirectionalParentContainer[];
  readonly internalUnits: readonly FocusSchematicDirectionalInternalUnit[];
  readonly nestedPlacements: readonly FocusSchematicDirectionalNestedModulePlacement[];
}

function translateModules(
  candidate: FocusSchematicLayoutCandidate,
  centerById: ReadonlyMap<string, number>,
): FocusSchematicLayoutCandidate {
  const deltaById = new Map(
    candidate.modules.flatMap((module) => {
      const target = centerById.get(module.moduleId);
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

function assignModuleCenters(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  baseline: FocusSchematicLayoutCandidate,
  moduleIds: readonly string[],
  unitCenterY: number,
  target: Map<string, number>,
): void {
  const moduleById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  const rankById = rankByModuleId(modulePlan);
  const byRank = new Map<number, string[]>();
  for (const moduleId of moduleIds) {
    const rank = rankById.get(moduleId);
    if (rank === undefined) continue;
    const ids = byRank.get(rank) ?? [];
    ids.push(moduleId);
    byRank.set(rank, ids);
  }
  for (const ids of byRank.values()) {
    ids.sort(
      (left, right) =>
        centerY(moduleById.get(left)!) - centerY(moduleById.get(right)!) ||
        compareText(left, right),
    );
    const rootIndex = ids.indexOf(input.model.rootModuleId);
    if (rootIndex >= 0) {
      target.set(input.model.rootModuleId, 0);
      let nextCenter = 0;
      let nextHeight = moduleById.get(input.model.rootModuleId)!.height;
      for (let index = rootIndex - 1; index >= 0; index -= 1) {
        const id = ids[index]!;
        const rectangle = moduleById.get(id)!;
        nextCenter -=
          nextHeight / 2 +
          input.settings.macroNodeSeparation +
          rectangle.height / 2;
        target.set(id, nextCenter);
        nextHeight = rectangle.height;
      }
      nextCenter = 0;
      nextHeight = moduleById.get(input.model.rootModuleId)!.height;
      for (let index = rootIndex + 1; index < ids.length; index += 1) {
        const id = ids[index]!;
        const rectangle = moduleById.get(id)!;
        nextCenter +=
          nextHeight / 2 +
          input.settings.macroNodeSeparation +
          rectangle.height / 2;
        target.set(id, nextCenter);
        nextHeight = rectangle.height;
      }
      continue;
    }
    const stackHeight =
      ids.reduce((sum, id) => sum + moduleById.get(id)!.height, 0) +
      input.settings.macroNodeSeparation * Math.max(0, ids.length - 1);
    let cursor = unitCenterY - stackHeight / 2;
    for (const id of ids) {
      const rectangle = moduleById.get(id)!;
      target.set(id, cursor + rectangle.height / 2);
      cursor += rectangle.height + input.settings.macroNodeSeparation;
    }
  }
}

function materializeGeometry(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  baseline: FocusSchematicLayoutCandidate,
  draft: HierarchyDraft,
  state: GeometryState,
): NestedLayout {
  const topById = new Map(draft.topLevel.map((unit) => [unit.id, unit]));
  const rootId = draft.topLevel.find(({ kind }) => kind === 'root-band')!.id;
  const rootIndex = state.topOrder.indexOf(rootId);
  if (rootIndex < 0)
    throw new Error('Nested Directional ordering omitted the root band.');
  const topCenterById = new Map<string, number>([[rootId, 0]]);
  const root = topById.get(rootId)!;
  let cursor = -root.height / 2 - input.settings.macroNodeSeparation;
  for (let index = rootIndex - 1; index >= 0; index -= 1) {
    const unit = topById.get(state.topOrder[index]!)!;
    const unitCenter = cursor - unit.height / 2;
    topCenterById.set(unit.id, unitCenter);
    cursor -= unit.height + input.settings.macroNodeSeparation;
  }
  cursor = root.height / 2 + input.settings.macroNodeSeparation;
  for (let index = rootIndex + 1; index < state.topOrder.length; index += 1) {
    const unit = topById.get(state.topOrder[index]!)!;
    const unitCenter = cursor + unit.height / 2;
    topCenterById.set(unit.id, unitCenter);
    cursor += unit.height + input.settings.macroNodeSeparation;
  }

  const baselineById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  const centers = new Map<string, number>();
  const topLevelUnits: FocusSchematicDirectionalTopLevelFolderUnit[] = [];
  const parentContainers: FocusSchematicDirectionalParentContainer[] = [];
  const internalUnits: FocusSchematicDirectionalInternalUnit[] = [];
  const nestedPlacements: FocusSchematicDirectionalNestedModulePlacement[] = [];

  for (const [order, topId] of state.topOrder.entries()) {
    const unit = topById.get(topId)!;
    const unitCenter = topCenterById.get(topId)!;
    const topY = unitCenter - unit.height / 2;
    const bottomY = unitCenter + unit.height / 2;
    topLevelUnits.push({
      id: unit.id,
      kind: unit.kind,
      folderKey: unit.folderKey,
      order,
      topY,
      bottomY,
      centerY: unitCenter,
      height: unit.height,
      moduleIds: unit.moduleIds,
    });
    if (unit.parent === null) {
      assignModuleCenters(
        input,
        modulePlan,
        baseline,
        unit.moduleIds,
        unitCenter,
        centers,
      );
      for (const moduleId of unit.moduleIds) {
        const exactFolderKey = input.model.modules.find(
          ({ id }) => id === moduleId,
        )!.folderKey;
        nestedPlacements.push({
          moduleId,
          exactFolderKey,
          displayedFolderKey: unit.folderKey,
          displayUnitId: unit.id,
          parentContainerId: null,
          provenance: unit.simplifiedModuleIds.includes(moduleId)
            ? 'automatic-directional-singleton-simplification'
            : 'exact-directional-folder',
        });
      }
      continue;
    }

    const parent = unit.parent;
    const left = Math.min(
      ...parent.moduleIds.map((moduleId) => baselineById.get(moduleId)!.x),
    );
    const right = Math.max(
      ...parent.moduleIds.map((moduleId) => {
        const rectangle = baselineById.get(moduleId)!;
        return rectangle.x + rectangle.width;
      }),
    );
    const parentX = left - PARENT_PADDING_X;
    const parentWidth = right - left + PARENT_PADDING_X * 2;
    const internalOrder =
      state.internalOrderByParent.get(parent.id) ??
      parent.internalUnits.map(({ id }) => id);
    const internalById = new Map(
      parent.internalUnits.map((internal) => [internal.id, internal]),
    );
    let internalCursor = topY + PARENT_PADDING_Y;
    for (const [internalOrderIndex, internalId] of internalOrder.entries()) {
      const internal = internalById.get(internalId)!;
      const internalTop = internalCursor;
      const internalBottom = internalTop + internal.height;
      const internalCenter = (internalTop + internalBottom) / 2;
      const rendered: FocusSchematicDirectionalInternalUnit = {
        id: internal.id,
        kind: internal.kind,
        folderKey: internal.folderKey,
        parentContainerId: parent.id,
        label:
          internal.kind === 'direct-parent'
            ? null
            : shortFolderLabel(internal.folderKey),
        fullLabel: internal.folderKey,
        order: internalOrderIndex,
        topY: internalTop,
        bottomY: internalBottom,
        centerY: internalCenter,
        height: internal.height,
        x: parentX + INTERNAL_UNIT_PADDING_X,
        width: parentWidth - INTERNAL_UNIT_PADDING_X * 2,
        moduleIds: internal.moduleIds,
      };
      internalUnits.push(rendered);
      assignModuleCenters(
        input,
        modulePlan,
        baseline,
        internal.moduleIds,
        internalCenter,
        centers,
      );
      for (const moduleId of internal.moduleIds) {
        nestedPlacements.push({
          moduleId,
          exactFolderKey: input.model.modules.find(({ id }) => id === moduleId)!
            .folderKey,
          displayedFolderKey: internal.folderKey,
          displayUnitId: internal.id,
          parentContainerId: parent.id,
          provenance: 'exact-directional-folder',
        });
      }
      internalCursor = internalBottom + input.settings.macroNodeSeparation;
    }
    parentContainers.push({
      id: parent.id,
      folderKey: parent.folderKey,
      label: shortFolderLabel(parent.folderKey),
      fullLabel: parent.folderKey,
      topY,
      bottomY,
      centerY: unitCenter,
      height: unit.height,
      x: parentX,
      width: parentWidth,
      initialInternalUnitIds: parent.internalUnits.map(({ id }) => id),
      internalUnitIds: internalOrder,
      moduleIds: parent.moduleIds,
    });
  }

  const rankById = rankByModuleId(modulePlan);
  const visibleBottomByRank = new Map<number, number>();
  for (const [moduleId, targetCenter] of centers) {
    const rank = rankById.get(moduleId);
    const rectangle = baselineById.get(moduleId);
    if (rank === undefined || rectangle === undefined) continue;
    visibleBottomByRank.set(
      rank,
      Math.max(
        visibleBottomByRank.get(rank) ?? Number.NEGATIVE_INFINITY,
        targetCenter + rectangle.height / 2,
      ),
    );
  }
  const filteredByRank = new Map<number, string[]>();
  for (const moduleId of draft.filteredModuleIds) {
    const rank = rankById.get(moduleId);
    if (rank === undefined) continue;
    const ids = filteredByRank.get(rank) ?? [];
    ids.push(moduleId);
    filteredByRank.set(rank, ids);
  }
  for (const [rank, ids] of filteredByRank) {
    ids.sort(
      (left, right) =>
        centerY(baselineById.get(left)!) - centerY(baselineById.get(right)!) ||
        compareText(left, right),
    );
    let filteredCursor =
      (visibleBottomByRank.get(rank) ?? 0) + input.settings.macroNodeSeparation;
    for (const moduleId of ids) {
      const rectangle = baselineById.get(moduleId)!;
      const targetCenter = filteredCursor + rectangle.height / 2;
      centers.set(moduleId, targetCenter);
      filteredCursor += rectangle.height + input.settings.macroNodeSeparation;
    }
  }

  return {
    candidate: translateModules(baseline, centers),
    topLevelUnits,
    parentContainers: parentContainers.sort((left, right) =>
      compareText(left.id, right.id),
    ),
    internalUnits: internalUnits.sort(
      (left, right) =>
        compareText(left.parentContainerId, right.parentContainerId) ||
        left.order - right.order,
    ),
    nestedPlacements: nestedPlacements.sort((left, right) =>
      compareText(left.moduleId, right.moduleId),
    ),
  };
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
  return endpointPlan.connections.flatMap((connection) => {
    if (
      connection.kind !== 'precise' ||
      connection.role === 'secondary' ||
      connection.sourceModuleId === connection.targetModuleId
    )
      return [];
    const source =
      connection.source.kind === 'visible-entity'
        ? nodeById.get(connection.source.projectionNodeId)
        : moduleById.get(connection.source.moduleId);
    const target =
      connection.target.kind === 'visible-entity'
        ? nodeById.get(connection.target.projectionNodeId)
        : moduleById.get(connection.target.moduleId);
    return source === undefined || target === undefined
      ? []
      : [Math.abs(centerY(source) - centerY(target))];
  });
}

interface NestedScore {
  readonly crossings: number;
  readonly inversions: number;
  readonly rootImbalance: number;
  readonly span: number;
  readonly displacement: number;
  readonly stable: string;
}

function rootBalance(
  units: readonly FocusSchematicDirectionalTopLevelFolderUnit[],
  rootFolderKey: string,
) {
  const root = units.find(
    (unit) => unit.kind === 'root-band' && unit.folderKey === rootFolderKey,
  );
  if (root === undefined)
    throw new Error(
      'Nested Directional plan omitted its independent root band.',
    );
  const above = units.filter(({ bottomY }) => bottomY <= root.topY + EPSILON);
  const below = units.filter(({ topY }) => topY >= root.bottomY - EPSILON);
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

function scoreLayout(
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  baseline: FocusSchematicLayoutCandidate,
  draft: HierarchyDraft,
  state: GeometryState,
  layout: NestedLayout,
): NestedScore {
  const hard = measureFocusSchematicEndpointOrder(
    modulePlan,
    endpointPlan,
    layout.candidate,
  );
  const spans = primaryReferenceSpans(endpointPlan, layout.candidate);
  const baselineById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  return {
    crossings: hard.exactEndpointCrossingCount,
    inversions: hard.adjacentRankOrderInversionCount,
    rootImbalance: rootBalance(layout.topLevelUnits, draft.rootFolderKey)
      .packedExtentImbalance,
    span: spans.reduce((sum, value) => sum + value, 0),
    displacement: layout.candidate.modules.reduce(
      (sum, module) =>
        sum +
        Math.abs(centerY(module) - centerY(baselineById.get(module.moduleId)!)),
      0,
    ),
    stable: `${state.topOrder.join('|')}::${[...state.internalOrderByParent]
      .sort(([left], [right]) => compareText(left, right))
      .map(([parentId, order]) => `${parentId}=${order.join('|')}`)
      .join(';')}`,
  };
}

function improves(left: NestedScore, right: NestedScore): boolean {
  for (const key of [
    'crossings',
    'inversions',
    'rootImbalance',
    'span',
    'displacement',
  ] as const) {
    const delta = left[key] - right[key];
    if (Math.abs(delta) > EPSILON) return delta < 0;
  }
  return compareText(left.stable, right.stable) < 0;
}

function candidateMetrics(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  baseline: FocusSchematicLayoutCandidate,
  layout: NestedLayout,
  balance: ReturnType<typeof rootBalance>,
): FocusSchematicFolderBandCandidateMetrics {
  const hard = measureFocusSchematicEndpointOrder(
    modulePlan,
    endpointPlan,
    layout.candidate,
  );
  const spans = primaryReferenceSpans(endpointPlan, layout.candidate);
  const baselineById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  const nonRootCount = Math.max(0, layout.topLevelUnits.length - 1);
  return {
    exactEndpointCrossingCount: hard.exactEndpointCrossingCount,
    adjacentRankOrderInversionCount: hard.adjacentRankOrderInversionCount,
    folderBandExceptionModuleCount: 0,
    oneSidedRootPenalty:
      nonRootCount >= 2 &&
      (balance.aboveFolderKeys.length === 0 ||
        balance.belowFolderKeys.length === 0)
        ? 1
        : 0,
    rootBalanceImbalance: balance.packedExtentImbalance,
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
    totalExceptionDistanceToOwnBand: 0,
    totalModuleDisplacementFromPureA1: layout.candidate.modules.reduce(
      (sum, module) =>
        sum +
        Math.abs(centerY(module) - centerY(baselineById.get(module.moduleId)!)),
      0,
    ),
    visualSiblingOrderDeviationFromSource:
      measureFocusSchematicVisualSiblingOrder(input, lanePlan, layout.candidate)
        .visualSiblingOrderDeviationFromSource,
  };
}

function bandFromTop(
  top: FocusSchematicDirectionalTopLevelFolderUnit,
  baseline: FocusSchematicLayoutCandidate,
): FocusSchematicFolderBand {
  const moduleById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  return {
    folderKey: top.folderKey,
    root: top.kind === 'root-band',
    order: top.order,
    topY: top.topY,
    bottomY: top.bottomY,
    centerY: top.centerY,
    height: top.height,
    moduleIds: top.moduleIds,
    requiredHeight:
      top.height - FOCUS_SCHEMATIC_DIRECTIONAL_FOLDER_BAND_PADDING_Y * 2,
    baselineMedianCenterY: median(
      top.moduleIds.map((moduleId) => centerY(moduleById.get(moduleId)!)),
    ),
    singleton: top.moduleIds.length === 1,
  };
}

function assignedRectangle(
  placement: FocusSchematicDirectionalNestedModulePlacement,
  layout: NestedLayout,
): {
  readonly topY: number;
  readonly bottomY: number;
  readonly centerY: number;
} {
  if (placement.parentContainerId === null) {
    const top = layout.topLevelUnits.find(
      ({ id }) => id === placement.displayUnitId,
    );
    if (top === undefined)
      throw new Error(`Missing top-level unit "${placement.displayUnitId}".`);
    return top;
  }
  const internal = layout.internalUnits.find(
    ({ id }) => id === placement.displayUnitId,
  );
  if (internal === undefined)
    throw new Error(`Missing internal unit "${placement.displayUnitId}".`);
  return internal;
}

export function applyFocusSchematicNestedDirectionalFolderBands(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  lanePlan: FocusSchematicInternalLanePlan,
  baseline: FocusSchematicLayoutCandidate,
  endpointOrderPolicy: FocusSchematicEndpointOrderPolicy,
  internalLayoutVariant: FocusSchematicInternalLayoutVariant,
) {
  const inventoryStarted = Date.now();
  const draft = deriveHierarchyDraft(input, modulePlan, baseline);
  const folderInventoryMs = Date.now() - inventoryStarted;
  const initialOrderStarted = Date.now();
  let state: GeometryState = {
    topOrder: draft.topLevel.map(({ id }) => id),
    internalOrderByParent: new Map(
      draft.topLevel.flatMap(({ parent }) =>
        parent === null
          ? []
          : [[parent.id, parent.internalUnits.map(({ id }) => id)] as const],
      ),
    ),
  };
  const folderInitialOrderMs = Date.now() - initialOrderStarted;
  const refinementStarted = Date.now();
  let layout = materializeGeometry(input, modulePlan, baseline, draft, state);
  let score = scoreLayout(
    modulePlan,
    endpointPlan,
    baseline,
    draft,
    state,
    layout,
  );
  let candidateCount = 1;
  let parentLocalOrderingSweepCount = 0;

  for (
    let sweep = 0;
    sweep < FOCUS_SCHEMATIC_DIRECTIONAL_NESTED_ORDERING_SWEEP_COUNT;
    sweep += 1
  ) {
    const indexes = Array.from(
      { length: Math.max(0, state.topOrder.length - 1) },
      (_, index) => index,
    );
    if (sweep % 2 === 1) indexes.reverse();
    for (const index of indexes) {
      const topOrder = [...state.topOrder];
      [topOrder[index], topOrder[index + 1]] = [
        topOrder[index + 1]!,
        topOrder[index]!,
      ];
      const proposalState = { ...state, topOrder };
      const proposal = materializeGeometry(
        input,
        modulePlan,
        baseline,
        draft,
        proposalState,
      );
      const proposalScore = scoreLayout(
        modulePlan,
        endpointPlan,
        baseline,
        draft,
        proposalState,
        proposal,
      );
      candidateCount += 1;
      if (improves(proposalScore, score)) {
        state = proposalState;
        layout = proposal;
        score = proposalScore;
      }
    }
  }

  for (const parent of draft.topLevel.flatMap(({ parent }) =>
    parent === null ? [] : [parent],
  )) {
    for (
      let sweep = 0;
      sweep < FOCUS_SCHEMATIC_DIRECTIONAL_NESTED_ORDERING_SWEEP_COUNT;
      sweep += 1
    ) {
      parentLocalOrderingSweepCount += 1;
      const order = state.internalOrderByParent.get(parent.id)!;
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
        const internalOrderByParent = new Map(state.internalOrderByParent);
        internalOrderByParent.set(parent.id, swapped);
        const proposalState = { ...state, internalOrderByParent };
        const proposal = materializeGeometry(
          input,
          modulePlan,
          baseline,
          draft,
          proposalState,
        );
        const proposalScore = scoreLayout(
          modulePlan,
          endpointPlan,
          baseline,
          draft,
          proposalState,
          proposal,
        );
        candidateCount += 1;
        if (improves(proposalScore, score)) {
          state = proposalState;
          layout = proposal;
          score = proposalScore;
        }
      }
    }
  }

  const refinementElapsed = Date.now() - refinementStarted;
  const balance = rootBalance(layout.topLevelUnits, draft.rootFolderKey);
  const nestedPlan: FocusSchematicDirectionalFolderHierarchyPlan = {
    schemaVersion: 1,
    maximumNestedDepth: 1,
    rootBandFolderKey: draft.rootFolderKey,
    topLevelUnits: layout.topLevelUnits,
    parentContainers: layout.parentContainers,
    internalUnits: layout.internalUnits,
    modulePlacements: layout.nestedPlacements,
    summary: {
      visibleExactFolderCount: draft.exactFolders.length,
      parentContainerCount: layout.parentContainers.length,
      childBandCount: layout.internalUnits.filter(
        ({ kind }) => kind === 'child-band',
      ).length,
      standaloneBandCount: layout.topLevelUnits.filter(
        ({ kind }) => kind === 'standalone-band',
      ).length,
      simplifiedSingletonChildCount: draft.simplifiedSingletonChildCount,
      topLevelOrderingCandidateCount: candidateCount,
      parentLocalOrderingSweepCount,
      parentLocalOrderingChangeCount: layout.parentContainers.filter(
        ({ initialInternalUnitIds, internalUnitIds }) =>
          JSON.stringify(initialInternalUnitIds) !==
          JSON.stringify(internalUnitIds),
      ).length,
      maximumNestedDepth: 1,
    },
  };
  const baselineById = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  const finalById = new Map(
    layout.candidate.modules.map((module) => [module.moduleId, module]),
  );
  const rankById = rankByModuleId(modulePlan);
  const placements = layout.nestedPlacements.map(
    (nested): FocusSchematicFolderModulePlacement => {
      const assigned = assignedRectangle(nested, layout);
      const before = baselineById.get(nested.moduleId)!;
      const after = finalById.get(nested.moduleId)!;
      return {
        moduleId: nested.moduleId,
        folderKey: nested.exactFolderKey,
        signedRank: rankById.get(nested.moduleId) as
          -3 | -2 | -1 | 0 | 1 | 2 | 3,
        baselineCenterY: centerY(before),
        preferredBandCenterY: assigned.centerY,
        finalCenterY: centerY(after),
        displacementY: centerY(after) - centerY(before),
        distanceToOwnBand: 0,
        status: 'inside-own-band',
        exceptionId: null,
      };
    },
  );
  const bands = [
    ...layout.topLevelUnits
      .filter(({ kind }) => kind !== 'parent-container')
      .map((top) => bandFromTop(top, baseline)),
    ...layout.internalUnits
      .filter(({ kind }) => kind === 'child-band')
      .map((unit): FocusSchematicFolderBand => ({
        folderKey: unit.folderKey,
        root: false,
        order: 0,
        topY: unit.topY,
        bottomY: unit.bottomY,
        centerY: unit.centerY,
        height: unit.height,
        moduleIds: unit.moduleIds,
        requiredHeight:
          unit.height - FOCUS_SCHEMATIC_DIRECTIONAL_FOLDER_BAND_PADDING_Y * 2,
        baselineMedianCenterY: median(
          unit.moduleIds.map((moduleId) =>
            centerY(baselineById.get(moduleId)!),
          ),
        ),
        singleton: unit.moduleIds.length === 1,
      })),
  ]
    .sort(
      (left, right) =>
        left.topY - right.topY || compareText(left.folderKey, right.folderKey),
    )
    .map((band, order) => ({ ...band, order }));
  const metrics = candidateMetrics(
    input,
    modulePlan,
    endpointPlan,
    lanePlan,
    baseline,
    layout,
    balance,
  );
  const siblingOrder = measureFocusSchematicVisualSiblingOrder(
    input,
    lanePlan,
    layout.candidate,
  );
  const plan: FocusSchematicFolderBandPlan = {
    schemaVersion: FOCUS_SCHEMATIC_FOLDER_BAND_PLAN_SCHEMA_VERSION,
    enabled: true,
    rootFolderKey: draft.rootFolderKey,
    folderOrder: layout.topLevelUnits.map(({ folderKey }) => folderKey),
    bands,
    modulePlacements: placements,
    exceptions: [],
    rootBalance: {
      ...balance,
      bestUnconstrainedImbalance: balance.packedExtentImbalance,
      topologyOverride: null,
    },
    optimization: {
      endpointOrderPolicy,
      internalLayoutVariant,
      jointRoundLimit: 2,
      folderPartitionsEvaluated: candidateCount,
      folderOrderCandidatesEvaluated: candidateCount,
      candidateLocalHeadingReorderSweeps: 0,
      rankOrderSweeps: 0,
      jointRounds: 1,
      crossingMetricEvaluations: candidateCount,
      visuallyReorderedBranchCount: siblingOrder.visuallyReorderedBranchCount,
      selectedCandidate: {
        folderOrder: layout.topLevelUnits.map(({ folderKey }) => folderKey),
        metrics,
        rejectionReason: null,
      },
      nearestRejectedCandidate: null,
    },
    hierarchy: nestedPlan,
    summary: {
      visibleFolderCount: draft.exactFolders.length,
      visibleModuleCount: placements.length,
      satisfiedModuleCount: placements.length,
      exceptionModuleCount: 0,
      satisfactionRatio: placements.length === 0 ? null : 1,
      rootFolderVisibleModuleCount:
        draft.exactFolders.find(
          ({ folderKey }) => folderKey === draft.rootFolderKey,
        )?.moduleIds.length ?? 0,
      filteredExcludedModuleCount: draft.filteredModuleIds.length,
    },
  };
  return {
    candidate: layout.candidate,
    plan,
    timings: {
      folderInventoryMs,
      folderInitialOrderMs,
      folderOrderRefinementMs: refinementElapsed,
      folderRankOrderingMs: 0,
      folderBandPackingMs: 0,
      folderModuleAssignmentMs: 0,
      folderExceptionAnalysisMs: 0,
    },
  };
}

function rectangleInside(
  inner: FocusSchematicRectangle,
  outer: {
    readonly x: number;
    readonly width: number;
    readonly topY: number;
    readonly bottomY: number;
  },
): boolean {
  return (
    inner.x >= outer.x - EPSILON &&
    inner.x + inner.width <= outer.x + outer.width + EPSILON &&
    inner.y >= outer.topY - EPSILON &&
    inner.y + inner.height <= outer.bottomY + EPSILON
  );
}

export function validateFocusSchematicNestedDirectionalFolderPlan(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  candidate: FocusSchematicLayoutCandidate,
  plan: FocusSchematicFolderBandPlan,
): FocusSchematicEndpointValidationResult<FocusSchematicFolderBandPlan> {
  const hierarchy = plan.hierarchy;
  const issues: { readonly path: string; readonly message: string }[] = [];
  if (
    hierarchy === undefined ||
    hierarchy.schemaVersion !== 1 ||
    hierarchy.maximumNestedDepth !== 1 ||
    hierarchy.summary.maximumNestedDepth !== 1 ||
    hierarchy.rootBandFolderKey !== plan.rootFolderKey
  )
    return {
      valid: false,
      issues: [
        {
          path: '$.folderBandPlan.hierarchy',
          message:
            'Nested Directional hierarchy schema or root identity is invalid.',
        },
      ],
    };
  const visibleModules = input.model.modules.filter(
    ({ presentation }) => presentation !== 'filtered',
  );
  const modelById = new Map(
    input.model.modules.map((module) => [module.id, module]),
  );
  const candidateById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const rankById = rankByModuleId(modulePlan);
  const rootUnits = hierarchy.topLevelUnits.filter(
    ({ kind }) => kind === 'root-band',
  );
  if (
    rootUnits.length !== 1 ||
    rootUnits[0]!.folderKey !== plan.rootFolderKey ||
    rootUnits[0]!.centerY !== 0
  )
    issues.push({
      path: '$.folderBandPlan.hierarchy.topLevelUnits',
      message:
        'The root exact folder must remain one independent central band.',
    });
  for (const [index, unit] of hierarchy.topLevelUnits.entries()) {
    if (
      unit.order !== index ||
      !Number.isFinite(unit.topY) ||
      !Number.isFinite(unit.bottomY) ||
      unit.topY >= unit.bottomY ||
      Math.abs(unit.bottomY - unit.topY - unit.height) > EPSILON ||
      (index > 0 &&
        hierarchy.topLevelUnits[index - 1]!.bottomY >= unit.topY - EPSILON)
    )
      issues.push({
        path: '$.folderBandPlan.hierarchy.topLevelUnits',
        message: `Top-level unit "${unit.id}" has invalid or overlapping geometry.`,
      });
  }
  const parentById = new Map(
    hierarchy.parentContainers.map((parent) => [parent.id, parent]),
  );
  const internalById = new Map(
    hierarchy.internalUnits.map((unit) => [unit.id, unit]),
  );
  for (const parent of hierarchy.parentContainers) {
    const top = hierarchy.topLevelUnits.find(({ id }) => id === parent.id);
    const internals = parent.internalUnitIds.map((id) => internalById.get(id));
    if (
      top?.kind !== 'parent-container' ||
      parent.folderKey === plan.rootFolderKey ||
      parent.label !== shortFolderLabel(parent.folderKey) ||
      parent.fullLabel !== parent.folderKey ||
      internals.some((unit) => unit === undefined) ||
      internals.length < 2
    )
      issues.push({
        path: '$.folderBandPlan.hierarchy.parentContainers',
        message: `Parent container "${parent.id}" has invalid ownership or labels.`,
      });
    const concrete = internals.filter(
      (unit): unit is FocusSchematicDirectionalInternalUnit =>
        unit !== undefined,
    );
    for (const [index, internal] of concrete.entries()) {
      if (
        internal.parentContainerId !== parent.id ||
        internal.order !== index ||
        internal.topY < parent.topY - EPSILON ||
        internal.bottomY > parent.bottomY + EPSILON ||
        internal.x < parent.x - EPSILON ||
        internal.x + internal.width > parent.x + parent.width + EPSILON ||
        (internal.kind === 'direct-parent' && internal.label !== null) ||
        (internal.kind === 'child-band' &&
          internal.label !== shortFolderLabel(internal.folderKey)) ||
        (index > 0 && concrete[index - 1]!.bottomY >= internal.topY - EPSILON)
      )
        issues.push({
          path: '$.folderBandPlan.hierarchy.internalUnits',
          message: `Internal unit "${internal.id}" escapes or overlaps its parent.`,
        });
    }
  }
  const seen = new Set<string>();
  for (const placement of hierarchy.modulePlacements) {
    const module = modelById.get(placement.moduleId);
    const rectangle = candidateById.get(placement.moduleId);
    const top = hierarchy.topLevelUnits.find(
      ({ id }) => id === placement.displayUnitId,
    );
    const internal = internalById.get(placement.displayUnitId);
    const owner = internal ?? top;
    const parent =
      placement.parentContainerId === null
        ? undefined
        : parentById.get(placement.parentContainerId);
    const ownerRectangle =
      owner === undefined
        ? undefined
        : {
            x:
              'x' in owner
                ? owner.x
                : (rectangle?.x ?? Number.POSITIVE_INFINITY),
            width:
              'width' in owner
                ? owner.width
                : (rectangle?.width ?? Number.NEGATIVE_INFINITY),
            topY: owner.topY,
            bottomY: owner.bottomY,
          };
    if (
      seen.has(placement.moduleId) ||
      module === undefined ||
      module.presentation === 'filtered' ||
      module.folderKey !== placement.exactFolderKey ||
      rectangle === undefined ||
      owner === undefined ||
      ownerRectangle === undefined ||
      !rectangleInside(rectangle, ownerRectangle) ||
      (parent !== undefined && !rectangleInside(rectangle, parent)) ||
      (placement.parentContainerId !== null && parent === undefined) ||
      rankById.get(placement.moduleId) === undefined
    )
      issues.push({
        path: '$.folderBandPlan.hierarchy.modulePlacements',
        message: `Nested placement "${placement.moduleId}" is ambiguous or outside its hierarchy.`,
      });
    seen.add(placement.moduleId);
  }
  if (
    seen.size !== visibleModules.length ||
    visibleModules.some(({ id }) => !seen.has(id)) ||
    plan.exceptions.length !== 0 ||
    plan.modulePlacements.some(
      ({ status, exceptionId, distanceToOwnBand }) =>
        status !== 'inside-own-band' ||
        exceptionId !== null ||
        distanceToOwnBand !== 0,
    )
  )
    issues.push({
      path: '$.folderBandPlan.hierarchy.modulePlacements',
      message:
        'Every visible File must have exactly one contained placement and no topology exception.',
    });
  const expectedExactFolders = new Set(
    visibleModules.map(({ folderKey }) => folderKey),
  );
  if (
    hierarchy.summary.visibleExactFolderCount !== expectedExactFolders.size ||
    hierarchy.summary.parentContainerCount !==
      hierarchy.parentContainers.length ||
    hierarchy.summary.childBandCount !==
      hierarchy.internalUnits.filter(({ kind }) => kind === 'child-band')
        .length ||
    hierarchy.summary.standaloneBandCount !==
      hierarchy.topLevelUnits.filter(({ kind }) => kind === 'standalone-band')
        .length ||
    hierarchy.summary.topLevelOrderingCandidateCount < 1 ||
    hierarchy.summary.parentLocalOrderingSweepCount < 0 ||
    hierarchy.summary.parentLocalOrderingChangeCount !==
      hierarchy.parentContainers.filter(
        ({ initialInternalUnitIds, internalUnitIds }) =>
          JSON.stringify(initialInternalUnitIds) !==
          JSON.stringify(internalUnitIds),
      ).length
  )
    issues.push({
      path: '$.folderBandPlan.hierarchy.summary',
      message: 'Nested Directional hierarchy summary is inconsistent.',
    });
  const rootRectangle = candidateById.get(input.model.rootModuleId);
  if (rootRectangle === undefined || centerY(rootRectangle) !== 0)
    issues.push({
      path: '$.candidate.modules',
      message: 'Nested Directional geometry moved the Focus root anchor.',
    });
  return issues.length === 0
    ? { valid: true, value: plan, issues: [] }
    : { valid: false, issues };
}

export function validateFocusSchematicNestedDirectionalGeometry(
  input: FocusSchematicLayoutInput,
  baseline: FocusSchematicLayoutCandidate,
  candidate: FocusSchematicLayoutCandidate,
): FocusSchematicEndpointValidationResult<FocusSchematicLayoutCandidate> {
  const baselineModules = new Map(
    baseline.modules.map((module) => [module.moduleId, module]),
  );
  const baselineNodes = new Map(
    baseline.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const candidateModules = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const issues: { readonly path: string; readonly message: string }[] = [];
  for (const [moduleId, before] of baselineModules) {
    const after = candidateModules.get(moduleId);
    if (
      after === undefined ||
      after.x !== before.x ||
      after.width !== before.width ||
      after.height !== before.height
    )
      issues.push({
        path: '$.candidate.modules',
        message: `Nested folder packing changed X or dimensions for "${moduleId}".`,
      });
  }
  for (const node of candidate.nodes) {
    const before = baselineNodes.get(node.projectionNodeId);
    const beforeModule =
      before === undefined ? undefined : baselineModules.get(before.moduleId);
    const afterModule = candidateModules.get(node.moduleId);
    if (
      before === undefined ||
      beforeModule === undefined ||
      afterModule === undefined ||
      node.x !== before.x ||
      node.width !== before.width ||
      node.height !== before.height ||
      node.x - afterModule.x !== before.x - beforeModule.x ||
      node.y - afterModule.y !== before.y - beforeModule.y
    )
      issues.push({
        path: '$.candidate.nodes',
        message: `Nested folder packing changed File-internal geometry for "${node.projectionNodeId}".`,
      });
  }
  if (JSON.stringify(candidate.routes) !== JSON.stringify(baseline.routes))
    issues.push({
      path: '$.candidate.routes',
      message: 'Nested Directional Bands cannot create or alter routes.',
    });
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
        'Nested Directional packing produced invalid or overlapping geometry.',
    });
  return issues.length === 0
    ? { valid: true, value: candidate, issues: [] }
    : { valid: false, issues };
}
