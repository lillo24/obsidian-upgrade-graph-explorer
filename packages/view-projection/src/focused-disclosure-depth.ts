import type { EntityId } from '@icarus-graph-explorer/core';

import { calculateDisclosure } from './disclosure';
import {
  containingDocumentEntityId,
  projectFocusedDocumentNeighborhood,
} from './focused-documents';
import type {
  StructuralDepth,
  StructuralDisclosureState,
  ViewProjectionState,
} from './types';
import type { ProjectionWorkspace } from './workspace';

export interface FocusedDisclosureDepthPresentation {
  /** Deepest visible structural Heading generation, capped by the product UI. */
  readonly effectiveDepth: StructuralDepth;
  /** Whether the visible structure differs from this depth applied uniformly. */
  readonly custom: boolean;
}

function focusDepths(
  documentIds: ReadonlySet<EntityId>,
  depth: StructuralDepth,
): ReadonlyMap<EntityId, StructuralDepth> {
  return new Map([...documentIds].map((documentId) => [documentId, depth]));
}

function structuralGeneration(
  workspace: ProjectionWorkspace,
  entityId: EntityId,
): number {
  let generation = 0;
  let entity = workspace.entity(entityId);
  while (entity !== undefined && entity.kind !== 'document') {
    if (entity.kind === 'section') generation += 1;
    entity = workspace.parent(entity.id);
  }
  return generation;
}

function visibleFocusedSectionIds(
  workspace: ProjectionWorkspace,
  disclosure: StructuralDisclosureState,
  documentIds: ReadonlySet<EntityId>,
  automaticDepth: StructuralDepth,
  manualOverrides: boolean,
): ReadonlySet<EntityId> {
  const result = calculateDisclosure(
    workspace,
    {
      ...disclosure,
      defaultDepth: 0,
      expandedEntityIds: manualOverrides ? disclosure.expandedEntityIds : [],
      collapsedEntityIds: manualOverrides ? disclosure.collapsedEntityIds : [],
      // Explicit Heading Hide and Blocks are orthogonal to structural depth.
      hiddenEntityIds: [],
      includeBlocks: false,
    },
    { defaultDepthByDocumentId: focusDepths(documentIds, automaticDepth) },
  );
  return new Set(
    [...result.visibleEntityIds].filter((entityId) => {
      const entity = workspace.entity(entityId);
      return (
        entity?.kind === 'section' &&
        documentIds.has(
          containingDocumentEntityId(workspace, entityId) ?? entityId,
        )
      );
    }),
  );
}

function sameIds(
  left: ReadonlySet<EntityId>,
  right: ReadonlySet<EntityId>,
): boolean {
  return (
    left.size === right.size &&
    [...left].every((entityId) => right.has(entityId))
  );
}

/**
 * Derives the truthful Focus depth label without adding persisted state.
 * Hidden Headings do not influence this result; they remain a separate
 * visibility feature owned by the Focus Explorer Headings tab.
 */
export function describeFocusedDisclosureDepth(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
): FocusedDisclosureDepthPresentation {
  const neighborhood = projectFocusedDocumentNeighborhood(
    workspace,
    state,
    'focused disclosure depth',
  );
  const documentIds = new Set(neighborhood.documentDistance.keys());
  const actual = visibleFocusedSectionIds(
    workspace,
    state.disclosure,
    documentIds,
    state.disclosure.defaultDepth,
    true,
  );
  const deepestGeneration = [...actual].reduce(
    (maximum, entityId) =>
      Math.max(maximum, structuralGeneration(workspace, entityId)),
    0,
  );
  const effectiveDepth = Math.min(3, deepestGeneration) as StructuralDepth;
  const uniform = visibleFocusedSectionIds(
    workspace,
    state.disclosure,
    documentIds,
    effectiveDepth,
    false,
  );
  return {
    effectiveDepth,
    custom: !sameIds(actual, uniform),
  };
}
