import {
  createEmptyPresentationOverrideRegistry,
  serializePresentationOverrideRegistry,
  validatePresentationOverrideRegistry,
  type PresentationOverrideRegistry,
} from '@icarus-graph-explorer/presentation-overrides';

import type { StorageLike } from './storage';

export function presentationOverrideStorageKey(workspaceId: string): string {
  return `icarus-graph-explorer:presentation-overrides:${encodeURIComponent(workspaceId)}`;
}

export type PresentationOverrideLoadResult =
  | { readonly ok: true; readonly value: PresentationOverrideRegistry }
  | {
      readonly ok: false;
      readonly kind: 'storage' | 'corrupt';
      readonly message: string;
    };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function loadPresentationOverrides(
  storage: StorageLike,
  workspaceId: string,
): PresentationOverrideLoadResult {
  let serialized: string | null;
  try {
    serialized = storage.getItem(presentationOverrideStorageKey(workspaceId));
  } catch (error: unknown) {
    return {
      ok: false,
      kind: 'storage',
      message: `Could not read Network sizes for workspace ${JSON.stringify(workspaceId)}: ${errorMessage(error)}`,
    };
  }
  if (serialized === null)
    return {
      ok: true,
      value: createEmptyPresentationOverrideRegistry(workspaceId),
    };
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error: unknown) {
    if (!(error instanceof SyntaxError)) throw error;
    return {
      ok: false,
      kind: 'corrupt',
      message: `Saved Network sizes for workspace ${JSON.stringify(workspaceId)} are not valid JSON: ${error.message}`,
    };
  }
  const result = validatePresentationOverrideRegistry(parsed, workspaceId);
  return result.ok
    ? result
    : {
        ...result,
        kind: 'corrupt',
        message: `Saved Network sizes for workspace ${JSON.stringify(workspaceId)} are incompatible: ${result.message}`,
      };
}

export function savePresentationOverrides(
  storage: StorageLike,
  registry: PresentationOverrideRegistry,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  // Validation failures are programming errors, not storage failures.
  const serialized = serializePresentationOverrideRegistry(registry);
  try {
    storage.setItem(
      presentationOverrideStorageKey(registry.workspaceId),
      serialized,
    );
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not save Network sizes for workspace ${JSON.stringify(registry.workspaceId)}: ${errorMessage(error)}`,
    };
  }
}
