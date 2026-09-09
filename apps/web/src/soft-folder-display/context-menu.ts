import { workspaceFolderKeyContainsFolder } from '@icarus-graph-explorer/core';
import {
  flattenFocusSchematicSoftFolder,
  moveFocusSchematicSoftFileUp,
  restoreFocusSchematicSoftFile,
  restoreFocusSchematicSoftFolderLayer,
  type FocusSchematicSoftFolderDisplayIntent,
  type FocusSchematicSoftFolderDisplayTree,
} from '@icarus-graph-explorer/focus-schematic-layout';
import type { GraphContextMenuAction } from '@icarus-graph-explorer/renderer-reactflow';

export type SoftFolderDisplayContextTarget =
  | { readonly kind: 'file'; readonly fileId: string }
  | { readonly kind: 'folder'; readonly folderKey: string };

export type SoftFolderDisplayMenuResult =
  | {
      readonly kind: 'intent';
      readonly value: FocusSchematicSoftFolderDisplayIntent;
    }
  | { readonly kind: 'reset' };

export function softFolderDisplayMenuActions(
  tree: FocusSchematicSoftFolderDisplayTree,
  target: SoftFolderDisplayContextTarget,
): readonly GraphContextMenuAction[] {
  const hasIntent =
    tree.reconciledIntent.fileParentOverrides.length > 0 ||
    tree.reconciledIntent.flattenedFolderKeys.length > 0;
  if (target.kind === 'file') {
    const file = tree.files.find((item) => item.fileId === target.fileId);
    const currentFolder = tree.folders.find(
      (item) => item.folderKey === file?.displayParentFolderKey,
    );
    const flattened =
      file === undefined
        ? []
        : tree.reconciledIntent.flattenedFolderKeys.filter((folderKey) =>
            workspaceFolderKeyContainsFolder(folderKey, file.exactFolderKey),
          );
    return [
      {
        id: 'move-file-up',
        label:
          currentFolder?.displayParentFolderKey == null
            ? 'Move up'
            : `Move up to ${
                currentFolder.displayParentFolderKey === '.'
                  ? 'Root folder'
                  : `${currentFolder.displayParentFolderKey}/`
              }`,
        ...(currentFolder?.displayParentFolderKey == null
          ? {
              disabledReason:
                'This File is already displayed at the top level.',
            }
          : {}),
      },
      {
        id: 'restore-file',
        label: 'Restore exact folder placement',
        ...(file === undefined ||
        !tree.reconciledIntent.fileParentOverrides.some(
          ({ fileId }) => fileId === file.fileId,
        )
          ? {
              disabledReason: 'This File already uses its exact source folder.',
            }
          : {}),
      },
      ...flattened.map((folderKey) => ({
        id: `restore-layer:${folderKey}`,
        label: `Restore folder layer ${folderKey}/`,
      })),
      {
        id: 'reset-display',
        label: 'Reset Soft folder display',
        ...(hasIntent
          ? {}
          : { disabledReason: 'Soft folder display already matches source.' }),
      },
    ];
  }
  const folder = tree.folders.find(
    (item) => item.folderKey === target.folderKey,
  );
  const siblingCount = tree.folders.filter(
    (item) =>
      item.folderKey !== folder?.folderKey &&
      item.folderKey !== '.' &&
      item.displayParentFolderKey === folder?.displayParentFolderKey,
  ).length;
  const flattened = tree.reconciledIntent.flattenedFolderKeys.filter(
    (folderKey) =>
      folder?.folderKey === '.' ||
      workspaceFolderKeyContainsFolder(folderKey, folder?.folderKey ?? '.'),
  );
  return [
    {
      id: 'flatten-folder',
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
      id: 'flatten-siblings',
      label: 'Flatten this + sibling folders into parent',
      ...(folder?.displayParentFolderKey == null || siblingCount === 0
        ? {
            disabledReason:
              'No displayed sibling folder can be flattened with this folder.',
          }
        : {}),
    },
    ...flattened.map((folderKey) => ({
      id: `restore-layer:${folderKey}`,
      label: `Restore folder layer ${folderKey}/`,
    })),
    {
      id: 'reset-display',
      label: 'Reset Soft folder display',
      ...(hasIntent
        ? {}
        : { disabledReason: 'Soft folder display already matches source.' }),
    },
  ];
}

export function applySoftFolderDisplayMenuAction(
  tree: FocusSchematicSoftFolderDisplayTree,
  target: SoftFolderDisplayContextTarget,
  action: string,
): SoftFolderDisplayMenuResult {
  if (action === 'reset-display') return { kind: 'reset' };
  if (action.startsWith('restore-layer:'))
    return {
      kind: 'intent',
      value: restoreFocusSchematicSoftFolderLayer(
        tree.reconciledIntent,
        action.slice('restore-layer:'.length),
      ),
    };
  if (target.kind === 'file') {
    if (action === 'move-file-up')
      return {
        kind: 'intent',
        value: moveFocusSchematicSoftFileUp(tree, target.fileId),
      };
    if (action === 'restore-file')
      return {
        kind: 'intent',
        value: restoreFocusSchematicSoftFile(tree, target.fileId),
      };
  } else {
    if (action === 'flatten-folder' || action === 'flatten-siblings')
      return {
        kind: 'intent',
        value: flattenFocusSchematicSoftFolder(
          tree,
          target.folderKey,
          action === 'flatten-siblings',
        ),
      };
  }
  throw new Error(
    `Unsupported Soft folder display action ${JSON.stringify(action)}.`,
  );
}
