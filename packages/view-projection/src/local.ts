import type { EntityId } from '@icarus-graph-explorer/core';

import { containingDocumentEntityId } from './focused-documents';
import { projectFocusedDetailView } from './focused-detail';
import type { ViewProjection, ViewProjectionState } from './types';
import type { ProjectionWorkspace } from './workspace';

export { containingDocumentEntityId } from './focused-documents';

/**
 * Creates the source-neutral KG6 state used by Focus presentations. It only
 * normalizes the stable document root; entry policy owns fresh depth and
 * disclosure overrides so rerooting can preserve intentional state.
 */
export function deriveLocalProjectionState(
  workspace: ProjectionWorkspace,
  source: ViewProjectionState,
  targetEntityId: EntityId,
): ViewProjectionState {
  const rootEntityId = containingDocumentEntityId(workspace, targetEntityId);
  if (rootEntityId === undefined) {
    throw new Error(
      `Cannot enter Focus: entity "${targetEntityId}" has no containing document.`,
    );
  }
  return {
    disclosure: source.disclosure,
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
 * Projects a bounded Focus graph in two KG6 passes. The first pass establishes
 * the document neighborhood from rolled-up references. The second applies
 * normal disclosure, filters, diagnostics, and exact provenance only inside
 * those documents. This prevents revealing headings from changing which
 * documents are reachable.
 */
export function projectLocalView(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
): ViewProjection {
  return projectFocusedDetailView(workspace, state, 'Focus');
}
