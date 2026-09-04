import { describe, expect, it } from 'vitest';

import {
  folderArrangementModeReducer,
  INACTIVE_FOLDER_ARRANGEMENT_MODE,
} from './arrangement';

describe('folderArrangementModeReducer', () => {
  it('enters without inventing an active folder', () => {
    expect(
      folderArrangementModeReducer(INACTIVE_FOLDER_ARRANGEMENT_MODE, {
        type: 'enter',
      }),
    ).toEqual({ phase: 'active' });
  });

  it('activates an exact folder and can clear it while remaining active', () => {
    const active = folderArrangementModeReducer(
      INACTIVE_FOLDER_ARRANGEMENT_MODE,
      { type: 'activate-folder', folderKey: 'notes' },
    );
    expect(active).toEqual({ phase: 'active', activeFolderKey: 'notes' });
    expect(
      folderArrangementModeReducer(active, {
        type: 'activate-folder',
        folderKey: undefined,
      }),
    ).toEqual({ phase: 'active' });
  });

  it('exits to the shared inactive state', () => {
    expect(
      folderArrangementModeReducer(
        { phase: 'active', activeFolderKey: '.' },
        { type: 'exit' },
      ),
    ).toBe(INACTIVE_FOLDER_ARRANGEMENT_MODE);
  });
});
