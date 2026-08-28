import type { WorkspacePath } from '@icarus-graph-explorer/core';
import {
  compareWorkspaceText,
  isDiscoveryPathExcluded,
  isMarkdownWorkspacePath,
  normalizeDiscoveryExclude,
  shouldSkipVaultEntry,
  workspacePathFromSegments,
} from '@icarus-graph-explorer/vault-discovery-policy';

import type { NativeFileInfo, TauriNativeBridge } from './bridge';
import type {
  DiscoverSelectedVaultOptions,
  VaultSelection,
  VaultSourceInventory,
} from './types';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

interface InventoryCollector {
  readonly markdownDocuments: Array<{
    path: WorkspacePath;
    source: string;
  }>;
  readonly nonMarkdownPaths: WorkspacePath[];
}

function completedInventory(
  collector: InventoryCollector,
): VaultSourceInventory {
  return {
    markdownDocuments: collector.markdownDocuments.sort((left, right) =>
      compareWorkspaceText(left.path, right.path),
    ),
    nonMarkdownPaths: collector.nonMarkdownPaths.sort(compareWorkspaceText),
  };
}

async function readMarkdown(
  bridge: TauriNativeBridge,
  absolutePath: string,
  path: WorkspacePath,
): Promise<string> {
  let bytes: Uint8Array;
  try {
    bytes = await bridge.readFileBytes(absolutePath);
  } catch (error: unknown) {
    throw new Error(`Cannot read Markdown source ${path}.`, { cause: error });
  }
  try {
    return UTF8_DECODER.decode(bytes);
  } catch (error: unknown) {
    throw new Error(`Markdown source is not valid UTF-8: ${path}.`, {
      cause: error,
    });
  }
}

async function collectFile(
  bridge: TauriNativeBridge,
  absolutePath: string,
  path: WorkspacePath,
  collector: InventoryCollector,
): Promise<void> {
  if (!isMarkdownWorkspacePath(path)) {
    collector.nonMarkdownPaths.push(path);
    return;
  }
  collector.markdownDocuments.push({
    path,
    source: await readMarkdown(bridge, absolutePath, path),
  });
}

async function collectDirectory(
  bridge: TauriNativeBridge,
  selection: VaultSelection,
  absoluteDirectory: string,
  segments: readonly string[],
  excludes: readonly WorkspacePath[],
  collector: InventoryCollector,
): Promise<void> {
  let entries;
  try {
    entries = await bridge.readDirectory(absoluteDirectory);
  } catch (error: unknown) {
    const relative =
      segments.length === 0 ? 'the selected root' : segments.join('/');
    throw new Error(`Cannot read vault directory ${relative}.`, {
      cause: error,
    });
  }
  const sorted = [...entries].sort((left, right) =>
    compareWorkspaceText(left.name, right.name),
  );
  for (const entry of sorted) {
    if (shouldSkipVaultEntry(entry.name, entry.isDirectory)) continue;
    const nextSegments = [...segments, entry.name];
    const path = workspacePathFromSegments(nextSegments);
    if (isDiscoveryPathExcluded(path, excludes) || entry.isSymlink) continue;
    const absolutePath = await bridge.joinPath(
      selection.rootPath,
      ...nextSegments,
    );
    if (entry.isDirectory) {
      await collectDirectory(
        bridge,
        selection,
        absolutePath,
        nextSegments,
        excludes,
        collector,
      );
    } else if (entry.isFile) {
      await collectFile(bridge, absolutePath, path, collector);
    }
  }
}

async function inspect(
  bridge: TauriNativeBridge,
  absolutePath: string,
  description: string,
): Promise<NativeFileInfo> {
  try {
    return await bridge.inspectPath(absolutePath);
  } catch (error: unknown) {
    throw new Error(`${description} cannot be inspected.`, { cause: error });
  }
}

export async function discoverSelectedVault(
  bridge: TauriNativeBridge,
  selection: VaultSelection,
  options: DiscoverSelectedVaultOptions = {},
): Promise<VaultSourceInventory> {
  const rootInfo = await inspect(
    bridge,
    selection.rootPath,
    'The selected vault root',
  );
  if (rootInfo.isSymlink) {
    throw new Error('The selected vault root must not be a symbolic link.');
  }
  if (!rootInfo.isDirectory) {
    throw new Error('The selected vault root is not a directory.');
  }
  const collector: InventoryCollector = {
    markdownDocuments: [],
    nonMarkdownPaths: [],
  };
  await collectDirectory(
    bridge,
    selection,
    selection.rootPath,
    [],
    (options.excludes ?? []).map(normalizeDiscoveryExclude),
    collector,
  );
  return completedInventory(collector);
}

/** Re-observes one bounded workspace-relative file or directory subtree. */
export async function discoverSelectedVaultSubtree(
  bridge: TauriNativeBridge,
  selection: VaultSelection,
  path: WorkspacePath,
  options: DiscoverSelectedVaultOptions = {},
): Promise<VaultSourceInventory> {
  const segments = path.split('/');
  workspacePathFromSegments(segments);
  const excludes = (options.excludes ?? []).map(normalizeDiscoveryExclude);
  if (isDiscoveryPathExcluded(path, excludes)) {
    return { markdownDocuments: [], nonMarkdownPaths: [] };
  }
  const absolutePath = await bridge.joinPath(selection.rootPath, ...segments);
  const info = await inspect(bridge, absolutePath, `Vault path ${path}`);
  if (info.isSymlink) {
    return { markdownDocuments: [], nonMarkdownPaths: [] };
  }
  const collector: InventoryCollector = {
    markdownDocuments: [],
    nonMarkdownPaths: [],
  };
  if (info.isDirectory) {
    await collectDirectory(
      bridge,
      selection,
      absolutePath,
      segments,
      excludes,
      collector,
    );
  } else if (info.isFile) {
    await collectFile(bridge, absolutePath, path, collector);
  } else {
    throw new Error(`Vault path ${path} is not a regular file or directory.`);
  }
  return completedInventory(collector);
}
