import type { Edge, Node } from '@xyflow/react';
import type {
  DagreLayoutInput,
  DagreLayoutMode,
  DagreLayoutOutput,
} from '@icarus-graph-explorer/dagre-layout';
import type { PerformanceInstrumentation } from '@icarus-graph-explorer/performance';
import type {
  DiagnosticReferenceStatus,
  ProjectionEdgeId,
  ProjectionNodeId,
  ReferenceResolutionStatus,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

export type GraphLayoutMode = DagreLayoutMode;

export type TrackpadZoomMode = 'scroll-zoom' | 'pinch-zoom';

export type FocusAppearance = 'outline' | 'inverted' | 'minimal';

export type GraphSelection =
  | { readonly kind: 'node'; readonly id: ProjectionNodeId }
  | { readonly kind: 'edge'; readonly id: ProjectionEdgeId };

export interface GraphCenterRequest {
  readonly key: number;
  readonly nodeId: ProjectionNodeId;
  readonly zoom?: number;
}

export interface GraphViewportObservation {
  readonly anchorEntityId: string | null;
  readonly zoom: number;
}

export interface EntityNodeData extends Record<string, unknown> {
  readonly projectionNodeId: ProjectionNodeId;
  readonly entityId: string;
  readonly entityKind: 'document' | 'section' | 'block';
  readonly typeLabel: 'File' | 'Heading' | 'Block';
  readonly title: string;
  readonly detail: string | null;
  readonly sourcePath: string;
  readonly sourceStartLine: number;
  readonly role: 'content' | 'context';
  readonly focusDistance: number | null;
  readonly revealableDescendantCount: number;
  readonly visibleDescendantCount: number;
  readonly isExpanded: boolean;
  readonly internalReferenceCount: number;
  readonly ariaLabel: string;
}

export interface DiagnosticNodeData extends Record<string, unknown> {
  readonly projectionNodeId: ProjectionNodeId;
  readonly status: DiagnosticReferenceStatus;
  readonly rawTarget: string;
  readonly referenceCount: number;
  readonly candidateCount: number;
  readonly reasonCount: number;
  readonly ariaLabel: string;
}

export interface GraphEdgeData extends Record<string, unknown> {
  readonly projectionEdgeId: ProjectionEdgeId;
  readonly kind: 'hierarchy' | 'reference';
  readonly status: ReferenceResolutionStatus | null;
  readonly referenceCount: number;
  readonly ariaLabel: string;
}

export type EntityFlowNode = Node<EntityNodeData, 'entity'>;
export type DiagnosticFlowNode = Node<DiagnosticNodeData, 'diagnostic'>;
export type GraphFlowNode = EntityFlowNode | DiagnosticFlowNode;
export type GraphFlowEdge = Edge<GraphEdgeData, 'graph'>;

export interface RendererGraph {
  readonly nodes: readonly GraphFlowNode[];
  readonly edges: readonly GraphFlowEdge[];
  readonly layoutWarning: string | null;
}

export interface PrepareRendererGraphOptions {
  readonly layoutMode: GraphLayoutMode;
  readonly layoutEngine?: LayoutEngine;
  /** Optional KG12 runtime-only measurements; omitted in normal product use. */
  readonly performance?: PerformanceInstrumentation;
}

export type LayoutEngine = (input: DagreLayoutInput) => DagreLayoutOutput;

export interface GraphLayoutMetrics {
  readonly workerComputeMs: number;
  readonly workerRoundTripMs: number;
  readonly workerStartupMs: number;
  readonly mainThreadHighGapMs?: number;
}

export type GraphLayoutResult =
  | {
      readonly status: 'success';
      readonly output: DagreLayoutOutput;
      readonly metrics: GraphLayoutMetrics;
    }
  | {
      readonly status: 'failure';
      readonly message: string;
      readonly metrics: GraphLayoutMetrics;
    }
  | { readonly status: 'superseded' };

export interface GraphLayoutService {
  readonly layoutLatest: (
    input: DagreLayoutInput,
  ) => Promise<GraphLayoutResult>;
  readonly cancelPending: () => void;
  readonly dispose: () => void;
}

export interface GraphCanvasProps {
  readonly projection: ViewProjection;
  readonly layoutService: GraphLayoutService;
  readonly layoutMode: GraphLayoutMode;
  readonly focusAppearance: FocusAppearance;
  readonly selection: GraphSelection | null;
  /** Disabled by default and never persisted by the renderer. */
  readonly performance?: PerformanceInstrumentation;
  /** Runtime-only token used to correlate a live adoption through paint. */
  readonly performanceUpdateKey?: string;
  readonly fitRequestKey: number;
  readonly centerRequest?: GraphCenterRequest;
  readonly maximized?: boolean;
  readonly trackpadZoomMode: TrackpadZoomMode;
  readonly onMaximizedChange?: (maximized: boolean) => void;
  readonly onViewportObservation?: (
    observation: GraphViewportObservation,
  ) => void;
  readonly onSelectionChange: (selection: GraphSelection | null) => void;
  readonly onFocusEntity: (entityId: string) => void;
  readonly onToggleEntity: (entityId: string, currentlyOpen: boolean) => void;
}
