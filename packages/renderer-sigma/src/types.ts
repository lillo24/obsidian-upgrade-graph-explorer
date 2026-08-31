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

export interface GlobalOperationCounts {
  readonly projections: number;
  readonly topologyReconciliations: number;
  readonly layoutRequests: number;
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
  | 'sigma-mount-render'
  | 'semantic-zoom-style'
  | 'global-hover'
  | 'global-selection'
  | 'global-center';

export type GlobalPerformanceOperation =
  | 'global-mappings'
  | 'graphology-reconciliations'
  | 'global-layouts'
  | 'global-style-updates'
  | 'global-hover-applications'
  | 'global-selection-applications'
  | 'global-centers';

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
