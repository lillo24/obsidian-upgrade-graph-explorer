// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNetworkExplorerFolders } from '../network-explorer-folders';
import { NetworkExplorer } from './NetworkExplorer';
import type {
  NetworkExplorerModel,
  NetworkExplorerNode,
} from '../network-explorer-model';

const nodes: readonly NetworkExplorerNode[] = Array.from(
  { length: 100 },
  (_, index) => ({
    id: `node-${index}`,
    entityId: `entity-${index}`,
    sourcePath: `Node ${index}.md`,
    name: `Node ${index}`,
    glyph: '▰',
    kindLabel: 'File',
    secondary: `Node ${index}.md`,
    focusRoot: false,
    focusDistance: null,
  }),
);
const model: NetworkExplorerModel = {
  nodes,
  ...createNetworkExplorerFolders(nodes),
  nodeById: new Map(nodes.map((node) => [node.id, node])),
};

describe('Network Explorer graph reveal and keyboard scrolling', () => {
  let container: HTMLDivElement;
  let root: Root;
  let props: ComponentProps<typeof NetworkExplorer>;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(560);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    props = {
      presentationOverrides: new Map(),
      sizePersistenceStatus: 'Session only',
      sizeEditingDisabled: false,
      onSizeScaleChange: vi.fn(),
      queryEditor: {
        activeQuery: '',
        queryDraft: '',
        queryIssue: undefined,
        onDraftChange: vi.fn(),
        onApply: vi.fn(),
        onClear: vi.fn(),
        onResetDraft: vi.fn(),
      },
      hiddenPaths: [],
      focusedSourcePath: undefined,
      onRestoreFile: vi.fn(),
      onFocusNode: vi.fn(),
      onInspectNode: vi.fn(),
      onHideFile: vi.fn(),
      folderState: new Map(),
      savedQueries: {
        activeQuery: '',
        savedFilters: [],
        savedFiltersStatus: '',
        savedFiltersWritable: true,
        onApplySavedFilter: vi.fn(),
        onDeleteSavedFilter: vi.fn(),
        onSaveCurrentQuery: vi.fn(),
      },
      model,
      onClose: vi.fn(),
      onFolderStateChange: vi.fn(),
      onSelectNode: vi.fn(),
      selection: null,
    };
  });
  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render(changes: Partial<typeof props> = {}) {
    props = { ...props, ...changes };
    await act(() => root.render(<NetworkExplorer {...props} />));
  }
  function tree() {
    return container.querySelector<HTMLElement>('[role="tree"]')!;
  }
  function row(index: number) {
    return container.querySelector<HTMLElement>(
      `[role="treeitem"][aria-posinset="${index + 1}"]`,
    );
  }

  it('highlights immediately but waits for an explicit graph reveal, even when already visible', async () => {
    await render();
    await render({
      selection: { kind: 'node', id: 'node-5' },
      deferSelectionReveal: true,
    });
    expect(row(5)?.getAttribute('aria-selected')).toBe('true');
    expect(tree().scrollTop).toBe(0);
    await render({ revealRequest: { key: 1, nodeId: 'node-5' } });
    expect(tree().scrollTop).toBe(5 * 56);
  });

  it('mounts an off-screen target and repeats the same-node reveal only for fresh requests', async () => {
    await render();
    expect(row(70)).toBeNull();
    await render({
      selection: { kind: 'node', id: 'node-70' },
      deferSelectionReveal: true,
    });
    expect(tree().scrollTop).toBe(0);
    await render({ revealRequest: { key: 1, nodeId: 'node-70' } });
    expect(tree().scrollTop).toBe(70 * 56);
    expect(row(70)?.getAttribute('aria-selected')).toBe('true');
    expect(row(70)?.tabIndex).toBe(0);
    expect(document.activeElement).not.toBe(row(70));

    await act(() => {
      tree().scrollTop = 0;
      tree().dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await render();
    expect(tree().scrollTop).toBe(0);
    expect(row(70)).toBeNull();
    await render({ revealRequest: { key: 2, nodeId: 'node-70' } });
    expect(tree().scrollTop).toBe(70 * 56);
    expect(row(70)).not.toBeNull();
  });

  it('clamps bottom reveals and keeps keyboard minimum scrolling and virtual focus', async () => {
    await render();
    await act(() => row(0)?.focus());
    await act(() =>
      row(0)?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      ),
    );
    expect(document.activeElement).toBe(row(1));
    expect(tree().scrollTop).toBe(0);
    await act(() =>
      row(1)?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
      ),
    );
    expect(tree().scrollTop).toBe(100 * 56 - 560);
    expect(document.activeElement).toBe(row(99));
    await render({ revealRequest: { key: 1, nodeId: 'node-99' } });
    expect(tree().scrollTop).toBe(100 * 56 - 560);
    expect(row(99)).not.toBeNull();
  });

  it('does not replay a confirmed graph reveal when File size changes or resets', async () => {
    await render();
    await render({
      selection: { kind: 'node', id: 'node-5' },
      deferSelectionReveal: true,
      revealRequest: { key: 1, nodeId: 'node-5' },
    });
    expect(tree().scrollTop).toBe(5 * 56);
    await act(() => {
      tree().scrollTop = 0;
      tree().dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await render({
      presentationOverrides: new Map([['entity-5', { sizeScale: 1.3 }]]),
    });
    expect(row(5)?.getAttribute('aria-label')).toContain('File size 1.30');
    expect(tree().scrollTop).toBe(0);
    await render({ presentationOverrides: new Map() });
    expect(row(5)?.getAttribute('aria-label')).not.toContain('File size');
    expect(tree().scrollTop).toBe(0);
    expect(props.onSelectNode).not.toHaveBeenCalled();
  });

  it('preserves minimum-scroll reveal for non-graph selection changes', async () => {
    await render();
    await render({ selection: { kind: 'node', id: 'node-70' } });
    expect(tree().scrollTop).toBe(71 * 56 - 560);
    expect(row(70)?.getAttribute('aria-selected')).toBe('true');
  });

  it('ignores a request whose node has left the projection', async () => {
    await render();
    await render({ revealRequest: { key: 1, nodeId: 'missing' } });
    expect(tree().scrollTop).toBe(0);
    expect(row(0)).not.toBeNull();
  });

  it('opens confirmed-click ancestors before consuming the request and does not reopen them during ordinary updates', async () => {
    const nested = nodes.map((node) => ({
      ...node,
      sourcePath: `One/Two/Three/${node.id}.md`,
    }));
    const nestedModel = {
      nodes: nested,
      nodeById: new Map(nested.map((node) => [node.id, node])),
      ...createNetworkExplorerFolders(nested),
    };
    const onFolderStateChange = vi.fn();
    await render({ model: nestedModel, onFolderStateChange });
    expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(3);
    await render({
      selection: { kind: 'node', id: 'node-70' },
      deferSelectionReveal: true,
    });
    expect(onFolderStateChange).not.toHaveBeenCalled();
    await render({ revealRequest: { key: 1, nodeId: 'node-70' } });
    expect(onFolderStateChange).toHaveBeenCalledTimes(1);
    const opened = onFolderStateChange.mock.calls[0]![0];
    expect(opened.get('One/Two/Three')).toBe(true);
    await render({ folderState: opened });
    expect(tree().scrollTop).toBe(73 * 56);
    expect(
      container.querySelector('[aria-selected="true"]')?.textContent,
    ).toContain('Node 70');
    expect(document.activeElement?.getAttribute('aria-selected')).not.toBe(
      'true',
    );
    await render({ folderState: new Map([['One/Two/Three', false]]) });
    expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(3);
    expect(onFolderStateChange).toHaveBeenCalledTimes(1);
    await render({ revealRequest: { key: 2, nodeId: 'node-70' } });
    expect(onFolderStateChange).toHaveBeenCalledTimes(2);
  });

  it('reveals new non-graph selection inside folders once, while preserving later user collapse', async () => {
    const nested = nodes.map((node) => ({
      ...node,
      sourcePath: `One/Two/Three/${node.id}.md`,
    }));
    const onFolderStateChange = vi.fn();
    await render({
      model: {
        nodes: nested,
        nodeById: new Map(nested.map((node) => [node.id, node])),
        ...createNetworkExplorerFolders(nested),
      },
      onFolderStateChange,
    });
    await render({ selection: { kind: 'node', id: 'node-70' } });
    expect(onFolderStateChange).toHaveBeenCalledTimes(1);
    await render({ folderState: onFolderStateChange.mock.calls[0]![0] });
    expect(tree().scrollTop).toBe(74 * 56 - 560);
    expect(
      container.querySelector('[aria-selected="true"]')?.textContent,
    ).toContain('Node 70');
    await render({ folderState: new Map([['One', false]]) });
    expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(1);
    expect(onFolderStateChange).toHaveBeenCalledTimes(1);
  });
});
