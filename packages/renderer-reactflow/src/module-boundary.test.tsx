/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { ModuleBoundaryNode } from './nodes';
import type { ModuleBoundaryFlowNode } from './types';

function renderBoundary(
  hasVisibleStructuralDescendants: boolean,
  root = false,
): string {
  const node = {
    id: 'module-Atlas',
    type: 'module',
    position: { x: 12, y: 34 },
    width: 200,
    height: 120,
    data: {
      projectionNodeId: null,
      moduleId: 'Atlas',
      root,
      hasVisibleStructuralDescendants,
    },
  } satisfies ModuleBoundaryFlowNode;
  return renderToStaticMarkup(
    <ReactFlowProvider>
      <ModuleBoundaryNode
        id={node.id}
        data={node.data}
        type="module"
        selected={false}
        isConnectable={false}
        dragging={false}
        draggable={false}
        deletable={false}
        selectable={false}
        zIndex={-1}
        positionAbsoluteX={node.position.x}
        positionAbsoluteY={node.position.y}
      />
    </ReactFlowProvider>,
  );
}

describe('Focus Schematic module boundary presentation', () => {
  it('hides File-only boundaries, including the root, without removing handles', () => {
    for (const root of [false, true]) {
      const markup = renderBoundary(false, root);
      expect(markup).toContain('focus-module-boundary--empty');
      expect(markup).toContain('data-visual-boundary="hidden"');
      expect(markup.match(/class="react-flow__handle/g)).toHaveLength(8);
      if (root) expect(markup).toContain('focus-module-boundary--root');
    }
  });

  it('shows the boundary when a Heading or Block is currently visible', () => {
    const markup = renderBoundary(true);
    expect(markup).not.toContain('focus-module-boundary--empty');
    expect(markup).toContain('data-visual-boundary="visible"');
  });

  it('uses transparent presentation for an empty boundary while preserving its element', () => {
    const styles = readFileSync(
      new URL('./styles.css', import.meta.url),
      'utf8',
    );
    expect(styles).toMatch(
      /\.focus-module-boundary--empty,[\s\S]*?border-color:\s*transparent;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/,
    );
  });
});
