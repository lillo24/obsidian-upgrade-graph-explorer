import type {
  ProjectionNodeId,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

export type LocalNodeKind = 'document' | 'section' | 'block' | 'diagnostic';
export type LocalVisualLod = 'far-local' | 'normal-local' | 'near-local';
export type LocalEdgeKind = 'hierarchy' | 'reference';

export interface LocalNodeAttributes {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly color: string;
  readonly label: string;
  readonly nodeKind: LocalNodeKind;
  readonly entityId: string | null;
  readonly sourcePath: string | null;
  readonly status: 'resolved' | 'unresolved' | 'ambiguous' | 'invalid' | null;
  readonly root: boolean;
  readonly revealableDescendantCount: number;
}

export interface LocalEdgeAttributes {
  readonly size: number;
  readonly color: string;
  readonly edgeKind: LocalEdgeKind;
  readonly weight: number;
  readonly referenceCount: number;
}

export interface LocalInputNode {
  readonly key: ProjectionNodeId;
  readonly attributes: LocalNodeAttributes;
}

export interface LocalInputEdge {
  readonly key: string;
  readonly source: ProjectionNodeId;
  readonly target: ProjectionNodeId;
  readonly attributes: LocalEdgeAttributes;
}

export interface LocalRendererInput {
  readonly rootNodeKey: ProjectionNodeId;
  readonly nodes: readonly LocalInputNode[];
  readonly edges: readonly LocalInputEdge[];
  readonly projectionIssues: ViewProjection['issues'];
}

export interface LocalGraphReconciliation {
  readonly nodesAdded: number;
  readonly nodesUpdated: number;
  readonly nodesRemoved: number;
  readonly edgesAdded: number;
  readonly edgesUpdated: number;
  readonly edgesRemoved: number;
}

export interface SemanticLocalViewport {
  readonly anchorEntityId: string;
  readonly freeRatio: number;
}

export interface LocalViewportPoint {
  readonly x: number;
  readonly y: number;
}

export interface LocalCenterRequest {
  readonly key: number;
  readonly nodeId: ProjectionNodeId;
  readonly freeRatio: number;
}

export interface LocalSelection {
  readonly kind: 'node' | 'edge';
  readonly id: string;
}

export interface LocalLayoutSettings {
  readonly hierarchyWeight: number;
  readonly referenceWeight: number;
  readonly scalingRatio: number;
}

export interface LocalLayoutNode {
  readonly key: string;
  readonly kind: LocalNodeKind;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface LocalLayoutEdge {
  readonly key: string;
  readonly source: string;
  readonly target: string;
  readonly kind: LocalEdgeKind;
  readonly weight: number;
}

export interface LocalLayoutRequest {
  readonly schemaVersion: 1;
  readonly requestId: number;
  readonly rootKey: string;
  readonly iterations: number;
  readonly settings: LocalLayoutSettings;
  readonly nodes: readonly LocalLayoutNode[];
  readonly edges: readonly LocalLayoutEdge[];
}

export interface LocalLayoutPosition {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

export interface LocalLayoutResult {
  readonly schemaVersion: 1;
  readonly kind: 'result';
  readonly requestId: number;
  readonly computeMs: number;
  readonly positions: readonly LocalLayoutPosition[];
}

export interface LocalLayoutFailure {
  readonly schemaVersion: 1;
  readonly kind: 'error';
  readonly requestId: number;
  readonly message: string;
}

export type LocalLayoutWorkerResponse = LocalLayoutResult | LocalLayoutFailure;

export interface LocalLayoutService {
  readonly layout: (
    request: Omit<LocalLayoutRequest, 'requestId'>,
  ) => Promise<LocalLayoutResult>;
  readonly dispose: () => void;
}

export type LocalPerformancePhase =
  | 'local-map'
  | 'local-seed'
  | 'local-sigma-mount'
  | 'local-layout-worker'
  | 'local-layout-apply'
  | 'local-visual-lod'
  | 'local-hover'
  | 'local-selection'
  | 'local-center';

export type LocalPerformanceOperation =
  | 'local-mappings'
  | 'local-seeds'
  | 'local-topology-reconciliations'
  | 'local-layouts'
  | 'local-style-updates'
  | 'local-hover-applications'
  | 'local-selection-applications'
  | 'local-centers';

export interface LocalRendererInstrumentation {
  readonly count: (
    operation: LocalPerformanceOperation,
    amount?: number,
  ) => void;
  readonly measure: <Value>(
    phase: LocalPerformancePhase,
    operation: LocalPerformanceOperation | undefined,
    run: () => Value,
  ) => Value;
  readonly record: (phase: LocalPerformancePhase, durationMs: number) => void;
}

export type LocalTrackpadZoomMode = 'scroll-zoom' | 'pinch-zoom';

export interface LocalTransitionAnchor {
  readonly key: number;
  readonly nodeId: ProjectionNodeId;
  readonly point: LocalViewportPoint;
  readonly zoom?: number;
}

export interface LocalTransitionAnchorApi {
  readonly nodeViewportPoint: (
    nodeId: ProjectionNodeId,
  ) => LocalViewportPoint | undefined;
}
