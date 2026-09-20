import type { EntityId } from '@icarus-graph-explorer/core';

import type { FocusOutlineModel, FocusOutlineRow } from './focus-outline-model';

interface FocusExplorerDocumentHeadingDisclosure {
  readonly collapsedHeadingIds: ReadonlySet<EntityId>;
  readonly knownParentHeadingIds: ReadonlySet<EntityId>;
  readonly previousVisibleHeadingIds: ReadonlySet<EntityId>;
}

/** Session-only Focus Explorer disclosure; it is intentionally not graph state. */
export interface FocusExplorerHeadingDisclosureState {
  readonly documents: ReadonlyMap<
    EntityId,
    FocusExplorerDocumentHeadingDisclosure
  >;
}

export const EMPTY_FOCUS_EXPLORER_HEADING_DISCLOSURE: FocusExplorerHeadingDisclosureState =
  { documents: new Map() };

const EMPTY_ENTITY_IDS: ReadonlySet<EntityId> = new Set();

function sameIds(
  left: ReadonlySet<EntityId>,
  right: ReadonlySet<EntityId>,
): boolean {
  if (left.size !== right.size) return false;
  for (const id of left) if (!right.has(id)) return false;
  return true;
}

function rowById(
  model: FocusOutlineModel,
): ReadonlyMap<EntityId, FocusOutlineRow> {
  return new Map(model.rows.map((row) => [row.entityId, row]));
}

function addAncestorHeadingIds(
  ids: Set<EntityId>,
  row: FocusOutlineRow,
  rows: ReadonlyMap<EntityId, FocusOutlineRow>,
): void {
  let parentId = row.parentEntityId;
  while (parentId !== undefined) {
    ids.add(parentId);
    parentId = rows.get(parentId)?.parentEntityId;
  }
}

/**
 * Applies the directional graph → Explorer rule. The first model opens paths to
 * graph-visible descendants; later models open paths only for newly visible
 * Headings, so an unrelated render cannot undo a manual Explorer collapse.
 */
export function synchronizeFocusExplorerHeadingDisclosure(
  state: FocusExplorerHeadingDisclosureState,
  model: FocusOutlineModel,
): FocusExplorerHeadingDisclosureState {
  const current = state.documents.get(model.documentEntityId);
  const rows = rowById(model);
  const parentHeadingIds = new Set(
    model.rows.filter((row) => row.hasChildHeadings).map((row) => row.entityId),
  );
  const visibleHeadingIds = new Set(
    model.rows
      .filter((row) => row.status === 'visible')
      .map((row) => row.entityId),
  );
  const requiredOpenHeadingIds = new Set<EntityId>();

  if (current === undefined) {
    for (const visibleId of visibleHeadingIds) {
      const row = rows.get(visibleId);
      if (row !== undefined)
        addAncestorHeadingIds(requiredOpenHeadingIds, row, rows);
    }
  } else {
    for (const visibleId of visibleHeadingIds) {
      if (current.previousVisibleHeadingIds.has(visibleId)) continue;
      const row = rows.get(visibleId);
      if (row !== undefined)
        addAncestorHeadingIds(requiredOpenHeadingIds, row, rows);
    }
  }

  const collapsedHeadingIds = new Set<EntityId>();
  for (const parentId of parentHeadingIds) {
    const wasCollapsed = current?.collapsedHeadingIds.has(parentId) ?? true;
    const newlyCanonical =
      current !== undefined && !current.knownParentHeadingIds.has(parentId);
    if (
      (wasCollapsed || newlyCanonical) &&
      !requiredOpenHeadingIds.has(parentId)
    )
      collapsedHeadingIds.add(parentId);
  }

  if (
    current !== undefined &&
    sameIds(current.collapsedHeadingIds, collapsedHeadingIds) &&
    sameIds(current.knownParentHeadingIds, parentHeadingIds) &&
    sameIds(current.previousVisibleHeadingIds, visibleHeadingIds)
  ) {
    return state;
  }

  const documents = new Map(state.documents);
  documents.set(model.documentEntityId, {
    collapsedHeadingIds,
    knownParentHeadingIds: parentHeadingIds,
    previousVisibleHeadingIds: visibleHeadingIds,
  });
  return { documents };
}

export function focusExplorerCollapsedHeadingIds(
  state: FocusExplorerHeadingDisclosureState,
  documentEntityId: EntityId,
): ReadonlySet<EntityId> {
  return (
    state.documents.get(documentEntityId)?.collapsedHeadingIds ??
    EMPTY_ENTITY_IDS
  );
}

export function toggleFocusExplorerHeadingDisclosure(
  state: FocusExplorerHeadingDisclosureState,
  documentEntityId: EntityId,
  headingEntityId: EntityId,
): FocusExplorerHeadingDisclosureState {
  const current = state.documents.get(documentEntityId);
  if (
    current === undefined ||
    !current.knownParentHeadingIds.has(headingEntityId)
  ) {
    return state;
  }
  const collapsedHeadingIds = new Set(current.collapsedHeadingIds);
  if (collapsedHeadingIds.has(headingEntityId))
    collapsedHeadingIds.delete(headingEntityId);
  else collapsedHeadingIds.add(headingEntityId);
  const documents = new Map(state.documents);
  documents.set(documentEntityId, { ...current, collapsedHeadingIds });
  return { documents };
}

/** Filters the flat canonical source-order outline through local UI disclosure. */
export function focusExplorerVisibleHeadingRows(
  model: FocusOutlineModel,
  collapsedHeadingIds: ReadonlySet<EntityId>,
): readonly FocusOutlineRow[] {
  const rows = rowById(model);
  return model.rows.filter((row) => {
    let parentId = row.parentEntityId;
    while (parentId !== undefined) {
      if (collapsedHeadingIds.has(parentId)) return false;
      parentId = rows.get(parentId)?.parentEntityId;
    }
    return true;
  });
}
