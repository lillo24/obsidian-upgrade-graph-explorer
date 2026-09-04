import type { EntityId, ReferenceId } from '@icarus-graph-explorer/core';
import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicLayoutQuality,
  FocusSchematicModel,
} from '@icarus-graph-explorer/focus-schematic';
import type {
  ProjectionEdgeId,
  ProjectionNodeId,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

export const FOCUS_SCHEMATIC_LAYOUT_PLAN_SCHEMA_VERSION = 1 as const;
export const FOCUS_SCHEMATIC_ENDPOINT_PLAN_SCHEMA_VERSION = 1 as const;
export const FOCUS_SCHEMATIC_INTERNAL_LANE_PLAN_SCHEMA_VERSION = 1 as const;

export type FocusSchematicFilteredModulePolicy =
  'compact-bridge' | 'context-card';

export interface FocusSchematicNodeDimension {
  readonly projectionNodeId: ProjectionNodeId;
  readonly width: number;
  readonly height: number;
}

export interface FocusSchematicPrototypeSettings {
  readonly filteredModulePolicy: FocusSchematicFilteredModulePolicy;
  readonly modulePaddingX: number;
  readonly modulePaddingY: number;
  readonly diagnosticReserveHeight: number;
  readonly internalNodeSeparation: number;
  readonly internalRankSeparation: number;
  readonly macroNodeSeparation: number;
  readonly macroRankSeparation: number;
  readonly ranker: 'network-simplex' | 'tight-tree' | 'longest-path';
}

export interface FocusSchematicLayoutInput {
  readonly model: FocusSchematicModel;
  readonly projection: ViewProjection;
  readonly nodeDimensions: readonly FocusSchematicNodeDimension[];
  readonly settings: FocusSchematicPrototypeSettings;
}

export interface FocusSchematicLayoutPlanModule {
  readonly moduleId: EntityId;
  readonly side: 'center' | 'left' | 'right';
  readonly signedRank: -3 | -2 | -1 | 0 | 1 | 2 | 3;
  readonly parentModuleId: EntityId | null;
  readonly parentRelationshipId: string | null;
}

export interface FocusSchematicLayoutPlan {
  readonly schemaVersion: typeof FOCUS_SCHEMATIC_LAYOUT_PLAN_SCHEMA_VERSION;
  readonly rootModuleId: EntityId;
  readonly modules: readonly FocusSchematicLayoutPlanModule[];
  readonly arbitraryTieBreakCount: number;
}

export interface FocusSchematicLayoutPhaseTimings {
  readonly inputMs: number;
  readonly planningMs: number;
  readonly internalMs: number;
  readonly macroMs: number;
  readonly postMs: number;
  readonly validateMs: number;
  readonly qualityMs: number;
  readonly serializeMs: number;
  readonly totalMs: number;
}

export interface FocusSchematicNativeRoute {
  readonly relationshipId: string;
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

export type FocusSchematicLayoutAttempt =
  | {
      readonly status: 'success';
      readonly strategyId: string;
      readonly configId: string;
      readonly plan: FocusSchematicLayoutPlan;
      readonly candidate: FocusSchematicLayoutCandidate;
      readonly quality: FocusSchematicLayoutQuality;
      readonly nativeRoutes: readonly FocusSchematicNativeRoute[];
      readonly routeCoverage: number;
      readonly warnings: readonly string[];
      readonly timings: FocusSchematicLayoutPhaseTimings;
    }
  | {
      readonly status: 'unsupported' | 'failure' | 'timeout';
      readonly strategyId: string;
      readonly configId: string;
      readonly reason: string;
      readonly timings: FocusSchematicLayoutPhaseTimings;
    };

export interface FocusSchematicLayoutInputValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type FocusSchematicLayoutInputValidationResult =
  | {
      readonly valid: true;
      readonly value: FocusSchematicLayoutInput;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly FocusSchematicLayoutInputValidationIssue[];
    };

export interface FocusSchematicLayoutPlanValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type FocusSchematicLayoutPlanValidationResult =
  | {
      readonly valid: true;
      readonly value: FocusSchematicLayoutPlan;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly FocusSchematicLayoutPlanValidationIssue[];
    };

export type FocusSchematicEndpointAttachmentSide = 'left' | 'right' | 'auto';
export type FocusSchematicConnectionRole =
  'selected-backbone' | 'focus-path' | 'secondary';

export type FocusSchematicConnectionEndpoint =
  | {
      readonly kind: 'visible-entity';
      readonly projectionNodeId: ProjectionNodeId;
      readonly entityId: EntityId;
      readonly entityKind: 'document' | 'section' | 'block';
      readonly moduleId: EntityId;
      readonly attachmentSide: FocusSchematicEndpointAttachmentSide;
    }
  | {
      readonly kind: 'module-anchor';
      readonly moduleId: EntityId;
      readonly reason: 'filtered-module' | 'no-visible-document-endpoint';
      readonly attachmentSide: FocusSchematicEndpointAttachmentSide;
    };

export interface FocusSchematicEndpointConnection {
  readonly id: string;
  readonly kind: 'precise' | 'fallback';
  readonly relationshipId: string;
  readonly projectedEdgeId: ProjectionEdgeId | null;
  readonly referenceIds: readonly ReferenceId[];
  readonly sourceModuleId: EntityId;
  readonly targetModuleId: EntityId;
  readonly source: FocusSchematicConnectionEndpoint;
  readonly target: FocusSchematicConnectionEndpoint;
  readonly role: FocusSchematicConnectionRole;
}

export interface FocusSchematicNodeEndpointDemand {
  readonly projectionNodeId: ProjectionNodeId;
  readonly moduleId: EntityId;
  readonly directSides: readonly ('left' | 'right')[];
  readonly sourceConnectionIds: readonly string[];
  readonly targetConnectionIds: readonly string[];
  readonly selectedBackboneConnectionIds: readonly string[];
  readonly focusPathConnectionIds: readonly string[];
}

export interface FocusSchematicEndpointPlanSummary {
  readonly preciseConnectionCount: number;
  readonly fallbackConnectionCount: number;
  readonly preciseReferenceIdCount: number;
  readonly fallbackReferenceIdCount: number;
  readonly totalReferenceIdCount: number;
}

export interface FocusSchematicEndpointPlan {
  readonly schemaVersion: typeof FOCUS_SCHEMATIC_ENDPOINT_PLAN_SCHEMA_VERSION;
  readonly rootModuleId: EntityId;
  readonly connections: readonly FocusSchematicEndpointConnection[];
  readonly nodeDemands: readonly FocusSchematicNodeEndpointDemand[];
  readonly summary: FocusSchematicEndpointPlanSummary;
}

export type FocusSchematicDemandMask = 'none' | 'left' | 'right' | 'both';
export type FocusSchematicInternalLane = 'left' | 'center' | 'right';

export interface FocusSchematicInternalLaneNode {
  readonly projectionNodeId: ProjectionNodeId;
  readonly moduleId: EntityId;
  readonly lane: FocusSchematicInternalLane;
  readonly directDemand: FocusSchematicDemandMask;
  readonly subtreeDemand: FocusSchematicDemandMask;
  readonly reason:
    | 'document-core'
    | 'left-subtree'
    | 'right-subtree'
    | 'mixed-ancestor'
    | 'neutral-center'
    | 'neutral-inherited';
}

export interface FocusSchematicInternalHierarchyAttachment {
  readonly hierarchyEdgeId: ProjectionEdgeId;
  readonly sourceProjectionNodeId: ProjectionNodeId;
  readonly targetProjectionNodeId: ProjectionNodeId;
  readonly sourceSide: 'left' | 'right' | 'top' | 'bottom' | 'auto';
  readonly targetSide: 'left' | 'right' | 'top' | 'bottom' | 'auto';
}

export interface FocusSchematicInternalLanePlan {
  readonly schemaVersion: typeof FOCUS_SCHEMATIC_INTERNAL_LANE_PLAN_SCHEMA_VERSION;
  readonly rootModuleId: EntityId;
  readonly nodes: readonly FocusSchematicInternalLaneNode[];
  readonly hierarchyAttachments: readonly FocusSchematicInternalHierarchyAttachment[];
}

export interface FocusSchematicEndpointAttachmentGeometry {
  readonly connectionId: string;
  readonly endpoint: 'source' | 'target';
  readonly kind: 'visible-node' | 'module-anchor';
  readonly projectionNodeId: ProjectionNodeId | null;
  readonly moduleId: EntityId;
  readonly side: 'left' | 'right' | 'top' | 'bottom';
  readonly x: number;
  readonly y: number;
}

export interface FocusSchematicEndpointLayoutQuality {
  readonly preciseConnectionCount: number;
  readonly fallbackConnectionCount: number;
  readonly preciseReferenceCoverage: number;
  readonly leftDemandViolationNodeIds: readonly ProjectionNodeId[];
  readonly rightDemandViolationNodeIds: readonly ProjectionNodeId[];
  readonly dualDemandNodeIds: readonly ProjectionNodeId[];
  readonly invalidLaneTransitionEdgeIds: readonly ProjectionEdgeId[];
  readonly obstructedSourceAttachmentConnectionIds: readonly string[];
  readonly obstructedTargetAttachmentConnectionIds: readonly string[];
  readonly ownModuleTraversalConnectionIds: readonly string[];
  readonly endpointNodeOverlapPairs: readonly string[];
  readonly moduleOverlapPairs: readonly string[];
  readonly nodeOverlapPairs: readonly string[];
  readonly nodeOutsideModuleIds: readonly ProjectionNodeId[];
  readonly totalBoundsArea: number;
  readonly meanPreciseEndpointVerticalError: number | null;
  readonly p95PreciseEndpointVerticalError: number | null;
}

export interface FocusSchematicComputedLayout {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly modulePlan: FocusSchematicLayoutPlan;
  readonly endpointPlan: FocusSchematicEndpointPlan;
  readonly internalLanePlan: FocusSchematicInternalLanePlan;
  readonly attachments: readonly FocusSchematicEndpointAttachmentGeometry[];
  readonly quality: FocusSchematicEndpointLayoutQuality;
}

export interface FocusSchematicEndpointLayoutPhaseTimings {
  readonly inputMs: number;
  readonly modulePlanningMs: number;
  readonly endpointConnectionMs: number;
  readonly demandCollectionMs: number;
  readonly subtreePropagationMs: number;
  readonly laneAssignmentMs: number;
  readonly centerLayoutMs: number;
  readonly leftLayoutMs: number;
  readonly rightLayoutMs: number;
  readonly compositionMs: number;
  readonly macroMs: number;
  readonly attachmentMs: number;
  readonly qualityMs: number;
  readonly validationMs: number;
  readonly serializationMs: number;
  readonly totalMs: number;
  readonly dagreCallCount: number;
  readonly inputSerializedBytes: number;
  readonly outputSerializedBytes: number;
  readonly endpointLaneSerializedBytes: number;
}

export type FocusSchematicComputedLayoutAttempt =
  | {
      readonly status: 'success';
      readonly strategyId: 'A1-endpoint-facing-split-lanes';
      readonly configId: string;
      readonly result: FocusSchematicComputedLayout;
      readonly nativeRoutes: readonly FocusSchematicNativeRoute[];
      readonly timings: FocusSchematicEndpointLayoutPhaseTimings;
      readonly warnings: readonly string[];
    }
  | {
      readonly status: 'failure';
      readonly strategyId: 'A1-endpoint-facing-split-lanes';
      readonly configId: string;
      readonly reason: string;
      readonly timings: FocusSchematicEndpointLayoutPhaseTimings;
    };

export interface FocusSchematicEndpointValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type FocusSchematicEndpointValidationResult<T> =
  | { readonly valid: true; readonly value: T; readonly issues: readonly [] }
  | {
      readonly valid: false;
      readonly issues: readonly FocusSchematicEndpointValidationIssue[];
    };
