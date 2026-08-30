export interface ForceAtlas2WorkerNode {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface ForceAtlas2WorkerEdge {
  readonly key: string;
  readonly source: string;
  readonly target: string;
  readonly weight: number;
}

export interface ForceAtlas2WorkerRequest {
  readonly kind: 'layout';
  readonly requestId: number;
  readonly iterations: number;
  readonly nodes: readonly ForceAtlas2WorkerNode[];
  readonly edges: readonly ForceAtlas2WorkerEdge[];
}

export interface ForceAtlas2WorkerSuccess {
  readonly kind: 'result';
  readonly requestId: number;
  readonly computeMs: number;
  readonly positions: readonly {
    readonly key: string;
    readonly x: number;
    readonly y: number;
  }[];
}

export interface ForceAtlas2WorkerFailure {
  readonly kind: 'error';
  readonly requestId: number;
  readonly message: string;
}

export type ForceAtlas2WorkerResponse =
  ForceAtlas2WorkerSuccess | ForceAtlas2WorkerFailure;
