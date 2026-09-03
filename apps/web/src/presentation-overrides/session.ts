import {
  createEmptyPresentationOverrideRegistry,
  validatePresentationOverrideRegistry,
  type PresentationOverrideRegistry,
} from '@icarus-graph-explorer/presentation-overrides';

import {
  loadPresentationOverrides,
  savePresentationOverrides,
} from '../persistence/presentation-overrides';
import type { ViewPersistenceEligibility } from '../persistence/session';
import type { StorageLike } from '../persistence/storage';

export interface PresentationOverrideSession {
  readonly registry: PresentationOverrideRegistry;
  readonly persistenceMode:
    'durable' | 'session-only' | 'blocked-corrupt' | 'blocked-write-failure';
  readonly status: string;
  readonly error?: string;
}

export function createPresentationOverrideSession({
  eligibility,
  storage,
  workspaceId,
}: {
  readonly eligibility: ViewPersistenceEligibility;
  readonly storage: StorageLike | undefined;
  readonly workspaceId: string;
}): PresentationOverrideSession {
  const registry = createEmptyPresentationOverrideRegistry(workspaceId);
  if (eligibility !== 'stable') {
    return {
      registry,
      persistenceMode: 'session-only',
      status: 'Session only — workspace identity is not stable',
    };
  }
  if (storage === undefined) {
    return {
      registry,
      persistenceMode: 'session-only',
      status: 'Session only — storage unavailable',
    };
  }
  const loaded = loadPresentationOverrides(storage, workspaceId);
  if (!loaded.ok) {
    return loaded.kind === 'storage'
      ? {
          registry,
          persistenceMode: 'session-only',
          status: 'Session only — storage unavailable',
          error: loaded.message,
        }
      : {
          registry,
          persistenceMode: 'blocked-corrupt',
          status: 'Saved Network sizes could not be loaded',
          error: `${loaded.message} The stored value was left unchanged. Repair or remove this workspace's presentation-overrides storage key, then reopen the workspace to retry.`,
        };
  }
  return {
    registry: loaded.value,
    persistenceMode: 'durable',
    status: 'Saved for this workspace',
  };
}

export function commitPresentationOverrideSession(
  session: PresentationOverrideSession,
  candidate: PresentationOverrideRegistry,
  storage: StorageLike | undefined,
): {
  readonly ok: boolean;
  readonly value: PresentationOverrideSession;
  readonly message?: string;
} {
  const validation = validatePresentationOverrideRegistry(
    candidate,
    session.registry.workspaceId,
  );
  if (!validation.ok)
    return { ok: false, value: session, message: validation.message };
  if (session.persistenceMode === 'session-only') {
    return { ok: true, value: { ...session, registry: validation.value } };
  }
  if (session.persistenceMode !== 'durable') {
    return {
      ok: false,
      value: session,
      message:
        session.error ??
        'Reopen this workspace after resolving its Network size storage error.',
    };
  }
  const saved =
    storage === undefined
      ? {
          ok: false as const,
          message:
            'Storage became unavailable before Network sizes could be saved.',
        }
      : savePresentationOverrides(storage, validation.value);
  if (!saved.ok) {
    return {
      ok: false,
      message: saved.message,
      value: {
        ...session,
        persistenceMode: 'blocked-write-failure',
        status: 'Saving disabled after a storage error',
        error: `${saved.message} The last confirmed Network sizes remain active. Reopen the workspace to retry.`,
      },
    };
  }
  return { ok: true, value: { ...session, registry: validation.value } };
}
