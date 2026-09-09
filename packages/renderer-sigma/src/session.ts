import Sigma from 'sigma';
import type { WheelCoords } from 'sigma/types';
import {
  computeAutomaticGraphFrame,
  createFolderClusterPreviewGeometry,
  createFolderSpatialRulePreviewGeometry,
  normalizedAnchorFromTarget,
  previewFolderClusterAtAnchor,
  targetFromNormalizedAnchor,
  type FolderClusterAnchorMap,
  type FolderClusterPreviewResult,
  type FolderScopeVisualizationState,
  type NormalizedFolderAnchor,
  type SpatialPoint,
} from '@icarus-graph-explorer/spatial-overrides';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';
import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';
import {
  changedFileSizeNodeKeys,
  indexFileNodeKeys,
} from './node-size-presentation';
import {
  resolveGlobalDensityFit,
  type GlobalDensityDecision,
} from './global-density';
import {
  DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH,
  globalDensityFramingRatio,
} from './global-density-framing';
import {
  isAvailableTemporaryFileMoveContext,
  TemporaryFileMoveCoordinator,
  type TemporaryFileMoveControllerStartResult,
  type TemporaryFileMoveSessionContext,
} from './file-move';
import type { TemporaryNodeConstraintEndReason } from './temporary-node-constraint';
import { atomicAnchoredGraphMutation } from './anchored-refresh';
import { NetworkPositionCameraIntentPolicy } from './network-camera-intent';
import { networkPositionExtent } from './network-position-frame';

import {
  buildGlobalGraph,
  createGlobalNeighborhoodIndex,
  createGlobalReferenceDegreeIndex,
  planGlobalGraphReconciliation,
  reconcileGlobalGraph,
  type GlobalGraph,
} from './graph';
import {
  IDLE_GLOBAL_FOLDER_ARRANGEMENT_GESTURE,
  reduceGlobalFolderArrangementGesture,
  type GlobalFolderArrangementGestureState,
} from './arrangement';
import {
  drawViewportAwareGlobalNodeHover,
  drawViewportAwareGlobalNodeLabel,
} from './global-label';
import { createGlobalLayoutRequestFromAutomaticPositions } from './layout';
import { automaticGlobalEdgeSize, automaticGlobalNodeSize } from './mapping';
import {
  NodeClickArbitrator,
  NODE_DOUBLE_CLICK_TIMEOUT_MS,
} from './node-click';
import {
  isCoarseWheelDelta,
  normalizeWheelDeltaPixels,
  normalizeWheelPanDeltaPixels,
  preventSigmaWheelDefault,
  ratioAfterWheelDelta,
  WheelDirectionStabilizer,
} from './precision-wheel-zoom';
import {
  resolveGlobalLayoutSettings,
  resolveGlobalVisualSettings,
} from './settings';
import {
  globalFolderKeyByNodeKey,
  SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
} from './spatial';
import {
  resolveGlobalEdgeStyle,
  resolveGlobalNodeStyle,
  resolveGlobalVisualLod,
  shouldAlwaysShowGlobalLabels,
} from './style';
import type {
  GlobalCenterRequest,
  GlobalDensityQaDiagnostics,
  GlobalGraphReconciliation,
  GlobalLayoutPosition,
  GlobalLayoutService,
  GlobalLayoutSettings,
  GlobalNodeAttributes,
  GlobalRendererInput,
  GlobalRendererInstrumentation,
  GlobalRendererMeasurement,
  GlobalTrackpadZoomMode,
  GlobalVisualLod,
  ResolvedGlobalVisualSettings,
  SemanticGlobalViewport,
  GlobalViewportPoint,
} from './types';

export interface GlobalRendererSessionOptions {
  readonly settings: GlobalLayoutSettings;
  readonly trackpadZoomMode: GlobalTrackpadZoomMode;
  /** Transient Sandbox policy; excluded from layout input and identity. */
  readonly densityFramingStrength?: number;
  /** Confirmed cache-restored displayed geometry, never unrefined seed data. */
  readonly initialAcceptedPositions?: readonly GlobalLayoutPosition[];
  readonly initialViewport?: SemanticGlobalViewport;
  /** Development harness override; production leaves adaptive labels enabled. */
  readonly labels?: boolean;
  /** Development harness override; production keeps expensive edge events off. */
  readonly edgeEvents?: boolean;
  readonly instrumentation?: GlobalRendererInstrumentation;
  readonly visualGroupStyles?: VisualGroupPresentationMap;
  readonly presentationOverrides?: EntityPresentationOverrideMap;
  readonly onNodeSelected?: (
    key: string | undefined,
    attributes: GlobalNodeAttributes | undefined,
  ) => void;
  readonly onNodeActivated?: (
    key: string,
    attributes: GlobalNodeAttributes,
  ) => void;
  readonly onNodeHovered?: (key: string | undefined) => void;
  /** Confirmed pointer click; independent of controlled selection echoes. */
  readonly onNodeSingleClick?: (key: string) => void;
  readonly onArrangementFolderChange?: (folderKey: string) => void;
  readonly onArrangementCommit?: (
    folderKey: string,
    anchor: NormalizedFolderAnchor,
  ) => void;
  readonly onArrangementGestureChange?: (
    phase: GlobalFolderArrangementGestureState['phase'],
  ) => void;
  readonly onArrangementPointerMove?: (point: SpatialPoint | undefined) => void;
  readonly onArrangementScopeFolderClick?: (
    nodeKey: string,
    folderKey: string,
  ) => void;
  readonly onArrangementTargetPoint?: (point: SpatialPoint | undefined) => void;
  readonly onArrangementError?: (message: string) => void;
  readonly onFileMoveError?: (message: string) => void;
  readonly onViewportObservation?: (
    viewport: SemanticGlobalViewport | undefined,
  ) => void;
  readonly onDensityQaDiagnosticsChange?: (
    diagnostics: GlobalDensityQaDiagnostics,
  ) => void;
  /** Reports a manual or semantic camera claim so queued automatic Fit can yield. */
  readonly onUserCameraIntent?: () => void;
}

export interface GlobalFolderArrangementContext {
  readonly active: boolean;
  /** Pull owns only the marker; Place may rigidly preview effective members. */
  readonly behavior?: 'pull' | 'place';
  readonly activeFolderKey?: string;
  readonly anchors: FolderClusterAnchorMap;
  readonly automaticPositions: readonly GlobalLayoutPosition[];
  readonly currentPositions?: readonly GlobalLayoutPosition[];
  readonly activeMemberNodeKeys?: readonly string[];
  readonly scopeStateByNodeKey?: ReadonlyMap<
    string,
    FolderScopeVisualizationState
  >;
  readonly scopePulseNodeKeys?: ReadonlySet<string>;
  readonly chooseScope?: boolean;
  readonly targetAnchor?: NormalizedFolderAnchor;
  readonly input: GlobalRendererInput;
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
  private semanticAnchorNodeKey: string | undefined;
  private settings;
  private visualSettings: ResolvedGlobalVisualSettings;
  private trackpadZoomMode: GlobalTrackpadZoomMode;
  private densityInput: GlobalRendererInput;
  private densityFramingStrength: number;
  private cameraOwnership: 'auto' | 'user';
  private readonly positionCameraIntent: NetworkPositionCameraIntentPolicy;
  private positionFrameEstablished = false;
  private latestDensityDecision: GlobalDensityDecision = {
    ratio: 1,
    nearestNeighborSignal: 1,
    robustExtentSignal: 1,
    visibilityMinimumRatio: 1,
    medianNearestNeighborPx: 0,
    p95RadiusPx: 0,
    nodeCount: 0,
    edgeCount: 0,
    componentCount: 0,
    isolatedNodeCount: 0,
    largestComponentSize: 0,
    fallback: true,
    fallbackReason: 'No confirmed All Network geometry has been measured yet.',
  };
  private lastDensityQaDiagnostics: GlobalDensityQaDiagnostics | undefined;
  private readonly options: GlobalRendererSessionOptions;
  private visualLod: GlobalVisualLod;
  private visualGroupStyles: VisualGroupPresentationMap | undefined;
  private presentationOverrides: EntityPresentationOverrideMap | undefined;
  private fileNodeKeys: ReturnType<typeof indexFileNodeKeys>;
  private referenceDegrees: ReadonlyMap<string, number>;
  private sizeStyleRefreshPending: Set<string> | undefined;
  private precisionWheelIdleTimer: number | undefined;
  private viewportObservationTimer: number | undefined;
  private topologyRefreshPending: Promise<void> | undefined;
  private visualStyleRefreshPending = false;
  private globalNodeStyleRefreshPending = false;
  private globalNodeIndexationPending = false;
  private globalEdgeStyleRefreshPending = false;
  private destroyed = false;
  private nodeClicks: NodeClickArbitrator | undefined;
  private readonly wheelDirection = new WheelDirectionStabilizer();
  private arrangementContext: GlobalFolderArrangementContext | undefined;
  private arrangementHoveredFolder: string | undefined;
  private arrangementGesture: GlobalFolderArrangementGestureState =
    IDLE_GLOBAL_FOLDER_ARRANGEMENT_GESTURE;
  private arrangementPreview: FolderClusterPreviewResult | undefined;
  private arrangementPreviewFrame: number | undefined;
  private lastAppliedArrangementPreview: FolderClusterPreviewResult | undefined;
  private arrangementTargetPointerActive = false;
  private fileMoveContext: TemporaryFileMoveSessionContext | undefined;
  private fileMoveCoordinator: TemporaryFileMoveCoordinator | undefined;
  private fileMoveGestureSequence = 0;
  private keyboardFileMoveViewportPoint: SpatialPoint | undefined;
  private suppressFileMoveDoubleClick = false;
  private fileMoveLifecycleAttached = false;
  private readonly container?: HTMLElement;

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
      this.claimUserCamera();
    }
  };

  private readonly touchMoveHandler = (): void => {
    this.claimUserCamera();
  };

  private readonly cameraUpdatedHandler = (): void => {
    const started = performance.now();
    const next = resolveGlobalVisualLod(this.renderer.getCamera().ratio);
    if (next !== this.visualLod) {
      this.visualLod = next;
      this.options.instrumentation?.count('global-style-updates');
      // Sigma 3 caches reducer output. Render-only leaves old edge visibility
      // until an unrelated topology change (such as Hide) refreshes that cache.
      // Refresh only at LOD boundaries; ordinary pan/zoom stays render-only.
      this.renderer.scheduleRefresh();
      this.options.instrumentation?.record(
        'semantic-zoom-style',
        performance.now() - started,
      );
    }
    if (this.viewportObservationTimer !== undefined) {
      window.clearTimeout(this.viewportObservationTimer);
    }
    this.emitArrangementTargetPoint();
    this.viewportObservationTimer = window.setTimeout(() => {
      this.viewportObservationTimer = undefined;
      this.options.onViewportObservation?.(this.semanticViewport());
    }, 120);
    this.emitDensityQaDiagnostics();
  };

  private readonly precisionWheelHandler = (coordinates: WheelCoords): void => {
    if (
      this.arrangementGesture.phase === 'primed' ||
      this.arrangementGesture.phase === 'dragging' ||
      this.arrangementTargetPointerActive ||
      this.fileMoveCoordinator?.ownsPointerSequence === true
    ) {
      preventSigmaWheelDefault(coordinates);
      return;
    }
    const original = coordinates.original as WheelEvent;
    preventSigmaWheelDefault(coordinates);
    this.claimUserCamera();
    const deltaPixels = normalizeWheelDeltaPixels(
      original,
      this.renderer.getDimensions().height,
    );
    if (this.trackpadZoomMode === 'pinch-zoom' && !original.ctrlKey) {
      this.applyWheelPan(original);
      return;
    }
    const stabilizedDeltaPixels = this.wheelDirection.stabilize(
      deltaPixels,
      performance.now(),
      isCoarseWheelDelta(deltaPixels),
    );
    if (stabilizedDeltaPixels === 0) return;
    this.applyWheelZoom(
      coordinates.x,
      coordinates.y,
      stabilizedDeltaPixels,
      original.ctrlKey,
    );
    const mouseCaptor = this.renderer.getMouseCaptor();
    mouseCaptor.currentWheelDirection = stabilizedDeltaPixels > 0 ? -1 : 1;
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
    this.container = container;
    this.options = options;
    this.settings = resolveGlobalLayoutSettings(options.settings);
    this.visualSettings = resolveGlobalVisualSettings(options.settings);
    this.trackpadZoomMode = options.trackpadZoomMode;
    this.densityInput = input;
    this.densityFramingStrength =
      options.densityFramingStrength ?? DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH;
    globalDensityFramingRatio(1, this.densityFramingStrength);
    this.cameraOwnership =
      options.initialViewport === undefined ? 'auto' : 'user';
    this.positionCameraIntent = new NetworkPositionCameraIntentPolicy(
      options.initialViewport === undefined &&
        options.initialAcceptedPositions === undefined,
    );
    this.visualGroupStyles = options.visualGroupStyles;
    this.presentationOverrides = options.presentationOverrides;
    this.fileNodeKeys = indexFileNodeKeys(input.nodes);
    this.referenceDegrees = createGlobalReferenceDegreeIndex(input);
    this.graph = buildGlobalGraph(input);
    this.neighborhoods = createGlobalNeighborhoodIndex(input);
    const mountStart = performance.now();
    container.setAttribute('aria-hidden', 'true');
    this.renderer = new Sigma(this.graph, container, {
      allowInvalidContainer: false,
      doubleClickTimeout: NODE_DOUBLE_CLICK_TIMEOUT_MS,
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
    if (options.initialViewport !== undefined) {
      const initialNode = input.nodes.find(
        ({ attributes }) =>
          attributes.entityId === options.initialViewport?.anchorEntityId,
      );
      if (initialNode !== undefined) {
        this.semanticAnchorNodeKey = initialNode.key;
        this.centerImmediately(initialNode.key, options.initialViewport.ratio);
      }
    }
    this.visualLod = resolveGlobalVisualLod(this.renderer.getCamera().ratio);
    const mountMs = Number((performance.now() - mountStart).toFixed(3));
    this.renderer.getMouseCaptor().on('wheel', this.precisionWheelHandler);
    this.renderer.getMouseCaptor().on('mousemovebody', this.mouseDragHandler);
    this.renderer.getTouchCaptor().on('touchmove', this.touchMoveHandler);
    this.renderer.getCamera().on('updated', this.cameraUpdatedHandler);
    this.bindEvents();
    this.emitDensityQaDiagnostics();
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

  private applyWheelZoom(
    x: number,
    y: number,
    deltaPixels: number,
    ctrlKey: boolean,
  ): void {
    const camera = this.renderer.getCamera();
    const ratio = ratioAfterWheelDelta(camera.ratio, deltaPixels, ctrlKey);
    camera.setState(this.renderer.getViewportZoomedState({ x, y }, ratio));
  }

  private applyWheelPan(event: WheelEvent): void {
    const dimensions = this.renderer.getDimensions();
    const center = { x: dimensions.width / 2, y: dimensions.height / 2 };
    const delta = normalizeWheelPanDeltaPixels(event, dimensions);
    const before = this.renderer.viewportToFramedGraph(center);
    const after = this.renderer.viewportToFramedGraph({
      x: center.x + delta.x,
      y: center.y + delta.y,
    });
    const camera = this.renderer.getCamera();
    camera.setState({
      x: camera.x + before.x - after.x,
      y: camera.y + before.y - after.y,
    });
  }

  private claimUserCamera(): void {
    this.cameraOwnership = 'user';
    this.positionCameraIntent.claimCamera();
    this.options.onUserCameraIntent?.();
  }

  private reduceNode(key: string, attributes: GlobalNodeAttributes) {
    const sizeScale =
      attributes.entityId === null
        ? undefined
        : this.presentationOverrides?.get(attributes.entityId)?.sizeScale;
    const hovered = key === this.hoveredNode;
    const visualGroup =
      attributes.entityId === null
        ? undefined
        : this.visualGroupStyles?.get(attributes.entityId);
    const relatedToHover =
      this.hoveredNode === undefined ||
      hovered ||
      this.neighborhoods.get(this.hoveredNode)?.has(key) === true;
    const arrangementFolderKey = this.activeArrangementFolderKey();
    const scopeState = this.arrangementContext?.scopeStateByNodeKey?.get(key);
    const automaticSize = automaticGlobalNodeSize(
      attributes.nodeKind,
      this.referenceDegrees.get(key) ?? 0,
      this.settings,
    );
    return resolveGlobalNodeStyle(attributes, {
      arrangementActive: this.arrangementContext?.active === true,
      ...(arrangementFolderKey === undefined
        ? {}
        : { arrangementMember: attributes.folderKey === arrangementFolderKey }),
      ...(scopeState === undefined ? {} : { scopeState }),
      ...(this.arrangementContext?.scopePulseNodeKeys?.has(key) === true
        ? { scopePulse: true }
        : {}),
      alwaysShowLabel: shouldAlwaysShowGlobalLabels(this.graph.order),
      hovered,
      relatedToHover,
      selected: key === this.selectedNode,
      lod: this.visualLod,
      settings: this.settings,
      automaticSize,
      ...(visualGroup === undefined ? {} : { visualGroup }),
      ...(sizeScale === undefined ? {} : { sizeScale }),
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
    const arrangementFolderKey = this.activeArrangementFolderKey();
    const sourceState = this.arrangementContext?.scopeStateByNodeKey?.get(
      this.graph.source(key),
    );
    const targetState = this.arrangementContext?.scopeStateByNodeKey?.get(
      this.graph.target(key),
    );
    const sourceIncluded = sourceState === 'active-member';
    const targetIncluded = targetState === 'active-member';
    const arrangementRelation =
      arrangementFolderKey === undefined
        ? undefined
        : sourceIncluded && targetIncluded
          ? ('internal' as const)
          : sourceIncluded || targetIncluded
            ? ('boundary' as const)
            : sourceState === 'shadowed-by-child' ||
                targetState === 'shadowed-by-child'
              ? ('child-owned' as const)
              : ('unrelated' as const);
    return resolveGlobalEdgeStyle(attributes, {
      automaticSize: automaticGlobalEdgeSize(
        attributes.referenceCount,
        this.settings,
      ),
      ...(arrangementRelation === undefined ? {} : { arrangementRelation }),
      relatedToHover,
      hoverActive,
      lod: this.visualLod,
    });
  }

  private activeArrangementFolderKey(): string | undefined {
    if (this.arrangementContext?.active !== true) return undefined;
    if (this.arrangementGesture.phase !== 'idle') {
      return this.arrangementGesture.folderKey;
    }
    return (
      this.arrangementHoveredFolder ?? this.arrangementContext.activeFolderKey
    );
  }

  private folderKeyForArrangementNode(key: string): string | undefined {
    if (!this.graph.hasNode(key)) return undefined;
    const attributes = this.graph.getNodeAttributes(key);
    return attributes.nodeKind === 'document' &&
      attributes.entityId !== null &&
      attributes.folderKey !== null
      ? attributes.folderKey
      : undefined;
  }

  private refreshArrangementStyles(): void {
    this.options.instrumentation?.count('global-style-updates');
    this.renderer.scheduleRefresh();
  }

  private activateArrangementFolder(folderKey: string): void {
    if (folderKey === this.activeArrangementFolderKey()) return;
    this.arrangementHoveredFolder = folderKey;
    this.options.onArrangementFolderChange?.(folderKey);
    this.refreshArrangementStyles();
  }

  private beginArrangementDrag(key: string, point: SpatialPoint): void {
    const context = this.arrangementContext;
    const folderKey = this.folderKeyForArrangementNode(key);
    if (
      context?.active !== true ||
      context.chooseScope === true ||
      context.behavior === 'pull' ||
      folderKey === undefined
    )
      return;
    try {
      const activeMember =
        context.scopeStateByNodeKey?.get(key) === 'active-member' &&
        context.activeFolderKey !== undefined &&
        context.activeMemberNodeKeys !== undefined;
      const gestureFolderKey = activeMember
        ? context.activeFolderKey!
        : folderKey;
      const geometry = activeMember
        ? createFolderSpatialRulePreviewGeometry({
            baseAutomaticPositions: context.automaticPositions,
            currentPositions:
              context.currentPositions ?? context.automaticPositions,
            documentNodeKeys: globalFolderKeyByNodeKey(context.input).keys(),
            memberNodeKeys: context.activeMemberNodeKeys!,
            folderKey: gestureFolderKey,
            visualDownGraphYSign: SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
          })
        : createFolderClusterPreviewGeometry({
            automaticPositions: context.automaticPositions,
            ...(context.currentPositions === undefined
              ? {}
              : { currentPositions: context.currentPositions }),
            folderKeyByNodeKey: globalFolderKeyByNodeKey(context.input),
            anchors: context.anchors,
            folderKey,
            visualDownGraphYSign: SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
          });
      this.activateArrangementFolder(gestureFolderKey);
      this.arrangementGesture = reduceGlobalFolderArrangementGesture(
        IDLE_GLOBAL_FOLDER_ARRANGEMENT_GESTURE,
        {
          type: 'prime',
          folderKey: gestureFolderKey,
          geometry,
          startGraphPoint: this.viewportToGraphPoint(point),
          startViewportPoint: point,
        },
      );
      this.options.onArrangementGestureChange?.('primed');
    } catch (error: unknown) {
      this.options.onArrangementError?.(
        `Could not start folder arrangement: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private moveArrangementDrag(
    viewportPoint: SpatialPoint,
    preventSigmaDefault: () => void,
  ): void {
    if (
      this.arrangementGesture.phase !== 'primed' &&
      this.arrangementGesture.phase !== 'dragging'
    ) {
      return;
    }
    preventSigmaDefault();
    try {
      const previousPhase = this.arrangementGesture.phase;
      const next = reduceGlobalFolderArrangementGesture(
        this.arrangementGesture,
        {
          type: 'move',
          graphPoint: this.viewportToGraphPoint(viewportPoint),
          viewportPoint,
          visualDownGraphYSign: SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
        },
      );
      this.arrangementGesture = next;
      if (next.phase !== 'dragging') return;
      this.arrangementPreview = next.preview;
      this.options.onArrangementTargetPoint?.(
        this.renderer.graphToViewport(next.preview.target),
      );
      if (previousPhase !== 'dragging') {
        this.options.onArrangementGestureChange?.('dragging');
      }
      this.scheduleArrangementPreview();
    } catch (error: unknown) {
      this.cancelFolderArrangementGesture();
      this.options.onArrangementError?.(
        `Folder drag was canceled: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private scheduleArrangementPreview(): void {
    if (this.arrangementPreviewFrame !== undefined) return;
    this.arrangementPreviewFrame = requestAnimationFrame(() => {
      this.arrangementPreviewFrame = undefined;
      const preview = this.arrangementPreview;
      if (preview === undefined) return;
      this.applyArrangementPreview(preview);
    });
  }

  private applyArrangementPreview(preview: FolderClusterPreviewResult): void {
    const started = performance.now();
    const apply = () => this.applyPartialPositions(preview.positions);
    if (this.options.instrumentation === undefined) apply();
    else {
      this.options.instrumentation.measure(
        'spatial-preview-apply',
        'spatial-preview-applies',
        apply,
      );
    }
    this.options.instrumentation?.record(
      'spatial-rigid-preview',
      performance.now() - started,
    );
    this.lastAppliedArrangementPreview = preview;
  }

  private finishArrangementDrag(): void {
    const previous = this.arrangementGesture;
    if (previous.phase !== 'primed' && previous.phase !== 'dragging') return;
    const next = reduceGlobalFolderArrangementGesture(previous, {
      type: 'release',
    });
    this.arrangementGesture = next;
    if (next.phase !== 'committing') {
      this.options.onArrangementGestureChange?.('idle');
      return;
    }
    if (this.arrangementPreviewFrame !== undefined) {
      cancelAnimationFrame(this.arrangementPreviewFrame);
      this.arrangementPreviewFrame = undefined;
    }
    if (this.lastAppliedArrangementPreview !== next.preview) {
      this.applyArrangementPreview(next.preview);
    }
    this.options.onArrangementGestureChange?.('committing');
    this.options.onArrangementCommit?.(next.folderKey, next.preview.anchor);
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

  private updateTemporaryFileMoveCursor(): void {
    const eligibleHover =
      this.hoveredNode !== undefined &&
      this.fileMoveContext?.active === true &&
      this.fileMoveContext.capability.status === 'available' &&
      this.eligibleFileMoveNode(this.hoveredNode);
    this.container?.setAttribute(
      'data-file-move-cursor',
      this.fileMoveCoordinator?.ownsPointerSequence === true
        ? 'grabbing'
        : eligibleHover
          ? 'grab'
          : 'idle',
    );
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
    this.updateTemporaryFileMoveCursor();
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
    this.keyboardFileMoveViewportPoint = undefined;
    this.updateTemporaryFileMoveCursor();
  }

  cancelTemporaryFileMove(
    reason: Exclude<TemporaryNodeConstraintEndReason, 'released'>,
  ): boolean {
    const cancelled = this.fileMoveCoordinator?.cancel(reason) ?? false;
    this.keyboardFileMoveViewportPoint = undefined;
    this.updateTemporaryFileMoveCursor();
    return cancelled;
  }

  startKeyboardTemporaryFileMove(
    nodeKey: string,
  ): TemporaryFileMoveControllerStartResult {
    if (
      this.fileMoveContext?.active !== true ||
      this.fileMoveContext.capability.status !== 'available'
    ) {
      return { status: 'unavailable', reason: 'simulation-unavailable' };
    }
    if (!this.eligibleFileMoveNode(nodeKey)) {
      return { status: 'unavailable', reason: 'node-unavailable' };
    }
    const point = this.nodeViewportPoint(nodeKey);
    if (point === undefined) {
      return { status: 'unavailable', reason: 'node-unavailable' };
    }
    this.cancelTemporaryFileMove('cancelled');
    this.beginTemporaryFileMove(nodeKey, point);
    if (this.fileMoveCoordinator?.ownsPointerSequence !== true) {
      return { status: 'unavailable', reason: 'simulation-unavailable' };
    }
    this.keyboardFileMoveViewportPoint = point;
    this.updateTemporaryFileMoveCursor();
    return { status: 'started' };
  }

  nudgeKeyboardTemporaryFileMove(delta: SpatialPoint): boolean {
    const point = this.keyboardFileMoveViewportPoint;
    const coordinator = this.fileMoveCoordinator;
    if (point === undefined || coordinator?.ownsPointerSequence !== true) {
      return false;
    }
    const next = { x: point.x + delta.x, y: point.y + delta.y };
    this.keyboardFileMoveViewportPoint = next;
    coordinator.move(next, this.viewportToGraphPoint(next));
    this.updateTemporaryFileMoveCursor();
    return true;
  }

  releaseKeyboardTemporaryFileMove(): boolean {
    if (this.keyboardFileMoveViewportPoint === undefined) return false;
    this.finishTemporaryFileMove();
    return true;
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
      const previous = this.hoveredNode;
      this.hoveredNode = node;
      this.options.onNodeHovered?.(node);
      this.options.instrumentation?.count('global-hover-applications');
      this.refreshNodeStyles(previous, node);
      this.updateTemporaryFileMoveCursor();
      this.options.instrumentation?.record(
        'global-hover',
        performance.now() - started,
      );
    });
    this.renderer.on('leaveNode', () => {
      const previous = this.hoveredNode;
      this.hoveredNode = undefined;
      const arrangementActive = this.arrangementContext?.active === true;
      if (arrangementActive) this.arrangementHoveredFolder = undefined;
      this.options.onNodeHovered?.(undefined);
      this.options.instrumentation?.count('global-hover-applications');
      if (arrangementActive) this.refreshArrangementStyles();
      else this.refreshNodeStyles(previous);
      this.updateTemporaryFileMoveCursor();
    });
    this.renderer.on('clickNode', ({ node }) => {
      if (this.fileMoveCoordinator?.consumeReleasedDragClick() === true) {
        nodeClicks.cancel();
        return;
      }
      if (this.arrangementContext?.active === true) {
        nodeClicks.cancel();
        const folderKey = this.folderKeyForArrangementNode(node);
        if (folderKey !== undefined) {
          if (this.arrangementContext.chooseScope === true) {
            this.options.onArrangementScopeFolderClick?.(node, folderKey);
          } else this.activateArrangementFolder(folderKey);
        }
        return;
      }
      this.selectNode(node);
      nodeClicks.schedule(() => this.options.onNodeSingleClick?.(node));
    });
    this.renderer.on('doubleClickNode', ({ node, preventSigmaDefault }) => {
      // Sigma 3.0.3 otherwise applies its own camera zoom after this event.
      // Every node double-click is consumed; only canonical documents activate.
      preventSigmaDefault();
      nodeClicks.cancel();
      if (this.suppressFileMoveDoubleClick) {
        this.suppressFileMoveDoubleClick = false;
        return;
      }
      if (this.arrangementContext?.active === true) return;
      if (!this.graph.hasNode(node)) return;
      const attributes = this.graph.getNodeAttributes(node);
      if (attributes.nodeKind !== 'document' || attributes.entityId === null) {
        return;
      }
      this.options.onNodeActivated?.(node, attributes);
    });
    this.renderer.on('clickStage', () => {
      nodeClicks.cancel();
      if (this.fileMoveCoordinator?.consumeReleasedDragClick() === true) {
        return;
      }
      if (this.arrangementContext?.active === true) return;
      this.selectNode(undefined);
    });
    this.renderer.on('doubleClickStage', () => nodeClicks.cancel());
    this.renderer.on('rightClickNode', ({ preventSigmaDefault }) => {
      if (
        this.arrangementContext?.active === true ||
        this.fileMoveCoordinator?.ownsPointerSequence === true
      ) {
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
      if (this.arrangementContext?.active !== true) return;
      if (this.arrangementContext.chooseScope === true) {
        preventSigmaDefault();
        return;
      }
      if (this.arrangementContext.behavior === 'pull') return;
      if (
        this.arrangementContext.activeMemberNodeKeys !== undefined &&
        !this.arrangementContext.activeMemberNodeKeys.includes(node)
      ) {
        return;
      }
      preventSigmaDefault();
      this.beginArrangementDrag(node, { x: event.x, y: event.y });
    });
    this.renderer.on('moveBody', ({ event, preventSigmaDefault }) => {
      this.moveTemporaryFileMove(
        { x: event.x, y: event.y },
        preventSigmaDefault,
      );
      if (this.arrangementContext?.active === true) {
        this.options.onArrangementPointerMove?.({ x: event.x, y: event.y });
      }
      this.moveArrangementDrag({ x: event.x, y: event.y }, preventSigmaDefault);
    });
    const finishGestures = () => {
      this.finishTemporaryFileMove();
      this.finishArrangementDrag();
    };
    this.renderer.on('upNode', finishGestures);
    this.renderer.on('upStage', finishGestures);
    this.renderer.on('leaveStage', () => {
      this.cancelTemporaryFileMove('pointer-lost');
      this.options.onArrangementPointerMove?.(undefined);
    });
  }

  setFolderArrangementContext(
    context: GlobalFolderArrangementContext | undefined,
  ): void {
    const previousContext = this.arrangementContext;
    if (context?.active === true && this.fileMoveContext !== undefined) {
      this.setTemporaryFileMoveContext(undefined, 'mode-exit');
    }
    const previousActive = this.arrangementContext?.active === true;
    const previousFolderKey = this.activeArrangementFolderKey();
    this.arrangementContext = context;
    if (context?.active !== true) {
      this.arrangementHoveredFolder = undefined;
      this.cancelFolderArrangementGesture();
    }
    this.emitArrangementTargetPoint();
    const nextFolderKey = this.activeArrangementFolderKey();
    if (
      previousActive !== (context?.active === true) ||
      previousFolderKey !== nextFolderKey ||
      previousContext !== context
    ) {
      this.refreshArrangementStyles();
    }
  }

  /** Temporary File movement seam; callers suspend it for competing tools. */
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
    this.fileMoveContext = undefined;
    this.keyboardFileMoveViewportPoint = undefined;
    this.suppressFileMoveDoubleClick = false;
    this.updateTemporaryFileMoveCursor();
    if (context === undefined) return;
    if (this.arrangementContext?.active === true) {
      this.setFolderArrangementContext(undefined);
    }
    this.fileMoveContext = context;
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
    this.updateTemporaryFileMoveCursor();
  }

  currentFolderAnchor(folderKey: string): NormalizedFolderAnchor | undefined {
    const context = this.arrangementContext;
    if (context?.active !== true) return undefined;
    try {
      return this.folderPreviewGeometry(folderKey).displayedAnchor;
    } catch {
      return undefined;
    }
  }

  previewFolderAnchor(
    folderKey: string,
    anchor: NormalizedFolderAnchor,
  ): FolderClusterPreviewResult {
    const context = this.arrangementContext;
    if (context?.active !== true) {
      throw new Error('Arrange folders is not active.');
    }
    // Pointer and keyboard arrangement are explicit navigation. Confirmed
    // geometry may update density later, but it must not steal this viewport.
    this.claimUserCamera();
    const geometry = this.folderPreviewGeometry(folderKey);
    const preview = previewFolderClusterAtAnchor({
      geometry,
      anchor,
      visualDownGraphYSign: SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
    });
    this.arrangementPreview = preview;
    this.applyArrangementPreview(preview);
    this.options.onArrangementTargetPoint?.(
      this.renderer.graphToViewport(preview.target),
    );
    return preview;
  }

  /**
   * Converts a captured marker-pointer delta into the normalized target frame.
   * This method is geometry-only and never mutates graph node coordinates.
   */
  folderTargetAnchorFromPointer(
    startAnchor: NormalizedFolderAnchor,
    startViewportPoint: SpatialPoint,
    currentViewportPoint: SpatialPoint,
  ): NormalizedFolderAnchor {
    const context = this.arrangementContext;
    if (context?.active !== true) {
      throw new Error('Arrange folders is not active.');
    }
    const frame = computeAutomaticGraphFrame(
      context.automaticPositions,
      globalFolderKeyByNodeKey(context.input).keys(),
    );
    const startTarget = targetFromNormalizedAnchor(
      frame,
      startAnchor,
      SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
    );
    const startGraphPoint = this.viewportToGraphPoint(startViewportPoint);
    const currentGraphPoint = this.viewportToGraphPoint(currentViewportPoint);
    return normalizedAnchorFromTarget(
      frame,
      {
        x: startTarget.x + currentGraphPoint.x - startGraphPoint.x,
        y: startTarget.y + currentGraphPoint.y - startGraphPoint.y,
      },
      SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
    );
  }

  /** Positions only the renderer-external marker; no Graphology x/y is touched. */
  positionFolderTargetAnchor(anchor: NormalizedFolderAnchor): void {
    const context = this.arrangementContext;
    if (context?.active !== true) {
      throw new Error('Arrange folders is not active.');
    }
    this.claimUserCamera();
    const frame = computeAutomaticGraphFrame(
      context.automaticPositions,
      globalFolderKeyByNodeKey(context.input).keys(),
    );
    const target = targetFromNormalizedAnchor(
      frame,
      anchor,
      SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
    );
    this.options.onArrangementTargetPoint?.(
      this.renderer.graphToViewport(target),
    );
  }

  setFolderTargetPointerActive(active: boolean): void {
    this.arrangementTargetPointerActive = active;
  }

  private folderPreviewGeometry(folderKey: string) {
    const context = this.arrangementContext;
    if (context?.active !== true) {
      throw new Error('Arrange folders is not active.');
    }
    if (
      context.activeFolderKey === folderKey &&
      context.activeMemberNodeKeys !== undefined
    ) {
      return createFolderSpatialRulePreviewGeometry({
        baseAutomaticPositions: context.automaticPositions,
        currentPositions:
          context.currentPositions ?? context.automaticPositions,
        documentNodeKeys: globalFolderKeyByNodeKey(context.input).keys(),
        memberNodeKeys: context.activeMemberNodeKeys,
        folderKey,
        visualDownGraphYSign: SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
      });
    }
    return createFolderClusterPreviewGeometry({
      automaticPositions: context.automaticPositions,
      ...(context.currentPositions === undefined
        ? {}
        : { currentPositions: context.currentPositions }),
      folderKeyByNodeKey: globalFolderKeyByNodeKey(context.input),
      anchors: context.anchors,
      folderKey,
      visualDownGraphYSign: SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
    });
  }

  private emitArrangementTargetPoint(): void {
    const context = this.arrangementContext;
    if (
      context?.active !== true ||
      context.activeFolderKey === undefined ||
      context.targetAnchor === undefined
    ) {
      this.options.onArrangementTargetPoint?.(undefined);
      return;
    }
    try {
      const frame = computeAutomaticGraphFrame(
        context.automaticPositions,
        globalFolderKeyByNodeKey(context.input).keys(),
      );
      const target = targetFromNormalizedAnchor(
        frame,
        context.targetAnchor,
        SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
      );
      this.options.onArrangementTargetPoint?.(
        this.renderer.graphToViewport(target),
      );
    } catch {
      this.options.onArrangementTargetPoint?.(undefined);
    }
  }

  completeFolderArrangementCommit(): void {
    this.arrangementGesture = reduceGlobalFolderArrangementGesture(
      this.arrangementGesture,
      { type: 'commit-finished' },
    );
    this.arrangementPreview = undefined;
    this.lastAppliedArrangementPreview = undefined;
    this.emitArrangementTargetPoint();
    this.options.onArrangementGestureChange?.('idle');
  }

  cancelFolderArrangementGesture(): boolean {
    const gesture =
      this.arrangementGesture ?? IDLE_GLOBAL_FOLDER_ARRANGEMENT_GESTURE;
    const changed =
      gesture.phase !== 'idle' || this.arrangementPreview !== undefined;
    if (this.arrangementPreviewFrame !== undefined) {
      cancelAnimationFrame(this.arrangementPreviewFrame);
      this.arrangementPreviewFrame = undefined;
    }
    this.arrangementGesture = reduceGlobalFolderArrangementGesture(gesture, {
      type: 'cancel',
    });
    this.arrangementTargetPointerActive = false;
    this.arrangementPreview = undefined;
    this.lastAppliedArrangementPreview = undefined;
    this.emitArrangementTargetPoint();
    if (changed) this.options.onArrangementGestureChange?.('idle');
    return changed;
  }

  viewportToGraphPoint(point: SpatialPoint): SpatialPoint {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new Error('Viewport point must contain finite x/y coordinates.');
    }
    const result = this.renderer.viewportToGraph(point);
    if (!Number.isFinite(result.x) || !Number.isFinite(result.y)) {
      throw new Error('Sigma returned an invalid graph point.');
    }
    return result;
  }

  updateSettings(settings: GlobalLayoutSettings): void {
    const previousVisual = this.visualSettings;
    const next = resolveGlobalLayoutSettings(settings);
    const nextVisual = resolveGlobalVisualSettings(settings);
    const nodeSizeChanged =
      previousVisual.nodeSize !== nextVisual.nodeSize ||
      previousVisual.referenceDegreeSizeInfluence !==
        nextVisual.referenceDegreeSizeInfluence;
    const edgeSizeChanged =
      previousVisual.linkThickness !== nextVisual.linkThickness;
    const labelChanged =
      previousVisual.labelThreshold !== nextVisual.labelThreshold;
    this.settings = next;
    this.visualSettings = nextVisual;
    if (labelChanged) {
      this.renderer.setSetting(
        'labelRenderedSizeThreshold',
        nextVisual.labelThreshold,
      );
    }
    if (!nodeSizeChanged && !edgeSizeChanged && !labelChanged) return;
    this.options.instrumentation?.count('global-style-updates');
    this.globalNodeStyleRefreshPending ||= nodeSizeChanged || labelChanged;
    this.globalNodeIndexationPending ||= nodeSizeChanged;
    this.globalEdgeStyleRefreshPending ||= edgeSizeChanged;
    if (this.topologyRefreshPending === undefined) this.refreshPendingStyles();
  }

  updateTrackpadZoomMode(mode: GlobalTrackpadZoomMode): void {
    this.trackpadZoomMode = mode;
  }

  updateDensityFramingStrength(strengthPercentage: number): void {
    globalDensityFramingRatio(1, strengthPercentage);
    if (this.densityFramingStrength === strengthPercentage) return;
    const anchorKey = this.viewportAnchorNodeKey();
    const anchor =
      anchorKey === undefined ? undefined : this.nodeViewportPoint(anchorKey);
    this.densityFramingStrength = strengthPercentage;
    this.claimUserCamera();
    const ratio = this.effectiveDensityRatio();
    if (anchorKey === undefined || anchor === undefined) {
      this.renderer.getCamera().setState({ ratio });
    } else {
      this.anchorNodeAtViewport(anchorKey, anchor, ratio);
    }
    this.emitDensityQaDiagnostics();
  }

  setVisualGroupStyles(styles?: VisualGroupPresentationMap): void {
    this.visualGroupStyles = styles;
    this.options.instrumentation?.count('global-style-updates');
    this.visualStyleRefreshPending = true;
    if (this.topologyRefreshPending !== undefined) {
      // Reconciliation has already changed Graphology, but Sigma still owns
      // indices for the previous graph until its next process/render pass.
      // A partial repaint during that gap can target an added or removed node.
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
    this.options.instrumentation?.count('global-style-updates');
    this.sizeStyleRefreshPending ??= new Set();
    for (const key of keys) this.sizeStyleRefreshPending.add(key);
    if (this.topologyRefreshPending === undefined) this.refreshPendingStyles();
  }

  private refreshPendingStyles(): void {
    if (this.destroyed) return;
    const sizeKeys = [...(this.sizeStyleRefreshPending ?? [])].filter((key) =>
      this.graph.hasNode(key),
    );
    const refreshAllNodes =
      this.visualStyleRefreshPending || this.globalNodeStyleRefreshPending;
    const nodes = refreshAllNodes ? this.graph.nodes() : sizeKeys;
    const edges = this.globalEdgeStyleRefreshPending ? this.graph.edges() : [];
    const needsNodeIndexation =
      this.globalNodeIndexationPending || sizeKeys.length > 0;
    this.visualStyleRefreshPending = false;
    this.globalNodeStyleRefreshPending = false;
    this.globalNodeIndexationPending = false;
    this.globalEdgeStyleRefreshPending = false;
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

  update(input: GlobalRendererInput): GlobalGraphReconciliation {
    this.cancelFolderArrangementGesture();
    this.cancelTemporaryFileMove('topology-changed');
    this.nodeClicks?.cancel();
    const incomingNodeKeys = new Set(input.nodes.map(({ key }) => key));
    const anchorKey = this.viewportAnchorNodeKey(incomingNodeKeys);
    const anchor =
      anchorKey === undefined ? undefined : this.nodeViewportPoint(anchorKey);
    const ratio = this.renderer.getCamera().ratio;
    let refresh: Promise<void> | undefined;
    const run = () => {
      const plan = planGlobalGraphReconciliation(this.graph, input);
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
          this.centerReplacedScene(ratio);
        },
        () => {
          plan.apply();
          return plan.reconciliation;
        },
      );
      refresh = transaction.rendered;
      return transaction.result;
    };
    const reconciliation =
      this.options.instrumentation === undefined
        ? run()
        : this.options.instrumentation.measure(
            'graphology-reconcile',
            'graphology-reconciliations',
            run,
          );
    this.densityInput = input;
    this.neighborhoods = createGlobalNeighborhoodIndex(input);
    this.fileNodeKeys = indexFileNodeKeys(input.nodes);
    this.referenceDegrees = createGlobalReferenceDegreeIndex(input);
    if (
      this.selectedNode !== undefined &&
      !this.graph.hasNode(this.selectedNode)
    ) {
      this.selectedNode = undefined;
      this.options.onNodeSelected?.(undefined, undefined);
    }
    if (
      this.semanticAnchorNodeKey !== undefined &&
      !this.graph.hasNode(this.semanticAnchorNodeKey)
    ) {
      this.semanticAnchorNodeKey = undefined;
    }
    if (refresh !== undefined) {
      this.topologyRefreshPending = refresh;
      void refresh.then(() => {
        if (this.topologyRefreshPending !== refresh) return;
        this.topologyRefreshPending = undefined;
        this.refreshPendingStyles();
      });
    }
    return reconciliation;
  }

  /** Development harness baseline; product live updates use in-place update(). */
  replace(input: GlobalRendererInput): void {
    this.cancelFolderArrangementGesture();
    this.cancelTemporaryFileMove('topology-changed');
    this.nodeClicks?.cancel();
    this.graph = buildGlobalGraph(input);
    this.densityInput = input;
    this.fileNodeKeys = indexFileNodeKeys(input.nodes);
    this.neighborhoods = createGlobalNeighborhoodIndex(input);
    this.referenceDegrees = createGlobalReferenceDegreeIndex(input);
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
    this.cancelFolderArrangementGesture();
    this.cancelTemporaryFileMove('layout-changed');
    reconcileGlobalGraph(this.graph, input, { preservePositions: false });
    this.densityInput = input;
    this.fileNodeKeys = indexFileNodeKeys(input.nodes);
    this.referenceDegrees = createGlobalReferenceDegreeIndex(input);
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
    _iterations: number,
    automaticPositions: readonly GlobalLayoutPosition[],
  ): Promise<GlobalRendererMeasurement> {
    const started = performance.now();
    const gapProbe = startRafGapProbe();
    const result = await service.layout(
      createGlobalLayoutRequestFromAutomaticPositions(
        input,
        settings,
        automaticPositions,
      ),
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
    this.nodeClicks?.cancel();
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

  private updatePositions(positions: readonly GlobalLayoutPosition[]): void {
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
  }

  private effectiveDensityRatio(): number {
    return globalDensityFramingRatio(
      this.latestDensityDecision.ratio,
      this.densityFramingStrength,
    );
  }

  private measureDensity(positions: readonly GlobalLayoutPosition[]): void {
    const started = performance.now();
    this.latestDensityDecision = resolveGlobalDensityFit(
      this.densityInput,
      positions,
    );
    this.options.instrumentation?.count('global-density-evaluations');
    this.options.instrumentation?.record(
      'global-density',
      performance.now() - started,
    );
    this.emitDensityQaDiagnostics();
  }

  private applyAutomaticDensityFraming(): void {
    this.renderer.getCamera().setState({
      x: 0.5,
      y: 0.5,
      angle: 0,
      ratio: this.effectiveDensityRatio(),
    });
    this.emitDensityQaDiagnostics();
  }

  private establishPositionFrame(
    positions: readonly GlobalLayoutPosition[],
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
    const diagnostics: GlobalDensityQaDiagnostics = {
      rawDecisionRatio: this.latestDensityDecision.ratio,
      effectiveRatio: this.effectiveDensityRatio(),
      cameraRatio: this.renderer.getCamera().ratio,
      fallback: this.latestDensityDecision.fallback,
      ...(this.latestDensityDecision.fallbackReason === undefined
        ? {}
        : { fallbackReason: this.latestDensityDecision.fallbackReason }),
      nodeCount: this.latestDensityDecision.nodeCount,
      edgeCount: this.latestDensityDecision.edgeCount,
      isolatedNodeCount: this.latestDensityDecision.isolatedNodeCount,
    };
    const previous = this.lastDensityQaDiagnostics;
    if (
      previous !== undefined &&
      previous.rawDecisionRatio === diagnostics.rawDecisionRatio &&
      previous.effectiveRatio === diagnostics.effectiveRatio &&
      previous.cameraRatio === diagnostics.cameraRatio &&
      previous.fallback === diagnostics.fallback &&
      previous.fallbackReason === diagnostics.fallbackReason &&
      previous.nodeCount === diagnostics.nodeCount &&
      previous.edgeCount === diagnostics.edgeCount &&
      previous.isolatedNodeCount === diagnostics.isolatedNodeCount
    ) {
      return;
    }
    this.lastDensityQaDiagnostics = diagnostics;
    this.options.onDensityQaDiagnosticsChange?.(diagnostics);
  }

  applyPositions(positions: readonly GlobalLayoutPosition[]): Promise<void> {
    const topologyRefresh = this.topologyRefreshPending;
    if (topologyRefresh !== undefined) {
      // A layout worker can answer before Sigma has processed the topology that
      // requested it. Wait for that anchored frame so display data from the new
      // scene exists before capturing the second, position-change anchor.
      return topologyRefresh.then(() => this.applyPositions(positions));
    }
    this.cancelTemporaryFileMove('layout-changed');
    const byKey = new Map(
      positions.map((position) => [position.key, position]),
    );
    try {
      if (
        byKey.size !== positions.length ||
        positions.length !== this.graph.order
      ) {
        throw new Error(
          'Global layout result must match every displayed node exactly.',
        );
      }
      for (const [key, position] of byKey) {
        if (!this.graph.hasNode(key)) {
          throw new Error(`Global layout result contains unknown node ${key}.`);
        }
        if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
          throw new Error(
            `Global layout result has invalid position for node ${key}.`,
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
        this.applyAutomaticDensityFraming();
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
          this.applyAutomaticDensityFraming();
        }
        this.emitDensityQaDiagnostics();
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
   * Applies authoritative spatial coordinates without letting Sigma's changed
   * graph normalization steal the user's raw graph-space viewport framing.
   */
  applySpatialPositions(
    positions: readonly GlobalLayoutPosition[],
  ): Promise<void> {
    try {
      const cameraIntent = this.positionCameraIntent.consumePositionAdoption();
      if (cameraIntent === 'initial-automatic-framing') {
        this.establishPositionFrame(positions);
      } else this.establishCurrentPositionFrame();
      this.measureDensity(positions);
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
          if (cameraIntent === 'initial-automatic-framing') {
            this.applyAutomaticDensityFraming();
          } else this.emitDensityQaDiagnostics();
        },
        () => this.updatePositions(positions),
      );
      return transaction.rendered.then(() => this.emitArrangementTargetPoint());
    } catch (error: unknown) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Mutates only supplied renderer-owned coordinates. Sigma 3.0.3 still needs
   * indexation enabled so moved-node picking, labels, and incident edges use
   * the new geometry on the scheduled frame.
   */
  applyPartialPositions(positions: readonly GlobalLayoutPosition[]): void {
    const seen = new Set<string>();
    const validated = positions.map((position) => {
      if (
        position.key.length === 0 ||
        seen.has(position.key) ||
        !this.graph.hasNode(position.key)
      ) {
        throw new Error(
          `Sparse Global positions contain an unknown or duplicate node ${JSON.stringify(position.key)}.`,
        );
      }
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        throw new Error(
          `Sparse Global position has invalid coordinates for node ${position.key}.`,
        );
      }
      seen.add(position.key);
      return position;
    });
    if (validated.length === 0) return;
    const incidentEdges = new Set<string>();
    for (const position of validated) {
      const attributes = this.graph.getNodeAttributes(position.key) as {
        x: number;
        y: number;
      };
      // This renderer owns its Graphology attributes. Mutating the exact
      // coordinate fields avoids one Graphology event/refresh per member; the
      // single explicit Sigma refresh below is the authoritative notification.
      attributes.x = position.x;
      attributes.y = position.y;
      for (const edge of this.graph.edges(position.key)) {
        incidentEdges.add(edge);
      }
    }
    this.renderer.refresh({
      partialGraph: {
        nodes: validated.map(({ key }) => key),
        edges: [...incidentEdges],
      },
      skipIndexation: false,
      schedule: true,
    });
  }

  private viewportAnchorNodeKey(
    candidates?: ReadonlySet<string>,
  ): string | undefined {
    const survives = (key: string | undefined): key is string =>
      key !== undefined &&
      this.graph.hasNode(key) &&
      (candidates === undefined || candidates.has(key));
    if (survives(this.selectedNode)) {
      return this.selectedNode;
    }
    if (survives(this.semanticAnchorNodeKey)) return this.semanticAnchorNodeKey;
    const dimensions = this.renderer.getDimensions();
    const center = {
      x: dimensions.width / 2,
      y: dimensions.height / 2,
    };
    let nearest:
      { readonly key: string; readonly distanceSquared: number } | undefined;
    this.graph.forEachNode((key) => {
      if (!survives(key)) return;
      const point = this.nodeViewportPoint(key);
      if (point === undefined) return;
      const distanceSquared =
        (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
      if (
        nearest === undefined ||
        distanceSquared < nearest.distanceSquared ||
        (distanceSquared === nearest.distanceSquared && key < nearest.key)
      ) {
        nearest = { key, distanceSquared };
      }
    });
    return nearest?.key;
  }

  private centerReplacedScene(ratio: number): void {
    this.renderer.getCamera().setState({ x: 0.5, y: 0.5, angle: 0, ratio });
  }

  private anchorNodeAtViewport(
    key: string,
    point: GlobalViewportPoint,
    ratio: number,
  ): void {
    const node = this.renderer.getNodeDisplayData(key);
    if (node === undefined) return;
    const camera = this.renderer.getCamera();
    const cameraState = { ...camera.getState(), ratio };
    const current = this.renderer.viewportToFramedGraph(point, {
      cameraState,
      graphDimensions: this.renderer.getGraphDimensions(),
    });
    camera.setState({
      x: cameraState.x + Number(node.x) - current.x,
      y: cameraState.y + Number(node.y) - current.y,
      ratio,
    });
  }

  async center(request: GlobalCenterRequest): Promise<void> {
    const display = this.renderer.getNodeDisplayData(request.nodeId);
    if (display === undefined) {
      throw new Error(`Cannot center missing Global node ${request.nodeId}.`);
    }
    this.claimUserCamera();
    this.semanticAnchorNodeKey = request.nodeId;
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
    this.claimUserCamera();
    const camera = this.renderer.getCamera();
    camera.animate(
      { ratio: Math.max(0.02, Math.min(6, camera.ratio * factor)) },
      { duration: preferredMotionDuration() },
    );
  }

  fit(): void {
    this.cameraOwnership = 'auto';
    this.positionCameraIntent.claimCamera();
    this.semanticAnchorNodeKey = undefined;
    this.rebaseCurrentPositionFrame();
    void this.renderer.getCamera().animate(
      {
        x: 0.5,
        y: 0.5,
        ratio: 1,
        angle: 0,
      },
      { duration: preferredMotionDuration() },
    );
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
    this.cancelFolderArrangementGesture();
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
