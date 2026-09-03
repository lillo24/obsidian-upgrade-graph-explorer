import {
  workspaceFolderKeyFromPath,
  type EntityId,
  type Reference,
  type ReferenceId,
} from '@icarus-graph-explorer/core';
import {
  containingDocumentEntityId,
  describeFocusedDocumentNeighborhood,
  validateViewProjection,
  type FocusedDocumentNeighborhoodDescription,
  type ProjectedEntityNode,
  type ProjectedReferenceEdge,
  type ProjectionWorkspace,
  type ViewProjection,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import {
  FOCUS_SCHEMATIC_MODEL_SCHEMA_VERSION,
  type FocusSchematicDiagnostic,
  type FocusSchematicDistance,
  type FocusSchematicEndpointGroup,
  type FocusSchematicFolder,
  type FocusSchematicInternalReference,
  type FocusSchematicIssue,
  type FocusSchematicModel,
  type FocusSchematicModelValidationResult,
  type FocusSchematicModule,
  type FocusSchematicParentCandidate,
  type FocusSchematicPlacement,
  type FocusSchematicRelationship,
} from './types';

interface CreateFocusSchematicModelInput {
  readonly workspace: ProjectionWorkspace;
  readonly state: ViewProjectionState;
  readonly projection: ViewProjection;
  readonly neighborhood?: FocusedDocumentNeighborhoodDescription;
}

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort(compareText);
const pairKey = (source: string, target: string): string =>
  JSON.stringify([source, target]);
const relationshipId = (source: string, target: string): string =>
  `relationship:${JSON.stringify([source, target])}`;

function asDistance(value: number | undefined): FocusSchematicDistance | null {
  return value === 0 || value === 1 || value === 2 || value === 3
    ? value
    : null;
}

function bfs(
  root: EntityId,
  adjacency: ReadonlyMap<EntityId, readonly EntityId[]>,
  hops: number,
): ReadonlyMap<EntityId, FocusSchematicDistance> {
  const result = new Map<EntityId, FocusSchematicDistance>([[root, 0]]);
  const queue: EntityId[] = [root];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) continue;
    const distance = result.get(current);
    if (distance === undefined || distance >= hops) continue;
    for (const next of adjacency.get(current) ?? []) {
      if (result.has(next)) continue;
      result.set(next, (distance + 1) as FocusSchematicDistance);
      queue.push(next);
    }
  }
  return result;
}

function placementFor(
  incoming: FocusSchematicDistance | null,
  outgoing: FocusSchematicDistance | null,
): FocusSchematicPlacement {
  if (incoming === 0 && outgoing === 0) {
    return {
      allowedSides: ['center'],
      preferredSide: 'center',
      rankMagnitude: 0,
      preferredSignedRank: 0,
      reason: 'root',
    };
  }
  if (incoming !== null && outgoing === null) {
    return {
      allowedSides: ['left'],
      preferredSide: 'left',
      rankMagnitude: incoming,
      preferredSignedRank: -incoming as -3 | -2 | -1,
      reason: 'incoming-only',
    };
  }
  if (outgoing !== null && incoming === null) {
    return {
      allowedSides: ['right'],
      preferredSide: 'right',
      rankMagnitude: outgoing,
      preferredSignedRank: outgoing,
      reason: 'outgoing-only',
    };
  }
  if (incoming === null || outgoing === null) {
    throw new Error(
      'A non-root Focus module has no directed path to or from the root.',
    );
  }
  if (incoming < outgoing) {
    return {
      allowedSides: ['left'],
      preferredSide: 'left',
      rankMagnitude: incoming,
      preferredSignedRank: -incoming as -3 | -2 | -1,
      reason: 'shorter-incoming',
    };
  }
  if (outgoing < incoming) {
    return {
      allowedSides: ['right'],
      preferredSide: 'right',
      rankMagnitude: outgoing,
      preferredSignedRank: outgoing,
      reason: 'shorter-outgoing',
    };
  }
  return {
    allowedSides: ['left', 'right'],
    preferredSide: null,
    rankMagnitude: incoming,
    preferredSignedRank: null,
    reason: 'equal-mutual',
  };
}

function parentFolder(key: string): string | null {
  if (key === '.') return null;
  const separator = key.lastIndexOf('/');
  return separator === -1 ? '.' : key.slice(0, separator);
}

function endpointGroup(
  workspace: ProjectionWorkspace,
  edge: ProjectedReferenceEdge,
  nodes: ReadonlyMap<string, ProjectedEntityNode>,
): FocusSchematicEndpointGroup | undefined {
  const source = nodes.get(edge.sourceNodeId);
  const target = nodes.get(edge.targetNodeId);
  if (
    source === undefined ||
    target === undefined ||
    edge.status !== 'resolved'
  ) {
    return undefined;
  }
  return {
    projectedEdgeId: edge.id,
    sourceProjectionNodeId: edge.sourceNodeId,
    targetProjectionNodeId: edge.targetNodeId,
    referenceIds: sortedUnique(edge.referenceIds),
    sourcePrecision: workspace.requireEntity(source.entityId).kind,
    targetPrecision: workspace.requireEntity(target.entityId).kind,
  };
}

function canonicalReferenceDocuments(
  workspace: ProjectionWorkspace,
  reference: Reference,
): readonly [EntityId, EntityId] | undefined {
  if (reference.resolution.status !== 'resolved') return undefined;
  const source = containingDocumentEntityId(
    workspace,
    reference.sourceEntityId,
  );
  const target = containingDocumentEntityId(
    workspace,
    reference.resolution.targetEntityId,
  );
  return source === undefined || target === undefined
    ? undefined
    : [source, target];
}

function addAdjacency(
  map: Map<EntityId, EntityId[]>,
  source: EntityId,
  target: EntityId,
): void {
  const values = map.get(source) ?? [];
  if (!values.includes(target)) values.push(target);
  values.sort(compareText);
  map.set(source, values);
}

function assertNeighborhood(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
  supplied: FocusedDocumentNeighborhoodDescription | undefined,
): FocusedDocumentNeighborhoodDescription {
  if (supplied === undefined)
    return describeFocusedDocumentNeighborhood(workspace, state);
  const focus = state.focus;
  const root =
    focus === undefined
      ? undefined
      : containingDocumentEntityId(workspace, focus.rootEntityId);
  const validation = validateViewProjection(
    workspace,
    supplied.documentProjection,
  );
  const describedDistances = supplied.documentProjection.nodes
    .flatMap((node) =>
      node.kind === 'entity' && node.entityKind === 'document'
        ? [
            {
              documentEntityId: node.entityId,
              distance: node.focusDistance ?? 0,
            },
          ]
        : [],
    )
    .sort((left, right) =>
      compareText(left.documentEntityId, right.documentEntityId),
    );
  const describedDiagnostics = sortedUnique(
    supplied.documentProjection.nodes.flatMap((node) =>
      node.kind === 'reference-target' ? node.referenceIds : [],
    ),
  );
  if (
    focus === undefined ||
    root !== supplied.rootDocumentEntityId ||
    focus.direction !== supplied.focus.direction ||
    focus.hops !== supplied.focus.hops ||
    !validation.valid ||
    JSON.stringify(describedDistances) !==
      JSON.stringify(supplied.documentDistances) ||
    JSON.stringify(describedDiagnostics) !==
      JSON.stringify(supplied.allowedDiagnosticReferenceIds) ||
    JSON.stringify(supplied.documentProjection.issues) !==
      JSON.stringify(supplied.issues)
  ) {
    throw new Error(
      'Prepared Focus document neighborhood contradicts the current workspace or view state.',
    );
  }
  return supplied;
}

function buildModel({
  workspace,
  state,
  projection: inputProjection,
  neighborhood: suppliedNeighborhood,
}: CreateFocusSchematicModelInput): FocusSchematicModel {
  if (state.focus === undefined) {
    throw new Error('Cannot create a Focus Schematic model without KG6 Focus.');
  }
  // Projection validation requires canonical ordering. Normalize caller-owned
  // arrays first so semantic output is independent of input iteration order.
  const projection: ViewProjection = {
    nodes: [...inputProjection.nodes].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    edges: [...inputProjection.edges].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    issues: [...inputProjection.issues].sort(
      (left, right) =>
        compareText(left.code, right.code) ||
        compareText(left.subject, right.subject) ||
        compareText(left.message, right.message),
    ),
  };
  const projectionValidation = validateViewProjection(workspace, projection);
  if (!projectionValidation.valid) {
    const first = projectionValidation.issues[0];
    throw new Error(
      `Cannot create a Focus Schematic model from an invalid projection${first === undefined ? '.' : `: ${first.path} ${first.message}`}`,
    );
  }
  const neighborhood = assertNeighborhood(
    workspace,
    state,
    suppliedNeighborhood,
  );
  const moduleIds = new Set(
    neighborhood.documentDistances.map(
      ({ documentEntityId }) => documentEntityId,
    ),
  );
  const sourceOrder = new Map(
    workspace.entities().map((entity, index) => [entity.id, index]),
  );
  const visibleEntityNodes = projection.nodes
    .filter((node): node is ProjectedEntityNode => node.kind === 'entity')
    .sort(
      (left, right) =>
        (sourceOrder.get(left.entityId) ?? Number.MAX_SAFE_INTEGER) -
          (sourceOrder.get(right.entityId) ?? Number.MAX_SAFE_INTEGER) ||
        compareText(left.id, right.id),
    );
  const entityNodeById = new Map(
    visibleEntityNodes.map((node) => [node.id, node]),
  );
  const documentByNode = new Map<string, EntityId>();
  const nodesByDocument = new Map<EntityId, ProjectedEntityNode[]>();
  for (const node of visibleEntityNodes) {
    const documentId = containingDocumentEntityId(workspace, node.entityId);
    if (documentId === undefined || !moduleIds.has(documentId)) {
      throw new Error(
        `Projected entity node "${node.id}" is outside the Focus neighborhood.`,
      );
    }
    if (node.sourcePath !== workspace.requireEntity(documentId).source.path) {
      throw new Error(
        `Projected entity node "${node.id}" has a mismatched source path.`,
      );
    }
    documentByNode.set(node.id, documentId);
    const nodes = nodesByDocument.get(documentId) ?? [];
    nodes.push(node);
    nodesByDocument.set(documentId, nodes);
  }

  const hierarchyByDocument = new Map<EntityId, string[]>();
  for (const edge of projection.edges) {
    if (edge.kind !== 'hierarchy') continue;
    const sourceDocument = documentByNode.get(edge.sourceNodeId);
    const targetDocument = documentByNode.get(edge.targetNodeId);
    if (sourceDocument === undefined || sourceDocument !== targetDocument) {
      throw new Error(`Hierarchy edge "${edge.id}" crosses File modules.`);
    }
    const edges = hierarchyByDocument.get(sourceDocument) ?? [];
    edges.push(edge.id);
    hierarchyByDocument.set(sourceDocument, edges);
  }

  const relationshipReferences = new Map<string, Set<ReferenceId>>();
  const relationshipDocumentEdges = new Map<string, Set<string>>();
  for (const edge of neighborhood.documentProjection.edges) {
    if (edge.kind !== 'reference' || edge.status !== 'resolved') continue;
    for (const referenceId of edge.referenceIds) {
      const reference = workspace.reference(referenceId);
      if (reference === undefined)
        throw new Error(`Missing reference "${referenceId}".`);
      const documents = canonicalReferenceDocuments(workspace, reference);
      if (documents === undefined || documents[0] === documents[1]) continue;
      const key = pairKey(documents[0], documents[1]);
      const references = relationshipReferences.get(key) ?? new Set();
      references.add(referenceId);
      relationshipReferences.set(key, references);
      const edgeIds = relationshipDocumentEdges.get(key) ?? new Set();
      edgeIds.add(edge.id);
      relationshipDocumentEdges.set(key, edgeIds);
    }
  }

  const visibleGroupsByPair = new Map<string, FocusSchematicEndpointGroup[]>();
  const internalVisibleByDocument = new Map<
    EntityId,
    FocusSchematicEndpointGroup[]
  >();
  for (const edge of projection.edges) {
    if (edge.kind !== 'reference') continue;
    const group = endpointGroup(workspace, edge, entityNodeById);
    if (group === undefined) continue;
    const sourceDocument = documentByNode.get(edge.sourceNodeId);
    const targetDocument = documentByNode.get(edge.targetNodeId);
    if (sourceDocument === undefined || targetDocument === undefined) continue;
    const target =
      sourceDocument === targetDocument
        ? internalVisibleByDocument
        : visibleGroupsByPair;
    const key =
      sourceDocument === targetDocument
        ? sourceDocument
        : pairKey(sourceDocument, targetDocument);
    const groups = target.get(key) ?? [];
    groups.push(group);
    target.set(key, groups);
  }

  const internalReferences: FocusSchematicInternalReference[] = [];
  const internalIdsByDocument = new Map<EntityId, string[]>();
  const canonicalInternalByDocument = new Map<EntityId, ReferenceId[]>();
  for (const reference of workspace.references()) {
    const documents = canonicalReferenceDocuments(workspace, reference);
    if (
      documents !== undefined &&
      documents[0] === documents[1] &&
      moduleIds.has(documents[0])
    ) {
      const ids = canonicalInternalByDocument.get(documents[0]) ?? [];
      ids.push(reference.id);
      canonicalInternalByDocument.set(documents[0], ids);
    }
  }
  for (const documentId of moduleIds) {
    const referenceIds = new Set<ReferenceId>(
      canonicalInternalByDocument.get(documentId) ?? [],
    );
    const collapsedOwnerNodeIds: string[] = [];
    for (const node of nodesByDocument.get(documentId) ?? []) {
      if (node.internalReferenceIds.length > 0)
        collapsedOwnerNodeIds.push(node.id);
      for (const id of node.internalReferenceIds) referenceIds.add(id);
    }
    if (referenceIds.size === 0) continue;
    const id = `internal:${JSON.stringify(documentId)}`;
    internalReferences.push({
      id,
      moduleId: documentId,
      referenceIds: sortedUnique(referenceIds),
      visibleEndpointGroups: [
        ...(internalVisibleByDocument.get(documentId) ?? []),
      ].sort((left, right) =>
        compareText(left.projectedEdgeId, right.projectedEdgeId),
      ),
      collapsedOwnerNodeIds: sortedUnique(collapsedOwnerNodeIds),
    });
    internalIdsByDocument.set(documentId, [id]);
  }

  const diagnostics: FocusSchematicDiagnostic[] = [];
  const diagnosticIdsByDocument = new Map<EntityId, string[]>();
  const incomingDiagnosticEdges = new Map<string, ProjectedReferenceEdge[]>();
  for (const edge of projection.edges) {
    if (edge.kind !== 'reference' || entityNodeById.has(edge.targetNodeId))
      continue;
    const edges = incomingDiagnosticEdges.get(edge.targetNodeId) ?? [];
    edges.push(edge);
    incomingDiagnosticEdges.set(edge.targetNodeId, edges);
  }
  for (const node of projection.nodes) {
    if (node.kind !== 'reference-target') continue;
    const incoming = incomingDiagnosticEdges.get(node.id) ?? [];
    const ownerIds = new Set(
      incoming.flatMap((edge) => {
        const owner = documentByNode.get(edge.sourceNodeId);
        return owner === undefined ? [] : [owner];
      }),
    );
    if (ownerIds.size !== 1) {
      throw new Error(
        `Diagnostic "${node.id}" must have sources in exactly one File module.`,
      );
    }
    const ownerModuleId = [...ownerIds][0];
    if (ownerModuleId === undefined)
      throw new Error(`Diagnostic "${node.id}" has no owner.`);
    const candidateDocumentEntityIds = sortedUnique(
      node.candidateEntityIds.flatMap((id) => {
        const documentId = containingDocumentEntityId(workspace, id);
        return documentId === undefined ? [] : [documentId];
      }),
    );
    diagnostics.push({
      id: node.id,
      ownerModuleId,
      status: node.status,
      rawTarget: node.rawTarget,
      reasons: sortedUnique(node.reasons),
      referenceIds: sortedUnique(node.referenceIds),
      sourceProjectionNodeIds: sortedUnique(
        incoming.map((edge) => edge.sourceNodeId),
      ),
      candidateDocumentEntityIds,
      candidateVisibleModuleIds: candidateDocumentEntityIds.filter((id) =>
        moduleIds.has(id),
      ),
    });
    const ids = diagnosticIdsByDocument.get(ownerModuleId) ?? [];
    ids.push(node.id);
    diagnosticIdsByDocument.set(ownerModuleId, ids);
  }

  const relationshipPairs = [...relationshipReferences.keys()].sort(
    compareText,
  );
  const forward = new Map<EntityId, EntityId[]>();
  const reverse = new Map<EntityId, EntityId[]>();
  for (const key of relationshipPairs) {
    const [source, target] = JSON.parse(key) as [EntityId, EntityId];
    addAdjacency(forward, source, target);
    addAdjacency(reverse, target, source);
  }
  const outgoingDistances = bfs(
    neighborhood.rootDocumentEntityId,
    forward,
    state.focus.hops,
  );
  const incomingDistances = bfs(
    neighborhood.rootDocumentEntityId,
    reverse,
    state.focus.hops,
  );
  const neighborhoodDistances = new Map(
    neighborhood.documentDistances.map(({ documentEntityId, distance }) => [
      documentEntityId,
      distance,
    ]),
  );

  const provisionalModules: FocusSchematicModule[] = [...moduleIds]
    .map((documentId) => {
      const nodes = nodesByDocument.get(documentId) ?? [];
      const incomingDistance = asDistance(incomingDistances.get(documentId));
      const outgoingDistance = asDistance(outgoingDistances.get(documentId));
      const expectedFocusDistance =
        state.focus?.direction === 'incoming'
          ? incomingDistance
          : state.focus?.direction === 'outgoing'
            ? outgoingDistance
            : incomingDistance === null
              ? outgoingDistance
              : outgoingDistance === null
                ? incomingDistance
                : Math.min(incomingDistance, outgoingDistance);
      const focusDistance = asDistance(neighborhoodDistances.get(documentId));
      if (focusDistance === null || expectedFocusDistance !== focusDistance) {
        throw new Error(
          `Module "${documentId}" has contradictory KG6 and directed distances.`,
        );
      }
      const documentNode = nodes.find((node) => node.entityKind === 'document');
      const presentation: FocusSchematicModule['presentation'] = nodes.some(
        (node) => node.role === 'content',
      )
        ? 'visible-content'
        : nodes.length > 0
          ? 'visible-context'
          : 'filtered';
      const document = workspace.requireEntity(documentId);
      if (document.kind !== 'document')
        throw new Error(`Module "${documentId}" is not a document.`);
      return {
        id: documentId,
        documentEntityId: documentId,
        sourcePath: document.source.path,
        folderKey: workspaceFolderKeyFromPath(document.source.path),
        presentation,
        documentProjectionNodeId: documentNode?.id ?? null,
        visibleEntityNodeIds: nodes.map(({ id }) => id),
        hierarchyEdgeIds: sortedUnique(
          hierarchyByDocument.get(documentId) ?? [],
        ),
        internalReferenceIds: internalIdsByDocument.get(documentId) ?? [],
        diagnosticIds: sortedUnique(
          diagnosticIdsByDocument.get(documentId) ?? [],
        ),
        focusDistance,
        incomingDistance,
        outgoingDistance,
        placement: placementFor(incomingDistance, outgoingDistance),
      };
    })
    .sort(
      (left, right) =>
        compareText(left.sourcePath, right.sourcePath) ||
        compareText(left.id, right.id),
    );
  const moduleById = new Map(
    provisionalModules.map((module) => [module.id, module]),
  );

  let relationships: FocusSchematicRelationship[] = relationshipPairs
    .map((key) => {
      const [sourceModuleId, targetModuleId] = JSON.parse(key) as [
        EntityId,
        EntityId,
      ];
      const source = moduleById.get(sourceModuleId);
      const target = moduleById.get(targetModuleId);
      if (source === undefined || target === undefined) {
        throw new Error(
          `Document relationship ${key} escapes the Focus neighborhood.`,
        );
      }
      const outgoingPathForModuleIds =
        source.outgoingDistance !== null &&
        target.outgoingDistance !== null &&
        source.outgoingDistance + 1 === target.outgoingDistance
          ? [targetModuleId]
          : [];
      const incomingPathForModuleIds =
        source.incomingDistance !== null &&
        target.incomingDistance !== null &&
        source.incomingDistance === target.incomingDistance + 1
          ? [sourceModuleId]
          : [];
      return {
        id: relationshipId(sourceModuleId, targetModuleId),
        sourceModuleId,
        targetModuleId,
        documentProjectionEdgeIds: sortedUnique(
          relationshipDocumentEdges.get(key) ?? [],
        ),
        referenceIds: sortedUnique(relationshipReferences.get(key) ?? []),
        visibleEndpointGroups: [...(visibleGroupsByPair.get(key) ?? [])].sort(
          (left, right) =>
            compareText(left.projectedEdgeId, right.projectedEdgeId),
        ),
        incomingPathForModuleIds,
        outgoingPathForModuleIds,
        selectedBackboneForModuleIds: [],
        secondary:
          incomingPathForModuleIds.length === 0 &&
          outgoingPathForModuleIds.length === 0,
      };
    })
    .sort((left, right) => {
      const a = moduleById.get(left.sourceModuleId);
      const b = moduleById.get(right.sourceModuleId);
      const c = moduleById.get(left.targetModuleId);
      const d = moduleById.get(right.targetModuleId);
      return (
        compareText(a?.sourcePath ?? '', b?.sourcePath ?? '') ||
        compareText(c?.sourcePath ?? '', d?.sourcePath ?? '') ||
        compareText(left.id, right.id)
      );
    });

  const parentCandidates: FocusSchematicParentCandidate[] = [];
  const leftCandidatesByModule = new Map<
    EntityId,
    FocusSchematicRelationship[]
  >();
  const rightCandidatesByModule = new Map<
    EntityId,
    FocusSchematicRelationship[]
  >();
  for (const relationship of relationships) {
    for (const moduleId of relationship.incomingPathForModuleIds) {
      const values = leftCandidatesByModule.get(moduleId) ?? [];
      values.push(relationship);
      leftCandidatesByModule.set(moduleId, values);
    }
    for (const moduleId of relationship.outgoingPathForModuleIds) {
      const values = rightCandidatesByModule.get(moduleId) ?? [];
      values.push(relationship);
      rightCandidatesByModule.set(moduleId, values);
    }
  }
  for (const module of provisionalModules) {
    if (module.id === neighborhood.rootDocumentEntityId) continue;
    for (const side of module.placement.allowedSides) {
      if (side === 'center') continue;
      const eligible =
        side === 'left'
          ? (leftCandidatesByModule.get(module.id) ?? [])
          : (rightCandidatesByModule.get(module.id) ?? []);
      const ranked = eligible
        .map((relationship) => {
          const parentModuleId =
            side === 'left'
              ? relationship.targetModuleId
              : relationship.sourceModuleId;
          return {
            moduleId: module.id,
            side,
            parentModuleId,
            relationshipId: relationship.id,
            endpointSpecificity: relationship.visibleEndpointGroups.reduce(
              (maximum, group) =>
                Math.max(
                  maximum,
                  (group.sourcePrecision === 'document' ? 0 : 1) +
                    (group.targetPrecision === 'document' ? 0 : 1),
                ),
              0,
            ),
            referenceCount: relationship.referenceIds.length,
            sameFolder:
              module.folderKey === moduleById.get(parentModuleId)?.folderKey,
            selected: false,
          } satisfies FocusSchematicParentCandidate;
        })
        .sort(
          (left, right) =>
            right.endpointSpecificity - left.endpointSpecificity ||
            right.referenceCount - left.referenceCount ||
            Number(right.sameFolder) - Number(left.sameFolder) ||
            compareText(
              moduleById.get(left.parentModuleId)?.sourcePath ?? '',
              moduleById.get(right.parentModuleId)?.sourcePath ?? '',
            ) ||
            compareText(left.relationshipId, right.relationshipId),
        );
      if (ranked.length === 0) {
        throw new Error(
          `Module "${module.id}" has no ${side} parent candidate for a valid directed path.`,
        );
      }
      ranked.forEach((candidate, index) =>
        parentCandidates.push({
          ...candidate,
          selected: module.placement.preferredSide === side && index === 0,
        }),
      );
    }
  }
  parentCandidates.sort((left, right) => {
    const leftModule = moduleById.get(left.moduleId);
    const rightModule = moduleById.get(right.moduleId);
    return (
      compareText(
        leftModule?.sourcePath ?? '',
        rightModule?.sourcePath ?? '',
      ) ||
      compareText(left.side, right.side) ||
      Number(right.selected) - Number(left.selected) ||
      compareText(left.relationshipId, right.relationshipId)
    );
  });
  const selectedByRelationship = new Map<string, EntityId[]>();
  for (const candidate of parentCandidates.filter(({ selected }) => selected)) {
    const values = selectedByRelationship.get(candidate.relationshipId) ?? [];
    values.push(candidate.moduleId);
    selectedByRelationship.set(candidate.relationshipId, values);
  }
  relationships = relationships.map((relationship) => ({
    ...relationship,
    selectedBackboneForModuleIds: sortedUnique(
      selectedByRelationship.get(relationship.id) ?? [],
    ),
  }));

  const folderKeys = new Set<string>();
  for (const module of provisionalModules) {
    let key: string | null = module.folderKey;
    while (key !== null) {
      folderKeys.add(key);
      key = parentFolder(key);
    }
  }
  const folders: FocusSchematicFolder[] = [...folderKeys]
    .sort((left, right) =>
      left === '.' ? -1 : right === '.' ? 1 : compareText(left, right),
    )
    .map((key) => ({
      key,
      depth: key === '.' ? 0 : key.split('/').length,
      parentKey: parentFolder(key),
      directModuleIds: provisionalModules
        .filter((module) => module.folderKey === key)
        .map(({ id }) => id),
      containsRootModule:
        moduleById.get(neighborhood.rootDocumentEntityId)?.folderKey === key,
    }));

  const issues: (FocusSchematicIssue | (typeof neighborhood.issues)[number])[] =
    [...neighborhood.issues];
  for (const module of provisionalModules) {
    if (module.placement.reason === 'equal-mutual')
      issues.push({
        code: 'equal-mutual-side',
        subject: module.id,
        message:
          'Equal directed distances leave side selection to a layout strategy.',
      });
    if (
      module.presentation === 'filtered' &&
      module.id !== neighborhood.rootDocumentEntityId
    )
      issues.push({
        code: 'filtered-path-intermediate',
        subject: module.id,
        message:
          'The fixed document path includes a File removed by detailed filters.',
      });
  }
  for (const relationship of relationships) {
    if (relationship.visibleEndpointGroups.length === 0)
      issues.push({
        code: 'document-only-endpoint',
        subject: relationship.id,
        message:
          'The relationship has document-level provenance but no visible detailed endpoint.',
      });
  }
  for (const diagnostic of diagnostics) {
    if (diagnostic.candidateDocumentEntityIds.some((id) => !moduleIds.has(id)))
      issues.push({
        code: 'external-ambiguous-candidate',
        subject: diagnostic.id,
        message:
          'An ambiguous candidate document is outside the Focus neighborhood.',
      });
  }
  issues.sort(
    (left, right) =>
      compareText(left.code, right.code) ||
      compareText(left.subject, right.subject),
  );

  return {
    schemaVersion: FOCUS_SCHEMATIC_MODEL_SCHEMA_VERSION,
    rootModuleId: neighborhood.rootDocumentEntityId,
    focus: neighborhood.focus,
    modules: provisionalModules,
    folders,
    relationships,
    internalReferences: internalReferences.sort((left, right) =>
      compareText(left.id, right.id),
    ),
    diagnostics: diagnostics.sort(
      (left, right) =>
        compareText(
          moduleById.get(left.ownerModuleId)?.sourcePath ?? '',
          moduleById.get(right.ownerModuleId)?.sourcePath ?? '',
        ) || compareText(left.id, right.id),
    ),
    parentCandidates,
    issues,
  };
}

function isJsonSafe(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value))
    return value.every((item) => isJsonSafe(item, seen));
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.entries(value).every(
    ([key, item]) =>
      key.length > 0 && item !== undefined && isJsonSafe(item, seen),
  );
}

export function validateFocusSchematicModel(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
  projection: ViewProjection,
  value: unknown,
): FocusSchematicModelValidationResult {
  if (!isJsonSafe(value)) {
    return {
      valid: false,
      issues: [
        {
          code: 'invalid-shape',
          path: '$',
          message: 'Model must be finite, acyclic plain JSON data.',
        },
      ],
    };
  }
  let expected: FocusSchematicModel;
  try {
    expected = buildModel({ workspace, state, projection });
  } catch (error) {
    return {
      valid: false,
      issues: [
        {
          code: 'semantic-mismatch',
          path: '$',
          message:
            error instanceof Error
              ? error.message
              : 'Could not derive expected model semantics.',
        },
      ],
    };
  }
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    return {
      valid: false,
      issues: [
        {
          code: 'semantic-mismatch',
          path: '$',
          message:
            'Model shape, ordering, ownership, provenance, or derived semantics differ from the canonical model.',
        },
      ],
    };
  }
  return { valid: true, value: expected, issues: [] };
}

export function createFocusSchematicModel(
  input: CreateFocusSchematicModelInput,
): FocusSchematicModel {
  const model = buildModel(input);
  // buildModel checks every ownership and semantic equation while deriving the
  // canonical object. The final independent check prevents public non-JSON data.
  if (!isJsonSafe(model))
    throw new Error(
      'Focus Schematic invariant failure: output is not plain JSON data.',
    );
  return model;
}
