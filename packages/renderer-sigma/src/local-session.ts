import Sigma from 'sigma';
import type { WheelCoords } from 'sigma/types';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';
import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';
import type { SpatialPoint } from '@icarus-graph-explorer/spatial-overrides';
import {
  changedFileSizeNodeKeys,
  indexFileNodeKeys,
} from './node-size-presentation';
import {
  isAvailableTemporaryFileMoveContext,
  TemporaryFileMoveCoordinator,
  type TemporaryFileMoveSessionContext,
} from './file-move';
import type { TemporaryNodeConstraintEndReason } from './temporary-node-constraint';
import { atomicAnchoredGraphMutation } from './anchored-refresh';
import { NetworkPositionCameraIntentPolicy } from './network-camera-intent';
import { networkPositionExtent } from './network-position-frame';

import {
  buildLocalGraph,
  createLocalNeighborhoodIndex,
  planLocalGraphReconciliation,
  type LocalGraph,
} from './local-graph';
import {
  resolveLocalDensityFit,
  type LocalDensityDecision,
} from './local-density';
import {
  DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH,
  localDensityFramingRatio,
} from './local-density-framing';
import { createLocalLayoutRequest } from './local-layout';
import {
  DEFAULT_RESOLVED_NETWORK_SETTINGS,
  localLayoutSettingsFromNetworkSettings,
  resolveLocalNetworkVisualSettings,
  type LocalNetworkVisualSettings,
} from './local-network-settings';
import {
  NodeClickArbitrator,
  NODE_DOUBLE_CLICK_TIMEOUT_MS,
} from './node-click';
import {
  isCoarseWheelDelta,
  normalizeWheelDeltaPixels,
  preventSigmaWheelDefault,
  ratioAfterWheelDelta,
  WheelDirectionStabilizer,
} from './precision-wheel-zoom';
import {
  resolveLocalEdgeStyle,
  resolveLocalNodeStyle,
  resolveLocalVisualLod,
} from './local-style';
import type {
  LocalCenterRequest,
  LocalDensityQaDiagnostics,
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
import type { ResolvedNetworkSettings } from './types';

export interface LocalRendererSessionOptions {
  readonly rootNodeKey: string;
  readonly trackpadZoomMode: LocalTrackpadZoomMode;
  readonly densityFramingStrength?: number;
  readonly initialViewport?: SemanticLocalViewport;
  readonly initialViewportPoint?: LocalViewportPoint;
  readonly initialViewportNodeKey?: string;
  readonly initialAcceptedPositions?: readonly LocalLayoutPosition[];
  readonly instrumentation?: LocalRendererInstrumentation;
  readonly visualGroupStyles?: VisualGroupPresentationMap;
  readonly presentationOverrides?: EntityPresentationOverrideMap;
  readonly networkSettings?: ResolvedNetworkSettings;
  readonly onNodeSingleClick?: (key: string) => void;
  readonly onNodeActivated?: (entityId: string) => void;
  readonly onNodeSelected?: (
    key: string | undefined,
    attributes: LocalNodeAttributes | undefined,
  ) => void;
  readonly onFileMoveError?: (message: string) => void;
  readonly onViewportObservation?: (
    viewport: SemanticLocalViewport | undefined,
  ) => void;
  readonly onDensityQaDiagnosticsChange?: (
    diagnostics: LocalDensityQaDiagnostics,
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
  private densityInput: LocalRendererInput;
  private densityFramingStrength: number;
  private lastDensityQaDiagnostics: LocalDensityQaDiagnostics | undefined;
  private cameraOwnership: 'auto' | 'user';
  private readonly positionCameraIntent: NetworkPositionCameraIntentPolicy;
  private positionFrameEstablished = false;
  private latestDensityDecision: LocalDensityDecision = {
    ratio: 1,
    connectedEdgeSignal: 1,
    nearestNeighborSignal: 1,
    rootRadiusSignal: 1,
    fallback: true,
    fallbackReason: 'No accepted Local layout has been measured yet.',
  };
  private neighborhoods: ReadonlyMap<string, ReadonlySet<string>>;
  private hoveredNode: string | undefined;
  private selectedNode: string | undefined;
  private pendingViewportAnchorNodeKey: string | undefined;
  private visualLod: LocalVisualLod;
  private visualGroupStyles: VisualGroupPresentationMap | undefined;
  private presentationOverrides: EntityPresentationOverrideMap | undefined;
  private networkVisualSettings: LocalNetworkVisualSettings;
  private fileNodeKeys: ReturnType<typeof indexFileNodeKeys>;
  private sizeStyleRefreshPending: Set<string> | undefined;
  private trackpadZoomMode: LocalTrackpadZoomMode;
  private readonly options: LocalRendererSessionOptions;
  private precisionWheelIdleTimer: number | undefined;
  private viewportObservationTimer: number | undefined;
  private topologyRefreshPending: Promise<void> | undefined;
  private visualStyleRefreshPending = false;
  private networkNodeStyleRefreshPending = false;
  private networkNodeIndexationPending = false;
  private networkEdgeStyleRefreshPending = false;
  private destroyed = false;
  private nodeClicks: NodeClickArbitrator | undefined;
  private readonly wheelDirection = new WheelDirectionStabilizer();
  private fileMoveContext: TemporaryFileMoveSessionContext | undefined;
  private fileMoveCoordinator: TemporaryFileMoveCoordinator | undefined;
  private fileMoveGestureSequence = 0;
  private suppressFileMoveDoubleClick = false;
  private fileMoveLifecycleAttached = false;

  private readonly fileMoveKeyDownHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.cancelTemporaryFileMove('cancelled');
  };

  private readonly fileMoveBlurHandler = (): void => {
    this.cancelTemporaryFileMove('pointer-lost');
  };

  private readonly fileMovePointerLossHandler = (): void => {
    this.cancelTemporaryFileMove('pointer-lost');
  };

  private readonly fileMoveVisibilityHandler = (): void => {
    if (document.visibilityState !== 'visible') {
      this.cancelTemporaryFileMove('pointer-lost');
    }
  };

  private readonly mouseDragHandler = (): void => {
    if (this.renderer.getMouseCaptor().isMouseDown) {
      this.cameraOwnership = 'user';
      this.positionCameraIntent.claimCamera();
    }
  };

  private readonly touchMoveHandler = (): void => {
    this.cameraOwnership = 'user';
    this.positionCameraIntent.claimCamera();
  };

  private readonly cameraUpdatedHandler = (): void => {
    const started = performance.now();
    const lod = resolveLocalVisualLod(this.renderer.getCamera().ratio);
    if (lod !== this.visualLod) {
      this.visualLod = lod;
      this.options.instrumentation?.count('local-style-updates');
      // Sigma 3 caches reducer output. Apply zoom-detail visibility now, not
      // on the next Hide/projection refresh, and restore it when zooming in.
      // This is renderer-only work at LOD boundaries, never a new layout.
      this.renderer.scheduleRefresh();
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
    this.emitDensityQaDiagnostics();
  };

  private readonly precisionWheelHandler = (coordinates: WheelCoords): void => {
    if (this.fileMoveCoordinator?.ownsPointerSequence === true) {
      preventSigmaWheelDefault(coordinates);
      return;
    }
    const original = coordinates.original as WheelEvent;
    preventSigmaWheelDefault(coordinates);
    const deltaPixels = normalizeWheelDeltaPixels(
      original,
      this.renderer.getDimensions().height,
    );
    this.cameraOwnership = 'user';
    this.positionCameraIntent.claimCamera();
    if (this.trackpadZoomMode === 'pinch-zoom' && !original.ctrlKey) {
      this.applyWheelPan(original);
      return;
    }
    const delta = this.wheelDirection.stabilize(
      deltaPixels,
      performance.now(),
      isCoarseWheelDelta(deltaPixels),
    );
    if (delta === 0) return;
    const camera = this.renderer.getCamera();
    camera.setState(
      this.renderer.getViewportZoomedState(
        { x: coordinates.x, y: coordinates.y },
        ratioAfterWheelDelta(camera.ratio, delta, original.ctrlKey),
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
    this.densityInput = input;
    this.densityFramingStrength =
      options.densityFramingStrength ?? DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH;
    // Validate the transient QA input before mounting Sigma so failure remains
    // actionable instead of producing a success-shaped invalid camera.
    localDensityFramingRatio(1, this.densityFramingStrength);
    this.cameraOwnership =
      options.initialViewport === undefined ? 'auto' : 'user';
    this.positionCameraIntent = new NetworkPositionCameraIntentPolicy(
      options.initialViewport === undefined &&
        options.initialAcceptedPositions === undefined,
    );
    this.trackpadZoomMode = options.trackpadZoomMode;
    this.visualGroupStyles = options.visualGroupStyles;
    this.presentationOverrides = options.presentationOverrides;
    this.networkVisualSettings = resolveLocalNetworkVisualSettings(
      options.networkSettings ?? DEFAULT_RESOLVED_NETWORK_SETTINGS,
    );
    this.fileNodeKeys = indexFileNodeKeys(input.nodes);
    this.graph = buildLocalGraph(input);
    this.neighborhoods = createLocalNeighborhoodIndex(input);
    const mountStarted = performance.now();
    container.setAttribute('aria-hidden', 'true');
    this.renderer = new Sigma(this.graph, container, {
      allowInvalidContainer: false,
      doubleClickTimeout: NODE_DOUBLE_CLICK_TIMEOUT_MS,
      enableEdgeEvents: false,
      hideEdgesOnMove: this.graph.size > 4_000,
      hideLabelsOnMove: true,
      labelDensity: 0.12,
      labelGridCellSize: 100,
      labelRenderedSizeThreshold:
        this.networkVisualSettings.labelRenderedSizeThreshold,
      minCameraRatio: 0.02,
      maxCameraRatio: 6,
      renderEdgeLabels: false,
      stagePadding: 24,
      nodeReducer: (key, attributes) => this.reduceNode(key, attributes),
      edgeReducer: (key, attributes) => this.reduceEdge(key, attributes),
    });
    if (options.initialAcceptedPositions !== undefined) {
      this.establishPositionFrame(options.initialAcceptedPositions);
    } else if (options.initialViewport !== undefined) {
      this.establishCurrentPositionFrame();
    }
    if (options.initialAcceptedPositions !== undefined) {
      this.measureDensity(options.initialAcceptedPositions);
      if (this.cameraOwnership === 'auto') {
        this.applyAutomaticDensityFraming();
      }
    }
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
    this.visualLod = resolveLocalVisualLod(this.renderer.getCamera().ratio);
    const mountMs = Number((performance.now() - mountStarted).toFixed(3));
    this.renderer.getMouseCaptor().on('wheel', this.precisionWheelHandler);
    this.renderer.getMouseCaptor().on('mousemovebody', this.mouseDragHandler);
    this.renderer.getTouchCaptor().on('touchmove', this.touchMoveHandler);
    this.renderer.getCamera().on('updated', this.cameraUpdatedHandler);
    this.bindEvents();
    this.emitDensityQaDiagnostics();
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
    const sizeScale =
      attributes.entityId === null
        ? undefined
        : this.presentationOverrides?.get(attributes.entityId)?.sizeScale;
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
      ...(sizeScale === undefined ? {} : { sizeScale }),
      baseNodeSizeScale: this.networkVisualSettings.nodeSizeScale,
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
      linkThicknessScale: this.networkVisualSettings.linkThicknessScale,
    });
  }

  private eligibleFileMoveNode(key: string): boolean {
    if (!this.graph.hasNode(key)) return false;
    const attributes = this.graph.getNodeAttributes(key);
    return (
      attributes.nodeKind === 'document' &&
      attributes.entityId !== null &&
      attributes.sourcePath !== null
    );
  }

  private viewportToGraphPoint(point: SpatialPoint): SpatialPoint {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new Error('Viewport point must contain finite x/y coordinates.');
    }
    const result = this.renderer.viewportToGraph(point);
    if (!Number.isFinite(result.x) || !Number.isFinite(result.y)) {
      throw new Error('Sigma returned an invalid graph point.');
    }
    return result;
  }

  private beginTemporaryFileMove(key: string, point: SpatialPoint): void {
    const context = this.fileMoveContext;
    if (context?.active !== true || !this.eligibleFileMoveNode(key)) return;
    if (context.capability.status !== 'available') {
      this.options.instrumentation?.count('file-move-unavailable-attempts');
      return;
    }
    const attributes = this.graph.getNodeAttributes(key);
    const graphPoint = this.viewportToGraphPoint(point);
    this.suppressFileMoveDoubleClick = false;
    this.fileMoveCoordinator?.prime({
      gestureId: `${context.sessionGeneration}:${++this.fileMoveGestureSequence}`,
      nodeKey: key,
      startViewportPoint: point,
      startGraphPoint: graphPoint,
      displayedNodePoint: { x: attributes.x, y: attributes.y },
    });
  }

  private moveTemporaryFileMove(
    viewportPoint: SpatialPoint,
    preventSigmaDefault: () => void,
  ): void {
    const coordinator = this.fileMoveCoordinator;
    if (coordinator?.ownsPointerSequence !== true) return;
    preventSigmaDefault();
    coordinator.move(viewportPoint, this.viewportToGraphPoint(viewportPoint));
  }

  private finishTemporaryFileMove(): void {
    const coordinator = this.fileMoveCoordinator;
    if (coordinator === undefined) return;
    const dragged = coordinator.release();
    if (dragged) {
      this.nodeClicks?.cancel();
      this.suppressFileMoveDoubleClick = true;
    }
  }

  private cancelTemporaryFileMove(
    reason: Exclude<TemporaryNodeConstraintEndReason, 'released'>,
  ): boolean {
    return this.fileMoveCoordinator?.cancel(reason) ?? false;
  }

  private attachFileMoveLifecycle(): void {
    if (this.fileMoveLifecycleAttached) return;
    this.fileMoveLifecycleAttached = true;
    window.addEventListener('keydown', this.fileMoveKeyDownHandler);
    window.addEventListener('blur', this.fileMoveBlurHandler);
    window.addEventListener('pointercancel', this.fileMovePointerLossHandler);
    window.addEventListener(
      'lostpointercapture',
      this.fileMovePointerLossHandler,
    );
    document.addEventListener(
      'visibilitychange',
      this.fileMoveVisibilityHandler,
    );
  }

  private detachFileMoveLifecycle(): void {
    if (!this.fileMoveLifecycleAttached) return;
    this.fileMoveLifecycleAttached = false;
    window.removeEventListener('keydown', this.fileMoveKeyDownHandler);
    window.removeEventListener('blur', this.fileMoveBlurHandler);
    window.removeEventListener(
      'pointercancel',
      this.fileMovePointerLossHandler,
    );
    window.removeEventListener(
      'lostpointercapture',
      this.fileMovePointerLossHandler,
    );
    document.removeEventListener(
      'visibilitychange',
      this.fileMoveVisibilityHandler,
    );
  }

  private bindEvents(): void {
    const nodeClicks = new NodeClickArbitrator();
    this.nodeClicks = nodeClicks;
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
    this.renderer.on('clickNode', ({ node }) => {
      if (this.fileMoveCoordinator?.consumeReleasedDragClick() === true) {
        nodeClicks.cancel();
        return;
      }
      this.selectNode(node);
      nodeClicks.schedule(() => this.options.onNodeSingleClick?.(node));
    });
    this.renderer.on('doubleClickNode', ({ node, preventSigmaDefault }) => {
      preventSigmaDefault();
      nodeClicks.cancel();
      if (this.suppressFileMoveDoubleClick) {
        this.suppressFileMoveDoubleClick = false;
        return;
      }
      if (!this.graph.hasNode(node)) return;
      const { entityId } = this.graph.getNodeAttributes(node);
      if (entityId !== null) this.options.onNodeActivated?.(entityId);
    });
    this.renderer.on('clickStage', () => {
      nodeClicks.cancel();
      if (this.fileMoveCoordinator?.consumeReleasedDragClick() === true) {
        return;
      }
      this.selectNode(undefined);
    });
    this.renderer.on('doubleClickStage', () => nodeClicks.cancel());
    this.renderer.on('rightClickNode', ({ preventSigmaDefault }) => {
      if (this.fileMoveCoordinator?.ownsPointerSequence === true) {
        preventSigmaDefault();
      }
    });
    this.renderer.on('downNode', ({ node, event, preventSigmaDefault }) => {
      if (
        this.fileMoveContext?.capability.status === 'available' &&
        this.eligibleFileMoveNode(node)
      ) {
        preventSigmaDefault();
        this.beginTemporaryFileMove(node, { x: event.x, y: event.y });
        return;
      }
      if (this.fileMoveContext?.capability.status === 'unavailable') {
        this.beginTemporaryFileMove(node, { x: event.x, y: event.y });
      }
    });
    this.renderer.on('moveBody', ({ event, preventSigmaDefault }) => {
      this.moveTemporaryFileMove(
        { x: event.x, y: event.y },
        preventSigmaDefault,
      );
    });
    const finishFileMove = () => this.finishTemporaryFileMove();
    this.renderer.on('upNode', finishFileMove);
    this.renderer.on('upStage', finishFileMove);
    this.renderer.on('leaveStage', () => {
      this.cancelTemporaryFileMove('pointer-lost');
    });
  }

  /** Temporary file movement seam; callers decide when an Edit/Move mode exists. */
  setTemporaryFileMoveContext(
    context: TemporaryFileMoveSessionContext | undefined,
    cancellationReason: Exclude<
      TemporaryNodeConstraintEndReason,
      'released'
    > = 'mode-exit',
  ): void {
    this.detachFileMoveLifecycle();
    this.fileMoveCoordinator?.cancel(cancellationReason);
    this.fileMoveCoordinator = undefined;
    this.fileMoveContext = context;
    this.suppressFileMoveDoubleClick = false;
    if (context === undefined) return;
    if (isAvailableTemporaryFileMoveContext(context)) {
      this.fileMoveCoordinator = new TemporaryFileMoveCoordinator({
        context,
        count: (operation) => this.options.instrumentation?.count(operation),
        onDragStart: (nodeKey) => {
          this.nodeClicks?.cancel();
          this.selectNode(nodeKey);
        },
        onError: (message) => this.options.onFileMoveError?.(message),
      });
    }
    this.attachFileMoveLifecycle();
  }

  updateTrackpadZoomMode(mode: LocalTrackpadZoomMode): void {
    this.trackpadZoomMode = mode;
  }

  updateDensityFramingStrength(strengthPercentage: number): void {
    localDensityFramingRatio(1, strengthPercentage);
    if (this.densityFramingStrength === strengthPercentage) return;
    const anchorKey = this.viewportAnchorNodeKey();
    const anchor =
      anchorKey === undefined ? undefined : this.nodeViewportPoint(anchorKey);
    this.densityFramingStrength = strengthPercentage;
    // Moving the Sandbox slider is an explicit camera action. Preview the
    // accepted density decision immediately, then protect that viewport from
    // later topology/layout completion exactly like wheel, pinch, or drag.
    this.cameraOwnership = 'user';
    this.positionCameraIntent.claimCamera();
    const ratio = this.effectiveDensityRatio();
    if (anchor === undefined) {
      this.renderer.getCamera().setState({ ratio });
    } else {
      this.anchorNodeAtViewport(anchorKey!, anchor, ratio);
    }
    this.emitDensityQaDiagnostics();
  }

  setVisualGroupStyles(styles?: VisualGroupPresentationMap): void {
    this.visualGroupStyles = styles;
    this.options.instrumentation?.count('local-style-updates');
    this.visualStyleRefreshPending = true;
    if (this.topologyRefreshPending !== undefined) {
      // A projection update has already changed Graphology, but Sigma has not
      // indexed the new nodes yet. Coalesce the style repaint behind that
      // process/render boundary so partial repaint never targets stale indices.
      return;
    }
    this.refreshPendingStyles();
  }

  setPresentationOverrides(overrides?: EntityPresentationOverrideMap): void {
    const keys = changedFileSizeNodeKeys(
      this.presentationOverrides,
      overrides,
      this.fileNodeKeys,
    );
    this.presentationOverrides = overrides;
    if (this.destroyed || keys.length === 0) return;
    this.options.instrumentation?.count('local-style-updates');
    this.sizeStyleRefreshPending ??= new Set();
    for (const key of keys) this.sizeStyleRefreshPending.add(key);
    if (this.topologyRefreshPending === undefined) this.refreshPendingStyles();
  }

  updateNetworkSettings(settings: ResolvedNetworkSettings): void {
    const previous = this.networkVisualSettings;
    const next = resolveLocalNetworkVisualSettings(settings);
    const nodeSizeChanged = previous.nodeSizeScale !== next.nodeSizeScale;
    const edgeSizeChanged =
      previous.linkThicknessScale !== next.linkThicknessScale;
    const labelChanged =
      previous.labelRenderedSizeThreshold !== next.labelRenderedSizeThreshold;
    this.networkVisualSettings = next;
    if (labelChanged) {
      this.renderer.setSetting(
        'labelRenderedSizeThreshold',
        next.labelRenderedSizeThreshold,
      );
    }
    if (!nodeSizeChanged && !edgeSizeChanged && !labelChanged) return;
    this.options.instrumentation?.count('local-style-updates');
    this.networkNodeStyleRefreshPending ||= nodeSizeChanged || labelChanged;
    this.networkNodeIndexationPending ||= nodeSizeChanged;
    this.networkEdgeStyleRefreshPending ||= edgeSizeChanged;
    if (this.topologyRefreshPending === undefined) this.refreshPendingStyles();
  }

  private refreshPendingStyles(): void {
    if (this.destroyed) return;
    const sizeKeys = [...(this.sizeStyleRefreshPending ?? [])].filter((key) =>
      this.graph.hasNode(key),
    );
    const refreshAllNodes =
      this.visualStyleRefreshPending || this.networkNodeStyleRefreshPending;
    const nodes = refreshAllNodes ? this.graph.nodes() : sizeKeys;
    const edges = this.networkEdgeStyleRefreshPending ? this.graph.edges() : [];
    const needsNodeIndexation =
      this.networkNodeIndexationPending || sizeKeys.length > 0;
    this.visualStyleRefreshPending = false;
    this.networkNodeStyleRefreshPending = false;
    this.networkNodeIndexationPending = false;
    this.networkEdgeStyleRefreshPending = false;
    this.sizeStyleRefreshPending = undefined;
    if (nodes.length === 0 && edges.length === 0) return;
    // Sigma 3.0.3 refresh reruns only these reducers. Radius changes must also
    // process label/program/picking indices (skipIndexation=false), but never
    // submit a layout or change Graphology coordinates. Color-only stays fast.
    this.renderer.refresh({
      partialGraph: {
        ...(nodes.length === 0 ? {} : { nodes }),
        ...(edges.length === 0 ? {} : { edges }),
      },
      skipIndexation: !needsNodeIndexation,
      schedule: true,
    });
  }

  update(input: LocalRendererInput): LocalGraphReconciliation {
    this.cancelTemporaryFileMove('topology-changed');
    this.nodeClicks?.cancel();
    const incomingNodeKeys = new Set(input.nodes.map(({ key }) => key));
    const requestedAnchorKey = this.pendingViewportAnchorNodeKey;
    const anchorKey =
      requestedAnchorKey !== undefined &&
      incomingNodeKeys.has(requestedAnchorKey)
        ? requestedAnchorKey
        : this.viewportAnchorNodeKey(incomingNodeKeys);
    this.pendingViewportAnchorNodeKey = undefined;
    const anchor =
      anchorKey === undefined ? undefined : this.nodeViewportPoint(anchorKey);
    const ratio = this.renderer.getCamera().ratio;
    let refresh: Promise<void> | undefined;
    const run = () => {
      const plan = planLocalGraphReconciliation(this.graph, input);
      if (!plan.changed) return plan.reconciliation;
      const transaction = atomicAnchoredGraphMutation(
        {
          onAfterProcess: (callback) =>
            this.renderer.on('afterProcess', callback),
          offAfterProcess: (callback) =>
            this.renderer.off('afterProcess', callback),
          onAfterRender: (callback) =>
            this.renderer.on('afterRender', callback),
          offAfterRender: (callback) =>
            this.renderer.off('afterRender', callback),
        },
        () => {
          if (
            anchorKey !== undefined &&
            anchor !== undefined &&
            this.graph.hasNode(anchorKey)
          ) {
            this.anchorNodeAtViewport(anchorKey, anchor, ratio);
            return;
          }
          this.renderer.getCamera().setState({
            x: 0.5,
            y: 0.5,
            angle: 0,
            ratio,
          });
        },
        () => {
          plan.apply();
          return plan.reconciliation;
        },
      );
      refresh = transaction.rendered;
      return transaction.result;
    };
    const result =
      this.options.instrumentation === undefined
        ? run()
        : this.options.instrumentation.measure(
            'local-map',
            'local-topology-reconciliations',
            run,
          );
    this.rootNodeKey = input.rootNodeKey;
    this.densityInput = input;
    this.neighborhoods = createLocalNeighborhoodIndex(input);
    this.fileNodeKeys = indexFileNodeKeys(input.nodes);
    if (
      this.selectedNode !== undefined &&
      !this.graph.hasNode(this.selectedNode)
    ) {
      this.selectedNode = undefined;
      this.options.onNodeSelected?.(undefined, undefined);
    }
    if (refresh !== undefined) {
      this.topologyRefreshPending = refresh;
      void refresh.then(() => {
        if (this.topologyRefreshPending !== refresh) return;
        this.topologyRefreshPending = undefined;
        this.refreshPendingStyles();
      });
    }
    return result;
  }

  setControlledSelection(key: string | undefined): void {
    if (key !== undefined && !this.graph.hasNode(key)) return;
    if (key === this.selectedNode) return;
    this.nodeClicks?.cancel();
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
    networkSettings: Pick<
      ResolvedNetworkSettings,
      'referencePull'
    > = DEFAULT_RESOLVED_NETWORK_SETTINGS,
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
      localLayoutSettingsFromNetworkSettings(networkSettings),
    );
  }

  private measureDensity(
    positions: readonly LocalLayoutPosition[],
  ): LocalDensityDecision {
    const started = performance.now();
    const decision = resolveLocalDensityFit(this.densityInput, positions);
    this.latestDensityDecision = decision;
    this.emitDensityQaDiagnostics();
    this.options.instrumentation?.count('local-density-evaluations');
    this.options.instrumentation?.record(
      'local-density',
      performance.now() - started,
    );
    return decision;
  }

  private effectiveDensityRatio(): number {
    return localDensityFramingRatio(
      this.latestDensityDecision.ratio,
      this.densityFramingStrength,
    );
  }

  private applyAutomaticDensityFraming(): void {
    this.renderer.getCamera().setState({
      ratio: this.effectiveDensityRatio(),
    });
    this.emitDensityQaDiagnostics();
  }

  private establishPositionFrame(
    positions: readonly LocalLayoutPosition[],
  ): void {
    if (this.positionFrameEstablished) return;
    this.renderer.setCustomBBox(networkPositionExtent(positions));
    this.positionFrameEstablished = true;
  }

  private establishCurrentPositionFrame(): void {
    if (this.positionFrameEstablished) return;
    this.renderer.setCustomBBox(this.renderer.getBBox());
    this.positionFrameEstablished = true;
  }

  private rebaseCurrentPositionFrame(): void {
    this.renderer.setCustomBBox(this.renderer.getBBox());
    this.positionFrameEstablished = true;
    this.renderer.refresh({ schedule: true });
  }

  private emitDensityQaDiagnostics(): void {
    const diagnostics: LocalDensityQaDiagnostics = {
      rawDecisionRatio: this.latestDensityDecision.ratio,
      effectiveRatio: this.effectiveDensityRatio(),
      cameraRatio: this.renderer.getCamera().ratio,
      fallback: this.latestDensityDecision.fallback,
      ...(this.latestDensityDecision.fallbackReason === undefined
        ? {}
        : { fallbackReason: this.latestDensityDecision.fallbackReason }),
    };
    const previous = this.lastDensityQaDiagnostics;
    if (
      previous !== undefined &&
      previous.rawDecisionRatio === diagnostics.rawDecisionRatio &&
      previous.effectiveRatio === diagnostics.effectiveRatio &&
      previous.cameraRatio === diagnostics.cameraRatio &&
      previous.fallback === diagnostics.fallback &&
      previous.fallbackReason === diagnostics.fallbackReason
    ) {
      return;
    }
    this.lastDensityQaDiagnostics = diagnostics;
    this.options.onDensityQaDiagnosticsChange?.(diagnostics);
  }

  applyPositions(positions: readonly LocalLayoutPosition[]): Promise<void> {
    const topologyRefresh = this.topologyRefreshPending;
    if (topologyRefresh !== undefined) {
      // A layout worker can answer before Sigma has processed the topology that
      // requested it. Wait for that anchored frame so display data from the new
      // scene exists before capturing the second, position-change anchor.
      return topologyRefresh.then(() => this.applyPositions(positions));
    }
    this.cancelTemporaryFileMove('layout-changed');
    const anchorKey = this.viewportAnchorNodeKey();
    const anchor =
      anchorKey === undefined ? undefined : this.nodeViewportPoint(anchorKey);
    const byKey = new Map(
      positions.map((position) => [position.key, position]),
    );
    try {
      if (
        byKey.size !== positions.length ||
        positions.length !== this.graph.order
      ) {
        throw new Error(
          'Local layout result must match every displayed node exactly.',
        );
      }
      for (const [key, position] of byKey) {
        if (!this.graph.hasNode(key)) {
          throw new Error(`Local layout result contains unknown node ${key}.`);
        }
        if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
          throw new Error(
            `Local layout result has invalid position for node ${key}.`,
          );
        }
      }
    } catch (error: unknown) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    const cameraIntent = this.positionCameraIntent.consumePositionAdoption();
    if (cameraIntent === 'initial-automatic-framing') {
      this.establishPositionFrame(positions);
    } else this.establishCurrentPositionFrame();
    const changed = positions.some((position) => {
      const attributes = this.graph.getNodeAttributes(position.key);
      return attributes.x !== position.x || attributes.y !== position.y;
    });
    this.measureDensity(positions);
    if (!changed) {
      if (cameraIntent === 'initial-automatic-framing') {
        if (anchor === undefined) {
          this.applyAutomaticDensityFraming();
        } else {
          this.anchorNodeAtViewport(
            anchorKey!,
            anchor,
            this.effectiveDensityRatio(),
          );
        }
      }
      return Promise.resolve();
    }
    return atomicAnchoredGraphMutation(
      {
        onAfterProcess: (callback) =>
          this.renderer.on('afterProcess', callback),
        offAfterProcess: (callback) =>
          this.renderer.off('afterProcess', callback),
        onAfterRender: (callback) => this.renderer.on('afterRender', callback),
        offAfterRender: (callback) =>
          this.renderer.off('afterRender', callback),
      },
      () => {
        if (cameraIntent === 'initial-automatic-framing') {
          if (anchor !== undefined) {
            this.anchorNodeAtViewport(
              anchorKey!,
              anchor,
              this.effectiveDensityRatio(),
            );
          } else {
            this.applyAutomaticDensityFraming();
          }
        }
      },
      () =>
        this.graph.updateEachNodeAttributes(
          (key, attributes) => {
            const position = byKey.get(key)!;
            return attributes.x === position.x && attributes.y === position.y
              ? attributes
              : { ...attributes, x: position.x, y: position.y };
          },
          { attributes: ['x', 'y'] },
        ),
    ).rendered;
  }

  /**
   * Camera-neutral session-only adoption for continuous physics frames. This
   * intentionally bypasses density, anchoring, layout cache, and React state.
   */
  applyPartialPositions(positions: readonly LocalLayoutPosition[]): void {
    const seen = new Set<string>();
    for (const position of positions) {
      if (
        position.key.length === 0 ||
        seen.has(position.key) ||
        !this.graph.hasNode(position.key)
      ) {
        throw new Error(
          `Sparse Local positions contain an unknown or duplicate node ${JSON.stringify(position.key)}.`,
        );
      }
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        throw new Error(
          `Sparse Local position has invalid coordinates for node ${position.key}.`,
        );
      }
      seen.add(position.key);
    }
    if (positions.length === 0) return;
    const incidentEdges = new Set<string>();
    for (const position of positions) {
      const attributes = this.graph.getNodeAttributes(position.key) as {
        x: number;
        y: number;
      };
      attributes.x = position.x;
      attributes.y = position.y;
      for (const edge of this.graph.edges(position.key))
        incidentEdges.add(edge);
    }
    this.renderer.refresh({
      partialGraph: {
        nodes: positions.map(({ key }) => key),
        edges: [...incidentEdges],
      },
      skipIndexation: false,
      schedule: true,
    });
  }

  nodeViewportPoint(key: string): LocalViewportPoint | undefined {
    const display = this.renderer.getNodeDisplayData(key);
    return display === undefined
      ? undefined
      : this.renderer.framedGraphToViewport(
          { x: display.x, y: display.y },
          {
            // A topology refresh can anchor the camera during afterProcess.
            // Recompute instead of trusting Sigma's cached matrix so a
            // cross-renderer handoff observes the frame that was drawn.
            cameraState: this.renderer.getCamera().getState(),
            graphDimensions: this.renderer.getGraphDimensions(),
          },
        );
  }

  stageNodeAnchor(key: string): boolean {
    if (!this.graph.hasNode(key)) return false;
    this.pendingViewportAnchorNodeKey = key;
    return true;
  }

  anchorRootAtViewport(point: LocalViewportPoint, ratio?: number): void {
    this.anchorNodeAtViewport(this.rootNodeKey, point, ratio);
  }

  private viewportAnchorNodeKey(
    candidates?: ReadonlySet<string>,
  ): string | undefined {
    const survives = (key: string | undefined): key is string =>
      key !== undefined &&
      this.graph.hasNode(key) &&
      (candidates === undefined || candidates.has(key));
    if (survives(this.selectedNode)) return this.selectedNode;
    return survives(this.rootNodeKey) ? this.rootNodeKey : undefined;
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
    this.cameraOwnership = 'user';
    this.positionCameraIntent.claimCamera();
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
    this.cameraOwnership = 'user';
    this.positionCameraIntent.claimCamera();
    const camera = this.renderer.getCamera();
    void camera.animate(
      { ratio: Math.max(0.02, Math.min(6, camera.ratio * factor)) },
      { duration: preferredMotionDuration() },
    );
  }

  fit(): void {
    this.cameraOwnership = 'auto';
    this.positionCameraIntent.claimCamera();
    this.rebaseCurrentPositionFrame();
    void this.renderer.getCamera().animate(
      {
        x: 0.5,
        y: 0.5,
        angle: 0,
        ratio: this.effectiveDensityRatio(),
      },
      { duration: preferredMotionDuration() },
    );
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
    this.cancelTemporaryFileMove('disposed');
    this.detachFileMoveLifecycle();
    this.fileMoveCoordinator = undefined;
    this.fileMoveContext = undefined;
    this.nodeClicks?.cancel();
    this.renderer.getMouseCaptor().off('wheel', this.precisionWheelHandler);
    this.renderer.getMouseCaptor().off('mousemovebody', this.mouseDragHandler);
    this.renderer.getTouchCaptor().off('touchmove', this.touchMoveHandler);
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
