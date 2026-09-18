// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { computeDagreLayout } from '@icarus-graph-explorer/dagre-layout/compute';
import type { DagreLayoutInput } from '@icarus-graph-explorer/dagre-layout';
import type { GraphLayoutResult } from './types';
import { GraphCanvas } from './GraphCanvas';
import { findRectangleOverlaps, HIERARCHY_NODE_CLEARANCE } from './geometry';
import { rendererTestProjection } from './test-fixture';

it('adopts one layout and keeps geometry, viewport, and renderer identity across theme switches', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let input: DagreLayoutInput | undefined;
  let finish: ((output: GraphLayoutResult) => void) | undefined;
  const layout = vi.fn((next: DagreLayoutInput) => {
    input = next;
    return new Promise<GraphLayoutResult>((resolve) => {
      finish = resolve;
    });
  });
  const cancelPending = vi.fn();
  const onSelectionChange = vi.fn();
  const onToggleEntity = vi.fn();
  const layoutService = {
    layoutLatest: layout,
    cancelPending,
    dispose: vi.fn(),
  };
  const projection = rendererTestProjection();
  const diagnostic = projection.nodes.find(
    (n) => n.kind === 'reference-target',
  )!;
  const withDiagnostics = {
    ...projection,
    nodes: [
      ...projection.nodes,
      ...Array.from({ length: 8 }, (_, i) => ({
        ...diagnostic,
        id: `diagnostic-${i}`,
      })),
    ],
    edges: [
      ...projection.edges,
      ...Array.from({ length: 8 }, (_, i) => ({
        ...projection.edges[1]!,
        id: `reference-${i}`,
        targetNodeId: `diagnostic-${i}`,
      })),
    ],
  };
  function rectangles() {
    return [
      ...container.querySelectorAll<HTMLElement>('.react-flow__node'),
    ].map((node) => {
      const xy = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(
        node.style.transform,
      );
      if (!xy) throw new Error('Missing rendered node position.');
      return {
        id: node.dataset.id!,
        x: Number(xy[1]),
        y: Number(xy[2]),
        width: parseFloat(node.style.width),
        height: parseFloat(node.style.height),
      };
    });
  }
  const renderCanvas = (theme: 'light' | 'dark') => (
    <GraphCanvas
      projection={withDiagnostics}
      layoutMode="local-structured"
      visualVariant="extended"
      rootEntityId="document-a"
      layoutService={layoutService}
      focusAppearance="outline"
      fitRequestKey={0}
      trackpadZoomMode="scroll-zoom"
      onToggleEntity={onToggleEntity}
      selection={null}
      onSelectionChange={onSelectionChange}
      theme={theme}
    />
  );
  try {
    await act(() => root.render(renderCanvas('light')));
    expect(layout).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Updating layout');
    const seed = rectangles();
    expect(seed).toHaveLength(withDiagnostics.nodes.length);
    expect(findRectangleOverlaps(seed, HIERARCHY_NODE_CLEARANCE)).toEqual([]);
    await act(() =>
      finish!({
        status: 'success',
        output: computeDagreLayout(input!),
        metrics: {
          workerComputeMs: 1,
          workerRoundTripMs: 1,
          workerStartupMs: 0,
        },
      }),
    );
    expect(container.textContent).not.toContain('Updating layout');
    const final = rectangles();
    expect(final).toHaveLength(seed.length);
    expect(findRectangleOverlaps(final, HIERARCHY_NODE_CLEARANCE)).toEqual([]);
    expect(final).not.toEqual(seed);
    expect(layout).toHaveBeenCalledTimes(1);

    const canvasBefore = container.querySelector<HTMLElement>('.graph-canvas')!;
    const viewportBefore = container.querySelector<HTMLElement>(
      '.react-flow__viewport',
    )!.style.transform;
    await act(() => root.render(renderCanvas('dark')));

    const canvasAfter = container.querySelector<HTMLElement>('.graph-canvas')!;
    expect(canvasAfter).toBe(canvasBefore);
    expect(canvasAfter.dataset.hierarchyTheme).toBe('icarus-hierarchy-dark');
    expect(
      canvasAfter.style.getPropertyValue('--hierarchy-canvas-background'),
    ).toBe('#10171c');
    expect(rectangles()).toEqual(final);
    expect(
      container.querySelector<HTMLElement>('.react-flow__viewport')!.style
        .transform,
    ).toBe(viewportBefore);
    expect(layout).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onToggleEntity).not.toHaveBeenCalled();
  } finally {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
