import {
  createEmptySpatialOverrideRegistry,
  serializeSpatialOverrideRegistry,
  validateSpatialOverrideRegistry,
  type SpatialOverrideRegistry,
} from '@icarus-graph-explorer/spatial-overrides';

import type { StorageLike } from './storage';

export function spatialOverrideStorageKey(workspaceId: string): string {
  return `icarus-graph-explorer:spatial-overrides:${encodeURIComponent(workspaceId)}`;
}

export type SpatialOverrideLoadResult =
  | { readonly ok: true; readonly value: SpatialOverrideRegistry }
  | {
      readonly ok: false;
      readonly kind: 'storage' | 'corrupt';
      readonly message: string;
    };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function loadSpatialOverrides(
  storage: StorageLike,
  workspaceId: string,
): SpatialOverrideLoadResult {
  let serialized: string | null;
  try {
    serialized = storage.getItem(spatialOverrideStorageKey(workspaceId));
  } catch (error: unknown) {
    return {
      ok: false,
      kind: 'storage',
      message: `Could not read spatial overrides for workspace ${JSON.stringify(workspaceId)}: ${errorMessage(error)}`,
    };
  }
  if (serialized === null) {
    return {
      ok: true,
      value: createEmptySpatialOverrideRegistry(workspaceId),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error: unknown) {
    if (!(error instanceof SyntaxError)) throw error;
    return {
      ok: false,
      kind: 'corrupt',
      message: `Saved spatial overrides for workspace ${JSON.stringify(workspaceId)} are not valid JSON: ${error.message}`,
    };
  }
  const result = validateSpatialOverrideRegistry(parsed, workspaceId);
  return result.ok
    ? result
    : {
        ok: false,
        kind: 'corrupt',
        message: `Saved spatial overrides for workspace ${JSON.stringify(workspaceId)} are incompatible: ${result.message}`,
      };
}

export function saveSpatialOverrides(
  storage: StorageLike,
  registry: SpatialOverrideRegistry,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  const serialized = serializeSpatialOverrideRegistry(registry);
  try {
    storage.setItem(
      spatialOverrideStorageKey(registry.workspaceId),
      serialized,
    );
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not save spatial overrides for workspace ${JSON.stringify(registry.workspaceId)}: ${errorMessage(error)}`,
    };
  }
}

export function clearSpatialOverrides(
  storage: StorageLike,
  workspaceId: string,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  try {
    storage.removeItem(spatialOverrideStorageKey(workspaceId));
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not reset spatial overrides for workspace ${JSON.stringify(workspaceId)}: ${errorMessage(error)}`,
    };
  }
}
