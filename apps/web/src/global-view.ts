import {
  containingDocumentEntityId,
  documentOnlyProjectionState,
  type ProjectionWorkspace,
  type ReferenceResolutionStatus,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

export const DEFAULT_GLOBAL_REFERENCE_STATUSES = [
  'resolved',
] as const satisfies readonly ReferenceResolutionStatus[];

export { containingDocumentEntityId };

/**
 * Global consumes the same KG6 filter/focus intent but never mutates Structure
 * disclosure. A missing status filter means the conservative Global-only
 * resolved default; an explicit status list remains authoritative.
 */
export function effectiveGlobalProjectionState(
  workspace: ProjectionWorkspace,
  structureState: ViewProjectionState,
): ViewProjectionState {
  const base = documentOnlyProjectionState();
  const filters = structureState.filters;
  const referenceStatuses =
    filters?.referenceStatuses ?? DEFAULT_GLOBAL_REFERENCE_STATUSES;
  const focusDocumentId =
    structureState.focus === undefined
      ? undefined
      : containingDocumentEntityId(
          workspace,
          structureState.focus.rootEntityId,
        );
  return {
    disclosure: base.disclosure,
    ...(structureState.focus === undefined || focusDocumentId === undefined
      ? {}
      : {
          focus: {
            ...structureState.focus,
            rootEntityId: focusDocumentId,
          },
        }),
    filters: {
      ...(filters?.pathPrefixes === undefined
        ? {}
        : { pathPrefixes: filters.pathPrefixes }),
      ...(filters?.text === undefined ? {} : { text: filters.text }),
      ...(filters?.entityKinds === undefined
        ? {}
        : {
            entityKinds: filters.entityKinds.includes('document')
              ? (['document'] as const)
              : [],
          }),
      referenceStatuses,
    },
  };
}

export function withExplicitGlobalReferenceStatus(
  state: ViewProjectionState,
  status: ReferenceResolutionStatus,
  enabled: boolean,
): ViewProjectionState {
  const current = new Set(
    state.filters?.referenceStatuses ?? DEFAULT_GLOBAL_REFERENCE_STATUSES,
  );
  if (enabled) current.add(status);
  else current.delete(status);
  const order: readonly ReferenceResolutionStatus[] = [
    'resolved',
    'unresolved',
    'ambiguous',
    'invalid',
  ];
  const referenceStatuses = order.filter((candidate) => current.has(candidate));
  return {
    ...state,
    filters: {
      ...(state.filters ?? {}),
      referenceStatuses,
    },
  };
}
