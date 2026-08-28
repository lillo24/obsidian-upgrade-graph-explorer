import type { WorkspacePath } from '@icarus-graph-explorer/core';
import {
  compareWorkspaceText,
  isDiscoveryPathExcluded,
  normalizeDiscoveryExclude,
  workspacePathFromSegments,
} from '@icarus-graph-explorer/vault-discovery-policy';

import type { TauriNativeBridge } from './bridge';
import type { VaultSelection } from './types';

export interface WatchPathNormalization {
  readonly paths: readonly WorkspacePath[];
  readonly requiresResync: boolean;
  readonly reasons: readonly string[];
}

function slashPath(value: string): string {
  const replaced = value.replaceAll('\\', '/');
  const prefix = replaced.startsWith('//')
    ? '//'
    : replaced.startsWith('/')
      ? '/'
      : '';
  const body = replaced
    .slice(prefix.length)
    .replace(/\/{2,}/gu, '/')
    .replace(/\/+$/u, '');
  return `${prefix}${body}` || prefix || '.';
}

function isWindowsPath(value: string): boolean {
  return /^[A-Za-z]:(?:\/|$)/u.test(value) || value.startsWith('//');
}

function relativeToRoot(
  rootPath: string,
  eventPath: string,
): string | undefined {
  const root = slashPath(rootPath);
  const candidate = slashPath(eventPath);
  const caseInsensitive = isWindowsPath(root);
  const comparedRoot = caseInsensitive ? root.toLocaleLowerCase('en-US') : root;
  const comparedCandidate = caseInsensitive
    ? candidate.toLocaleLowerCase('en-US')
    : candidate;
  if (comparedCandidate === comparedRoot) return '';
  const prefix = root.endsWith('/') ? root : `${root}/`;
  const comparedPrefix = caseInsensitive
    ? prefix.toLocaleLowerCase('en-US')
    : prefix;
  if (!comparedCandidate.startsWith(comparedPrefix)) return undefined;
  return candidate.slice(prefix.length);
}

function ignoredPath(
  path: WorkspacePath,
  excludes: readonly WorkspacePath[],
): boolean {
  const segments = path.split('/');
  return (
    segments.some(
      (segment) => segment.startsWith('.') || segment === 'node_modules',
    ) || isDiscoveryPathExcluded(path, excludes)
  );
}

export async function normalizeNativeWatchPaths(
  bridge: TauriNativeBridge,
  selection: VaultSelection,
  nativePaths: readonly string[],
  configuredExcludes: readonly string[] = [],
): Promise<WatchPathNormalization> {
  const excludes = configuredExcludes.map(normalizeDiscoveryExclude);
  const paths = new Set<WorkspacePath>();
  const reasons = new Set<string>();
  let requiresResync = false;
  let root: string;
  try {
    root = await bridge.normalizePath(selection.rootPath);
  } catch {
    return {
      paths: [],
      requiresResync: true,
      reasons: [
        'The selected vault root could not be normalized for watching.',
      ],
    };
  }

  for (const nativePath of nativePaths) {
    let normalized: string;
    try {
      normalized = await bridge.normalizePath(nativePath);
    } catch {
      requiresResync = true;
      reasons.add('A watcher path could not be normalized safely.');
      continue;
    }
    const relative = relativeToRoot(root, normalized);
    if (relative === undefined) {
      requiresResync = true;
      reasons.add('The watcher reported a path outside the selected vault.');
      continue;
    }
    if (relative === '') {
      requiresResync = true;
      reasons.add('The watcher reported an unbounded selected-root change.');
      continue;
    }
    let workspacePath: WorkspacePath;
    try {
      workspacePath = workspacePathFromSegments(relative.split('/'));
    } catch {
      requiresResync = true;
      reasons.add('The watcher reported an unsafe workspace-relative path.');
      continue;
    }
    if (!ignoredPath(workspacePath, excludes)) paths.add(workspacePath);
  }

  return {
    paths: [...paths].sort(compareWorkspaceText),
    requiresResync,
    reasons: [...reasons].sort(compareWorkspaceText),
  };
}
