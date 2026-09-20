import type { EntityId } from '@icarus-graph-explorer/core';
import type {
  ProjectionWorkspace,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

export type FocusOutlineRowStatus =
  'visible' | 'hidden' | 'hidden-by-ancestor' | 'not-disclosed';

export interface FocusOutlineRow {
  readonly entityId: EntityId;
  readonly title: string;
  readonly depth: number;
  readonly headingLevel: number;
  readonly status: FocusOutlineRowStatus;
  readonly explicitlyHidden: boolean;
}

export interface FocusOutlineModel {
  readonly documentEntityId: EntityId;
  readonly sourcePath: string;
  readonly rows: readonly FocusOutlineRow[];
  readonly hiddenEntityIds: readonly EntityId[];
}

function containingDocumentId(
  workspace: ProjectionWorkspace,
  entityId: EntityId,
): EntityId | undefined {
  let entity = workspace.entity(entityId);
  while (entity !== undefined && entity.kind !== 'document') {
    entity = workspace.parent(entity.id);
  }
  return entity?.id;
}

export function structuralSubtreeContains(
  workspace: ProjectionWorkspace,
  ancestorEntityId: EntityId,
  entityId: EntityId,
): boolean {
  let current = workspace.entity(entityId);
  while (current !== undefined) {
    if (current.id === ancestorEntityId) return true;
    current = workspace.parent(current.id);
  }
  return false;
}

/** Builds the complete canonical Heading outline, independent of projection. */
export function createFocusOutlineModel(
  workspace: ProjectionWorkspace,
  focusRootEntityId: EntityId,
  projection: ViewProjection,
  hiddenEntityIds: readonly EntityId[],
): FocusOutlineModel | undefined {
  const documentEntityId = containingDocumentId(workspace, focusRootEntityId);
  if (documentEntityId === undefined) return undefined;
  const document = workspace.requireEntity(documentEntityId);
  if (document.kind !== 'document') return undefined;

  const visible = new Set(
    projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [node.entityId] : [],
    ),
  );
  const explicitlyHidden = new Set(hiddenEntityIds);
  const rows: FocusOutlineRow[] = [];
  const visit = (
    parentId: EntityId,
    depth: number,
    ancestorHidden: boolean,
  ): void => {
    for (const child of workspace.children(parentId)) {
      if (child.kind !== 'section') continue;
      const hidden = explicitlyHidden.has(child.id);
      const status: FocusOutlineRowStatus = ancestorHidden
        ? 'hidden-by-ancestor'
        : hidden
          ? 'hidden'
          : visible.has(child.id)
            ? 'visible'
            : 'not-disclosed';
      rows.push({
        entityId: child.id,
        title:
          child.title.trim().length === 0
            ? `Untitled Heading at line ${child.source.span.start.line}`
            : child.title,
        depth,
        headingLevel: child.level,
        status,
        explicitlyHidden: hidden,
      });
      visit(child.id, depth + 1, ancestorHidden || hidden);
    }
  };
  visit(documentEntityId, 1, false);
  const documentHeadingIds = new Set(rows.map((row) => row.entityId));
  return {
    documentEntityId,
    sourcePath: document.source.path,
    rows,
    hiddenEntityIds: [...explicitlyHidden]
      .filter((entityId) => documentHeadingIds.has(entityId))
      .sort((left, right) => left.localeCompare(right)),
  };
}
