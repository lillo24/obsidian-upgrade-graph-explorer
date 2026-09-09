// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ReactFlow } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FocusSchematicModule } from '@icarus-graph-explorer/focus-schematic';

import type { GraphFlowNode } from '../types';
import { FocusSchematicFolderClusterGuides } from './folder-cluster-guides';

const module = (id: string, folderKey: string): FocusSchematicModule => ({
  id,
  documentEntityId: id,
  sourcePath: `${folderKey}/${id}.md`,
  folderKey,
  presentation: 'visible-content',
  documentProjectionNodeId: id,
  visibleEntityNodeIds: [id],
  hierarchyEdgeIds: [],
  internalReferenceIds: [],
  diagnosticIds: [],
  focusDistance: 1,
  incomingDistance: null,
  outgoingDistance: 1,
  placement: {
    allowedSides: ['right'],
    preferredSide: 'right',
    rankMagnitude: 1,
    preferredSignedRank: 1,
    reason: 'outgoing-only',
  },
});

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

describe('Soft folder guide controls', () => {
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

  it('keeps the hull inert and exposes keyboard-accessible promote/reset actions', () => {
    const promote = vi.fn();
    const siblings = vi.fn();
    const reset = vi.fn();
    act(() => {
      root.render(
        <ReactFlow edges={[]} nodes={[]}>
          <FocusSchematicFolderClusterGuides
            modules={[
              module('parent', 'Language'),
              module('child', 'Language/Pragmatics'),
            ]}
            nodes={[node('parent', 0), node('child', 180)]}
            onPromoteGroup={promote}
            onPromoteGroupWithSiblings={siblings}
            onResetGroup={reset}
            persistenceError={undefined}
            persistenceStatus="Saved for this workspace"
            rootModuleId="parent"
            scopeOverrides={[
              {
                exactFolderKey: 'Language/Pragmatics',
                spatialGroupKey: 'Language',
              },
            ]}
          />
        </ReactFlow>,
      );
    });
    const overlay = document.querySelector('svg');
    const chip = document.querySelector<HTMLButtonElement>(
      '.focus-schematic-folder-guide-controls__chip',
    );
    expect(overlay?.getAttribute('aria-hidden')).toBe('true');
    expect(chip?.getAttribute('aria-label')).toContain('Spatial group');

    act(() => chip!.focus());
    const actions = [...document.querySelectorAll<HTMLButtonElement>('button')];
    expect(actions.map(({ textContent }) => textContent)).toEqual([
      'Language',
      '↑ This group',
      '↑ This + sibling folders',
      'Reset',
    ]);
    act(() => actions[1]!.click());
    act(() => actions[2]!.click());
    act(() => actions[3]!.click());
    expect(promote).toHaveBeenCalledWith('Language');
    expect(siblings).toHaveBeenCalledWith('Language');
    expect(reset).toHaveBeenCalledWith('Language');

    act(() =>
      chip!.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
      ),
    );
    expect(document.querySelector('[role="group"]')).toBeNull();
  });
});
