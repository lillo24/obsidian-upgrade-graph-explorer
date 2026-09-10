// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { GraphCanvas } from './GraphCanvas';
import { prepareRendererGraph } from './prepare';
import { rendererTestProjection } from './test-fixture';

it('HT7/MC7 sends exclusive node requests and converts pane requests to world space', async () => {
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
  const paneRequest = vi.fn(() => true);
  try {
    await act(() =>
      root.render(
        <GraphCanvas
          fitRequestKey={0}
          focusAppearance="outline"
          layoutMode="local-structured"
          onNodeContextMenuRequest={request}
          onPaneContextMenuRequest={paneRequest}
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
    expect(paneRequest).not.toHaveBeenCalled();
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
    const pane = container.querySelector<HTMLElement>('.react-flow__pane')!;
    act(() =>
      pane.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 140,
          clientY: 150,
        }),
      ),
    );
    expect(paneRequest).toHaveBeenCalledWith({
      x: 140,
      y: 150,
      world: expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      }),
    });
  } finally {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
