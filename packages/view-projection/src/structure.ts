import { projectFocusedDetailView } from './focused-detail';
import { projectView } from './project';
import type { ViewProjection, ViewProjectionState } from './types';
import type { ProjectionWorkspace } from './workspace';

/**
 * Projects ordinary Structure unchanged, but gives active Focus a stable
 * documents-first neighborhood and root-scoped automatic structural depth.
 */
export function projectStructureView(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
): ViewProjection {
  if (state.focus === undefined) return projectView(workspace, state);

  return projectFocusedDetailView(workspace, state, 'Focus hierarchy');
}
