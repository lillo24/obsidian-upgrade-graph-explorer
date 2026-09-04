import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MultiDirectedGraph } from 'graphology';

type Attributes = Record<string, unknown>;

// Match Sigma 3's cache boundary: render-only never reruns reducers.
vi.mock('sigma', () => ({
  default: class {
    readonly cameraHandlers = new Map<string, () => void>();
    readonly onceHandlers = new Map<string, (() => void)[]>();
    readonly lifecycleHandlers = new Map<string, Set<() => void>>();
    readonly displayEdges = new Map<string, Attributes>();
    readonly camera = {
      ratio: 1,
      x: 0.5,
      y: 0.5,
      on: (event: string, callback: () => void) =>
        this.cameraHandlers.set(event, callback),
      off: vi.fn(),
      getState: () => ({
        ratio: this.camera.ratio,
        x: this.camera.x,
        y: this.camera.y,
      }),
      setState: (state: { ratio?: number; x?: number; y?: number }) => {
        Object.assign(this.camera, state);
        this.cameraHandlers.get('updated')?.();
      },
    };
    readonly captor = { on: vi.fn(), off: vi.fn(), isMouseDown: false };
    readonly touchCaptor = { on: vi.fn(), off: vi.fn() };
    readonly scheduleRender = vi.fn();
    readonly scheduleRefresh = vi.fn(() => this.refresh());
    readonly setCustomBBox = vi.fn();
    readonly kill = vi.fn();

    constructor(
      readonly graph: MultiDirectedGraph,
      _container: HTMLElement,
      readonly settings: {
        edgeReducer: (key: string, attributes: Attributes) => Attributes;
      },
    ) {
      const refresh = () => this.refresh();
      this.graph.on('nodeAdded', refresh);
      this.graph.on('nodeDropped', refresh);
      this.graph.on('nodeAttributesUpdated', refresh);
      this.graph.on('eachNodeAttributesUpdated', refresh);
      this.graph.on('edgeAdded', refresh);
      this.graph.on('edgeDropped', refresh);
      this.graph.on('edgeAttributesUpdated', refresh);
      this.graph.on('eachEdgeAttributesUpdated', refresh);
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
    getNodeDisplayData(key: string) {
      return this.graph.hasNode(key) ? { x: 0.5, y: 0.5 } : undefined;
    }
    getGraphDimensions() {
      return { width: 1, height: 1 };
    }
    getBBox() {
      return { x: [0, 1] as [number, number], y: [0, 1] as [number, number] };
    }
    getDimensions() {
      return { width: 1, height: 1 };
    }
    viewportToGraph(point: { x: number; y: number }) {
      return point;
    }
    framedGraphToViewport(point: { x: number; y: number }) {
      return point;
    }
    viewportToFramedGraph(point: { x: number; y: number }) {
      return point;
    }
    once(event: string, callback: () => void) {
      this.onceHandlers.set(event, [
        ...(this.onceHandlers.get(event) ?? []),
        callback,
      ]);
    }
    on(event: string, callback: () => void) {
      const handlers = this.lifecycleHandlers.get(event) ?? new Set();
      handlers.add(callback);
      this.lifecycleHandlers.set(event, handlers);
    }
    off(event: string, callback: () => void) {
      this.lifecycleHandlers.get(event)?.delete(callback);
    }
    refresh() {
      this.displayEdges.clear();
      this.graph.forEachEdge((key, attributes) => {
        this.displayEdges.set(key, this.settings.edgeReducer(key, attributes));
      });
      for (const event of ['afterProcess', 'afterRender']) {
        const callbacks = this.onceHandlers.get(event) ?? [];
        this.onceHandlers.delete(event);
        for (const callback of callbacks) callback();
        for (const callback of [...(this.lifecycleHandlers.get(event) ?? [])]) {
          callback();
        }
      }
    }
  },
}));

import { mapProjectionToGlobal } from './mapping';
import { mapProjectionToLocal } from './local-mapping';
import { GlobalRendererSession } from './session';
import { LocalRendererSession } from './local-session';
import { globalTestProjection } from './test-fixture';

interface RendererProbe {
  readonly graph: MultiDirectedGraph;
  readonly displayEdges: ReadonlyMap<string, Attributes>;
  readonly camera: {
    setState: (state: { ratio?: number; x?: number }) => void;
  };
  readonly scheduleRefresh: ReturnType<typeof vi.fn>;
}

function mount(mode: 'global' | 'local', initialRatio?: number) {
  const projection = globalTestProjection();
  const container = { setAttribute: vi.fn() } as unknown as HTMLElement;
  const settings = {
    folderClustering: false,
    spacingPreset: 'normal',
  } as const;
  if (mode === 'global') {
    const input = mapProjectionToGlobal(projection, settings);
    const session = new GlobalRendererSession(container, input, {
      settings,
      trackpadZoomMode: 'pinch-zoom',
      ...(initialRatio === undefined
        ? {}
        : {
            initialViewport: { anchorEntityId: 'doc-a', ratio: initialRatio },
          }),
    });
    return {
      session,
      hideB: () =>
        session.update({
          ...input,
          nodes: input.nodes.filter((node) => node.key !== 'entity:doc-b'),
          edges: input.edges.filter((edge) => edge.target !== 'entity:doc-b'),
        }),
    };
  }
  const input = mapProjectionToLocal(projection, 'doc-a');
  const session = new LocalRendererSession(container, input, {
    rootNodeKey: input.rootNodeKey,
    trackpadZoomMode: 'pinch-zoom',
    ...(initialRatio === undefined
      ? {}
      : {
          initialViewport: { anchorEntityId: 'doc-a', freeRatio: initialRatio },
        }),
  });
  return {
    session,
    hideB: () =>
      session.update({
        ...input,
        nodes: input.nodes.filter((node) => node.key !== 'entity:doc-b'),
        edges: input.edges.filter((edge) => edge.target !== 'entity:doc-b'),
      }),
  };
}

beforeEach(() =>
  vi.stubGlobal('window', {
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
  }),
);
afterEach(() => vi.unstubAllGlobals());

describe.each(['global', 'local'] as const)(
  '%s camera style refresh',
  (mode) => {
    it('applies zoom LOD before Hide and restores surviving edges when zooming in', () => {
      const { session, hideB } = mount(mode);
      const renderer = Reflect.get(session, 'renderer') as RendererProbe;
      expect(
        [...renderer.displayEdges.values()].every((edge) => !edge.hidden),
      ).toBe(true);

      renderer.camera.setState({ ratio: 2 });
      expect(
        [...renderer.displayEdges.values()].every(
          (edge) => edge.hidden === (mode === 'global'),
        ),
      ).toBe(true);
      if (mode === 'local') {
        for (const [key, edge] of renderer.displayEdges)
          expect(edge.size).toBeCloseTo(
            (renderer.graph.getEdgeAttribute(key, 'size') as number) * 0.45,
          );
      }
      expect(renderer.graph.size).toBe(3);
      hideB();
      expect(renderer.graph.edges()).toEqual(['edge-ac', 'edge-cr']);

      renderer.camera.setState({ ratio: 0.5 });
      expect(
        [...renderer.displayEdges.values()].every((edge) => !edge.hidden),
      ).toBe(true);
      expect(renderer.graph.order).toBe(3);
      expect(renderer.graph.size).toBe(2);
      session.destroy();
    });

    it('leaves unrelated edges visible after Hide at the current detailed scale', () => {
      const { session, hideB } = mount(mode);
      const renderer = Reflect.get(session, 'renderer') as RendererProbe;
      hideB();
      expect([...renderer.displayEdges.keys()]).toEqual(['edge-ac', 'edge-cr']);
      expect(
        [...renderer.displayEdges.values()].every((edge) => !edge.hidden),
      ).toBe(true);
      session.destroy();
    });

    it('does not refresh reducers for pan or zoom within the same LOD band', () => {
      const { session } = mount(mode);
      const renderer = Reflect.get(session, 'renderer') as RendererProbe;
      renderer.camera.setState({ ratio: 0.8 });
      renderer.camera.setState({ x: 0.6 });
      expect(renderer.scheduleRefresh).not.toHaveBeenCalled();
      renderer.camera.setState({ ratio: 2 });
      expect(renderer.scheduleRefresh).toHaveBeenCalledTimes(1);
      session.destroy();
    });

    it('uses the restored initial zoom for its first reducer refresh', () => {
      const { session } = mount(mode, 2);
      const renderer = Reflect.get(session, 'renderer') as RendererProbe;
      expect(
        [...renderer.displayEdges.values()].every(
          (edge) => edge.hidden === (mode === 'global'),
        ),
      ).toBe(true);
      session.destroy();
    });
  },
);
