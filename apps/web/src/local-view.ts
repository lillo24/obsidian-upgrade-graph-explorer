import type { EntityId } from '@icarus-graph-explorer/core';
import {
  deriveLocalProjectionState,
  projectLocalView,
  revealEntityInViewState,
  type ProjectionNodeId,
  type ProjectionWorkspace,
  type StructuralDepth,
  type ViewProjection,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import { planEntityNavigation } from './navigation';

export interface LocalNavigationPlan {
  readonly state: ViewProjectionState;
  readonly projection: ViewProjection;
  readonly projectionNodeId: ProjectionNodeId;
  readonly rootEntityId: EntityId;
  readonly announcement: string;
}

function localPlan(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
  entityId: EntityId,
  announcement: string,
  revealHiddenExact: boolean,
): LocalNavigationPlan {
  let localState = deriveLocalProjectionState(workspace, state, entityId);
  const target = workspace.requireEntity(entityId);
  if (target.kind !== 'document' && revealHiddenExact) {
    localState = revealEntityInViewState(workspace, localState, entityId);
  }
  const projection = projectLocalView(workspace, localState);
  const exactNode = projection.nodes.find(
    (candidate) =>
      candidate.kind === 'entity' && candidate.entityId === entityId,
  );
  const rootEntityId = localState.focus?.rootEntityId;
  const node =
    exactNode ??
    projection.nodes.find(
      (candidate) =>
        candidate.kind === 'entity' && candidate.entityId === rootEntityId,
    );
  if (node === undefined || node.kind !== 'entity') {
    throw new Error(
      `Focus navigation could not project canonical target "${entityId}".`,
    );
  }
  if (rootEntityId === undefined) {
    throw new Error('Focus navigation produced no document root.');
  }
  return {
    state: localState,
    projection,
    projectionNodeId: node.id,
    rootEntityId,
    announcement,
  };
}

export function planLocalEntry(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
  entityId: EntityId,
  depth: StructuralDepth,
): LocalNavigationPlan {
  const freshFocusState: ViewProjectionState = {
    disclosure: {
      ...state.disclosure,
      defaultDepth: depth,
      expandedEntityIds: [],
      collapsedEntityIds: [],
    },
    ...(state.filters === undefined ? {} : { filters: state.filters }),
  };
  return localPlan(
    workspace,
    freshFocusState,
    entityId,
    'Opened bounded Focus.',
    false,
  );
}

export function planLocalEntityNavigation(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
  entityId: EntityId,
): LocalNavigationPlan {
  const revealed = planEntityNavigation(workspace, state, entityId);
  if (!revealed.ok) throw new Error(revealed.message);
  return localPlan(
    workspace,
    revealed.state,
    entityId,
    `Stayed in Focus. ${revealed.announcement}`,
    true,
  );
}
