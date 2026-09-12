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
import {
  type EntityId,
  type WorkspaceFolderKey,
} from '@icarus-graph-explorer/core';
import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';
import type { FolderSpatialRule } from '@icarus-graph-explorer/spatial-overrides';
import type { ProjectionNodeId } from '@icarus-graph-explorer/view-projection';

import {
  networkExplorerContextTarget,
  currentNetworkExplorerContextTarget,
  networkExplorerMenuActions,
  networkExplorerSizeEntityId,
  type NetworkExplorerAction,
  type NetworkExplorerContext,
} from '../network-explorer-context';
import {
  GraphQueryEditor,
  type GraphQueryEditorState,
} from './GraphQueryEditor';
import { NetworkExplorerMenu } from './NetworkExplorerMenu';
import { NodeSizeControl } from './NodeSizeControl';
import { NetworkExplorerHiddenItems } from './NetworkExplorerHiddenItems';
import { SavedQueriesPopover } from './SavedQueriesPopover';
import type { SavedGraphQueriesState } from './SavedGraphQueries';
import { networkFileMoveKeyboardAction } from '../network-editing';

import {
  flattenNetworkExplorerRows,
  indexNetworkExplorerRows,
  NETWORK_EXPLORER_ROW_HEIGHT,
  networkExplorerKeyboardAction,
  networkExplorerScrollTopForIndex,
  networkExplorerTopAlignedScrollTop,
  networkExplorerVirtualWindow,
  shouldRevealNetworkExplorerSelection,
  revealNetworkExplorerNode,
  type NetworkExplorerFolderState,
  type NetworkExplorerModel,
  type NetworkExplorerNode,
  type NetworkExplorerRow,
  type NetworkExplorerRevealRequest,
} from '../network-explorer-model';

export interface NetworkExplorerArrangementProps {
  readonly active: boolean;
  readonly activeFolderKey?: WorkspaceFolderKey;
  readonly ruleByFolderKey: ReadonlyMap<WorkspaceFolderKey, FolderSpatialRule>;
  readonly available: boolean;
  readonly unavailableReason?: string;
  readonly onArrangeFolder: (folderKey: WorkspaceFolderKey) => void;
  readonly onRemoveFolderRule?: (folderKey: WorkspaceFolderKey) => void;
}

export interface NetworkExplorerFileMoveProps {
  readonly activeNodeId?: ProjectionNodeId;
  readonly available: boolean;
  readonly unavailableReason?: string;
  readonly onCancel: () => void;
  readonly onNudge: (x: number, y: number) => void;
  readonly onRelease: () => void;
  readonly onStart: (nodeId: ProjectionNodeId) => void;
  readonly onTargetUnavailable: () => void;
}

interface NetworkExplorerProps {
  readonly arrangement?: NetworkExplorerArrangementProps;
  readonly fileMove?: NetworkExplorerFileMoveProps;
  readonly presentationOverrides: EntityPresentationOverrideMap;
  readonly sizePersistenceStatus: string;
  readonly sizeEditingDisabled: boolean;
  readonly onSizeScaleChange: (
    entityId: EntityId,
    sizeScale: number | undefined,
  ) => string | undefined;
  readonly queryEditor: GraphQueryEditorState;
  readonly savedQueries: SavedGraphQueriesState;
  readonly hiddenPaths: readonly string[];
  readonly hiddenFolderKeys: readonly WorkspaceFolderKey[];
  readonly focusedSourcePath: string | undefined;
  readonly onRestoreFile: (path: string) => void;
  readonly onRestoreFolder: (folderKey: WorkspaceFolderKey) => void;
  readonly onFocusNode: (nodeId: ProjectionNodeId) => void;
  readonly onInspectNode: (
    nodeId: ProjectionNodeId,
    origin: HTMLElement | null,
  ) => void;
  readonly onHideFile: (path: string) => void;
  readonly onHideFolder: (folderKey: WorkspaceFolderKey) => void;
  readonly folderState: NetworkExplorerFolderState;
  readonly model: NetworkExplorerModel;
  readonly onClose: () => void;
  readonly onFolderStateChange: (state: NetworkExplorerFolderState) => void;
  readonly onSelectNode: (nodeId: ProjectionNodeId) => void;
  readonly selection: GraphSelection | null;
  /** Raw graph selection highlights now; its confirmed click reveals later. */
  readonly deferSelectionReveal?: boolean;
  readonly revealRequest?: NetworkExplorerRevealRequest | undefined;
}

const DEFAULT_VIEWPORT_HEIGHT = NETWORK_EXPLORER_ROW_HEIGHT * 8;

function nodeAccessibleName(
  node: NetworkExplorerNode,
  sizeScale: number | undefined,
): string {
  const details = [
    node.kindLabel,
    node.name,
    node.secondary,
    sizeScale === undefined
      ? undefined
      : `File size ${sizeScale.toFixed(2)} times calculated Network size`,
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

function spatialRuleScopeLabel(rule: FolderSpatialRule): string {
  if (rule.scope.kind === 'exact') return 'This folder';
  if (rule.scope.includeRootFiles && rule.scope.excludedSubtrees.length === 0)
    return 'Folder + subfolders';
  return `Custom scope, ${rule.scope.includeRootFiles ? 'including' : 'excluding'} direct files, ${rule.scope.excludedSubtrees.length} excluded subtrees`;
}

function spatialRuleLabel(rule: FolderSpatialRule): string {
  return `${rule.behavior === 'pull' ? 'Pull' : 'Place'}, ${spatialRuleScopeLabel(rule)}${rule.behavior === 'pull' ? `, strength ${rule.strength}` : ''}`;
}

export const NetworkExplorer = memo(function NetworkExplorer({
  arrangement,
  fileMove,
  presentationOverrides,
  sizePersistenceStatus,
  sizeEditingDisabled,
  onSizeScaleChange,
  queryEditor,
  savedQueries,
  hiddenPaths,
  hiddenFolderKeys,
  focusedSourcePath,
  onRestoreFile,
  onRestoreFolder,
  onFocusNode,
  onInspectNode,
  onHideFile,
  onHideFolder,
  folderState,
  model,
  onClose,
  onFolderStateChange,
  onSelectNode,
  selection,
  deferSelectionReveal = false,
  revealRequest,
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
  const moveControllerRef = useRef<HTMLDivElement>(null);
  const [context, setContext] = useState<NetworkExplorerContext | null>(null);
  const [sizeError, setSizeError] = useState<string>();
  const hiddenPathSet = useMemo(() => new Set(hiddenPaths), [hiddenPaths]);
  const hiddenFolderKeySet = useMemo(
    () => new Set(hiddenFolderKeys),
    [hiddenFolderKeys],
  );
  const focusPending = useRef(false);
  const pendingSelectionReveal = useRef<ProjectionNodeId | undefined>(
    undefined,
  );
  const lastRevealedSelectionNodeId = useRef<ProjectionNodeId | undefined>(
    undefined,
  );
  const rowIndexById = useMemo(() => indexNetworkExplorerRows(rows), [rows]);
  const handledRevealRequest = useRef(revealRequest?.key);
  const contextTarget = currentNetworkExplorerContextTarget(
    context,
    model,
    rows,
    rowIndexById,
  );
  const sizeEntityId =
    contextTarget?.kind !== 'node'
      ? undefined
      : networkExplorerSizeEntityId(contextTarget.node);
  const menuActions = useMemo(
    () =>
      contextTarget === undefined
        ? []
        : networkExplorerMenuActions(
            contextTarget,
            focusedSourcePath,
            hiddenPathSet,
            hiddenFolderKeySet,
            fileMove === undefined
              ? undefined
              : {
                  available: fileMove.available,
                  ...(fileMove.unavailableReason === undefined
                    ? {}
                    : { reason: fileMove.unavailableReason }),
                },
          ),
    [
      contextTarget,
      fileMove,
      focusedSourcePath,
      hiddenFolderKeySet,
      hiddenPathSet,
    ],
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
      setSizeError(undefined);
      // Opening actions changes only keyboard activity, not graph selection/center.
      setContext({
        rowId: row.id,
        model,
        x,
        y,
        origin: origin ?? rowRefs.current.get(row.id) ?? null,
        screen: 'actions',
      });
    },
    [model],
  );
  const runContextAction = useCallback(
    (action: NetworkExplorerAction) => {
      const item = menuActions.find((item) => item.id === action);
      if (
        context === null ||
        contextTarget === undefined ||
        item === undefined ||
        item.disabledReason !== undefined
      )
        return;
      if (action === 'size') {
        setContext({ ...context, screen: 'size' });
        return;
      }
      const origin = context.origin?.isConnected
        ? context.origin
        : (rowRefs.current.get(context.rowId) ?? null);
      closeContextMenu(action !== 'inspect');
      if (contextTarget.kind === 'folder') {
        if (action === 'hide-folder') onHideFolder(contextTarget.folder.path);
        return;
      }
      if (action === 'focus') onFocusNode(contextTarget.node.id);
      else if (action === 'inspect')
        onInspectNode(contextTarget.node.id, origin);
      else if (action === 'move-file') fileMove?.onStart(contextTarget.node.id);
      else if (contextTarget.node.sourcePath !== undefined)
        onHideFile(contextTarget.node.sourcePath);
    },
    [
      closeContextMenu,
      context,
      contextTarget,
      fileMove,
      menuActions,
      onFocusNode,
      onHideFile,
      onHideFolder,
      onInspectNode,
    ],
  );

  const activeMoveNode =
    fileMove?.activeNodeId === undefined
      ? undefined
      : model.nodeById.get(fileMove.activeNodeId);
  const activeMoveFile =
    activeMoveNode?.kindLabel === 'File' ? activeMoveNode : undefined;
  useEffect(() => {
    if (fileMove?.activeNodeId === undefined) return;
    if (activeMoveFile === undefined) {
      fileMove.onTargetUnavailable();
      return;
    }
    moveControllerRef.current?.focus({ preventScroll: true });
  }, [activeMoveFile, fileMove]);

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
    if (deferSelectionReveal) {
      pendingSelectionReveal.current = undefined;
      return;
    }
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
    deferSelectionReveal,
    folderState,
    model,
    onFolderStateChange,
    revealIndex,
    rowIndexById,
    selectedNodeId,
  ]);

  useEffect(() => {
    if (
      revealRequest === undefined ||
      revealRequest.key === handledRevealRequest.current
    )
      return;
    // A confirmed graph click can target a node inside a collapsed folder.
    // Consume its key only after the controlled ancestor expansion has rendered.
    const revealed = revealNetworkExplorerNode(
      folderState,
      model,
      revealRequest.nodeId,
    );
    if (revealed !== folderState) {
      onFolderStateChange(revealed);
      return;
    }
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
  }, [
    folderState,
    model,
    onFolderStateChange,
    revealRequest,
    rowIndexById,
    rows.length,
    viewportHeight,
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
    (path: WorkspaceFolderKey, expanded: boolean) => {
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
        {hiddenPaths.length === 0 && hiddenFolderKeys.length === 0 ? null : (
          <NetworkExplorerHiddenItems
            folderKeys={hiddenFolderKeys}
            paths={hiddenPaths}
            onRestoreFile={onRestoreFile}
            onRestoreFolder={onRestoreFolder}
          />
        )}
        {fileMove === undefined || activeMoveFile === undefined ? null : (
          <div
            aria-label={`Move File ${activeMoveFile.name}`}
            className="network-explorer__file-move"
            data-network-editing-escape="handled"
            onKeyDown={(event) => {
              const action = networkFileMoveKeyboardAction(event);
              if (action.kind === 'nudge') {
                event.preventDefault();
                event.stopPropagation();
                fileMove.onNudge(action.x, action.y);
                return;
              }
              if (
                action.kind === 'release' &&
                event.target === event.currentTarget
              ) {
                event.preventDefault();
                event.stopPropagation();
                fileMove.onRelease();
              } else if (action.kind === 'cancel') {
                event.preventDefault();
                event.stopPropagation();
                fileMove.onCancel();
              }
            }}
            ref={moveControllerRef}
            role="group"
            tabIndex={0}
          >
            <strong>{activeMoveFile.name}</strong>
            <small>
              Arrow keys move 8 px; hold Shift for 32 px. Release settles and
              does not save a position.
            </small>
            <div aria-label="Move File direction" role="group">
              <button
                aria-label="Move File left"
                onClick={() => fileMove.onNudge(-8, 0)}
                type="button"
              >
                ←
              </button>
              <button
                aria-label="Move File up"
                onClick={() => fileMove.onNudge(0, -8)}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label="Move File down"
                onClick={() => fileMove.onNudge(0, 8)}
                type="button"
              >
                ↓
              </button>
              <button
                aria-label="Move File right"
                onClick={() => fileMove.onNudge(8, 0)}
                type="button"
              >
                →
              </button>
            </div>
            <div className="network-explorer__file-move-actions">
              <button onClick={fileMove.onRelease} type="button">
                Release &amp; settle
              </button>
              <button onClick={fileMove.onCancel} type="button">
                Cancel
              </button>
            </div>
          </div>
        )}
        {arrangement === undefined ? null : (
          <div className="network-explorer__root-arrangement">
            <span>Root folder</span>
            {arrangement.ruleByFolderKey.get('.') === undefined ? null : (
              <span
                aria-label={spatialRuleLabel(
                  arrangement.ruleByFolderKey.get('.')!,
                )}
                className="network-explorer__arranged-marker"
                title={spatialRuleLabel(arrangement.ruleByFolderKey.get('.')!)}
              >
                {arrangement.ruleByFolderKey.get('.')!.behavior === 'pull'
                  ? 'Pull'
                  : 'Place'}
              </span>
            )}
            <button
              aria-pressed={
                arrangement.active && arrangement.activeFolderKey === '.'
              }
              disabled={!arrangement.available}
              onClick={() => arrangement.onArrangeFolder('.')}
              title={
                arrangement.available
                  ? 'Arrange root folder'
                  : arrangement.unavailableReason
              }
              type="button"
            >
              {arrangement.ruleByFolderKey.has('.')
                ? 'Edit spatial rule'
                : 'Arrange folder'}
            </button>
            {arrangement.ruleByFolderKey.has('.') &&
            arrangement.onRemoveFolderRule !== undefined ? (
              <button
                onClick={() => arrangement.onRemoveFolderRule?.('.')}
                type="button"
              >
                Remove spatial rule
              </button>
            ) : null}
          </div>
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
            if (context !== null) {
              closeContextMenu(false);
              // An editor's virtual row may disappear in this scroll commit.
              // Use a stable focus fallback without revealing/snapping to it.
              if (context.screen === 'size')
                closeButtonRef.current?.focus({ preventScroll: true });
            }
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
              const fileEntityId =
                node === undefined
                  ? undefined
                  : networkExplorerSizeEntityId(node);
              const sizeScale =
                fileEntityId === undefined
                  ? undefined
                  : presentationOverrides.get(fileEntityId)?.sizeScale;
              const selected = node !== undefined && selectedNodeId === node.id;
              const folderKey = folder?.folder.path;
              const folderArrangementDisabledReason =
                arrangement?.available === false
                  ? arrangement.unavailableReason
                  : undefined;
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
                        : nodeAccessibleName(node, sizeScale)
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
                    {sizeScale === undefined ? null : (
                      <span
                        aria-label={`File size ${sizeScale.toFixed(2)} times calculated Network size`}
                        className="network-explorer__size-badge"
                        title={`File size: ${sizeScale.toFixed(2)}×`}
                      >
                        {sizeScale.toFixed(2)}×
                      </span>
                    )}
                    {folderKey === undefined ||
                    arrangement === undefined ? null : (
                      <>
                        {arrangement.ruleByFolderKey.get(folderKey) ===
                        undefined ? null : (
                          <span
                            aria-label={spatialRuleLabel(
                              arrangement.ruleByFolderKey.get(folderKey)!,
                            )}
                            className="network-explorer__arranged-marker"
                            title={spatialRuleLabel(
                              arrangement.ruleByFolderKey.get(folderKey)!,
                            )}
                          >
                            {arrangement.ruleByFolderKey.get(folderKey)!
                              .behavior === 'pull'
                              ? 'Pull'
                              : 'Place'}
                          </span>
                        )}
                        <button
                          aria-label={`Arrange folder ${folder?.folder.name ?? folderKey}`}
                          aria-pressed={
                            arrangement.active &&
                            arrangement.activeFolderKey === folderKey
                          }
                          className="network-explorer__arrange-folder"
                          disabled={
                            folderArrangementDisabledReason !== undefined
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            arrangement.onArrangeFolder(folderKey);
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                          tabIndex={row.id === activeRowId ? 0 : -1}
                          title={
                            folderArrangementDisabledReason ??
                            `Arrange folder ${folder?.folder.name ?? folderKey}`
                          }
                          type="button"
                        >
                          {arrangement.ruleByFolderKey.has(folderKey)
                            ? 'Edit spatial rule'
                            : 'Arrange folder'}
                        </button>
                        {arrangement.ruleByFolderKey.has(folderKey) &&
                        arrangement.onRemoveFolderRule !== undefined ? (
                          <button
                            aria-label={`Remove spatial rule ${folder?.folder.name ?? folderKey}`}
                            className="network-explorer__arrange-folder"
                            onClick={(event) => {
                              event.stopPropagation();
                              arrangement.onRemoveFolderRule?.(folderKey);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            tabIndex={row.id === activeRowId ? 0 : -1}
                            type="button"
                          >
                            Remove
                          </button>
                        ) : null}
                      </>
                    )}
                    {node === undefined ? null : (
                      <button
                        aria-label={`Actions for ${node.name}`}
                        aria-haspopup="menu"
                        className="network-explorer__actions"
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
                        onKeyDown={(event) => event.stopPropagation()}
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
          name={
            contextTarget.kind === 'node'
              ? contextTarget.node.name
              : contextTarget.folder.path
          }
          onAction={runContextAction}
          onCancel={closeContextMenu}
          x={context.x}
          y={context.y}
          {...(context.screen !== 'size' || sizeEntityId === undefined
            ? {}
            : {
                editor: {
                  label: 'Network size',
                  content: (
                    <>
                      <NodeSizeControl
                        disabled={sizeEditingDisabled}
                        onChange={(sizeScale) =>
                          setSizeError(
                            onSizeScaleChange(sizeEntityId, sizeScale),
                          )
                        }
                        sizeScale={
                          presentationOverrides.get(sizeEntityId)?.sizeScale
                        }
                        status={sizePersistenceStatus}
                      />
                      {sizeError === undefined ? null : (
                        <p className="network-node-size__error" role="alert">
                          {sizeError}
                        </p>
                      )}
                    </>
                  ),
                },
              })}
        />
      )}
    </aside>
  );
});
