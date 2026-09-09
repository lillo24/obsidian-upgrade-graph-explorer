// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { GraphCanvas } from './GraphCanvas';
import { prepareRendererGraph } from './prepare';
import { rendererTestProjection } from './test-fixture';

it('C1-C2 sends pointer and keyboard context requests for one Modular File target', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const projection = rendererTestProjection();
  const prepared = prepareRendererGraph(projection, {
    layoutMode: 'structure',
  });
  const documentNode = prepared.nodes.find(
    (node) => node.type === 'entity' && node.data.entityKind === 'document',
  )!;
  const graph = {
    ...prepared,
    nodes: prepared.nodes.map((node) =>
      node.id === documentNode.id && node.type === 'entity'
        ? {
            ...node,
            data: {
              ...node.data,
              focusSchematicModuleId: node.data.entityId,
            },
          }
        : node,
    ),
  };
  const request = vi.fn();
  try {
    await act(() =>
      root.render(
        <GraphCanvas
          fitRequestKey={0}
          focusAppearance="outline"
          layoutMode="local-structured"
          onNodeContextMenuRequest={request}
          onSelectionChange={vi.fn()}
          onToggleEntity={vi.fn()}
          preparedGraph={graph}
          projection={projection}
          selection={null}
          trackpadZoomMode="scroll-zoom"
        />,
      ),
    );
    const flowNode = [
      ...container.querySelectorAll<HTMLElement>('.react-flow__node'),
    ].find((node) => node.dataset.id === documentNode.id)!;
    act(() =>
      flowNode.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          clientX: 40,
          clientY: 50,
        }),
      ),
    );
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        node: expect.objectContaining({ id: documentNode.id }),
        x: 40,
        y: 50,
      }),
    );
    act(() => {
      flowNode.focus();
      flowNode.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'ContextMenu',
        }),
      );
    });
    expect(request).toHaveBeenCalledTimes(2);
  } finally {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
