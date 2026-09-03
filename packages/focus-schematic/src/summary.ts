import type { FocusSchematicModel, FocusSchematicModelSummary } from './types';

export function summarizeFocusSchematicModel(
  model: FocusSchematicModel,
): FocusSchematicModelSummary {
  const preciseReferenceIds = new Set(
    model.relationships.flatMap((relationship) =>
      relationship.visibleEndpointGroups.flatMap((group) => group.referenceIds),
    ),
  );
  const relationshipReferenceIds = new Set(
    model.relationships.flatMap(({ referenceIds }) => referenceIds),
  );
  const internalReferenceIds = new Set(
    model.internalReferences.flatMap(({ referenceIds }) => referenceIds),
  );
  const diagnosticReferenceIds = new Set(
    model.diagnostics.flatMap(({ referenceIds }) => referenceIds),
  );
  const selectedModules = new Set(
    model.parentCandidates
      .filter(({ selected }) => selected)
      .map(({ moduleId }) => moduleId),
  );
  const rootFolder = model.modules.find(
    ({ id }) => id === model.rootModuleId,
  )?.folderKey;
  const nonRoot = model.modules.filter(({ id }) => id !== model.rootModuleId);

  return {
    moduleCount: model.modules.length,
    visibleContentModuleCount: model.modules.filter(
      ({ presentation }) => presentation === 'visible-content',
    ).length,
    visibleContextModuleCount: model.modules.filter(
      ({ presentation }) => presentation === 'visible-context',
    ).length,
    filteredModuleCount: model.modules.filter(
      ({ presentation }) => presentation === 'filtered',
    ).length,
    folderCount: model.folders.length,
    rootFolderModuleCount: model.modules.filter(
      ({ folderKey }) => folderKey === rootFolder,
    ).length,
    visibleEntityNodeCount: model.modules.reduce(
      (sum, module) => sum + module.visibleEntityNodeIds.length,
      0,
    ),
    visibleHierarchyEdgeCount: model.modules.reduce(
      (sum, module) => sum + module.hierarchyEdgeIds.length,
      0,
    ),
    crossModuleRelationshipCount: model.relationships.length,
    internalReferenceCount: internalReferenceIds.size,
    canonicalReferenceCount: new Set([
      ...relationshipReferenceIds,
      ...internalReferenceIds,
      ...diagnosticReferenceIds,
    ]).size,
    incomingOnlyModuleCount: nonRoot.filter(
      ({ placement }) => placement.reason === 'incoming-only',
    ).length,
    outgoingOnlyModuleCount: nonRoot.filter(
      ({ placement }) => placement.reason === 'outgoing-only',
    ).length,
    unequalMutualModuleCount: nonRoot.filter(
      ({ placement }) =>
        placement.reason === 'shorter-incoming' ||
        placement.reason === 'shorter-outgoing',
    ).length,
    equalMutualModuleCount: nonRoot.filter(
      ({ placement }) => placement.reason === 'equal-mutual',
    ).length,
    focusPathRelationshipCount: model.relationships.filter(
      ({ secondary }) => !secondary,
    ).length,
    secondaryRelationshipCount: model.relationships.filter(
      ({ secondary }) => secondary,
    ).length,
    selectedBackboneCount: model.parentCandidates.filter(
      ({ selected }) => selected,
    ).length,
    unresolvedBackboneModuleCount: nonRoot.filter(
      (module) =>
        module.placement.reason !== 'equal-mutual' &&
        !selectedModules.has(module.id),
    ).length,
    preciseEndpointReferenceCount: preciseReferenceIds.size,
    documentOnlyEndpointReferenceCount: [...relationshipReferenceIds].filter(
      (id) => !preciseReferenceIds.has(id),
    ).length,
    filteredPathIntermediateCount: model.issues.filter(
      ({ code }) => code === 'filtered-path-intermediate',
    ).length,
    diagnosticCount: model.diagnostics.length,
    unresolvedDiagnosticCount: model.diagnostics.filter(
      ({ status }) => status === 'unresolved',
    ).length,
    ambiguousDiagnosticCount: model.diagnostics.filter(
      ({ status }) => status === 'ambiguous',
    ).length,
    invalidDiagnosticCount: model.diagnostics.filter(
      ({ status }) => status === 'invalid',
    ).length,
    externalAmbiguousCandidateCount: model.diagnostics.reduce(
      (count, diagnostic) =>
        count +
        diagnostic.candidateDocumentEntityIds.filter(
          (id) => !diagnostic.candidateVisibleModuleIds.includes(id),
        ).length,
      0,
    ),
  };
}
