import type {
  EntityId,
  EntityKind,
  ReferenceId,
  ReferenceKind,
  SourceSpan,
  WorkspacePath,
} from '@icarus-graph-explorer/core';
import type {
  DiagnosticReferenceStatus,
  ProjectionEdgeId,
  ProjectionNodeId,
  ReferenceResolutionStatus,
} from '@icarus-graph-explorer/view-projection';

export interface BreadcrumbPart {
  readonly entityId: EntityId;
  readonly kind: EntityKind;
  readonly label: string;
}

export interface EntityDescriptor {
  readonly entityId: EntityId;
  readonly kind: EntityKind;
  readonly displayName: string;
  readonly sourcePath: WorkspacePath;
  readonly sourceSpan: SourceSpan;
  readonly sourceProvenance: string;
  readonly breadcrumb: readonly BreadcrumbPart[];
}

export type OccurrenceResolutionDescriptor =
  | {
      readonly status: 'resolved';
      readonly target: EntityDescriptor;
      readonly candidates: readonly [];
      readonly reason: null;
    }
  | {
      readonly status: 'unresolved';
      readonly target: null;
      readonly candidates: readonly [];
      readonly reason: string | null;
    }
  | {
      readonly status: 'ambiguous';
      readonly target: null;
      readonly candidates: readonly EntityDescriptor[];
      readonly reason: string | null;
    }
  | {
      readonly status: 'invalid';
      readonly target: null;
      readonly candidates: readonly [];
      readonly reason: string;
    };

export interface ReferenceOccurrenceDescriptor {
  readonly referenceId: ReferenceId;
  readonly kind: ReferenceKind;
  readonly source: EntityDescriptor;
  readonly sourceSpan: SourceSpan;
  readonly sourceProvenance: string;
  readonly rawTarget: string;
  readonly status: ReferenceResolutionStatus;
  readonly resolution: OccurrenceResolutionDescriptor;
}

export interface OutgoingReferenceInspection {
  readonly occurrence: ReferenceOccurrenceDescriptor;
  readonly sourceIsDescendant: boolean;
}

export interface BacklinkInspection {
  readonly occurrence: ReferenceOccurrenceDescriptor;
  readonly target: EntityDescriptor;
  readonly targetIsDescendant: boolean;
}

export interface AmbiguousCandidateMentionInspection {
  readonly occurrence: ReferenceOccurrenceDescriptor;
  readonly relevantCandidates: readonly EntityDescriptor[];
}

export interface EntityInspection {
  readonly entity: EntityDescriptor;
  readonly descendantCount: number;
  readonly outgoingReferences: readonly OutgoingReferenceInspection[];
  readonly backlinks: readonly BacklinkInspection[];
  readonly ambiguousCandidateMentions: readonly AmbiguousCandidateMentionInspection[];
}

export interface ProjectedEntityInspection {
  readonly kind: 'entity';
  readonly projectionNodeId: ProjectionNodeId;
  readonly entity: EntityInspection;
  readonly role: 'content' | 'context';
  readonly focusDistance: number | null;
  readonly revealableDescendantCount: number;
  readonly internalRelationships: readonly ReferenceOccurrenceDescriptor[];
}

export interface ProjectedDiagnosticInspection {
  readonly kind: 'diagnostic';
  readonly projectionNodeId: ProjectionNodeId;
  readonly status: DiagnosticReferenceStatus;
  readonly rawTarget: string;
  readonly reasons: readonly string[];
  readonly occurrences: readonly ReferenceOccurrenceDescriptor[];
  readonly candidates: readonly EntityDescriptor[];
}

export type ProjectedNodeInspection =
  ProjectedEntityInspection | ProjectedDiagnosticInspection;

export interface ProjectedOccurrenceInspection {
  readonly occurrence: ReferenceOccurrenceDescriptor;
  readonly sourceRolledUp: boolean;
  readonly targetRolledUp: boolean;
}

export interface ProjectedReferenceEdgeInspection {
  readonly kind: 'reference';
  readonly projectionEdgeId: ProjectionEdgeId;
  readonly status: ReferenceResolutionStatus;
  readonly projectedSource: EntityDescriptor;
  readonly projectedTarget: EntityDescriptor | ProjectedDiagnosticInspection;
  readonly occurrences: readonly ProjectedOccurrenceInspection[];
}

export interface ProjectedHierarchyEdgeInspection {
  readonly kind: 'hierarchy';
  readonly projectionEdgeId: ProjectionEdgeId;
  readonly parent: EntityDescriptor;
  readonly child: EntityDescriptor;
}

export type ProjectedEdgeInspection =
  ProjectedReferenceEdgeInspection | ProjectedHierarchyEdgeInspection;

export type SearchMatchKind =
  | 'exact-name'
  | 'name-prefix'
  | 'exact-breadcrumb'
  | 'name-substring'
  | 'path-or-breadcrumb-substring';

export interface EntitySearchResult {
  readonly entity: EntityDescriptor;
  readonly match: SearchMatchKind;
}

export interface SearchEntitiesOptions {
  /** Positive bounded result count. Defaults to 30. */
  readonly limit?: number;
}
