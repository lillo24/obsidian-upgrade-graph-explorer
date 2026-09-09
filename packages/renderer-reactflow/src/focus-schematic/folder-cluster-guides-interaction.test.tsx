// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ReactFlow } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFocusSchematicSoftFolderDisplayTree } from '@icarus-graph-explorer/focus-schematic-layout';

import type { GraphFlowNode } from '../types';
import { FocusSchematicFolderClusterGuides } from './folder-cluster-guides';

const node = (moduleId: string, x: number): GraphFlowNode =>
  ({
    id: `module-${moduleId}`,
    type: 'module',
    position: { x, y: 0 },
    width: 120,
    height: 80,
    measured: { width: 120, height: 80 },
    data: { projectionNodeId: null, moduleId, root: false },
  }) as GraphFlowNode;

describe('nested Soft folder guide interaction', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('G7/C3-C4/C10-C11 keeps hull inert, shows hierarchy context, and opens one folder menu path', () => {
    const onContext = vi.fn();
    const displayTree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [
        { fileId: 'outer', exactFolderKey: 'Language' },
        { fileId: 'a', exactFolderKey: 'Language/Pragmatics' },
        { fileId: 'b', exactFolderKey: 'Language/Pragmatics' },
        { fileId: 'g1', exactFolderKey: 'Language/Grammar' },
        { fileId: 'g2', exactFolderKey: 'Language/Grammar' },
      ],
    });
    act(() => {
      root.render(
        <ReactFlow edges={[]} nodes={[]}>
          <FocusSchematicFolderClusterGuides
            displayTree={displayTree}
            nodes={[
              node('outer', 0),
              node('a', 180),
              node('b', 320),
              node('g1', 480),
              node('g2', 620),
            ]}
            onFolderContextMenu={onContext}
          />
        </ReactFlow>,
      );
    });
    const overlay = document.querySelector('svg');
    const child = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.focus-schematic-folder-guide-controls__chip',
      ),
    ].find(({ textContent }) => textContent === 'Language/Pragmatics')!;
    expect(overlay?.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(overlay!).pointerEvents).toBe('none');
    expect(document.body.textContent).not.toContain('↑ This group');

    act(() => child.focus());
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'Parent: Language',
    );
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'Language/Grammar',
    );

    act(() =>
      child.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          clientX: 20,
          clientY: 30,
        }),
      ),
    );
    expect(onContext).toHaveBeenLastCalledWith(
      expect.objectContaining({
        folderKey: 'Language/Pragmatics',
        x: 20,
        y: 30,
        origin: child,
      }),
    );
    act(() =>
      child.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'F10',
          shiftKey: true,
        }),
      ),
    );
    expect(onContext).toHaveBeenCalledTimes(2);
  });
});
