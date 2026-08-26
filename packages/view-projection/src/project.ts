import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';

import { buildBaseProjection } from './base-projection';
import { applyFilters, applyFocus } from './slicing';
import type { ViewProjection, ViewProjectionState } from './types';
import { validateViewProjection } from './validation';
import {
  createProjectionWorkspace,
  type ProjectionWorkspace,
} from './workspace';

export function projectView(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
): ViewProjection {
  const base = buildBaseProjection(workspace, state.disclosure);
  const focused = applyFocus(workspace, base, state.focus);
  const filtered = applyFilters(workspace, focused, state.filters);
  const validation = validateViewProjection(workspace, filtered);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Projection invariant failure${
        first === undefined ? '.' : `: ${first.path} ${first.message}`
      }`,
    );
  }
  return validation.value;
}

export function projectSnapshot(
  snapshot: KnowledgeSnapshot,
  state: ViewProjectionState,
): ViewProjection {
  return projectView(createProjectionWorkspace(snapshot), state);
}
