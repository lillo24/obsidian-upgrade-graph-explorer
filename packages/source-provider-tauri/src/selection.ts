import type { TauriNativeBridge } from './bridge';
import type { VaultSelection } from './types';

function trimTrailingSeparators(path: string): string {
  const trimmed = path.replace(/[/\\]+$/u, '');
  return trimmed.length === 0 ? path : trimmed;
}

export async function normalizedRootPath(
  bridge: TauriNativeBridge,
  rootPath: string,
): Promise<string> {
  if (!(await bridge.isAbsolute(rootPath))) {
    throw new Error('The selected vault path must be absolute.');
  }
  const normalized = trimTrailingSeparators(
    await bridge.normalizePath(rootPath),
  );
  if (normalized.trim() === '') {
    throw new Error('The selected vault path is empty after normalization.');
  }
  return normalized;
}

export async function selectVaultDirectory(
  bridge: TauriNativeBridge,
): Promise<VaultSelection | undefined> {
  const selected = await bridge.selectDirectory();
  if (selected === undefined) return undefined;
  const rootPath = await normalizedRootPath(bridge, selected);
  const displayName = await bridge.basename(rootPath);
  if (displayName.trim() === '') {
    throw new Error('The selected vault has no safe display name.');
  }
  return { rootPath, displayName };
}
