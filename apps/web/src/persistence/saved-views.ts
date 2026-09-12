import { parseGraphQuery } from '@icarus-graph-explorer/graph-query';
import {
  PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION,
  validatePersistedWorkspaceView,
  type PersistedWorkspaceView,
} from '@icarus-graph-explorer/view-state';

import type { StorageLike, StorageMutationResult } from './storage';

export const SAVED_VIEW_REGISTRY_SCHEMA_VERSION = 1 as const;
export const MAX_SAVED_VIEWS = 50;
export const MAX_SAVED_VIEW_NAME_LENGTH = 64;

export type SavedViewLayout = 'network' | 'hierarchy';

export interface SavedViewEntry {
  readonly name: string;
  readonly layout: SavedViewLayout;
  readonly view: PersistedWorkspaceView;
}

export interface SavedViewRegistry {
  readonly schemaVersion: typeof SAVED_VIEW_REGISTRY_SCHEMA_VERSION;
  readonly workspaceId: string;
  readonly views: readonly SavedViewEntry[];
}

export type SavedViewLoadResult =
  | { readonly status: 'empty'; readonly value: SavedViewRegistry }
  | { readonly status: 'loaded'; readonly value: SavedViewRegistry }
  | { readonly status: 'error'; readonly message: string };

export type SavedViewMutationResult =
  | { readonly ok: true; readonly value: SavedViewRegistry }
  | { readonly ok: false; readonly message: string };

const STORAGE_KEY_PREFIX = 'icarus-graph-explorer:saved-views:';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonSafePlainValue(
  value: unknown,
  seen = new Set<object>(),
): boolean {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonSafePlainValue(item, seen))
    : isPlainRecord(value) &&
      Object.values(value).every((item) => isJsonSafePlainValue(item, seen));
  seen.delete(value);
  return valid;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareSavedViews(
  left: SavedViewEntry,
  right: SavedViewEntry,
): number {
  return (
    compareText(left.name.toLowerCase(), right.name.toLowerCase()) ||
    compareText(left.name, right.name)
  );
}

function sortedSavedViews(
  views: readonly SavedViewEntry[],
): readonly SavedViewEntry[] {
  return [...views].sort(compareSavedViews);
}

function sameValues<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isSortedUnique(values: readonly string[]): boolean {
  return sameValues(values, [...new Set(values)].sort(compareText));
}

function validateDeterministicView(
  view: PersistedWorkspaceView,
): string | undefined {
  const disclosure = view.projection.disclosure;
  if (
    !isSortedUnique(disclosure.expandedEntityIds) ||
    !isSortedUnique(disclosure.collapsedEntityIds)
  ) {
    return 'Saved View disclosure identities are not deterministically sorted.';
  }
  const filters = view.projection.filters;
  for (const values of [
    filters?.pathPrefixes,
    filters?.entityKinds,
    filters?.referenceStatuses,
  ]) {
    if (values !== undefined && !isSortedUnique(values)) {
      return 'Saved View filters are not deterministically sorted.';
    }
  }
  if (filters?.query !== undefined) {
    const parsed = parseGraphQuery(filters.query);
    if (!parsed.valid || parsed.canonical !== filters.query) {
      return 'Saved View query must be valid and canonical.';
    }
  }
  return undefined;
}

function validatePresentation(
  view: PersistedWorkspaceView,
  layout: SavedViewLayout,
): string | undefined {
  const focused = view.projection.focus !== undefined;
  if (view.presentationMode === 'local') {
    return focused ? undefined : 'A Focus Saved View requires a Focus root.';
  }
  if (focused) {
    return 'An All Saved View cannot contain Focus state.';
  }
  if (view.presentationMode === 'global' && layout !== 'network') {
    return 'All Network requires the Network Saved View layout.';
  }
  if (view.presentationMode === 'structure' && layout !== 'hierarchy') {
    return 'All Hierarchy requires the Hierarchy Saved View layout.';
  }
  return undefined;
}

export function createEmptySavedViewRegistry(
  workspaceId: string,
): SavedViewRegistry {
  return {
    schemaVersion: SAVED_VIEW_REGISTRY_SCHEMA_VERSION,
    workspaceId,
    views: [],
  };
}

export function savedViewStorageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(workspaceId)}`;
}

export function validateSavedViewRegistry(
  value: unknown,
  expectedWorkspaceId?: string,
):
  | { readonly valid: true; readonly value: SavedViewRegistry }
  | { readonly valid: false; readonly message: string } {
  if (!isJsonSafePlainValue(value) || !isPlainRecord(value)) {
    return {
      valid: false,
      message: 'Expected a JSON-safe Saved Views registry of plain objects.',
    };
  }
  if (
    Object.keys(value).sort().join(',') !== 'schemaVersion,views,workspaceId'
  ) {
    return {
      valid: false,
      message: 'Saved Views registry fields are incompatible.',
    };
  }
  if (value.schemaVersion !== SAVED_VIEW_REGISTRY_SCHEMA_VERSION) {
    return { valid: false, message: 'Unsupported Saved Views schema version.' };
  }
  if (
    typeof value.workspaceId !== 'string' ||
    value.workspaceId.trim().length === 0
  ) {
    return { valid: false, message: 'Expected a non-empty workspace ID.' };
  }
  if (
    expectedWorkspaceId !== undefined &&
    value.workspaceId !== expectedWorkspaceId
  ) {
    return {
      valid: false,
      message: `Saved Views belong to workspace "${value.workspaceId}", not "${expectedWorkspaceId}".`,
    };
  }
  if (!Array.isArray(value.views)) {
    return { valid: false, message: 'Expected a Saved View array.' };
  }
  if (value.views.length > MAX_SAVED_VIEWS) {
    return {
      valid: false,
      message: `A workspace may contain at most ${MAX_SAVED_VIEWS} Saved Views.`,
    };
  }

  const views: SavedViewEntry[] = [];
  const names = new Set<string>();
  for (const [index, candidate] of value.views.entries()) {
    if (!isPlainRecord(candidate)) {
      return {
        valid: false,
        message: `Saved View ${index + 1} is not a plain object.`,
      };
    }
    if (Object.keys(candidate).sort().join(',') !== 'layout,name,view') {
      return {
        valid: false,
        message: `Saved View ${index + 1} has incompatible fields.`,
      };
    }
    if (
      typeof candidate.name !== 'string' ||
      candidate.name.trim() !== candidate.name ||
      candidate.name.length < 1 ||
      candidate.name.length > MAX_SAVED_VIEW_NAME_LENGTH
    ) {
      return {
        valid: false,
        message: `Saved View ${index + 1} needs a trimmed name from 1 to ${MAX_SAVED_VIEW_NAME_LENGTH} characters.`,
      };
    }
    const foldedName = candidate.name.toLowerCase();
    if (names.has(foldedName)) {
      return {
        valid: false,
        message: `Saved View name "${candidate.name}" is duplicated.`,
      };
    }
    names.add(foldedName);
    if (candidate.layout !== 'network' && candidate.layout !== 'hierarchy') {
      return {
        valid: false,
        message: `Saved View "${candidate.name}" has an unsupported layout.`,
      };
    }
    if (!isPlainRecord(candidate.view)) {
      return {
        valid: false,
        message: `Saved View "${candidate.name}" needs a persisted view object.`,
      };
    }
    if (
      candidate.view.schemaVersion !== PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION
    ) {
      return {
        valid: false,
        message: `Saved View "${candidate.name}" requires view-state schema ${PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION}.`,
      };
    }
    const validation = validatePersistedWorkspaceView(candidate.view);
    if (!validation.valid) {
      const first = validation.issues[0];
      return {
        valid: false,
        message: `Saved View "${candidate.name}" has invalid view state${
          first === undefined ? '.' : ` at ${first.path}: ${first.message}`
        }`,
      };
    }
    if (validation.value.workspaceId !== value.workspaceId) {
      return {
        valid: false,
        message: `Saved View "${candidate.name}" belongs to another workspace.`,
      };
    }
    const deterministicIssue = validateDeterministicView(validation.value);
    if (deterministicIssue !== undefined) {
      return {
        valid: false,
        message: `${candidate.name}: ${deterministicIssue}`,
      };
    }
    const presentationIssue = validatePresentation(
      validation.value,
      candidate.layout,
    );
    if (presentationIssue !== undefined) {
      return {
        valid: false,
        message: `${candidate.name}: ${presentationIssue}`,
      };
    }
    views.push({
      name: candidate.name,
      layout: candidate.layout,
      view: validation.value,
    });
  }
  const normalized = sortedSavedViews(views);
  if (!sameValues(views, normalized)) {
    return {
      valid: false,
      message: 'Saved Views are not deterministically sorted.',
    };
  }
  return {
    valid: true,
    value: {
      schemaVersion: SAVED_VIEW_REGISTRY_SCHEMA_VERSION,
      workspaceId: value.workspaceId,
      views: normalized,
    },
  };
}

export function loadSavedViews(
  storage: StorageLike,
  workspaceId: string,
): SavedViewLoadResult {
  let serialized: string | null;
  try {
    serialized = storage.getItem(savedViewStorageKey(workspaceId));
  } catch (error: unknown) {
    return {
      status: 'error',
      message: `Could not read Saved Views for workspace "${workspaceId}": ${errorMessage(error)}`,
    };
  }
  if (serialized === null) {
    return {
      status: 'empty',
      value: createEmptySavedViewRegistry(workspaceId),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error: unknown) {
    return {
      status: 'error',
      message: `Saved Views for workspace "${workspaceId}" are not valid JSON: ${errorMessage(error)}`,
    };
  }
  const validation = validateSavedViewRegistry(parsed, workspaceId);
  return validation.valid
    ? { status: 'loaded', value: validation.value }
    : {
        status: 'error',
        message: `Saved Views for workspace "${workspaceId}" are incompatible: ${validation.message}`,
      };
}

export function serializeSavedViewRegistry(value: SavedViewRegistry): string {
  const validation = validateSavedViewRegistry(value, value.workspaceId);
  if (!validation.valid) throw new Error(validation.message);
  return JSON.stringify(validation.value);
}

export function saveSavedViewRegistry(
  storage: StorageLike,
  value: SavedViewRegistry,
): StorageMutationResult {
  try {
    storage.setItem(
      savedViewStorageKey(value.workspaceId),
      serializeSavedViewRegistry(value),
    );
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not save Saved Views for workspace "${value.workspaceId}": ${errorMessage(error)}`,
    };
  }
}

export function clearSavedViewRegistry(
  storage: StorageLike,
  workspaceId: string,
): StorageMutationResult {
  try {
    storage.removeItem(savedViewStorageKey(workspaceId));
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not reset Saved Views for workspace "${workspaceId}": ${errorMessage(error)}`,
    };
  }
}

function checkedMutation(
  candidate: SavedViewRegistry,
): SavedViewMutationResult {
  const validation = validateSavedViewRegistry(
    candidate,
    candidate.workspaceId,
  );
  return validation.valid
    ? { ok: true, value: validation.value }
    : { ok: false, message: validation.message };
}

function normalizedName(
  name: string,
):
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly message: string } {
  const value = name.trim();
  return value.length >= 1 && value.length <= MAX_SAVED_VIEW_NAME_LENGTH
    ? { ok: true, value }
    : {
        ok: false,
        message: `Name must contain 1 to ${MAX_SAVED_VIEW_NAME_LENGTH} characters.`,
      };
}

export function addSavedView(
  registry: SavedViewRegistry,
  entry: SavedViewEntry,
): SavedViewMutationResult {
  const name = normalizedName(entry.name);
  if (!name.ok) return name;
  if (
    registry.views.some(
      (candidate) => candidate.name.toLowerCase() === name.value.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      message: `A Saved View named "${name.value}" already exists.`,
    };
  }
  if (registry.views.length >= MAX_SAVED_VIEWS) {
    return {
      ok: false,
      message: `A workspace may contain at most ${MAX_SAVED_VIEWS} Saved Views.`,
    };
  }
  return checkedMutation({
    ...registry,
    views: sortedSavedViews([
      ...registry.views,
      { ...entry, name: name.value },
    ]),
  });
}

export function updateSavedView(
  registry: SavedViewRegistry,
  name: string,
  entry: SavedViewEntry,
): SavedViewMutationResult {
  const index = registry.views.findIndex(
    (candidate) => candidate.name === name,
  );
  if (index < 0) {
    return { ok: false, message: `Saved View "${name}" does not exist.` };
  }
  const views = [...registry.views];
  views[index] = { ...entry, name };
  return checkedMutation({ ...registry, views: sortedSavedViews(views) });
}

export function renameSavedView(
  registry: SavedViewRegistry,
  currentName: string,
  nextName: string,
): SavedViewMutationResult {
  const name = normalizedName(nextName);
  if (!name.ok) return name;
  const index = registry.views.findIndex(
    (candidate) => candidate.name === currentName,
  );
  if (index < 0) {
    return {
      ok: false,
      message: `Saved View "${currentName}" does not exist.`,
    };
  }
  if (
    registry.views.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        candidate.name.toLowerCase() === name.value.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      message: `A Saved View named "${name.value}" already exists.`,
    };
  }
  const views = [...registry.views];
  views[index] = { ...views[index]!, name: name.value };
  return checkedMutation({ ...registry, views: sortedSavedViews(views) });
}

export function deleteSavedView(
  registry: SavedViewRegistry,
  name: string,
): SavedViewMutationResult {
  const views = registry.views.filter((entry) => entry.name !== name);
  return views.length === registry.views.length
    ? { ok: false, message: `Saved View "${name}" does not exist.` }
    : checkedMutation({ ...registry, views });
}
