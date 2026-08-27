import {
  validateKnowledgeSnapshot,
  type AddressableEntity,
  type BlockEntity,
  type DocumentEntity,
  type EntityId,
  type EntityKind,
  type KnowledgeSnapshot,
  type Reference,
  type ReferenceId,
  type ReferenceResolution,
  type SectionEntity,
} from '@icarus-graph-explorer/core';

import {
  createStableIdentityCatalog,
  validateStableIdentityCatalog,
} from './catalog';
import {
  buildSnapshotEvidence,
  buildStableIdentityCatalog,
} from './observations';
import { assertIdentityOnlyRemap } from './semantic';
import type {
  IdentityKindSummary,
  StableEntityObservation,
  StableIdentityCatalog,
  StableIdentityReconciliationDiagnostic,
  StableIdentityReconciliationInput,
  StableIdentityReconciliationResult,
  StableReferenceObservation,
  StableSectionObservation,
} from './types';

type MatchMode = 'exact' | 'strong' | 'new';
type MutableSummary = Record<
  EntityKind | 'reference',
  {
    reusedExact: number;
    reusedStrong: number;
    allocatedNew: number;
    ambiguousNotReused: number;
  }
>;

function emptyCounts(): IdentityKindSummary {
  return {
    reusedExact: 0,
    reusedStrong: 0,
    allocatedNew: 0,
    ambiguousNotReused: 0,
  };
}

function stableId(
  workspaceId: string,
  kind: 'entity' | 'reference',
  sequence: number,
): string {
  return `stable:${JSON.stringify([workspaceId, kind, sequence])}`;
}

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing === undefined) map.set(key, [value]);
  else existing.push(value);
}

function referenceSignature(
  reference: Pick<
    StableReferenceObservation,
    'sourceEntityId' | 'kind' | 'rawTarget'
  >,
): string {
  return JSON.stringify([
    reference.sourceEntityId,
    reference.kind,
    reference.rawTarget,
  ]);
}

function remapResolution(
  resolution: ReferenceResolution,
  entityIds: ReadonlyMap<EntityId, EntityId>,
): ReferenceResolution {
  const requireEntity = (id: EntityId): EntityId => {
    const stable = entityIds.get(id);
    if (stable === undefined)
      throw new Error(
        `Cannot remap missing canonical entity ${JSON.stringify(id)}.`,
      );
    return stable;
  };
  switch (resolution.status) {
    case 'resolved':
      return {
        status: 'resolved',
        targetEntityId: requireEntity(resolution.targetEntityId),
      };
    case 'ambiguous':
      return {
        status: 'ambiguous',
        candidateEntityIds: resolution.candidateEntityIds.map(requireEntity),
        ...(resolution.reason === undefined
          ? {}
          : { reason: resolution.reason }),
      };
    case 'unresolved':
      return resolution.reason === undefined
        ? { status: 'unresolved' }
        : { status: 'unresolved', reason: resolution.reason };
    case 'invalid':
      return { status: 'invalid', reason: resolution.reason };
  }
}

function documentKey(path: string): string {
  return path;
}

function structuralSectionKey(
  parentId: EntityId,
  title: string,
  level: number,
): string {
  return JSON.stringify([parentId, title, level]);
}

function strongSectionKey(documentId: EntityId, fingerprint: string): string {
  return JSON.stringify([documentId, fingerprint]);
}

function exactSectionKey(
  parentId: EntityId,
  title: string,
  level: number,
  path: string,
  offset: number | null,
): string {
  return JSON.stringify([parentId, title, level, path, offset]);
}

function exactBlockKey(
  parentId: EntityId,
  path: string,
  offset: number | null,
): string {
  return JSON.stringify([parentId, path, offset]);
}

function currentSectionGroupKey(
  parentId: EntityId,
  title: string,
  level: number,
): string {
  return JSON.stringify([parentId, title, level]);
}

function reconcileEntities(
  snapshot: KnowledgeSnapshot,
  catalog: StableIdentityCatalog,
  summary: MutableSummary,
  diagnostics: StableIdentityReconciliationDiagnostic[],
): {
  readonly ids: ReadonlyMap<EntityId, EntityId>;
  readonly nextSequence: number;
  readonly reusedPreviousIds: ReadonlySet<EntityId>;
} {
  const evidence = buildSnapshotEvidence(snapshot);
  const ids = new Map<EntityId, EntityId>();
  const usedPreviousIds = new Set<EntityId>();
  const ambiguousCurrentIds = new Set<EntityId>();
  const previousDocuments = catalog.entities.filter(
    (
      entity,
    ): entity is Extract<StableEntityObservation, { kind: 'document' }> =>
      entity.kind === 'document',
  );
  const currentDocuments = snapshot.entities.filter(
    (entity): entity is DocumentEntity => entity.kind === 'document',
  );
  let nextSequence = catalog.nextEntitySequence;
  const allPreviousIds = new Set(catalog.entities.map(({ id }) => id));

  const count = (
    kind: EntityKind,
    mode: MatchMode,
    ambiguous = false,
  ): void => {
    if (mode === 'exact') summary[kind].reusedExact += 1;
    else if (mode === 'strong') summary[kind].reusedStrong += 1;
    else summary[kind].allocatedNew += 1;
    if (ambiguous) summary[kind].ambiguousNotReused += 1;
  };
  const assignPrevious = (
    current: AddressableEntity,
    previousId: EntityId,
    mode: Exclude<MatchMode, 'new'>,
  ): void => {
    if (usedPreviousIds.has(previousId))
      throw new Error('Stable entity identity was matched more than once.');
    ids.set(current.id, previousId);
    usedPreviousIds.add(previousId);
    count(current.kind, mode);
  };
  const allocate = (current: AddressableEntity): void => {
    let allocated: string;
    do {
      allocated = stableId(catalog.workspaceId, 'entity', nextSequence);
      nextSequence += 1;
    } while (allPreviousIds.has(allocated));
    ids.set(current.id, allocated);
    count(current.kind, 'new', ambiguousCurrentIds.has(current.id));
  };
  const markAmbiguous = (current: AddressableEntity): void => {
    if (ambiguousCurrentIds.has(current.id)) return;
    ambiguousCurrentIds.add(current.id);
    diagnostics.push({
      code: 'ambiguous-identity-match',
      recordKind: current.kind,
      message: `Multiple previous ${current.kind} observations were plausible; a new stable identity was allocated.`,
    });
  };

  const previousDocumentsByPath = new Map<string, typeof previousDocuments>();
  const currentDocumentsByPath = new Map<string, typeof currentDocuments>();
  for (const previous of previousDocuments)
    append(previousDocumentsByPath, documentKey(previous.sourcePath), previous);
  for (const current of currentDocuments)
    append(currentDocumentsByPath, documentKey(current.source.path), current);
  for (const [path, currents] of currentDocumentsByPath) {
    const previous = previousDocumentsByPath.get(path) ?? [];
    if (
      currents.length === 1 &&
      previous.length === 1 &&
      currents[0] !== undefined &&
      previous[0] !== undefined
    ) {
      assignPrevious(currents[0], previous[0].id, 'exact');
    }
  }

  const previousDocumentsByFingerprint = new Map<
    string,
    typeof previousDocuments
  >();
  const currentDocumentsByFingerprint = new Map<
    string,
    typeof currentDocuments
  >();
  for (const previous of previousDocuments) {
    if (!usedPreviousIds.has(previous.id) && previous.structuralSignalCount > 0)
      append(
        previousDocumentsByFingerprint,
        previous.structuralFingerprint,
        previous,
      );
  }
  for (const current of currentDocuments) {
    if (ids.has(current.id)) continue;
    const signals = evidence.documentSignalCountById.get(current.id) ?? 0;
    if (signals > 0)
      append(
        currentDocumentsByFingerprint,
        evidence.documentFingerprintById.get(current.id) ?? '[]',
        current,
      );
  }
  for (const [fingerprint, currents] of currentDocumentsByFingerprint) {
    const previous = previousDocumentsByFingerprint.get(fingerprint) ?? [];
    if (
      currents.length === 1 &&
      previous.length === 1 &&
      currents[0] !== undefined &&
      previous[0] !== undefined
    ) {
      assignPrevious(currents[0], previous[0].id, 'strong');
    } else if (previous.length > 0) {
      for (const current of currents) markAmbiguous(current);
    }
  }
  for (const current of currentDocuments)
    if (!ids.has(current.id)) allocate(current);

  const previousSections = catalog.entities.filter(
    (entity): entity is StableSectionObservation => entity.kind === 'section',
  );
  const currentSections = snapshot.entities.filter(
    (entity): entity is SectionEntity => entity.kind === 'section',
  );
  const previousSectionsByExact = new Map<string, StableSectionObservation[]>();
  const previousSectionGroupCounts = new Map<string, number>();
  const currentSectionGroupCounts = new Map<string, number>();
  for (const previous of previousSections) {
    append(
      previousSectionsByExact,
      exactSectionKey(
        previous.parentId,
        previous.title,
        previous.level,
        previous.sourcePath,
        previous.sourceStartOffset,
      ),
      previous,
    );
    const groupKey = structuralSectionKey(
      previous.parentId,
      previous.title,
      previous.level,
    );
    previousSectionGroupCounts.set(
      groupKey,
      (previousSectionGroupCounts.get(groupKey) ?? 0) + 1,
    );
  }
  for (const current of currentSections) {
    const groupKey = currentSectionGroupKey(
      current.parentId,
      current.title,
      current.level,
    );
    currentSectionGroupCounts.set(
      groupKey,
      (currentSectionGroupCounts.get(groupKey) ?? 0) + 1,
    );
  }

  let progress = true;
  while (progress) {
    progress = false;
    for (const current of currentSections) {
      if (ids.has(current.id)) continue;
      const stableParent = ids.get(current.parentId);
      if (stableParent === undefined) continue;
      const previousGroupKey = structuralSectionKey(
        stableParent,
        current.title,
        current.level,
      );
      const currentGroupKey = currentSectionGroupKey(
        current.parentId,
        current.title,
        current.level,
      );
      const previousGroupCount =
        previousSectionGroupCounts.get(previousGroupKey) ?? 0;
      const currentGroupCount =
        currentSectionGroupCounts.get(currentGroupKey) ?? 0;
      if (previousGroupCount !== currentGroupCount) continue;
      const exact = (
        previousSectionsByExact.get(
          exactSectionKey(
            stableParent,
            current.title,
            current.level,
            current.source.path,
            current.source.span.start.offset ?? null,
          ),
        ) ?? []
      ).filter((previous) => !usedPreviousIds.has(previous.id));
      const candidate = exact[0];
      const duplicateContextAgrees =
        previousGroupCount <= 1 ||
        candidate === undefined ||
        (candidate.strongSignalCount === 0 &&
          (evidence.sectionSignalCountById.get(current.id) ?? 0) === 0) ||
        candidate.strongFingerprint ===
          evidence.sectionFingerprintById.get(current.id);
      if (exact.length === 1 && exact[0] !== undefined) {
        if (!duplicateContextAgrees) continue;
        assignPrevious(current, exact[0].id, 'exact');
        progress = true;
      }
    }

    const previousByStructure = new Map<string, StableSectionObservation[]>();
    const currentByStructure = new Map<string, SectionEntity[]>();
    for (const previous of previousSections) {
      if (!usedPreviousIds.has(previous.id))
        append(
          previousByStructure,
          structuralSectionKey(
            previous.parentId,
            previous.title,
            previous.level,
          ),
          previous,
        );
    }
    for (const current of currentSections) {
      if (ids.has(current.id)) continue;
      const stableParent = ids.get(current.parentId);
      if (stableParent !== undefined)
        append(
          currentByStructure,
          structuralSectionKey(stableParent, current.title, current.level),
          current,
        );
    }
    for (const [key, currents] of currentByStructure) {
      const previous = previousByStructure.get(key) ?? [];
      if (
        currents.length === 1 &&
        previous.length === 1 &&
        currents[0] !== undefined &&
        previous[0] !== undefined
      ) {
        assignPrevious(currents[0], previous[0].id, 'exact');
        progress = true;
      }
    }

    const previousByStrong = new Map<string, StableSectionObservation[]>();
    const currentByStrong = new Map<string, SectionEntity[]>();
    for (const previous of previousSections) {
      if (!usedPreviousIds.has(previous.id) && previous.strongSignalCount > 0)
        append(
          previousByStrong,
          strongSectionKey(previous.documentId, previous.strongFingerprint),
          previous,
        );
    }
    for (const current of currentSections) {
      if (ids.has(current.id)) continue;
      const document = evidence.documentByEntityId.get(current.id);
      const stableDocument =
        document === undefined ? undefined : ids.get(document.id);
      const signalCount = evidence.sectionSignalCountById.get(current.id) ?? 0;
      if (stableDocument !== undefined && signalCount > 0) {
        append(
          currentByStrong,
          strongSectionKey(
            stableDocument,
            evidence.sectionFingerprintById.get(current.id) ?? '[]',
          ),
          current,
        );
      }
    }
    for (const [key, currents] of currentByStrong) {
      const previous = previousByStrong.get(key) ?? [];
      if (
        currents.length === 1 &&
        previous.length === 1 &&
        currents[0] !== undefined &&
        previous[0] !== undefined
      ) {
        assignPrevious(currents[0], previous[0].id, 'strong');
        progress = true;
      }
    }
  }

  const unmatchedPreviousByStructure = new Map<
    string,
    StableSectionObservation[]
  >();
  const unmatchedPreviousByStrong = new Map<
    string,
    StableSectionObservation[]
  >();
  for (const previous of previousSections) {
    if (usedPreviousIds.has(previous.id)) continue;
    append(
      unmatchedPreviousByStructure,
      strongSectionKey(
        previous.documentId,
        JSON.stringify([previous.title, previous.level]),
      ),
      previous,
    );
    if (previous.strongSignalCount > 0) {
      append(
        unmatchedPreviousByStrong,
        strongSectionKey(previous.documentId, previous.strongFingerprint),
        previous,
      );
    }
  }
  for (const current of currentSections) {
    if (ids.has(current.id)) continue;
    const document = evidence.documentByEntityId.get(current.id);
    const stableDocument =
      document === undefined ? undefined : ids.get(document.id);
    const fingerprint = evidence.sectionFingerprintById.get(current.id);
    if (stableDocument === undefined) continue;
    const structuralCandidates =
      unmatchedPreviousByStructure.get(
        strongSectionKey(
          stableDocument,
          JSON.stringify([current.title, current.level]),
        ),
      ) ?? [];
    const strongCandidates =
      (evidence.sectionSignalCountById.get(current.id) ?? 0) > 0 &&
      fingerprint !== undefined
        ? (unmatchedPreviousByStrong.get(
            strongSectionKey(stableDocument, fingerprint),
          ) ?? [])
        : [];
    if (structuralCandidates.length > 0 || strongCandidates.length > 0) {
      markAmbiguous(current);
    }
  }
  let pendingSections = currentSections.filter(
    (section) => !ids.has(section.id),
  );
  while (pendingSections.length > 0) {
    const ready = pendingSections.filter((section) =>
      ids.has(section.parentId),
    );
    if (ready.length === 0)
      throw new Error(
        'Cannot allocate stable section IDs because canonical parents were not reconciled.',
      );
    for (const section of ready) allocate(section);
    pendingSections = pendingSections.filter((section) => !ids.has(section.id));
  }

  const previousBlocks = catalog.entities.filter(
    (entity): entity is Extract<StableEntityObservation, { kind: 'block' }> =>
      entity.kind === 'block',
  );
  const currentBlocks = snapshot.entities.filter(
    (entity): entity is BlockEntity => entity.kind === 'block',
  );
  const previousBlocksByExact = new Map<string, typeof previousBlocks>();
  const previousBlockCountsByParent = new Map<EntityId, number>();
  const currentBlockCountsByParent = new Map<EntityId, number>();
  for (const previous of previousBlocks) {
    append(
      previousBlocksByExact,
      exactBlockKey(
        previous.parentId,
        previous.sourcePath,
        previous.sourceStartOffset,
      ),
      previous,
    );
    previousBlockCountsByParent.set(
      previous.parentId,
      (previousBlockCountsByParent.get(previous.parentId) ?? 0) + 1,
    );
  }
  for (const current of currentBlocks) {
    currentBlockCountsByParent.set(
      current.parentId,
      (currentBlockCountsByParent.get(current.parentId) ?? 0) + 1,
    );
  }
  for (const current of currentBlocks) {
    const stableParent = ids.get(current.parentId);
    if (stableParent === undefined) continue;
    if (
      (previousBlockCountsByParent.get(stableParent) ?? 0) !==
      (currentBlockCountsByParent.get(current.parentId) ?? 0)
    ) {
      continue;
    }
    const exact = (
      previousBlocksByExact.get(
        exactBlockKey(
          stableParent,
          current.source.path,
          current.source.span.start.offset ?? null,
        ),
      ) ?? []
    ).filter((previous) => !usedPreviousIds.has(previous.id));
    if (exact.length === 1 && exact[0] !== undefined)
      assignPrevious(current, exact[0].id, 'exact');
  }
  const previousBlocksByParent = new Map<EntityId, typeof previousBlocks>();
  const currentBlocksByParent = new Map<EntityId, typeof currentBlocks>();
  for (const previous of previousBlocks)
    if (!usedPreviousIds.has(previous.id))
      append(previousBlocksByParent, previous.parentId, previous);
  for (const current of currentBlocks) {
    if (ids.has(current.id)) continue;
    const stableParent = ids.get(current.parentId);
    if (stableParent !== undefined)
      append(currentBlocksByParent, stableParent, current);
  }
  for (const [parentId, currents] of currentBlocksByParent) {
    const previous = previousBlocksByParent.get(parentId) ?? [];
    if (currents.length === previous.length) {
      const previousByOrdinal = new Map(
        previous.map((observation) => [
          observation.siblingOrdinal,
          observation,
        ]),
      );
      for (const current of currents) {
        const ordinal = evidence.siblingOrdinalById.get(current.id) ?? 0;
        const match = previousByOrdinal.get(ordinal);
        if (match !== undefined && !usedPreviousIds.has(match.id))
          assignPrevious(current, match.id, 'exact');
      }
    } else if (previous.length > 0) {
      for (const current of currents) markAmbiguous(current);
    }
  }
  for (const current of currentBlocks)
    if (!ids.has(current.id)) allocate(current);

  return { ids, nextSequence, reusedPreviousIds: usedPreviousIds };
}

function remapEntities(
  snapshot: KnowledgeSnapshot,
  ids: ReadonlyMap<EntityId, EntityId>,
): readonly AddressableEntity[] {
  const requireId = (id: EntityId): EntityId => {
    const stable = ids.get(id);
    if (stable === undefined)
      throw new Error(
        `Missing stable entity mapping for ${JSON.stringify(id)}.`,
      );
    return stable;
  };
  return snapshot.entities.map((entity): AddressableEntity => {
    const id = requireId(entity.id);
    if (entity.kind === 'document') return { ...entity, id };
    return { ...entity, id, parentId: requireId(entity.parentId) };
  });
}

function reconcileReferences(
  references: readonly Reference[],
  entityIds: ReadonlyMap<EntityId, EntityId>,
  catalog: StableIdentityCatalog,
  summary: MutableSummary,
  diagnostics: StableIdentityReconciliationDiagnostic[],
): {
  readonly references: readonly Reference[];
  readonly nextSequence: number;
  readonly reusedPreviousIds: ReadonlySet<ReferenceId>;
} {
  const mapped = references.map((reference) => {
    const sourceEntityId = entityIds.get(reference.sourceEntityId);
    if (sourceEntityId === undefined) {
      throw new Error(
        `Cannot remap missing reference source ${JSON.stringify(reference.sourceEntityId)}.`,
      );
    }
    return {
      original: reference,
      sourceEntityId,
      resolution: remapResolution(reference.resolution, entityIds),
    };
  });
  const ids = new Map<ReferenceId, ReferenceId>();
  const usedPrevious = new Set<ReferenceId>();
  const ambiguous = new Set<ReferenceId>();
  const previousBySignature = new Map<string, StableReferenceObservation[]>();
  const currentBySignature = new Map<string, typeof mapped>();
  for (const previous of catalog.references)
    append(previousBySignature, referenceSignature(previous), previous);
  for (const current of mapped)
    append(
      currentBySignature,
      referenceSignature({
        ...current.original,
        sourceEntityId: current.sourceEntityId,
      }),
      current,
    );

  const reuse = (
    current: (typeof mapped)[number],
    previous: StableReferenceObservation,
    mode: 'exact' | 'strong',
  ): void => {
    ids.set(current.original.id, previous.id);
    usedPrevious.add(previous.id);
    if (mode === 'exact') summary.reference.reusedExact += 1;
    else summary.reference.reusedStrong += 1;
  };
  for (const [signature, currents] of currentBySignature) {
    const previous = previousBySignature.get(signature) ?? [];
    if (currents.length === previous.length) {
      for (const current of currents) {
        const offset = current.original.sourceSpan.start.offset ?? null;
        const exact = previous.filter(
          (candidate) =>
            !usedPrevious.has(candidate.id) &&
            candidate.sourceStartOffset === offset,
        );
        const exactCurrents = currents.filter(
          (candidate) =>
            (candidate.original.sourceSpan.start.offset ?? null) === offset &&
            !ids.has(candidate.original.id),
        );
        if (
          exact.length === 1 &&
          exactCurrents.length === 1 &&
          exact[0] !== undefined
        )
          reuse(current, exact[0], 'exact');
      }
    }
    const remainingCurrent = currents.filter(
      (current) => !ids.has(current.original.id),
    );
    const remainingPrevious = previous.filter(
      (candidate) => !usedPrevious.has(candidate.id),
    );
    if (
      remainingCurrent.length === 1 &&
      remainingPrevious.length === 1 &&
      remainingCurrent[0] !== undefined &&
      remainingPrevious[0] !== undefined
    ) {
      reuse(remainingCurrent[0], remainingPrevious[0], 'strong');
    } else if (remainingPrevious.length > 0) {
      for (const current of remainingCurrent)
        ambiguous.add(current.original.id);
    }
  }

  let nextSequence = catalog.nextReferenceSequence;
  const previousIds = new Set(catalog.references.map(({ id }) => id));
  for (const current of mapped) {
    if (ids.has(current.original.id)) continue;
    let allocated: string;
    do {
      allocated = stableId(catalog.workspaceId, 'reference', nextSequence);
      nextSequence += 1;
    } while (previousIds.has(allocated));
    ids.set(current.original.id, allocated);
    summary.reference.allocatedNew += 1;
    if (ambiguous.has(current.original.id)) {
      summary.reference.ambiguousNotReused += 1;
      diagnostics.push({
        code: 'ambiguous-identity-match',
        recordKind: 'reference',
        message:
          'Duplicate semantic reference occurrences could not be matched safely; a new stable identity was allocated.',
      });
    }
  }
  return {
    references: mapped.map(({ original, sourceEntityId, resolution }) => {
      const id = ids.get(original.id);
      if (id === undefined) {
        throw new Error(
          `Missing stable reference mapping for ${JSON.stringify(original.id)}.`,
        );
      }
      return { ...original, id, sourceEntityId, resolution };
    }),
    nextSequence,
    reusedPreviousIds: usedPrevious,
  };
}

/** Reconcile one valid transient snapshot into a valid stable-ID snapshot. */
export function reconcileStableIdentity(
  input: StableIdentityReconciliationInput,
): StableIdentityReconciliationResult {
  const snapshotValidation = validateKnowledgeSnapshot(input.snapshot);
  if (!snapshotValidation.valid)
    throw new Error(
      `Cannot reconcile invalid canonical snapshot at ${snapshotValidation.issues[0]?.path ?? '$'}: ${snapshotValidation.issues[0]?.message ?? 'unknown validation failure'}`,
    );
  const snapshot = snapshotValidation.value;
  const candidateCatalog =
    input.previousCatalog ?? createStableIdentityCatalog(snapshot.workspace.id);
  const catalogValidation = validateStableIdentityCatalog(candidateCatalog);
  if (!catalogValidation.valid)
    throw new Error(
      `Stable identity catalog is invalid at ${catalogValidation.issues[0]?.path ?? '$'}: ${catalogValidation.issues[0]?.message ?? 'unknown validation failure'}`,
    );
  const catalog = catalogValidation.value;
  if (catalog.workspaceId !== snapshot.workspace.id)
    throw new Error(
      `Stable identity workspace mismatch: catalog and snapshot workspace IDs differ.`,
    );

  const summary: MutableSummary = {
    document: emptyCounts(),
    section: emptyCounts(),
    block: emptyCounts(),
    reference: emptyCounts(),
  };
  const diagnostics: StableIdentityReconciliationDiagnostic[] = [];
  const entities = reconcileEntities(snapshot, catalog, summary, diagnostics);
  const stableEntities = remapEntities(snapshot, entities.ids);
  const references = reconcileReferences(
    snapshot.references,
    entities.ids,
    catalog,
    summary,
    diagnostics,
  );
  const candidate: KnowledgeSnapshot = {
    schemaVersion: snapshot.schemaVersion,
    workspace: snapshot.workspace,
    entities: stableEntities,
    references: references.references,
  };
  const validation = validateKnowledgeSnapshot(candidate);
  if (!validation.valid)
    throw new Error(
      `Stable remapped snapshot failed validation at ${validation.issues[0]?.path ?? '$'}: ${validation.issues[0]?.message ?? 'unknown validation failure'}`,
    );
  assertIdentityOnlyRemap(snapshot, validation.value);
  const nextCatalog = buildStableIdentityCatalog(
    validation.value,
    entities.nextSequence,
    references.nextSequence,
  );
  const finalCatalogValidation = validateStableIdentityCatalog(nextCatalog);
  if (!finalCatalogValidation.valid)
    throw new Error(
      `Constructed stable identity catalog failed validation at ${finalCatalogValidation.issues[0]?.path ?? '$'}: ${finalCatalogValidation.issues[0]?.message ?? 'unknown validation failure'}`,
    );
  return {
    snapshot: validation.value,
    catalog: finalCatalogValidation.value,
    summary: {
      documents: summary.document,
      sections: summary.section,
      blocks: summary.block,
      references: summary.reference,
      retiredFromPrevious: {
        entities: catalog.entities.length - entities.reusedPreviousIds.size,
        references:
          catalog.references.length - references.reusedPreviousIds.size,
      },
    },
    diagnostics,
  };
}
