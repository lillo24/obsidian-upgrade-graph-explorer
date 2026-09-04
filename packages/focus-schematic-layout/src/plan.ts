import type { EntityId } from '@icarus-graph-explorer/core';
import type {
  FocusSchematicModel,
  FocusSchematicParentCandidate,
} from '@icarus-graph-explorer/focus-schematic';

import type {
  FocusSchematicLayoutPlan,
  FocusSchematicLayoutPlanModule,
  FocusSchematicLayoutPlanValidationIssue,
  FocusSchematicLayoutPlanValidationResult,
} from './types';

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function candidateStrength(
  left: FocusSchematicParentCandidate,
  right: FocusSchematicParentCandidate,
): number {
  return (
    left.endpointSpecificity - right.endpointSpecificity ||
    left.referenceCount - right.referenceCount ||
    Number(left.sameFolder) - Number(right.sameFolder)
  );
}

function bestCandidate(
  candidates: readonly FocusSchematicParentCandidate[],
): FocusSchematicParentCandidate | undefined {
  return [...candidates].sort(
    (left, right) =>
      candidateStrength(right, left) ||
      compareText(left.parentModuleId, right.parentModuleId) ||
      compareText(left.relationshipId, right.relationshipId),
  )[0];
}

export function createFocusSchematicLayoutPlan(
  model: FocusSchematicModel,
): FocusSchematicLayoutPlan {
  const moduleById = new Map(
    model.modules.map((module) => [module.id, module]),
  );
  const assigned: FocusSchematicLayoutPlanModule[] = [
    {
      moduleId: model.rootModuleId,
      side: 'center',
      signedRank: 0,
      parentModuleId: null,
      parentRelationshipId: null,
    },
  ];
  const signedRankLoad = new Map<number, number>();
  const sideLoad = { left: 0, right: 0 };
  let arbitraryTieBreakCount = 0;

  const ordered = model.modules
    .filter(({ id }) => id !== model.rootModuleId)
    .sort(
      (left, right) =>
        left.placement.rankMagnitude - right.placement.rankMagnitude ||
        compareText(left.id, right.id),
    );

  for (const module of ordered) {
    const validCandidates = model.parentCandidates.filter((candidate) => {
      if (candidate.moduleId !== module.id) return false;
      const parent = moduleById.get(candidate.parentModuleId);
      return (
        parent !== undefined &&
        parent.placement.rankMagnitude === module.placement.rankMagnitude - 1
      );
    });
    let side = module.placement.preferredSide;
    let selected: FocusSchematicParentCandidate | undefined;
    if (side !== null) {
      selected =
        validCandidates.find((candidate) => candidate.selected) ??
        bestCandidate(
          validCandidates.filter((candidate) => candidate.side === side),
        );
    } else {
      const left = bestCandidate(
        validCandidates.filter((candidate) => candidate.side === 'left'),
      );
      const right = bestCandidate(
        validCandidates.filter((candidate) => candidate.side === 'right'),
      );
      if (left === undefined && right === undefined)
        throw new Error(
          `Equal-mutual module "${module.id}" has no valid parent candidate.`,
        );
      if (left === undefined) {
        side = 'right';
        selected = right;
      } else if (right === undefined) {
        side = 'left';
        selected = left;
      } else {
        const strength = candidateStrength(left, right);
        if (strength !== 0) {
          side = strength > 0 ? 'left' : 'right';
        } else {
          const leftRankLoad =
            signedRankLoad.get(-module.placement.rankMagnitude) ?? 0;
          const rightRankLoad =
            signedRankLoad.get(module.placement.rankMagnitude) ?? 0;
          if (leftRankLoad !== rightRankLoad) {
            side = leftRankLoad < rightRankLoad ? 'left' : 'right';
          } else {
            const folderContinuity = (candidateSide: 'left' | 'right') =>
              assigned.filter(
                (item) =>
                  item.side === candidateSide &&
                  moduleById.get(item.moduleId)?.folderKey === module.folderKey,
              ).length;
            const leftContinuity = folderContinuity('left');
            const rightContinuity = folderContinuity('right');
            if (leftContinuity !== rightContinuity) {
              side = leftContinuity > rightContinuity ? 'left' : 'right';
            } else if (sideLoad.left !== sideLoad.right) {
              side = sideLoad.left < sideLoad.right ? 'left' : 'right';
            } else {
              arbitraryTieBreakCount += 1;
              side =
                compareText(`${module.id}:left`, `${module.id}:right`) <= 0
                  ? 'left'
                  : 'right';
            }
          }
        }
        selected = side === 'left' ? left : right;
      }
    }
    if ((side !== 'left' && side !== 'right') || selected === undefined)
      throw new Error(`Module "${module.id}" has no selected layout parent.`);
    const chosenSide: 'left' | 'right' = side;
    const signedRank = (
      chosenSide === 'left'
        ? -module.placement.rankMagnitude
        : module.placement.rankMagnitude
    ) as FocusSchematicLayoutPlanModule['signedRank'];
    assigned.push({
      moduleId: module.id,
      side: chosenSide,
      signedRank,
      parentModuleId: selected.parentModuleId,
      parentRelationshipId: selected.relationshipId,
    });
    signedRankLoad.set(signedRank, (signedRankLoad.get(signedRank) ?? 0) + 1);
    sideLoad[chosenSide] += 1;
  }

  const plan: FocusSchematicLayoutPlan = {
    schemaVersion: 1,
    rootModuleId: model.rootModuleId,
    modules: assigned.sort(
      (left, right) =>
        left.signedRank - right.signedRank ||
        compareText(left.moduleId, right.moduleId),
    ),
    arbitraryTieBreakCount,
  };
  const validation = validateFocusSchematicLayoutPlan(model, plan);
  if (!validation.valid)
    throw new Error(
      `Invalid Focus Schematic layout plan: ${validation.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    );
  return plan;
}

function exactKeys(value: unknown, keys: readonly string[]): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).sort(compareText).join('|') ===
      [...keys].sort(compareText).join('|')
  );
}

export function validateFocusSchematicLayoutPlan(
  model: FocusSchematicModel,
  value: unknown,
): FocusSchematicLayoutPlanValidationResult {
  const issues: FocusSchematicLayoutPlanValidationIssue[] = [];
  if (
    !exactKeys(value, [
      'schemaVersion',
      'rootModuleId',
      'modules',
      'arbitraryTieBreakCount',
    ])
  )
    return {
      valid: false,
      issues: [{ path: '$', message: 'Plan shape is invalid.' }],
    };
  const plan = value as FocusSchematicLayoutPlan;
  if (
    plan.schemaVersion !== 1 ||
    plan.rootModuleId !== model.rootModuleId ||
    !Array.isArray(plan.modules) ||
    !Number.isInteger(plan.arbitraryTieBreakCount) ||
    plan.arbitraryTieBreakCount < 0
  )
    return {
      valid: false,
      issues: [{ path: '$', message: 'Plan header is invalid.' }],
    };
  const modelById = new Map(model.modules.map((module) => [module.id, module]));
  const relationshipById = new Map(
    model.relationships.map((relationship) => [relationship.id, relationship]),
  );
  const planById = new Map<EntityId, FocusSchematicLayoutPlanModule>();
  plan.modules.forEach((item, index) => {
    if (
      !exactKeys(item, [
        'moduleId',
        'side',
        'signedRank',
        'parentModuleId',
        'parentRelationshipId',
      ])
    ) {
      issues.push({
        path: `$.modules[${index}]`,
        message: 'Plan module shape is invalid.',
      });
      return;
    }
    if (planById.has(item.moduleId))
      issues.push({
        path: '$.modules',
        message: `Duplicate module "${item.moduleId}".`,
      });
    planById.set(item.moduleId, item);
    const semantic = modelById.get(item.moduleId);
    if (semantic === undefined) {
      issues.push({ path: `$.modules[${index}]`, message: 'Unknown module.' });
      return;
    }
    if (item.moduleId === model.rootModuleId) {
      if (
        item.side !== 'center' ||
        item.signedRank !== 0 ||
        item.parentModuleId !== null ||
        item.parentRelationshipId !== null
      )
        issues.push({
          path: `$.modules[${index}]`,
          message: 'Root plan entry is invalid.',
        });
      return;
    }
    if (
      !['left', 'right'].includes(item.side) ||
      item.signedRank === 0 ||
      Math.abs(item.signedRank) !== semantic.placement.rankMagnitude ||
      Math.sign(item.signedRank) !== (item.side === 'left' ? -1 : 1) ||
      item.parentModuleId === null ||
      item.parentRelationshipId === null
    )
      issues.push({
        path: `$.modules[${index}]`,
        message: 'Side/rank/parent is invalid.',
      });
    const parent =
      item.parentModuleId === null
        ? undefined
        : modelById.get(item.parentModuleId);
    if (
      parent === undefined ||
      parent.placement.rankMagnitude !== semantic.placement.rankMagnitude - 1
    )
      issues.push({
        path: `$.modules[${index}].parentModuleId`,
        message: 'Parent must be one rank nearer root.',
      });
    const relationship =
      item.parentRelationshipId === null
        ? undefined
        : relationshipById.get(item.parentRelationshipId);
    if (
      relationship === undefined ||
      !model.parentCandidates.some(
        (candidate) =>
          candidate.moduleId === item.moduleId &&
          candidate.side === item.side &&
          candidate.parentModuleId === item.parentModuleId &&
          candidate.relationshipId === item.parentRelationshipId,
      )
    )
      issues.push({
        path: `$.modules[${index}].parentRelationshipId`,
        message: 'Parent relationship is not a HIER1 candidate.',
      });
  });
  for (const moduleId of modelById.keys())
    if (!planById.has(moduleId))
      issues.push({
        path: '$.modules',
        message: `Missing module "${moduleId}".`,
      });
  for (const item of plan.modules) {
    const visited = new Set<EntityId>();
    let cursor: FocusSchematicLayoutPlanModule | undefined = item;
    while (cursor !== undefined && cursor.parentModuleId !== null) {
      const current = cursor;
      if (visited.has(current.moduleId)) {
        issues.push({
          path: '$.modules',
          message: `Parent cycle includes "${current.moduleId}".`,
        });
        break;
      }
      visited.add(current.moduleId);
      const parentModuleId = current.parentModuleId;
      if (parentModuleId === null) break;
      cursor = planById.get(parentModuleId);
    }
  }
  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, value: plan, issues: [] };
}
