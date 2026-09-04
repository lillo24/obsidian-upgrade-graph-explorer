import {
  workspaceFolderKeyFromPath,
  type WorkspaceFolderKey,
} from '@icarus-graph-explorer/core';
import type { FolderSpatialRule } from '@icarus-graph-explorer/spatial-overrides';

export interface FolderScopeTreeNode {
  readonly folderKey: WorkspaceFolderKey;
  readonly name: string;
  readonly depth: number;
  readonly directFileCount: number;
  readonly totalFileCount: number;
  readonly visibleFileCount: number;
  readonly ownRule?: FolderSpatialRule;
  readonly children: readonly FolderScopeTreeNode[];
}

interface MutableFolderScopeTreeNode {
  readonly folderKey: WorkspaceFolderKey;
  readonly name: string;
  readonly depth: number;
  directFileCount: number;
  totalFileCount: number;
  visibleFileCount: number;
  ownRule?: FolderSpatialRule;
  readonly children: MutableFolderScopeTreeNode[];
}

function folderAncestors(folderKey: WorkspaceFolderKey): WorkspaceFolderKey[] {
  if (folderKey === '.') return ['.'];
  const parts = folderKey.split('/');
  return [
    '.',
    ...parts.map(
      (_part, index) =>
        parts.slice(0, index + 1).join('/') as WorkspaceFolderKey,
    ),
  ];
}

function node(folderKey: WorkspaceFolderKey): MutableFolderScopeTreeNode {
  const parts = folderKey === '.' ? [] : folderKey.split('/');
  return {
    folderKey,
    name: folderKey === '.' ? 'Root folder' : parts.at(-1)!,
    depth: parts.length,
    directFileCount: 0,
    totalFileCount: 0,
    visibleFileCount: 0,
    children: [],
  };
}

/** Full canonical folder tree; projection visibility affects counts, not topology. */
export function createFolderScopeTree({
  documentPaths,
  visibleDocumentPaths,
  rules,
}: {
  readonly documentPaths: readonly string[];
  readonly visibleDocumentPaths: ReadonlySet<string>;
  readonly rules: readonly FolderSpatialRule[];
}): FolderScopeTreeNode {
  const nodes = new Map<WorkspaceFolderKey, MutableFolderScopeTreeNode>();
  nodes.set('.', node('.'));
  const uniquePaths = [...new Set(documentPaths)].sort((left, right) =>
    left.localeCompare(right),
  );
  for (const sourcePath of uniquePaths) {
    const folderKey = workspaceFolderKeyFromPath(sourcePath);
    const ancestors = folderAncestors(folderKey);
    for (const ancestor of ancestors) {
      if (!nodes.has(ancestor)) nodes.set(ancestor, node(ancestor));
    }
    nodes.get(folderKey)!.directFileCount += 1;
    for (const ancestor of ancestors) {
      nodes.get(ancestor)!.totalFileCount += 1;
      if (visibleDocumentPaths.has(sourcePath)) {
        nodes.get(ancestor)!.visibleFileCount += 1;
      }
    }
  }
  for (const rule of rules) {
    const existing = nodes.get(rule.folderKey);
    if (existing !== undefined) existing.ownRule = rule;
  }
  for (const candidate of [...nodes.values()].sort(
    (left, right) =>
      left.depth - right.depth || left.folderKey.localeCompare(right.folderKey),
  )) {
    if (candidate.folderKey === '.') continue;
    const slash = candidate.folderKey.lastIndexOf('/');
    const parentKey = (
      slash < 0 ? '.' : candidate.folderKey.slice(0, slash)
    ) as WorkspaceFolderKey;
    nodes.get(parentKey)!.children.push(candidate);
  }
  for (const candidate of nodes.values()) {
    candidate.children.sort((left, right) =>
      left.folderKey.localeCompare(right.folderKey),
    );
  }
  const immutable = new Map<WorkspaceFolderKey, FolderScopeTreeNode>();
  for (const candidate of [...nodes.values()].sort(
    (left, right) => right.depth - left.depth,
  )) {
    immutable.set(
      candidate.folderKey,
      Object.freeze({
        folderKey: candidate.folderKey,
        name: candidate.name,
        depth: candidate.depth,
        directFileCount: candidate.directFileCount,
        totalFileCount: candidate.totalFileCount,
        visibleFileCount: candidate.visibleFileCount,
        ...(candidate.ownRule === undefined
          ? {}
          : { ownRule: candidate.ownRule }),
        children: Object.freeze(
          candidate.children.map((child) => immutable.get(child.folderKey)!),
        ),
      }),
    );
  }
  return immutable.get('.')!;
}

export function findFolderScopeTreeNode(
  root: FolderScopeTreeNode,
  folderKey: WorkspaceFolderKey,
): FolderScopeTreeNode | undefined {
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current.folderKey === folderKey) return current;
    pending.push(...current.children);
  }
  return undefined;
}
