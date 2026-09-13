import {
  serializeSpatialOverrideRegistry,
  validateSpatialOverrideRegistry,
  type SpatialOverrideRegistry,
} from '@icarus-graph-explorer/spatial-overrides';

import {
  GRAPH_PREFERENCES_STORAGE_KEY,
  serializeGraphPreferences,
  type GraphPreferences,
} from './preferences/graph-preferences';
import { spatialOverrideStorageKey } from './persistence/spatial-overrides';
import type { StorageLike } from './persistence/storage';
import {
  adoptPersistedSpatialOverrideRegistry,
  type SpatialOverrideSession,
} from './spatial-overrides/session';

export interface SavedViewProfileTransactionPlan {
  readonly currentPreferences: GraphPreferences;
  readonly preferences: GraphPreferences;
  readonly spatialSession: SpatialOverrideSession;
  readonly spatial?: SpatialOverrideRegistry;
}

export type SavedViewProfileTransactionResult =
  | {
      readonly ok: true;
      readonly preferences: GraphPreferences;
      readonly spatialSession: SpatialOverrideSession;
      readonly preferenceWrite: boolean;
      readonly spatialWrite: boolean;
    }
  | { readonly ok: false; readonly message: string };

interface DurableWrite {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function restoreValue(
  storage: StorageLike,
  key: string,
  previous: string | null,
): void {
  if (previous === null) storage.removeItem(key);
  else storage.setItem(key, previous);
}

/**
 * Persists all changed profile owners before returning adoptable in-memory
 * state. Writes run spatial-first so a blocked spatial owner cannot partially
 * change Graph Preferences; any later failure rolls attempted keys back.
 */
export function commitSavedViewProfileTransaction({
  storage,
  plan,
}: {
  readonly storage: StorageLike | undefined;
  readonly plan: SavedViewProfileTransactionPlan;
}): SavedViewProfileTransactionResult {
  let currentPreferences: string;
  let nextPreferences: string;
  let currentSpatial: string;
  let nextSpatial: string | undefined;
  let targetSpatialSession = plan.spatialSession;
  try {
    currentPreferences = serializeGraphPreferences(plan.currentPreferences);
    nextPreferences = serializeGraphPreferences(plan.preferences);
    currentSpatial = serializeSpatialOverrideRegistry(
      plan.spatialSession.registry,
    );
    if (plan.spatial !== undefined) {
      if (plan.spatialSession.persistenceMode !== 'durable') {
        return {
          ok: false,
          message:
            'Saved View spatial profiles require writable durable folder positions.',
        };
      }
      const validation = validateSpatialOverrideRegistry(
        plan.spatial,
        plan.spatialSession.registry.workspaceId,
      );
      if (!validation.ok) return { ok: false, message: validation.message };
      nextSpatial = serializeSpatialOverrideRegistry(validation.value);
      targetSpatialSession = adoptPersistedSpatialOverrideRegistry(
        plan.spatialSession,
        validation.value,
      );
    }
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Could not validate the Saved View profile transaction: ${errorMessage(error)}`,
    };
  }

  const preferenceWrite = currentPreferences !== nextPreferences;
  const spatialWrite =
    nextSpatial !== undefined && currentSpatial !== nextSpatial;
  const writes: DurableWrite[] = [];
  if (spatialWrite && nextSpatial !== undefined) {
    writes.push({
      key: spatialOverrideStorageKey(plan.spatialSession.registry.workspaceId),
      label: 'folder positions',
      value: nextSpatial,
    });
  }
  if (preferenceWrite) {
    writes.push({
      key: GRAPH_PREFERENCES_STORAGE_KEY,
      label: 'Graph Preferences',
      value: nextPreferences,
    });
  }
  if (writes.length > 0 && storage === undefined) {
    return {
      ok: false,
      message:
        'Could not apply the Saved View profile because browser storage is unavailable.',
    };
  }

  const previous = new Map<string, string | null>();
  if (storage !== undefined) {
    try {
      for (const write of writes) {
        previous.set(write.key, storage.getItem(write.key));
      }
    } catch (error: unknown) {
      return {
        ok: false,
        message: `Could not prepare the Saved View profile rollback values: ${errorMessage(error)}`,
      };
    }
  }

  const written: DurableWrite[] = [];
  if (storage !== undefined) {
    for (const write of writes) {
      try {
        storage.setItem(write.key, write.value);
        written.push(write);
      } catch (error: unknown) {
        const rollbackFailures: string[] = [];
        for (const rollback of [...written].reverse()) {
          try {
            restoreValue(storage, rollback.key, previous.get(rollback.key)!);
          } catch (rollbackError: unknown) {
            rollbackFailures.push(
              `${rollback.label}: ${errorMessage(rollbackError)}`,
            );
          }
        }
        return {
          ok: false,
          message: `Could not apply the Saved View profile while writing ${write.label}: ${errorMessage(error)}${
            rollbackFailures.length === 0
              ? written.length === 0
                ? ' No durable profile values changed.'
                : ' Previous durable profile values were restored.'
              : ` Rollback also failed for ${rollbackFailures.join('; ')}.`
          }`,
        };
      }
    }
  }

  return {
    ok: true,
    preferences: plan.preferences,
    spatialSession: targetSpatialSession,
    preferenceWrite,
    spatialWrite,
  };
}
