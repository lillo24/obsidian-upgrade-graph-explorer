import { folderDepth, folderScopeIncludesFolder } from './scope';
import type {
  FolderSpatialRule,
  ResolvedFolderSpatialGroup,
  ResolvedFolderSpatialRules,
} from './types';

function compareRules(
  left: FolderSpatialRule,
  right: FolderSpatialRule,
): number {
  const depth = folderDepth(right.folderKey) - folderDepth(left.folderKey);
  return depth !== 0 ? depth : left.folderKey.localeCompare(right.folderKey);
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
