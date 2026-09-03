import type { WorkspacePath } from '@icarus-graph-explorer/core';
import type { ProjectionNodeId } from '@icarus-graph-explorer/view-projection';
import type { NetworkExplorerNode } from './network-explorer-model';

export type NetworkExplorerFolderState = ReadonlyMap<WorkspacePath, boolean>;

export interface NetworkExplorerFolder {
  readonly path: WorkspacePath;
  readonly name: string;
  readonly depth: number;
  readonly entries: readonly NetworkExplorerEntry[];
}

export type NetworkExplorerEntry =
  | { readonly kind: 'folder'; readonly folder: NetworkExplorerFolder }
  | {
      readonly kind: 'node';
      readonly node: NetworkExplorerNode;
      readonly nestedInFile: boolean;
    };

export interface NetworkExplorerFolders {
  readonly roots: readonly NetworkExplorerEntry[];
  readonly folderByPath: ReadonlyMap<WorkspacePath, NetworkExplorerFolder>;
}

interface RowPosition {
  readonly id: string;
  readonly level: number;
  readonly parentFolderId: string | undefined;
  readonly position: number;
  readonly setSize: number;
}

export type NetworkExplorerRow = RowPosition &
  (
    | {
        readonly kind: 'folder';
        readonly folder: NetworkExplorerFolder;
        readonly expanded: boolean;
      }
    | {
        readonly kind: 'node';
        readonly node: NetworkExplorerNode;
        readonly nestedInFile: boolean;
      }
  );

/** Only real source folders disclose; root is not a folder level. */
export function networkExplorerFolderExpanded(
  folder: NetworkExplorerFolder,
  overrides: NetworkExplorerFolderState,
): boolean {
  return overrides.get(folder.path) ?? folder.depth <= 2;
}

/** Nodes are already in deterministic source order. Never reads graph edges or the vault. */
export function createNetworkExplorerFolders(
  nodes: readonly NetworkExplorerNode[],
): NetworkExplorerFolders {
  const roots: NetworkExplorerEntry[] = [];
  const folders = new Map<
    WorkspacePath,
    NetworkExplorerFolder & { entries: NetworkExplorerEntry[] }
  >();
  const documentPaths = new Set(
    nodes
      .filter((node) => node.kindLabel === 'File')
      .map((node) => node.sourcePath),
  );
  const diagnostics: NetworkExplorerEntry[] = [];
  for (const node of nodes) {
    if (node.kindLabel === 'Diagnostic') {
      diagnostics.push({ kind: 'node', node, nestedInFile: false });
      continue;
    }
    if (node.sourcePath === undefined) {
      throw new Error(
        `Network Explorer source node ${JSON.stringify(node.id)} has no canonical source path.`,
      );
    }
    const parts = node.sourcePath.split('/').slice(0, -1);
    let entries = roots;
    let path = '';
    for (const [index, name] of parts.entries()) {
      path = path === '' ? name : `${path}/${name}`;
      let folder = folders.get(path);
      if (folder === undefined) {
        folder = { path, name, depth: index + 1, entries: [] };
        folders.set(path, folder);
        entries.push({ kind: 'folder', folder });
      }
      entries = folder.entries;
    }
    entries.push({
      kind: 'node',
      node,
      nestedInFile:
        node.kindLabel !== 'File' && documentPaths.has(node.sourcePath),
    });
  }
  // Folders first, then source-ordered file groups. Stable sort retains entity order.
  const compare = (left: NetworkExplorerEntry, right: NetworkExplorerEntry) => {
    if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1;
    if (left.kind !== 'folder' || right.kind !== 'folder') return 0;
    return left.folder.path < right.folder.path
      ? -1
      : left.folder.path > right.folder.path
        ? 1
        : 0;
  };
  roots.sort(compare);
  for (const folder of folders.values()) folder.entries.sort(compare);
  roots.push(...diagnostics);
  return { roots, folderByPath: folders };
}

/** Iterative traversal stays safe for deeply nested paths; files never collapse. */
export function flattenNetworkExplorerRows(
  model: NetworkExplorerFolders,
  overrides: NetworkExplorerFolderState,
): readonly NetworkExplorerRow[] {
  const rows: NetworkExplorerRow[] = [];
  const stack: {
    entry: NetworkExplorerEntry;
    level: number;
    parentFolderId: string | undefined;
    position: number;
    setSize: number;
  }[] = [];
  const push = (
    entries: readonly NetworkExplorerEntry[],
    level: number,
    parentFolderId: string | undefined,
  ) => {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      stack.push({
        entry: entries[index]!,
        level,
        parentFolderId,
        position: index + 1,
        setSize: entries.length,
      });
    }
  };
  push(model.roots, 1, undefined);
  while (stack.length > 0) {
    const { entry, ...position } = stack.pop()!;
    if (entry.kind === 'node') {
      rows.push({ ...position, ...entry, id: `node:${entry.node.id}` });
    } else {
      const id = `folder:${entry.folder.path}`;
      const expanded = networkExplorerFolderExpanded(entry.folder, overrides);
      rows.push({ ...position, ...entry, id, expanded });
      if (expanded) push(entry.folder.entries, position.level + 1, id);
    }
  }
  return rows;
}

/** Open only the ancestors of a newly selected graph node; never run for ordinary scroll. */
export function revealNetworkExplorerNode(
  state: NetworkExplorerFolderState,
  model: NetworkExplorerFolders & {
    readonly nodeById: ReadonlyMap<ProjectionNodeId, NetworkExplorerNode>;
  },
  nodeId: ProjectionNodeId,
): NetworkExplorerFolderState {
  const path = model.nodeById.get(nodeId)?.sourcePath;
  if (path === undefined) return state;
  let next: Map<WorkspacePath, boolean> | undefined;
  let parent = '';
  for (const part of path.split('/').slice(0, -1)) {
    parent = parent === '' ? part : `${parent}/${part}`;
    const folder = model.folderByPath.get(parent);
    if (folder !== undefined && !networkExplorerFolderExpanded(folder, state)) {
      next ??= new Map(state);
      next.set(parent, true);
    }
  }
  return next ?? state;
}
