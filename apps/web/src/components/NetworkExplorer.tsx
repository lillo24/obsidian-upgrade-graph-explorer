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
import { SavedQueriesPopover } from './SavedQueriesPopover';
import type { SavedGraphQueriesState } from './SavedGraphQueries';

import {
  flattenNetworkExplorerRows,
  indexNetworkExplorerRows,
  NETWORK_EXPLORER_ROW_HEIGHT,
  networkExplorerKeyboardAction,
  networkExplorerScrollTopForIndex,
  networkExplorerVirtualWindow,
  shouldRevealNetworkExplorerSelection,
  revealNetworkExplorerNode,
  type NetworkExplorerFolderState,
  type NetworkExplorerModel,
  type NetworkExplorerNode,
  type NetworkExplorerRow,
} from '../network-explorer-model';

interface NetworkExplorerProps {
  readonly queryEditor: GraphQueryEditorState;
  readonly savedQueries: SavedGraphQueriesState;
  readonly hiddenPaths: readonly string[];
  readonly focusedSourcePath: string | undefined;
  readonly onRestoreFile: (path: string) => void;
  readonly onFocusNode: (nodeId: ProjectionNodeId) => void;
  readonly onInspectNode: (
    nodeId: ProjectionNodeId,
    origin: HTMLElement | null,
  ) => void;
  readonly onHideFile: (path: string) => void;
  readonly folderState: NetworkExplorerFolderState;
  readonly model: NetworkExplorerModel;
  readonly onClose: () => void;
  readonly onFolderStateChange: (state: NetworkExplorerFolderState) => void;
  readonly onSelectNode: (nodeId: ProjectionNodeId) => void;
  readonly selection: GraphSelection | null;
}

const DEFAULT_VIEWPORT_HEIGHT = NETWORK_EXPLORER_ROW_HEIGHT * 8;

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
  ];
  return details.filter((detail) => detail !== undefined).join(', ');
}

export const NetworkExplorer = memo(function NetworkExplorer({
  queryEditor,
  savedQueries,
  hiddenPaths,
  focusedSourcePath,
  onRestoreFile,
  onFocusNode,
  onInspectNode,
  onHideFile,
  folderState,
  model,
  onClose,
  onFolderStateChange,
  onSelectNode,
  selection,
}: NetworkExplorerProps) {
  const rows = useMemo(
    () => flattenNetworkExplorerRows(model, folderState),
    [folderState, model],
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
    readonly origin: HTMLElement | null;
  } | null>(null);
  const hiddenPathSet = useMemo(() => new Set(hiddenPaths), [hiddenPaths]);
  const focusPending = useRef(false);
  const pendingSelectionReveal = useRef<ProjectionNodeId | undefined>(
    undefined,
  );
  const lastRevealedSelectionNodeId = useRef<ProjectionNodeId | undefined>(
    undefined,
  );
  const rowIndexById = useMemo(() => indexNetworkExplorerRows(rows), [rows]);
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
        const origin = context.origin?.isConnected
          ? context.origin
          : rowRefs.current.get(context.rowId);
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
    (row: NetworkExplorerRow, x: number, y: number, origin?: HTMLElement) => {
      const target = networkExplorerContextTarget(row, model);
      if (target === undefined) return;
      setActiveRowId(row.id);
      setContext({
        rowId: row.id,
        targetId: target.id,
        model,
        x,
        y,
        origin: origin ?? rowRefs.current.get(row.id) ?? null,
      });
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
      const origin = context.origin?.isConnected
        ? context.origin
        : (rowRefs.current.get(context.rowId) ?? null);
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
    const changed = shouldRevealNetworkExplorerSelection(
      lastRevealedSelectionNodeId.current,
      selectedNodeId,
    );
    lastRevealedSelectionNodeId.current = selectedNodeId;
    if (
      selectedNodeId === undefined ||
      (!changed && pendingSelectionReveal.current !== selectedNodeId)
    )
      return;
    if (
      changed &&
      typeof document !== 'undefined' &&
      scrollerRef.current?.contains(document.activeElement)
    ) {
      pendingSelectionReveal.current = undefined;
      return;
    }
    const revealed = revealNetworkExplorerNode(
      folderState,
      model,
      selectedNodeId,
    );
    if (revealed !== folderState) {
      pendingSelectionReveal.current = selectedNodeId;
      onFolderStateChange(revealed);
      return;
    }
    pendingSelectionReveal.current = undefined;
    const selectedRowId = `node:${selectedNodeId}`;
    const index = rowIndexById.get(selectedRowId);
    if (index === undefined) return;
    setActiveRowId(selectedRowId);
    revealIndex(index);
  }, [
    folderState,
    model,
    onFolderStateChange,
    revealIndex,
    rowIndexById,
    selectedNodeId,
  ]);

  useEffect(() => {
    if (
      rows.length === 0 ||
      (activeRowId !== undefined && rowIndexById.has(activeRowId))
    )
      return;
    setActiveRowId(rows[0]?.id);
  }, [activeRowId, rowIndexById, rows]);

  useEffect(() => {
    if (!focusPending.current || activeRowId === undefined) return;
    const activeElement = rowRefs.current.get(activeRowId);
    if (activeElement === undefined) return;
    focusPending.current = false;
    activeElement.focus();
  }, [activeRowId, virtualWindow.endIndex, virtualWindow.startIndex]);

  const toggleFolder = useCallback(
    (path: string, expanded: boolean) => {
      const next = new Map(folderState);
      next.set(path, expanded);
      onFolderStateChange(next);
    },
    [folderState, onFolderStateChange],
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
        if (row.kind === 'folder') return;
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
        key: event.key,
      });
      if (action.kind === 'none') return;
      event.preventDefault();
      switch (action.kind) {
        case 'activate':
          activateRow(action.index, true);
          return;
        case 'toggle-folder':
          toggleFolder(action.path, action.expanded);
          return;
        case 'select':
          onSelectNode(action.nodeId);
          return;
      }
    },
    [
      activateRow,
      activeIndex,
      onSelectNode,
      openContextMenu,
      rowIndexById,
      rows,
      toggleFolder,
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
          <SavedQueriesPopover {...savedQueries} />
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
          aria-label="Visible network nodes by source folder"
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
              const folder = row.kind === 'folder' ? row : undefined;
              const node = row.kind === 'node' ? row.node : undefined;
              const selected = node !== undefined && selectedNodeId === node.id;
              return (
                <div
                  className="network-explorer__virtual-row"
                  key={row.id}
                  role="presentation"
                  style={rowStyle}
                >
                  <div
                    aria-expanded={folder?.expanded}
                    aria-label={
                      node === undefined
                        ? `Folder, ${folder?.folder.path}`
                        : nodeAccessibleName(node)
                    }
                    aria-level={row.level}
                    aria-posinset={row.position}
                    aria-selected={node === undefined ? undefined : selected}
                    aria-setsize={row.setSize}
                    className={`network-explorer__treeitem${selected ? ' network-explorer__treeitem--selected' : ''}`}
                    style={
                      {
                        '--network-row-indent': `${Math.min(12, row.level - 1 + (row.kind === 'node' && row.nestedInFile ? 1 : 0)) * 0.8}rem`,
                      } as CSSProperties
                    }
                    onClick={() => {
                      setActiveRowId(row.id);
                      if (folder !== undefined)
                        toggleFolder(folder.folder.path, !folder.expanded);
                      else if (node !== undefined) onSelectNode(node.id);
                    }}
                    onFocus={() => setActiveRowId(row.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (node !== undefined)
                        openContextMenu(row, event.clientX, event.clientY);
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      handleRowKeyDown(event, row);
                    }}
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
                    tabIndex={row.id === activeRowId ? 0 : -1}
                    title={node?.secondary ?? folder?.folder.path}
                  >
                    {folder === undefined ? null : (
                      <span
                        aria-hidden="true"
                        className="network-explorer__folder-disclosure"
                      >
                        {folder.expanded ? '▾' : '▸'}
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      className="network-explorer__kind-glyph"
                    >
                      {node?.glyph ?? '▱'}
                    </span>
                    <span className="network-explorer__row-copy">
                      <span className="network-explorer__row-title">
                        {node?.kindLabel === 'Diagnostic'
                          ? `Diagnostic: ${node.name}`
                          : (node?.name ?? folder?.folder.name)}
                      </span>
                    </span>
                    {node?.focusRoot ? (
                      <span className="network-explorer__badge">Focus</span>
                    ) : null}
                    {node === undefined ? null : (
                      <button
                        aria-label={`Actions for ${node.name}`}
                        aria-haspopup="menu"
                        className="network-explorer__node-actions"
                        onClick={(event) => {
                          event.stopPropagation();
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          openContextMenu(
                            row,
                            rect.left,
                            rect.bottom,
                            event.currentTarget,
                          );
                        }}
                        title={`Actions for ${node.name}`}
                        tabIndex={row.id === activeRowId ? 0 : -1}
                        type="button"
                      >
                        <span aria-hidden="true">⋯</span>
                      </button>
                    )}
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
