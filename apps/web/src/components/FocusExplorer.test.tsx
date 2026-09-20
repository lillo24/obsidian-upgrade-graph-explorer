// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FocusExplorerFilesModel } from '../focus-explorer-files';
import type { FocusOutlineModel } from '../focus-outline-model';
import { createSourceFolders } from '../network-explorer-folders';
import { FocusExplorer, type FocusExplorerTab } from './FocusExplorer';

const files = [
  {
    id: 'file-language',
    entityId: 'doc-language',
    sourcePath: 'Language.md',
    name: 'Language',
    folderContext: 'Workspace root',
    focusRoot: true,
  },
  {
    id: 'file-syntax',
    entityId: 'doc-syntax',
    sourcePath: 'Notes/Syntax.md',
    name: 'Syntax',
    folderContext: 'Notes',
    focusRoot: false,
  },
] as const;

const fileModel: FocusExplorerFilesModel = {
  files,
  fileById: new Map(files.map((file) => [file.id, file])),
  ...createSourceFolders(files, () => true),
};

const headingModel: FocusOutlineModel = {
  documentEntityId: 'doc-language',
  sourcePath: 'Language.md',
  hiddenEntityIds: ['h1', 'h1-child'],
  rows: [
    {
      entityId: 'h1',
      title: 'Grammar',
      depth: 1,
      headingLevel: 1,
      hasChildHeadings: true,
      status: 'hidden',
      explicitlyHidden: true,
    },
    {
      entityId: 'h1-child',
      title: 'Syntax',
      depth: 2,
      headingLevel: 2,
      parentEntityId: 'h1',
      hasChildHeadings: false,
      status: 'hidden-by-ancestor',
      explicitlyHidden: true,
    },
    {
      entityId: 'h2',
      title: 'Semantics',
      depth: 1,
      headingLevel: 1,
      hasChildHeadings: false,
      status: 'visible',
      explicitlyHidden: false,
    },
  ],
};

describe('Focus Explorer drawer', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();
  const onFocusFile = vi.fn();
  const onFolderStateChange = vi.fn();
  const onSelectFile = vi.fn();
  const onSetHeadingHidden = vi.fn();
  const onShowAll = vi.fn();
  const onToggleHeadingBranch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderExplorer(initialTab: FocusExplorerTab = 'files') {
    function Harness() {
      const [activeTab, setActiveTab] = useState(initialTab);
      const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<
        ReadonlySet<string>
      >(() => new Set());
      return (
        <FocusExplorer
          activeTab={activeTab}
          collapsedHeadingIds={collapsedHeadingIds}
          files={fileModel}
          folderState={new Map()}
          headings={headingModel}
          onActiveTabChange={setActiveTab}
          onClose={onClose}
          onFocusFile={onFocusFile}
          onFolderStateChange={onFolderStateChange}
          onSelectFile={onSelectFile}
          onSetHeadingHidden={onSetHeadingHidden}
          onShowAll={onShowAll}
          onToggleHeadingBranch={(entityId) => {
            onToggleHeadingBranch(entityId);
            setCollapsedHeadingIds((current) => {
              const next = new Set(current);
              if (next.has(entityId)) next.delete(entityId);
              else next.add(entityId);
              return next;
            });
          }}
          selectedNodeId="file-syntax"
        />
      );
    }
    act(() => root.render(<Harness />));
  }

  it('shows only projection Files, canonical folders, and the Focus marker in Files', () => {
    renderExplorer();
    expect(container.querySelector('aside')?.getAttribute('aria-label')).toBe(
      'Focus Explorer',
    );
    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
    expect(container.textContent).toContain('Language');
    expect(container.textContent).toContain('Notes');
    expect(container.textContent).toContain('Syntax');
    expect(container.textContent).toContain('Focus');
    expect(container.textContent).not.toContain('Grammar');
    expect(
      container.querySelector('[role="treeitem"][aria-selected="true"]')
        ?.textContent,
    ).toContain('Syntax');
  });

  it('switches tabs with click and arrow keys without firing graph actions', () => {
    renderExplorer();
    const headingTab = container.querySelector<HTMLButtonElement>(
      '#focus-explorer-tab-headings',
    )!;
    act(() => headingTab.click());
    expect(container.textContent).toContain('Grammar');
    expect(container.textContent).toContain(
      'Hidden by parent · also explicitly hidden',
    );
    act(() =>
      headingTab.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      ),
    );
    expect(container.textContent).toContain('Workspace root');
    expect(onSelectFile).not.toHaveBeenCalled();
    expect(onFocusFile).not.toHaveBeenCalled();
    expect(onSetHeadingHidden).not.toHaveBeenCalled();
    expect(onShowAll).not.toHaveBeenCalled();
  });

  it('makes File select/center and reroot separate, discoverable actions', () => {
    renderExplorer();
    act(() =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Select and center File Syntax"]',
        )!
        .click(),
    );
    expect(onSelectFile).toHaveBeenCalledWith('file-syntax');
    expect(onFocusFile).not.toHaveBeenCalled();
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Focus File Syntax"]')!
        .click(),
    );
    expect(onFocusFile).toHaveBeenCalledWith('file-syntax');
  });

  it('keeps accessible Heading visibility names and a larger text action', () => {
    renderExplorer('headings');
    expect(
      container.querySelector('[aria-label="Show Heading Grammar"]')
        ?.textContent,
    ).toBe('Show');
    expect(
      container.querySelector(
        '[aria-label="Heading Syntax is hidden by parent"]',
      ),
    ).toHaveProperty('disabled', true);
    expect(
      container.querySelector('[aria-label="Hide Heading Semantics"]')
        ?.textContent,
    ).toBe('Hide');
    expect(container.querySelector('[role="tree"]')).not.toBeNull();
    expect(container.querySelector('[aria-level="2"]')).not.toBeNull();
    expect(
      container
        .querySelector('aside')
        ?.getAttribute('data-graph-history-shortcuts'),
    ).toBe('off');
  });

  it('E4/E10/E13 collapses only child rows, keeps leaves disclosure-free, and retains state across tabs', () => {
    renderExplorer('headings');
    const parent = container.querySelector<HTMLElement>(
      '[role="treeitem"][aria-expanded="true"]',
    );
    expect(parent?.textContent).toContain('Grammar');
    expect(
      container.querySelector(
        '[aria-label="Expand children in Focus Explorer"]',
      ),
    ).toBeNull();
    expect(
      container.querySelectorAll('.focus-explorer__heading-disclosure'),
    ).toHaveLength(1);

    act(() =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Collapse children in Focus Explorer"]',
        )!
        .click(),
    );
    expect(onToggleHeadingBranch).toHaveBeenCalledWith('h1');
    expect(container.textContent).not.toContain('Syntax');
    expect(container.textContent).toContain('Semantics');
    expect(onSetHeadingHidden).not.toHaveBeenCalled();
    expect(onShowAll).not.toHaveBeenCalled();

    act(() =>
      container
        .querySelector<HTMLButtonElement>('#focus-explorer-tab-files')!
        .click(),
    );
    act(() =>
      container
        .querySelector<HTMLButtonElement>('#focus-explorer-tab-headings')!
        .click(),
    );
    expect(container.textContent).not.toContain('Syntax');
    expect(
      container.querySelector(
        '[aria-label="Expand children in Focus Explorer"]',
      ),
    ).not.toBeNull();
  });

  it('E15 keeps Show all separate from local branch disclosure', () => {
    renderExplorer('headings');
    act(() =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Collapse children in Focus Explorer"]',
        )!
        .click(),
    );
    act(() =>
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((candidate) => candidate.textContent === 'Show all')!
        .click(),
    );
    expect(onShowAll).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Syntax');
  });
});
