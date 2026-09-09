import type { FocusSchematicSoftFolderScopeOverride } from '@icarus-graph-explorer/focus-schematic-layout';

import type { ViewPersistenceEligibility } from '../persistence/session';
import {
  createEmptySoftFolderScopeRegistry,
  loadSoftFolderScope,
  saveSoftFolderScope,
  validateSoftFolderScopeRegistry,
  type SoftFolderScopeRegistry,
} from '../persistence/soft-folder-scope';
import type { StorageLike } from '../persistence/storage';

export interface SoftFolderScopeSession {
  readonly registry: SoftFolderScopeRegistry;
  readonly persistenceMode:
    'durable' | 'session-only' | 'blocked-corrupt' | 'blocked-write-failure';
  readonly status: string;
  readonly error?: string;
}

export function createSoftFolderScopeSession({
  eligibility,
  storage,
  workspaceId,
}: {
  readonly eligibility: ViewPersistenceEligibility;
  readonly storage: StorageLike | undefined;
  readonly workspaceId: string;
}): SoftFolderScopeSession {
  const registry = createEmptySoftFolderScopeRegistry(workspaceId);
  if (eligibility !== 'stable')
    return {
      registry,
      persistenceMode: 'session-only',
      status:
        'Soft folder grouping is session only — workspace identity is not stable',
    };
  if (storage === undefined)
    return {
      registry,
      persistenceMode: 'session-only',
      status: 'Soft folder grouping is session only — storage unavailable',
    };
  const loaded = loadSoftFolderScope(storage, workspaceId);
  if (!loaded.ok)
    return loaded.kind === 'storage'
      ? {
          registry,
          persistenceMode: 'session-only',
          status: 'Soft folder grouping is session only — storage unavailable',
          error: loaded.message,
        }
      : {
          registry,
          persistenceMode: 'blocked-corrupt',
          status: 'Saved Soft folder grouping could not be loaded',
          error: `${loaded.message} The stored value was left unchanged.`,
        };
  return {
    registry: loaded.value,
    persistenceMode: 'durable',
    status: 'Soft folder grouping is saved for this workspace',
  };
}

export function commitSoftFolderScopeSession(
  session: SoftFolderScopeSession,
  overrides: readonly FocusSchematicSoftFolderScopeOverride[],
  storage: StorageLike | undefined,
): {
  readonly ok: boolean;
  readonly value: SoftFolderScopeSession;
  readonly message?: string;
} {
  const validation = validateSoftFolderScopeRegistry(
    { ...session.registry, overrides },
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
        'Reopen this workspace after resolving its Soft folder grouping storage error.',
    };
  const saved =
    storage === undefined
      ? {
          ok: false as const,
          message:
            'Storage became unavailable before Soft folder grouping could be saved.',
        }
      : saveSoftFolderScope(storage, validation.value);
  if (!saved.ok)
    return {
      ok: false,
      message: saved.message,
      value: {
        ...session,
        persistenceMode: 'blocked-write-failure',
        status: 'Saving Soft folder grouping is disabled after a storage error',
        error: `${saved.message} The last confirmed grouping remains active. Reopen the workspace to retry.`,
      },
    };
  return {
    ok: true,
    value: { ...session, registry: validation.value },
  };
}
