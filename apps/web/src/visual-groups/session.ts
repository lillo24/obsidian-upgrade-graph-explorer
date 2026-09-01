import type { VisualGroupRegistry } from '../persistence/visual-groups';
import {
  clearVisualGroupRegistry,
  createEmptyVisualGroupRegistry,
  loadVisualGroupRegistry,
  saveVisualGroupRegistry,
} from '../persistence/visual-groups';
import type { ViewPersistenceEligibility } from '../persistence/session';
import type { StorageLike } from '../persistence/storage';

export type VisualGroupPersistenceMode =
  'durable' | 'session-only' | 'blocked-corrupt' | 'blocked-write-failure';

export interface VisualGroupSession {
  readonly registry: VisualGroupRegistry;
  readonly persistenceMode: VisualGroupPersistenceMode;
  readonly status: string;
  readonly error?: string;
}

export type VisualGroupSessionMutationResult =
  | { readonly ok: true; readonly value: VisualGroupSession }
  | {
      readonly ok: false;
      readonly value: VisualGroupSession;
      readonly message: string;
    };

export const VISUAL_GROUP_DURABLE_STATUS = 'Saved for this workspace';
export const VISUAL_GROUP_UNSTABLE_STATUS =
  'Session only — workspace identity is not stable';
export const VISUAL_GROUP_STORAGE_UNAVAILABLE_STATUS =
  'Session only — storage unavailable';
export const VISUAL_GROUP_CORRUPT_STATUS =
  'Saved Visual Groups could not be loaded';
export const VISUAL_GROUP_WRITE_FAILURE_STATUS =
  'Saving disabled after a storage error';

export function createVisualGroupSession({
  eligibility,
  storage,
  workspaceId,
}: {
  readonly eligibility: ViewPersistenceEligibility;
  readonly storage: StorageLike | undefined;
  readonly workspaceId: string;
}): VisualGroupSession {
  const empty = createEmptyVisualGroupRegistry(workspaceId);
  if (eligibility !== 'stable') {
    return {
      registry: empty,
      persistenceMode: 'session-only',
      status: VISUAL_GROUP_UNSTABLE_STATUS,
    };
  }
  if (storage === undefined) {
    return {
      registry: empty,
      persistenceMode: 'session-only',
      status: VISUAL_GROUP_STORAGE_UNAVAILABLE_STATUS,
    };
  }
  const loaded = loadVisualGroupRegistry(storage, workspaceId);
  if (loaded.status === 'error') {
    if (loaded.kind === 'storage') {
      return {
        registry: empty,
        persistenceMode: 'session-only',
        status: VISUAL_GROUP_STORAGE_UNAVAILABLE_STATUS,
      };
    }
    return {
      registry: empty,
      persistenceMode: 'blocked-corrupt',
      status: VISUAL_GROUP_CORRUPT_STATUS,
      error: `${loaded.message} The stored value was left unchanged. Reset saved Visual Groups to recover durable editing.`,
    };
  }
  return {
    registry: loaded.value,
    persistenceMode: 'durable',
    status: VISUAL_GROUP_DURABLE_STATUS,
  };
}

export function commitVisualGroupSessionMutation(
  session: VisualGroupSession,
  candidateRegistry: VisualGroupRegistry,
  storage: StorageLike | undefined,
): VisualGroupSessionMutationResult {
  if (candidateRegistry.workspaceId !== session.registry.workspaceId) {
    return {
      ok: false,
      value: session,
      message: 'Visual Group changes cannot cross workspace boundaries.',
    };
  }
  if (session.persistenceMode === 'session-only') {
    return {
      ok: true,
      value: { ...session, registry: candidateRegistry },
    };
  }
  if (session.persistenceMode === 'blocked-corrupt') {
    return {
      ok: false,
      value: session,
      message:
        'Reset saved Visual Groups before making changes to this workspace.',
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
  if (storage === undefined) {
    const message =
      'Browser storage became unavailable before Visual Groups could be saved.';
    return {
      ok: false,
      value: {
        ...session,
        persistenceMode: 'blocked-write-failure',
        status: VISUAL_GROUP_WRITE_FAILURE_STATUS,
        error: `${message} The last confirmed Visual Groups remain active.`,
      },
      message,
    };
  }
  const saved = saveVisualGroupRegistry(storage, candidateRegistry);
  if (!saved.ok) {
    return {
      ok: false,
      value: {
        ...session,
        persistenceMode: 'blocked-write-failure',
        status: VISUAL_GROUP_WRITE_FAILURE_STATUS,
        error: `${saved.message} The last confirmed Visual Groups remain active. Reopen the workspace to retry.`,
      },
      message: saved.message,
    };
  }
  return {
    ok: true,
    value: {
      registry: candidateRegistry,
      persistenceMode: 'durable',
      status: VISUAL_GROUP_DURABLE_STATUS,
    },
  };
}

export function resetCorruptVisualGroupSession(
  session: VisualGroupSession,
  storage: StorageLike | undefined,
): VisualGroupSessionMutationResult {
  if (session.persistenceMode !== 'blocked-corrupt') {
    return {
      ok: false,
      value: session,
      message: 'There is no corrupt Visual Group registry to reset.',
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
  const cleared = clearVisualGroupRegistry(
    storage,
    session.registry.workspaceId,
  );
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
      registry: createEmptyVisualGroupRegistry(session.registry.workspaceId),
      persistenceMode: 'durable',
      status: VISUAL_GROUP_DURABLE_STATUS,
    },
  };
}
