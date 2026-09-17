import { describe, expect, it, vi } from 'vitest';

import {
  drawNetworkNodeHover,
  drawNetworkNodeLabel,
  NETWORK_LABEL_FULL_OPACITY_RATIO,
  placeNetworkLabel,
  resolveNetworkLabelOpacity,
} from './network-label';

const BASE = {
  nodeX: 120,
  nodeY: 80,
  nodeSize: 8,
  textWidth: 72,
  viewportWidth: 320,
  viewportHeight: 180,
} as const;

describe('shared All/Focus Network label placement', () => {
  it('centers an interior label below the node', () => {
    const placement = placeNetworkLabel(BASE);
    expect(placement.textX).toBe(BASE.nodeX);
    expect(placement.textY).toBe(BASE.nodeY + BASE.nodeSize + 5);
    expect(placement.fontSize).toBe(16);
  });

  it.each([
    ['small', 2],
    ['ordinary', 8],
    ['large', 24],
    ['root/enlarged', 12],
  ])('keeps the %s node font within its rendered diameter', (_, nodeSize) => {
    const placement = placeNetworkLabel({ ...BASE, nodeSize });
    expect(placement.fontSize).toBeLessThanOrEqual(nodeSize * 2);
  });

  it('bounds a long label without moving it beside the node', () => {
    const placement = placeNetworkLabel({
      ...BASE,
      nodeX: 160,
      textWidth: 1_000,
    });
    expect(placement.maxTextWidth).toBe(300);
    expect(placement.textX).toBe(160);
    expect(placement.textY).toBeGreaterThan(BASE.nodeY + BASE.nodeSize);
  });

  it('keeps edge labels below while clamping their horizontal center', () => {
    const left = placeNetworkLabel({ ...BASE, nodeX: 2 });
    const right = placeNetworkLabel({ ...BASE, nodeX: 318 });
    expect(left.textX - left.maxTextWidth / 2).toBeGreaterThanOrEqual(4);
    expect(right.textX + right.maxTextWidth / 2).toBeLessThanOrEqual(316);
    expect(left.textY).toBe(BASE.nodeY + BASE.nodeSize + 5);
    expect(right.textY).toBe(BASE.nodeY + BASE.nodeSize + 5);
  });

  it('preserves the below-node invariant near the bottom edge', () => {
    const placement = placeNetworkLabel({ ...BASE, nodeY: 178 });
    expect(placement.textY).toBeGreaterThan(178 + BASE.nodeSize);
  });

  it('uses identical label anchor geometry for ordinary and hover drawing', () => {
    const fillText = vi.fn();
    const context = {
      arc: vi.fn(),
      beginPath: vi.fn(),
      canvas: { width: 320, height: 180 },
      fillText,
      globalAlpha: 1,
      getTransform: () => ({ a: 1, d: 1 }),
      measureText: () => ({ width: 72 }),
      restore: vi.fn(),
      save: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const data = {
      color: '#8a5cf5',
      label: 'Node',
      size: 8,
      x: 120,
      y: 80,
    };
    const settings = {
      labelColor: { color: '#dadada' },
      labelFont: 'sans-serif',
      labelRenderedSizeThreshold: 4,
      labelWeight: 'normal',
    };

    drawNetworkNodeLabel(context, data, settings as never);
    drawNetworkNodeHover(context, data, settings as never);

    expect(fillText).toHaveBeenCalledTimes(2);
    expect(fillText.mock.calls[0]).toEqual(fillText.mock.calls[1]);
  });
});

describe('shared All/Focus Network label opacity', () => {
  const opacity = (
    renderedNodeSize: number,
    labelRenderedSizeThreshold = 4,
    forceLabel = false,
  ) =>
    resolveNetworkLabelOpacity({
      renderedNodeSize,
      labelRenderedSizeThreshold,
      forceLabel,
    });

  it('is transparent below and at the existing hard threshold', () => {
    expect(opacity(3.9)).toBe(0);
    expect(opacity(4)).toBe(0);
  });

  it('rises continuously through the Obsidian-derived fade window', () => {
    const justAbove = opacity(4.01);
    const midpoint = opacity(4 * 2 ** 0.25);
    expect(justAbove).toBeGreaterThan(0);
    expect(justAbove).toBeLessThan(midpoint);
    expect(midpoint).toBeCloseTo(0.5);
  });

  it('is fully opaque at and above the rendered-size boundary', () => {
    expect(opacity(4 * NETWORK_LABEL_FULL_OPACITY_RATIO)).toBe(1);
    expect(opacity(40)).toBe(1);
  });

  it('returns a safe deterministic value for invalid ordinary sizes', () => {
    expect(opacity(-1)).toBe(0);
    expect(opacity(Number.NaN)).toBe(0);
  });

  it('moves the fade window with the current threshold', () => {
    expect(opacity(6, 4)).toBe(1);
    expect(opacity(6, 6)).toBe(0);
    expect(opacity(6 * 2 ** 0.25, 6)).toBeCloseTo(0.5);
  });

  it('keeps forced labels fully opaque below the ordinary threshold', () => {
    expect(opacity(1, 4, true)).toBe(1);
  });

  it('applies zoom alpha only to ordinary drawing while hover stays full', () => {
    const ordinaryContext = drawingContext();
    const hoverContext = drawingContext();
    const data = {
      color: '#8a5cf5',
      forceLabel: false,
      label: 'Node',
      size: 4 * 2 ** 0.25,
      x: 120,
      y: 80,
    };
    const settings = {
      labelColor: { color: '#dadada' },
      labelFont: 'sans-serif',
      labelRenderedSizeThreshold: 4,
      labelWeight: 'normal',
    };

    drawNetworkNodeLabel(ordinaryContext.context, data, settings as never);
    drawNetworkNodeHover(hoverContext.context, data, settings as never);

    expect(ordinaryContext.alphaAtFill()).toBeCloseTo(0.5);
    expect(hoverContext.alphaAtFill()).toBe(1);
    expect(ordinaryContext.fillText.mock.calls[0]).toEqual(
      hoverContext.fillText.mock.calls[0],
    );
  });

  it('draws a forced ordinary label at full opacity with unchanged geometry', () => {
    const ordinaryContext = drawingContext();
    const forcedContext = drawingContext();
    const settings = {
      labelColor: { color: '#dadada' },
      labelFont: 'sans-serif',
      labelRenderedSizeThreshold: 4,
      labelWeight: 'normal',
    };
    const data = {
      color: '#8a5cf5',
      label: 'Node',
      size: 4.01,
      x: 120,
      y: 80,
    };

    drawNetworkNodeLabel(
      ordinaryContext.context,
      { ...data, forceLabel: false },
      settings as never,
    );
    drawNetworkNodeLabel(
      forcedContext.context,
      { ...data, forceLabel: true },
      settings as never,
    );

    expect(ordinaryContext.alphaAtFill()).toBeLessThan(1);
    expect(forcedContext.alphaAtFill()).toBe(1);
    expect(ordinaryContext.fillText.mock.calls[0]).toEqual(
      forcedContext.fillText.mock.calls[0],
    );
  });
});

function drawingContext() {
  const fillText = vi.fn();
  const alphaAtFill = vi.fn<() => number>();
  const state = { globalAlpha: 1 };
  const context = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    canvas: { width: 320, height: 180 },
    fillText: (...args: unknown[]) => {
      alphaAtFill.mockReturnValue(state.globalAlpha);
      fillText(...args);
    },
    get globalAlpha() {
      return state.globalAlpha;
    },
    set globalAlpha(value: number) {
      state.globalAlpha = value;
    },
    getTransform: () => ({ a: 1, d: 1 }),
    measureText: () => ({ width: 72 }),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  return { alphaAtFill, context, fillText };
}
