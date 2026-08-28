import type { Edge, Node, XYPosition } from '@xyflow/react';
import type {
  DiagnosticReferenceStatus,
  ProjectionEdgeId,
  ProjectionNodeId,
  ReferenceResolutionStatus,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

export type GraphLayoutMode = 'structure' | 'focus';

export type TrackpadZoomMode = 'scroll-zoom' | 'pinch-zoom';

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
  readonly detail: string;
  readonly sourcePath: string;
  readonly sourceStartLine: number;
  readonly role: 'content' | 'context';
  readonly focusDistance: number | null;
  readonly hasHiddenChildren: boolean;
  readonly hiddenDescendantCount: number;
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
  readonly expandedEntityIds?: readonly string[];
  readonly layoutEngine?: LayoutEngine;
}

export interface LayoutInputNode {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export interface LayoutInputEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: 'hierarchy' | 'reference';
}

export interface LayoutEngineInput {
  readonly mode: GraphLayoutMode;
  readonly nodes: readonly LayoutInputNode[];
  readonly edges: readonly LayoutInputEdge[];
}

export type LayoutEngine = (
  input: LayoutEngineInput,
) => ReadonlyMap<string, XYPosition>;

export interface GraphCanvasProps {
  readonly projection: ViewProjection;
  readonly layoutMode: GraphLayoutMode;
  readonly expandedEntityIds: readonly string[];
  readonly selection: GraphSelection | null;
  readonly fitRequestKey: number;
  readonly centerRequest?: GraphCenterRequest;
  readonly maximized?: boolean;
  readonly trackpadZoomMode: TrackpadZoomMode;
  readonly onMaximizedChange?: (maximized: boolean) => void;
  readonly onViewportObservation?: (
    observation: GraphViewportObservation,
  ) => void;
  readonly onSelectionChange: (selection: GraphSelection | null) => void;
  readonly onToggleEntity: (entityId: string, currentlyOpen: boolean) => void;
}
