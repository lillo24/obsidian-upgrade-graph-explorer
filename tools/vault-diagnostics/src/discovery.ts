import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

import type { WorkspacePath } from '@icarus-graph-explorer/core';
import {
  compareWorkspaceText,
  isDiscoveryPathExcluded,
  isMarkdownWorkspacePath,
  normalizeDiscoveryExclude,
  shouldSkipVaultEntry,
} from '@icarus-graph-explorer/vault-discovery-policy';

import type { VaultDiscovery } from './types';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function workspacePath(value: string): WorkspacePath {
  return value.split(sep).join('/');
}

/** Discover and read a complete UTF-8 Markdown inventory without following symlinks. */
export async function discoverVault(
  vaultPath: string,
  configuredExcludes: readonly string[],
): Promise<VaultDiscovery> {
  const root = resolve(vaultPath);
  let rootStats;
  try {
    rootStats = await stat(root);
  } catch (error: unknown) {
    throw new Error(
      `Vault root does not exist or cannot be inspected: ${root}`,
      {
        cause: error,
      },
    );
  }
  if (!rootStats.isDirectory()) {
    throw new Error(`Vault root is not a directory: ${root}`);
  }
  const canonicalRoot = await realpath(root);
  const excludes = configuredExcludes.map(normalizeDiscoveryExclude);
  const markdownDocuments: Array<{ path: WorkspacePath; source: string }> = [];
  const nonMarkdownPaths: WorkspacePath[] = [];

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error: unknown) {
      throw new Error(`Cannot read vault directory: ${directory}`, {
        cause: error,
      });
    }
    entries.sort((left, right) => compareWorkspaceText(left.name, right.name));

    for (const entry of entries) {
      if (shouldSkipVaultEntry(entry.name, entry.isDirectory())) continue;
      const absolutePath = resolve(directory, entry.name);
      const path = workspacePath(relative(canonicalRoot, absolutePath));
      if (
        path.startsWith('../') ||
        path === '..' ||
        isDiscoveryPathExcluded(path, excludes)
      ) {
        continue;
      }
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (isMarkdownWorkspacePath(path)) {
        let bytes;
        try {
          bytes = await readFile(absolutePath);
        } catch (error: unknown) {
          throw new Error(`Cannot read Markdown source: ${path}`, {
            cause: error,
          });
        }
        let source: string;
        try {
          source = UTF8_DECODER.decode(bytes);
        } catch (error: unknown) {
          throw new Error(`Markdown source is not valid UTF-8: ${path}`, {
            cause: error,
          });
        }
        markdownDocuments.push({ path, source });
      } else {
        nonMarkdownPaths.push(path);
      }
    }
  }

  await walk(canonicalRoot);
  return {
    markdownDocuments: markdownDocuments.sort((left, right) =>
      compareWorkspaceText(left.path, right.path),
    ),
    nonMarkdownPaths: nonMarkdownPaths.sort(compareWorkspaceText),
  };
}
