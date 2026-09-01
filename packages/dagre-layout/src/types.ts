export type DagreLayoutMode = 'structure' | 'focus' | 'local-structured';

export interface DagreLayoutNode {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export interface DagreLayoutEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: 'hierarchy' | 'reference';
}

export interface DagreLayoutInput {
  readonly mode: DagreLayoutMode;
  readonly nodes: readonly DagreLayoutNode[];
  readonly edges: readonly DagreLayoutEdge[];
}

export interface DagreLayoutPosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface DagreLayoutOutput {
  readonly positions: readonly DagreLayoutPosition[];
}

export const DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION = 1 as const;

export interface DagreLayoutWorkerRequest {
  readonly protocolVersion: typeof DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION;
  readonly requestId: number;
  readonly kind: 'layout';
  readonly input: DagreLayoutInput;
}

export interface DagreLayoutWorkerSuccess {
  readonly protocolVersion: typeof DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION;
  readonly requestId: number;
  readonly kind: 'success';
  readonly output: DagreLayoutOutput;
  readonly computeMs: number;
}

export interface DagreLayoutWorkerFailure {
  readonly protocolVersion: typeof DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION;
  readonly requestId: number;
  readonly kind: 'failure';
  readonly code: 'invalid-request' | 'invalid-input' | 'computation-failed';
  readonly message: string;
  readonly computeMs: number;
}

export type DagreLayoutWorkerResponse =
  DagreLayoutWorkerSuccess | DagreLayoutWorkerFailure;
