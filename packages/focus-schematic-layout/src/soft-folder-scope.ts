import {
  isNormalizedWorkspaceFolderKey,
  workspaceFolderKeyContainsFolder,
  type WorkspaceFolderKey,
} from '@icarus-graph-explorer/core';
import type { FocusSchematicSoftFolderScopeOverride } from './types';

export type FocusSchematicSoftFolderScopeValidationResult =
  | {
      readonly valid: true;
      readonly value: readonly FocusSchematicSoftFolderScopeOverride[];
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly {
        readonly path: string;
        readonly message: string;
      }[];
    };

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Returns the normalized parent, or null when the group is workspace root. */
export function focusSchematicParentFolderKey(
  folderKey: WorkspaceFolderKey,
): WorkspaceFolderKey | null {
  if (!isNormalizedWorkspaceFolderKey(folderKey))
    throw new Error(
      `Invalid workspace folder key ${JSON.stringify(folderKey)}.`,
    );
  if (folderKey === '.') return null;
  const separator = folderKey.lastIndexOf('/');
  return separator < 0 ? '.' : folderKey.slice(0, separator);
}

/** Strict sparse-rule validation with canonical exact-folder ordering. */
export function validateFocusSchematicSoftFolderScopeOverrides(
  value: unknown,
): FocusSchematicSoftFolderScopeValidationResult {
  if (!Array.isArray(value))
    return {
      valid: false,
      issues: [
        { path: '$', message: 'Soft folder scope overrides must be an array.' },
      ],
    };
  const issues: { path: string; message: string }[] = [];
  const overrides: FocusSchematicSoftFolderScopeOverride[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const path = `$[${index}]`;
    if (
      !isPlainRecord(item) ||
      Object.keys(item).sort(compareText).join('|') !==
        'exactFolderKey|spatialGroupKey'
    ) {
      issues.push({ path, message: 'Override fields are invalid.' });
      return;
    }
    const { exactFolderKey, spatialGroupKey } = item;
    if (!isNormalizedWorkspaceFolderKey(exactFolderKey)) {
      issues.push({
        path: `${path}.exactFolderKey`,
        message: 'Exact folder key must be normalized and workspace-relative.',
      });
      return;
    }
    if (!isNormalizedWorkspaceFolderKey(spatialGroupKey)) {
      issues.push({
        path: `${path}.spatialGroupKey`,
        message: 'Spatial group key must be normalized and workspace-relative.',
      });
      return;
    }
    if (seen.has(exactFolderKey)) {
      issues.push({
        path: `${path}.exactFolderKey`,
        message: `Duplicate override for ${JSON.stringify(exactFolderKey)}.`,
      });
      return;
    }
    seen.add(exactFolderKey);
    if (exactFolderKey === spatialGroupKey) {
      issues.push({
        path,
        message: 'Identity overrides must be omitted from the sparse registry.',
      });
      return;
    }
    if (!workspaceFolderKeyContainsFolder(spatialGroupKey, exactFolderKey)) {
      issues.push({
        path: `${path}.spatialGroupKey`,
        message: 'Spatial group must be an ancestor of the exact folder.',
      });
      return;
    }
    overrides.push({ exactFolderKey, spatialGroupKey });
  });
  if (issues.length > 0) return { valid: false, issues };
  return {
    valid: true,
    value: overrides.sort((left, right) =>
      compareText(left.exactFolderKey, right.exactFolderKey),
    ),
    issues: [],
  };
}

export function canonicalFocusSchematicSoftFolderScopeOverrides(
  value: unknown,
): readonly FocusSchematicSoftFolderScopeOverride[] {
  const validation = validateFocusSchematicSoftFolderScopeOverrides(value);
  if (!validation.valid)
    throw new Error(
      `Invalid Soft folder scope overrides: ${validation.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    );
  return validation.value;
}

/** Drops rules for folders no longer present; no fuzzy rename migration occurs. */
export function reconcileFocusSchematicSoftFolderScopeOverrides(
  overrides: readonly FocusSchematicSoftFolderScopeOverride[],
  workspaceExactFolderKeys: readonly WorkspaceFolderKey[],
): readonly FocusSchematicSoftFolderScopeOverride[] {
  const canonical = canonicalFocusSchematicSoftFolderScopeOverrides(overrides);
  const available = new Set(
    workspaceExactFolderKeys.filter(isNormalizedWorkspaceFolderKey),
  );
  return canonical.filter(({ exactFolderKey }) =>
    available.has(exactFolderKey),
  );
}

export function resolveFocusSchematicSoftFolderGroup(
  exactFolderKey: WorkspaceFolderKey,
  overrides: readonly FocusSchematicSoftFolderScopeOverride[],
): WorkspaceFolderKey {
  if (!isNormalizedWorkspaceFolderKey(exactFolderKey))
    throw new Error(
      `Cannot resolve invalid exact folder key ${JSON.stringify(exactFolderKey)}.`,
    );
  return (
    overrides.find((item) => item.exactFolderKey === exactFolderKey)
      ?.spatialGroupKey ?? exactFolderKey
  );
}

/** Pre-indexes sparse rules for batch module/folder resolution. */
export function createFocusSchematicSoftFolderGroupResolver(
  overrides: readonly FocusSchematicSoftFolderScopeOverride[],
): (exactFolderKey: WorkspaceFolderKey) => WorkspaceFolderKey {
  const byExact = new Map(
    canonicalFocusSchematicSoftFolderScopeOverrides(overrides).map(
      ({ exactFolderKey, spatialGroupKey }) => [
        exactFolderKey,
        spatialGroupKey,
      ],
    ),
  );
  return (exactFolderKey) => {
    if (!isNormalizedWorkspaceFolderKey(exactFolderKey))
      throw new Error(
        `Cannot resolve invalid exact folder key ${JSON.stringify(exactFolderKey)}.`,
      );
    return byExact.get(exactFolderKey) ?? exactFolderKey;
  };
}

export interface FocusSchematicSoftFolderGroup {
  readonly spatialGroupKey: WorkspaceFolderKey;
  readonly exactFolderKeys: readonly WorkspaceFolderKey[];
}

export function groupFocusSchematicSoftFolders(
  workspaceExactFolderKeys: readonly WorkspaceFolderKey[],
  overrides: readonly FocusSchematicSoftFolderScopeOverride[],
): readonly FocusSchematicSoftFolderGroup[] {
  const canonical = reconcileFocusSchematicSoftFolderScopeOverrides(
    overrides,
    workspaceExactFolderKeys,
  );
  const resolveGroup = createFocusSchematicSoftFolderGroupResolver(canonical);
  const groups = new Map<WorkspaceFolderKey, WorkspaceFolderKey[]>();
  for (const exactFolderKey of [
    ...new Set(workspaceExactFolderKeys.filter(isNormalizedWorkspaceFolderKey)),
  ].sort(compareText)) {
    const spatialGroupKey = resolveGroup(exactFolderKey);
    const exact = groups.get(spatialGroupKey) ?? [];
    exact.push(exactFolderKey);
    groups.set(spatialGroupKey, exact);
  }
  return [...groups]
    .sort(([left], [right]) => compareText(left, right))
    .map(([spatialGroupKey, exactFolderKeys]) => ({
      spatialGroupKey,
      exactFolderKeys: exactFolderKeys.sort(compareText),
    }));
}

function withTargets(
  overrides: readonly FocusSchematicSoftFolderScopeOverride[],
  targets: readonly WorkspaceFolderKey[],
  spatialGroupKey: WorkspaceFolderKey,
): readonly FocusSchematicSoftFolderScopeOverride[] {
  const targetSet = new Set(targets);
  const byExact = new Map(
    canonicalFocusSchematicSoftFolderScopeOverrides(overrides).map((item) => [
      item.exactFolderKey,
      item,
    ]),
  );
  for (const exactFolderKey of targetSet) {
    if (exactFolderKey === spatialGroupKey) byExact.delete(exactFolderKey);
    else byExact.set(exactFolderKey, { exactFolderKey, spatialGroupKey });
  }
  return canonicalFocusSchematicSoftFolderScopeOverrides([...byExact.values()]);
}

/** Promotes every exact folder currently represented by one effective group. */
export function promoteFocusSchematicSoftFolderGroup(
  overrides: readonly FocusSchematicSoftFolderScopeOverride[],
  workspaceExactFolderKeys: readonly WorkspaceFolderKey[],
  currentSpatialGroupKey: WorkspaceFolderKey,
): readonly FocusSchematicSoftFolderScopeOverride[] {
  const parent = focusSchematicParentFolderKey(currentSpatialGroupKey);
  const canonical = reconcileFocusSchematicSoftFolderScopeOverrides(
    overrides,
    workspaceExactFolderKeys,
  );
  const resolveGroup = createFocusSchematicSoftFolderGroupResolver(canonical);
  if (parent === null) return canonical;
  const targets = workspaceExactFolderKeys.filter(
    (exactFolderKey) => resolveGroup(exactFolderKey) === currentSpatialGroupKey,
  );
  return withTargets(canonical, targets, parent);
}

/** Promotes the current effective group and every effective sibling group. */
export function promoteFocusSchematicSoftFolderGroupWithSiblings(
  overrides: readonly FocusSchematicSoftFolderScopeOverride[],
  workspaceExactFolderKeys: readonly WorkspaceFolderKey[],
  currentSpatialGroupKey: WorkspaceFolderKey,
): readonly FocusSchematicSoftFolderScopeOverride[] {
  const parent = focusSchematicParentFolderKey(currentSpatialGroupKey);
  const canonical = reconcileFocusSchematicSoftFolderScopeOverrides(
    overrides,
    workspaceExactFolderKeys,
  );
  const resolveGroup = createFocusSchematicSoftFolderGroupResolver(canonical);
  if (parent === null) return canonical;
  const targets = workspaceExactFolderKeys.filter((exactFolderKey) => {
    const effective = resolveGroup(exactFolderKey);
    return focusSchematicParentFolderKey(effective) === parent;
  });
  return withTargets(canonical, targets, parent);
}

/** Restores every exact folder represented by an effective group. */
export function resetFocusSchematicSoftFolderGroup(
  overrides: readonly FocusSchematicSoftFolderScopeOverride[],
  workspaceExactFolderKeys: readonly WorkspaceFolderKey[],
  currentSpatialGroupKey: WorkspaceFolderKey,
): readonly FocusSchematicSoftFolderScopeOverride[] {
  const canonical = reconcileFocusSchematicSoftFolderScopeOverrides(
    overrides,
    workspaceExactFolderKeys,
  );
  const resolveGroup = createFocusSchematicSoftFolderGroupResolver(canonical);
  const reset = new Set(
    workspaceExactFolderKeys.filter(
      (exactFolderKey) =>
        resolveGroup(exactFolderKey) === currentSpatialGroupKey,
    ),
  );
  return canonical.filter(({ exactFolderKey }) => !reset.has(exactFolderKey));
}
