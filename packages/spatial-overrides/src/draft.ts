import { normalizeExcludedSubtrees } from './scope';
import { isValidFolderPullStrength } from './registry';
import type {
  FolderSpatialRule,
  FolderSpatialRuleDraft,
  FolderSpatialScope,
  FolderSpatialScopePreset,
  NormalizedFolderAnchor,
  WorkspaceFolderKey,
} from './types';
import { DEFAULT_FOLDER_PULL_STRENGTH } from './types';

const FULL_SUBTREE_SCOPE = Object.freeze({
  kind: 'subtree' as const,
  includeRootFiles: true,
  excludedSubtrees: Object.freeze([]) as readonly WorkspaceFolderKey[],
});

function cloneCustomScope(
  folderKey: WorkspaceFolderKey,
  scope: Extract<FolderSpatialScope, { readonly kind: 'subtree' }>,
): Extract<FolderSpatialScope, { readonly kind: 'subtree' }> {
  return Object.freeze({
    kind: 'subtree',
    includeRootFiles: scope.includeRootFiles,
    excludedSubtrees: normalizeExcludedSubtrees(
      folderKey,
      scope.excludedSubtrees,
    ),
  });
}

export function folderSpatialScopePreset(
  scope: FolderSpatialScope,
): FolderSpatialScopePreset {
  if (scope.kind === 'exact') return 'exact';
  return scope.includeRootFiles && scope.excludedSubtrees.length === 0
    ? 'subtree'
    : 'custom';
}

export function createFolderSpatialRuleDraft({
  folderKey,
  confirmedRule,
  defaultAnchor,
}: {
  readonly folderKey: WorkspaceFolderKey;
  readonly confirmedRule?: FolderSpatialRule | undefined;
  readonly defaultAnchor: NormalizedFolderAnchor;
}): FolderSpatialRuleDraft {
  const scope = confirmedRule?.scope ?? ({ kind: 'exact' } as const);
  const strength =
    confirmedRule?.behavior === 'pull'
      ? (confirmedRule.strength ?? DEFAULT_FOLDER_PULL_STRENGTH)
      : DEFAULT_FOLDER_PULL_STRENGTH;
  return Object.freeze({
    folderKey,
    behavior: confirmedRule?.behavior ?? 'pull',
    scopePreset: folderSpatialScopePreset(scope),
    customScope:
      scope.kind === 'subtree'
        ? cloneCustomScope(folderKey, scope)
        : FULL_SUBTREE_SCOPE,
    anchor: Object.freeze({
      x: confirmedRule?.anchor.x ?? defaultAnchor.x,
      y: confirmedRule?.anchor.y ?? defaultAnchor.y,
    }),
    strength,
    lastPullStrength: strength,
  });
}

export function folderSpatialRuleDraftScope(
  draft: Pick<
    FolderSpatialRuleDraft,
    'folderKey' | 'scopePreset' | 'customScope'
  >,
): FolderSpatialScope {
  if (draft.scopePreset === 'exact') return Object.freeze({ kind: 'exact' });
  if (draft.scopePreset === 'subtree') return FULL_SUBTREE_SCOPE;
  return cloneCustomScope(draft.folderKey, draft.customScope);
}

export function folderSpatialRuleFromDraft(
  draft: FolderSpatialRuleDraft,
): FolderSpatialRule {
  if (!isValidFolderPullStrength(draft.strength)) {
    throw new Error('Pull strength must be an integer from 0 to 100.');
  }
  return Object.freeze({
    folderKey: draft.folderKey,
    behavior: draft.behavior,
    scope: folderSpatialRuleDraftScope(draft),
    anchor: Object.freeze({ x: draft.anchor.x, y: draft.anchor.y }),
    ...(draft.behavior === 'pull' ? { strength: draft.strength } : {}),
  });
}

export function setFolderSpatialDraftBehavior(
  draft: FolderSpatialRuleDraft,
  behavior: FolderSpatialRuleDraft['behavior'],
): FolderSpatialRuleDraft {
  return Object.freeze({
    ...draft,
    behavior,
    strength: behavior === 'pull' ? draft.lastPullStrength : draft.strength,
    lastPullStrength:
      draft.behavior === 'pull' ? draft.strength : draft.lastPullStrength,
  });
}

export function setFolderSpatialDraftStrength(
  draft: FolderSpatialRuleDraft,
  strength: number,
): FolderSpatialRuleDraft {
  if (!isValidFolderPullStrength(strength)) {
    throw new Error('Pull strength must be an integer from 0 to 100.');
  }
  return Object.freeze({ ...draft, strength, lastPullStrength: strength });
}

export function setFolderSpatialDraftScopePreset(
  draft: FolderSpatialRuleDraft,
  scopePreset: FolderSpatialScopePreset,
): FolderSpatialRuleDraft {
  return Object.freeze({ ...draft, scopePreset });
}

export function setFolderSpatialDraftAnchor(
  draft: FolderSpatialRuleDraft,
  anchor: NormalizedFolderAnchor,
): FolderSpatialRuleDraft {
  return Object.freeze({
    ...draft,
    anchor: Object.freeze({ x: anchor.x, y: anchor.y }),
  });
}

export function setFolderSpatialDraftRootFiles(
  draft: FolderSpatialRuleDraft,
  includeRootFiles: boolean,
): FolderSpatialRuleDraft {
  return Object.freeze({
    ...draft,
    scopePreset: 'custom',
    customScope: Object.freeze({
      ...draft.customScope,
      includeRootFiles,
    }),
  });
}

function containsOrDescends(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`);
}

export function nearestExcludedFolder(
  draft: FolderSpatialRuleDraft,
  folderKey: WorkspaceFolderKey,
): WorkspaceFolderKey | undefined {
  return [...draft.customScope.excludedSubtrees]
    .filter((excluded) => containsOrDescends(folderKey, excluded))
    .sort((left, right) => right.length - left.length)[0];
}

/** Toggles one folder checkbox while retaining a normalized minimal antichain. */
export function toggleFolderSpatialDraftSubtree(
  draft: FolderSpatialRuleDraft,
  folderKey: WorkspaceFolderKey,
): FolderSpatialRuleDraft {
  const blockingAncestor = nearestExcludedFolder(draft, folderKey);
  const next =
    blockingAncestor === undefined
      ? [
          ...draft.customScope.excludedSubtrees.filter(
            (excluded) => !containsOrDescends(excluded, folderKey),
          ),
          folderKey,
        ]
      : draft.customScope.excludedSubtrees.filter(
          (excluded) => excluded !== blockingAncestor,
        );
  return Object.freeze({
    ...draft,
    scopePreset: 'custom',
    customScope: Object.freeze({
      ...draft.customScope,
      excludedSubtrees: normalizeExcludedSubtrees(draft.folderKey, next),
    }),
  });
}

export function folderSpatialRuleDraftIsDirty(
  draft: FolderSpatialRuleDraft,
  baselineRule: FolderSpatialRule,
): boolean {
  return (
    JSON.stringify(folderSpatialRuleFromDraft(draft)) !==
    JSON.stringify(baselineRule)
  );
}
