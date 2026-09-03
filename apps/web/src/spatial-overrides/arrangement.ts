import type { WorkspaceFolderKey } from '@icarus-graph-explorer/spatial-overrides';

export type FolderArrangementModeState =
  | { readonly phase: 'inactive' }
  | {
      readonly phase: 'active';
      readonly activeFolderKey?: WorkspaceFolderKey;
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
  | { readonly type: 'exit' };

export const INACTIVE_FOLDER_ARRANGEMENT_MODE = {
  phase: 'inactive',
} as const satisfies FolderArrangementModeState;

/** Application-level mode only; renderer pointer gestures use a separate reducer. */
export function folderArrangementModeReducer(
  state: FolderArrangementModeState,
  action: FolderArrangementModeAction,
): FolderArrangementModeState {
  switch (action.type) {
    case 'enter':
      return {
        phase: 'active',
        ...(action.folderKey === undefined
          ? {}
          : { activeFolderKey: action.folderKey }),
      };
    case 'activate-folder':
      if (state.phase === 'inactive') {
        return {
          phase: 'active',
          ...(action.folderKey === undefined
            ? {}
            : { activeFolderKey: action.folderKey }),
        };
      }
      return action.folderKey === undefined
        ? { phase: 'active' }
        : { phase: 'active', activeFolderKey: action.folderKey };
    case 'exit':
      return INACTIVE_FOLDER_ARRANGEMENT_MODE;
  }
}
