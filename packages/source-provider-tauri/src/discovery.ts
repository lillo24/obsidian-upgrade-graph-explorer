import type { WorkspacePath } from '@icarus-graph-explorer/core';
import {
  compareWorkspaceText,
  isDiscoveryPathExcluded,
  isMarkdownWorkspacePath,
  normalizeDiscoveryExclude,
  shouldSkipVaultEntry,
  workspacePathFromSegments,
} from '@icarus-graph-explorer/vault-discovery-policy';

import type { TauriNativeBridge } from './bridge';
import type {
  DiscoverSelectedVaultOptions,
  VaultSelection,
  VaultSourceInventory,
} from './types';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

export async function discoverSelectedVault(
  bridge: TauriNativeBridge,
  selection: VaultSelection,
  options: DiscoverSelectedVaultOptions = {},
): Promise<VaultSourceInventory> {
  let rootInfo;
  try {
    rootInfo = await bridge.inspectPath(selection.rootPath);
  } catch (error: unknown) {
    throw new Error('The selected vault root cannot be inspected.', {
      cause: error,
    });
  }
  if (rootInfo.isSymlink) {
    throw new Error('The selected vault root must not be a symbolic link.');
  }
  if (!rootInfo.isDirectory) {
    throw new Error('The selected vault root is not a directory.');
  }

  const excludes = (options.excludes ?? []).map(normalizeDiscoveryExclude);
  const markdownDocuments: Array<{
    path: WorkspacePath;
    source: string;
  }> = [];
  const nonMarkdownPaths: WorkspacePath[] = [];

  async function walk(
    absoluteDirectory: string,
    segments: readonly string[],
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
      if (isDiscoveryPathExcluded(path, excludes)) continue;
      if (entry.isSymlink) continue;
      const absolutePath = await bridge.joinPath(
        selection.rootPath,
        ...nextSegments,
      );
      if (entry.isDirectory) {
        await walk(absolutePath, nextSegments);
        continue;
      }
      if (!entry.isFile) continue;
      if (!isMarkdownWorkspacePath(path)) {
        nonMarkdownPaths.push(path);
        continue;
      }
      let bytes;
      try {
        bytes = await bridge.readFileBytes(absolutePath);
      } catch (error: unknown) {
        throw new Error(`Cannot read Markdown source ${path}.`, {
          cause: error,
        });
      }
      try {
        markdownDocuments.push({ path, source: UTF8_DECODER.decode(bytes) });
      } catch (error: unknown) {
        throw new Error(`Markdown source is not valid UTF-8: ${path}.`, {
          cause: error,
        });
      }
    }
  }

  await walk(selection.rootPath, []);
  return {
    markdownDocuments: markdownDocuments.sort((left, right) =>
      compareWorkspaceText(left.path, right.path),
    ),
    nonMarkdownPaths: nonMarkdownPaths.sort(compareWorkspaceText),
  };
}
