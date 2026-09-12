import {
  EMPTY_FOCUS_SCHEMATIC_SOFT_FOLDER_DISPLAY_INTENT,
  reconcileFocusSchematicSoftFolderDisplayIntent,
  type FocusSchematicSoftFolderDisplayInputFile,
  type FocusSchematicSoftFolderDisplayIntent,
} from '@icarus-graph-explorer/focus-schematic-layout';
import { useCallback, useMemo, useState } from 'react';

import type { ViewPersistenceEligibility } from '../persistence/session';
import type { StorageLike } from '../persistence/storage';
import {
  commitSoftFolderDisplaySession,
  createSoftFolderDisplaySession,
} from './session';

/** Workspace-keyed manual intent; derived compression is never persisted. */
export function useSoftFolderDisplay({
  workspaceId,
  workspaceFiles,
  eligibility,
  storage,
}: {
  readonly workspaceId: string;
  readonly workspaceFiles: readonly FocusSchematicSoftFolderDisplayInputFile[];
  readonly eligibility: ViewPersistenceEligibility;
  readonly storage: StorageLike | undefined;
}) {
  const loaded = useMemo(
    () => createSoftFolderDisplaySession({ workspaceId, eligibility, storage }),
    [workspaceId, eligibility, storage],
  );
  const key = `${eligibility}\0${workspaceId}`;
  const [sessions, setSessions] = useState(() => new Map([[key, loaded]]));
  const session = sessions.get(key) ?? loaded;
  const displayIntent = useMemo(
    () =>
      reconcileFocusSchematicSoftFolderDisplayIntent(
        session.registry.displayIntent,
        workspaceFiles,
      ),
    [session.registry.displayIntent, workspaceFiles],
  );
  const commit = useCallback(
    (candidate: FocusSchematicSoftFolderDisplayIntent): string | undefined => {
      const reconciled = reconcileFocusSchematicSoftFolderDisplayIntent(
        candidate,
        workspaceFiles,
      );
      const committed = commitSoftFolderDisplaySession(
        session,
        reconciled,
        storage,
      );
      setSessions((current) => new Map(current).set(key, committed.value));
      return committed.ok ? undefined : committed.message;
    },
    [key, session, storage, workspaceFiles],
  );
  const reset = useCallback(
    () => commit(EMPTY_FOCUS_SCHEMATIC_SOFT_FOLDER_DISPLAY_INTENT),
    [commit],
  );
  return { session, displayIntent, commit, reset };
}
