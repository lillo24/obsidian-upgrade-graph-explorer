import {
  createEmptySpatialOverrideRegistry,
  validateSpatialOverrideRegistry,
  type SpatialOverrideRegistry,
} from '@icarus-graph-explorer/spatial-overrides';

import {
  clearSpatialOverrides,
  loadSpatialOverrides,
  saveSpatialOverrides,
} from '../persistence/spatial-overrides';
import type { ViewPersistenceEligibility } from '../persistence/session';
import type { StorageLike } from '../persistence/storage';

export type SpatialOverridePersistenceMode =
  'durable' | 'session-only' | 'blocked-corrupt' | 'blocked-write-failure';

export interface SpatialOverrideSession {
  readonly registry: SpatialOverrideRegistry;
  readonly persistenceMode: SpatialOverridePersistenceMode;
  readonly status: string;
  readonly error?: string;
}

export type SpatialOverrideSessionMutationResult =
  | { readonly ok: true; readonly value: SpatialOverrideSession }
  | {
      readonly ok: false;
      readonly value: SpatialOverrideSession;
      readonly message: string;
    };

export const SPATIAL_OVERRIDE_DURABLE_STATUS =
  'Folder positions are saved for this workspace';
export const SPATIAL_OVERRIDE_UNSTABLE_STATUS =
  'Folder positions are session only — workspace identity is not stable';
export const SPATIAL_OVERRIDE_STORAGE_UNAVAILABLE_STATUS =
  'Folder positions are session only — storage unavailable';
export const SPATIAL_OVERRIDE_CORRUPT_STATUS =
  'Saved folder positions could not be loaded';
export const SPATIAL_OVERRIDE_WRITE_FAILURE_STATUS =
  'Saving folder positions is disabled after a storage error';

export function createSpatialOverrideSession({
  eligibility,
  storage,
  workspaceId,
}: {
  readonly eligibility: ViewPersistenceEligibility;
  readonly storage: StorageLike | undefined;
  readonly workspaceId: string;
}): SpatialOverrideSession {
  const registry = createEmptySpatialOverrideRegistry(workspaceId);
  if (eligibility !== 'stable') {
    return {
      registry,
      persistenceMode: 'session-only',
      status: SPATIAL_OVERRIDE_UNSTABLE_STATUS,
    };
  }
  if (storage === undefined) {
    return {
      registry,
      persistenceMode: 'session-only',
      status: SPATIAL_OVERRIDE_STORAGE_UNAVAILABLE_STATUS,
      error:
        'Folder positions are available for this session only because browser storage could not be accessed.',
    };
  }
  const loaded = loadSpatialOverrides(storage, workspaceId);
  if (!loaded.ok) {
    return loaded.kind === 'storage'
      ? {
          registry,
          persistenceMode: 'session-only',
          status: SPATIAL_OVERRIDE_STORAGE_UNAVAILABLE_STATUS,
          error: loaded.message,
        }
      : {
          registry,
          persistenceMode: 'blocked-corrupt',
          status: SPATIAL_OVERRIDE_CORRUPT_STATUS,
          error: `${loaded.message} The stored value was left unchanged. Reset saved folder positions to recover durable editing.`,
        };
  }
  return {
    registry: loaded.value,
    persistenceMode: 'durable',
    status: SPATIAL_OVERRIDE_DURABLE_STATUS,
  };
}

export function commitSpatialOverrideSessionMutation(
  session: SpatialOverrideSession,
  candidate: SpatialOverrideRegistry,
  storage: StorageLike | undefined,
): SpatialOverrideSessionMutationResult {
  const validation = validateSpatialOverrideRegistry(
    candidate,
    session.registry.workspaceId,
  );
  if (!validation.ok) {
    return { ok: false, value: session, message: validation.message };
  }
  if (session.persistenceMode === 'session-only') {
    return { ok: true, value: { ...session, registry: validation.value } };
  }
  if (session.persistenceMode === 'blocked-corrupt') {
    return {
      ok: false,
      value: session,
      message: 'Reset saved folder positions before making changes.',
    };
  }
  if (session.persistenceMode === 'blocked-write-failure') {
    return {
      ok: false,
      value: session,
      message:
        'Saving is disabled after a storage error. Reopen the workspace to retry durable changes.',
    };
  }
  const saved =
    storage === undefined
      ? {
          ok: false as const,
          message:
            'Browser storage became unavailable before folder positions could be saved.',
        }
      : saveSpatialOverrides(storage, validation.value);
  if (!saved.ok) {
    return {
      ok: false,
      message: saved.message,
      value: {
        ...session,
        persistenceMode: 'blocked-write-failure',
        status: SPATIAL_OVERRIDE_WRITE_FAILURE_STATUS,
        error: `${saved.message} The last confirmed folder positions remain active. Reopen the workspace to retry.`,
      },
    };
  }
  return {
    ok: true,
    value: {
      registry: validation.value,
      persistenceMode: 'durable',
      status: SPATIAL_OVERRIDE_DURABLE_STATUS,
    },
  };
}

export function resetCorruptSpatialOverrideSession(
  session: SpatialOverrideSession,
  storage: StorageLike | undefined,
): SpatialOverrideSessionMutationResult {
  if (session.persistenceMode !== 'blocked-corrupt') {
    return {
      ok: false,
      value: session,
      message: 'There is no corrupt folder-position registry to reset.',
    };
  }
  if (storage === undefined) {
    return {
      ok: false,
      value: session,
      message:
        'Browser storage is unavailable, so the registry cannot be reset.',
    };
  }
  const cleared = clearSpatialOverrides(storage, session.registry.workspaceId);
  if (!cleared.ok) {
    return {
      ok: false,
      value: { ...session, error: cleared.message },
      message: cleared.message,
    };
  }
  return {
    ok: true,
    value: {
      registry: createEmptySpatialOverrideRegistry(
        session.registry.workspaceId,
      ),
      persistenceMode: 'durable',
      status: SPATIAL_OVERRIDE_DURABLE_STATUS,
    },
  };
}
