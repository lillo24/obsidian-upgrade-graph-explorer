import { parseGraphQuery } from '@icarus-graph-explorer/graph-query';

import type { StorageLike } from './storage';

export const SAVED_GRAPH_FILTER_SCHEMA_VERSION = 1 as const;
export const MAX_SAVED_GRAPH_FILTERS = 50;
export const MAX_SAVED_GRAPH_FILTER_NAME_LENGTH = 64;

export interface SavedGraphFilter {
  readonly name: string;
  readonly query: string;
}

export interface SavedGraphFilterRegistry {
  readonly schemaVersion: typeof SAVED_GRAPH_FILTER_SCHEMA_VERSION;
  readonly workspaceId: string;
  readonly filters: readonly SavedGraphFilter[];
}

export type SavedGraphFilterLoadResult =
  | { readonly status: 'empty'; readonly value: SavedGraphFilterRegistry }
  | { readonly status: 'loaded'; readonly value: SavedGraphFilterRegistry }
  | { readonly status: 'error'; readonly message: string };

export type SavedGraphFilterMutationResult =
  | { readonly ok: true; readonly value: SavedGraphFilterRegistry }
  | { readonly ok: false; readonly message: string };

const STORAGE_KEY_PREFIX = 'icarus-graph-explorer:saved-filters:';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compareFilters(
  left: SavedGraphFilter,
  right: SavedGraphFilter,
): number {
  const folded = left.name
    .toLowerCase()
    .localeCompare(right.name.toLowerCase());
  return (
    folded ||
    left.name.localeCompare(right.name) ||
    left.query.localeCompare(right.query)
  );
}

function sortedFilters(
  filters: readonly SavedGraphFilter[],
): readonly SavedGraphFilter[] {
  return [...filters].sort(compareFilters);
}

export function createEmptySavedGraphFilterRegistry(
  workspaceId: string,
): SavedGraphFilterRegistry {
  return {
    schemaVersion: SAVED_GRAPH_FILTER_SCHEMA_VERSION,
    workspaceId,
    filters: [],
  };
}

export function savedGraphFilterStorageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(workspaceId)}`;
}

export function validateSavedGraphFilterRegistry(
  value: unknown,
  expectedWorkspaceId?: string,
):
  | { readonly valid: true; readonly value: SavedGraphFilterRegistry }
  | { readonly valid: false; readonly message: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      valid: false,
      message: 'Expected a saved-filter registry object.',
    };
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(',') !== 'filters,schemaVersion,workspaceId') {
    return {
      valid: false,
      message: 'Saved-filter registry fields are incompatible.',
    };
  }
  if (record.schemaVersion !== SAVED_GRAPH_FILTER_SCHEMA_VERSION) {
    return {
      valid: false,
      message: 'Unsupported saved-filter schema version.',
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
      message: `Saved filters belong to workspace "${record.workspaceId}", not "${expectedWorkspaceId}".`,
    };
  }
  if (!Array.isArray(record.filters)) {
    return { valid: false, message: 'Expected a saved-filter array.' };
  }
  if (record.filters.length > MAX_SAVED_GRAPH_FILTERS) {
    return {
      valid: false,
      message: `A workspace may contain at most ${MAX_SAVED_GRAPH_FILTERS} saved filters.`,
    };
  }
  const filters: SavedGraphFilter[] = [];
  const names = new Set<string>();
  for (const [index, candidate] of record.filters.entries()) {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      return {
        valid: false,
        message: `Saved filter ${index + 1} is not an object.`,
      };
    }
    const filter = candidate as Record<string, unknown>;
    if (Object.keys(filter).sort().join(',') !== 'name,query') {
      return {
        valid: false,
        message: `Saved filter ${index + 1} has incompatible fields.`,
      };
    }
    if (
      typeof filter.name !== 'string' ||
      filter.name.trim() !== filter.name ||
      filter.name.length < 1 ||
      filter.name.length > MAX_SAVED_GRAPH_FILTER_NAME_LENGTH
    ) {
      return {
        valid: false,
        message: `Saved filter ${index + 1} needs a trimmed name from 1 to ${MAX_SAVED_GRAPH_FILTER_NAME_LENGTH} characters.`,
      };
    }
    const foldedName = filter.name.toLowerCase();
    if (names.has(foldedName)) {
      return {
        valid: false,
        message: `Saved filter name "${filter.name}" is duplicated.`,
      };
    }
    names.add(foldedName);
    if (typeof filter.query !== 'string') {
      return {
        valid: false,
        message: `Saved filter "${filter.name}" needs a query.`,
      };
    }
    const parsed = parseGraphQuery(filter.query);
    if (!parsed.valid || parsed.canonical !== filter.query) {
      return {
        valid: false,
        message: `Saved filter "${filter.name}" has a non-canonical or invalid query.`,
      };
    }
    filters.push({ name: filter.name, query: filter.query });
  }
  const normalized = sortedFilters(filters);
  if (JSON.stringify(filters) !== JSON.stringify(normalized)) {
    return {
      valid: false,
      message: 'Saved filters are not deterministically sorted.',
    };
  }
  return {
    valid: true,
    value: {
      schemaVersion: SAVED_GRAPH_FILTER_SCHEMA_VERSION,
      workspaceId: record.workspaceId,
      filters: normalized,
    },
  };
}

export function loadSavedGraphFilters(
  storage: StorageLike,
  workspaceId: string,
): SavedGraphFilterLoadResult {
  let serialized: string | null;
  try {
    serialized = storage.getItem(savedGraphFilterStorageKey(workspaceId));
  } catch (error: unknown) {
    return {
      status: 'error',
      message: `Could not read saved filters for workspace "${workspaceId}": ${errorMessage(error)}`,
    };
  }
  if (serialized === null) {
    return {
      status: 'empty',
      value: createEmptySavedGraphFilterRegistry(workspaceId),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error: unknown) {
    return {
      status: 'error',
      message: `Saved filters for workspace "${workspaceId}" are not valid JSON: ${errorMessage(error)}`,
    };
  }
  const validation = validateSavedGraphFilterRegistry(parsed, workspaceId);
  return validation.valid
    ? { status: 'loaded', value: validation.value }
    : {
        status: 'error',
        message: `Saved filters for workspace "${workspaceId}" are incompatible: ${validation.message}`,
      };
}

export function serializeSavedGraphFilterRegistry(
  value: SavedGraphFilterRegistry,
): string {
  const validation = validateSavedGraphFilterRegistry(value, value.workspaceId);
  if (!validation.valid) throw new Error(validation.message);
  return JSON.stringify(validation.value);
}

export function saveSavedGraphFilterRegistry(
  storage: StorageLike,
  value: SavedGraphFilterRegistry,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  try {
    storage.setItem(
      savedGraphFilterStorageKey(value.workspaceId),
      serializeSavedGraphFilterRegistry(value),
    );
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not save filters for workspace "${value.workspaceId}": ${errorMessage(error)}`,
    };
  }
}

export function addSavedGraphFilter(
  registry: SavedGraphFilterRegistry,
  name: string,
  query: string,
): SavedGraphFilterMutationResult {
  const normalizedName = name.trim();
  if (
    normalizedName.length < 1 ||
    normalizedName.length > MAX_SAVED_GRAPH_FILTER_NAME_LENGTH
  ) {
    return {
      ok: false,
      message: `Name must contain 1 to ${MAX_SAVED_GRAPH_FILTER_NAME_LENGTH} characters.`,
    };
  }
  if (
    registry.filters.some(
      (filter) => filter.name.toLowerCase() === normalizedName.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      message: `A saved filter named "${normalizedName}" already exists.`,
    };
  }
  if (registry.filters.length >= MAX_SAVED_GRAPH_FILTERS) {
    return {
      ok: false,
      message: `A workspace may contain at most ${MAX_SAVED_GRAPH_FILTERS} saved filters.`,
    };
  }
  const parsed = parseGraphQuery(query);
  if (!parsed.valid)
    return {
      ok: false,
      message: 'Only a valid active graph query can be saved.',
    };
  return {
    ok: true,
    value: {
      ...registry,
      filters: sortedFilters([
        ...registry.filters,
        { name: normalizedName, query: parsed.canonical },
      ]),
    },
  };
}

export function deleteSavedGraphFilter(
  registry: SavedGraphFilterRegistry,
  name: string,
): SavedGraphFilterMutationResult {
  const filters = registry.filters.filter((filter) => filter.name !== name);
  if (filters.length === registry.filters.length) {
    return { ok: false, message: `Saved filter "${name}" does not exist.` };
  }
  return { ok: true, value: { ...registry, filters } };
}
