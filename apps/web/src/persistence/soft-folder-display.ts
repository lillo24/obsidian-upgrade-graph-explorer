import {
  canonicalFocusSchematicSoftFolderDisplayIntent,
  EMPTY_FOCUS_SCHEMATIC_SOFT_FOLDER_DISPLAY_INTENT,
  validateFocusSchematicSoftFolderDisplayIntent,
  type FocusSchematicSoftFolderDisplayIntent,
} from '@icarus-graph-explorer/focus-schematic-layout';

import type { StorageLike } from './storage';

export const SOFT_FOLDER_DISPLAY_REGISTRY_SCHEMA_VERSION = 2 as const;

export interface SoftFolderDisplayRegistry {
  readonly schemaVersion: typeof SOFT_FOLDER_DISPLAY_REGISTRY_SCHEMA_VERSION;
  readonly workspaceId: string;
  readonly displayIntent: FocusSchematicSoftFolderDisplayIntent;
}

export type SoftFolderDisplayLoadResult =
  | {
      readonly ok: true;
      readonly value: SoftFolderDisplayRegistry;
      readonly legacyReset: boolean;
    }
  | {
      readonly ok: false;
      readonly kind: 'storage' | 'corrupt';
      readonly message: string;
    };

/** The key remains stable so schema 1 can be reset narrowly in place. */
export function softFolderDisplayStorageKey(workspaceId: string): string {
  return `icarus-graph-explorer:soft-folder-scope:${encodeURIComponent(workspaceId)}`;
}

export function createEmptySoftFolderDisplayRegistry(
  workspaceId: string,
): SoftFolderDisplayRegistry {
  if (workspaceId.length === 0)
    throw new Error('Workspace identity is required.');
  return {
    schemaVersion: SOFT_FOLDER_DISPLAY_REGISTRY_SCHEMA_VERSION,
    workspaceId,
    displayIntent: EMPTY_FOCUS_SCHEMATIC_SOFT_FOLDER_DISPLAY_INTENT,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function validateSoftFolderDisplayRegistry(
  value: unknown,
  expectedWorkspaceId: string,
):
  | { readonly ok: true; readonly value: SoftFolderDisplayRegistry }
  | { readonly ok: false; readonly message: string } {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return { ok: false, message: 'Registry must be a plain object.' };
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join('|') !==
    'displayIntent|schemaVersion|workspaceId'
  )
    return { ok: false, message: 'Registry fields are invalid.' };
  if (record.schemaVersion !== SOFT_FOLDER_DISPLAY_REGISTRY_SCHEMA_VERSION)
    return { ok: false, message: 'Registry schema version is unsupported.' };
  if (
    typeof record.workspaceId !== 'string' ||
    record.workspaceId.length === 0 ||
    record.workspaceId !== expectedWorkspaceId
  )
    return {
      ok: false,
      message:
        'Registry workspace identity does not match the active workspace.',
    };
  const validation = validateFocusSchematicSoftFolderDisplayIntent(
    record.displayIntent,
  );
  if (!validation.valid)
    return {
      ok: false,
      message: `Registry display intent is invalid: ${validation.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    };
  return {
    ok: true,
    value: {
      schemaVersion: SOFT_FOLDER_DISPLAY_REGISTRY_SCHEMA_VERSION,
      workspaceId: record.workspaceId,
      displayIntent: validation.value,
    },
  };
}

export function serializeSoftFolderDisplayRegistry(
  registry: SoftFolderDisplayRegistry,
): string {
  const validation = validateSoftFolderDisplayRegistry(
    registry,
    registry.workspaceId,
  );
  if (!validation.ok) throw new Error(validation.message);
  return JSON.stringify({
    schemaVersion: SOFT_FOLDER_DISPLAY_REGISTRY_SCHEMA_VERSION,
    workspaceId: registry.workspaceId,
    displayIntent: canonicalFocusSchematicSoftFolderDisplayIntent(
      registry.displayIntent,
    ),
  });
}

export function loadSoftFolderDisplay(
  storage: StorageLike,
  workspaceId: string,
): SoftFolderDisplayLoadResult {
  let serialized: string | null;
  try {
    serialized = storage.getItem(softFolderDisplayStorageKey(workspaceId));
  } catch (error: unknown) {
    return {
      ok: false,
      kind: 'storage',
      message: `Could not read Soft folder display for workspace ${JSON.stringify(workspaceId)}: ${errorMessage(error)}`,
    };
  }
  if (serialized === null)
    return {
      ok: true,
      value: createEmptySoftFolderDisplayRegistry(workspaceId),
      legacyReset: false,
    };
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error: unknown) {
    if (!(error instanceof SyntaxError)) throw error;
    return {
      ok: false,
      kind: 'corrupt',
      message: `Saved Soft folder display for workspace ${JSON.stringify(workspaceId)} is not valid JSON: ${error.message}`,
    };
  }
  const parsedRecord =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  if (
    parsedRecord?.schemaVersion === 1 &&
    parsedRecord.workspaceId === workspaceId
  )
    return {
      ok: true,
      value: createEmptySoftFolderDisplayRegistry(workspaceId),
      legacyReset: true,
    };
  const validation = validateSoftFolderDisplayRegistry(parsed, workspaceId);
  return validation.ok
    ? { ...validation, legacyReset: false }
    : {
        ok: false,
        kind: 'corrupt',
        message: `Saved Soft folder display for workspace ${JSON.stringify(workspaceId)} is incompatible: ${validation.message}`,
      };
}

export function saveSoftFolderDisplay(
  storage: StorageLike,
  registry: SoftFolderDisplayRegistry,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  const serialized = serializeSoftFolderDisplayRegistry(registry);
  try {
    storage.setItem(
      softFolderDisplayStorageKey(registry.workspaceId),
      serialized,
    );
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not save Soft folder display for workspace ${JSON.stringify(registry.workspaceId)}: ${errorMessage(error)}`,
    };
  }
}
