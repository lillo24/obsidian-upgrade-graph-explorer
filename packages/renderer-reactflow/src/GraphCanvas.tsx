import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type OnEdgesChange,
  type OnMove,
  type OnNodesChange,
  type OnSelectionChangeFunc,
  type ReactFlowInstance,
} from '@xyflow/react';

import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES } from './component-maps';
import { resolveGraphCenterRequest } from './center-request';
import { EntityDisclosureProvider } from './disclosure-context';
import { shouldActivateEntityFocus } from './focus-interaction';
import { applyRendererInteractionState } from './highlight';
import { prepareRendererGraph } from './prepare';
import { observeSemanticViewport } from './semantic-viewport';
import type {
  GraphCanvasProps,
  GraphFlowEdge,
  GraphFlowNode,
  GraphSelection,
} from './types';
import {
  captureDisclosureAnchor,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  GRAPH_VIEWPORT_OBSERVATION_DELAY_MS,
  viewportAfterWheelZoom,
  viewportForDisclosureAnchor,
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
  expandedEntityIds,
  fitRequestKey,
  focusAppearance,
  layoutMode,
  maximized,
  onMaximizedChange,
  onFocusEntity,
  onSelectionChange,
  onToggleEntity,
  onViewportObservation,
  performance,
  projection,
  selection,
  trackpadZoomMode,
}: GraphCanvasProps) {
  const [hovered, setHovered] = useState<GraphSelection | null>(null);
  const { fitView, getViewport, setCenter, setViewport } = useReactFlow<
    GraphFlowNode,
    GraphFlowEdge
  >();
  const previousFitRequest = useRef(fitRequestKey);
  const previousCenterRequest = useRef<number | null>(null);
  const viewportInitialized = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingDisclosureAnchor = useRef<DisclosureAnchor | null>(null);
  const viewportObservationTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const prepared = useMemo(
    () =>
      prepareRendererGraph(projection, {
        layoutMode,
        expandedEntityIds,
        ...(performance === undefined ? {} : { performance }),
      }),
    [expandedEntityIds, layoutMode, performance, projection],
  );
  const interactive = useMemo(() => {
    const apply = () =>
      applyRendererInteractionState(prepared, hovered, selection);
    return performance === undefined
      ? apply()
      : performance.measure('highlight', 'highlight-applications', apply);
  }, [hovered, performance, prepared, selection]);
  const nodes = useMemo(() => [...interactive.nodes], [interactive.nodes]);
  const edges = useMemo(() => [...interactive.edges], [interactive.edges]);

  const applyCenterRequest = useCallback(
    (
      request: GraphCanvasProps['centerRequest'],
      center: typeof setCenter = setCenter,
    ) => {
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
    [prepared, setCenter],
  );
  const initializeViewport = useCallback(
    (instance: ReactFlowInstance<GraphFlowNode, GraphFlowEdge>) => {
      viewportInitialized.current = true;
      applyCenterRequest(centerRequest, instance.setCenter);
    },
    [applyCenterRequest, centerRequest],
  );

  useEffect(() => {
    if (!viewportInitialized.current) return;
    applyCenterRequest(centerRequest);
  }, [applyCenterRequest, centerRequest]);

  const selectNode = useCallback<NodeMouseHandler<GraphFlowNode>>(
    (_event, node) =>
      onSelectionChange({ kind: 'node', id: node.data.projectionNodeId }),
    [onSelectionChange],
  );
  const focusNode = useCallback<NodeMouseHandler<GraphFlowNode>>(
    (_event, node) => {
      if (node.type !== 'entity') return;
      onSelectionChange({ kind: 'node', id: node.data.projectionNodeId });
      onFocusEntity(node.data.entityId);
    },
    [onFocusEntity, onSelectionChange],
  );
  const selectEdge = useCallback<EdgeMouseHandler<GraphFlowEdge>>(
    (_event, edge) => {
      const projectionEdgeId = edge.data?.projectionEdgeId;
      if (projectionEdgeId !== undefined) {
        onSelectionChange({ kind: 'edge', id: projectionEdgeId });
      }
    },
    [onSelectionChange],
  );
  const hoverNode = useCallback<NodeMouseHandler<GraphFlowNode>>(
    (_event, node) =>
      setHovered({ kind: 'node', id: node.data.projectionNodeId }),
    [],
  );
  const hoverEdge = useCallback<EdgeMouseHandler<GraphFlowEdge>>(
    (_event, edge) => {
      const projectionEdgeId = edge.data?.projectionEdgeId;
      if (projectionEdgeId !== undefined) {
        setHovered({ kind: 'edge', id: projectionEdgeId });
      }
    },
    [],
  );
  const clearHover = useCallback(() => setHovered(null), []);
  const clearSelection = useCallback(
    () => onSelectionChange(null),
    [onSelectionChange],
  );
  const syncKeyboardSelection = useCallback<
    OnSelectionChangeFunc<GraphFlowNode, GraphFlowEdge>
  >(
    ({ edges: selectedEdges, nodes: selectedNodes }) => {
      const selectedNode = selectedNodes[0];
      if (selectedNode !== undefined) {
        onSelectionChange({
          kind: 'node',
          id: selectedNode.data.projectionNodeId,
        });
        return;
      }
      const selectedEdge = selectedEdges[0];
      const projectionEdgeId = selectedEdge?.data?.projectionEdgeId;
      onSelectionChange(
        projectionEdgeId === undefined
          ? null
          : { kind: 'edge', id: projectionEdgeId },
      );
    },
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
        if (selectedNode !== undefined) {
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
        if (projectionEdgeId !== undefined) {
          onSelectionChange({ kind: 'edge', id: projectionEdgeId });
        }
      }
    },
    [edges, onSelectionChange],
  );
  const reportViewport = useCallback(
    (viewport: ReturnType<typeof getViewport>) => {
      if (onViewportObservation === undefined) return;
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
    [onViewportObservation, performance, prepared],
  );
  const scheduleViewportObservation = useCallback(
    (viewport: ReturnType<typeof getViewport>) => {
      if (onViewportObservation === undefined) return;
      if (viewportObservationTimer.current !== null) {
        clearTimeout(viewportObservationTimer.current);
      }
      viewportObservationTimer.current = setTimeout(() => {
        viewportObservationTimer.current = null;
        reportViewport(viewport);
      }, GRAPH_VIEWPORT_OBSERVATION_DELAY_MS);
    },
    [onViewportObservation, reportViewport],
  );
  const fitGraph = useCallback(async () => {
    await fitView(GRAPH_FIT_VIEW_OPTIONS);
    reportViewport(getViewport());
  }, [fitView, getViewport, reportViewport]);

  useEffect(() => {
    if (previousFitRequest.current === fitRequestKey) return;
    previousFitRequest.current = fitRequestKey;
    void fitGraph();
  }, [fitGraph, fitRequestKey]);

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
      pendingDisclosureAnchor.current = captureDisclosureAnchor(
        prepared,
        entityId,
        getViewport(),
      );
      onToggleEntity(entityId, currentlyOpen);
    },
    [getViewport, onToggleEntity, prepared],
  );

  useLayoutEffect(() => {
    const anchor = pendingDisclosureAnchor.current;
    if (anchor === null) return;
    pendingDisclosureAnchor.current = null;
    const nextViewport = viewportForDisclosureAnchor(prepared, anchor);
    if (nextViewport === null) return;
    void setViewport(nextViewport, { duration: 0 });
    reportViewport(nextViewport);
  }, [prepared, reportViewport, setViewport]);

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
    [onFocusEntity, onSelectionChange],
  );

  if (projection.nodes.length === 0) {
    return (
      <div className="graph-empty" role="status">
        <strong>No nodes match this view.</strong>
        <span>Exit focus or adjust the graph controls to restore context.</span>
      </div>
    );
  }

  return (
    <div
      className="graph-canvas"
      aria-label="Projected knowledge graph"
      data-focus-appearance={focusAppearance}
      data-trackpad-zoom-mode={trackpadZoomMode}
      onKeyDownCapture={activateFocusedNode}
      ref={containerRef}
      role="region"
    >
      {prepared.layoutWarning === null ? null : (
        <p className="graph-layout-warning" role="alert">
          {prepared.layoutWarning}
        </p>
      )}
      <EntityDisclosureProvider onToggleEntity={toggleEntityAnchored}>
        <ReactFlow<GraphFlowNode, GraphFlowEdge>
          aria-label="Interactive projected knowledge graph"
          colorMode="light"
          deleteKeyCode={null}
          edgeTypes={GRAPH_EDGE_TYPES}
          edges={edges}
          edgesFocusable
          edgesReconnectable={false}
          elementsSelectable
          fitView={centerRequest === undefined}
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
          onNodeDoubleClick={focusNode}
          onNodeMouseEnter={hoverNode}
          onNodeMouseLeave={clearHover}
          onNodesChange={syncNodeChanges}
          onMoveEnd={observeViewport}
          onPaneClick={clearSelection}
          onSelectionChange={syncKeyboardSelection}
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
          <Controls
            aria-label="Graph viewport controls"
            fitViewOptions={GRAPH_FIT_VIEW_OPTIONS}
            showFitView={false}
            showInteractive={false}
          >
            <ControlButton
              aria-label="Fit graph to view"
              className="graph-control-button--fit"
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
                title={maximized === true ? 'Restore graph' : 'Maximize graph'}
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
      </EntityDisclosureProvider>
    </div>
  );
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
