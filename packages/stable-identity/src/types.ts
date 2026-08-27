import type {
  EntityId,
  EntityKind,
  KnowledgeSnapshot,
  ReferenceId,
  ReferenceKind,
  ReferenceResolution,
  WorkspaceId,
  WorkspacePath,
} from '@icarus-graph-explorer/core';

export const STABLE_IDENTITY_CATALOG_SCHEMA_VERSION = 1 as const;

interface StableObservationSource {
  readonly sourcePath: WorkspacePath;
  readonly sourceStartOffset: number | null;
}

export interface StableDocumentObservation extends StableObservationSource {
  readonly id: EntityId;
  readonly kind: 'document';
  readonly structuralFingerprint: string;
  readonly structuralSignalCount: number;
}

export interface StableSectionObservation extends StableObservationSource {
  readonly id: EntityId;
  readonly kind: 'section';
  readonly parentId: EntityId;
  readonly documentId: EntityId;
  readonly title: string;
  readonly level: number;
  readonly siblingOrdinal: number;
  readonly sameTitleOrdinal: number;
  readonly strongFingerprint: string;
  readonly strongSignalCount: number;
}

export interface StableBlockObservation extends StableObservationSource {
  readonly id: EntityId;
  readonly kind: 'block';
  readonly parentId: EntityId;
  readonly documentId: EntityId;
  readonly siblingOrdinal: number;
}

export type StableEntityObservation =
  StableDocumentObservation | StableSectionObservation | StableBlockObservation;

export interface StableReferenceObservation {
  readonly id: ReferenceId;
  readonly sourceEntityId: EntityId;
  readonly kind: ReferenceKind;
  readonly rawTarget: string;
  readonly sourceStartOffset: number | null;
  readonly resolution: ReferenceResolution;
}

/** Private source-neutral evidence retained between complete snapshot runs. */
export interface StableIdentityCatalog {
  readonly schemaVersion: typeof STABLE_IDENTITY_CATALOG_SCHEMA_VERSION;
  readonly workspaceId: WorkspaceId;
  readonly nextEntitySequence: number;
  readonly nextReferenceSequence: number;
  readonly entities: readonly StableEntityObservation[];
  readonly references: readonly StableReferenceObservation[];
}

export interface StableIdentityCatalogValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type StableIdentityCatalogValidationResult =
  | {
      readonly valid: true;
      readonly value: StableIdentityCatalog;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly StableIdentityCatalogValidationIssue[];
    };

export interface IdentityKindSummary {
  readonly reusedExact: number;
  readonly reusedStrong: number;
  readonly allocatedNew: number;
  readonly ambiguousNotReused: number;
}

export interface StableIdentityReconciliationSummary {
  readonly documents: IdentityKindSummary;
  readonly sections: IdentityKindSummary;
  readonly blocks: IdentityKindSummary;
  readonly references: IdentityKindSummary;
  readonly retiredFromPrevious: {
    readonly entities: number;
    readonly references: number;
  };
}

export interface StableIdentityReconciliationDiagnostic {
  readonly code: 'ambiguous-identity-match';
  readonly recordKind: EntityKind | 'reference';
  readonly message: string;
}

export interface StableIdentityReconciliationInput {
  readonly snapshot: KnowledgeSnapshot;
  readonly previousCatalog?: StableIdentityCatalog;
}

export interface StableIdentityReconciliationResult {
  readonly snapshot: KnowledgeSnapshot;
  readonly catalog: StableIdentityCatalog;
  readonly summary: StableIdentityReconciliationSummary;
  readonly diagnostics: readonly StableIdentityReconciliationDiagnostic[];
}
