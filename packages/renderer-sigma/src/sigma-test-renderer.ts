import type { MultiDirectedGraph } from 'graphology';
import { vi } from 'vitest';

type Attributes = Record<string, unknown>;
type Refresh = {
  partialGraph?: { nodes?: string[]; edges?: string[] };
  skipIndexation?: boolean;
  schedule?: boolean;
};

/** Models Sigma 3's reducer cache and process boundary, not WebGL pixels. */
export class SigmaTestRenderer {
  static instances: SigmaTestRenderer[] = [];
  readonly displayNodes = new Map<string, Attributes>();
  private onceHandlers = new Map<string, (() => void)[]>();
  readonly handlers = new Map<string, (event: unknown) => void>();
  readonly camera = {
    ratio: 1,
    x: 0.5,
    y: 0.5,
    on: vi.fn(),
    off: vi.fn(),
    getState: () => ({
      ratio: this.camera.ratio,
      x: this.camera.x,
      y: this.camera.y,
    }),
    setState: vi.fn((value: object) => Object.assign(this.camera, value)),
  };
  readonly captor = { on: vi.fn(), off: vi.fn() };
  deferProcess = false;
  private fullRefreshPending = false;
  readonly refresh = vi.fn((options?: Refresh) => {
    const keys = options?.partialGraph?.nodes ?? this.graph.nodes();
    for (const key of keys) {
      if (!this.graph.hasNode(key))
        throw new Error(`Stale Sigma refresh: ${key}`);
      this.displayNodes.set(
        key,
        this.settings.nodeReducer(key, this.graph.getNodeAttributes(key)),
      );
    }
    if (!this.deferProcess) this.finishProcess();
  });
  readonly scheduleRefresh = vi.fn(() => {
    this.fullRefreshPending = true;
    if (!this.deferProcess) this.finishProcess();
  });
  readonly scheduleRender = vi.fn();
  readonly setSetting = vi.fn();
  readonly kill = vi.fn();
  constructor(
    readonly graph: MultiDirectedGraph,
    _container: HTMLElement,
    readonly settings: {
      nodeReducer: (key: string, attributes: Attributes) => Attributes;
    },
  ) {
    SigmaTestRenderer.instances.push(this);
  }
  finishProcess(): void {
    if (this.fullRefreshPending) {
      this.fullRefreshPending = false;
      this.displayNodes.clear();
      this.graph.forEachNode((key, attributes) =>
        this.displayNodes.set(key, this.settings.nodeReducer(key, attributes)),
      );
    }
    for (const event of ['afterProcess', 'afterRender']) {
      const handlers = this.onceHandlers.get(event) ?? [];
      this.onceHandlers.delete(event);
      for (const handler of handlers) handler();
    }
  }
  once(event: string, callback: () => void): void {
    this.onceHandlers.set(event, [
      ...(this.onceHandlers.get(event) ?? []),
      callback,
    ]);
  }
  on(event: string, callback: (event: unknown) => void): void {
    this.handlers.set(event, callback);
  }
  getCamera() {
    return this.camera;
  }
  getMouseCaptor() {
    return this.captor;
  }
  getNodeDisplayData(key: string) {
    return this.displayNodes.get(key);
  }
  getGraphDimensions() {
    return { width: 1, height: 1 };
  }
  getDimensions() {
    return { width: 800, height: 600 };
  }
  framedGraphToViewport(point: { x: number; y: number }) {
    return point;
  }
  viewportToFramedGraph(point: { x: number; y: number }) {
    return point;
  }
  viewportToGraph(point: { x: number; y: number }) {
    return point;
  }
}
