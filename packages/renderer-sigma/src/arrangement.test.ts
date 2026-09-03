import { describe, expect, it } from 'vitest';
import { createFolderClusterPreviewGeometry } from '@icarus-graph-explorer/spatial-overrides';

import {
  IDLE_GLOBAL_FOLDER_ARRANGEMENT_GESTURE,
  reduceGlobalFolderArrangementGesture,
} from './arrangement';

const automaticPositions = [
  { key: 'a', x: -1, y: 0 },
  { key: 'b', x: 1, y: 0 },
];
const geometry = createFolderClusterPreviewGeometry({
  automaticPositions,
  folderKeyByNodeKey: new Map([
    ['a', 'Folder'],
    ['b', 'Folder'],
  ]),
  anchors: new Map(),
  folderKey: 'Folder',
  visualDownGraphYSign: -1,
});

function prime() {
  return reduceGlobalFolderArrangementGesture(
    IDLE_GLOBAL_FOLDER_ARRANGEMENT_GESTURE,
    {
      type: 'prime',
      folderKey: 'Folder',
      geometry,
      startGraphPoint: { x: 4, y: 6 },
      startViewportPoint: { x: 40, y: 60 },
    },
  );
}

describe('folder arrangement gesture state machine', () => {
  it('arms without treating a click as a drag', () => {
    const primed = prime();
    expect(primed.phase).toBe('primed');
    const unchanged = reduceGlobalFolderArrangementGesture(primed, {
      type: 'move',
      graphPoint: { x: 4.01, y: 6.01 },
      viewportPoint: { x: 41, y: 61 },
      visualDownGraphYSign: -1,
    });
    expect(unchanged).toBe(primed);
    expect(
      reduceGlobalFolderArrangementGesture(unchanged, { type: 'release' }),
    ).toEqual({ phase: 'idle' });
  });

  it('moves through dragging and committing with one final preview', () => {
    const dragging = reduceGlobalFolderArrangementGesture(prime(), {
      type: 'move',
      graphPoint: { x: 5, y: 5 },
      viewportPoint: { x: 48, y: 48 },
      visualDownGraphYSign: -1,
    });
    expect(dragging.phase).toBe('dragging');
    if (dragging.phase !== 'dragging') return;
    expect(dragging.preview.target).toEqual({ x: 1, y: -1 });
    const committing = reduceGlobalFolderArrangementGesture(dragging, {
      type: 'release',
    });
    expect(committing).toMatchObject({
      phase: 'committing',
      folderKey: 'Folder',
      preview: dragging.preview,
    });
    expect(
      reduceGlobalFolderArrangementGesture(committing, {
        type: 'commit-finished',
      }),
    ).toEqual({ phase: 'idle' });
  });

  it.each(['primed', 'dragging', 'committing'] as const)(
    'cancels %s safely',
    (phase) => {
      let state = prime();
      if (phase !== 'primed') {
        state = reduceGlobalFolderArrangementGesture(state, {
          type: 'move',
          graphPoint: { x: 5, y: 5 },
          viewportPoint: { x: 50, y: 50 },
          visualDownGraphYSign: -1,
        });
      }
      if (phase === 'committing') {
        state = reduceGlobalFolderArrangementGesture(state, {
          type: 'release',
        });
      }
      expect(state.phase).toBe(phase);
      expect(
        reduceGlobalFolderArrangementGesture(state, { type: 'cancel' }),
      ).toEqual({ phase: 'idle' });
    },
  );
});
