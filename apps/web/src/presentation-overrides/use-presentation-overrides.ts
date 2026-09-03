import type { AddressableEntity, EntityId } from '@icarus-graph-explorer/core';
import {
  reconcilePresentationOverrides,
  setEntitySizeScale,
} from '@icarus-graph-explorer/presentation-overrides';
import { useCallback, useMemo, useState } from 'react';

import type { ViewPersistenceEligibility } from '../persistence/session';
import type { StorageLike } from '../persistence/storage';
import {
  commitPresentationOverrideSession,
  createPresentationOverrideSession,
} from './session';

/** A keyed app session; changing sizes never schedules a projection update. */
export function usePresentationOverrides({
  workspaceId,
  eligibility,
  storage,
  entityById,
}: {
  readonly workspaceId: string;
  readonly eligibility: ViewPersistenceEligibility;
  readonly storage: StorageLike | undefined;
  readonly entityById: ReadonlyMap<EntityId, AddressableEntity>;
}) {
  const loaded = useMemo(
    () =>
      createPresentationOverrideSession({ workspaceId, eligibility, storage }),
    [workspaceId, eligibility, storage],
  );
  const key = `${eligibility}\0${workspaceId}`;
  const [sessions, setSessions] = useState(() => new Map([[key, loaded]]));
  const session = sessions.get(key) ?? loaded;
  const overrides = useMemo(
    () => reconcilePresentationOverrides(session.registry, entityById),
    [session.registry, entityById],
  );
  const changeSizeScale = useCallback(
    (entityId: EntityId, sizeScale: number | undefined): string | undefined => {
      if (entityById.get(entityId)?.kind !== 'document') {
        return 'Only an existing canonical File can have a Network size override.';
      }
      const candidate = setEntitySizeScale(
        session.registry,
        entityId,
        sizeScale,
      );
      const committed = commitPresentationOverrideSession(
        session,
        candidate,
        storage,
      );
      setSessions((current) => new Map(current).set(key, committed.value));
      return committed.ok ? undefined : committed.message;
    },
    [entityById, session, storage, key],
  );
  return { session, overrides, changeSizeScale };
}
