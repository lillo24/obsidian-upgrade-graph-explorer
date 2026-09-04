import {
  isNormalizedWorkspaceFolderKey,
  workspaceFolderKeyContainsFolder,
  workspaceFolderKeyFromPath,
  type EntityId,
  type WorkspaceFolderKey,
} from '@icarus-graph-explorer/core';
import type { NetworkExplorerFolder } from './network-explorer-folders';
import type {
  NetworkExplorerModel,
  NetworkExplorerNode,
  NetworkExplorerRow,
} from './network-explorer-model';

export type NetworkExplorerAction =
  'focus' | 'inspect' | 'hide' | 'hide-folder' | 'size';
export interface NetworkExplorerMenuAction {
  readonly id: NetworkExplorerAction;
  readonly label: string;
  readonly disabledReason?: string;
}

export interface NetworkExplorerContext {
  readonly rowId: string;
  readonly model: NetworkExplorerModel;
  readonly x: number;
  readonly y: number;
  readonly origin?: HTMLElement | null;
  readonly screen: 'actions' | 'size';
}

export type NetworkExplorerContextTarget =
  | { readonly kind: 'node'; readonly node: NetworkExplorerNode }
  | { readonly kind: 'folder'; readonly folder: NetworkExplorerFolder };

/** Canonical File identity, never a row key, source path, or displayed name. */
export function networkExplorerSizeEntityId(
  node: NetworkExplorerNode,
): EntityId | undefined {
  return node.kindLabel === 'File' ? node.entityId : undefined;
}

/** Logical rows outlive DOM virtualization; projection changes invalidate actions. */
export function currentNetworkExplorerContextTarget(
  context: NetworkExplorerContext | null,
  model: NetworkExplorerModel,
  rows: readonly NetworkExplorerRow[],
  rowIndexById: ReadonlyMap<string, number>,
): NetworkExplorerContextTarget | undefined {
  if (context === null || context.model !== model) return undefined;
  const index = rowIndexById.get(context.rowId);
  const row = index === undefined ? undefined : rows[index];
  return row === undefined || row.id !== context.rowId
    ? undefined
    : networkExplorerContextTarget(row, model);
}

export function networkExplorerContextTarget(
  row: NetworkExplorerRow,
  model: NetworkExplorerModel,
): NetworkExplorerContextTarget | undefined {
  if (row.kind === 'node') {
    const node = model.nodeById.get(row.node.id);
    return node === undefined || row.id !== `node:${node.id}`
      ? undefined
      : { kind: 'node', node };
  }
  if (
    !isNormalizedWorkspaceFolderKey(row.folder.path) ||
    row.id !== `folder:${row.folder.path}`
  )
    return undefined;
  const folder = model.folderByPath.get(row.folder.path);
  return folder === undefined || folder !== row.folder
    ? undefined
    : { kind: 'folder', folder };
}

export function networkExplorerMenuActions(
  target: NetworkExplorerContextTarget,
  focusedSourcePath: string | undefined,
  hiddenPaths: ReadonlySet<string>,
  hiddenFolderKeys: ReadonlySet<WorkspaceFolderKey>,
): readonly NetworkExplorerMenuAction[] {
  if (target.kind === 'folder') {
    const folderKey = target.folder.path;
    const focusedFolderKey =
      focusedSourcePath === undefined
        ? undefined
        : workspaceFolderKeyFromPath(focusedSourcePath);
    const containsFocusedFile =
      focusedFolderKey !== undefined &&
      workspaceFolderKeyContainsFolder(folderKey, focusedFolderKey);
    const hideReason = containsFocusedFile
      ? 'Change Focus before hiding the folder that contains the focused file.'
      : hiddenFolderKeys.has(folderKey)
        ? 'This folder is already hidden by the applied query.'
        : undefined;
    return [
      {
        id: 'hide-folder',
        label: 'Hide folder',
        ...(hideReason === undefined ? {} : { disabledReason: hideReason }),
      },
    ];
  }
  const node = target.node;
  const hideReason =
    node.sourcePath === undefined
      ? 'Only source files can be hidden.'
      : node.sourcePath === focusedSourcePath
        ? 'Change Focus before hiding the focused file.'
        : hiddenPaths.has(node.sourcePath)
          ? 'This file is already hidden by the applied query.'
          : undefined;
  return [
    {
      id: 'focus',
      label: 'Focus',
      ...(node.entityId === undefined
        ? { disabledReason: 'Only source entities can be focused.' }
        : {}),
    },
    { id: 'inspect', label: 'Inspect' },
    {
      id: 'hide',
      label: 'Hide file',
      ...(hideReason === undefined ? {} : { disabledReason: hideReason }),
    },
    ...(networkExplorerSizeEntityId(node) === undefined
      ? []
      : [{ id: 'size' as const, label: 'Size' }]),
  ];
}

export function networkExplorerMenuIndex(
  actions: readonly NetworkExplorerMenuAction[],
  current: number,
  key: string,
): number {
  const enabled = actions.flatMap((action, index) =>
    action.disabledReason === undefined ? [index] : [],
  );
  if (enabled.length === 0) return -1;
  if (key === 'Home') return enabled[0]!;
  if (key === 'End') return enabled[enabled.length - 1]!;
  const offset = enabled.indexOf(current);
  if (key === 'ArrowDown') return enabled[(offset + 1) % enabled.length]!;
  if (key === 'ArrowUp')
    return enabled[(offset - 1 + enabled.length) % enabled.length]!;
  return current;
}
