import type { ViewPersistenceEligibility } from './session';
import {
  clearSavedViewRegistry,
  createEmptySavedViewRegistry,
  loadSavedViews,
  saveSavedViewRegistry,
  type SavedViewRegistry,
} from './saved-views';
import type { StorageLike } from './storage';

export interface SavedViewSession {
  readonly registry: SavedViewRegistry;
  readonly writable: boolean;
  readonly recoveryAvailable: boolean;
  readonly status: string;
  readonly error?: string;
}

export type SavedViewSessionMutationResult =
  | { readonly ok: true; readonly session: SavedViewSession }
  | {
      readonly ok: false;
      readonly session: SavedViewSession;
      readonly message: string;
    };

export function createSavedViewSession({
  eligibility,
  storage,
  workspaceId,
}: {
  readonly eligibility: ViewPersistenceEligibility;
  readonly storage: StorageLike | undefined;
  readonly workspaceId: string;
}): SavedViewSession {
  const registry = createEmptySavedViewRegistry(workspaceId);
  if (eligibility !== 'stable') {
    return {
      registry,
      writable: false,
      recoveryAvailable: false,
      status:
        eligibility === 'transient'
          ? 'Saved Views require stable workspace identity; this report is session-only.'
          : 'Saved Views require stable workspace identity; this legacy report cannot save them.',
    };
  }
  if (storage === undefined) {
    return {
      registry,
      writable: false,
      recoveryAvailable: false,
      status:
        'Saved Views are unavailable because browser storage could not be accessed.',
    };
  }
  const loaded = loadSavedViews(storage, workspaceId);
  if (loaded.status === 'error') {
    return {
      registry,
      writable: false,
      recoveryAvailable: true,
      status: 'Saved Views are blocked until this registry is reset.',
      error: `${loaded.message} The stored value was left unchanged.`,
    };
  }
  return {
    registry: loaded.value,
    writable: true,
    recoveryAvailable: false,
    status:
      loaded.status === 'loaded'
        ? 'Saved Views are stored for this stable workspace.'
        : 'No Saved Views have been stored for this stable workspace.',
  };
}

export function commitSavedViewSessionMutation(
  session: SavedViewSession,
  candidate: SavedViewRegistry,
  storage: StorageLike | undefined,
): SavedViewSessionMutationResult {
  if (!session.writable || storage === undefined) {
    return { ok: false, session, message: session.status };
  }
  const saved = saveSavedViewRegistry(storage, candidate);
  if (!saved.ok) {
    const next = {
      ...session,
      writable: false,
      recoveryAvailable: false,
      status: 'Saved Views are unavailable after a storage write failure.',
      error: `${saved.message} Confirmed Saved Views were retained in memory.`,
    };
    return { ok: false, session: next, message: saved.message };
  }
  return {
    ok: true,
    session: {
      registry: candidate,
      writable: true,
      recoveryAvailable: false,
      status: 'Saved Views are stored for this stable workspace.',
    },
  };
}

export function resetSavedViewSession(
  session: SavedViewSession,
  storage: StorageLike | undefined,
): SavedViewSessionMutationResult {
  if (!session.recoveryAvailable || storage === undefined) {
    return { ok: false, session, message: session.status };
  }
  const cleared = clearSavedViewRegistry(storage, session.registry.workspaceId);
  if (!cleared.ok) {
    const next = { ...session, error: cleared.message };
    return { ok: false, session: next, message: cleared.message };
  }
  return {
    ok: true,
    session: {
      registry: createEmptySavedViewRegistry(session.registry.workspaceId),
      writable: true,
      recoveryAvailable: false,
      status: 'No Saved Views have been stored for this stable workspace.',
    },
  };
}
