import Sigma from 'sigma';
import type { WheelCoords } from 'sigma/types';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';

import {
  buildGlobalGraph,
  createGlobalNeighborhoodIndex,
  reconcileGlobalGraph,
  type GlobalGraph,
} from './graph';
import {
  drawViewportAwareGlobalNodeHover,
  drawViewportAwareGlobalNodeLabel,
} from './global-label';
import { createGlobalLayoutRequest } from './layout';
import {
  normalizeWheelDeltaPixels,
  ratioAfterWheelDelta,
  WheelDirectionStabilizer,
} from './precision-wheel-zoom';
import { resolveGlobalLayoutSettings } from './settings';
import {
  resolveGlobalEdgeStyle,
  resolveGlobalNodeStyle,
  resolveGlobalVisualLod,
} from './style';
import type {
  GlobalCenterRequest,
  GlobalGraphReconciliation,
  GlobalLayoutPosition,
  GlobalLayoutRequest,
  GlobalLayoutService,
  GlobalLayoutSettings,
  GlobalNodeAttributes,
  GlobalRendererInput,
  GlobalRendererInstrumentation,
  GlobalRendererMeasurement,
  GlobalTrackpadZoomMode,
  GlobalVisualLod,
  SemanticGlobalViewport,
  GlobalViewportPoint,
} from './types';

export interface GlobalRendererSessionOptions {
  readonly settings: GlobalLayoutSettings;
  readonly trackpadZoomMode: GlobalTrackpadZoomMode;
  readonly initialViewport?: SemanticGlobalViewport;
  /** Development harness override; production leaves adaptive labels enabled. */
  readonly labels?: boolean;
  /** Development harness override; production keeps expensive edge events off. */
  readonly edgeEvents?: boolean;
  readonly instrumentation?: GlobalRendererInstrumentation;
  readonly visualGroupStyles?: VisualGroupPresentationMap;
  readonly onNodeSelected?: (
    key: string | undefined,
    attributes: GlobalNodeAttributes | undefined,
  ) => void;
  readonly onNodeActivated?: (
    key: string,
    attributes: GlobalNodeAttributes,
  ) => void;
  readonly onNodeHovered?: (key: string | undefined) => void;
  readonly onViewportObservation?: (
    viewport: SemanticGlobalViewport | undefined,
  ) => void;
}

export interface GlobalRendererReady {
  readonly mountMs: number;
  readonly firstRenderMs: number;
}

function preferredMotionDuration(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 180;
}

export class GlobalRendererSession {
  readonly ready: Promise<GlobalRendererReady>;
  private graph: GlobalGraph;
  private readonly renderer: Sigma<
    GlobalNodeAttributes,
    Parameters<typeof resolveGlobalEdgeStyle>[0]
  >;
  private neighborhoods: ReadonlyMap<string, ReadonlySet<string>>;
  private hoveredNode: string | undefined;
  private selectedNode: string | undefined;
  private settings;
  private trackpadZoomMode: GlobalTrackpadZoomMode;
  private readonly options: GlobalRendererSessionOptions;
  private visualLod: GlobalVisualLod;
  private visualGroupStyles: VisualGroupPresentationMap | undefined;
  private precisionWheelIdleTimer: number | undefined;
  private viewportObservationTimer: number | undefined;
  private topologyRefreshPending: Promise<void> | undefined;
  private visualStyleRefreshPending = false;
  private destroyed = false;
  private readonly wheelDirection = new WheelDirectionStabilizer();

  private readonly cameraUpdatedHandler = (): void => {
    const started = performance.now();
    const next = resolveGlobalVisualLod(this.renderer.getCamera().ratio);
    if (next !== this.visualLod) {
      this.visualLod = next;
      this.options.instrumentation?.count('global-style-updates');
      this.renderer.scheduleRender();
      this.options.instrumentation?.record(
        'semantic-zoom-style',
        performance.now() - started,
      );
    }
    if (this.viewportObservationTimer !== undefined) {
      window.clearTimeout(this.viewportObservationTimer);
    }
    this.viewportObservationTimer = window.setTimeout(() => {
      this.viewportObservationTimer = undefined;
      this.options.onViewportObservation?.(this.semanticViewport());
    }, 120);
  };

  private readonly precisionWheelHandler = (coordinates: WheelCoords): void => {
    const original = coordinates.original as WheelEvent;
    if (this.trackpadZoomMode === 'pinch-zoom' && !original.ctrlKey) {
      coordinates.preventSigmaDefault();
      this.applyWheelPan(original);
      return;
    }
    coordinates.preventSigmaDefault();
    const deltaPixels = this.wheelDirection.stabilize(
      normalizeWheelDeltaPixels(original, this.renderer.getDimensions().height),
      performance.now(),
    );
    if (deltaPixels === 0) return;
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
    this.settings = resolveGlobalLayoutSettings(options.settings);
    this.trackpadZoomMode = options.trackpadZoomMode;
    this.visualGroupStyles = options.visualGroupStyles;
    this.graph = buildGlobalGraph(input);
    this.neighborhoods = createGlobalNeighborhoodIndex(input);
    const mountStart = performance.now();
    container.setAttribute('aria-hidden', 'true');
    this.renderer = new Sigma(this.graph, container, {
      allowInvalidContainer: false,
      enableEdgeEvents: options.edgeEvents ?? false,
      hideEdgesOnMove: this.graph.size > 20_000,
      hideLabelsOnMove: true,
      labelDensity: 0.08,
      labelGridCellSize: 120,
      labelRenderedSizeThreshold: this.settings.labelThreshold,
      minCameraRatio: 0.02,
      maxCameraRatio: 6,
      renderEdgeLabels: false,
      renderLabels: options.labels ?? true,
      stagePadding: 24,
      defaultDrawNodeHover: drawViewportAwareGlobalNodeHover,
      defaultDrawNodeLabel: drawViewportAwareGlobalNodeLabel,
      nodeReducer: (key, attributes) => this.reduceNode(key, attributes),
      edgeReducer: (key, attributes) => this.reduceEdge(key, attributes),
    });
    this.visualLod = resolveGlobalVisualLod(this.renderer.getCamera().ratio);
    if (options.initialViewport !== undefined) {
      const initialNode = input.nodes.find(
        ({ attributes }) =>
          attributes.entityId === options.initialViewport?.anchorEntityId,
      );
      if (initialNode !== undefined) {
        this.centerImmediately(initialNode.key, options.initialViewport.ratio);
      }
    }
    const mountMs = Number((performance.now() - mountStart).toFixed(3));
    this.renderer.getMouseCaptor().on('wheel', this.precisionWheelHandler);
    this.renderer.getCamera().on('updated', this.cameraUpdatedHandler);
    this.bindEvents();
    const renderStart = performance.now();
    this.ready = new Promise((resolve) => {
      this.renderer.once('afterRender', () => {
        const firstRenderMs = Number(
          (performance.now() - renderStart).toFixed(3),
        );
        this.options.instrumentation?.record(
          'sigma-mount-render',
          mountMs + firstRenderMs,
        );
        resolve({ mountMs, firstRenderMs });
      });
      this.renderer.refresh();
    });
  }

  private applyWheelZoom(x: number, y: number, deltaPixels: number): void {
    const camera = this.renderer.getCamera();
    const ratio = ratioAfterWheelDelta(camera.ratio, deltaPixels);
    camera.setState(this.renderer.getViewportZoomedState({ x, y }, ratio));
  }

  private applyWheelPan(event: WheelEvent): void {
    const dimensions = this.renderer.getDimensions();
    const center = { x: dimensions.width / 2, y: dimensions.height / 2 };
    const before = this.renderer.viewportToGraph(center);
    const after = this.renderer.viewportToGraph({
      x: center.x + event.deltaX,
      y: center.y + event.deltaY,
    });
    const camera = this.renderer.getCamera();
    camera.setState({
      x: camera.x + before.x - after.x,
      y: camera.y + before.y - after.y,
    });
  }

  private reduceNode(key: string, attributes: GlobalNodeAttributes) {
    const hovered = key === this.hoveredNode;
    const visualGroup =
      attributes.entityId === null
        ? undefined
        : this.visualGroupStyles?.get(attributes.entityId);
    const relatedToHover =
      this.hoveredNode === undefined ||
      hovered ||
      this.neighborhoods.get(this.hoveredNode)?.has(key) === true;
    return resolveGlobalNodeStyle(attributes, {
      hovered,
      relatedToHover,
      selected: key === this.selectedNode,
      lod: this.visualLod,
      settings: this.settings,
      ...(visualGroup === undefined ? {} : { visualGroup }),
    });
  }

  private reduceEdge(
    key: string,
    attributes: Parameters<typeof resolveGlobalEdgeStyle>[0],
  ) {
    const hoverActive = this.hoveredNode !== undefined;
    const relatedToHover =
      !hoverActive ||
      this.graph.source(key) === this.hoveredNode ||
      this.graph.target(key) === this.hoveredNode;
    return resolveGlobalEdgeStyle(attributes, {
      relatedToHover,
      hoverActive,
      lod: this.visualLod,
    });
  }

  private bindEvents(): void {
    this.renderer.on('enterNode', ({ node }) => {
      const started = performance.now();
      const previous = this.hoveredNode;
      this.hoveredNode = node;
      this.options.onNodeHovered?.(node);
      this.options.instrumentation?.count('global-hover-applications');
      this.refreshNodeStyles(previous, node);
      this.options.instrumentation?.record(
        'global-hover',
        performance.now() - started,
      );
    });
    this.renderer.on('leaveNode', () => {
      const previous = this.hoveredNode;
      this.hoveredNode = undefined;
      this.options.onNodeHovered?.(undefined);
      this.options.instrumentation?.count('global-hover-applications');
      this.refreshNodeStyles(previous);
    });
    this.renderer.on('clickNode', ({ node }) => this.selectNode(node));
    this.renderer.on('doubleClickNode', ({ node, preventSigmaDefault }) => {
      // Sigma 3.0.3 otherwise applies its own camera zoom after this event.
      // Every node double-click is consumed; only canonical documents activate.
      preventSigmaDefault();
      if (!this.graph.hasNode(node)) return;
      const attributes = this.graph.getNodeAttributes(node);
      if (attributes.nodeKind !== 'document' || attributes.entityId === null) {
        return;
      }
      this.options.onNodeActivated?.(node, attributes);
    });
    this.renderer.on('clickStage', () => this.selectNode(undefined));
  }

  updateSettings(settings: GlobalLayoutSettings): void {
    this.settings = resolveGlobalLayoutSettings(settings);
    this.renderer.setSetting(
      'labelRenderedSizeThreshold',
      this.settings.labelThreshold,
    );
    this.renderer.scheduleRefresh();
  }

  updateTrackpadZoomMode(mode: GlobalTrackpadZoomMode): void {
    this.trackpadZoomMode = mode;
  }

  setVisualGroupStyles(styles?: VisualGroupPresentationMap): void {
    this.visualGroupStyles = styles;
    this.options.instrumentation?.count('global-style-updates');
    if (this.topologyRefreshPending !== undefined) {
      // Query changes can alter All Network membership in the same React
      // commit as a style-map update. Wait until Sigma indexes that topology.
      this.visualStyleRefreshPending = true;
      return;
    }
    this.refreshVisualGroupStyles();
  }

  private refreshVisualGroupStyles(): void {
    // Sigma 3 applies node reducers during refresh, not a render-only pass.
    // Repaint existing nodes without rebuilding its node/edge indices.
    this.renderer.refresh({
      partialGraph: { nodes: this.graph.nodes() },
      skipIndexation: true,
      schedule: true,
    });
  }

  update(input: GlobalRendererInput): GlobalGraphReconciliation {
    const run = () => reconcileGlobalGraph(this.graph, input);
    const reconciliation =
      this.options.instrumentation === undefined
        ? run()
        : this.options.instrumentation.measure(
            'graphology-reconcile',
            'graphology-reconciliations',
            run,
          );
    this.neighborhoods = createGlobalNeighborhoodIndex(input);
    if (
      this.selectedNode !== undefined &&
      !this.graph.hasNode(this.selectedNode)
    ) {
      this.selectedNode = undefined;
      this.options.onNodeSelected?.(undefined, undefined);
    }
    const changed = Object.values(reconciliation).some((count) => count > 0);
    if (changed) {
      const refresh = new Promise<void>((resolve) => {
        this.renderer.once('afterRender', resolve);
        this.renderer.scheduleRefresh();
      });
      this.topologyRefreshPending = refresh;
      void refresh.then(() => {
        if (this.topologyRefreshPending !== refresh) return;
        this.topologyRefreshPending = undefined;
        if (!this.visualStyleRefreshPending || this.destroyed) return;
        this.visualStyleRefreshPending = false;
        this.refreshVisualGroupStyles();
      });
    } else {
      this.renderer.scheduleRefresh();
    }
    return reconciliation;
  }

  /** Development harness baseline; product live updates use in-place update(). */
  replace(input: GlobalRendererInput): void {
    this.graph = buildGlobalGraph(input);
    this.neighborhoods = createGlobalNeighborhoodIndex(input);
    this.hoveredNode = undefined;
    if (
      this.selectedNode !== undefined &&
      !this.graph.hasNode(this.selectedNode)
    ) {
      this.selectedNode = undefined;
      this.options.onNodeSelected?.(undefined, undefined);
    }
    this.renderer.setGraph(this.graph);
    this.renderer.scheduleRefresh();
  }

  resetPositions(input: GlobalRendererInput): void {
    reconcileGlobalGraph(this.graph, input, { preservePositions: false });
    this.renderer.scheduleRefresh();
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

  setLabels(enabled: boolean): Promise<GlobalRendererMeasurement> {
    return this.measureNextRender('labels-setting', () => {
      this.renderer.setSetting('renderLabels', enabled);
    });
  }

  setEdgeEvents(enabled: boolean): Promise<GlobalRendererMeasurement> {
    return this.measureNextRender(
      enabled ? 'edge-events-on' : 'edge-events-off',
      () => this.renderer.setSetting('enableEdgeEvents', enabled),
    );
  }

  simulateHover(key: string | undefined): Promise<GlobalRendererMeasurement> {
    if (key !== undefined && !this.graph.hasNode(key)) {
      throw new Error(`Cannot hover missing Global node ${key}.`);
    }
    const previous = this.hoveredNode;
    this.hoveredNode = key;
    return this.measureNextRender('hover-reducer', () =>
      this.refreshNodeStyles(previous, key),
    );
  }

  simulateSelection(key: string): Promise<GlobalRendererMeasurement> {
    return this.measureNextRender('selection', () => this.selectNode(key));
  }

  async centerNode(key: string): Promise<GlobalRendererMeasurement> {
    const started = performance.now();
    await this.center({ key: 0, nodeId: key, ratio: 0.3 });
    return {
      operation: 'search-center',
      durationMs: Number((performance.now() - started).toFixed(3)),
    };
  }

  async exerciseCamera(): Promise<GlobalRendererMeasurement> {
    const started = performance.now();
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
      durationMs: Number((performance.now() - started).toFixed(3)),
      highRafGapMs: gapProbe(),
    };
  }

  async runLayout(
    service: GlobalLayoutService,
    input: GlobalRendererInput,
    settings: GlobalLayoutSettings,
    iterations: number,
  ): Promise<GlobalRendererMeasurement> {
    const started = performance.now();
    const gapProbe = startRafGapProbe();
    const result = await service.layout(
      this.createLayoutRequest(input, settings, iterations),
    );
    await this.applyPositions(result.positions);
    return {
      operation: 'forceatlas2-worker',
      durationMs: Number((performance.now() - started).toFixed(3)),
      highRafGapMs: gapProbe(),
    };
  }

  selectNode(key: string | undefined): void {
    if (key !== undefined && !this.graph.hasNode(key)) {
      throw new Error(`Cannot select missing Global node ${key}.`);
    }
    const started = performance.now();
    const previous = this.selectedNode;
    this.selectedNode = key;
    this.options.onNodeSelected?.(
      key,
      key === undefined ? undefined : this.graph.getNodeAttributes(key),
    );
    this.options.instrumentation?.count('global-selection-applications');
    this.refreshNodeStyles(previous, key);
    this.options.instrumentation?.record(
      'global-selection',
      performance.now() - started,
    );
  }

  setControlledSelection(key: string | undefined): void {
    if (key !== undefined && !this.graph.hasNode(key)) return;
    if (key === this.selectedNode) return;
    const previous = this.selectedNode;
    this.selectedNode = key;
    this.refreshNodeStyles(previous, key);
  }

  private refreshNodeStyles(...keys: (string | undefined)[]): void {
    const nodes = [...new Set(keys)].filter(
      (key): key is string => key !== undefined && this.graph.hasNode(key),
    );
    if (nodes.length === 0) {
      this.renderer.scheduleRender();
      return;
    }
    this.renderer.refresh({
      partialGraph: { nodes },
      skipIndexation: true,
      schedule: true,
    });
  }

  createLayoutRequest(
    input: GlobalRendererInput,
    settings: GlobalLayoutSettings,
    iterations: number,
  ): Omit<GlobalLayoutRequest, 'requestId'> {
    const positioned: GlobalRendererInput = {
      ...input,
      nodes: input.nodes.map((node) => {
        const current = this.graph.hasNode(node.key)
          ? this.graph.getNodeAttributes(node.key)
          : node.attributes;
        return {
          ...node,
          attributes: {
            ...node.attributes,
            x: current.x,
            y: current.y,
          },
        };
      }),
    };
    return createGlobalLayoutRequest(positioned, settings, iterations);
  }

  applyPositions(positions: readonly GlobalLayoutPosition[]): Promise<void> {
    try {
      const byKey = new Map(
        positions.map((position) => [position.key, position]),
      );
      this.graph.updateEachNodeAttributes(
        (key, attributes) => {
          const position = byKey.get(key);
          if (position === undefined) {
            throw new Error(`Global layout result omitted node ${key}.`);
          }
          if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
            throw new Error(
              `Global layout result has invalid position for node ${key}.`,
            );
          }
          return { ...attributes, x: position.x, y: position.y };
        },
        { attributes: ['x', 'y'] },
      );
    } catch (error: unknown) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    return new Promise((resolve) => {
      this.renderer.once('afterRender', resolve);
      this.renderer.scheduleRefresh();
    });
  }

  async center(request: GlobalCenterRequest): Promise<void> {
    const display = this.renderer.getNodeDisplayData(request.nodeId);
    if (display === undefined) {
      throw new Error(`Cannot center missing Global node ${request.nodeId}.`);
    }
    const started = performance.now();
    await this.renderer
      .getCamera()
      .animate(
        { x: display.x, y: display.y, ratio: request.ratio },
        { duration: preferredMotionDuration() },
      );
    this.options.instrumentation?.count('global-centers');
    this.options.instrumentation?.record(
      'global-center',
      performance.now() - started,
    );
  }

  private centerImmediately(key: string, ratio: number): void {
    const display = this.renderer.getNodeDisplayData(key);
    if (display === undefined) return;
    this.renderer.getCamera().setState({
      x: display.x,
      y: display.y,
      ratio,
    });
  }

  zoomBy(factor: number): void {
    const camera = this.renderer.getCamera();
    camera.animate(
      { ratio: Math.max(0.02, Math.min(6, camera.ratio * factor)) },
      { duration: preferredMotionDuration() },
    );
  }

  fit(): void {
    void this.renderer
      .getCamera()
      .animatedReset({ duration: preferredMotionDuration() });
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
    return nearest === undefined
      ? undefined
      : {
          anchorEntityId: nearest.entityId,
          ratio: this.renderer.getCamera().ratio,
        };
  }

  nodeViewportPoint(key: string): GlobalViewportPoint | undefined {
    const display = this.renderer.getNodeDisplayData(key);
    return display === undefined
      ? undefined
      : this.renderer.framedGraphToViewport(
          { x: display.x, y: display.y },
          {
            // Recompute from the live camera instead of handing a stale
            // post-layout matrix to the destination renderer.
            cameraState: this.renderer.getCamera().getState(),
            graphDimensions: this.renderer.getGraphDimensions(),
          },
        );
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.renderer.getMouseCaptor().off('wheel', this.precisionWheelHandler);
    this.renderer.getCamera().off('updated', this.cameraUpdatedHandler);
    if (this.precisionWheelIdleTimer !== undefined) {
      window.clearTimeout(this.precisionWheelIdleTimer);
    }
    if (this.viewportObservationTimer !== undefined) {
      window.clearTimeout(this.viewportObservationTimer);
    }
    this.renderer.kill();
  }

  private measureNextRender(
    operation: string,
    action: () => void,
  ): Promise<GlobalRendererMeasurement> {
    const started = performance.now();
    return new Promise((resolve) => {
      this.renderer.once('afterRender', () =>
        resolve({
          operation,
          durationMs: Number((performance.now() - started).toFixed(3)),
        }),
      );
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
