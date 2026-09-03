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
  networkExplorerContextTarget,
  networkExplorerMenuActions,
  type NetworkExplorerAction,
} from '../network-explorer-context';
import {
  GraphQueryEditor,
  type GraphQueryEditorState,
} from './GraphQueryEditor';
import { NetworkExplorerMenu } from './NetworkExplorerMenu';
import { NetworkExplorerHiddenFiles } from './NetworkExplorerHiddenFiles';

import {
  flattenNetworkExplorerRows,
  indexNetworkExplorerRows,
  NETWORK_EXPLORER_ROW_HEIGHT,
  networkExplorerKeyboardAction,
  networkExplorerScrollTopForIndex,
  networkExplorerTopAlignedScrollTop,
  networkExplorerVirtualWindow,
  shouldRevealNetworkExplorerSelection,
  type NetworkExplorerAdjacency,
  type NetworkExplorerModel,
  type NetworkExplorerNode,
  type NetworkExplorerRow,
  type NetworkExplorerRevealRequest,
} from '../network-explorer-model';

interface NetworkExplorerProps {
  readonly queryEditor: GraphQueryEditorState;
  readonly hiddenPaths: readonly string[];
  readonly focusedSourcePath: string | undefined;
  readonly onRestoreFile: (path: string) => void;
  readonly onFocusNode: (nodeId: ProjectionNodeId) => void;
  readonly onInspectNode: (
    nodeId: ProjectionNodeId,
    origin: HTMLElement | null,
  ) => void;
  readonly onHideFile: (path: string) => void;
  readonly expandedNodeIds: ReadonlySet<ProjectionNodeId>;
  readonly model: NetworkExplorerModel;
  readonly onClose: () => void;
  readonly onExpandedNodeIdsChange: (
    expandedNodeIds: ReadonlySet<ProjectionNodeId>,
  ) => void;
  readonly onSelectNode: (nodeId: ProjectionNodeId) => void;
  readonly selection: GraphSelection | null;
  /** Raw graph selection highlights now; its confirmed click reveals later. */
  readonly deferSelectionReveal?: boolean;
  readonly revealRequest?: NetworkExplorerRevealRequest | undefined;
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
    node.focusRoot ? 'Focus' : undefined,
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
  queryEditor,
  hiddenPaths,
  focusedSourcePath,
  onRestoreFile,
  onFocusNode,
  onInspectNode,
  onHideFile,
  expandedNodeIds,
  model,
  onClose,
  onExpandedNodeIdsChange,
  onSelectNode,
  selection,
  deferSelectionReveal = false,
  revealRequest,
}: NetworkExplorerProps) {
  const rows = useMemo(
    () => flattenNetworkExplorerRows(model, expandedNodeIds),
    [expandedNodeIds, model],
  );
  const selectedNodeId =
    selection?.kind === 'node' && model.nodeById.has(selection.id)
      ? selection.id
      : undefined;
  const treeEmpty = rows.length === 0;
  const initialActiveRow =
    selectedNodeId === undefined ? rows[0]?.id : `node:${selectedNodeId}`;
  const [activeRowId, setActiveRowId] = useState(initialActiveRow);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [context, setContext] = useState<{
    readonly rowId: string;
    readonly targetId: ProjectionNodeId;
    readonly model: NetworkExplorerModel;
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const hiddenPathSet = useMemo(() => new Set(hiddenPaths), [hiddenPaths]);
  const focusPending = useRef(false);
  const focusAfterExpansion = useRef<string | undefined>(undefined);
  const lastRevealedSelectionNodeId = useRef<ProjectionNodeId | undefined>(
    undefined,
  );
  const rowIndexById = useMemo(() => indexNetworkExplorerRows(rows), [rows]);
  const handledRevealRequest = useRef(revealRequest?.key);
  const contextTarget =
    context === null ||
    context.model !== model ||
    !rowIndexById.has(context.rowId)
      ? undefined
      : model.nodeById.get(context.targetId);
  const menuActions = useMemo(
    () =>
      contextTarget === undefined
        ? []
        : networkExplorerMenuActions(
            contextTarget,
            focusedSourcePath,
            hiddenPathSet,
          ),
    [contextTarget, focusedSourcePath, hiddenPathSet],
  );
  const closeContextMenu = useCallback(
    (restoreFocus: boolean) => {
      setContext(null);
      if (restoreFocus && context !== null) {
        const origin = rowRefs.current.get(context.rowId);
        if (origin?.isConnected) origin.focus({ preventScroll: true });
        else closeButtonRef.current?.focus({ preventScroll: true });
      }
    },
    [context],
  );
  useEffect(() => {
    if (context !== null && contextTarget === undefined) closeContextMenu(true);
  }, [closeContextMenu, context, contextTarget]);
  const openContextMenu = useCallback(
    (row: NetworkExplorerRow, x: number, y: number) => {
      const target = networkExplorerContextTarget(row, model);
      if (target === undefined) return;
      setActiveRowId(row.id);
      setContext({ rowId: row.id, targetId: target.id, model, x, y });
    },
    [model],
  );
  const runContextAction = useCallback(
    (action: NetworkExplorerAction) => {
      if (
        context === null ||
        contextTarget === undefined ||
        menuActions.find((item) => item.id === action)?.disabledReason !==
          undefined
      )
        return;
      const origin = rowRefs.current.get(context.rowId) ?? null;
      closeContextMenu(action !== 'inspect');
      if (action === 'focus') onFocusNode(contextTarget.id);
      else if (action === 'inspect') onInspectNode(contextTarget.id, origin);
      else if (contextTarget.sourcePath !== undefined)
        onHideFile(contextTarget.sourcePath);
    },
    [
      closeContextMenu,
      context,
      contextTarget,
      menuActions,
      onFocusNode,
      onHideFile,
      onInspectNode,
    ],
  );

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
    if (treeEmpty || scroller === null || typeof ResizeObserver === 'undefined')
      return;
    const observeSize = () => {
      setViewportHeight(Math.max(1, scroller.clientHeight));
    };
    observeSize();
    const observer = new ResizeObserver(observeSize);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [treeEmpty]);

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
    if (!shouldReveal || deferSelectionReveal) return;
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
  }, [deferSelectionReveal, revealIndex, rowIndexById, selectedNodeId]);

  useEffect(() => {
    if (
      revealRequest === undefined ||
      revealRequest.key === handledRevealRequest.current
    )
      return;
    handledRevealRequest.current = revealRequest.key;
    const rowId = `node:${revealRequest.nodeId}`;
    const index = rowIndexById.get(rowId);
    const scroller = scrollerRef.current;
    if (index === undefined || scroller === null) return;
    const nextScrollTop = networkExplorerTopAlignedScrollTop({
      index,
      rowCount: rows.length,
      viewportHeight: scroller.clientHeight || viewportHeight,
    });
    // Updating both DOM and virtual range mounts an off-screen target without
    // moving keyboard focus out of the canvas or relying on scroll event timing.
    focusPending.current = false;
    setActiveRowId(rowId);
    scroller.scrollTop = nextScrollTop;
    setScrollTop(nextScrollTop);
  }, [revealRequest, rowIndexById, rows.length, viewportHeight]);

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
      if (
        event.key === 'ContextMenu' ||
        event.key === 'Menu' ||
        (event.shiftKey && event.key === 'F10')
      ) {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        openContextMenu(row, rect.left + 24, rect.bottom);
        return;
      }
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
      openContextMenu,
      rowIndexById,
      rows,
      toggleNode,
    ],
  );

  return (
    <aside
      aria-label="Network Explorer"
      className="network-explorer"
      data-graph-history-shortcuts="off"
    >
      <header className="network-explorer__heading">
        <h3>Network Explorer</h3>
        <button
          aria-label="Close Network Explorer"
          className="network-explorer__close"
          onClick={onClose}
          ref={closeButtonRef}
          title="Close Network Explorer"
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="network-explorer__controls">
        <div className="network-explorer__query">
          <GraphQueryEditor {...queryEditor} compact idPrefix="network-query" />
        </div>
        {hiddenPaths.length === 0 ? null : (
          <NetworkExplorerHiddenFiles
            paths={hiddenPaths}
            onRestoreFile={onRestoreFile}
          />
        )}
      </div>
      {treeEmpty ? (
        <p className="network-explorer__empty">
          No visible nodes in the current Network view.
        </p>
      ) : (
        <div
          aria-label="Visible network nodes and relationships"
          className="network-explorer__tree"
          onScroll={(event) => {
            setScrollTop(event.currentTarget.scrollTop);
            if (context !== null) closeContextMenu(false);
          }}
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
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openContextMenu(row, event.clientX, event.clientY);
                      }}
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
                      title={row.node.secondary}
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
                      </span>
                      {row.node.focusRoot ? (
                        <span className="network-explorer__badge">Focus</span>
                      ) : null}
                    </div>
                  </div>
                );
              }

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
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openContextMenu(row, event.clientX, event.clientY);
                    }}
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
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {context === null || contextTarget === undefined ? null : (
        <NetworkExplorerMenu
          actions={menuActions}
          name={contextTarget.name}
          onAction={runContextAction}
          onCancel={closeContextMenu}
          x={context.x}
          y={context.y}
        />
      )}
    </aside>
  );
});
