import {
  validateAndCanonicalizeVisualGroupDefinitions,
  type VisualGroupDefinition,
} from '@icarus-graph-explorer/visual-groups';

import type { StorageLike } from './storage';

export const VISUAL_GROUP_REGISTRY_SCHEMA_VERSION = 1 as const;

export interface VisualGroupRegistry {
  readonly schemaVersion: typeof VISUAL_GROUP_REGISTRY_SCHEMA_VERSION;
  readonly workspaceId: string;
  readonly groups: readonly VisualGroupDefinition[];
}

export type VisualGroupRegistryLoadResult =
  | { readonly status: 'empty'; readonly value: VisualGroupRegistry }
  | { readonly status: 'loaded'; readonly value: VisualGroupRegistry }
  | { readonly status: 'error'; readonly message: string };

export type VisualGroupRegistryMutationResult =
  | { readonly ok: true; readonly value: VisualGroupRegistry }
  | { readonly ok: false; readonly message: string };

const STORAGE_KEY_PREFIX = 'icarus-graph-explorer:visual-groups:';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function folded(value: string): string {
  return value.toLowerCase();
}

function groupIndex(registry: VisualGroupRegistry, name: string): number {
  const foldedName = folded(name.trim());
  return registry.groups.findIndex(
    (group) => folded(group.name) === foldedName,
  );
}

function canonicalGroups(
  value: unknown,
):
  | { readonly ok: true; readonly value: readonly VisualGroupDefinition[] }
  | { readonly ok: false; readonly message: string } {
  const validation = validateAndCanonicalizeVisualGroupDefinitions(value);
  return validation.valid
    ? { ok: true, value: validation.value }
    : {
        ok: false,
        message:
          validation.issues[0]?.message ??
          'Visual Group definitions are invalid.',
      };
}

function mutatedRegistry(
  registry: VisualGroupRegistry,
  groups: unknown,
): VisualGroupRegistryMutationResult {
  const existing = validateVisualGroupRegistry(registry, registry.workspaceId);
  if (!existing.valid) return { ok: false, message: existing.message };
  const canonical = canonicalGroups(groups);
  if (!canonical.ok) return canonical;
  return {
    ok: true,
    value: { ...existing.value, groups: canonical.value },
  };
}

export function createEmptyVisualGroupRegistry(
  workspaceId: string,
): VisualGroupRegistry {
  if (workspaceId.length === 0) {
    throw new Error(
      'Cannot create a Visual Group registry without a workspace ID.',
    );
  }
  return {
    schemaVersion: VISUAL_GROUP_REGISTRY_SCHEMA_VERSION,
    workspaceId,
    groups: [],
  };
}

export function visualGroupStorageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(workspaceId)}`;
}

export function validateVisualGroupRegistry(
  value: unknown,
  expectedWorkspaceId?: string,
):
  | { readonly valid: true; readonly value: VisualGroupRegistry }
  | { readonly valid: false; readonly message: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      valid: false,
      message: 'Expected a Visual Group registry object.',
    };
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(',') !== 'groups,schemaVersion,workspaceId'
  ) {
    return {
      valid: false,
      message: 'Visual Group registry fields are incompatible.',
    };
  }
  if (record.schemaVersion !== VISUAL_GROUP_REGISTRY_SCHEMA_VERSION) {
    return {
      valid: false,
      message: 'Unsupported Visual Group registry schema version.',
    };
  }
  if (
    typeof record.workspaceId !== 'string' ||
    record.workspaceId.length === 0
  ) {
    return { valid: false, message: 'Expected a non-empty workspace ID.' };
  }
  if (
    expectedWorkspaceId !== undefined &&
    record.workspaceId !== expectedWorkspaceId
  ) {
    return {
      valid: false,
      message: `Visual Groups belong to workspace ${JSON.stringify(record.workspaceId)}, not ${JSON.stringify(expectedWorkspaceId)}.`,
    };
  }
  const canonical = canonicalGroups(record.groups);
  if (!canonical.ok) return { valid: false, message: canonical.message };
  const submitted = record.groups as readonly Record<string, unknown>[];
  for (const [index, group] of canonical.value.entries()) {
    const candidate = submitted[index];
    if (candidate?.name !== group.name || candidate.query !== group.query) {
      return {
        valid: false,
        message: `Visual Group ${index + 1} has a non-canonical name or query.`,
      };
    }
  }
  return {
    valid: true,
    value: {
      schemaVersion: VISUAL_GROUP_REGISTRY_SCHEMA_VERSION,
      workspaceId: record.workspaceId,
      groups: canonical.value,
    },
  };
}

export function loadVisualGroupRegistry(
  storage: StorageLike,
  workspaceId: string,
): VisualGroupRegistryLoadResult {
  let serialized: string | null;
  try {
    serialized = storage.getItem(visualGroupStorageKey(workspaceId));
  } catch (error: unknown) {
    return {
      status: 'error',
      message: `Could not read Visual Groups for workspace ${JSON.stringify(workspaceId)}: ${errorMessage(error)}`,
    };
  }
  if (serialized === null) {
    return {
      status: 'empty',
      value: createEmptyVisualGroupRegistry(workspaceId),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error: unknown) {
    return {
      status: 'error',
      message: `Visual Groups for workspace ${JSON.stringify(workspaceId)} are not valid JSON: ${errorMessage(error)}`,
    };
  }
  const validation = validateVisualGroupRegistry(parsed, workspaceId);
  return validation.valid
    ? { status: 'loaded', value: validation.value }
    : {
        status: 'error',
        message: `Visual Groups for workspace ${JSON.stringify(workspaceId)} are incompatible: ${validation.message}`,
      };
}

export function serializeVisualGroupRegistry(
  value: VisualGroupRegistry,
): string {
  const validation = validateVisualGroupRegistry(value, value.workspaceId);
  if (!validation.valid) throw new Error(validation.message);
  const registry = validation.value;
  return JSON.stringify({
    schemaVersion: registry.schemaVersion,
    workspaceId: registry.workspaceId,
    groups: registry.groups.map(({ name, query, color, enabled }) => ({
      name,
      query,
      color,
      enabled,
    })),
  });
}

export function saveVisualGroupRegistry(
  storage: StorageLike,
  value: VisualGroupRegistry,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  try {
    storage.setItem(
      visualGroupStorageKey(value.workspaceId),
      serializeVisualGroupRegistry(value),
    );
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not save Visual Groups for workspace ${JSON.stringify(value.workspaceId)}: ${errorMessage(error)}`,
    };
  }
}

export function addVisualGroup(
  registry: VisualGroupRegistry,
  definition: VisualGroupDefinition,
): VisualGroupRegistryMutationResult {
  return mutatedRegistry(registry, [...registry.groups, definition]);
}

export function updateVisualGroup(
  registry: VisualGroupRegistry,
  currentName: string,
  definition: VisualGroupDefinition,
): VisualGroupRegistryMutationResult {
  const index = groupIndex(registry, currentName);
  if (index === -1) {
    return {
      ok: false,
      message: `Visual Group ${JSON.stringify(currentName)} does not exist.`,
    };
  }
  const groups = [...registry.groups];
  groups[index] = definition;
  return mutatedRegistry(registry, groups);
}

export function deleteVisualGroup(
  registry: VisualGroupRegistry,
  name: string,
): VisualGroupRegistryMutationResult {
  const index = groupIndex(registry, name);
  if (index === -1) {
    return {
      ok: false,
      message: `Visual Group ${JSON.stringify(name)} does not exist.`,
    };
  }
  return mutatedRegistry(
    registry,
    registry.groups.filter(
      (_group, candidateIndex) => candidateIndex !== index,
    ),
  );
}

function moveVisualGroup(
  registry: VisualGroupRegistry,
  name: string,
  offset: -1 | 1,
): VisualGroupRegistryMutationResult {
  const index = groupIndex(registry, name);
  if (index === -1) {
    return {
      ok: false,
      message: `Visual Group ${JSON.stringify(name)} does not exist.`,
    };
  }
  const target = index + offset;
  if (target < 0 || target >= registry.groups.length) {
    return {
      ok: false,
      message: `Visual Group ${JSON.stringify(registry.groups[index]?.name)} cannot move ${offset < 0 ? 'up' : 'down'}.`,
    };
  }
  const groups = [...registry.groups];
  [groups[index], groups[target]] = [groups[target]!, groups[index]!];
  return mutatedRegistry(registry, groups);
}

export function moveVisualGroupUp(
  registry: VisualGroupRegistry,
  name: string,
): VisualGroupRegistryMutationResult {
  return moveVisualGroup(registry, name, -1);
}

export function moveVisualGroupDown(
  registry: VisualGroupRegistry,
  name: string,
): VisualGroupRegistryMutationResult {
  return moveVisualGroup(registry, name, 1);
}

export function setVisualGroupEnabled(
  registry: VisualGroupRegistry,
  name: string,
  enabled: boolean,
): VisualGroupRegistryMutationResult {
  if (typeof enabled !== 'boolean') {
    return { ok: false, message: 'Visual Group enabled must be a boolean.' };
  }
  const index = groupIndex(registry, name);
  if (index === -1) {
    return {
      ok: false,
      message: `Visual Group ${JSON.stringify(name)} does not exist.`,
    };
  }
  const current = registry.groups[index]!;
  const groups = [...registry.groups];
  groups[index] = { ...current, enabled };
  return mutatedRegistry(registry, groups);
}
