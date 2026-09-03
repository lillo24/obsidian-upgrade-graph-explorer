import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import type { GraphSelection } from '@icarus-graph-explorer/renderer-reactflow';
import type { ProjectionNodeId } from '@icarus-graph-explorer/view-projection';

import {
  flattenNetworkExplorerRows,
  indexNetworkExplorerRows,
  NETWORK_EXPLORER_ROW_HEIGHT,
  networkExplorerKeyboardAction,
  networkExplorerScrollTopForIndex,
  networkExplorerVirtualWindow,
  shouldRevealNetworkExplorerSelection,
  type NetworkExplorerAdjacency,
  type NetworkExplorerModel,
  type NetworkExplorerNode,
  type NetworkExplorerRow,
} from '../network-explorer-model';

interface NetworkExplorerProps {
  readonly expandedNodeIds: ReadonlySet<ProjectionNodeId>;
  readonly model: NetworkExplorerModel;
  readonly onClose: () => void;
  readonly onExpandedNodeIdsChange: (
    expandedNodeIds: ReadonlySet<ProjectionNodeId>,
  ) => void;
  readonly onSelectNode: (nodeId: ProjectionNodeId) => void;
  readonly selection: GraphSelection | null;
}

const DEFAULT_VIEWPORT_HEIGHT = NETWORK_EXPLORER_ROW_HEIGHT * 8;

function relationshipLabel(
  adjacency: NetworkExplorerAdjacency,
): 'Parent' | 'Child' | 'Outgoing' | 'Incoming' {
  switch (adjacency.relationship) {
    case 'parent':
      return 'Parent';
    case 'child':
      return 'Child';
    case 'outgoing':
      return 'Outgoing';
    case 'incoming':
      return 'Incoming';
  }
}

function relationshipGlyph(adjacency: NetworkExplorerAdjacency): string {
  switch (adjacency.relationship) {
    case 'parent':
      return '↑';
    case 'child':
      return '↓';
    case 'outgoing':
      return '→';
    case 'incoming':
      return '←';
  }
}

function nodeAccessibleName(node: NetworkExplorerNode): string {
  const details = [
    node.kindLabel,
    node.name,
    node.secondary,
    node.focusRoot ? 'Focus root' : undefined,
    node.focusDistance === null || node.focusRoot
      ? undefined
      : `Focus distance ${node.focusDistance}`,
    node.diagnosticStatus === undefined
      ? undefined
      : `${node.diagnosticStatus} link`,
    node.visualGroupName === undefined
      ? undefined
      : `Visual Group ${node.visualGroupName}`,
    node.internalReferenceCount === 0
      ? undefined
      : `${node.internalReferenceCount} internal ${
          node.internalReferenceCount === 1 ? 'link' : 'links'
        }`,
    `${node.adjacency.length} ${
      node.adjacency.length === 1 ? 'relationship' : 'relationships'
    }`,
  ];
  return details.filter((detail) => detail !== undefined).join(', ');
}

function adjacencyAccessibleName(adjacency: NetworkExplorerAdjacency): string {
  const relation = relationshipLabel(adjacency);
  const occurrence =
    adjacency.referenceCount === 0
      ? undefined
      : `${adjacency.referenceCount} ${
          adjacency.referenceCount === 1 ? 'occurrence' : 'occurrences'
        }`;
  return [
    relation,
    adjacency.status,
    adjacency.targetKindLabel,
    adjacency.targetName,
    occurrence,
  ]
    .filter((detail) => detail !== undefined)
    .join(', ');
}

export const NetworkExplorer = memo(function NetworkExplorer({
  expandedNodeIds,
  model,
  onClose,
  onExpandedNodeIdsChange,
  onSelectNode,
  selection,
}: NetworkExplorerProps) {
  const rows = useMemo(
    () => flattenNetworkExplorerRows(model, expandedNodeIds),
    [expandedNodeIds, model],
  );
  const selectedNodeId =
    selection?.kind === 'node' && model.nodeById.has(selection.id)
      ? selection.id
      : undefined;
  const initialActiveRow =
    selectedNodeId === undefined ? rows[0]?.id : `node:${selectedNodeId}`;
  const [activeRowId, setActiveRowId] = useState(initialActiveRow);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const focusPending = useRef(false);
  const focusAfterExpansion = useRef<string | undefined>(undefined);
  const lastRevealedSelectionNodeId = useRef<ProjectionNodeId | undefined>(
    undefined,
  );
  const rowIndexById = useMemo(() => indexNetworkExplorerRows(rows), [rows]);

  const activeIndex =
    activeRowId === undefined ? 0 : (rowIndexById.get(activeRowId) ?? 0);
  const virtualWindow = networkExplorerVirtualWindow({
    rowCount: rows.length,
    scrollTop,
    viewportHeight,
  });
  const visibleRows = rows.slice(
    virtualWindow.startIndex,
    virtualWindow.endIndex,
  );
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null || typeof ResizeObserver === 'undefined') return;
    const observeSize = () => {
      setViewportHeight(Math.max(1, scroller.clientHeight));
    };
    observeSize();
    const observer = new ResizeObserver(observeSize);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const revealIndex = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current;
      const nextScrollTop = networkExplorerScrollTopForIndex({
        index,
        scrollTop: scroller?.scrollTop ?? scrollTop,
        viewportHeight: scroller?.clientHeight || viewportHeight,
      });
      if (scroller !== null && scroller.scrollTop !== nextScrollTop) {
        scroller.scrollTop = nextScrollTop;
      }
      setScrollTop(nextScrollTop);
    },
    [scrollTop, viewportHeight],
  );

  const activateRow = useCallback(
    (index: number, focus: boolean) => {
      const row = rows[index];
      if (row === undefined) return;
      focusPending.current = focus;
      setActiveRowId(row.id);
      revealIndex(index);
      const mountedRow = rowRefs.current.get(row.id);
      if (focus && mountedRow !== undefined) {
        focusPending.current = false;
        mountedRow.focus();
      }
    },
    [revealIndex, rows],
  );

  useEffect(() => {
    const shouldReveal = shouldRevealNetworkExplorerSelection(
      lastRevealedSelectionNodeId.current,
      selectedNodeId,
    );
    lastRevealedSelectionNodeId.current = selectedNodeId;
    if (!shouldReveal) return;
    if (
      typeof document !== 'undefined' &&
      scrollerRef.current?.contains(document.activeElement)
    ) {
      return;
    }
    const selectedRowId = `node:${selectedNodeId}`;
    const index = rowIndexById.get(selectedRowId);
    if (index === undefined) return;
    setActiveRowId(selectedRowId);
    revealIndex(index);
  }, [revealIndex, rowIndexById, selectedNodeId]);

  useEffect(() => {
    if (rows.length === 0) return;
    const pendingRowId = focusAfterExpansion.current;
    if (pendingRowId !== undefined) {
      const pendingIndex = rowIndexById.get(pendingRowId);
      if (pendingIndex !== undefined) {
        focusAfterExpansion.current = undefined;
        activateRow(pendingIndex, true);
        return;
      }
    }
    if (activeRowId !== undefined && rowIndexById.has(activeRowId)) return;
    setActiveRowId(rows[0]?.id);
  }, [activateRow, activeRowId, rowIndexById, rows]);

  useEffect(() => {
    if (!focusPending.current || activeRowId === undefined) return;
    const activeElement = rowRefs.current.get(activeRowId);
    if (activeElement === undefined) return;
    focusPending.current = false;
    activeElement.focus();
  }, [activeRowId, virtualWindow.endIndex, virtualWindow.startIndex]);

  const toggleNode = useCallback(
    (node: NetworkExplorerNode, expand?: boolean) => {
      if (node.adjacency.length === 0) return;
      const next = new Set(expandedNodeIds);
      const shouldExpand = expand ?? !next.has(node.id);
      if (shouldExpand) next.add(node.id);
      else next.delete(node.id);
      onExpandedNodeIdsChange(next);
    },
    [expandedNodeIds, onExpandedNodeIdsChange],
  );

  const selectRow = useCallback(
    (row: NetworkExplorerRow) => {
      onSelectNode(
        row.kind === 'node' ? row.node.id : row.adjacency.targetNodeId,
      );
    },
    [onSelectNode],
  );

  const handleRowKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, row: NetworkExplorerRow) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const eventRowIndex = rowIndexById.get(row.id);
      const action = networkExplorerKeyboardAction({
        rows,
        rowIndexById,
        activeIndex: eventRowIndex ?? activeIndex,
        expandedNodeIds,
        key: event.key,
      });
      if (action.kind === 'none') return;
      event.preventDefault();
      switch (action.kind) {
        case 'activate':
          activateRow(action.index, true);
          return;
        case 'expand': {
          const node = model.nodeById.get(action.nodeId);
          if (node === undefined) return;
          focusAfterExpansion.current = action.focusRowId;
          toggleNode(node, true);
          return;
        }
        case 'collapse': {
          const node = model.nodeById.get(action.nodeId);
          if (node !== undefined) toggleNode(node, false);
          return;
        }
        case 'select':
          onSelectNode(action.nodeId);
          return;
      }
    },
    [
      activateRow,
      activeIndex,
      expandedNodeIds,
      model.nodeById,
      onSelectNode,
      rowIndexById,
      rows,
      toggleNode,
    ],
  );

  if (model.nodes.length === 0) {
    return (
      <aside
        aria-label="Network Explorer"
        className="network-explorer"
        data-graph-history-shortcuts="off"
      >
        <header className="network-explorer__heading">
          <h3>Network Explorer</h3>
          <button onClick={onClose} type="button">
            Close
          </button>
        </header>
        <p className="network-explorer__empty">
          No visible nodes in the current Network view.
        </p>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Network Explorer"
      className="network-explorer"
      data-graph-history-shortcuts="off"
    >
      <header className="network-explorer__heading">
        <div>
          <h3>Network Explorer</h3>
          <p>{model.nodes.length} visible nodes</p>
        </div>
        <button onClick={onClose} type="button">
          Close
        </button>
      </header>
      <div
        aria-label="Visible network nodes and relationships"
        className="network-explorer__tree"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        ref={scrollerRef}
        role="tree"
      >
        <div
          className="network-explorer__virtual-space"
          style={{ height: virtualWindow.totalHeight }}
        >
          {visibleRows.map((row, visibleIndex) => {
            const logicalIndex = virtualWindow.startIndex + visibleIndex;
            const rowStyle = {
              height: NETWORK_EXPLORER_ROW_HEIGHT,
              transform: `translateY(${logicalIndex * NETWORK_EXPLORER_ROW_HEIGHT}px)`,
            } as CSSProperties;
            const isActive = row.id === activeRowId;
            if (row.kind === 'node') {
              const expanded = expandedNodeIds.has(row.node.id);
              const selected = selectedNodeId === row.node.id;
              return (
                <div
                  className="network-explorer__virtual-row"
                  key={row.id}
                  role="presentation"
                  style={rowStyle}
                >
                  <div
                    aria-expanded={
                      row.node.adjacency.length === 0 ? undefined : expanded
                    }
                    aria-label={nodeAccessibleName(row.node)}
                    aria-level={1}
                    aria-posinset={row.position}
                    aria-selected={selected}
                    aria-setsize={row.setSize}
                    className={`network-explorer__treeitem${
                      selected ? ' network-explorer__treeitem--selected' : ''
                    }`}
                    onClick={() => {
                      setActiveRowId(row.id);
                      selectRow(row);
                    }}
                    onFocus={() => setActiveRowId(row.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, row)}
                    ref={(element) => {
                      if (element === null) rowRefs.current.delete(row.id);
                      else {
                        rowRefs.current.set(row.id, element);
                        if (focusPending.current && row.id === activeRowId) {
                          focusPending.current = false;
                          element.focus();
                        }
                      }
                    }}
                    role="treeitem"
                    tabIndex={isActive ? 0 : -1}
                  >
                    {row.node.adjacency.length === 0 ? (
                      <span
                        aria-hidden="true"
                        className="network-explorer__disclosure-placeholder"
                      />
                    ) : (
                      <button
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${row.node.name} relationships`}
                        className="network-explorer__disclosure"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleNode(row.node);
                        }}
                        tabIndex={-1}
                        type="button"
                      >
                        <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                      </button>
                    )}
                    <span
                      aria-hidden="true"
                      className="network-explorer__kind-glyph"
                    >
                      {row.node.glyph}
                    </span>
                    <span className="network-explorer__row-copy">
                      <span className="network-explorer__row-title">
                        {row.node.name}
                      </span>
                      <span className="network-explorer__row-secondary">
                        {row.node.kindLabel} · {row.node.secondary}
                      </span>
                    </span>
                    <span className="network-explorer__badges">
                      {row.node.focusRoot ? (
                        <span className="network-explorer__badge">Root</span>
                      ) : null}
                      {row.node.focusDistance === null ||
                      row.node.focusRoot ? null : (
                        <span className="network-explorer__badge">
                          {row.node.focusDistance} hop
                        </span>
                      )}
                      {row.node.visualGroupName === undefined ? null : (
                        <span className="network-explorer__badge">
                          {row.node.visualGroupName}
                        </span>
                      )}
                      {row.node.internalReferenceCount === 0 ? null : (
                        <span className="network-explorer__badge">
                          {row.node.internalReferenceCount} internal
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            }

            const relation = relationshipLabel(row.adjacency);
            return (
              <div
                className="network-explorer__virtual-row network-explorer__virtual-row--adjacency"
                key={row.id}
                role="presentation"
                style={rowStyle}
              >
                <div
                  aria-label={adjacencyAccessibleName(row.adjacency)}
                  aria-level={2}
                  aria-posinset={row.position}
                  aria-setsize={row.setSize}
                  className="network-explorer__treeitem network-explorer__treeitem--adjacency"
                  onClick={() => {
                    setActiveRowId(row.id);
                    selectRow(row);
                  }}
                  onFocus={() => setActiveRowId(row.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, row)}
                  ref={(element) => {
                    if (element === null) rowRefs.current.delete(row.id);
                    else {
                      rowRefs.current.set(row.id, element);
                      if (focusPending.current && row.id === activeRowId) {
                        focusPending.current = false;
                        element.focus();
                      }
                    }
                  }}
                  role="treeitem"
                  tabIndex={isActive ? 0 : -1}
                >
                  <span
                    aria-hidden="true"
                    className="network-explorer__disclosure-placeholder"
                  />
                  <span
                    aria-hidden="true"
                    className="network-explorer__relationship"
                  >
                    {relationshipGlyph(row.adjacency)}
                  </span>
                  <span className="network-explorer__row-copy">
                    <span className="network-explorer__row-title">
                      {row.adjacency.targetName}
                    </span>
                    <span className="network-explorer__row-secondary">
                      {relation} · {row.adjacency.targetKindLabel}
                      {row.adjacency.status === undefined
                        ? ''
                        : ` · ${row.adjacency.status}`}
                      {row.adjacency.referenceCount === 0
                        ? ''
                        : ` · ${row.adjacency.referenceCount} ${
                            row.adjacency.referenceCount === 1
                              ? 'link'
                              : 'links'
                          }`}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
});
