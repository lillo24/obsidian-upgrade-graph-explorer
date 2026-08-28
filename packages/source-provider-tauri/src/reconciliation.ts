import type { WorkspacePath } from '@icarus-graph-explorer/core';
import {
  compareWorkspaceText,
  isDiscoveryPathExcluded,
  normalizeDiscoveryExclude,
  workspacePathFromSegments,
} from '@icarus-graph-explorer/vault-discovery-policy';

import type { TauriNativeBridge } from './bridge';
import { discoverSelectedVaultSubtree } from './discovery';
import type {
  DiscoverSelectedVaultOptions,
  ReconcileSelectedVaultChangesInput,
  VaultChangeReconciliationResult,
  VaultSourceChange,
  VaultSourceInventory,
} from './types';

function isAtOrBelow(path: WorkspacePath, prefix: WorkspacePath): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function validatePath(path: WorkspacePath, description: string): void {
  try {
    workspacePathFromSegments(path.split('/'));
  } catch (error: unknown) {
    throw new Error(`${description} contains an invalid workspace path.`, {
      cause: error,
    });
  }
}

function inventoryMaps(inventory: VaultSourceInventory): {
  markdown: Map<WorkspacePath, string>;
  nonMarkdown: Set<WorkspacePath>;
} {
  const markdown = new Map<WorkspacePath, string>();
  const nonMarkdown = new Set<WorkspacePath>();
  for (const document of inventory.markdownDocuments) {
    validatePath(document.path, 'The previous Markdown inventory');
    if (markdown.has(document.path)) {
      throw new Error(
        `The previous Markdown inventory contains duplicate path ${document.path}.`,
      );
    }
    markdown.set(document.path, document.source);
  }
  for (const path of inventory.nonMarkdownPaths) {
    validatePath(path, 'The previous non-Markdown inventory');
    if (nonMarkdown.has(path) || markdown.has(path)) {
      throw new Error(
        `The previous inventory contains duplicate path ${path}.`,
      );
    }
    nonMarkdown.add(path);
  }
  return { markdown, nonMarkdown };
}

function minimalPrefixes(paths: readonly WorkspacePath[]): WorkspacePath[] {
  const sorted = [...new Set(paths)].sort(compareWorkspaceText);
  return sorted.filter(
    (path, index) =>
      !sorted.slice(0, index).some((prefix) => isAtOrBelow(path, prefix)),
  );
}

function ignoredPath(
  path: WorkspacePath,
  excludes: readonly WorkspacePath[],
): boolean {
  return (
    path
      .split('/')
      .some(
        (segment) => segment.startsWith('.') || segment === 'node_modules',
      ) || isDiscoveryPathExcluded(path, excludes)
  );
}

function countSources(
  markdown: ReadonlyMap<WorkspacePath, string>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const source of markdown.values()) {
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return counts;
}

function changePath(change: VaultSourceChange): string {
  return change.kind === 'move'
    ? `${change.fromPath}\0${change.toPath}`
    : change.path;
}

function compareChanges(
  left: VaultSourceChange,
  right: VaultSourceChange,
): number {
  const pathOrder = compareWorkspaceText(changePath(left), changePath(right));
  if (pathOrder !== 0) return pathOrder;
  return compareWorkspaceText(left.kind, right.kind);
}

function planMarkdownChanges(
  previous: ReadonlyMap<WorkspacePath, string>,
  next: ReadonlyMap<WorkspacePath, string>,
): readonly VaultSourceChange[] {
  const deleted = [...previous]
    .filter(([path]) => !next.has(path))
    .map(([path, source]) => ({ path, source }));
  const added = [...next]
    .filter(([path]) => !previous.has(path))
    .map(([path, source]) => ({ path, source }));
  const previousCounts = countSources(previous);
  const nextCounts = countSources(next);
  const usedAdded = new Set<WorkspacePath>();
  const usedDeleted = new Set<WorkspacePath>();
  const changes: VaultSourceChange[] = [];

  for (const removed of deleted) {
    if (
      previousCounts.get(removed.source) !== 1 ||
      nextCounts.get(removed.source) !== 1
    ) {
      continue;
    }
    const destination = added.find(
      (candidate) =>
        !usedAdded.has(candidate.path) && candidate.source === removed.source,
    );
    if (destination === undefined) continue;
    usedDeleted.add(removed.path);
    usedAdded.add(destination.path);
    changes.push({
      kind: 'move',
      fromPath: removed.path,
      toPath: destination.path,
    });
  }

  for (const removed of deleted) {
    if (!usedDeleted.has(removed.path)) {
      changes.push({ kind: 'delete', path: removed.path });
    }
  }
  for (const candidate of added) {
    if (!usedAdded.has(candidate.path)) {
      changes.push({
        kind: 'upsert',
        path: candidate.path,
        source: candidate.source,
      });
    }
  }
  for (const [path, source] of next) {
    const priorSource = previous.get(path);
    if (priorSource !== undefined && priorSource !== source) {
      changes.push({ kind: 'upsert', path, source });
    }
  }
  return changes.sort(compareChanges);
}

function samePaths(
  left: ReadonlySet<WorkspacePath>,
  right: ReadonlySet<WorkspacePath>,
): boolean {
  if (left.size !== right.size) return false;
  return [...left].every((path) => right.has(path));
}

function resyncReason(reasons: readonly string[]): string {
  return reasons.length === 0
    ? 'The watcher reported a change that cannot be reconciled safely.'
    : [...new Set(reasons)].sort(compareWorkspaceText).join(' ');
}

export async function reconcileSelectedVaultChanges(
  bridge: TauriNativeBridge,
  input: ReconcileSelectedVaultChangesInput,
  options: DiscoverSelectedVaultOptions = {},
): Promise<VaultChangeReconciliationResult> {
  const previous = inventoryMaps(input.previousInventory);
  const validBatchPaths: WorkspacePath[] = [];
  for (const path of input.watchBatch.paths) {
    try {
      validatePath(path, 'The watch batch');
      validBatchPaths.push(path);
    } catch {
      return {
        status: 'resync-required',
        reason: 'The watch batch contains an unsafe workspace-relative path.',
        affectedPaths: [],
      };
    }
  }
  const excludes = (options.excludes ?? []).map(normalizeDiscoveryExclude);
  const affectedPaths = minimalPrefixes(
    validBatchPaths.filter((path) => !ignoredPath(path, excludes)),
  );
  if (input.watchBatch.requiresResync) {
    return {
      status: 'resync-required',
      reason: resyncReason(input.watchBatch.reasons),
      affectedPaths,
    };
  }

  const nextMarkdown = new Map(previous.markdown);
  const nextNonMarkdown = new Set(previous.nonMarkdown);
  for (const path of affectedPaths) {
    for (const knownPath of [...nextMarkdown.keys()]) {
      if (isAtOrBelow(knownPath, path)) nextMarkdown.delete(knownPath);
    }
    for (const knownPath of [...nextNonMarkdown]) {
      if (isAtOrBelow(knownPath, path)) nextNonMarkdown.delete(knownPath);
    }

    let exists: boolean;
    const absolutePath = await bridge.joinPath(
      input.selection.rootPath,
      ...path.split('/'),
    );
    try {
      exists = await bridge.pathExists(absolutePath);
    } catch {
      return {
        status: 'resync-required',
        reason: `Cannot determine whether changed vault path ${path} still exists.`,
        affectedPaths,
      };
    }
    if (!exists) continue;

    let observed: VaultSourceInventory;
    try {
      observed = await discoverSelectedVaultSubtree(
        bridge,
        input.selection,
        path,
        options,
      );
    } catch (error: unknown) {
      const detail =
        error instanceof Error ? error.message : 'Observation failed.';
      return {
        status: 'resync-required',
        reason: `Cannot reconcile changed vault path ${path}: ${detail}`,
        affectedPaths,
      };
    }
    for (const document of observed.markdownDocuments) {
      nextMarkdown.set(document.path, document.source);
    }
    for (const nonMarkdownPath of observed.nonMarkdownPaths) {
      nextNonMarkdown.add(nonMarkdownPath);
    }
  }

  const nextInventory: VaultSourceInventory = {
    markdownDocuments: [...nextMarkdown]
      .map(([path, source]) => ({ path, source }))
      .sort((left, right) => compareWorkspaceText(left.path, right.path)),
    nonMarkdownPaths: [...nextNonMarkdown].sort(compareWorkspaceText),
  };
  return {
    status: 'planned',
    plan: {
      markdownChanges: planMarkdownChanges(previous.markdown, nextMarkdown),
      nextInventory,
      nonMarkdownChanged: !samePaths(previous.nonMarkdown, nextNonMarkdown),
      affectedPaths,
    },
  };
}
