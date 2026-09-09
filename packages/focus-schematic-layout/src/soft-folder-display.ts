import {
  isNormalizedWorkspaceFolderKey,
  workspaceFolderKeyContainsFolder,
  type EntityId,
  type WorkspaceFolderKey,
} from '@icarus-graph-explorer/core';

import type {
  FocusSchematicSoftFileDisplayParentOverride,
  FocusSchematicSoftFolderDisplayFile,
  FocusSchematicSoftFolderDisplayIntent,
  FocusSchematicSoftFolderDisplayNode,
  FocusSchematicSoftFolderDisplayTree,
  FocusSchematicSoftFolderPlacementProvenance,
  FocusSchematicSoftHierarchyForcePolicy,
} from './types';

export const EMPTY_FOCUS_SCHEMATIC_SOFT_FOLDER_DISPLAY_INTENT = {
  fileParentOverrides: [],
  flattenedFolderKeys: [],
} as const satisfies FocusSchematicSoftFolderDisplayIntent;

export interface FocusSchematicSoftFolderDisplayInputFile {
  readonly fileId: EntityId;
  readonly exactFolderKey: WorkspaceFolderKey;
}

export interface FocusSchematicSoftFolderScopeMembership {
  readonly folderKey: WorkspaceFolderKey;
  readonly weight: number;
}

export type FocusSchematicSoftFolderDisplayValidationResult =
  | {
      readonly valid: true;
      readonly value: FocusSchematicSoftFolderDisplayIntent;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly {
        readonly path: string;
        readonly message: string;
      }[];
    };

interface MutableFolder {
  readonly folderKey: WorkspaceFolderKey;
  displayParentFolderKey: WorkspaceFolderKey | null;
  readonly directFileIds: Set<EntityId>;
  readonly childFolderKeys: Set<WorkspaceFolderKey>;
  readonly suppressedAncestorFolderKeys: WorkspaceFolderKey[];
  readonly provenance: Set<FocusSchematicSoftFolderPlacementProvenance>;
}

interface MutableFile {
  readonly fileId: EntityId;
  readonly exactFolderKey: WorkspaceFolderKey;
  displayParentFolderKey: WorkspaceFolderKey;
  readonly manualDisplayParentFolderKey: WorkspaceFolderKey;
  readonly suppressedAncestorFolderKeys: WorkspaceFolderKey[];
  readonly provenance: Set<FocusSchematicSoftFolderPlacementProvenance>;
}

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

/** Returns the normalized parent, or null for workspace root. */
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

function folderDepth(folderKey: WorkspaceFolderKey): number {
  return folderKey === '.' ? 0 : folderKey.split('/').length;
}

function folderAncestors(folderKey: WorkspaceFolderKey): WorkspaceFolderKey[] {
  const ancestors: WorkspaceFolderKey[] = [];
  let current: WorkspaceFolderKey | null = folderKey;
  while (current !== null) {
    ancestors.push(current);
    current = focusSchematicParentFolderKey(current);
  }
  return ancestors;
}

export function validateFocusSchematicSoftFolderDisplayIntent(
  value: unknown,
): FocusSchematicSoftFolderDisplayValidationResult {
  if (!isPlainRecord(value))
    return {
      valid: false,
      issues: [
        { path: '$', message: 'Soft folder display intent must be an object.' },
      ],
    };
  if (
    Object.keys(value).sort(compareText).join('|') !==
    'fileParentOverrides|flattenedFolderKeys'
  )
    return {
      valid: false,
      issues: [
        {
          path: '$',
          message: 'Soft folder display intent fields are invalid.',
        },
      ],
    };
  const issues: { path: string; message: string }[] = [];
  const fileParentOverrides: FocusSchematicSoftFileDisplayParentOverride[] = [];
  const seenFiles = new Set<string>();
  if (!Array.isArray(value.fileParentOverrides))
    issues.push({
      path: '$.fileParentOverrides',
      message: 'File parent overrides must be an array.',
    });
  else
    value.fileParentOverrides.forEach((candidate, index) => {
      const path = `$.fileParentOverrides[${index}]`;
      if (
        !isPlainRecord(candidate) ||
        Object.keys(candidate).sort(compareText).join('|') !==
          'displayParentFolderKey|fileId'
      ) {
        issues.push({
          path,
          message: 'File parent override fields are invalid.',
        });
        return;
      }
      if (
        typeof candidate.fileId !== 'string' ||
        candidate.fileId.length === 0
      ) {
        issues.push({
          path: `${path}.fileId`,
          message: 'Stable File identity is required.',
        });
        return;
      }
      if (!isNormalizedWorkspaceFolderKey(candidate.displayParentFolderKey)) {
        issues.push({
          path: `${path}.displayParentFolderKey`,
          message: 'Display parent must be normalized and workspace-relative.',
        });
        return;
      }
      if (seenFiles.has(candidate.fileId)) {
        issues.push({
          path: `${path}.fileId`,
          message: 'Duplicate File display override.',
        });
        return;
      }
      seenFiles.add(candidate.fileId);
      fileParentOverrides.push({
        fileId: candidate.fileId,
        displayParentFolderKey: candidate.displayParentFolderKey,
      });
    });
  const flattenedFolderKeys: WorkspaceFolderKey[] = [];
  const seenFolders = new Set<string>();
  if (!Array.isArray(value.flattenedFolderKeys))
    issues.push({
      path: '$.flattenedFolderKeys',
      message: 'Flattened folders must be an array.',
    });
  else
    value.flattenedFolderKeys.forEach((candidate, index) => {
      const path = `$.flattenedFolderKeys[${index}]`;
      if (!isNormalizedWorkspaceFolderKey(candidate) || candidate === '.') {
        issues.push({
          path,
          message:
            'Flattened folder must be a non-root normalized workspace folder key.',
        });
        return;
      }
      if (seenFolders.has(candidate)) {
        issues.push({ path, message: 'Duplicate flattened folder key.' });
        return;
      }
      seenFolders.add(candidate);
      flattenedFolderKeys.push(candidate);
    });
  if (issues.length > 0) return { valid: false, issues };
  return {
    valid: true,
    value: {
      fileParentOverrides: fileParentOverrides.sort((left, right) =>
        compareText(left.fileId, right.fileId),
      ),
      flattenedFolderKeys: flattenedFolderKeys.sort(compareText),
    },
    issues: [],
  };
}

export function canonicalFocusSchematicSoftFolderDisplayIntent(
  value: unknown,
): FocusSchematicSoftFolderDisplayIntent {
  const validation = validateFocusSchematicSoftFolderDisplayIntent(value);
  if (!validation.valid)
    throw new Error(
      `Invalid Soft folder display intent: ${validation.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    );
  return validation.value;
}

/** Drops stale state without guessing renamed File or folder identities. */
export function reconcileFocusSchematicSoftFolderDisplayIntent(
  intent: FocusSchematicSoftFolderDisplayIntent,
  workspaceFiles: readonly FocusSchematicSoftFolderDisplayInputFile[],
): FocusSchematicSoftFolderDisplayIntent {
  const canonical = canonicalFocusSchematicSoftFolderDisplayIntent(intent);
  const exactByFile = new Map(
    workspaceFiles
      .filter(
        ({ fileId, exactFolderKey }) =>
          typeof fileId === 'string' &&
          fileId.length > 0 &&
          isNormalizedWorkspaceFolderKey(exactFolderKey),
      )
      .map(({ fileId, exactFolderKey }) => [fileId, exactFolderKey]),
  );
  const availableFolders = new Set<WorkspaceFolderKey>(['.']);
  for (const exactFolderKey of exactByFile.values())
    for (const ancestor of folderAncestors(exactFolderKey))
      availableFolders.add(ancestor);
  return {
    fileParentOverrides: canonical.fileParentOverrides.filter(
      ({ fileId, displayParentFolderKey }) => {
        const exact = exactByFile.get(fileId);
        return (
          exact !== undefined &&
          displayParentFolderKey !== exact &&
          workspaceFolderKeyContainsFolder(displayParentFolderKey, exact)
        );
      },
    ),
    flattenedFolderKeys: canonical.flattenedFolderKeys.filter((folderKey) =>
      availableFolders.has(folderKey),
    ),
  };
}

function ensureFolder(
  folders: Map<WorkspaceFolderKey, MutableFolder>,
  folderKey: WorkspaceFolderKey,
): MutableFolder {
  const current = folders.get(folderKey);
  if (current !== undefined) return current;
  const parentKey = focusSchematicParentFolderKey(folderKey);
  const folder: MutableFolder = {
    folderKey,
    displayParentFolderKey: parentKey,
    directFileIds: new Set(),
    childFolderKeys: new Set(),
    suppressedAncestorFolderKeys: [],
    provenance: new Set(['exact']),
  };
  folders.set(folderKey, folder);
  if (parentKey !== null)
    ensureFolder(folders, parentKey).childFolderKeys.add(folderKey);
  return folder;
}

function liftFolderLayer(
  folderKey: WorkspaceFolderKey,
  folders: Map<WorkspaceFolderKey, MutableFolder>,
  files: Map<EntityId, MutableFile>,
  provenance: 'manual-folder-flatten' | 'automatic-singleton-compression',
): boolean {
  const folder = folders.get(folderKey);
  const parentKey = folder?.displayParentFolderKey;
  if (folder === undefined || parentKey == null) return false;
  const parent = folders.get(parentKey);
  if (parent === undefined) return false;
  parent.childFolderKeys.delete(folderKey);
  for (const fileId of folder.directFileIds) {
    parent.directFileIds.add(fileId);
    const file = files.get(fileId)!;
    file.displayParentFolderKey = parentKey;
    file.suppressedAncestorFolderKeys.push(folderKey);
    file.provenance.add(provenance);
  }
  for (const childKey of folder.childFolderKeys) {
    parent.childFolderKeys.add(childKey);
    const child = folders.get(childKey)!;
    child.displayParentFolderKey = parentKey;
    child.suppressedAncestorFolderKeys.push(folderKey);
    child.provenance.add(provenance);
  }
  folders.delete(folderKey);
  return true;
}

function orderedProvenance(
  values: ReadonlySet<FocusSchematicSoftFolderPlacementProvenance>,
): readonly FocusSchematicSoftFolderPlacementProvenance[] {
  const order: readonly FocusSchematicSoftFolderPlacementProvenance[] = [
    'exact',
    'manual-file-promotion',
    'manual-folder-flatten',
    'automatic-singleton-compression',
  ];
  return order.filter((value) => values.has(value));
}

/** Pure canonical-to-displayed transformation shared by layout and renderer. */
export function buildFocusSchematicSoftFolderDisplayTree({
  visibleFiles,
  intent = EMPTY_FOCUS_SCHEMATIC_SOFT_FOLDER_DISPLAY_INTENT,
}: {
  readonly visibleFiles: readonly FocusSchematicSoftFolderDisplayInputFile[];
  readonly intent?: FocusSchematicSoftFolderDisplayIntent;
}): FocusSchematicSoftFolderDisplayTree {
  const uniqueVisibleFiles = [
    ...new Map(
      visibleFiles
        .filter(
          ({ fileId, exactFolderKey }) =>
            typeof fileId === 'string' &&
            fileId.length > 0 &&
            isNormalizedWorkspaceFolderKey(exactFolderKey),
        )
        .map((file) => [file.fileId, file]),
    ).values(),
  ].sort((left, right) => compareText(left.fileId, right.fileId));
  const reconciledIntent =
    canonicalFocusSchematicSoftFolderDisplayIntent(intent);
  const applicableIntent = reconcileFocusSchematicSoftFolderDisplayIntent(
    reconciledIntent,
    uniqueVisibleFiles,
  );
  const overrideByFile = new Map(
    applicableIntent.fileParentOverrides.map((item) => [item.fileId, item]),
  );
  const folders = new Map<WorkspaceFolderKey, MutableFolder>();
  ensureFolder(folders, '.');
  const files = new Map<EntityId, MutableFile>();
  for (const inputFile of uniqueVisibleFiles) {
    const manualParent =
      overrideByFile.get(inputFile.fileId)?.displayParentFolderKey ??
      inputFile.exactFolderKey;
    for (const ancestor of folderAncestors(inputFile.exactFolderKey))
      ensureFolder(folders, ancestor);
    const file: MutableFile = {
      ...inputFile,
      displayParentFolderKey: manualParent,
      manualDisplayParentFolderKey: manualParent,
      suppressedAncestorFolderKeys: [],
      provenance: new Set([
        'exact',
        ...(manualParent === inputFile.exactFolderKey
          ? []
          : (['manual-file-promotion'] as const)),
      ]),
    };
    files.set(file.fileId, file);
    ensureFolder(folders, manualParent).directFileIds.add(file.fileId);
  }

  // A promoted File must not leave an empty canonical layer behind. Empty
  // layers explain no visible membership and are neither manual nor derived
  // display intent.
  let pruned = true;
  while (pruned) {
    pruned = false;
    for (const folder of [...folders.values()].sort(
      (left, right) =>
        folderDepth(right.folderKey) - folderDepth(left.folderKey),
    )) {
      if (
        folder.folderKey === '.' ||
        folder.directFileIds.size > 0 ||
        folder.childFolderKeys.size > 0
      )
        continue;
      const parent =
        folder.displayParentFolderKey === null
          ? undefined
          : folders.get(folder.displayParentFolderKey);
      parent?.childFolderKeys.delete(folder.folderKey);
      folders.delete(folder.folderKey);
      pruned = true;
    }
  }

  for (const folderKey of [...applicableIntent.flattenedFolderKeys].sort(
    (left, right) =>
      folderDepth(right) - folderDepth(left) || compareText(left, right),
  ))
    liftFolderLayer(folderKey, folders, files, 'manual-folder-flatten');

  const automaticallyCompressedFolderKeys: WorkspaceFolderKey[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    const candidates = [...folders.values()]
      .filter(
        ({ folderKey, directFileIds, childFolderKeys }) =>
          folderKey !== '.' && directFileIds.size + childFolderKeys.size === 1,
      )
      .sort(
        (left, right) =>
          folderDepth(right.folderKey) - folderDepth(left.folderKey) ||
          compareText(left.folderKey, right.folderKey),
      );
    for (const folder of candidates) {
      if (
        liftFolderLayer(
          folder.folderKey,
          folders,
          files,
          'automatic-singleton-compression',
        )
      ) {
        automaticallyCompressedFolderKeys.push(folder.folderKey);
        changed = true;
      }
    }
  }

  const descendantMemo = new Map<WorkspaceFolderKey, readonly EntityId[]>();
  const descendants = (folderKey: WorkspaceFolderKey): readonly EntityId[] => {
    const cached = descendantMemo.get(folderKey);
    if (cached !== undefined) return cached;
    const folder = folders.get(folderKey)!;
    const value = [
      ...folder.directFileIds,
      ...[...folder.childFolderKeys].flatMap((childKey) =>
        descendants(childKey),
      ),
    ].sort(compareText);
    descendantMemo.set(folderKey, value);
    return value;
  };
  const folderValues: FocusSchematicSoftFolderDisplayNode[] = [
    ...folders.values(),
  ]
    .sort(
      (left, right) =>
        folderDepth(left.folderKey) - folderDepth(right.folderKey) ||
        compareText(left.folderKey, right.folderKey),
    )
    .map((folder) => ({
      folderKey: folder.folderKey,
      displayParentFolderKey: folder.displayParentFolderKey,
      directFileIds: [...folder.directFileIds].sort(compareText),
      childFolderKeys: [...folder.childFolderKeys].sort(compareText),
      descendantFileIds: descendants(folder.folderKey),
      suppressedAncestorFolderKeys: [
        ...folder.suppressedAncestorFolderKeys,
      ].sort(
        (left, right) =>
          folderDepth(left) - folderDepth(right) || compareText(left, right),
      ),
      provenance: orderedProvenance(folder.provenance),
    }));
  const fileValues: FocusSchematicSoftFolderDisplayFile[] = [...files.values()]
    .sort((left, right) => compareText(left.fileId, right.fileId))
    .map((file) => ({
      fileId: file.fileId,
      exactFolderKey: file.exactFolderKey,
      displayParentFolderKey: file.displayParentFolderKey,
      manualDisplayParentFolderKey: file.manualDisplayParentFolderKey,
      suppressedAncestorFolderKeys: [...file.suppressedAncestorFolderKeys].sort(
        (left, right) =>
          folderDepth(left) - folderDepth(right) || compareText(left, right),
      ),
      provenance: orderedProvenance(file.provenance),
    }));
  return {
    rootFolderKey: '.',
    folders: folderValues,
    files: fileValues,
    reconciledIntent,
    automaticallyCompressedFolderKeys: [
      ...new Set(automaticallyCompressedFolderKeys),
    ].sort(compareText),
  };
}

export function focusSchematicSoftFolderScopeMemberships(
  tree: FocusSchematicSoftFolderDisplayTree,
  policy: FocusSchematicSoftHierarchyForcePolicy,
): ReadonlyMap<EntityId, readonly FocusSchematicSoftFolderScopeMembership[]> {
  const folderByKey = new Map(
    tree.folders.map((folder) => [folder.folderKey, folder]),
  );
  return new Map(
    tree.files.map((file) => {
      const scopes: WorkspaceFolderKey[] = [];
      let current: WorkspaceFolderKey | null = file.displayParentFolderKey;
      while (current !== null) {
        const folder = folderByKey.get(current);
        if (folder === undefined) break;
        if (current !== '.') scopes.push(current);
        current = folder.displayParentFolderKey;
      }
      const selected = policy === 'nearest-only' ? scopes.slice(0, 1) : scopes;
      const raw = selected.map((folderKey, index) => ({
        folderKey,
        weight: policy === 'normalized-decay' ? 1 / 2 ** index : 1,
      }));
      const total = raw.reduce((sum, item) => sum + item.weight, 0);
      return [
        file.fileId,
        raw.map((item) => ({
          ...item,
          weight: total === 0 ? 0 : item.weight / total,
        })),
      ] as const;
    }),
  );
}

function withFileOverride(
  intent: FocusSchematicSoftFolderDisplayIntent,
  file: FocusSchematicSoftFolderDisplayFile,
  displayParentFolderKey: WorkspaceFolderKey | null,
): FocusSchematicSoftFolderDisplayIntent {
  const byFile = new Map(
    intent.fileParentOverrides.map((item) => [item.fileId, item]),
  );
  if (
    displayParentFolderKey === null ||
    displayParentFolderKey === file.exactFolderKey
  )
    byFile.delete(file.fileId);
  else byFile.set(file.fileId, { fileId: file.fileId, displayParentFolderKey });
  return canonicalFocusSchematicSoftFolderDisplayIntent({
    ...intent,
    fileParentOverrides: [...byFile.values()],
  });
}

export function moveFocusSchematicSoftFileUp(
  tree: FocusSchematicSoftFolderDisplayTree,
  fileId: EntityId,
): FocusSchematicSoftFolderDisplayIntent {
  const file = tree.files.find((item) => item.fileId === fileId);
  const folder = tree.folders.find(
    (item) => item.folderKey === file?.displayParentFolderKey,
  );
  return file === undefined || folder === undefined
    ? tree.reconciledIntent
    : withFileOverride(
        tree.reconciledIntent,
        file,
        folder.displayParentFolderKey,
      );
}

export function restoreFocusSchematicSoftFile(
  tree: FocusSchematicSoftFolderDisplayTree,
  fileId: EntityId,
): FocusSchematicSoftFolderDisplayIntent {
  const file = tree.files.find((item) => item.fileId === fileId);
  return file === undefined
    ? tree.reconciledIntent
    : withFileOverride(tree.reconciledIntent, file, null);
}

export function flattenFocusSchematicSoftFolder(
  tree: FocusSchematicSoftFolderDisplayTree,
  folderKey: WorkspaceFolderKey,
  includeSiblings = false,
): FocusSchematicSoftFolderDisplayIntent {
  const folder = tree.folders.find((item) => item.folderKey === folderKey);
  if (folder === undefined || folder.displayParentFolderKey === null)
    return tree.reconciledIntent;
  const targets = includeSiblings
    ? tree.folders
        .filter(
          (item) =>
            item.folderKey !== '.' &&
            item.displayParentFolderKey === folder.displayParentFolderKey,
        )
        .map((item) => item.folderKey)
    : [folderKey];
  return canonicalFocusSchematicSoftFolderDisplayIntent({
    ...tree.reconciledIntent,
    flattenedFolderKeys: [
      ...new Set([...tree.reconciledIntent.flattenedFolderKeys, ...targets]),
    ],
  });
}

export function restoreFocusSchematicSoftFolderLayer(
  intent: FocusSchematicSoftFolderDisplayIntent,
  folderKey: WorkspaceFolderKey,
): FocusSchematicSoftFolderDisplayIntent {
  return canonicalFocusSchematicSoftFolderDisplayIntent({
    ...intent,
    flattenedFolderKeys: intent.flattenedFolderKeys.filter(
      (key) => key !== folderKey,
    ),
  });
}
