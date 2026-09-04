import {
  previewFolderClusterFromPointer,
  type FolderClusterPreviewGeometry,
  type FolderClusterPreviewResult,
  type SpatialPoint,
  type VisualDownGraphYSign,
} from '@icarus-graph-explorer/spatial-overrides';

export const GLOBAL_FOLDER_DRAG_THRESHOLD_PX = 3;

export interface GlobalFolderDragBase {
  readonly folderKey: string;
  readonly geometry: FolderClusterPreviewGeometry;
  readonly startGraphPoint: SpatialPoint;
  readonly startViewportPoint: SpatialPoint;
}

export type GlobalFolderArrangementGestureState =
  | { readonly phase: 'idle' }
  | ({ readonly phase: 'primed' } & GlobalFolderDragBase)
  | ({
      readonly phase: 'dragging';
      readonly preview: FolderClusterPreviewResult;
    } & GlobalFolderDragBase)
  | {
      readonly phase: 'committing';
      readonly folderKey: string;
      readonly preview: FolderClusterPreviewResult;
    };

export type GlobalFolderArrangementGestureEvent =
  | ({ readonly type: 'prime' } & GlobalFolderDragBase)
  | {
      readonly type: 'move';
      readonly graphPoint: SpatialPoint;
      readonly viewportPoint: SpatialPoint;
      readonly visualDownGraphYSign: VisualDownGraphYSign;
    }
  | { readonly type: 'release' }
  | { readonly type: 'cancel' }
  | { readonly type: 'commit-finished' };

export const IDLE_GLOBAL_FOLDER_ARRANGEMENT_GESTURE = {
  phase: 'idle',
} as const satisfies GlobalFolderArrangementGestureState;

function distance(left: SpatialPoint, right: SpatialPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

/** Pure transient gesture machine; persistence remains an outer transaction. */
export function reduceGlobalFolderArrangementGesture(
  state: GlobalFolderArrangementGestureState,
  event: GlobalFolderArrangementGestureEvent,
): GlobalFolderArrangementGestureState {
  switch (event.type) {
    case 'prime':
      return { phase: 'primed', ...event };
    case 'move': {
      if (state.phase !== 'primed' && state.phase !== 'dragging') return state;
      if (
        state.phase === 'primed' &&
        distance(state.startViewportPoint, event.viewportPoint) <
          GLOBAL_FOLDER_DRAG_THRESHOLD_PX
      ) {
        return state;
      }
      return {
        phase: 'dragging',
        folderKey: state.folderKey,
        geometry: state.geometry,
        startGraphPoint: state.startGraphPoint,
        startViewportPoint: state.startViewportPoint,
        preview: previewFolderClusterFromPointer({
          geometry: state.geometry,
          startPointer: state.startGraphPoint,
          currentPointer: event.graphPoint,
          visualDownGraphYSign: event.visualDownGraphYSign,
        }),
      };
    }
    case 'release':
      return state.phase === 'dragging'
        ? {
            phase: 'committing',
            folderKey: state.folderKey,
            preview: state.preview,
          }
        : IDLE_GLOBAL_FOLDER_ARRANGEMENT_GESTURE;
    case 'cancel':
    case 'commit-finished':
      return IDLE_GLOBAL_FOLDER_ARRANGEMENT_GESTURE;
  }
}
