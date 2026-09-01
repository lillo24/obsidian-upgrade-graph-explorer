import type { EntityId } from '@icarus-graph-explorer/core';

import {
  containingDocumentEntityId,
  projectFocusedDocumentNeighborhood,
  retainProjectionInsideFocusedDocuments,
} from './focused-documents';
import { projectView } from './project';
import type { ViewProjection, ViewProjectionState } from './types';
import type { ProjectionWorkspace } from './workspace';

export { containingDocumentEntityId } from './focused-documents';

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Creates the source-neutral KG6 state used by Local presentations. Local
 * always starts from a document root, reveals that document's direct
 * structure, and leaves neighboring documents collapsed unless disclosure
 * already expands them explicitly.
 */
export function deriveLocalProjectionState(
  workspace: ProjectionWorkspace,
  source: ViewProjectionState,
  targetEntityId: EntityId,
): ViewProjectionState {
  const rootEntityId = containingDocumentEntityId(workspace, targetEntityId);
  if (rootEntityId === undefined) {
    throw new Error(
      `Cannot enter Local: entity "${targetEntityId}" has no containing document.`,
    );
  }
  const expanded = new Set(source.disclosure.expandedEntityIds);
  expanded.add(rootEntityId);
  const collapsed = new Set(source.disclosure.collapsedEntityIds);
  collapsed.delete(rootEntityId);
  return {
    disclosure: {
      ...source.disclosure,
      // Automatic depth is intentionally disabled here. The root's explicit
      // expansion supplies its top-level headings without expanding every
      // document in the bounded reference neighborhood.
      defaultDepth: 0,
      expandedEntityIds: [...expanded].sort(compareText),
      collapsedEntityIds: [...collapsed].sort(compareText),
    },
    focus: {
      rootEntityId,
      hops: source.focus?.hops ?? 1,
      direction: source.focus?.direction ?? 'both',
      hierarchyContext: 'ancestors-and-children',
    },
    ...(source.filters === undefined ? {} : { filters: source.filters }),
  };
}

/**
 * Projects a bounded Local graph in two KG6 passes. The first pass establishes
 * the document neighborhood from rolled-up references. The second applies
 * normal disclosure, filters, diagnostics, and exact provenance only inside
 * those documents. This prevents revealing headings from changing which
 * documents are reachable.
 */
export function projectLocalView(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
): ViewProjection {
  const neighborhood = projectFocusedDocumentNeighborhood(
    workspace,
    state,
    'Local',
  );
  const detailed = projectView(workspace, {
    disclosure: state.disclosure,
    ...(state.filters === undefined ? {} : { filters: state.filters }),
  });
  return retainProjectionInsideFocusedDocuments(
    workspace,
    detailed,
    neighborhood,
    'Local',
  );
}
