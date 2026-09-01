import type { EntityId } from '@icarus-graph-explorer/core';
import {
  deriveLocalProjectionState,
  projectLocalView,
  revealEntityInViewState,
  type ProjectionNodeId,
  type ProjectionWorkspace,
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
): LocalNavigationPlan {
  let localState = deriveLocalProjectionState(workspace, state, entityId);
  const target = workspace.requireEntity(entityId);
  if (target.kind !== 'document') {
    localState = revealEntityInViewState(workspace, localState, entityId);
  }
  const projection = projectLocalView(workspace, localState);
  const node = projection.nodes.find(
    (candidate) =>
      candidate.kind === 'entity' && candidate.entityId === entityId,
  );
  if (node === undefined) {
    throw new Error(
      `Local navigation could not project canonical target "${entityId}".`,
    );
  }
  const rootEntityId = localState.focus?.rootEntityId;
  if (rootEntityId === undefined) {
    throw new Error('Local navigation produced no document root.');
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
): LocalNavigationPlan {
  return localPlan(
    workspace,
    state,
    entityId,
    'Opened the bounded Local Free context.',
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
    `Stayed in Local. ${revealed.announcement}`,
  );
}
