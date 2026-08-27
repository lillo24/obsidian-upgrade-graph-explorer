import {
  serializePersistedWorkspaceView,
  validatePersistedWorkspaceView,
  type PersistedWorkspaceView,
} from '@icarus-graph-explorer/view-state';

export interface StorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export type LoadWorkspaceViewResult =
  | { readonly status: 'empty' }
  | { readonly status: 'loaded'; readonly value: PersistedWorkspaceView }
  | { readonly status: 'error'; readonly message: string };

export type StorageMutationResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

const STORAGE_KEY_PREFIX = 'icarus-graph-explorer:view-state:';

export function workspaceViewStorageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(workspaceId)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function browserStorage(): StorageLike | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadWorkspaceView(
  storage: StorageLike,
  workspaceId: string,
): LoadWorkspaceViewResult {
  const key = workspaceViewStorageKey(workspaceId);
  let serialized: string | null;
  try {
    serialized = storage.getItem(key);
  } catch (error: unknown) {
    return {
      status: 'error',
      message: `Could not read the saved view for workspace "${workspaceId}": ${errorMessage(error)}`,
    };
  }
  if (serialized === null) return { status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error: unknown) {
    return {
      status: 'error',
      message: `The saved view for workspace "${workspaceId}" is not valid JSON: ${errorMessage(error)}`,
    };
  }
  const validation = validatePersistedWorkspaceView(parsed);
  if (!validation.valid) {
    const first = validation.issues[0];
    return {
      status: 'error',
      message: `The saved view for workspace "${workspaceId}" is incompatible${first === undefined ? '.' : ` at ${first.path}: ${first.message}`}`,
    };
  }
  return { status: 'loaded', value: validation.value };
}

export function saveWorkspaceView(
  storage: StorageLike,
  value: PersistedWorkspaceView,
): StorageMutationResult {
  try {
    storage.setItem(
      workspaceViewStorageKey(value.workspaceId),
      serializePersistedWorkspaceView(value),
    );
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not save the view for workspace "${value.workspaceId}": ${errorMessage(error)}`,
    };
  }
}

export function clearWorkspaceView(
  storage: StorageLike,
  workspaceId: string,
): StorageMutationResult {
  try {
    storage.removeItem(workspaceViewStorageKey(workspaceId));
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not reset the saved view for workspace "${workspaceId}": ${errorMessage(error)}`,
    };
  }
}
