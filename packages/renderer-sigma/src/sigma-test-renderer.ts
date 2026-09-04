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
  readonly displayEdges = new Map<string, Attributes>();
  private onceHandlers = new Map<string, (() => void)[]>();
  readonly handlers = new Map<string, (event: unknown) => void>();
  readonly camera = {
    ratio: 1,
    x: 0.5,
    y: 0.5,
    angle: 0,
    on: vi.fn(),
    off: vi.fn(),
    getState: () => ({
      ratio: this.camera.ratio,
      x: this.camera.x,
      y: this.camera.y,
      angle: this.camera.angle,
    }),
    setState: vi.fn((value: object) => Object.assign(this.camera, value)),
    animate: vi.fn(async (value: object) => {
      Object.assign(this.camera, value);
    }),
    animatedReset: vi.fn(async () => {
      Object.assign(this.camera, { ratio: 1, x: 0.5, y: 0.5, angle: 0 });
    }),
  };
  readonly captor = { on: vi.fn(), off: vi.fn(), isMouseDown: false };
  readonly touchCaptor = { on: vi.fn(), off: vi.fn() };
  deferProcess = false;
  private fullRefreshPending = false;
  readonly refresh = vi.fn((options?: Refresh) => {
    const keys =
      options?.partialGraph === undefined
        ? this.graph.nodes()
        : (options.partialGraph.nodes ?? []);
    for (const key of keys) {
      if (!this.graph.hasNode(key))
        throw new Error(`Stale Sigma refresh: ${key}`);
      this.displayNodes.set(
        key,
        this.settings.nodeReducer(key, this.graph.getNodeAttributes(key)),
      );
    }
    const edgeKeys =
      options?.partialGraph === undefined
        ? this.graph.edges()
        : (options.partialGraph.edges ?? []);
    for (const key of edgeKeys) {
      if (!this.graph.hasEdge(key))
        throw new Error(`Stale Sigma edge refresh: ${key}`);
      this.displayEdges.set(
        key,
        this.settings.edgeReducer?.(key, this.graph.getEdgeAttributes(key)) ??
          this.graph.getEdgeAttributes(key),
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
      edgeReducer?: (key: string, attributes: Attributes) => Attributes;
    },
  ) {
    SigmaTestRenderer.instances.push(this);
    this.graph.forEachNode((key, attributes) =>
      this.displayNodes.set(key, this.settings.nodeReducer(key, attributes)),
    );
  }
  finishProcess(): void {
    if (this.fullRefreshPending) {
      this.fullRefreshPending = false;
      this.displayNodes.clear();
      this.displayEdges.clear();
      this.graph.forEachNode((key, attributes) =>
        this.displayNodes.set(key, this.settings.nodeReducer(key, attributes)),
      );
      this.graph.forEachEdge((key, attributes) =>
        this.displayEdges.set(
          key,
          this.settings.edgeReducer?.(key, attributes) ?? attributes,
        ),
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
  getTouchCaptor() {
    return this.touchCaptor;
  }
  getViewportZoomedState(_point: { x: number; y: number }, ratio: number) {
    return { ...this.camera.getState(), ratio };
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
  framedGraphToViewport(
    point: { x: number; y: number },
    override?: { cameraState?: { x: number; y: number; ratio: number } },
  ) {
    const camera = override?.cameraState ?? this.camera;
    const dimensions = this.getDimensions();
    return {
      x: (point.x - camera.x) / camera.ratio + dimensions.width / 2,
      y: (point.y - camera.y) / camera.ratio + dimensions.height / 2,
    };
  }
  viewportToFramedGraph(
    point: { x: number; y: number },
    override?: { cameraState?: { x: number; y: number; ratio: number } },
  ) {
    const camera = override?.cameraState ?? this.camera;
    const dimensions = this.getDimensions();
    return {
      x: (point.x - dimensions.width / 2) * camera.ratio + camera.x,
      y: (point.y - dimensions.height / 2) * camera.ratio + camera.y,
    };
  }
  viewportToGraph(point: { x: number; y: number }) {
    return point;
  }
}
