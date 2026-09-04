// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentDirectHoverProvider } from './hover-context';
import { mapProjectionToReactFlow } from './mapping';
import { EntityNode } from './nodes';
import { rendererTestProjection } from './test-fixture';
import type { EntityFlowNode } from './types';

describe('direct File connection ring', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('uses one keyboard target, drives transient direct hover, and keeps clicks local', () => {
    const mapped = mapProjectionToReactFlow(
      rendererTestProjection(),
      'structure',
    ).nodes.find(
      (node): node is EntityFlowNode =>
        node.type === 'entity' && node.data.entityKind === 'document',
    )!;
    const node: EntityFlowNode = {
      ...mapped,
      data: {
        ...mapped.data,
        focusSchematicModuleId: 'module-one',
        focusSchematicHoverBehavior: 'module-aggregate',
        hasDirectFileConnectionRing: true,
      },
    };
    const hover = vi.fn();
    const outerClick = vi.fn();
    const outerPointerDown = vi.fn();
    act(() => {
      root.render(
        <div onClick={outerClick} onPointerDown={outerPointerDown}>
          <ReactFlowProvider>
            <DocumentDirectHoverProvider setDocumentDirectHover={hover}>
              <EntityNode
                id={node.id}
                data={node.data}
                type="entity"
                selected={false}
                isConnectable={false}
                dragging={false}
                draggable={false}
                deletable={false}
                selectable
                zIndex={0}
                positionAbsoluteX={0}
                positionAbsoluteY={0}
              />
            </DocumentDirectHoverProvider>
          </ReactFlowProvider>
        </div>,
      );
    });
    const rings = container.querySelectorAll<HTMLButtonElement>(
      '.file-direct-connection-ring',
    );
    expect(rings).toHaveLength(1);
    const ring = rings[0]!;
    expect(ring.getAttribute('aria-label')).toBe(
      `Show direct File connections for ${node.data.title}`,
    );
    act(() => ring.focus());
    expect(hover).toHaveBeenLastCalledWith(node.data.projectionNodeId, true);
    act(() => ring.blur());
    expect(hover).toHaveBeenLastCalledWith(node.data.projectionNodeId, false);
    act(() => ring.click());
    expect(outerClick).not.toHaveBeenCalled();
    act(() => ring.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(outerPointerDown).not.toHaveBeenCalled();

    act(() => ring.focus());
    act(() => {
      root.render(
        <ReactFlowProvider>
          <DocumentDirectHoverProvider setDocumentDirectHover={hover}>
            <EntityNode
              id={node.id}
              data={{ ...node.data, hasDirectFileConnectionRing: false }}
              type="entity"
              selected={false}
              isConnectable={false}
              dragging={false}
              draggable={false}
              deletable={false}
              selectable
              zIndex={0}
              positionAbsoluteX={0}
              positionAbsoluteY={0}
            />
          </DocumentDirectHoverProvider>
        </ReactFlowProvider>,
      );
    });
    expect(hover).toHaveBeenLastCalledWith(node.data.projectionNodeId, false);
  });
});
