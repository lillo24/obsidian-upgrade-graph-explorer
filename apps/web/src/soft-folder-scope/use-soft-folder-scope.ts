import {
  promoteFocusSchematicSoftFolderGroup,
  promoteFocusSchematicSoftFolderGroupWithSiblings,
  reconcileFocusSchematicSoftFolderScopeOverrides,
  resetFocusSchematicSoftFolderGroup,
} from '@icarus-graph-explorer/focus-schematic-layout';
import type { WorkspaceFolderKey } from '@icarus-graph-explorer/core';
import { useCallback, useMemo, useState } from 'react';

import type { ViewPersistenceEligibility } from '../persistence/session';
import type { StorageLike } from '../persistence/storage';
import {
  commitSoftFolderScopeSession,
  createSoftFolderScopeSession,
} from './session';

/** Workspace-keyed HIER4B state; only canonical sparse rules cross the worker boundary. */
export function useSoftFolderScope({
  workspaceId,
  workspaceExactFolderKeys,
  eligibility,
  storage,
}: {
  readonly workspaceId: string;
  readonly workspaceExactFolderKeys: readonly WorkspaceFolderKey[];
  readonly eligibility: ViewPersistenceEligibility;
  readonly storage: StorageLike | undefined;
}) {
  const loaded = useMemo(
    () => createSoftFolderScopeSession({ workspaceId, eligibility, storage }),
    [workspaceId, eligibility, storage],
  );
  const key = `${eligibility}\0${workspaceId}`;
  const [sessions, setSessions] = useState(() => new Map([[key, loaded]]));
  const session = sessions.get(key) ?? loaded;
  const overrides = useMemo(
    () =>
      reconcileFocusSchematicSoftFolderScopeOverrides(
        session.registry.overrides,
        workspaceExactFolderKeys,
      ),
    [session.registry.overrides, workspaceExactFolderKeys],
  );
  const commit = useCallback(
    (candidate: typeof overrides): string | undefined => {
      const committed = commitSoftFolderScopeSession(
        session,
        candidate,
        storage,
      );
      setSessions((current) => new Map(current).set(key, committed.value));
      return committed.ok ? undefined : committed.message;
    },
    [key, session, storage],
  );
  const promoteGroup = useCallback(
    (spatialGroupKey: WorkspaceFolderKey) =>
      commit(
        promoteFocusSchematicSoftFolderGroup(
          overrides,
          workspaceExactFolderKeys,
          spatialGroupKey,
        ),
      ),
    [commit, overrides, workspaceExactFolderKeys],
  );
  const promoteGroupWithSiblings = useCallback(
    (spatialGroupKey: WorkspaceFolderKey) =>
      commit(
        promoteFocusSchematicSoftFolderGroupWithSiblings(
          overrides,
          workspaceExactFolderKeys,
          spatialGroupKey,
        ),
      ),
    [commit, overrides, workspaceExactFolderKeys],
  );
  const resetGroup = useCallback(
    (spatialGroupKey: WorkspaceFolderKey) =>
      commit(
        resetFocusSchematicSoftFolderGroup(
          overrides,
          workspaceExactFolderKeys,
          spatialGroupKey,
        ),
      ),
    [commit, overrides, workspaceExactFolderKeys],
  );
  return {
    session,
    overrides,
    promoteGroup,
    promoteGroupWithSiblings,
    resetGroup,
  };
}
