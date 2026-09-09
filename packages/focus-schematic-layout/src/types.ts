import type {
  EntityId,
  ReferenceId,
  WorkspaceFolderKey,
} from '@icarus-graph-explorer/core';
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
export const FOCUS_SCHEMATIC_FOLDER_BAND_PLAN_SCHEMA_VERSION = 4 as const;

export type FocusSchematicFilteredModulePolicy =
  'compact-bridge' | 'context-card';

/** Visual branch order; Markdown/source order always remains canonical. */
export type FocusSchematicEndpointOrderPolicy =
  'document-order' | 'crossing-optimized';

/** Internal File-module layout family. Current remains a lab-only comparator. */
export type FocusSchematicInternalLayoutVariant =
  'current' | 'vertical-spine' | 'adaptive-compass';

export interface FocusSchematicInternalLayoutModuleMetrics {
  readonly moduleId: EntityId;
  readonly topLevelBranchCount: number;
  readonly branchesAboveFile: number;
  readonly branchesBelowFile: number;
  readonly branchesLeftOfFile: number;
  readonly branchesRightOfFile: number;
  readonly packedExtentAboveFile: number;
  readonly packedExtentBelowFile: number;
  readonly packedExtentImbalance: number;
  readonly width: number;
  readonly height: number;
  readonly area: number;
}

export interface FocusSchematicInternalLayoutQualityMetrics {
  readonly totalPrimaryReferenceManhattanSpan: number;
  readonly meanPrimaryReferenceManhattanSpan: number | null;
  readonly p95PrimaryReferenceManhattanSpan: number | null;
  readonly totalPrimaryReferenceVerticalSpan: number;
  readonly meanPrimaryReferenceVerticalSpan: number | null;
  readonly internalHierarchyCrossingCount: number;
  readonly internalSourceOrderDeviation: number;
  readonly totalInternalBranchMovement: number;
  readonly totalModuleArea: number;
  readonly maximumModuleWidth: number;
  readonly maximumModuleHeight: number;
}

export interface FocusSchematicInternalLayoutEvidence {
  readonly variant: FocusSchematicInternalLayoutVariant;
  readonly developmentOnly: boolean;
  readonly verticalSpinePlacementCandidateCap: 64;
  readonly compassAssignmentCap: 64;
  readonly compassLocalRelocationSweepLimit: 4;
  readonly jointFolderRoundLimit: 2;
  readonly jointFolderRounds: number;
  readonly modulesOptimized: number;
  readonly completeCompassAssignmentsEvaluated: number;
  readonly placementCandidatesEvaluated: number;
  readonly localRelocationSweeps: number;
  readonly largeModuleFallbackCount: number;
  readonly moduleMetrics: readonly FocusSchematicInternalLayoutModuleMetrics[];
  readonly metrics: FocusSchematicInternalLayoutQualityMetrics;
  /** Deterministic policy identity for the experimental HIER4B macro layout. */
  readonly softClusterPolicyEvidence?: FocusSchematicSoftClusterPolicyEvidence;
}

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
  /** Categorical HIER4A development/production geometry switch. */
  readonly directionalFolderBandsEnabled: boolean;
  readonly ranker: 'network-simplex' | 'tight-tree' | 'longest-path';
}

export interface FocusSchematicFolderBand {
  readonly folderKey: WorkspaceFolderKey;
  readonly root: boolean;
  readonly order: number;
  readonly topY: number;
  readonly bottomY: number;
  readonly centerY: number;
  readonly height: number;
  readonly moduleIds: readonly EntityId[];
  readonly requiredHeight: number;
  readonly baselineMedianCenterY: number;
  readonly singleton: boolean;
}

export interface FocusSchematicFolderModulePlacement {
  readonly moduleId: EntityId;
  readonly folderKey: WorkspaceFolderKey;
  readonly signedRank: -3 | -2 | -1 | 0 | 1 | 2 | 3;
  readonly baselineCenterY: number;
  readonly preferredBandCenterY: number;
  readonly finalCenterY: number;
  readonly displacementY: number;
  readonly distanceToOwnBand: number;
  readonly status: 'inside-own-band' | 'exception-outside-own-band';
  readonly exceptionId: string | null;
}

export type FocusSchematicFolderBandExceptionReason =
  | 'crossing-guard'
  | 'rank-order-inversion-guard'
  | 'root-anchor'
  | 'unsatisfiable-order-cycle';

export interface FocusSchematicFolderBandException {
  readonly id: string;
  readonly moduleId: EntityId;
  readonly folderKey: WorkspaceFolderKey;
  readonly reason: FocusSchematicFolderBandExceptionReason;
  readonly distanceToOwnBand: number;
  readonly evidence: {
    readonly baselineCrossings: number;
    readonly candidateCrossings: number;
    readonly baselineInversions: number;
    readonly candidateInversions: number;
  };
}

export interface FocusSchematicFolderBandSummary {
  readonly visibleFolderCount: number;
  readonly visibleModuleCount: number;
  readonly satisfiedModuleCount: number;
  readonly exceptionModuleCount: number;
  readonly satisfactionRatio: number | null;
  readonly rootFolderVisibleModuleCount: number;
  readonly filteredExcludedModuleCount: number;
}

export interface FocusSchematicFolderBandRootBalance {
  readonly aboveFolderKeys: readonly WorkspaceFolderKey[];
  readonly belowFolderKeys: readonly WorkspaceFolderKey[];
  /** Packed extent from the root-band boundary, including inter-band gaps. */
  readonly abovePackedExtent: number;
  readonly belowPackedExtent: number;
  readonly packedExtentImbalance: number;
  /** Best height-weighted partition before higher-priority topology guards. */
  readonly bestUnconstrainedImbalance: number;
  readonly topologyOverride: {
    readonly reason: 'crossing-guard' | 'rank-order-inversion-guard';
    readonly attemptedFolderOrder: readonly WorkspaceFolderKey[];
    readonly attemptedPackedExtentImbalance: number;
    readonly evidence: FocusSchematicFolderBandException['evidence'];
  } | null;
}

export interface FocusSchematicFolderBandCandidateMetrics {
  readonly exactEndpointCrossingCount: number;
  readonly adjacentRankOrderInversionCount: number;
  readonly folderBandExceptionModuleCount: number;
  readonly oneSidedRootPenalty: 0 | 1;
  readonly rootBalanceImbalance: number;
  readonly totalPrimaryReferenceVerticalSpan: number;
  readonly meanPrimaryReferenceVerticalSpan: number | null;
  readonly p95PrimaryReferenceVerticalSpan: number | null;
  readonly maximumPrimaryReferenceVerticalSpan: number | null;
  readonly totalExceptionDistanceToOwnBand: number;
  readonly totalModuleDisplacementFromPureA1: number;
  readonly visualSiblingOrderDeviationFromSource: number;
}

export interface FocusSchematicFolderBandCandidateEvidence {
  readonly folderOrder: readonly WorkspaceFolderKey[];
  readonly metrics: FocusSchematicFolderBandCandidateMetrics;
  readonly rejectionReason: string | null;
}

export interface FocusSchematicFolderBandOptimizationEvidence {
  readonly endpointOrderPolicy: FocusSchematicEndpointOrderPolicy;
  readonly internalLayoutVariant: FocusSchematicInternalLayoutVariant;
  readonly jointRoundLimit: 2;
  readonly folderPartitionsEvaluated: number;
  readonly folderOrderCandidatesEvaluated: number;
  readonly candidateLocalHeadingReorderSweeps: number;
  readonly rankOrderSweeps: number;
  readonly jointRounds: number;
  readonly crossingMetricEvaluations: number;
  readonly visuallyReorderedBranchCount: number;
  readonly selectedCandidate: FocusSchematicFolderBandCandidateEvidence;
  readonly nearestRejectedCandidate: FocusSchematicFolderBandCandidateEvidence | null;
}

export interface FocusSchematicFolderBandPlan {
  readonly schemaVersion: typeof FOCUS_SCHEMATIC_FOLDER_BAND_PLAN_SCHEMA_VERSION;
  readonly enabled: boolean;
  readonly rootFolderKey: WorkspaceFolderKey;
  readonly folderOrder: readonly WorkspaceFolderKey[];
  readonly bands: readonly FocusSchematicFolderBand[];
  /** Filtered modules are deliberately omitted to avoid exposing hidden folders. */
  readonly modulePlacements: readonly FocusSchematicFolderModulePlacement[];
  readonly exceptions: readonly FocusSchematicFolderBandException[];
  readonly rootBalance: FocusSchematicFolderBandRootBalance | null;
  readonly optimization: FocusSchematicFolderBandOptimizationEvidence | null;
  readonly summary: FocusSchematicFolderBandSummary;
}

export interface FocusSchematicFolderBandQuality {
  readonly visibleFolderCount: number;
  readonly visibleModuleCount: number;
  readonly folderBandSatisfiedModuleCount: number;
  readonly folderBandExceptionModuleCount: number;
  readonly folderBandSatisfactionRatio: number | null;
  readonly rankFolderFragmentCount: number;
  readonly sameFolderAdjacencyRatioWithinRanks: number | null;
  readonly meanDistanceToOwnBand: number | null;
  readonly p95DistanceToOwnBand: number | null;
  readonly maximumDistanceToOwnBand: number | null;
  readonly totalExceptionDistance: number;
  readonly maximumExceptionDistance: number;
  readonly meanFolderModuleDisplacement: number;
  readonly p95FolderModuleDisplacement: number;
  readonly maximumFolderModuleDisplacement: number;
  /** Includes the fixed root module. */
  readonly rootFolderMeanAbsoluteOffset: number | null;
  readonly baselineExactEndpointCrossingCount: number;
  readonly finalExactEndpointCrossingCount: number;
  readonly baselineAdjacentRankOrderInversionCount: number;
  readonly finalAdjacentRankOrderInversionCount: number;
  readonly baselineMeanEndpointVerticalError: number | null;
  readonly finalMeanEndpointVerticalError: number | null;
  readonly baselineP95EndpointVerticalError: number | null;
  readonly finalP95EndpointVerticalError: number | null;
}

export interface FocusSchematicLayoutInput {
  readonly model: FocusSchematicModel;
  readonly projection: ViewProjection;
  readonly nodeDimensions: readonly FocusSchematicNodeDimension[];
  readonly settings: FocusSchematicPrototypeSettings;
}

export interface FocusSchematicComputedLayoutOptions {
  /** Visual ordering policy. Ignored while Folder Bands are Off. */
  readonly endpointOrderPolicy?: FocusSchematicEndpointOrderPolicy;
  /** Internal layout; Current is retained only for lab comparison evidence. */
  readonly internalLayoutVariant?: FocusSchematicInternalLayoutVariant;
}

/** Normalized development-only HIER4B macro-layout strength in [0, 100]. */
export type FocusSchematicSoftClusterStrength = number;

export interface FocusSchematicSoftFileDisplayParentOverride {
  /** Stable canonical document identity, never a projection node id. */
  readonly fileId: EntityId;
  readonly displayParentFolderKey: WorkspaceFolderKey;
}

/** Sparse workspace intent. Automatic singleton compression is derived. */
export interface FocusSchematicSoftFolderDisplayIntent {
  readonly fileParentOverrides: readonly FocusSchematicSoftFileDisplayParentOverride[];
  readonly flattenedFolderKeys: readonly WorkspaceFolderKey[];
}

export type FocusSchematicSoftFolderPlacementProvenance =
  | 'exact'
  | 'manual-file-promotion'
  | 'manual-folder-flatten'
  | 'automatic-singleton-compression';

export interface FocusSchematicSoftFolderDisplayFile {
  readonly fileId: EntityId;
  readonly exactFolderKey: WorkspaceFolderKey;
  readonly displayParentFolderKey: WorkspaceFolderKey;
  readonly manualDisplayParentFolderKey: WorkspaceFolderKey;
  readonly suppressedAncestorFolderKeys: readonly WorkspaceFolderKey[];
  readonly provenance: readonly FocusSchematicSoftFolderPlacementProvenance[];
}

export interface FocusSchematicSoftFolderDisplayNode {
  readonly folderKey: WorkspaceFolderKey;
  readonly displayParentFolderKey: WorkspaceFolderKey | null;
  readonly directFileIds: readonly EntityId[];
  readonly childFolderKeys: readonly WorkspaceFolderKey[];
  readonly descendantFileIds: readonly EntityId[];
  readonly suppressedAncestorFolderKeys: readonly WorkspaceFolderKey[];
  readonly provenance: readonly FocusSchematicSoftFolderPlacementProvenance[];
}

export interface FocusSchematicSoftFolderDisplayTree {
  readonly rootFolderKey: '.';
  readonly folders: readonly FocusSchematicSoftFolderDisplayNode[];
  readonly files: readonly FocusSchematicSoftFolderDisplayFile[];
  readonly reconciledIntent: FocusSchematicSoftFolderDisplayIntent;
  readonly automaticallyCompressedFolderKeys: readonly WorkspaceFolderKey[];
}

export type FocusSchematicSoftHierarchyForcePolicy =
  'nearest-only' | 'normalized-decay' | 'normalized-equal';

export interface FocusSchematicSoftClusterPolicyEvidence {
  readonly schemaVersion: 2;
  readonly layoutFamily: 'soft-folder-clusters';
  readonly strength: FocusSchematicSoftClusterStrength;
  readonly endpointOrderPolicy: FocusSchematicEndpointOrderPolicy;
  readonly displayIntent: FocusSchematicSoftFolderDisplayIntent;
  readonly hierarchyForcePolicy: FocusSchematicSoftHierarchyForcePolicy;
  readonly fileAttachmentPolicy: 'spatial-cardinal';
}

export interface FocusSchematicSoftClusterOptions {
  readonly strength?: FocusSchematicSoftClusterStrength;
  readonly endpointOrderPolicy?: FocusSchematicEndpointOrderPolicy;
  readonly displayIntent?: FocusSchematicSoftFolderDisplayIntent;
  /** Development-benchmark comparator; production uses normalized-decay. */
  readonly hierarchyForcePolicy?: FocusSchematicSoftHierarchyForcePolicy;
  /** Development-lab comparator; Adaptive Compass is the HIER4B default. */
  readonly internalLayoutVariant?: 'adaptive-compass' | 'vertical-spine';
}

export interface FocusSchematicSoftClusterMetrics {
  readonly repeatedFolderCount: number;
  readonly repeatedFolderModuleCount: number;
  readonly repeatedFolderRmsRadiusMean: number | null;
  readonly repeatedFolderRmsRadiusMedian: number | null;
  readonly repeatedFolderRmsRadiusP95: number | null;
  readonly childFolderCoherenceMean: number | null;
  readonly parentFolderCoherenceMean: number | null;
  readonly connectedPairCount: number;
  readonly connectedPairDistanceMean: number | null;
  readonly connectedPairDistanceP95: number | null;
  readonly exactPrimaryEndpointSpanMean: number | null;
  readonly exactPrimaryEndpointSpanP95: number | null;
  readonly exactEndpointCrossingCount: number;
  readonly hopMeanAbsoluteRadiusError: number | null;
  readonly hopRadiusCorrelation: number | null;
  readonly boundsWidth: number;
  readonly boundsHeight: number;
  readonly boundsArea: number;
  readonly overlapCount: number;
  readonly minimumModuleGap: number | null;
}

export interface FocusSchematicSoftClusterRuntimeEvidence {
  readonly moduleCount: number;
  readonly primaryPairCount: number;
  readonly repeatedFolderCount: number;
  readonly iterationCount: 54;
  readonly jointRoundCount: 2;
  readonly compassAssignmentCount: number;
  readonly compassBranchRegionChurn: number;
  readonly collisionCheckCount: number;
  readonly collisionCorrectionCount: number;
  readonly layoutMs: number;
}

export interface FocusSchematicSoftClusterEvidence {
  readonly schemaVersion: 2;
  readonly developmentOnly: true;
  readonly layoutFamily: 'soft-folder-clusters';
  readonly strength: FocusSchematicSoftClusterStrength;
  readonly endpointOrderPolicy: FocusSchematicEndpointOrderPolicy;
  readonly fileParentOverrideCount: number;
  readonly flattenedFolderCount: number;
  readonly displayedFolderCount: number;
  readonly automaticallyCompressedFolderCount: number;
  readonly maximumDisplayedDepth: number;
  readonly hierarchyForcePolicy: FocusSchematicSoftHierarchyForcePolicy;
  readonly maximumPerFileFolderWeight: number;
  readonly fileAttachmentPolicy: 'spatial-cardinal';
  readonly folderInfluenceEnabled: boolean;
  readonly topologyDirectionality: 'undirected-primary';
  readonly secondaryGeometryInfluence: 0;
  readonly fixedIterationSchedule: readonly [36, 18];
  readonly metrics: FocusSchematicSoftClusterMetrics;
  readonly runtime: FocusSchematicSoftClusterRuntimeEvidence;
}

export type FocusSchematicSoftClusterLayoutAttempt =
  | {
      readonly status: 'success';
      readonly strategyId: 'HIER4B-soft-folder-clusters';
      readonly configId: string;
      readonly result: FocusSchematicComputedLayout;
      readonly evidence: FocusSchematicSoftClusterEvidence;
      readonly timings: FocusSchematicEndpointLayoutPhaseTimings;
    }
  | {
      readonly status: 'failure';
      readonly strategyId: 'HIER4B-soft-folder-clusters';
      readonly configId: string;
      readonly reason: string;
    };

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
  /** Precise selected-backbone/Focus-path straight-segment crossings. */
  readonly exactEndpointCrossingCount: number;
  /** Ordering inversions limited to connections between adjacent signed ranks. */
  readonly adjacentRankOrderInversionCount: number;
  readonly adjacentRankOrderingConnectionCount: number;
  readonly meanPreciseEndpointVerticalError: number | null;
  readonly p95PreciseEndpointVerticalError: number | null;
}

export interface FocusSchematicComputedLayout {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly modulePlan: FocusSchematicLayoutPlan;
  readonly endpointPlan: FocusSchematicEndpointPlan;
  readonly internalLanePlan: FocusSchematicInternalLanePlan;
  readonly folderBandPlan: FocusSchematicFolderBandPlan;
  readonly folderBandQuality: FocusSchematicFolderBandQuality;
  readonly internalLayoutEvidence: FocusSchematicInternalLayoutEvidence;
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
  readonly internalVariantMs: number;
  readonly macroMs: number;
  readonly crossingMinimizationMs: number;
  readonly folderInventoryMs: number;
  readonly folderInitialOrderMs: number;
  readonly folderOrderRefinementMs: number;
  readonly folderRankOrderingMs: number;
  readonly folderBandPackingMs: number;
  readonly folderModuleAssignmentMs: number;
  readonly folderExceptionAnalysisMs: number;
  readonly folderQualityMs: number;
  readonly attachmentMs: number;
  readonly qualityMs: number;
  readonly validationMs: number;
  readonly serializationMs: number;
  readonly totalMs: number;
  readonly dagreCallCount: number;
  readonly inputSerializedBytes: number;
  readonly outputSerializedBytes: number;
  readonly endpointLaneSerializedBytes: number;
  readonly folderBandSerializedBytes: number;
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
