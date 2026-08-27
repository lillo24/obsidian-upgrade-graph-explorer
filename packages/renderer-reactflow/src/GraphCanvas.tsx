import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeFunc,
} from '@xyflow/react';

import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES } from './component-maps';
import { EntityDisclosureProvider } from './disclosure-context';
import { applyRendererHighlight } from './highlight';
import { prepareRendererGraph } from './prepare';
import type {
  GraphCanvasProps,
  GraphFlowEdge,
  GraphFlowNode,
  GraphSelection,
} from './types';

function GraphCanvasInner({
  expandedEntityIds,
  fitRequestKey,
  layoutMode,
  onSelectionChange,
  onToggleEntity,
  projection,
  selection,
}: GraphCanvasProps) {
  const [hovered, setHovered] = useState<GraphSelection | null>(null);
  const { fitView } = useReactFlow<GraphFlowNode, GraphFlowEdge>();
  const previousFitRequest = useRef(fitRequestKey);
  const prepared = useMemo(
    () =>
      prepareRendererGraph(projection, {
        layoutMode,
        expandedEntityIds,
      }),
    [expandedEntityIds, layoutMode, projection],
  );
  const highlighted = useMemo(
    () => applyRendererHighlight(prepared, hovered ?? selection),
    [hovered, prepared, selection],
  );
  const nodes = useMemo(
    () =>
      highlighted.nodes.map((node) => ({
        ...node,
        selected:
          selection?.kind === 'node' &&
          node.data.projectionNodeId === selection.id,
      })),
    [highlighted.nodes, selection],
  );
  const edges = useMemo(
    () =>
      highlighted.edges.map((edge) => ({
        ...edge,
        selected:
          selection?.kind === 'edge' &&
          edge.data?.projectionEdgeId === selection.id,
      })),
    [highlighted.edges, selection],
  );

  useEffect(() => {
    if (previousFitRequest.current === fitRequestKey) return;
    previousFitRequest.current = fitRequestKey;
    void fitView({ duration: 0, padding: 0.14, maxZoom: 1.35 });
  }, [fitRequestKey, fitView]);

  const selectNode = useCallback<NodeMouseHandler<GraphFlowNode>>(
    (_event, node) =>
      onSelectionChange({ kind: 'node', id: node.data.projectionNodeId }),
    [onSelectionChange],
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
      role="region"
    >
      {prepared.layoutWarning === null ? null : (
        <p className="graph-layout-warning" role="alert">
          {prepared.layoutWarning}
        </p>
      )}
      <EntityDisclosureProvider onToggleEntity={onToggleEntity}>
        <ReactFlow<GraphFlowNode, GraphFlowEdge>
          aria-label="Interactive projected knowledge graph"
          colorMode="light"
          deleteKeyCode={null}
          edgeTypes={GRAPH_EDGE_TYPES}
          edges={edges}
          edgesFocusable
          edgesReconnectable={false}
          elementsSelectable
          fitView
          fitViewOptions={{ duration: 0, padding: 0.14, maxZoom: 1.35 }}
          minZoom={0.08}
          nodeTypes={GRAPH_NODE_TYPES}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          nodesFocusable
          onEdgeClick={selectEdge}
          onEdgeMouseEnter={hoverEdge}
          onEdgeMouseLeave={clearHover}
          onEdgesChange={syncEdgeChanges}
          onNodeClick={selectNode}
          onNodeMouseEnter={hoverNode}
          onNodeMouseLeave={clearHover}
          onNodesChange={syncNodeChanges}
          onPaneClick={clearSelection}
          onSelectionChange={syncKeyboardSelection}
          panOnDrag
          proOptions={{ hideAttribution: false }}
          selectionOnDrag={false}
          zoomOnDoubleClick={false}
        >
          <Background
            color="#cbd5da"
            gap={24}
            variant={BackgroundVariant.Dots}
          />
          <Controls
            aria-label="Graph viewport controls"
            fitViewOptions={{ duration: 0, padding: 0.14, maxZoom: 1.35 }}
            showInteractive={false}
          />
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
