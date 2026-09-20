import {
  memo,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import type { EntityId, WorkspaceFolderKey } from '@icarus-graph-explorer/core';
import type { ProjectionNodeId } from '@icarus-graph-explorer/view-projection';

import type {
  FocusExplorerFilesModel,
  FocusExplorerFile,
} from '../focus-explorer-files';
import type {
  FocusOutlineModel,
  FocusOutlineRowStatus,
} from '../focus-outline-model';
import {
  flattenSourceFolderRows,
  type NetworkExplorerFolderState,
  type SourceFolderRow,
} from '../network-explorer-folders';

export type FocusExplorerTab = 'files' | 'headings';

interface FocusExplorerProps {
  readonly activeTab: FocusExplorerTab;
  readonly files: FocusExplorerFilesModel;
  readonly folderState: NetworkExplorerFolderState;
  readonly headings: FocusOutlineModel;
  readonly selectedNodeId?: ProjectionNodeId;
  readonly onActiveTabChange: (tab: FocusExplorerTab) => void;
  readonly onClose: () => void;
  readonly onFocusFile: (nodeId: ProjectionNodeId) => void;
  readonly onFolderStateChange: (state: NetworkExplorerFolderState) => void;
  readonly onSelectFile: (nodeId: ProjectionNodeId) => void;
  readonly onSetHeadingHidden: (entityId: EntityId, hidden: boolean) => void;
  readonly onShowAll: () => void;
}

const TABS: readonly FocusExplorerTab[] = ['files', 'headings'];

function statusLabel(status: FocusOutlineRowStatus): string {
  switch (status) {
    case 'visible':
      return 'Visible';
    case 'hidden':
      return 'Hidden';
    case 'hidden-by-ancestor':
      return 'Hidden by parent';
    case 'not-disclosed':
      return 'Not disclosed';
  }
}

function FocusFiles({
  folderState,
  model,
  onFocusFile,
  onFolderStateChange,
  onSelectFile,
  selectedNodeId,
}: {
  readonly folderState: NetworkExplorerFolderState;
  readonly model: FocusExplorerFilesModel;
  readonly onFocusFile: (nodeId: ProjectionNodeId) => void;
  readonly onFolderStateChange: (state: NetworkExplorerFolderState) => void;
  readonly onSelectFile: (nodeId: ProjectionNodeId) => void;
  readonly selectedNodeId?: ProjectionNodeId;
}) {
  const rows = useMemo(
    () => flattenSourceFolderRows(model, folderState),
    [folderState, model],
  );
  const toggleFolder = (path: WorkspaceFolderKey, expanded: boolean) => {
    const next = new Map(folderState);
    next.set(path, expanded);
    onFolderStateChange(next);
  };
  return (
    <div
      aria-labelledby="focus-explorer-tab-files"
      className="focus-explorer__files"
      id="focus-explorer-panel-files"
      role="tabpanel"
    >
      <div
        aria-label="Files in current Focus graph"
        className="focus-explorer__tree"
        role="tree"
      >
        {rows.map((row: SourceFolderRow<FocusExplorerFile>) => {
          const indent = {
            '--focus-explorer-depth': row.level,
          } as CSSProperties;
          if (row.kind === 'folder') {
            return (
              <button
                aria-expanded={row.expanded}
                aria-level={row.level}
                aria-posinset={row.position}
                aria-setsize={row.setSize}
                className="focus-explorer__folder"
                key={row.id}
                onClick={() => toggleFolder(row.folder.path, !row.expanded)}
                role="treeitem"
                style={indent}
                type="button"
              >
                <span aria-hidden="true">{row.expanded ? '▾' : '▸'}</span>
                <strong>{row.folder.name}</strong>
              </button>
            );
          }
          const selected = row.node.id === selectedNodeId;
          return (
            <div
              aria-level={row.level}
              aria-posinset={row.position}
              aria-selected={selected}
              aria-setsize={row.setSize}
              className={`focus-explorer__file${selected ? ' focus-explorer__file--selected' : ''}`}
              key={row.id}
              role="treeitem"
              style={indent}
            >
              <button
                aria-label={`Select and center File ${row.node.name}`}
                className="focus-explorer__file-select"
                onClick={() => onSelectFile(row.node.id)}
                onDoubleClick={() => onFocusFile(row.node.id)}
                title={`${row.node.sourcePath}. Double-click to make this File the Focus.`}
                type="button"
              >
                <span aria-hidden="true" className="focus-explorer__file-icon">
                  ▰
                </span>
                <span className="focus-explorer__file-copy">
                  <strong>{row.node.name}</strong>
                  <small>{row.node.folderContext}</small>
                </span>
                {row.node.focusRoot ? (
                  <span className="focus-explorer__badge">Focus</span>
                ) : null}
              </button>
              {row.node.focusRoot ? null : (
                <button
                  aria-label={`Focus File ${row.node.name}`}
                  className="focus-explorer__focus-file"
                  onClick={() => onFocusFile(row.node.id)}
                  title={`Make ${row.node.name} the Focus File`}
                  type="button"
                >
                  Focus
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FocusHeadings({
  model,
  onSetHeadingHidden,
  onShowAll,
}: {
  readonly model: FocusOutlineModel;
  readonly onSetHeadingHidden: (entityId: EntityId, hidden: boolean) => void;
  readonly onShowAll: () => void;
}) {
  return (
    <div
      className="focus-explorer__headings"
      id="focus-explorer-panel-headings"
      aria-labelledby="focus-explorer-tab-headings"
      role="tabpanel"
    >
      <div className="focus-explorer__heading-context">
        <strong title={model.sourcePath}>{model.sourcePath}</strong>
        <button
          disabled={model.hiddenEntityIds.length === 0}
          onClick={onShowAll}
          type="button"
        >
          Show all
        </button>
        <span>
          {model.hiddenEntityIds.length === 0
            ? 'No hidden Headings'
            : `${model.hiddenEntityIds.length} hidden`}
        </span>
      </div>
      {model.rows.length === 0 ? (
        <p className="focus-explorer__empty">This File has no Headings.</p>
      ) : (
        <div aria-label="Headings" className="focus-explorer__tree" role="tree">
          {model.rows.map((row) => {
            const hiddenByAncestor = row.status === 'hidden-by-ancestor';
            const hidden = row.status === 'hidden';
            const label = hidden
              ? `Show Heading ${row.title}`
              : hiddenByAncestor
                ? `Heading ${row.title} is hidden by parent`
                : `Hide Heading ${row.title}`;
            return (
              <div
                aria-level={row.depth}
                className={`focus-explorer__heading-row focus-explorer__heading-row--${row.status}`}
                key={row.entityId}
                role="treeitem"
                style={{ '--focus-explorer-depth': row.depth } as CSSProperties}
              >
                <span className="focus-explorer__row-copy">
                  <strong title={row.title}>{row.title}</strong>
                  <small>
                    H{row.headingLevel} · {statusLabel(row.status)}
                    {hiddenByAncestor && row.explicitlyHidden
                      ? ' · also explicitly hidden'
                      : ''}
                  </small>
                </span>
                <button
                  aria-label={label}
                  aria-pressed={hidden || hiddenByAncestor}
                  disabled={hiddenByAncestor}
                  onClick={() =>
                    onSetHeadingHidden(row.entityId, !row.explicitlyHidden)
                  }
                  title={
                    hiddenByAncestor
                      ? 'Restore the hidden parent first.'
                      : hidden
                        ? 'Show this Heading according to current disclosure settings.'
                        : 'Hide this Heading and its descendants from the graph.'
                  }
                  type="button"
                >
                  {hidden ? 'Show' : hiddenByAncestor ? 'Parent' : 'Hide'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const FocusExplorer = memo(function FocusExplorer({
  activeTab,
  files,
  folderState,
  headings,
  selectedNodeId,
  onActiveTabChange,
  onClose,
  onFocusFile,
  onFolderStateChange,
  onSelectFile,
  onSetHeadingHidden,
  onShowAll,
}: FocusExplorerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fileTabRef = useRef<HTMLButtonElement>(null);
  const headingTabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeButtonRef.current?.focus(), []);
  const changeTabFromKeyboard = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    const currentIndex = TABS.indexOf(activeTab);
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight')
      nextIndex = (currentIndex + 1) % TABS.length;
    else if (event.key === 'ArrowLeft')
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = TABS[nextIndex]!;
    onActiveTabChange(next);
    (next === 'files' ? fileTabRef : headingTabRef).current?.focus();
  };

  return (
    <aside
      aria-label="Focus Explorer"
      className="focus-explorer"
      data-graph-history-shortcuts="off"
    >
      <header className="focus-explorer__heading">
        <h3>Focus Explorer</h3>
        <button
          aria-label="Close Focus Explorer"
          className="focus-explorer__close"
          onClick={onClose}
          ref={closeButtonRef}
          title="Close Focus Explorer"
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div
        aria-label="Focus Explorer view"
        className="focus-explorer__tabs"
        role="tablist"
      >
        <button
          aria-controls="focus-explorer-panel-files"
          aria-selected={activeTab === 'files'}
          id="focus-explorer-tab-files"
          onClick={() => onActiveTabChange('files')}
          onKeyDown={changeTabFromKeyboard}
          ref={fileTabRef}
          role="tab"
          tabIndex={activeTab === 'files' ? 0 : -1}
          type="button"
        >
          Files
        </button>
        <button
          aria-controls="focus-explorer-panel-headings"
          aria-selected={activeTab === 'headings'}
          id="focus-explorer-tab-headings"
          onClick={() => onActiveTabChange('headings')}
          onKeyDown={changeTabFromKeyboard}
          ref={headingTabRef}
          role="tab"
          tabIndex={activeTab === 'headings' ? 0 : -1}
          type="button"
        >
          Headings
        </button>
      </div>
      {activeTab === 'files' ? (
        <FocusFiles
          folderState={folderState}
          model={files}
          onFocusFile={onFocusFile}
          onFolderStateChange={onFolderStateChange}
          onSelectFile={onSelectFile}
          {...(selectedNodeId === undefined ? {} : { selectedNodeId })}
        />
      ) : (
        <FocusHeadings
          model={headings}
          onSetHeadingHidden={onSetHeadingHidden}
          onShowAll={onShowAll}
        />
      )}
    </aside>
  );
});
