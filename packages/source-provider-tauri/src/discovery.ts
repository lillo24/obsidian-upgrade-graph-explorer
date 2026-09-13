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
import {
  createVaultDiscoveryTracker,
  type VaultDiscoveryTracker,
} from './discovery-progress';
import type {
  DiscoverSelectedVaultOptions,
  VaultSelection,
  VaultSourceInventory,
} from './types';
import { VaultDiscoveryTimeoutError } from './types';

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
  tracker: VaultDiscoveryTracker,
): Promise<string> {
  let bytes: Uint8Array;
  try {
    bytes = await tracker.operation('read-markdown', path, () =>
      bridge.readFileBytes(absolutePath),
    );
  } catch (error: unknown) {
    if (error instanceof VaultDiscoveryTimeoutError) throw error;
    throw new Error(`Cannot read Markdown source ${path}.`, { cause: error });
  }
  tracker.recordMarkdownRead(bytes.byteLength);
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
  tracker: VaultDiscoveryTracker,
): Promise<void> {
  if (!isMarkdownWorkspacePath(path)) {
    collector.nonMarkdownPaths.push(path);
    tracker.recordNonMarkdownFile();
    return;
  }
  collector.markdownDocuments.push({
    path,
    source: await readMarkdown(bridge, absolutePath, path, tracker),
  });
}

async function collectDirectory(
  bridge: TauriNativeBridge,
  selection: VaultSelection,
  absoluteDirectory: string,
  segments: readonly string[],
  excludes: readonly WorkspacePath[],
  collector: InventoryCollector,
  tracker: VaultDiscoveryTracker,
): Promise<void> {
  tracker.setRecursionDepth(segments.length);
  let entries;
  try {
    const workspacePath =
      segments.length === 0 ? '.' : workspacePathFromSegments(segments);
    entries = await tracker.operation('read-directory', workspacePath, () =>
      bridge.readDirectory(absoluteDirectory),
    );
  } catch (error: unknown) {
    if (error instanceof VaultDiscoveryTimeoutError) throw error;
    const relative =
      segments.length === 0 ? 'the selected root' : segments.join('/');
    throw new Error(`Cannot read vault directory ${relative}.`, {
      cause: error,
    });
  }
  tracker.recordDirectoryRead();
  const sorted = [...entries].sort((left, right) =>
    compareWorkspaceText(left.name, right.name),
  );
  for (const entry of sorted) {
    tracker.examineEntry();
    if (shouldSkipVaultEntry(entry.name, entry.isDirectory)) continue;
    const nextSegments = [...segments, entry.name];
    const path = workspacePathFromSegments(nextSegments);
    if (isDiscoveryPathExcluded(path, excludes) || entry.isSymlink) continue;
    const absolutePath = await tracker.operation('join-path', path, () =>
      bridge.joinPath(selection.rootPath, ...nextSegments),
    );
    if (entry.isDirectory) {
      await collectDirectory(
        bridge,
        selection,
        absolutePath,
        nextSegments,
        excludes,
        collector,
        tracker,
      );
      tracker.setRecursionDepth(segments.length);
    } else if (entry.isFile) {
      await collectFile(bridge, absolutePath, path, collector, tracker);
    }
  }
}

async function inspect(
  bridge: TauriNativeBridge,
  absolutePath: string,
  description: string,
  operation: 'inspect-root' | 'inspect-path',
  workspacePath: WorkspacePath | '.',
  tracker: VaultDiscoveryTracker,
): Promise<NativeFileInfo> {
  try {
    return await tracker.operation(operation, workspacePath, () =>
      bridge.inspectPath(absolutePath),
    );
  } catch (error: unknown) {
    if (error instanceof VaultDiscoveryTimeoutError) throw error;
    throw new Error(`${description} cannot be inspected.`, { cause: error });
  }
}

export async function discoverSelectedVault(
  bridge: TauriNativeBridge,
  selection: VaultSelection,
  options: DiscoverSelectedVaultOptions = {},
): Promise<VaultSourceInventory> {
  const tracker = createVaultDiscoveryTracker(options);
  const rootInfo = await inspect(
    bridge,
    selection.rootPath,
    'The selected vault root',
    'inspect-root',
    '.',
    tracker,
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
    tracker,
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
  const tracker = createVaultDiscoveryTracker(options);
  const absolutePath = await tracker.operation('join-path', path, () =>
    bridge.joinPath(selection.rootPath, ...segments),
  );
  const info = await inspect(
    bridge,
    absolutePath,
    `Vault path ${path}`,
    'inspect-path',
    path,
    tracker,
  );
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
      tracker,
    );
  } else if (info.isFile) {
    await collectFile(bridge, absolutePath, path, collector, tracker);
  } else {
    throw new Error(`Vault path ${path} is not a regular file or directory.`);
  }
  return completedInventory(collector);
}
