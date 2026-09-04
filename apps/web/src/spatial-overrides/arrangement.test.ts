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
    ).toEqual({ phase: 'active-no-folder' });
  });

  it('activates an exact folder and can clear it while remaining active', () => {
    const active = folderArrangementModeReducer(
      INACTIVE_FOLDER_ARRANGEMENT_MODE,
      { type: 'activate-folder', folderKey: 'notes' },
    );
    expect(active).toEqual({ phase: 'editing', activeFolderKey: 'notes' });
    expect(
      folderArrangementModeReducer(active, {
        type: 'activate-folder',
        folderKey: undefined,
      }),
    ).toEqual({ phase: 'active-no-folder' });
  });

  it('exits to the shared inactive state', () => {
    expect(
      folderArrangementModeReducer(
        { phase: 'editing', activeFolderKey: '.' },
        { type: 'exit' },
      ),
    ).toBe(INACTIVE_FOLDER_ARRANGEMENT_MODE);
  });

  it('tracks choosing, dragging, committing, and Pull settling in one lifecycle', () => {
    const editing = { phase: 'editing', activeFolderKey: 'notes' } as const;
    const choosing = folderArrangementModeReducer(editing, {
      type: 'choose-scope',
      active: true,
    });
    expect(choosing.phase).toBe('choosing-scope');
    expect(
      folderArrangementModeReducer(choosing, {
        type: 'target-drag',
        active: true,
      }).phase,
    ).toBe('dragging-target');
    const settling = folderArrangementModeReducer(editing, {
      type: 'commit',
      behavior: 'pull',
    });
    expect(settling.phase).toBe('settling-pull');
    expect(folderArrangementModeReducer(settling, { type: 'adopted' })).toEqual(
      editing,
    );
    expect(
      folderArrangementModeReducer(editing, {
        type: 'commit',
        behavior: 'place',
      }).phase,
    ).toBe('committing');
  });
});
