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
  private lifecycleHandlers = new Map<string, Set<() => void>>();
  readonly handlers = new Map<string, (event: unknown) => void>();
  readonly eventOrder: string[] = [];
  readonly frameSnapshots: {
    readonly camera: {
      readonly x: number;
      readonly y: number;
      readonly ratio: number;
    };
    readonly nodeViewportPoints: ReadonlyMap<
      string,
      { readonly x: number; readonly y: number }
    >;
  }[] = [];
  readonly camera = {
    angle: 0,
    ratio: 1,
    x: 0.5,
    y: 0.5,
    on: vi.fn(),
    off: vi.fn(),
    getState: () => ({
      ratio: this.camera.ratio,
      angle: this.camera.angle,
      x: this.camera.x,
      y: this.camera.y,
    }),
    getBoundedRatio: (ratio: number) => ratio,
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
  synchronousGraphAutoRefresh = false;
  normalizeDisplayCoordinates = false;
  private customBBox:
    { readonly x: [number, number]; readonly y: [number, number] } | undefined;
  private fullRefreshPending = false;
  private graphRefreshQueued = false;
  readonly refresh = vi.fn((options?: Refresh) => {
    const keys =
      options?.partialGraph === undefined
        ? this.graph.nodes()
        : (options.partialGraph.nodes ?? []);
    for (const key of keys) {
      if (!this.graph.hasNode(key))
        throw new Error(`Stale Sigma refresh: ${key}`);
      this.displayNodes.set(key, this.reducedNode(key));
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
      stagePadding?: number;
    },
  ) {
    SigmaTestRenderer.instances.push(this);
    this.graph.forEachNode((key) =>
      this.displayNodes.set(key, this.reducedNode(key)),
    );
    const graphMutation = (event: string) => {
      this.eventOrder.push(`mutation:${event}`);
      this.fullRefreshPending = true;
      if (this.deferProcess) return;
      if (this.synchronousGraphAutoRefresh) {
        this.finishProcess();
        return;
      }
      if (this.graphRefreshQueued) return;
      this.graphRefreshQueued = true;
      queueMicrotask(() => {
        this.graphRefreshQueued = false;
        if (!this.deferProcess) this.finishProcess();
      });
    };
    this.graph.on('nodeAdded', () => graphMutation('nodeAdded'));
    this.graph.on('nodeDropped', () => graphMutation('nodeDropped'));
    this.graph.on('nodeAttributesUpdated', () =>
      graphMutation('nodeAttributesUpdated'),
    );
    this.graph.on('eachNodeAttributesUpdated', () =>
      graphMutation('eachNodeAttributesUpdated'),
    );
    this.graph.on('edgeAdded', () => graphMutation('edgeAdded'));
    this.graph.on('edgeDropped', () => graphMutation('edgeDropped'));
    this.graph.on('edgeAttributesUpdated', () =>
      graphMutation('edgeAttributesUpdated'),
    );
    this.graph.on('eachEdgeAttributesUpdated', () =>
      graphMutation('eachEdgeAttributesUpdated'),
    );
  }
  finishProcess(): void {
    this.graphRefreshQueued = false;
    if (this.fullRefreshPending) {
      this.fullRefreshPending = false;
      this.displayNodes.clear();
      this.displayEdges.clear();
      this.graph.forEachNode((key) =>
        this.displayNodes.set(key, this.reducedNode(key)),
      );
      this.graph.forEachEdge((key, attributes) =>
        this.displayEdges.set(
          key,
          this.settings.edgeReducer?.(key, attributes) ?? attributes,
        ),
      );
    }
    for (const event of ['afterProcess', 'afterRender']) {
      this.eventOrder.push(event);
      const handlers = this.onceHandlers.get(event) ?? [];
      this.onceHandlers.delete(event);
      for (const handler of handlers) handler();
      for (const handler of [...(this.lifecycleHandlers.get(event) ?? [])]) {
        handler();
      }
      if (event === 'afterProcess') this.recordFrame();
    }
  }
  once(event: string, callback: () => void): void {
    this.eventOrder.push(`arm:${event}`);
    this.onceHandlers.set(event, [
      ...(this.onceHandlers.get(event) ?? []),
      callback,
    ]);
  }
  on(event: string, callback: (event: unknown) => void): void {
    if (event === 'afterProcess' || event === 'afterRender') {
      this.eventOrder.push(`arm:${event}`);
      const handlers = this.lifecycleHandlers.get(event) ?? new Set();
      handlers.add(callback as () => void);
      this.lifecycleHandlers.set(event, handlers);
      return;
    }
    this.handlers.set(event, callback);
  }
  off(event: string, callback: (event: unknown) => void): void {
    if (event === 'afterProcess' || event === 'afterRender') {
      this.lifecycleHandlers.get(event)?.delete(callback as () => void);
      return;
    }
    if (this.handlers.get(event) === callback) this.handlers.delete(event);
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
    if (!this.normalizeDisplayCoordinates) return { width: 1, height: 1 };
    const extent = this.activeExtent();
    return {
      width: extent.maxX - extent.minX || 1,
      height: extent.maxY - extent.minY || 1,
    };
  }
  getDimensions() {
    return { width: 800, height: 600 };
  }
  getBBox() {
    const extent = this.rawExtent();
    return {
      x: [extent.minX, extent.maxX] as [number, number],
      y: [extent.minY, extent.maxY] as [number, number],
    };
  }
  getCustomBBox() {
    return this.customBBox;
  }
  setCustomBBox(
    extent: {
      readonly x: [number, number];
      readonly y: [number, number];
    } | null,
  ) {
    this.customBBox = extent ?? undefined;
    this.scheduleRender();
    return this;
  }
  framedGraphToViewport(
    point: { x: number; y: number },
    override?: {
      cameraState?: { x: number; y: number; ratio: number; angle?: number };
    },
  ) {
    const camera = override?.cameraState ?? this.camera;
    const dimensions = this.getDimensions();
    const padding = this.settings.stagePadding ?? 0;
    const scale = this.normalizeDisplayCoordinates
      ? Math.min(
          dimensions.width - padding * 2,
          dimensions.height - padding * 2,
        )
      : 1;
    const translatedX = point.x - camera.x;
    const translatedY = point.y - camera.y;
    const cosine = Math.cos(camera.angle ?? 0);
    const sine = Math.sin(camera.angle ?? 0);
    return {
      x:
        ((translatedX * cosine + translatedY * sine) * scale) / camera.ratio +
        dimensions.width / 2,
      y:
        ((-translatedX * sine + translatedY * cosine) * scale) / camera.ratio +
        dimensions.height / 2,
    };
  }
  viewportToFramedGraph(
    point: { x: number; y: number },
    override?: {
      cameraState?: { x: number; y: number; ratio: number; angle?: number };
    },
  ) {
    const camera = override?.cameraState ?? this.camera;
    const dimensions = this.getDimensions();
    const padding = this.settings.stagePadding ?? 0;
    const scale = this.normalizeDisplayCoordinates
      ? Math.min(
          dimensions.width - padding * 2,
          dimensions.height - padding * 2,
        )
      : 1;
    const viewportX = ((point.x - dimensions.width / 2) * camera.ratio) / scale;
    const viewportY =
      ((point.y - dimensions.height / 2) * camera.ratio) / scale;
    const cosine = Math.cos(camera.angle ?? 0);
    const sine = Math.sin(camera.angle ?? 0);
    return {
      x: viewportX * cosine - viewportY * sine + camera.x,
      y: viewportX * sine + viewportY * cosine + camera.y,
    };
  }
  viewportToGraph(
    point: { x: number; y: number },
    override?: {
      cameraState?: { x: number; y: number; ratio: number; angle?: number };
    },
  ) {
    if (!this.normalizeDisplayCoordinates) return point;
    return this.denormalize(this.viewportToFramedGraph(point, override));
  }
  graphToViewport(
    point: { x: number; y: number },
    override?: {
      cameraState?: { x: number; y: number; ratio: number; angle?: number };
    },
  ) {
    return this.normalizeDisplayCoordinates
      ? this.framedGraphToViewport(this.normalize(point), override)
      : point;
  }

  private rawExtent() {
    const nodes = this.graph.nodes();
    if (nodes.length === 0) {
      return { minX: 0, maxX: 1, minY: 0, maxY: 1, extent: 1 };
    }
    const xs = nodes.map((node) =>
      Number(this.graph.getNodeAttribute(node, 'x')),
    );
    const ys = nodes.map((node) =>
      Number(this.graph.getNodeAttribute(node, 'y')),
    );
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      minX,
      maxX,
      minY,
      maxY,
      extent: Math.max(maxX - minX, maxY - minY, 1),
    };
  }

  private activeExtent() {
    if (this.customBBox === undefined) return this.rawExtent();
    const [minX, maxX] = this.customBBox.x;
    const [minY, maxY] = this.customBBox.y;
    return {
      minX,
      maxX,
      minY,
      maxY,
      extent: Math.max(maxX - minX, maxY - minY, 1),
    };
  }

  private normalize(point: { x: number; y: number }) {
    const extent = this.activeExtent();
    return {
      x: (point.x - extent.minX) / extent.extent,
      y: (point.y - extent.minY) / extent.extent,
    };
  }

  private denormalize(point: { x: number; y: number }) {
    const extent = this.activeExtent();
    return {
      x: point.x * extent.extent + extent.minX,
      y: point.y * extent.extent + extent.minY,
    };
  }

  private reducedNode(key: string): Attributes {
    const reduced = this.settings.nodeReducer(
      key,
      this.graph.getNodeAttributes(key),
    );
    if (!this.normalizeDisplayCoordinates) return reduced;
    const extent = this.activeExtent();
    return {
      ...reduced,
      x: (Number(reduced.x) - extent.minX) / extent.extent,
      y: (Number(reduced.y) - extent.minY) / extent.extent,
    };
  }

  private recordFrame(): void {
    const points = new Map<string, { x: number; y: number }>();
    for (const [key, attributes] of this.displayNodes) {
      points.set(
        key,
        this.framedGraphToViewport({
          x: Number(attributes.x),
          y: Number(attributes.y),
        }),
      );
    }
    this.frameSnapshots.push({
      camera: {
        x: this.camera.x,
        y: this.camera.y,
        ratio: this.camera.ratio,
      },
      nodeViewportPoints: points,
    });
  }
}
