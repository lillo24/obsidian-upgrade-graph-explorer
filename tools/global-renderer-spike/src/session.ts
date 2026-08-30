import Sigma from 'sigma';
import type { WheelCoords } from 'sigma/types';

import {
  buildGlobalGraph,
  createNeighborhoodIndex,
  reconcileGlobalGraph,
  type GlobalGraph,
} from './graph';
import { runForceAtlas2Worker } from './layout-worker';
import {
  normalizeWheelDeltaPixels,
  ratioAfterWheelDelta,
  WheelDirectionStabilizer,
} from './precision-wheel-zoom';
import type {
  GlobalEdgeAttributes,
  GlobalGraphReconciliation,
  GlobalNodeAttributes,
  GlobalRendererInput,
  GlobalRendererMeasurement,
  SemanticGlobalViewport,
} from './types';

export interface GlobalRendererSessionOptions {
  readonly labels: boolean;
  readonly edgeEvents: boolean;
  readonly onNodeSelected?: (
    key: string,
    attributes: GlobalNodeAttributes,
  ) => void;
  readonly onNodeHovered?: (key: string | undefined) => void;
}

export interface GlobalRendererReady {
  readonly mountMs: number;
  readonly firstRenderMs: number;
}

export class GlobalRendererSession {
  readonly ready: Promise<GlobalRendererReady>;
  private graph: GlobalGraph;
  private renderer: Sigma<GlobalNodeAttributes, GlobalEdgeAttributes>;
  private neighborhoods: ReadonlyMap<string, ReadonlySet<string>>;
  private hoveredNode: string | undefined;
  private selectedNode: string | undefined;
  private readonly options: GlobalRendererSessionOptions;
  private precisionWheelIdleTimer: number | undefined;
  private readonly wheelDirection = new WheelDirectionStabilizer();
  private readonly precisionWheelHandler = (coordinates: WheelCoords): void => {
    coordinates.preventSigmaDefault();
    const original = coordinates.original as WheelEvent;
    const deltaPixels = this.wheelDirection.stabilize(
      normalizeWheelDeltaPixels(original, this.renderer.getDimensions().height),
      performance.now(),
    );

    if (deltaPixels === 0) {
      return;
    }

    this.applyWheelZoom(coordinates.x, coordinates.y, deltaPixels);

    const mouseCaptor = this.renderer.getMouseCaptor();
    mouseCaptor.currentWheelDirection = deltaPixels > 0 ? -1 : 1;
    if (this.precisionWheelIdleTimer !== undefined) {
      window.clearTimeout(this.precisionWheelIdleTimer);
    }
    this.precisionWheelIdleTimer = window.setTimeout(() => {
      mouseCaptor.currentWheelDirection = 0;
      this.precisionWheelIdleTimer = undefined;
      this.renderer.scheduleRender();
    }, 120);
  };

  constructor(
    container: HTMLElement,
    input: GlobalRendererInput,
    options: GlobalRendererSessionOptions,
  ) {
    this.options = options;
    this.graph = buildGlobalGraph(input);
    this.neighborhoods = createNeighborhoodIndex(input);
    const mountStart = performance.now();
    this.renderer = new Sigma(this.graph, container, {
      allowInvalidContainer: false,
      enableEdgeEvents: options.edgeEvents,
      hideEdgesOnMove: this.graph.size > 20_000,
      hideLabelsOnMove: true,
      labelDensity: 0.08,
      labelGridCellSize: 120,
      labelRenderedSizeThreshold: 7,
      minCameraRatio: 0.02,
      maxCameraRatio: 6,
      renderEdgeLabels: false,
      renderLabels: options.labels,
      stagePadding: 24,
      nodeReducer: (key, attributes) => this.reduceNode(key, attributes),
      edgeReducer: (key, attributes) => this.reduceEdge(key, attributes),
    });
    const mountMs = Number((performance.now() - mountStart).toFixed(3));
    this.renderer.getMouseCaptor().on('wheel', this.precisionWheelHandler);
    this.bindEvents();
    const renderStart = performance.now();
    this.ready = new Promise((resolve) => {
      this.renderer.once('afterRender', () => {
        resolve({
          mountMs,
          firstRenderMs: Number((performance.now() - renderStart).toFixed(3)),
        });
      });
      this.renderer.refresh();
    });
  }

  private applyWheelZoom(x: number, y: number, deltaPixels: number): void {
    const camera = this.renderer.getCamera();
    const ratio = ratioAfterWheelDelta(camera.getState().ratio, deltaPixels);
    camera.setState(this.renderer.getViewportZoomedState({ x, y }, ratio));
  }

  private reduceNode(key: string, attributes: GlobalNodeAttributes) {
    const hovered = this.hoveredNode;
    const selected = key === this.selectedNode;
    const related =
      hovered === undefined ||
      key === hovered ||
      this.neighborhoods.get(hovered)?.has(key) === true;
    return {
      ...attributes,
      color: selected ? '#d09a17' : related ? attributes.color : '#d7dfe2',
      forceLabel: selected || key === hovered,
      highlighted: selected || key === hovered,
      label: related ? attributes.label : '',
      zIndex: selected || key === hovered ? 2 : 0,
    };
  }

  private reduceEdge(key: string, attributes: GlobalEdgeAttributes) {
    const hovered = this.hoveredNode;
    const related =
      hovered === undefined ||
      this.graph.source(key) === hovered ||
      this.graph.target(key) === hovered;
    return {
      ...attributes,
      color: related ? attributes.color : '#e4e9eb',
      hidden: false,
      zIndex: related && hovered !== undefined ? 1 : 0,
    };
  }

  private bindEvents(): void {
    this.renderer.on('enterNode', ({ node }) => {
      this.hoveredNode = node;
      this.options.onNodeHovered?.(node);
      this.renderer.scheduleRender();
    });
    this.renderer.on('leaveNode', () => {
      this.hoveredNode = undefined;
      this.options.onNodeHovered?.(undefined);
      this.renderer.scheduleRender();
    });
    this.renderer.on('clickNode', ({ node }) => this.selectNode(node));
    this.renderer.on('clickStage', () => this.selectNode(undefined));
  }

  nodeAttributes(key: string): GlobalNodeAttributes | undefined {
    return this.graph.hasNode(key)
      ? this.graph.getNodeAttributes(key)
      : undefined;
  }

  nodes(): readonly string[] {
    return this.graph.nodes();
  }

  counts(): { readonly nodes: number; readonly edges: number } {
    return { nodes: this.graph.order, edges: this.graph.size };
  }

  displayedLabelCount(): number {
    return this.renderer.getNodeDisplayedLabels().size;
  }

  selectNode(key: string | undefined): void {
    if (key !== undefined && !this.graph.hasNode(key)) {
      throw new Error(`Cannot select missing global node ${key}.`);
    }
    this.selectedNode = key;
    if (key !== undefined) {
      this.options.onNodeSelected?.(key, this.graph.getNodeAttributes(key));
    }
    this.renderer.scheduleRender();
  }

  async centerNode(key: string): Promise<GlobalRendererMeasurement> {
    const display = this.renderer.getNodeDisplayData(key);
    if (display === undefined) {
      throw new Error(`Cannot center missing global node ${key}.`);
    }
    const start = performance.now();
    await this.renderer.getCamera().animate(
      {
        x: display.x,
        y: display.y,
        ratio: Math.min(0.3, this.renderer.getCamera().ratio),
      },
      { duration: preferredMotionDuration() },
    );
    return {
      operation: 'search-center',
      durationMs: Number((performance.now() - start).toFixed(3)),
    };
  }

  setLabels(enabled: boolean): Promise<GlobalRendererMeasurement> {
    return this.measureNextRender('labels-setting', () => {
      this.renderer.setSetting('renderLabels', enabled);
    });
  }

  setEdgeEvents(enabled: boolean): Promise<GlobalRendererMeasurement> {
    return this.measureNextRender(
      enabled ? 'edge-events-on' : 'edge-events-off',
      () => {
        this.renderer.setSetting('enableEdgeEvents', enabled);
      },
    );
  }

  simulateHover(key: string | undefined): Promise<GlobalRendererMeasurement> {
    if (key !== undefined && !this.graph.hasNode(key)) {
      throw new Error(`Cannot hover missing global node ${key}.`);
    }
    this.hoveredNode = key;
    return this.measureNextRender('hover-reducer', () => {
      this.renderer.scheduleRender();
    });
  }

  simulateSelection(key: string): Promise<GlobalRendererMeasurement> {
    return this.measureNextRender('selection', () => this.selectNode(key));
  }

  async exerciseCamera(): Promise<GlobalRendererMeasurement> {
    const start = performance.now();
    const gapProbe = startRafGapProbe();
    const camera = this.renderer.getCamera();
    await camera.animate(
      {
        x: camera.x + 0.015,
        y: camera.y - 0.015,
        ratio: Math.max(0.02, camera.ratio * 0.9),
      },
      { duration: preferredMotionDuration() },
    );
    return {
      operation: 'camera-pan-zoom',
      durationMs: Number((performance.now() - start).toFixed(3)),
      highRafGapMs: gapProbe(),
    };
  }

  update(
    input: GlobalRendererInput,
    mode: 'incremental' | 'replace',
  ): {
    readonly durationMs: number;
    readonly reconciliation?: GlobalGraphReconciliation;
  } {
    const start = performance.now();
    let reconciliation: GlobalGraphReconciliation | undefined;
    if (mode === 'incremental') {
      reconciliation = reconcileGlobalGraph(this.graph, input);
    } else {
      const replacement = buildGlobalGraph(input);
      this.renderer.setGraph(replacement);
      this.graph = replacement;
    }
    this.neighborhoods = createNeighborhoodIndex(input);
    if (
      this.selectedNode !== undefined &&
      !this.graph.hasNode(this.selectedNode)
    ) {
      this.selectedNode = undefined;
    }
    this.renderer.scheduleRefresh();
    return {
      durationMs: Number((performance.now() - start).toFixed(3)),
      ...(reconciliation === undefined ? {} : { reconciliation }),
    };
  }

  resetPositions(input: GlobalRendererInput): void {
    reconcileGlobalGraph(this.graph, input, { preservePositions: false });
    this.renderer.scheduleRefresh();
  }

  async runLayout(iterations: number): Promise<GlobalRendererMeasurement> {
    const gapProbe = startRafGapProbe();
    const result = await runForceAtlas2Worker(this.graph, iterations);
    const highRafGapMs = gapProbe();
    this.renderer.scheduleRefresh();
    return {
      operation: 'forceatlas2-worker',
      durationMs: result.roundTripMs,
      highRafGapMs,
    };
  }

  semanticViewport(): SemanticGlobalViewport | undefined {
    const dimensions = this.renderer.getDimensions();
    const center = this.renderer.viewportToGraph({
      x: dimensions.width / 2,
      y: dimensions.height / 2,
    });
    let nearest:
      | { readonly entityId: string; readonly distanceSquared: number }
      | undefined;
    this.graph.forEachNode((_key, attributes) => {
      if (attributes.entityId === null) return;
      const distanceSquared =
        (attributes.x - center.x) ** 2 + (attributes.y - center.y) ** 2;
      if (nearest === undefined || distanceSquared < nearest.distanceSquared) {
        nearest = { entityId: attributes.entityId, distanceSquared };
      }
    });
    if (nearest === undefined) return undefined;
    return {
      anchorEntityId: nearest.entityId,
      ratio: this.renderer.getCamera().ratio,
    };
  }

  destroy(): void {
    this.renderer.getMouseCaptor().off('wheel', this.precisionWheelHandler);
    if (this.precisionWheelIdleTimer !== undefined) {
      window.clearTimeout(this.precisionWheelIdleTimer);
    }
    this.renderer.kill();
  }

  private measureNextRender(
    operation: string,
    action: () => void,
  ): Promise<GlobalRendererMeasurement> {
    const start = performance.now();
    return new Promise((resolve) => {
      this.renderer.once('afterRender', () => {
        resolve({
          operation,
          durationMs: Number((performance.now() - start).toFixed(3)),
        });
      });
      action();
    });
  }
}

function startRafGapProbe(): () => number {
  let active = true;
  let previous = performance.now();
  let highGap = 0;
  const sample = (timestamp: number) => {
    highGap = Math.max(highGap, timestamp - previous);
    previous = timestamp;
    if (active) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  return () => {
    active = false;
    return Number(highGap.toFixed(3));
  };
}

function preferredMotionDuration(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 180;
}
