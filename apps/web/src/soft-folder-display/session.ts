import type { FocusSchematicSoftFolderDisplayIntent } from '@icarus-graph-explorer/focus-schematic-layout';

import type { ViewPersistenceEligibility } from '../persistence/session';
import {
  createEmptySoftFolderDisplayRegistry,
  loadSoftFolderDisplay,
  saveSoftFolderDisplay,
  validateSoftFolderDisplayRegistry,
  type SoftFolderDisplayRegistry,
} from '../persistence/soft-folder-display';
import type { StorageLike } from '../persistence/storage';

export interface SoftFolderDisplaySession {
  readonly registry: SoftFolderDisplayRegistry;
  readonly persistenceMode:
    'durable' | 'session-only' | 'blocked-corrupt' | 'blocked-write-failure';
  readonly status: string;
  readonly error?: string;
}

export function createSoftFolderDisplaySession({
  eligibility,
  storage,
  workspaceId,
}: {
  readonly eligibility: ViewPersistenceEligibility;
  readonly storage: StorageLike | undefined;
  readonly workspaceId: string;
}): SoftFolderDisplaySession {
  const registry = createEmptySoftFolderDisplayRegistry(workspaceId);
  if (eligibility !== 'stable')
    return {
      registry,
      persistenceMode: 'session-only',
      status:
        'Soft folder display is session only — workspace identity is not stable',
    };
  if (storage === undefined)
    return {
      registry,
      persistenceMode: 'session-only',
      status: 'Soft folder display is session only — storage unavailable',
    };
  const loaded = loadSoftFolderDisplay(storage, workspaceId);
  if (!loaded.ok)
    return loaded.kind === 'storage'
      ? {
          registry,
          persistenceMode: 'session-only',
          status: 'Soft folder display is session only — storage unavailable',
          error: loaded.message,
        }
      : {
          registry,
          persistenceMode: 'blocked-corrupt',
          status: 'Saved Soft folder display could not be loaded',
          error: `${loaded.message} The stored value was left unchanged.`,
        };
  if (loaded.legacyReset) {
    const reset = saveSoftFolderDisplay(storage, loaded.value);
    if (!reset.ok)
      return {
        registry: loaded.value,
        persistenceMode: 'blocked-write-failure',
        status: 'Legacy Soft folder grouping was reset for this session',
        error: `${reset.message} Reopen the workspace to retry the durable reset.`,
      };
    return {
      registry: loaded.value,
      persistenceMode: 'durable',
      status: 'Legacy flat Soft grouping was reset to nested folder display',
    };
  }
  return {
    registry: loaded.value,
    persistenceMode: 'durable',
    status: 'Soft folder display is saved for this workspace',
  };
}

/** Durable sessions write first; failed candidates are never adopted. */
export function commitSoftFolderDisplaySession(
  session: SoftFolderDisplaySession,
  displayIntent: FocusSchematicSoftFolderDisplayIntent,
  storage: StorageLike | undefined,
): {
  readonly ok: boolean;
  readonly value: SoftFolderDisplaySession;
  readonly message?: string;
} {
  const validation = validateSoftFolderDisplayRegistry(
    { ...session.registry, displayIntent },
    session.registry.workspaceId,
  );
  if (!validation.ok)
    return { ok: false, value: session, message: validation.message };
  if (session.persistenceMode === 'session-only')
    return {
      ok: true,
      value: { ...session, registry: validation.value },
    };
  if (session.persistenceMode !== 'durable')
    return {
      ok: false,
      value: session,
      message:
        session.error ??
        'Reopen this workspace after resolving its Soft folder display storage error.',
    };
  const saved =
    storage === undefined
      ? {
          ok: false as const,
          message:
            'Storage became unavailable before Soft folder display could be saved.',
        }
      : saveSoftFolderDisplay(storage, validation.value);
  if (!saved.ok)
    return {
      ok: false,
      message: saved.message,
      value: {
        ...session,
        persistenceMode: 'blocked-write-failure',
        status: 'Saving Soft folder display is disabled after a storage error',
        error: `${saved.message} The last confirmed display remains active. Reopen the workspace to retry.`,
      },
    };
  return {
    ok: true,
    value: { ...session, registry: validation.value },
  };
}
