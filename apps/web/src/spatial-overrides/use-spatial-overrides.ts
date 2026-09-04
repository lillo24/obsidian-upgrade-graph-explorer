import {
  clearFolderSpatialRules,
  clearFolderClusterAnchors,
  folderClusterAnchorMap,
  removeFolderSpatialRule,
  removeFolderClusterAnchor,
  setFolderSpatialRule,
  setFolderClusterAnchor,
  type FolderSpatialRule,
  type NormalizedFolderAnchor,
  type SpatialOverrideRegistry,
  type WorkspaceFolderKey,
} from '@icarus-graph-explorer/spatial-overrides';
import { useCallback, useMemo, useState } from 'react';

import type { ViewPersistenceEligibility } from '../persistence/session';
import type { StorageLike } from '../persistence/storage';
import {
  commitSpatialOverrideSessionMutation,
  createSpatialOverrideSession,
  resetCorruptSpatialOverrideSession,
} from './session';

/** Keyed independently of graph view state; mutations never dispatch KG6 work. */
export function useSpatialOverrides({
  workspaceId,
  eligibility,
  storage,
}: {
  readonly workspaceId: string;
  readonly eligibility: ViewPersistenceEligibility;
  readonly storage: StorageLike | undefined;
}) {
  const loaded = useMemo(
    () => createSpatialOverrideSession({ workspaceId, eligibility, storage }),
    [workspaceId, eligibility, storage],
  );
  const key = `${eligibility}\0${workspaceId}`;
  const [sessions, setSessions] = useState(() => new Map([[key, loaded]]));
  const session = sessions.get(key) ?? loaded;
  const anchors = useMemo(
    () => folderClusterAnchorMap(session.registry),
    [session.registry],
  );
  const commit = useCallback(
    (candidate: SpatialOverrideRegistry): string | undefined => {
      const committed = commitSpatialOverrideSessionMutation(
        session,
        candidate,
        storage,
      );
      setSessions((current) => new Map(current).set(key, committed.value));
      return committed.ok ? undefined : committed.message;
    },
    [key, session, storage],
  );
  const setFolderAnchor = useCallback(
    (folderKey: WorkspaceFolderKey, anchor: NormalizedFolderAnchor) =>
      commit(setFolderClusterAnchor(session.registry, folderKey, anchor)),
    [commit, session.registry],
  );
  const setFolderRule = useCallback(
    (rule: FolderSpatialRule) =>
      commit(setFolderSpatialRule(session.registry, rule)),
    [commit, session.registry],
  );
  const removeFolderRule = useCallback(
    (folderKey: WorkspaceFolderKey) =>
      commit(removeFolderSpatialRule(session.registry, folderKey)),
    [commit, session.registry],
  );
  const clearFolderRules = useCallback(
    () => commit(clearFolderSpatialRules(session.registry)),
    [commit, session.registry],
  );
  const resetFolderAnchor = useCallback(
    (folderKey: WorkspaceFolderKey) =>
      commit(removeFolderClusterAnchor(session.registry, folderKey)),
    [commit, session.registry],
  );
  const resetAllFolderAnchors = useCallback(
    () => commit(clearFolderClusterAnchors(session.registry)),
    [commit, session.registry],
  );
  const recoverCorruptRegistry = useCallback((): string | undefined => {
    const recovered = resetCorruptSpatialOverrideSession(session, storage);
    setSessions((current) => new Map(current).set(key, recovered.value));
    return recovered.ok ? undefined : recovered.message;
  }, [key, session, storage]);
  return {
    session,
    anchors,
    rules: session.registry.allNetwork.folderRules,
    setFolderRule,
    removeFolderRule,
    clearFolderRules,
    setFolderAnchor,
    resetFolderAnchor,
    resetAllFolderAnchors,
    recoverCorruptRegistry,
  };
}
