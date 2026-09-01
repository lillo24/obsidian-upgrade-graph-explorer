import type { EntityId } from '@icarus-graph-explorer/core';

import {
  projectFocusedDocumentNeighborhood,
  retainProjectionInsideFocusedDocuments,
} from './focused-documents';
import { projectView, projectViewWithDisclosurePolicy } from './project';
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
 * Projects ordinary Structure unchanged, but gives active Focus a stable
 * documents-first neighborhood and root-scoped automatic structural depth.
 */
export function projectStructureView(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
): ViewProjection {
  if (state.focus === undefined) return projectView(workspace, state);

  const neighborhood = projectFocusedDocumentNeighborhood(
    workspace,
    state,
    'Structure Focus',
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
      // The Set-based seam keeps today's single root isolated from a future
      // multi-focus model without changing the persisted KG6 Focus schema.
      defaultDepthByDocumentId: detailDepths(
        new Set([neighborhood.rootDocumentId]),
        state.disclosure.defaultDepth,
      ),
    },
  );
  return retainProjectionInsideFocusedDocuments(
    workspace,
    detailed,
    neighborhood,
    'Structure Focus',
  );
}
