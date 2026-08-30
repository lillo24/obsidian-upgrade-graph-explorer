import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

export type GlobalNodeKind = 'document' | 'section' | 'block' | 'diagnostic';
export type GlobalReferenceStatus =
  'resolved' | 'unresolved' | 'ambiguous' | 'invalid';

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
  readonly revealableDescendantCount: number;
}

export interface GlobalEdgeAttributes {
  readonly size: number;
  readonly color: string;
  readonly edgeKind: 'hierarchy' | 'reference';
  readonly status: GlobalReferenceStatus;
  readonly referenceCount: number;
}

export interface GlobalInputNode {
  readonly key: string;
  readonly attributes: GlobalNodeAttributes;
}

export interface GlobalInputEdge {
  readonly key: string;
  readonly source: string;
  readonly target: string;
  readonly attributes: GlobalEdgeAttributes;
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
  /** Sigma camera ratio; renderer-local until a cross-renderer schema is designed. */
  readonly ratio: number;
}

export interface GlobalRendererMeasurement {
  readonly operation: string;
  readonly durationMs: number;
  readonly highRafGapMs?: number;
}
