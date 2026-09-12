import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type OnEdgesChange,
  type OnMove,
  type OnNodesChange,
  type ReactFlowInstance,
} from '@xyflow/react';

import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES } from './component-maps';
import {
  resolveGraphCenterRequest,
  shouldApplyGraphFitRequest,
} from './center-request';
import { EntityDisclosureProvider } from './disclosure-context';
import { shouldActivateEntityFocus } from './focus-interaction';
import { applyRendererInteractionState } from './highlight';
import { DocumentDirectHoverProvider } from './hover-context';
import {
  applyRendererLayoutPositions,
  createRendererLayoutInput,
  fallbackRendererGraph,
} from './layout';
import {
  beginRendererLayout,
  commitRendererLayout,
  INITIAL_RENDERER_LAYOUT_STATE,
} from './layout-state';
import {
  applyLocalStructuredPositions,
  localStructuredGraphPositions,
  localStructuredLayoutFingerprint,
  seedLocalStructuredGraph,
} from './local-structured-layout';
import { mapProjectionToReactFlow } from './mapping';
import { observeSemanticViewport } from './semantic-viewport';
import { VisualGroupPresentationProvider } from './visual-group-presentation';
import type {
  GraphCanvasProps,
  GraphFlowEdge,
  GraphFlowNode,
  GraphHoverTarget,
  GraphSelection,
  GraphTransitionAnchor,
  RendererGraph,
} from './types';
import {
  captureDisclosureAnchor,
  captureNodeAnchor,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  GRAPH_VIEWPORT_OBSERVATION_DELAY_MS,
  viewportAfterWheelZoom,
  viewportForDisclosureAnchor,
  viewportForPreservedPoint,
  viewportPointForNode,
  wheelActionForMode,
  type DisclosureAnchor,
} from './viewport-navigation';

const GRAPH_FIT_VIEW_OPTIONS = {
  duration: 0,
  padding: 0.14,
  maxZoom: 1.35,
} as const;

const GRAPH_WHEEL_IGNORE_SELECTOR =
  '.react-flow__controls, .nowheel, [data-graph-wheel-ignore], [data-graph-scroll-container]';

function FitGraphIcon() {
  return (
    <svg
      aria-hidden="true"
      className="graph-control-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <circle cx="8.5" cy="12.5" r="1.7" />
      <circle cx="15.5" cy="9.5" r="1.7" />
      <path d="m10 12 4-2" />
    </svg>
  );
}

function MaximizeGraphIcon() {
  return (
    <svg
      aria-hidden="true"
      className="graph-control-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M9 4H4v5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  );
}

function RestoreGraphIcon() {
  return (
    <svg
      aria-hidden="true"
      className="graph-control-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M4 9h5V4M20 9h-5V4M15 20v-5h5M9 20v-5H4" />
    </svg>
  );
}

function GraphCanvasInner({
  centerRequest,
  fitRequestKey,
  focusAppearance,
  initialTransitionAnchor,
  layoutCache,
  layoutMode,
  layoutRequestKey = 0,
  layoutService,
  maximized,
  onFitRequestConsumed,
  onMaximizedChange,
  onFocusEntity,
  onNodeContextMenuRequest,
  onPaneContextMenuRequest,
  onSelectionChange,
  onTransitionAnchorApiChange,
  onTransitionAnchorConsumed,
  onToggleEntity,
  onViewportObservation,
  performance,
  preparedGraph,
  preparedGraphPending = false,
  preparedGraphStatus,
  viewportOverlay,
  projection,
  rootEntityId,
  selection,
  trackpadZoomMode,
  visualVariant = 'extended',
}: GraphCanvasProps) {
  const [hovered, setHovered] = useState<GraphSelection | null>(null);
  const [documentDirectHover, setDocumentDirectHoverTarget] =
    useState<GraphHoverTarget | null>(null);
  const {
    fitView,
    getInternalNode,
    getViewport,
    screenToFlowPosition,
    setCenter,
    setViewport,
  } = useReactFlow<GraphFlowNode, GraphFlowEdge>();
  const nodesInitialized = useNodesInitialized();
  const previousFitRequest = useRef(fitRequestKey);
  const previousCenterRequest = useRef<number | null>(null);
  const handledTransitionRequest = useRef<number | null>(null);
  const initialTransitionRef = useRef(initialTransitionAnchor);
  const initialTransitionRefinementApplied = useRef(false);
  const [fitInitialViewport] = useState(
    () => centerRequest === undefined && initialTransitionAnchor === undefined,
  );
  const viewportInitialized = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextDisclosureAnchor = useRef<DisclosureAnchor | null>(null);
  const pendingStructuredAnchor = useRef<DisclosureAnchor | null>(null);
  const layoutGeneration = useRef(0);
  const appliedDisclosureGeneration = useRef<number | null>(null);
  const handledLayoutRequest = useRef(layoutRequestKey);
  const preparedRef = useRef<RendererGraph | null>(null);
  const viewportObservationTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [rendererLayout, setRendererLayout] = useState(
    INITIAL_RENDERER_LAYOUT_STATE,
  );
  const mapped = useMemo(() => {
    if (preparedGraph !== undefined) return { nodes: [], edges: [] };
    const map = () =>
      mapProjectionToReactFlow(projection, layoutMode, {
        visualVariant,
        ...(rootEntityId === undefined ? {} : { rootEntityId }),
      });
    return performance === undefined
      ? map()
      : performance.measure('renderer-mapping', 'renderer-mappings', map);
  }, [
    layoutMode,
    performance,
    preparedGraph,
    projection,
    rootEntityId,
    visualVariant,
  ]);
  const layoutInput = useMemo(
    () => createRendererLayoutInput(mapped.nodes, mapped.edges, layoutMode),
    [layoutMode, mapped.edges, mapped.nodes],
  );
  const structuredBaseline = useMemo(() => {
    if (preparedGraph !== undefined || layoutMode !== 'local-structured')
      return undefined;
    const rootNode = mapped.nodes.find(
      (node) => node.type === 'entity' && node.data.root,
    );
    if (rootNode === undefined) {
      throw new Error(
        `Focus Hierarchy requires its root entity ${rootEntityId ?? '(missing)'}.`,
      );
    }
    const fingerprint = localStructuredLayoutFingerprint(
      mapped.nodes,
      mapped.edges,
    );
    const cached = layoutCache?.get(fingerprint);
    return {
      cached: cached !== undefined,
      fingerprint,
      graph:
        cached === undefined
          ? seedLocalStructuredGraph(mapped.nodes, mapped.edges, rootNode.id)
          : applyLocalStructuredPositions(
              mapped.nodes,
              mapped.edges,
              cached,
              rootNode.id,
            ),
      rootNodeId: rootNode.id,
    };
  }, [
    layoutCache,
    layoutMode,
    mapped.edges,
    mapped.nodes,
    preparedGraph,
    rootEntityId,
  ]);
  const committedMatchesInput = rendererLayout.committed?.input === layoutInput;
  const classicPrepared = committedMatchesInput
    ? (rendererLayout.committed?.graph ?? null)
    : (structuredBaseline?.graph ?? rendererLayout.committed?.graph ?? null);
  const prepared = preparedGraph ?? classicPrepared;
  const layoutPending =
    preparedGraph === undefined
      ? projection.nodes.length > 0 &&
        !committedMatchesInput &&
        structuredBaseline?.cached !== true
      : preparedGraphPending;

  useLayoutEffect(() => {
    if (
      preparedGraph !== undefined ||
      structuredBaseline === undefined ||
      committedMatchesInput
    ) {
      return;
    }
    const oldGraph = rendererLayout.committed?.graph;
    const preferredNodeId =
      selection?.kind === 'node' &&
      structuredBaseline.graph.nodes.some(
        (node) => node.data.projectionNodeId === selection.id,
      )
        ? selection.id
        : structuredBaseline.graph.nodes.find(
            (node) => node.type === 'entity' && node.data.root,
          )?.data.projectionNodeId;
    if (preferredNodeId === null) return;
    const anchor =
      nextDisclosureAnchor.current ??
      (oldGraph === undefined || preferredNodeId === undefined
        ? null
        : captureNodeAnchor(oldGraph, preferredNodeId, getViewport()));
    nextDisclosureAnchor.current = null;
    pendingStructuredAnchor.current = anchor;
    if (anchor === null) return;
    const nextViewport = viewportForDisclosureAnchor(
      structuredBaseline.graph,
      anchor,
    );
    if (nextViewport === null) return;
    void setViewport(nextViewport, { duration: 0 });
  }, [
    committedMatchesInput,
    getViewport,
    rendererLayout.committed?.graph,
    preparedGraph,
    selection,
    setViewport,
    structuredBaseline,
  ]);

  useEffect(() => {
    if (preparedGraph !== undefined) {
      layoutService?.cancelPending();
      return;
    }
    if (layoutService === undefined) {
      throw new Error('Classic GraphCanvas requires a layout service.');
    }
    if (projection.nodes.length === 0) {
      layoutService.cancelPending();
      return;
    }
    const generation = ++layoutGeneration.current;
    const explicitRelayout = layoutRequestKey > handledLayoutRequest.current;
    handledLayoutRequest.current = layoutRequestKey;
    const disclosureAnchor =
      pendingStructuredAnchor.current ?? nextDisclosureAnchor.current;
    pendingStructuredAnchor.current = null;
    nextDisclosureAnchor.current = null;
    if (structuredBaseline?.cached === true && !explicitRelayout) {
      layoutService.cancelPending();
      setRendererLayout({
        pendingGeneration: null,
        committed: {
          generation,
          input: layoutInput,
          graph: structuredBaseline.graph,
          disclosureAnchor,
        },
      });
      return;
    }
    const requestStartedAt =
      performance === undefined ? 0 : globalThis.performance.now();
    let current = true;
    setRendererLayout((state) => beginRendererLayout(state, generation));
    performance?.count('layouts');
    void layoutService
      .layoutLatest(layoutInput)
      .then((result) => {
        if (!current || result.status === 'superseded') return;
        performance?.record('dagre-layout', result.metrics.workerComputeMs);
        performance?.record(
          'dagre-worker-compute',
          result.metrics.workerComputeMs,
        );
        performance?.record(
          'dagre-worker-round-trip',
          result.metrics.workerRoundTripMs,
        );
        performance?.record(
          'dagre-worker-startup',
          result.metrics.workerStartupMs,
        );
        if (result.metrics.mainThreadHighGapMs !== undefined) {
          performance?.record(
            'dagre-main-thread-gap',
            result.metrics.mainThreadHighGapMs,
          );
        }
        const apply = () => {
          if (result.status === 'success') {
            const laidOut = applyRendererLayoutPositions(
              mapped.nodes,
              mapped.edges,
              layoutMode,
              result.output,
            );
            if (structuredBaseline === undefined) return laidOut;
            const normalized = applyLocalStructuredPositions(
              laidOut.nodes,
              laidOut.edges,
              localStructuredGraphPositions(laidOut),
              structuredBaseline.rootNodeId,
            );
            layoutCache?.set(
              structuredBaseline.fingerprint,
              localStructuredGraphPositions(normalized),
            );
            return normalized;
          }
          return structuredBaseline === undefined
            ? fallbackRendererGraph(
                mapped.nodes,
                mapped.edges,
                layoutMode,
                result.message,
              )
            : {
                ...structuredBaseline.graph,
                layoutWarning: `Automatic Focus Hierarchy layout failed: ${result.message} The deterministic seed remains visible.`,
              };
        };
        const graph =
          performance === undefined
            ? apply()
            : performance.measure('dagre-result-apply', undefined, apply);
        if (performance !== undefined) {
          performance.record(
            'dagre-request-adoption',
            Math.max(0, globalThis.performance.now() - requestStartedAt),
          );
        }
        setRendererLayout((state) =>
          commitRendererLayout(state, {
            generation,
            input: layoutInput,
            graph,
            disclosureAnchor,
          }),
        );
      })
      .catch((error: unknown) => {
        if (!current) return;
        const message = error instanceof Error ? error.message : String(error);
        const graph =
          structuredBaseline === undefined
            ? fallbackRendererGraph(
                mapped.nodes,
                mapped.edges,
                layoutMode,
                message,
              )
            : {
                ...structuredBaseline.graph,
                layoutWarning: `Automatic Focus Hierarchy layout failed: ${message} The deterministic seed remains visible.`,
              };
        setRendererLayout((state) =>
          commitRendererLayout(state, {
            generation,
            input: layoutInput,
            graph,
            disclosureAnchor,
          }),
        );
      });
    return () => {
      current = false;
    };
  }, [
    layoutInput,
    layoutMode,
    layoutRequestKey,
    layoutService,
    mapped.edges,
    mapped.nodes,
    performance,
    preparedGraph,
    projection.nodes.length,
    layoutCache,
    structuredBaseline,
  ]);
  const interactive = useMemo(() => {
    if (prepared === null) return null;
    const apply = () =>
      applyRendererInteractionState(
        prepared,
        documentDirectHover ?? hovered,
        selection,
      );
    return performance === undefined
      ? apply()
      : performance.measure('highlight', 'highlight-applications', apply);
  }, [documentDirectHover, hovered, performance, prepared, selection]);
  const nodes = useMemo(
    () => (interactive === null ? [] : [...interactive.nodes]),
    [interactive],
  );
  const edges = useMemo(
    () => (interactive === null ? [] : [...interactive.edges]),
    [interactive],
  );

  const applyCenterRequest = useCallback(
    (
      request: GraphCanvasProps['centerRequest'],
      center: typeof setCenter = setCenter,
    ) => {
      if (layoutPending || prepared === null) return;
      const resolved = resolveGraphCenterRequest(
        prepared,
        request,
        previousCenterRequest.current,
      );
      if (resolved === null) return;
      previousCenterRequest.current = resolved.handledKey;
      if (resolved.instruction === null) return;
      const { x, y, zoom } = resolved.instruction;
      const boundedZoom =
        zoom === undefined
          ? undefined
          : Math.min(GRAPH_MAX_ZOOM, Math.max(GRAPH_MIN_ZOOM, zoom));
      void center(x, y, {
        duration: 0,
        ...(boundedZoom === undefined ? {} : { zoom: boundedZoom }),
      });
    },
    [layoutPending, prepared, setCenter],
  );
  const nodeViewportPoint = useCallback(
    (nodeId: GraphTransitionAnchor['nodeId']) => {
      const graph = preparedRef.current;
      if (graph === null) return undefined;
      const node = graph.nodes.find(
        (candidate) => candidate.data.projectionNodeId === nodeId,
      );
      if (node === undefined) return undefined;
      // React Flow may hold zero/unfinished measured dimensions in its runtime
      // node while the visible fixed-size card is already painted. Capture the
      // actual card center first so a cross-mount transition cannot anchor the
      // card's top-left corner by accident.
      const nodeElement = [
        ...(containerRef.current?.querySelectorAll<HTMLElement>(
          '.react-flow__node',
        ) ?? []),
      ].find((candidate) => candidate.dataset.id === node.id);
      const flowElement = nodeElement?.closest<HTMLElement>('.react-flow');
      if (
        nodeElement !== undefined &&
        flowElement !== null &&
        flowElement !== undefined
      ) {
        const nodeRect = nodeElement.getBoundingClientRect();
        const flowRect = flowElement.getBoundingClientRect();
        if (
          Number.isFinite(nodeRect.left) &&
          Number.isFinite(nodeRect.top) &&
          Number.isFinite(nodeRect.width) &&
          Number.isFinite(nodeRect.height)
        ) {
          return {
            x: nodeRect.left - flowRect.left + nodeRect.width / 2,
            y: nodeRect.top - flowRect.top + nodeRect.height / 2,
          };
        }
      }
      const viewport = getViewport();
      const internalNode = getInternalNode(node.id);
      const measuredWidth = internalNode?.measured.width;
      const measuredHeight = internalNode?.measured.height;
      const runtimeBounds =
        internalNode === undefined ||
        measuredWidth === undefined ||
        measuredHeight === undefined
          ? undefined
          : {
              x: internalNode.internals.positionAbsolute.x,
              y: internalNode.internals.positionAbsolute.y,
              width: measuredWidth,
              height: measuredHeight,
            };
      return (
        viewportPointForNode(graph, nodeId, viewport, runtimeBounds) ??
        undefined
      );
    },
    [getInternalNode, getViewport],
  );
  const stageNodeAnchor = useCallback(
    (nodeId: GraphTransitionAnchor['nodeId']) => {
      const graph = preparedRef.current;
      const point = nodeViewportPoint(nodeId);
      const viewport = getViewport();
      const node = graph?.nodes.find(
        (candidate) => candidate.data.projectionNodeId === nodeId,
      );
      if (
        graph === null ||
        node === undefined ||
        point === undefined ||
        !Number.isFinite(viewport.zoom) ||
        viewport.zoom <= 0
      ) {
        return false;
      }
      nextDisclosureAnchor.current = {
        projectionNodeId: nodeId,
        entityId: node.type === 'entity' ? node.data.entityId : null,
        screenPoint: point,
        zoom: viewport.zoom,
      };
      return true;
    },
    [getViewport, nodeViewportPoint],
  );

  useLayoutEffect(() => {
    preparedRef.current = prepared;
  }, [prepared]);

  useEffect(() => {
    if (onTransitionAnchorApiChange === undefined) return;
    const api = { nodeViewportPoint, stageNodeAnchor };
    onTransitionAnchorApiChange(api);
    return () => onTransitionAnchorApiChange(undefined);
  }, [nodeViewportPoint, onTransitionAnchorApiChange, stageNodeAnchor]);

  const initializeViewport = useCallback(
    (instance: ReactFlowInstance<GraphFlowNode, GraphFlowEdge>) => {
      viewportInitialized.current = true;
      if (
        initialTransitionAnchor !== undefined &&
        handledTransitionRequest.current !== initialTransitionAnchor.key
      )
        return;
      applyCenterRequest(centerRequest, instance.setCenter);
    },
    [applyCenterRequest, centerRequest, initialTransitionAnchor],
  );

  useEffect(() => {
    if (!viewportInitialized.current) return;
    if (
      initialTransitionAnchor !== undefined &&
      handledTransitionRequest.current !== initialTransitionAnchor.key
    )
      return;
    applyCenterRequest(centerRequest);
  }, [applyCenterRequest, centerRequest, initialTransitionAnchor]);

  const selectNode = useCallback<NodeMouseHandler<GraphFlowNode>>(
    (_event, node) => {
      if (node.data.projectionNodeId !== null)
        onSelectionChange({ kind: 'node', id: node.data.projectionNodeId });
    },
    [onSelectionChange],
  );
  const focusNode = useCallback<NodeMouseHandler<GraphFlowNode>>(
    (_event, node) => {
      if (node.type !== 'entity' || onFocusEntity === undefined) return;
      onSelectionChange({ kind: 'node', id: node.data.projectionNodeId });
      onFocusEntity(node.data.entityId);
    },
    [onFocusEntity, onSelectionChange],
  );
  const selectEdge = useCallback<EdgeMouseHandler<GraphFlowEdge>>(
    (_event, edge) => {
      const projectionEdgeId = edge.data?.projectionEdgeId;
      if (projectionEdgeId !== undefined && projectionEdgeId !== null) {
        onSelectionChange({ kind: 'edge', id: projectionEdgeId });
      }
    },
    [onSelectionChange],
  );
  const hoverNode = useCallback<NodeMouseHandler<GraphFlowNode>>(
    (_event, node) => {
      if (node.data.projectionNodeId !== null)
        setHovered({ kind: 'node', id: node.data.projectionNodeId });
    },
    [],
  );
  const hoverEdge = useCallback<EdgeMouseHandler<GraphFlowEdge>>(
    (_event, edge) => {
      const projectionEdgeId = edge.data?.projectionEdgeId;
      if (projectionEdgeId !== undefined && projectionEdgeId !== null) {
        setHovered({ kind: 'edge', id: projectionEdgeId });
      }
    },
    [],
  );
  const clearHover = useCallback(() => setHovered(null), []);
  const setDocumentDirectHover = useCallback(
    (nodeId: string, active: boolean) =>
      setDocumentDirectHoverTarget((current) =>
        active
          ? { kind: 'document-direct', id: nodeId }
          : current?.kind === 'document-direct' && current.id === nodeId
            ? null
            : current,
      ),
    [],
  );
  const clearSelection = useCallback(
    () => onSelectionChange(null),
    [onSelectionChange],
  );
  const syncNodeChanges = useCallback<OnNodesChange<GraphFlowNode>>(
    (changes) => {
      const selectedChange = changes.find(
        (change) => change.type === 'select' && change.selected,
      );
      if (selectedChange?.type === 'select') {
        const selectedNode = nodes.find(
          (candidate) => candidate.id === selectedChange.id,
        );
        if (
          selectedNode !== undefined &&
          selectedNode.data.projectionNodeId !== null
        ) {
          onSelectionChange({
            kind: 'node',
            id: selectedNode.data.projectionNodeId,
          });
        }
      }
    },
    [nodes, onSelectionChange],
  );
  const syncEdgeChanges = useCallback<OnEdgesChange<GraphFlowEdge>>(
    (changes) => {
      const selectedChange = changes.find(
        (change) => change.type === 'select' && change.selected,
      );
      if (selectedChange?.type === 'select') {
        const projectionEdgeId = edges.find(
          (candidate) => candidate.id === selectedChange.id,
        )?.data?.projectionEdgeId;
        if (projectionEdgeId !== undefined && projectionEdgeId !== null) {
          onSelectionChange({ kind: 'edge', id: projectionEdgeId });
        }
      }
    },
    [edges, onSelectionChange],
  );
  const reportViewport = useCallback(
    (viewport: ReturnType<typeof getViewport>) => {
      if (
        layoutPending ||
        onViewportObservation === undefined ||
        prepared === null
      )
        return;
      const bounds = containerRef.current?.getBoundingClientRect();
      if (bounds === undefined) return;
      performance?.count('viewport-operations');
      onViewportObservation(
        observeSemanticViewport(prepared, viewport, {
          width: bounds.width,
          height: bounds.height,
        }),
      );
    },
    [layoutPending, onViewportObservation, performance, prepared],
  );
  const scheduleViewportObservation = useCallback(
    (viewport?: ReturnType<typeof getViewport>) => {
      if (onViewportObservation === undefined) return;
      if (viewportObservationTimer.current !== null) {
        clearTimeout(viewportObservationTimer.current);
      }
      viewportObservationTimer.current = setTimeout(() => {
        viewportObservationTimer.current = null;
        reportViewport(viewport ?? getViewport());
      }, GRAPH_VIEWPORT_OBSERVATION_DELAY_MS);
    },
    [getViewport, onViewportObservation, reportViewport],
  );
  const fitGraph = useCallback(async () => {
    if (layoutPending || prepared === null) return;
    await fitView(GRAPH_FIT_VIEW_OPTIONS);
    reportViewport(getViewport());
  }, [fitView, getViewport, layoutPending, prepared, reportViewport]);

  useEffect(() => {
    if (layoutPending || prepared === null) return;
    if (
      !shouldApplyGraphFitRequest(
        previousFitRequest.current,
        fitRequestKey,
        centerRequest,
      )
    ) {
      if (centerRequest !== undefined) {
        previousFitRequest.current = fitRequestKey;
      }
      return;
    }
    previousFitRequest.current = fitRequestKey;
    void fitGraph().then(() => onFitRequestConsumed?.(fitRequestKey));
  }, [
    centerRequest,
    fitGraph,
    fitRequestKey,
    layoutPending,
    onFitRequestConsumed,
    prepared,
  ]);

  useEffect(
    () => () => {
      if (viewportObservationTimer.current !== null) {
        clearTimeout(viewportObservationTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const handleWheel = (event: WheelEvent): void => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(GRAPH_WHEEL_IGNORE_SELECTOR) !== null
      ) {
        return;
      }
      if (wheelActionForMode(trackpadZoomMode, event.ctrlKey) === 'pan') {
        return;
      }
      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      event.preventDefault();
      event.stopPropagation();
      const nextViewport = viewportAfterWheelZoom(getViewport(), {
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey,
        pointer: {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        },
      });
      void setViewport(nextViewport, { duration: 0 });
      scheduleViewportObservation(nextViewport);
    };
    container.addEventListener('wheel', handleWheel, {
      capture: true,
      passive: false,
    });
    return () => container.removeEventListener('wheel', handleWheel, true);
  }, [getViewport, scheduleViewportObservation, setViewport, trackpadZoomMode]);

  const toggleEntityAnchored = useCallback(
    (entityId: string, currentlyOpen: boolean) => {
      if (layoutPending || prepared === null) return;
      nextDisclosureAnchor.current = captureDisclosureAnchor(
        prepared,
        entityId,
        getViewport(),
      );
      onToggleEntity(entityId, currentlyOpen);
    },
    [getViewport, layoutPending, onToggleEntity, prepared],
  );

  useLayoutEffect(() => {
    if (preparedGraph !== undefined) {
      if (preparedGraphPending) return;
      const anchor = nextDisclosureAnchor.current;
      if (anchor === null) return;
      nextDisclosureAnchor.current = null;
      const nextViewport = viewportForDisclosureAnchor(preparedGraph, anchor);
      if (nextViewport === null) return;
      void setViewport(nextViewport, { duration: 0 });
      reportViewport(nextViewport);
      return;
    }
    const committed = rendererLayout.committed;
    if (
      committed === null ||
      committed.disclosureAnchor === null ||
      appliedDisclosureGeneration.current === committed.generation
    )
      return;
    appliedDisclosureGeneration.current = committed.generation;
    const anchor = committed.disclosureAnchor;
    const nextViewport = viewportForDisclosureAnchor(committed.graph, anchor);
    if (nextViewport === null) return;
    void setViewport(nextViewport, { duration: 0 });
    reportViewport(nextViewport);
  }, [
    prepared,
    preparedGraph,
    preparedGraphPending,
    rendererLayout.committed,
    reportViewport,
    setViewport,
  ]);

  useEffect(() => {
    const committedGraph = preparedGraph ?? rendererLayout.committed?.graph;
    const anchor = initialTransitionRef.current;
    if (
      committedGraph === undefined ||
      anchor === undefined ||
      (preparedGraph !== undefined && preparedGraphPending) ||
      !nodesInitialized ||
      initialTransitionRefinementApplied.current
    ) {
      return;
    }
    let frame = 0;
    let attemptsRemaining = 4;
    const refine = () => {
      if (initialTransitionRefinementApplied.current) return;
      const node = committedGraph.nodes.find(
        (candidate) => candidate.data.projectionNodeId === anchor.nodeId,
      );
      const nodeElement = [
        ...(containerRef.current?.querySelectorAll<HTMLElement>(
          '.react-flow__node',
        ) ?? []),
      ].find((candidate) => candidate.dataset.id === node?.id);
      const flowElement = nodeElement?.closest<HTMLElement>('.react-flow');
      if (
        node === undefined ||
        nodeElement === undefined ||
        flowElement === null ||
        flowElement === undefined
      ) {
        attemptsRemaining -= 1;
        if (attemptsRemaining > 0) frame = requestAnimationFrame(refine);
        return;
      }
      const nodeRect = nodeElement.getBoundingClientRect();
      const flowRect = flowElement.getBoundingClientRect();
      if (
        nodeRect.width <= 0 ||
        nodeRect.height <= 0 ||
        flowRect.width <= 0 ||
        flowRect.height <= 0
      ) {
        attemptsRemaining -= 1;
        if (attemptsRemaining > 0) frame = requestAnimationFrame(refine);
        return;
      }
      const currentViewport = getViewport();
      const targetZoom = Math.min(
        GRAPH_MAX_ZOOM,
        Math.max(GRAPH_MIN_ZOOM, anchor.zoom ?? currentViewport.zoom),
      );
      const viewport = viewportForPreservedPoint(
        currentViewport,
        {
          x: nodeRect.left - flowRect.left + nodeRect.width / 2,
          y: nodeRect.top - flowRect.top + nodeRect.height / 2,
        },
        anchor.point,
        targetZoom,
      );
      if (viewport === null) return;
      initialTransitionRefinementApplied.current = true;
      handledTransitionRequest.current = anchor.key;
      if (centerRequest !== undefined) {
        previousCenterRequest.current = centerRequest.key;
      }
      void setViewport(viewport, { duration: 0 });
      onTransitionAnchorConsumed?.(anchor.key);
      reportViewport(viewport);
    };
    frame = requestAnimationFrame(refine);
    return () => cancelAnimationFrame(frame);
  }, [
    centerRequest,
    getViewport,
    nodesInitialized,
    onTransitionAnchorConsumed,
    preparedGraph,
    preparedGraphPending,
    rendererLayout.committed,
    reportViewport,
    setViewport,
  ]);

  useLayoutEffect(() => {
    if (performance === undefined) return;
    performance.markCommit('graph-canvas-commit');
    performance.markNextPaint();
  });

  const observeViewport = useCallback<OnMove>(
    (event, viewport) => {
      if (event === null) return;
      reportViewport(viewport);
    },
    [reportViewport],
  );

  const activateFocusedNode = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const originatesInControl =
        target.closest(
          'button, input, select, textarea, a[href], [contenteditable]:not([contenteditable="false"])',
        ) !== null;
      const flowNode = target.closest('.react-flow__node');
      if (
        onNodeContextMenuRequest !== undefined &&
        (event.key === 'ContextMenu' ||
          (event.key === 'F10' && event.shiftKey)) &&
        flowNode instanceof HTMLElement
      ) {
        const node = nodes.find(
          (candidate) => candidate.id === flowNode.dataset.id,
        );
        if (node !== undefined) {
          const rect = flowNode.getBoundingClientRect();
          event.preventDefault();
          event.stopPropagation();
          onNodeContextMenuRequest({
            node,
            x: rect.left + Math.min(32, rect.width / 2),
            y: rect.top + Math.min(32, rect.height / 2),
            origin: flowNode,
          });
          return;
        }
      }
      if (onFocusEntity === undefined) return;
      const entityCard = flowNode?.querySelector<HTMLElement>(
        '.entity-card[data-entity-id][data-projection-node-id]',
      );
      if (
        !shouldActivateEntityFocus({
          key: event.key,
          repeat: event.repeat,
          hasCanonicalEntityTarget:
            entityCard !== undefined && entityCard !== null,
          originatesInControl,
        }) ||
        entityCard === undefined ||
        entityCard === null
      ) {
        return;
      }
      const entityId = entityCard.dataset.entityId;
      const projectionNodeId = entityCard.dataset.projectionNodeId;
      if (entityId === undefined || projectionNodeId === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      onSelectionChange({ kind: 'node', id: projectionNodeId });
      onFocusEntity(entityId);
    },
    [nodes, onFocusEntity, onNodeContextMenuRequest, onSelectionChange],
  );
  const openNodeContextMenu = useCallback<NodeMouseHandler<GraphFlowNode>>(
    (event, node) => {
      if (onNodeContextMenuRequest === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      onNodeContextMenuRequest({
        node,
        x: event.clientX,
        y: event.clientY,
        origin:
          event.currentTarget instanceof HTMLElement
            ? event.currentTarget
            : null,
      });
    },
    [onNodeContextMenuRequest],
  );
  const openPaneContextMenu = useCallback(
    (event: ReactMouseEvent | MouseEvent) => {
      if (onPaneContextMenuRequest === undefined) return;
      const opened = onPaneContextMenuRequest({
        x: event.clientX,
        y: event.clientY,
        world: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
      if (!opened) return;
      event.preventDefault();
      event.stopPropagation();
    },
    [onPaneContextMenuRequest, screenToFlowPosition],
  );

  if (projection.nodes.length === 0) {
    return (
      <div className="graph-empty" role="status">
        <strong>No nodes match this view.</strong>
        <span>Exit focus or adjust the graph controls to restore context.</span>
      </div>
    );
  }

  if (prepared === null) {
    return (
      <div
        className="graph-layout-pending graph-empty"
        data-focus-appearance={focusAppearance}
        data-trackpad-zoom-mode={trackpadZoomMode}
        data-visual-variant={visualVariant}
      >
        <div role="status" aria-live="polite">
          <strong>{preparedGraphStatus ?? 'Laying out graph…'}</strong>
          <span>
            The graph will remain interactive after positions are ready.
          </span>
        </div>
        {onMaximizedChange === undefined ? null : (
          <button
            aria-label={maximized === true ? 'Restore graph' : 'Maximize graph'}
            aria-pressed={maximized === true}
            className="graph-layout-pending__maximize"
            onClick={() => onMaximizedChange(maximized !== true)}
            title={maximized === true ? 'Restore graph' : 'Maximize graph'}
            type="button"
          >
            {maximized === true ? <RestoreGraphIcon /> : <MaximizeGraphIcon />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="graph-canvas"
      aria-label="Projected knowledge graph"
      aria-busy={layoutPending}
      data-focus-appearance={focusAppearance}
      data-trackpad-zoom-mode={trackpadZoomMode}
      data-visual-variant={visualVariant}
      onKeyDownCapture={activateFocusedNode}
      ref={containerRef}
      role="region"
    >
      {prepared.layoutWarning === null ? null : (
        <p className="graph-layout-warning" role="alert">
          {prepared.layoutWarning}
        </p>
      )}
      {layoutPending ? (
        <p className="graph-layout-status" role="status" aria-live="polite">
          {preparedGraphStatus ?? 'Updating layout…'}
        </p>
      ) : null}
      <EntityDisclosureProvider
        disabled={layoutPending}
        onToggleEntity={toggleEntityAnchored}
      >
        <DocumentDirectHoverProvider
          setDocumentDirectHover={setDocumentDirectHover}
        >
          <ReactFlow<GraphFlowNode, GraphFlowEdge>
            aria-label="Interactive projected knowledge graph"
            colorMode="light"
            deleteKeyCode={null}
            edgeTypes={GRAPH_EDGE_TYPES}
            edges={edges}
            edgesFocusable
            edgesReconnectable={false}
            elementsSelectable
            fitView={fitInitialViewport}
            fitViewOptions={GRAPH_FIT_VIEW_OPTIONS}
            maxZoom={GRAPH_MAX_ZOOM}
            minZoom={GRAPH_MIN_ZOOM}
            nodeTypes={GRAPH_NODE_TYPES}
            nodes={nodes}
            nodesConnectable={false}
            nodesDraggable={false}
            nodesFocusable
            onEdgeClick={selectEdge}
            onEdgeMouseEnter={hoverEdge}
            onEdgeMouseLeave={clearHover}
            onEdgesChange={syncEdgeChanges}
            onInit={initializeViewport}
            onNodeClick={selectNode}
            onNodeContextMenu={openNodeContextMenu}
            onNodeDoubleClick={focusNode}
            onNodeMouseEnter={hoverNode}
            onNodeMouseLeave={clearHover}
            onNodesChange={syncNodeChanges}
            onMoveEnd={observeViewport}
            onPaneClick={clearSelection}
            onPaneContextMenu={openPaneContextMenu}
            panOnDrag
            panOnScroll={trackpadZoomMode === 'pinch-zoom'}
            proOptions={{ hideAttribution: false }}
            selectionOnDrag={false}
            zoomOnDoubleClick={false}
            zoomOnPinch
            zoomOnScroll={false}
          >
            <Background
              color="#cbd5da"
              gap={24}
              variant={BackgroundVariant.Dots}
            />
            {viewportOverlay}
            <Controls
              aria-label="Graph viewport controls"
              fitViewOptions={GRAPH_FIT_VIEW_OPTIONS}
              onZoomIn={() => scheduleViewportObservation()}
              onZoomOut={() => scheduleViewportObservation()}
              showFitView={false}
              showInteractive={false}
            >
              <ControlButton
                aria-label="Fit graph to view"
                className="graph-control-button--fit"
                disabled={layoutPending}
                onClick={() => void fitGraph()}
                title="Fit graph to view"
              >
                <FitGraphIcon />
              </ControlButton>
              {onMaximizedChange === undefined ? null : (
                <ControlButton
                  aria-label={
                    maximized === true ? 'Restore graph' : 'Maximize graph'
                  }
                  aria-pressed={maximized === true}
                  className="graph-control-button--maximize"
                  onClick={() => onMaximizedChange(maximized !== true)}
                  title={
                    maximized === true ? 'Restore graph' : 'Maximize graph'
                  }
                >
                  {maximized === true ? (
                    <RestoreGraphIcon />
                  ) : (
                    <MaximizeGraphIcon />
                  )}
                </ControlButton>
              )}
            </Controls>
          </ReactFlow>
        </DocumentDirectHoverProvider>
      </EntityDisclosureProvider>
    </div>
  );
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <VisualGroupPresentationProvider styles={props.visualGroupStyles}>
      <ReactFlowProvider>
        <GraphCanvasInner {...props} />
      </ReactFlowProvider>
    </VisualGroupPresentationProvider>
  );
}
