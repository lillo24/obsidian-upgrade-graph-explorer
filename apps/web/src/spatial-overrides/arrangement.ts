import type {
  FolderSpatialBehavior,
  WorkspaceFolderKey,
} from '@icarus-graph-explorer/spatial-overrides';

export type FolderArrangementModeState =
  | { readonly phase: 'inactive' }
  | { readonly phase: 'active-no-folder' }
  | {
      readonly phase:
        | 'editing'
        | 'choosing-scope'
        | 'dragging-target'
        | 'committing'
        | 'settling-pull';
      readonly activeFolderKey: WorkspaceFolderKey;
    };

export type FolderArrangementModeAction =
  | {
      readonly type: 'enter';
      readonly folderKey?: WorkspaceFolderKey;
    }
  | {
      readonly type: 'activate-folder';
      readonly folderKey: WorkspaceFolderKey | undefined;
    }
  | { readonly type: 'choose-scope'; readonly active: boolean }
  | { readonly type: 'target-drag'; readonly active: boolean }
  | {
      readonly type: 'commit';
      readonly behavior: FolderSpatialBehavior;
    }
  | { readonly type: 'adopted' }
  | { readonly type: 'exit' };

export const INACTIVE_FOLDER_ARRANGEMENT_MODE = {
  phase: 'inactive',
} as const satisfies FolderArrangementModeState;

export function folderArrangementActive(
  state: FolderArrangementModeState,
): boolean {
  return state.phase !== 'inactive';
}

export function folderArrangementActiveFolder(
  state: FolderArrangementModeState,
): WorkspaceFolderKey | undefined {
  return 'activeFolderKey' in state ? state.activeFolderKey : undefined;
}

/** Authoritative production editor lifecycle; Sigma owns only raw gesture data. */
export function folderArrangementModeReducer(
  state: FolderArrangementModeState,
  action: FolderArrangementModeAction,
): FolderArrangementModeState {
  switch (action.type) {
    case 'enter':
      return action.folderKey === undefined
        ? { phase: 'active-no-folder' }
        : { phase: 'editing', activeFolderKey: action.folderKey };
    case 'activate-folder':
      return action.folderKey === undefined
        ? { phase: 'active-no-folder' }
        : { phase: 'editing', activeFolderKey: action.folderKey };
    case 'choose-scope': {
      const folderKey = folderArrangementActiveFolder(state);
      return folderKey === undefined
        ? state
        : {
            phase: action.active ? 'choosing-scope' : 'editing',
            activeFolderKey: folderKey,
          };
    }
    case 'target-drag': {
      const folderKey = folderArrangementActiveFolder(state);
      return folderKey === undefined
        ? state
        : {
            phase: action.active ? 'dragging-target' : 'editing',
            activeFolderKey: folderKey,
          };
    }
    case 'commit': {
      const folderKey = folderArrangementActiveFolder(state);
      return folderKey === undefined
        ? state
        : {
            phase: action.behavior === 'pull' ? 'settling-pull' : 'committing',
            activeFolderKey: folderKey,
          };
    }
    case 'adopted': {
      const folderKey = folderArrangementActiveFolder(state);
      return folderKey === undefined
        ? state
        : { phase: 'editing', activeFolderKey: folderKey };
    }
    case 'exit':
      return INACTIVE_FOLDER_ARRANGEMENT_MODE;
  }
}
