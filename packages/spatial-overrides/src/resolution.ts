import {
  folderDepth,
  folderScopeIncludesFolder,
  isFolderDescendantOf,
} from './scope';
import type {
  FolderScopeVisualization,
  FolderScopeVisualizationState,
  FolderSpatialRule,
  ResolvedFolderSpatialGroup,
  ResolvedFolderSpatialRules,
  WorkspaceFolderKey,
} from './types';

function compareRules(
  left: FolderSpatialRule,
  right: FolderSpatialRule,
): number {
  const depth = folderDepth(right.folderKey) - folderDepth(left.folderKey);
  return depth !== 0 ? depth : left.folderKey.localeCompare(right.folderKey);
}

/**
 * Resolves a transient same-root draft against confirmed child rules and emits
 * renderer-only scope classifications. The draft never enters persistence.
 */
export function classifyFolderSpatialDraftScope({
  confirmedRules,
  draftRule,
  folderKeyByNodeKey,
}: {
  readonly confirmedRules: readonly FolderSpatialRule[];
  readonly draftRule: FolderSpatialRule;
  readonly folderKeyByNodeKey: ReadonlyMap<string, string>;
}): FolderScopeVisualization {
  const effectiveRules = [
    ...confirmedRules.filter((rule) => rule.folderKey !== draftRule.folderKey),
    draftRule,
  ];
  const resolved = resolveFolderSpatialRules({
    rules: effectiveRules,
    folderKeyByNodeKey,
  });
  const byState: Record<FolderScopeVisualizationState, string[]> = {
    'active-member': [],
    'excluded-candidate': [],
    'shadowed-by-child': [],
    'outside-root': [],
  };
  const stateByNodeKey = new Map<string, FolderScopeVisualizationState>();
  const owningRuleFolderKeyByNodeKey = new Map<string, WorkspaceFolderKey>();
  for (const [nodeKey, folderKey] of [...folderKeyByNodeKey].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const winner = resolved.winningRuleByNodeKey.get(nodeKey);
    const state: FolderScopeVisualizationState =
      winner !== undefined &&
      winner.folderKey !== draftRule.folderKey &&
      isFolderDescendantOf(winner.folderKey, draftRule.folderKey)
        ? 'shadowed-by-child'
        : folderKey === draftRule.folderKey ||
            isFolderDescendantOf(folderKey, draftRule.folderKey)
          ? winner?.folderKey === draftRule.folderKey
            ? 'active-member'
            : 'excluded-candidate'
          : 'outside-root';
    stateByNodeKey.set(nodeKey, state);
    if (winner !== undefined) {
      owningRuleFolderKeyByNodeKey.set(nodeKey, winner.folderKey);
    }
    byState[state].push(nodeKey);
  }
  return Object.freeze({
    stateByNodeKey,
    owningRuleFolderKeyByNodeKey,
    activeMemberNodeKeys: Object.freeze(byState['active-member']),
    excludedCandidateNodeKeys: Object.freeze(byState['excluded-candidate']),
    shadowedByChildNodeKeys: Object.freeze(byState['shadowed-by-child']),
    outsideRootNodeKeys: Object.freeze(byState['outside-root']),
  });
}

export function resolveFolderSpatialRules({
  rules,
  folderKeyByNodeKey,
}: {
  readonly rules: readonly FolderSpatialRule[];
  readonly folderKeyByNodeKey: ReadonlyMap<string, string>;
}): ResolvedFolderSpatialRules {
  const sortedRules = [...rules].sort(compareRules);
  const members = new Map<string, string[]>();
  const winningRuleByNodeKey = new Map<string, FolderSpatialRule>();
  for (const [nodeKey, folderKey] of [...folderKeyByNodeKey].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const winner = sortedRules.find((rule) =>
      folderScopeIncludesFolder(rule.folderKey, rule.scope, folderKey),
    );
    if (winner === undefined) continue;
    winningRuleByNodeKey.set(nodeKey, winner);
    const group = members.get(winner.folderKey) ?? [];
    group.push(nodeKey);
    members.set(winner.folderKey, group);
  }
  const pullGroups: ResolvedFolderSpatialGroup[] = [];
  const placeGroups: ResolvedFolderSpatialGroup[] = [];
  const inactiveRules = [];
  const membershipCountByRuleFolderKey = new Map<string, number>();
  for (const rule of [...rules].sort((left, right) =>
    left.folderKey.localeCompare(right.folderKey),
  )) {
    const memberNodeKeys = Object.freeze([
      ...(members.get(rule.folderKey) ?? []),
    ]);
    membershipCountByRuleFolderKey.set(rule.folderKey, memberNodeKeys.length);
    if (memberNodeKeys.length === 0) {
      inactiveRules.push({ rule, reason: 'no-visible-members' as const });
      continue;
    }
    const group = { rule, memberNodeKeys };
    if (rule.behavior === 'pull') pullGroups.push(group);
    else placeGroups.push(group);
  }
  return {
    pullGroups: Object.freeze(pullGroups),
    placeGroups: Object.freeze(placeGroups),
    inactiveRules: Object.freeze(inactiveRules),
    winningRuleByNodeKey,
    membershipCountByRuleFolderKey,
  };
}
