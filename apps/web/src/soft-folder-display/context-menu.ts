import { workspaceFolderKeyContainsFolder } from '@icarus-graph-explorer/core';
import {
  flattenFocusSchematicSoftFolder,
  moveFocusSchematicSoftFileUp,
  restoreFocusSchematicSoftFile,
  restoreFocusSchematicSoftFolderLayer,
  type FocusSchematicSoftFolderDisplayIntent,
  type FocusSchematicSoftFolderDisplayTree,
} from '@icarus-graph-explorer/focus-schematic-layout';
import type {
  GraphContextMenuAction,
  GraphContextMenuItem,
} from '@icarus-graph-explorer/renderer-reactflow';

export type SoftFolderDisplayContextTarget =
  | { readonly kind: 'file'; readonly fileId: string }
  | { readonly kind: 'folder'; readonly folderKey: string };

export type SoftFolderDisplayMenuResult =
  | {
      readonly kind: 'intent';
      readonly value: FocusSchematicSoftFolderDisplayIntent;
    }
  | { readonly kind: 'reset' };

export type SoftFolderDisplayMenuActionId =
  | 'file:move-up'
  | 'file:restore-exact'
  | 'folder:flatten'
  | 'folder:flatten-siblings'
  | `folder:restore-layer:${string}`
  | 'folder:reset';

const STRONG_SEPARATOR = {
  kind: 'separator',
  emphasis: 'strong',
} as const;

function hasDisplayIntent(tree: FocusSchematicSoftFolderDisplayTree): boolean {
  return (
    tree.reconciledIntent.fileParentOverrides.length > 0 ||
    tree.reconciledIntent.flattenedFolderKeys.length > 0
  );
}

function fileActions(
  tree: FocusSchematicSoftFolderDisplayTree,
  fileId: string,
): readonly GraphContextMenuAction<SoftFolderDisplayMenuActionId>[] {
  const file = tree.files.find((item) => item.fileId === fileId);
  const currentFolder = tree.folders.find(
    (item) => item.folderKey === file?.displayParentFolderKey,
  );
  return [
    {
      id: 'file:move-up',
      label:
        currentFolder?.displayParentFolderKey == null
          ? 'Move up'
          : `Move up to ${
              currentFolder.displayParentFolderKey === '.'
                ? 'Root folder'
                : `${currentFolder.displayParentFolderKey}/`
            }`,
      ...(currentFolder?.displayParentFolderKey == null
        ? { disabledReason: 'This File is already displayed at the top level.' }
        : {}),
    },
    {
      id: 'file:restore-exact',
      label: 'Restore exact folder placement',
      ...(file === undefined ||
      !tree.reconciledIntent.fileParentOverrides.some(
        ({ fileId: overriddenFileId }) => overriddenFileId === file.fileId,
      )
        ? { disabledReason: 'This File already uses its exact source folder.' }
        : {}),
    },
  ];
}

function folderActions(
  tree: FocusSchematicSoftFolderDisplayTree,
  folderKey: string,
): readonly GraphContextMenuAction<SoftFolderDisplayMenuActionId>[] {
  const folder = tree.folders.find((item) => item.folderKey === folderKey);
  const siblingCount = tree.folders.filter(
    (item) =>
      item.folderKey !== folder?.folderKey &&
      item.folderKey !== '.' &&
      item.displayParentFolderKey === folder?.displayParentFolderKey,
  ).length;
  const flattened = tree.reconciledIntent.flattenedFolderKeys.filter(
    (candidate) =>
      folder?.folderKey === '.' ||
      workspaceFolderKeyContainsFolder(candidate, folder?.folderKey ?? '.'),
  );
  return [
    {
      id: 'folder:flatten',
      label:
        folder?.displayParentFolderKey == null
          ? 'Flatten into parent'
          : `Flatten into ${
              folder.displayParentFolderKey === '.'
                ? 'Root folder'
                : `${folder.displayParentFolderKey}/`
            }`,
      ...(folder?.displayParentFolderKey == null
        ? { disabledReason: 'Workspace root has no parent folder.' }
        : {}),
    },
    {
      id: 'folder:flatten-siblings',
      label: 'Flatten this + sibling folders into parent',
      ...(folder?.displayParentFolderKey == null || siblingCount === 0
        ? {
            disabledReason:
              'No displayed sibling folder can be flattened with this folder.',
          }
        : {}),
    },
    ...flattened.map(
      (candidate): GraphContextMenuAction<SoftFolderDisplayMenuActionId> => ({
        id: `folder:restore-layer:${candidate}`,
        label: `Restore folder layer ${candidate}/`,
      }),
    ),
    {
      id: 'folder:reset',
      label: 'Reset Soft folder display',
      ...(hasDisplayIntent(tree)
        ? {}
        : { disabledReason: 'Soft folder display already matches source.' }),
    },
  ];
}

/** Composes File actions with valid actions for its current displayed folder. */
export function softFolderDisplayMenuItems(
  tree: FocusSchematicSoftFolderDisplayTree,
  target: SoftFolderDisplayContextTarget,
): readonly GraphContextMenuItem<SoftFolderDisplayMenuActionId>[] {
  if (target.kind === 'folder') return folderActions(tree, target.folderKey);
  const file = tree.files.find(({ fileId }) => fileId === target.fileId);
  const upper = fileActions(tree, target.fileId);
  if (
    file?.displayParentFolderKey == null ||
    file.displayParentFolderKey === '.'
  )
    return upper;
  const lower = folderActions(tree, file.displayParentFolderKey).filter(
    ({ disabledReason }) => disabledReason === undefined,
  );
  return lower.length === 0 ? upper : [...upper, STRONG_SEPARATOR, ...lower];
}

function currentFolderKey(
  tree: FocusSchematicSoftFolderDisplayTree,
  target: SoftFolderDisplayContextTarget,
): string | undefined {
  return target.kind === 'folder'
    ? target.folderKey
    : tree.files.find(({ fileId }) => fileId === target.fileId)
        ?.displayParentFolderKey;
}

export function applySoftFolderDisplayMenuAction(
  tree: FocusSchematicSoftFolderDisplayTree,
  target: SoftFolderDisplayContextTarget,
  action: SoftFolderDisplayMenuActionId,
): SoftFolderDisplayMenuResult {
  if (action === 'folder:reset') return { kind: 'reset' };
  if (action.startsWith('folder:restore-layer:'))
    return {
      kind: 'intent',
      value: restoreFocusSchematicSoftFolderLayer(
        tree.reconciledIntent,
        action.slice('folder:restore-layer:'.length),
      ),
    };
  if (action === 'file:move-up' && target.kind === 'file')
    return {
      kind: 'intent',
      value: moveFocusSchematicSoftFileUp(tree, target.fileId),
    };
  if (action === 'file:restore-exact' && target.kind === 'file')
    return {
      kind: 'intent',
      value: restoreFocusSchematicSoftFile(tree, target.fileId),
    };
  if (action === 'folder:flatten' || action === 'folder:flatten-siblings') {
    const folderKey = currentFolderKey(tree, target);
    if (folderKey !== undefined && folderKey !== '.')
      return {
        kind: 'intent',
        value: flattenFocusSchematicSoftFolder(
          tree,
          folderKey,
          action === 'folder:flatten-siblings',
        ),
      };
  }
  throw new Error(
    `Unsupported Soft folder display action ${JSON.stringify(action)}.`,
  );
}
