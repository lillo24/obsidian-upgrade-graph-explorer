import Sigma from 'sigma';
import type { WheelCoords } from 'sigma/types';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';

import {
  buildLocalGraph,
  createLocalNeighborhoodIndex,
  reconcileLocalGraph,
  type LocalGraph,
} from './local-graph';
import { createLocalLayoutRequest } from './local-layout';
import {
  normalizeWheelDeltaPixels,
  ratioAfterWheelDelta,
  WheelDirectionStabilizer,
} from './precision-wheel-zoom';
import { refreshLocalRendererWithAnchor } from './local-lifecycle';
import {
  resolveLocalEdgeStyle,
  resolveLocalNodeStyle,
  resolveLocalVisualLod,
} from './local-style';
import type {
  LocalCenterRequest,
  LocalGraphReconciliation,
  LocalLayoutPosition,
  LocalLayoutRequest,
  LocalNodeAttributes,
  LocalRendererInput,
  LocalRendererInstrumentation,
  LocalTrackpadZoomMode,
  LocalViewportPoint,
  LocalVisualLod,
  SemanticLocalViewport,
} from './local-types';

export interface LocalRendererSessionOptions {
  readonly rootNodeKey: string;
  readonly trackpadZoomMode: LocalTrackpadZoomMode;
  readonly initialViewport?: SemanticLocalViewport;
  readonly initialViewportPoint?: LocalViewportPoint;
  readonly initialViewportNodeKey?: string;
  readonly instrumentation?: LocalRendererInstrumentation;
  readonly visualGroupStyles?: VisualGroupPresentationMap;
  readonly onNodeSelected?: (
    key: string | undefined,
    attributes: LocalNodeAttributes | undefined,
  ) => void;
  readonly onViewportObservation?: (
    viewport: SemanticLocalViewport | undefined,
  ) => void;
}

export interface LocalRendererReady {
  readonly mountMs: number;
  readonly firstRenderMs: number;
}

function preferredMotionDuration(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 180;
}

export class LocalRendererSession {
  readonly ready: Promise<LocalRendererReady>;
  private graph: LocalGraph;
  private readonly renderer: Sigma<
    LocalNodeAttributes,
    Parameters<typeof resolveLocalEdgeStyle>[0]
  >;
  private rootNodeKey: string;
  private neighborhoods: ReadonlyMap<string, ReadonlySet<string>>;
  private hoveredNode: string | undefined;
  private selectedNode: string | undefined;
  private visualLod: LocalVisualLod;
  private visualGroupStyles: VisualGroupPresentationMap | undefined;
  private trackpadZoomMode: LocalTrackpadZoomMode;
  private readonly options: LocalRendererSessionOptions;
  private precisionWheelIdleTimer: number | undefined;
  private viewportObservationTimer: number | undefined;
  private destroyed = false;
  private readonly wheelDirection = new WheelDirectionStabilizer();

  private readonly cameraUpdatedHandler = (): void => {
    const started = performance.now();
    const lod = resolveLocalVisualLod(this.renderer.getCamera().ratio);
    if (lod !== this.visualLod) {
      this.visualLod = lod;
      this.options.instrumentation?.count('local-style-updates');
      this.renderer.scheduleRender();
      this.options.instrumentation?.record(
        'local-visual-lod',
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
    const delta = this.wheelDirection.stabilize(
      normalizeWheelDeltaPixels(original, this.renderer.getDimensions().height),
      performance.now(),
    );
    if (delta === 0) return;
    const camera = this.renderer.getCamera();
    camera.setState(
      this.renderer.getViewportZoomedState(
        { x: coordinates.x, y: coordinates.y },
        ratioAfterWheelDelta(camera.ratio, delta),
      ),
    );
    const captor = this.renderer.getMouseCaptor();
    captor.currentWheelDirection = delta > 0 ? -1 : 1;
    if (this.precisionWheelIdleTimer !== undefined) {
      window.clearTimeout(this.precisionWheelIdleTimer);
    }
    this.precisionWheelIdleTimer = window.setTimeout(() => {
      captor.currentWheelDirection = 0;
      this.precisionWheelIdleTimer = undefined;
      this.renderer.scheduleRender();
    }, 120);
  };

  constructor(
    container: HTMLElement,
    input: LocalRendererInput,
    options: LocalRendererSessionOptions,
  ) {
    this.options = options;
    this.rootNodeKey = options.rootNodeKey;
    this.trackpadZoomMode = options.trackpadZoomMode;
    this.visualGroupStyles = options.visualGroupStyles;
    this.graph = buildLocalGraph(input);
    this.neighborhoods = createLocalNeighborhoodIndex(input);
    const mountStarted = performance.now();
    container.setAttribute('aria-hidden', 'true');
    this.renderer = new Sigma(this.graph, container, {
      allowInvalidContainer: false,
      enableEdgeEvents: false,
      hideEdgesOnMove: this.graph.size > 4_000,
      hideLabelsOnMove: true,
      labelDensity: 0.12,
      labelGridCellSize: 100,
      labelRenderedSizeThreshold: 4,
      minCameraRatio: 0.02,
      maxCameraRatio: 6,
      renderEdgeLabels: false,
      stagePadding: 24,
      nodeReducer: (key, attributes) => this.reduceNode(key, attributes),
      edgeReducer: (key, attributes) => this.reduceEdge(key, attributes),
    });
    this.visualLod = resolveLocalVisualLod(this.renderer.getCamera().ratio);
    if (options.initialViewportPoint !== undefined) {
      this.anchorNodeAtViewport(
        options.initialViewportNodeKey ?? this.rootNodeKey,
        options.initialViewportPoint,
        options.initialViewport?.freeRatio,
      );
    } else if (options.initialViewport !== undefined) {
      const initialNode = input.nodes.find(
        ({ attributes }) =>
          attributes.entityId === options.initialViewport?.anchorEntityId,
      );
      if (initialNode !== undefined) {
        this.centerImmediately(
          initialNode.key,
          options.initialViewport.freeRatio,
        );
      }
    }
    const mountMs = Number((performance.now() - mountStarted).toFixed(3));
    this.renderer.getMouseCaptor().on('wheel', this.precisionWheelHandler);
    this.renderer.getCamera().on('updated', this.cameraUpdatedHandler);
    this.bindEvents();
    const renderStarted = performance.now();
    this.ready = new Promise((resolve) => {
      this.renderer.once('afterRender', () => {
        const firstRenderMs = Number(
          (performance.now() - renderStarted).toFixed(3),
        );
        this.options.instrumentation?.record(
          'local-sigma-mount',
          mountMs + firstRenderMs,
        );
        resolve({ mountMs, firstRenderMs });
      });
      this.renderer.refresh();
    });
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

  private reduceNode(key: string, attributes: LocalNodeAttributes) {
    const hovered = key === this.hoveredNode;
    const visualGroup =
      attributes.entityId === null
        ? undefined
        : this.visualGroupStyles?.get(attributes.entityId);
    return resolveLocalNodeStyle(attributes, {
      hovered,
      relatedToHover:
        this.hoveredNode === undefined ||
        hovered ||
        this.neighborhoods.get(this.hoveredNode)?.has(key) === true,
      selected: key === this.selectedNode,
      lod: this.visualLod,
      ...(visualGroup === undefined ? {} : { visualGroup }),
    });
  }

  private reduceEdge(
    key: string,
    attributes: Parameters<typeof resolveLocalEdgeStyle>[0],
  ) {
    const hoverActive = this.hoveredNode !== undefined;
    return resolveLocalEdgeStyle(attributes, {
      hoverActive,
      relatedToHover:
        !hoverActive ||
        this.graph.source(key) === this.hoveredNode ||
        this.graph.target(key) === this.hoveredNode,
      lod: this.visualLod,
    });
  }

  private bindEvents(): void {
    this.renderer.on('enterNode', ({ node }) => {
      const started = performance.now();
      this.hoveredNode = node;
      this.options.instrumentation?.count('local-hover-applications');
      this.renderer.scheduleRender();
      this.options.instrumentation?.record(
        'local-hover',
        performance.now() - started,
      );
    });
    this.renderer.on('leaveNode', () => {
      this.hoveredNode = undefined;
      this.options.instrumentation?.count('local-hover-applications');
      this.renderer.scheduleRender();
    });
    this.renderer.on('clickNode', ({ node }) => this.selectNode(node));
    this.renderer.on('clickStage', () => this.selectNode(undefined));
  }

  updateTrackpadZoomMode(mode: LocalTrackpadZoomMode): void {
    this.trackpadZoomMode = mode;
  }

  setVisualGroupStyles(styles?: VisualGroupPresentationMap): void {
    this.visualGroupStyles = styles;
    this.options.instrumentation?.count('local-style-updates');
    // Sigma 3 applies node reducers during refresh, not a render-only pass.
    // Repaint existing nodes without rebuilding its node/edge indices.
    this.renderer.refresh({
      partialGraph: { nodes: this.graph.nodes() },
      skipIndexation: true,
      schedule: true,
    });
  }

  update(input: LocalRendererInput): LocalGraphReconciliation {
    const anchorKey = this.viewportAnchorNodeKey();
    const anchor = this.nodeViewportPoint(anchorKey);
    const ratio = this.renderer.getCamera().ratio;
    const run = () => reconcileLocalGraph(this.graph, input);
    const result =
      this.options.instrumentation === undefined
        ? run()
        : this.options.instrumentation.measure(
            'local-map',
            'local-topology-reconciliations',
            run,
          );
    this.rootNodeKey = input.rootNodeKey;
    this.neighborhoods = createLocalNeighborhoodIndex(input);
    if (
      this.selectedNode !== undefined &&
      !this.graph.hasNode(this.selectedNode)
    ) {
      this.selectedNode = undefined;
      this.options.onNodeSelected?.(undefined, undefined);
    }
    const changed = Object.values(result).some((count) => count > 0);
    if (changed) {
      void refreshLocalRendererWithAnchor(
        {
          afterProcess: (callback) =>
            this.renderer.once('afterProcess', callback),
          afterRender: (callback) =>
            this.renderer.once('afterRender', callback),
          scheduleRefresh: () => void this.renderer.scheduleRefresh(),
        },
        () => {
          if (anchor !== undefined) {
            this.anchorNodeAtViewport(anchorKey, anchor, ratio);
          }
        },
      );
    }
    return result;
  }

  setControlledSelection(key: string | undefined): void {
    if (key !== undefined && !this.graph.hasNode(key)) return;
    if (key === this.selectedNode) return;
    this.selectedNode = key;
    this.renderer.scheduleRender();
  }

  selectNode(key: string | undefined): void {
    if (key !== undefined && !this.graph.hasNode(key)) {
      throw new Error(`Cannot select missing Local node ${key}.`);
    }
    const started = performance.now();
    this.selectedNode = key;
    this.options.onNodeSelected?.(
      key,
      key === undefined ? undefined : this.graph.getNodeAttributes(key),
    );
    this.options.instrumentation?.count('local-selection-applications');
    this.renderer.scheduleRender();
    this.options.instrumentation?.record(
      'local-selection',
      performance.now() - started,
    );
  }

  createLayoutRequest(
    input: LocalRendererInput,
    iterations: number,
  ): Omit<LocalLayoutRequest, 'requestId'> {
    return createLocalLayoutRequest(
      {
        ...input,
        nodes: input.nodes.map((node) => {
          const current = this.graph.hasNode(node.key)
            ? this.graph.getNodeAttributes(node.key)
            : node.attributes;
          return {
            ...node,
            attributes: { ...node.attributes, x: current.x, y: current.y },
          };
        }),
      },
      iterations,
    );
  }

  applyPositions(positions: readonly LocalLayoutPosition[]): Promise<void> {
    const anchorKey = this.viewportAnchorNodeKey();
    const anchor = this.nodeViewportPoint(anchorKey);
    const ratio = this.renderer.getCamera().ratio;
    const byKey = new Map(
      positions.map((position) => [position.key, position]),
    );
    let changed = false;
    try {
      this.graph.updateEachNodeAttributes(
        (key, attributes) => {
          const position = byKey.get(key);
          if (position === undefined) {
            throw new Error(`Local layout result omitted node ${key}.`);
          }
          if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
            throw new Error(
              `Local layout result has invalid position for node ${key}.`,
            );
          }
          if (attributes.x === position.x && attributes.y === position.y) {
            return attributes;
          }
          changed = true;
          return { ...attributes, x: position.x, y: position.y };
        },
        { attributes: ['x', 'y'] },
      );
    } catch (error: unknown) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    if (!changed) return Promise.resolve();
    return refreshLocalRendererWithAnchor(
      {
        afterProcess: (callback) =>
          this.renderer.once('afterProcess', callback),
        afterRender: (callback) => this.renderer.once('afterRender', callback),
        scheduleRefresh: () => void this.renderer.scheduleRefresh(),
      },
      () => {
        if (anchor !== undefined) {
          this.anchorNodeAtViewport(anchorKey, anchor, ratio);
        }
      },
    );
  }

  nodeViewportPoint(key: string): LocalViewportPoint | undefined {
    const display = this.renderer.getNodeDisplayData(key);
    return display === undefined
      ? undefined
      : this.renderer.framedGraphToViewport({ x: display.x, y: display.y });
  }

  anchorRootAtViewport(point: LocalViewportPoint, ratio?: number): void {
    this.anchorNodeAtViewport(this.rootNodeKey, point, ratio);
  }

  private viewportAnchorNodeKey(): string {
    return this.selectedNode !== undefined &&
      this.graph.hasNode(this.selectedNode)
      ? this.selectedNode
      : this.rootNodeKey;
  }

  private anchorNodeAtViewport(
    key: string,
    point: LocalViewportPoint,
    ratio?: number,
  ): void {
    const node = this.renderer.getNodeDisplayData(key);
    if (node === undefined) return;
    const camera = this.renderer.getCamera();
    // Sigma display data and camera coordinates are normalized ("framed").
    // Recompute against the new graph dimensions during afterProcess so the
    // camera is corrected before Sigma draws the changed normalization.
    const cameraState = {
      ...camera.getState(),
      ...(ratio === undefined ? {} : { ratio }),
    };
    const current = this.renderer.viewportToFramedGraph(point, {
      cameraState,
      graphDimensions: this.renderer.getGraphDimensions(),
    });
    camera.setState({
      x: cameraState.x + node.x - current.x,
      y: cameraState.y + node.y - current.y,
      ratio: cameraState.ratio,
    });
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

  async center(request: LocalCenterRequest): Promise<void> {
    const display = this.renderer.getNodeDisplayData(request.nodeId);
    if (display === undefined) {
      throw new Error(`Cannot center missing Local node ${request.nodeId}.`);
    }
    const started = performance.now();
    await this.renderer
      .getCamera()
      .animate(
        { x: display.x, y: display.y, ratio: request.freeRatio },
        { duration: preferredMotionDuration() },
      );
    this.options.instrumentation?.count('local-centers');
    this.options.instrumentation?.record(
      'local-center',
      performance.now() - started,
    );
  }

  zoomBy(factor: number): void {
    const camera = this.renderer.getCamera();
    void camera.animate(
      { ratio: Math.max(0.02, Math.min(6, camera.ratio * factor)) },
      { duration: preferredMotionDuration() },
    );
  }

  fit(): void {
    void this.renderer.getCamera().animatedReset({
      duration: preferredMotionDuration(),
    });
  }

  semanticViewport(): SemanticLocalViewport | undefined {
    const preferredKeys = [this.selectedNode, this.rootNodeKey].filter(
      (key): key is string => key !== undefined && this.graph.hasNode(key),
    );
    let anchor =
      preferredKeys
        .map((key) => this.graph.getNodeAttributes(key))
        .find(({ entityId }) => entityId !== null)?.entityId ?? undefined;
    if (anchor === undefined) {
      const dimensions = this.renderer.getDimensions();
      const center = this.renderer.viewportToGraph({
        x: dimensions.width / 2,
        y: dimensions.height / 2,
      });
      let nearest:
        { readonly entityId: string; readonly distance: number } | undefined;
      this.graph.forEachNode((_key, attributes) => {
        if (attributes.entityId === null) return;
        const distance =
          (attributes.x - center.x) ** 2 + (attributes.y - center.y) ** 2;
        if (nearest === undefined || distance < nearest.distance) {
          nearest = { entityId: attributes.entityId, distance };
        }
      });
      anchor = nearest?.entityId;
    }
    return anchor === undefined
      ? undefined
      : { anchorEntityId: anchor, freeRatio: this.renderer.getCamera().ratio };
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
}
