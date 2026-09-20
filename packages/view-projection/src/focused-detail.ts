import type { EntityId } from '@icarus-graph-explorer/core';

import {
  projectFocusedDocumentNeighborhood,
  retainProjectionInsideFocusedDocuments,
} from './focused-documents';
import { projectViewWithDisclosurePolicy } from './project';
import type {
  StructuralDepth,
  ViewProjection,
  ViewProjectionState,
} from './types';
import type { ProjectionWorkspace } from './workspace';

function detailDepths(
  documentIds: ReadonlySet<EntityId>,
  depth: StructuralDepth,
): ReadonlyMap<EntityId, StructuralDepth> {
  return new Map([...documentIds].map((documentId) => [documentId, depth]));
}

/**
 * Projects the renderer-neutral Focus detail shared by Network and Hierarchy.
 * The document neighborhood is fixed before disclosure is applied, and the
 * selected automatic depth is shared by every document in that neighborhood.
 */
export function projectFocusedDetailView(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
  owner: string,
): ViewProjection {
  const neighborhood = projectFocusedDocumentNeighborhood(
    workspace,
    state,
    owner,
  );
  const detailed = projectViewWithDisclosurePolicy(
    workspace,
    {
      disclosure: {
        ...state.disclosure,
        defaultDepth: 0,
      },
      ...(state.filters === undefined ? {} : { filters: state.filters }),
    },
    {
      defaultDepthByDocumentId: detailDepths(
        new Set(neighborhood.documentDistance.keys()),
        state.disclosure.defaultDepth,
      ),
    },
  );
  return retainProjectionInsideFocusedDocuments(
    workspace,
    detailed,
    neighborhood,
    owner,
  );
}
