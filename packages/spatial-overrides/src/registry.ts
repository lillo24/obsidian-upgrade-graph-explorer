import type { WorkspaceId } from '@icarus-graph-explorer/core';

import { isNormalizedWorkspaceFolderKey } from './folder-key';
import { normalizeExcludedSubtrees } from './scope';
import {
  NORMALIZED_FOLDER_ANCHOR_RANGE,
  SPATIAL_OVERRIDE_SCHEMA_VERSION,
  type FolderClusterAnchorMap,
  type FolderSpatialBehavior,
  type FolderSpatialRule,
  type FolderSpatialScope,
  type NormalizedFolderAnchor,
  type SpatialOverrideRegistry,
  type WorkspaceFolderKey,
} from './types';

const LEGACY_SPATIAL_OVERRIDE_SCHEMA_VERSION = 1 as const;

export type SpatialOverrideValidationResult =
  | { readonly ok: true; readonly value: SpatialOverrideRegistry }
  | { readonly ok: false; readonly message: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactFields(
  value: Record<string, unknown>,
  expected: string,
): boolean {
  return Object.keys(value).sort().join(',') === expected;
}

export function isValidNormalizedFolderAnchor(
  value: unknown,
): value is NormalizedFolderAnchor {
  if (!record(value) || !exactFields(value, 'x,y')) return false;
  return [value.x, value.y].every(
    (coordinate) =>
      typeof coordinate === 'number' &&
      Number.isFinite(coordinate) &&
      coordinate >= NORMALIZED_FOLDER_ANCHOR_RANGE.min &&
      coordinate <= NORMALIZED_FOLDER_ANCHOR_RANGE.max,
  );
}

export function isValidFolderPullStrength(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= 100
  );
}

function cloneScope(
  folderKey: WorkspaceFolderKey,
  scope: FolderSpatialScope,
): FolderSpatialScope {
  if (scope.kind === 'exact') return Object.freeze({ kind: 'exact' });
  return Object.freeze({
    kind: 'subtree',
    includeRootFiles: scope.includeRootFiles,
    excludedSubtrees: normalizeExcludedSubtrees(
      folderKey,
      scope.excludedSubtrees,
    ),
  });
}

function cloneRule(rule: FolderSpatialRule): FolderSpatialRule {
  return Object.freeze({
    folderKey: rule.folderKey,
    behavior: rule.behavior,
    scope: cloneScope(rule.folderKey, rule.scope),
    anchor: Object.freeze({ x: rule.anchor.x, y: rule.anchor.y }),
    ...(rule.behavior === 'pull' ? { strength: rule.strength } : {}),
  });
}

function immutableRegistry(
  workspaceId: WorkspaceId,
  folderRules: readonly FolderSpatialRule[],
): SpatialOverrideRegistry {
  return Object.freeze({
    schemaVersion: SPATIAL_OVERRIDE_SCHEMA_VERSION,
    workspaceId,
    allNetwork: Object.freeze({
      folderRules: Object.freeze(
        [...folderRules]
          .sort((left, right) => left.folderKey.localeCompare(right.folderKey))
          .map(cloneRule),
      ),
    }),
  });
}

function parseScope(
  value: unknown,
  folderKey: WorkspaceFolderKey,
  index: number,
): FolderSpatialScope | string {
  if (!record(value) || typeof value.kind !== 'string') {
    return `Folder rule ${index + 1} needs a spatial scope.`;
  }
  if (value.kind === 'exact') {
    return exactFields(value, 'kind')
      ? { kind: 'exact' }
      : `Folder rule ${index + 1} exact scope has incompatible fields.`;
  }
  if (
    value.kind !== 'subtree' ||
    !exactFields(value, 'excludedSubtrees,includeRootFiles,kind') ||
    typeof value.includeRootFiles !== 'boolean' ||
    !Array.isArray(value.excludedSubtrees)
  ) {
    return `Folder rule ${index + 1} subtree scope has incompatible fields.`;
  }
  if (!value.excludedSubtrees.every((entry) => typeof entry === 'string')) {
    return `Folder rule ${index + 1} exclusions need normalized folder keys.`;
  }
  try {
    return {
      kind: 'subtree',
      includeRootFiles: value.includeRootFiles,
      excludedSubtrees: normalizeExcludedSubtrees(
        folderKey,
        value.excludedSubtrees,
      ),
    };
  } catch (error: unknown) {
    return `Folder rule ${index + 1} has invalid exclusions: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function parseV2Rules(
  value: Record<string, unknown>,
): readonly FolderSpatialRule[] | string {
  if (
    !record(value.allNetwork) ||
    !exactFields(value.allNetwork, 'folderRules')
  ) {
    return 'All Network spatial override fields are incompatible.';
  }
  if (!Array.isArray(value.allNetwork.folderRules)) {
    return 'Expected an All Network folder-rule array.';
  }
  const folderRules: FolderSpatialRule[] = [];
  const seen = new Set<string>();
  for (const [index, candidate] of value.allNetwork.folderRules.entries()) {
    if (!record(candidate))
      return `Folder rule ${index + 1} must be an object.`;
    const behavior = candidate.behavior;
    const fields =
      behavior === 'pull'
        ? 'anchor,behavior,folderKey,scope,strength'
        : 'anchor,behavior,folderKey,scope';
    if (
      (behavior !== 'pull' && behavior !== 'place') ||
      !exactFields(candidate, fields)
    ) {
      return `Folder rule ${index + 1} has incompatible fields.`;
    }
    if (!isNormalizedWorkspaceFolderKey(candidate.folderKey)) {
      return `Folder rule ${index + 1} needs a normalized workspace-relative folder key.`;
    }
    if (seen.has(candidate.folderKey)) {
      return `Duplicate spatial rule for folder ${JSON.stringify(candidate.folderKey)}.`;
    }
    if (!isValidNormalizedFolderAnchor(candidate.anchor)) {
      return `Folder rule ${index + 1} needs finite x/y coordinates from ${NORMALIZED_FOLDER_ANCHOR_RANGE.min} to ${NORMALIZED_FOLDER_ANCHOR_RANGE.max}.`;
    }
    if (behavior === 'pull' && !isValidFolderPullStrength(candidate.strength)) {
      return `Folder rule ${index + 1} pull strength must be an integer from 0 to 100.`;
    }
    const scope = parseScope(candidate.scope, candidate.folderKey, index);
    if (typeof scope === 'string') return scope;
    seen.add(candidate.folderKey);
    folderRules.push({
      folderKey: candidate.folderKey,
      behavior,
      scope,
      anchor: { x: candidate.anchor.x, y: candidate.anchor.y },
      ...(behavior === 'pull'
        ? { strength: candidate.strength as number }
        : {}),
    });
  }
  return folderRules;
}

function migrateV1Rules(
  value: Record<string, unknown>,
): readonly FolderSpatialRule[] | string {
  if (
    !record(value.allNetwork) ||
    !exactFields(value.allNetwork, 'folderAnchors')
  ) {
    return 'Legacy All Network spatial override fields are incompatible.';
  }
  if (!Array.isArray(value.allNetwork.folderAnchors)) {
    return 'Expected a legacy All Network folder-anchor array.';
  }
  const rules: FolderSpatialRule[] = [];
  const seen = new Set<string>();
  for (const [index, candidate] of value.allNetwork.folderAnchors.entries()) {
    if (!record(candidate) || !exactFields(candidate, 'anchor,folderKey')) {
      return `Legacy folder anchor ${index + 1} has incompatible fields.`;
    }
    if (!isNormalizedWorkspaceFolderKey(candidate.folderKey)) {
      return `Legacy folder anchor ${index + 1} needs a normalized workspace-relative folder key.`;
    }
    if (seen.has(candidate.folderKey)) {
      return `Duplicate legacy spatial override for folder ${JSON.stringify(candidate.folderKey)}.`;
    }
    if (!isValidNormalizedFolderAnchor(candidate.anchor)) {
      return `Legacy folder anchor ${index + 1} has invalid coordinates.`;
    }
    seen.add(candidate.folderKey);
    rules.push({
      folderKey: candidate.folderKey,
      behavior: 'place',
      scope: { kind: 'exact' },
      anchor: { x: candidate.anchor.x, y: candidate.anchor.y },
    });
  }
  return rules;
}

export function validateSpatialOverrideRegistry(
  value: unknown,
  expectedWorkspaceId?: string,
): SpatialOverrideValidationResult {
  if (
    !record(value) ||
    !exactFields(value, 'allNetwork,schemaVersion,workspaceId')
  ) {
    return {
      ok: false,
      message: 'Spatial override registry fields are incompatible.',
    };
  }
  if (
    value.schemaVersion !== SPATIAL_OVERRIDE_SCHEMA_VERSION &&
    value.schemaVersion !== LEGACY_SPATIAL_OVERRIDE_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      message: 'Unsupported spatial override schema version.',
    };
  }
  if (typeof value.workspaceId !== 'string' || value.workspaceId.length === 0) {
    return { ok: false, message: 'Expected a non-empty workspace ID.' };
  }
  if (
    expectedWorkspaceId !== undefined &&
    value.workspaceId !== expectedWorkspaceId
  ) {
    return {
      ok: false,
      message: `Spatial overrides belong to workspace ${JSON.stringify(value.workspaceId)}, not ${JSON.stringify(expectedWorkspaceId)}.`,
    };
  }
  const rules =
    value.schemaVersion === LEGACY_SPATIAL_OVERRIDE_SCHEMA_VERSION
      ? migrateV1Rules(value)
      : parseV2Rules(value);
  return typeof rules === 'string'
    ? { ok: false, message: rules }
    : { ok: true, value: immutableRegistry(value.workspaceId, rules) };
}

function validated(
  value: unknown,
  expectedWorkspaceId?: string,
): SpatialOverrideRegistry {
  const result = validateSpatialOverrideRegistry(value, expectedWorkspaceId);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

export function createEmptySpatialOverrideRegistry(
  workspaceId: WorkspaceId,
): SpatialOverrideRegistry {
  return validated({
    schemaVersion: SPATIAL_OVERRIDE_SCHEMA_VERSION,
    workspaceId,
    allNetwork: { folderRules: [] },
  });
}

export function setFolderSpatialRule(
  registry: SpatialOverrideRegistry,
  rule: FolderSpatialRule,
): SpatialOverrideRegistry {
  const current = validated(registry);
  return validated({
    ...current,
    allNetwork: {
      folderRules: [
        ...current.allNetwork.folderRules.filter(
          (entry) => entry.folderKey !== rule.folderKey,
        ),
        rule,
      ],
    },
  });
}

export function removeFolderSpatialRule(
  registry: SpatialOverrideRegistry,
  folderKey: WorkspaceFolderKey,
): SpatialOverrideRegistry {
  if (!isNormalizedWorkspaceFolderKey(folderKey)) {
    throw new Error('Reset folder needs a normalized workspace folder key.');
  }
  const current = validated(registry);
  return immutableRegistry(
    current.workspaceId,
    current.allNetwork.folderRules.filter(
      (rule) => rule.folderKey !== folderKey,
    ),
  );
}

export function clearFolderSpatialRules(
  registry: SpatialOverrideRegistry,
): SpatialOverrideRegistry {
  return immutableRegistry(validated(registry).workspaceId, []);
}

function existingRule(
  registry: SpatialOverrideRegistry,
  folderKey: WorkspaceFolderKey,
): FolderSpatialRule {
  const rule = validated(registry).allNetwork.folderRules.find(
    (candidate) => candidate.folderKey === folderKey,
  );
  if (rule === undefined) {
    throw new Error(
      `No spatial rule exists for folder ${JSON.stringify(folderKey)}.`,
    );
  }
  return rule;
}

export function setFolderSpatialBehavior(
  registry: SpatialOverrideRegistry,
  folderKey: WorkspaceFolderKey,
  behavior: FolderSpatialBehavior,
  strength?: number,
): SpatialOverrideRegistry {
  const rule = existingRule(registry, folderKey);
  if (behavior === 'pull') {
    if (strength === undefined) {
      throw new Error('Changing a rule to pull requires an explicit strength.');
    }
    return setFolderSpatialRule(registry, { ...rule, behavior, strength });
  }
  return setFolderSpatialRule(registry, {
    folderKey: rule.folderKey,
    scope: rule.scope,
    anchor: rule.anchor,
    behavior,
  });
}

export function setFolderSpatialScope(
  registry: SpatialOverrideRegistry,
  folderKey: WorkspaceFolderKey,
  scope: FolderSpatialScope,
): SpatialOverrideRegistry {
  return setFolderSpatialRule(registry, {
    ...existingRule(registry, folderKey),
    scope,
  });
}

export function setFolderSpatialTarget(
  registry: SpatialOverrideRegistry,
  folderKey: WorkspaceFolderKey,
  anchor: NormalizedFolderAnchor,
): SpatialOverrideRegistry {
  return setFolderSpatialRule(registry, {
    ...existingRule(registry, folderKey),
    anchor,
  });
}

export function setFolderPullStrength(
  registry: SpatialOverrideRegistry,
  folderKey: WorkspaceFolderKey,
  strength: number,
): SpatialOverrideRegistry {
  const rule = existingRule(registry, folderKey);
  if (rule.behavior !== 'pull') {
    throw new Error('Pull strength can only be set on a dynamic-pull rule.');
  }
  return setFolderSpatialRule(registry, { ...rule, strength });
}

/** Compatibility API: Arrange writes place/exact and replaces any same-root rule. */
export function setFolderClusterAnchor(
  registry: SpatialOverrideRegistry,
  folderKey: WorkspaceFolderKey,
  anchor: NormalizedFolderAnchor,
): SpatialOverrideRegistry {
  return setFolderSpatialRule(registry, {
    folderKey,
    behavior: 'place',
    scope: { kind: 'exact' },
    anchor,
  });
}

/** Compatibility API: resets only a place/exact rule. */
export function removeFolderClusterAnchor(
  registry: SpatialOverrideRegistry,
  folderKey: WorkspaceFolderKey,
): SpatialOverrideRegistry {
  if (!isNormalizedWorkspaceFolderKey(folderKey)) {
    throw new Error('Reset folder needs a normalized workspace folder key.');
  }
  const current = validated(registry);
  return immutableRegistry(
    current.workspaceId,
    current.allNetwork.folderRules.filter(
      (rule) =>
        rule.folderKey !== folderKey ||
        rule.behavior !== 'place' ||
        rule.scope.kind !== 'exact',
    ),
  );
}

/** Compatibility API: clears place/exact rules without deleting other intent. */
export function clearFolderClusterAnchors(
  registry: SpatialOverrideRegistry,
): SpatialOverrideRegistry {
  const current = validated(registry);
  return immutableRegistry(
    current.workspaceId,
    current.allNetwork.folderRules.filter(
      (rule) => rule.behavior !== 'place' || rule.scope.kind !== 'exact',
    ),
  );
}

export function serializeSpatialOverrideRegistry(
  registry: SpatialOverrideRegistry,
): string {
  return JSON.stringify(validated(registry));
}

/** Compatibility projection: place/exact rules only. */
export function folderClusterAnchorMap(
  registry: SpatialOverrideRegistry,
): FolderClusterAnchorMap {
  const current = validated(registry);
  return new Map(
    current.allNetwork.folderRules.flatMap((rule) =>
      rule.behavior === 'place' && rule.scope.kind === 'exact'
        ? [[rule.folderKey, rule.anchor] as const]
        : [],
    ),
  );
}

/** Creates a preview map without mutating persisted state; preview wins by key. */
export function mergeFolderClusterAnchorMaps(
  persisted: FolderClusterAnchorMap,
  preview: FolderClusterAnchorMap,
): FolderClusterAnchorMap {
  return new Map([...persisted, ...preview]);
}
