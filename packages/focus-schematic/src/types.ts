import type {
  EntityId,
  ReferenceId,
  WorkspaceFolderKey,
  WorkspacePath,
} from '@icarus-graph-explorer/core';
import type {
  ProjectionEdgeId,
  ProjectionIssue,
  ProjectionNodeId,
} from '@icarus-graph-explorer/view-projection';

export const FOCUS_SCHEMATIC_MODEL_SCHEMA_VERSION = 1 as const;
export type FocusSchematicSide = 'center' | 'left' | 'right';
export type FocusSchematicDistance = 0 | 1 | 2 | 3;

export interface FocusSchematicPlacement {
  readonly allowedSides: readonly FocusSchematicSide[];
  readonly preferredSide: FocusSchematicSide | null;
  readonly rankMagnitude: FocusSchematicDistance;
  readonly preferredSignedRank: -3 | -2 | -1 | 0 | 1 | 2 | 3 | null;
  readonly reason:
    | 'root'
    | 'incoming-only'
    | 'outgoing-only'
    | 'shorter-incoming'
    | 'shorter-outgoing'
    | 'equal-mutual';
}

export interface FocusSchematicModule {
  readonly id: EntityId;
  readonly documentEntityId: EntityId;
  readonly sourcePath: WorkspacePath;
  readonly folderKey: WorkspaceFolderKey;
  readonly presentation: 'visible-content' | 'visible-context' | 'filtered';
  readonly documentProjectionNodeId: ProjectionNodeId | null;
  readonly visibleEntityNodeIds: readonly ProjectionNodeId[];
  readonly hierarchyEdgeIds: readonly ProjectionEdgeId[];
  readonly internalReferenceIds: readonly string[];
  readonly diagnosticIds: readonly ProjectionNodeId[];
  readonly focusDistance: FocusSchematicDistance;
  readonly incomingDistance: FocusSchematicDistance | null;
  readonly outgoingDistance: FocusSchematicDistance | null;
  readonly placement: FocusSchematicPlacement;
}

export interface FocusSchematicFolder {
  readonly key: WorkspaceFolderKey;
  readonly depth: number;
  readonly parentKey: WorkspaceFolderKey | null;
  readonly directModuleIds: readonly EntityId[];
  readonly containsRootModule: boolean;
}

export interface FocusSchematicEndpointGroup {
  readonly projectedEdgeId: ProjectionEdgeId;
  readonly sourceProjectionNodeId: ProjectionNodeId;
  readonly targetProjectionNodeId: ProjectionNodeId;
  readonly referenceIds: readonly ReferenceId[];
  readonly sourcePrecision: 'document' | 'section' | 'block';
  readonly targetPrecision: 'document' | 'section' | 'block';
}

export interface FocusSchematicRelationship {
  readonly id: string;
  readonly sourceModuleId: EntityId;
  readonly targetModuleId: EntityId;
  readonly documentProjectionEdgeIds: readonly ProjectionEdgeId[];
  readonly referenceIds: readonly ReferenceId[];
  readonly visibleEndpointGroups: readonly FocusSchematicEndpointGroup[];
  readonly incomingPathForModuleIds: readonly EntityId[];
  readonly outgoingPathForModuleIds: readonly EntityId[];
  readonly selectedBackboneForModuleIds: readonly EntityId[];
  readonly secondary: boolean;
}

export interface FocusSchematicInternalReference {
  readonly id: string;
  readonly moduleId: EntityId;
  readonly referenceIds: readonly ReferenceId[];
  readonly visibleEndpointGroups: readonly FocusSchematicEndpointGroup[];
  readonly collapsedOwnerNodeIds: readonly ProjectionNodeId[];
}

export interface FocusSchematicDiagnostic {
  readonly id: ProjectionNodeId;
  readonly ownerModuleId: EntityId;
  readonly status: 'unresolved' | 'ambiguous' | 'invalid';
  readonly rawTarget: string;
  readonly reasons: readonly string[];
  readonly referenceIds: readonly ReferenceId[];
  readonly sourceProjectionNodeIds: readonly ProjectionNodeId[];
  readonly candidateDocumentEntityIds: readonly EntityId[];
  readonly candidateVisibleModuleIds: readonly EntityId[];
}

export interface FocusSchematicParentCandidate {
  readonly moduleId: EntityId;
  readonly side: 'left' | 'right';
  readonly parentModuleId: EntityId;
  readonly relationshipId: string;
  readonly endpointSpecificity: number;
  readonly referenceCount: number;
  readonly sameFolder: boolean;
  readonly selected: boolean;
}

export interface FocusSchematicIssue {
  readonly code:
    | 'filtered-path-intermediate'
    | 'document-only-endpoint'
    | 'equal-mutual-side'
    | 'external-ambiguous-candidate';
  readonly subject: string;
  readonly message: string;
}

export interface FocusSchematicModel {
  readonly schemaVersion: typeof FOCUS_SCHEMATIC_MODEL_SCHEMA_VERSION;
  readonly rootModuleId: EntityId;
  readonly focus: {
    readonly direction: 'incoming' | 'outgoing' | 'both';
    readonly hops: 1 | 2 | 3;
  };
  readonly modules: readonly FocusSchematicModule[];
  readonly folders: readonly FocusSchematicFolder[];
  readonly relationships: readonly FocusSchematicRelationship[];
  readonly internalReferences: readonly FocusSchematicInternalReference[];
  readonly diagnostics: readonly FocusSchematicDiagnostic[];
  readonly parentCandidates: readonly FocusSchematicParentCandidate[];
  readonly issues: readonly (FocusSchematicIssue | ProjectionIssue)[];
}

export interface FocusSchematicModelValidationIssue {
  readonly code: 'invalid-shape' | 'semantic-mismatch';
  readonly path: string;
  readonly message: string;
}

export type FocusSchematicModelValidationResult =
  | {
      readonly valid: true;
      readonly value: FocusSchematicModel;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly FocusSchematicModelValidationIssue[];
    };

export interface FocusSchematicModelSummary {
  readonly moduleCount: number;
  readonly visibleContentModuleCount: number;
  readonly visibleContextModuleCount: number;
  readonly filteredModuleCount: number;
  readonly folderCount: number;
  readonly rootFolderModuleCount: number;
  readonly visibleEntityNodeCount: number;
  readonly visibleHierarchyEdgeCount: number;
  readonly crossModuleRelationshipCount: number;
  readonly internalReferenceCount: number;
  readonly canonicalReferenceCount: number;
  readonly incomingOnlyModuleCount: number;
  readonly outgoingOnlyModuleCount: number;
  readonly unequalMutualModuleCount: number;
  readonly equalMutualModuleCount: number;
  readonly focusPathRelationshipCount: number;
  readonly secondaryRelationshipCount: number;
  readonly selectedBackboneCount: number;
  readonly unresolvedBackboneModuleCount: number;
  readonly preciseEndpointReferenceCount: number;
  readonly documentOnlyEndpointReferenceCount: number;
  readonly filteredPathIntermediateCount: number;
  readonly diagnosticCount: number;
  readonly unresolvedDiagnosticCount: number;
  readonly ambiguousDiagnosticCount: number;
  readonly invalidDiagnosticCount: number;
  readonly externalAmbiguousCandidateCount: number;
}

export interface FocusSchematicRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FocusSchematicLayoutCandidate {
  readonly modelSchemaVersion: 1;
  readonly rootModuleId: EntityId;
  readonly modules: readonly (FocusSchematicRectangle & {
    readonly moduleId: EntityId;
  })[];
  readonly nodes: readonly (FocusSchematicRectangle & {
    readonly projectionNodeId: ProjectionNodeId;
    readonly moduleId: EntityId;
  })[];
  readonly routes: readonly {
    readonly relationshipId: string;
    readonly points: readonly { readonly x: number; readonly y: number }[];
  }[];
}

export interface FocusSchematicLayoutValidationIssue {
  readonly code: 'invalid-shape' | 'invalid-geometry' | 'coverage';
  readonly path: string;
  readonly message: string;
}

export type FocusSchematicLayoutValidationResult =
  | {
      readonly valid: true;
      readonly value: FocusSchematicLayoutCandidate;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly FocusSchematicLayoutValidationIssue[];
    };

export interface FocusSchematicLayoutQuality {
  readonly moduleOverlapPairs: readonly string[];
  readonly nodeOverlapPairs: readonly string[];
  readonly nodeOutsideModuleIds: readonly ProjectionNodeId[];
  readonly missingModuleIds: readonly EntityId[];
  readonly missingVisibleNodeIds: readonly ProjectionNodeId[];
  readonly unexpectedModuleIds: readonly EntityId[];
  readonly unexpectedNodeIds: readonly ProjectionNodeId[];
  readonly nonFiniteGeometryCount: number;
  readonly rootCenterOffsetX: number | null;
  readonly rootCenterOffsetY: number | null;
  readonly leftSideViolationModuleIds: readonly EntityId[];
  readonly rightSideViolationModuleIds: readonly EntityId[];
  readonly rankOrderViolationModuleIds: readonly EntityId[];
  readonly totalBoundsWidth: number;
  readonly totalBoundsHeight: number;
  readonly totalBoundsArea: number;
  readonly aspectRatio: number | null;
  readonly emptyAreaRatio: number | null;
  readonly sameFolderAdjacencyRatio: number | null;
  readonly rootFolderCenterOffset: number | null;
  readonly meanSameFolderVerticalDistance: number | null;
  readonly routingAvailable: boolean;
  readonly focusPathCrossingCount: number | null;
  readonly secondaryCrossingCount: number | null;
  readonly edgeNodeIntersectionCount: number | null;
  readonly approximateCrossingCount: number | null;
  readonly meanAttachmentAlignmentError: number | null;
  readonly p95AttachmentAlignmentError: number | null;
  readonly attachmentSampleCount: number;
}

export interface FocusSchematicStabilityQuality {
  readonly rootCenterDisplacement: number | null;
  readonly rootRelativeMedianSharedModuleDisplacement: number;
  readonly medianSharedModuleDisplacement: number;
  readonly p95SharedModuleDisplacement: number;
  readonly maximumSharedModuleDisplacement: number;
  readonly sharedModuleCount: number;
  readonly addedModuleCount: number;
  readonly removedModuleCount: number;
  readonly unaffectedModuleCount: number;
  readonly medianUnaffectedModuleDisplacement: number | null;
}
