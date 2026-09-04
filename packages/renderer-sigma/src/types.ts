import type {
  ProjectionNodeId,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

export type GlobalNodeKind = 'document' | 'diagnostic';
export type GlobalReferenceStatus =
  'resolved' | 'unresolved' | 'ambiguous' | 'invalid';
export type GlobalVisualLod = 'far' | 'regional' | 'near';
export type GlobalSpacingPreset = 'compact' | 'normal' | 'spacious';
export type GlobalFolderPriorAlgorithm =
  'reference-only' | 'chunked-prior' | 'offset-field';
export type GlobalTrackpadZoomMode = 'scroll-zoom' | 'pinch-zoom';

export interface GlobalLayoutCustomSettings {
  readonly linkForce: number;
  readonly folderCohesion: number;
  readonly withinFolderSpacing: number;
  readonly betweenFolderSpacing: number;
  readonly nodeSize: number;
  readonly referenceDegreeSizeInfluence: number;
  readonly linkThickness: number;
  readonly labelThreshold: number;
}

/** Serializable graph preference; never canonical or renderer-instance state. */
export interface GlobalLayoutSettings {
  readonly folderClustering: boolean;
  readonly spacingPreset: GlobalSpacingPreset;
  readonly custom?: GlobalLayoutCustomSettings;
}

export interface ResolvedGlobalLayoutSettings extends GlobalLayoutCustomSettings {
  readonly folderClustering: boolean;
  readonly spacingPreset: GlobalSpacingPreset;
}

/** Resolved values currently consumed by Global automatic coordinate physics. */
export interface ResolvedGlobalPhysicsSettings {
  readonly folderClustering: boolean;
  readonly folderCohesion: number;
  readonly linkForce: number;
  readonly withinFolderSpacing: number;
  readonly betweenFolderSpacing: number;
}

/** Resolved values consumed only by Sigma presentation reducers/settings. */
export interface ResolvedGlobalVisualSettings {
  readonly nodeSize: number;
  readonly referenceDegreeSizeInfluence: number;
  readonly linkThickness: number;
  readonly labelThreshold: number;
}

/** Product-level controls shared by both Sigma Network renderers. */
export interface ResolvedNetworkSettings {
  readonly referencePull: number;
  readonly nodeSize: number;
  readonly linkThickness: number;
  readonly labelThreshold: number;
}

export interface GlobalNodeAttributes {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly color: string;
  readonly label: string;
  readonly nodeKind: GlobalNodeKind;
  readonly entityId: string | null;
  readonly sourcePath: string | null;
  readonly status: GlobalReferenceStatus | null;
  readonly folderKey: string | null;
  readonly revealableDescendantCount: number;
}

export interface GlobalEdgeAttributes {
  readonly size: number;
  readonly color: string;
  readonly edgeKind: 'reference';
  readonly status: GlobalReferenceStatus;
  readonly referenceCount: number;
}

export interface GlobalInputNode {
  readonly key: ProjectionNodeId;
  readonly attributes: GlobalNodeAttributes;
}

export interface GlobalInputEdge {
  readonly key: string;
  readonly source: ProjectionNodeId;
  readonly target: ProjectionNodeId;
  readonly attributes: GlobalEdgeAttributes;
}

export interface GlobalSpatialMetadata {
  readonly folderKeyByProjectionNodeId: ReadonlyMap<ProjectionNodeId, string>;
}

export interface GlobalRendererInput {
  readonly nodes: readonly GlobalInputNode[];
  readonly edges: readonly GlobalInputEdge[];
  readonly projectionIssues: ViewProjection['issues'];
}

export interface GlobalGraphReconciliation {
  readonly nodesAdded: number;
  readonly nodesUpdated: number;
  readonly nodesRemoved: number;
  readonly edgesAdded: number;
  readonly edgesUpdated: number;
  readonly edgesRemoved: number;
}

export interface SemanticGlobalViewport {
  readonly anchorEntityId: string;
  /** Sigma camera ratio. Raw camera coordinates are deliberately excluded. */
  readonly ratio: number;
}

export interface GlobalCenterRequest {
  readonly key: number;
  readonly nodeId: ProjectionNodeId;
  readonly ratio: number;
}

export interface GlobalViewportPoint {
  readonly x: number;
  readonly y: number;
}

/** Temporary, runtime-only SPACING1B-GLOBAL native-QA evidence. */
export interface GlobalDensityQaDiagnostics {
  readonly rawDecisionRatio: number;
  readonly effectiveRatio: number;
  readonly cameraRatio: number;
  readonly fallback: boolean;
  readonly fallbackReason?: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly isolatedNodeCount: number;
}

/** Narrow runtime bridge used only for the Global → Local screen anchor. */
export interface GlobalTransitionAnchorApi {
  readonly nodeViewportPoint: (
    nodeId: ProjectionNodeId,
  ) => GlobalViewportPoint | undefined;
}

export interface GlobalSelection {
  readonly kind: 'node' | 'edge';
  readonly id: string;
}

export interface GlobalLayoutNode {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly folderKey?: string;
}

export interface GlobalLayoutEdge {
  readonly key: string;
  readonly source: string;
  readonly target: string;
  readonly weight: number;
}

export interface GlobalLayoutRequest {
  readonly schemaVersion: 1;
  readonly requestId: number;
  readonly algorithm: GlobalFolderPriorAlgorithm;
  readonly iterations: number;
  readonly settings: GlobalLayoutSettings;
  readonly nodes: readonly GlobalLayoutNode[];
  readonly edges: readonly GlobalLayoutEdge[];
}

export interface GlobalLayoutPosition {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

export interface GlobalFolderPriorMetrics {
  readonly meanWithinFolderDistance: number;
  readonly meanCrossFolderDistance: number;
  readonly meanCrossFolderReferenceLength: number;
  readonly meanDisplacementFromInput: number;
}

export interface GlobalLayoutResult {
  readonly schemaVersion: 1;
  readonly kind: 'result';
  readonly requestId: number;
  readonly algorithm: GlobalFolderPriorAlgorithm;
  readonly computeMs: number;
  readonly folderPriorMs: number;
  readonly positions: readonly GlobalLayoutPosition[];
  readonly metrics: GlobalFolderPriorMetrics;
}

export interface GlobalLayoutFailure {
  readonly schemaVersion: 1;
  readonly kind: 'error';
  readonly requestId: number;
  readonly message: string;
}

export type GlobalLayoutWorkerResponse =
  GlobalLayoutResult | GlobalLayoutFailure;

export interface GlobalLayoutService {
  readonly layout: (
    request: Omit<GlobalLayoutRequest, 'requestId'>,
  ) => Promise<GlobalLayoutResult>;
  readonly dispose: () => void;
}

export type GlobalSpatialInfluenceAlgorithm =
  'interleaved-centroid' | 'move-then-relax';

export interface GlobalSpatialInfluenceAttractor {
  readonly ruleFolderKey: string;
  readonly memberNodeKeys: readonly string[];
  readonly targetX: number;
  readonly targetY: number;
  readonly strength: number;
}

export interface GlobalSpatialInfluenceRequest {
  readonly schemaVersion: 1;
  readonly requestId: number;
  readonly algorithm: GlobalSpatialInfluenceAlgorithm;
  readonly algorithmVersion: 1;
  readonly baseLayoutFingerprint: string;
  readonly iterations: number;
  readonly nodes: readonly GlobalLayoutNode[];
  readonly edges: readonly GlobalLayoutEdge[];
  readonly attractors: readonly GlobalSpatialInfluenceAttractor[];
  readonly globalLayoutSettings: GlobalLayoutSettings;
}

export interface GlobalSpatialInfluenceMetrics {
  readonly meanTargetError: number;
  readonly maxTargetError: number;
  readonly meanAffectedDisplacement: number;
  readonly meanUnaffectedDisplacement: number;
  readonly meanCrossBoundaryReferenceLength: number;
  readonly meanReferenceLength: number;
}

export interface GlobalSpatialInfluenceResult {
  readonly schemaVersion: 1;
  readonly kind: 'result';
  readonly requestId: number;
  readonly algorithm: GlobalSpatialInfluenceAlgorithm;
  readonly computeMs: number;
  readonly forceAtlasMs: number;
  readonly attractorMs: number;
  readonly positions: readonly GlobalLayoutPosition[];
  readonly metrics: GlobalSpatialInfluenceMetrics;
}

export interface GlobalSpatialInfluenceFailure {
  readonly schemaVersion: 1;
  readonly kind: 'error';
  readonly requestId: number;
  readonly message: string;
}

export type GlobalSpatialInfluenceWorkerResponse =
  GlobalSpatialInfluenceResult | GlobalSpatialInfluenceFailure;

export interface GlobalSpatialInfluenceService {
  readonly layout: (
    request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>,
  ) => Promise<GlobalSpatialInfluenceResult>;
  readonly dispose: () => void;
}

export interface GlobalOperationCounts {
  readonly projections: number;
  readonly topologyReconciliations: number;
  readonly layoutRequests: number;
  readonly spatialCompositions: number;
  readonly spatialApplies: number;
  readonly visualLodChanges: number;
}

/** Aggregate diagnostic-harness evidence; no graph identifiers are retained. */
export interface GlobalRendererMeasurement {
  readonly operation: string;
  readonly durationMs: number;
  readonly highRafGapMs?: number;
}

export type GlobalPerformancePhase =
  | 'global-map'
  | 'graphology-reconcile'
  | 'global-layout-worker'
  | 'folder-prior'
  | 'layout-apply'
  | 'spatial-compose'
  | 'spatial-apply'
  | 'spatial-preview-apply'
  | 'spatial-rule-draft-resolution'
  | 'spatial-scope-visualization'
  | 'spatial-rigid-preview'
  | 'spatial-rule-persist'
  | 'spatial-pull-settle'
  | 'spatial-rule-resolution'
  | 'spatial-pull-request'
  | 'spatial-pull-worker'
  | 'spatial-pull-forceatlas'
  | 'spatial-pull-attractor'
  | 'spatial-pull-cache-hit'
  | 'spatial-fixed-compose'
  | 'sigma-mount-render'
  | 'semantic-zoom-style'
  | 'global-hover'
  | 'global-selection'
  | 'global-center'
  | 'global-density'
  | 'file-move';

export type GlobalPerformanceOperation =
  | 'global-mappings'
  | 'graphology-reconciliations'
  | 'global-layouts'
  | 'spatial-compositions'
  | 'spatial-applies'
  | 'spatial-preview-applies'
  | 'spatial-rule-resolutions'
  | 'spatial-pull-requests'
  | 'spatial-pull-cache-hits'
  | 'spatial-fixed-compositions'
  | 'global-style-updates'
  | 'global-hover-applications'
  | 'global-selection-applications'
  | 'global-centers'
  | 'global-density-evaluations'
  | 'file-move-primes'
  | 'file-move-begins'
  | 'file-move-coalesced-updates'
  | 'file-move-releases'
  | 'file-move-cancels'
  | 'file-move-unavailable-attempts';

/** Aggregate-only optional hooks supplied by the application boundary. */
export interface GlobalRendererInstrumentation {
  readonly count: (
    operation: GlobalPerformanceOperation,
    amount?: number,
  ) => void;
  readonly measure: <Value>(
    phase: GlobalPerformancePhase,
    operation: GlobalPerformanceOperation | undefined,
    run: () => Value,
  ) => Value;
  readonly record: (phase: GlobalPerformancePhase, durationMs: number) => void;
}

export type * from './local-types';
