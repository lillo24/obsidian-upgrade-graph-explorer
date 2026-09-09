import {
  canonicalFocusSchematicSoftFolderScopeOverrides,
  validateFocusSchematicSoftFolderScopeOverrides,
  type FocusSchematicSoftFolderScopeOverride,
} from '@icarus-graph-explorer/focus-schematic-layout';

import type { StorageLike } from './storage';

export const SOFT_FOLDER_SCOPE_REGISTRY_SCHEMA_VERSION = 1 as const;

export interface SoftFolderScopeRegistry {
  readonly schemaVersion: typeof SOFT_FOLDER_SCOPE_REGISTRY_SCHEMA_VERSION;
  readonly workspaceId: string;
  readonly overrides: readonly FocusSchematicSoftFolderScopeOverride[];
}

export type SoftFolderScopeLoadResult =
  | { readonly ok: true; readonly value: SoftFolderScopeRegistry }
  | {
      readonly ok: false;
      readonly kind: 'storage' | 'corrupt';
      readonly message: string;
    };

export function softFolderScopeStorageKey(workspaceId: string): string {
  return `icarus-graph-explorer:soft-folder-scope:${encodeURIComponent(workspaceId)}`;
}

export function createEmptySoftFolderScopeRegistry(
  workspaceId: string,
): SoftFolderScopeRegistry {
  if (workspaceId.length === 0)
    throw new Error('Workspace identity is required.');
  return {
    schemaVersion: SOFT_FOLDER_SCOPE_REGISTRY_SCHEMA_VERSION,
    workspaceId,
    overrides: [],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function validateSoftFolderScopeRegistry(
  value: unknown,
  expectedWorkspaceId: string,
):
  | { readonly ok: true; readonly value: SoftFolderScopeRegistry }
  | {
      readonly ok: false;
      readonly message: string;
    } {
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
    'overrides|schemaVersion|workspaceId'
  )
    return { ok: false, message: 'Registry fields are invalid.' };
  if (record.schemaVersion !== SOFT_FOLDER_SCOPE_REGISTRY_SCHEMA_VERSION)
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
  const overrides = validateFocusSchematicSoftFolderScopeOverrides(
    record.overrides,
  );
  if (!overrides.valid)
    return {
      ok: false,
      message: `Registry overrides are invalid: ${overrides.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    };
  return {
    ok: true,
    value: {
      schemaVersion: SOFT_FOLDER_SCOPE_REGISTRY_SCHEMA_VERSION,
      workspaceId: record.workspaceId,
      overrides: overrides.value,
    },
  };
}

export function serializeSoftFolderScopeRegistry(
  registry: SoftFolderScopeRegistry,
): string {
  const validation = validateSoftFolderScopeRegistry(
    registry,
    registry.workspaceId,
  );
  if (!validation.ok) throw new Error(validation.message);
  return JSON.stringify({
    schemaVersion: SOFT_FOLDER_SCOPE_REGISTRY_SCHEMA_VERSION,
    workspaceId: registry.workspaceId,
    overrides: canonicalFocusSchematicSoftFolderScopeOverrides(
      registry.overrides,
    ),
  });
}

export function loadSoftFolderScope(
  storage: StorageLike,
  workspaceId: string,
): SoftFolderScopeLoadResult {
  let serialized: string | null;
  try {
    serialized = storage.getItem(softFolderScopeStorageKey(workspaceId));
  } catch (error: unknown) {
    return {
      ok: false,
      kind: 'storage',
      message: `Could not read Soft folder grouping for workspace ${JSON.stringify(workspaceId)}: ${errorMessage(error)}`,
    };
  }
  if (serialized === null)
    return { ok: true, value: createEmptySoftFolderScopeRegistry(workspaceId) };
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error: unknown) {
    if (!(error instanceof SyntaxError)) throw error;
    return {
      ok: false,
      kind: 'corrupt',
      message: `Saved Soft folder grouping for workspace ${JSON.stringify(workspaceId)} is not valid JSON: ${error.message}`,
    };
  }
  const validation = validateSoftFolderScopeRegistry(parsed, workspaceId);
  return validation.ok
    ? validation
    : {
        ok: false,
        kind: 'corrupt',
        message: `Saved Soft folder grouping for workspace ${JSON.stringify(workspaceId)} is incompatible: ${validation.message}`,
      };
}

export function saveSoftFolderScope(
  storage: StorageLike,
  registry: SoftFolderScopeRegistry,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  const serialized = serializeSoftFolderScopeRegistry(registry);
  try {
    storage.setItem(
      softFolderScopeStorageKey(registry.workspaceId),
      serialized,
    );
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not save Soft folder grouping for workspace ${JSON.stringify(registry.workspaceId)}: ${errorMessage(error)}`,
    };
  }
}
