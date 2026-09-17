import { describe, expect, it, vi } from 'vitest';

import {
  createNetworkLabelDrawers,
  drawNetworkNodeHover,
  drawNetworkNodeLabel,
  NetworkLabelHoverController,
  NETWORK_LABEL_FULL_OPACITY_RATIO,
  NETWORK_LABEL_REFERENCE_TEXT,
  placeNetworkLabel,
  resolveNetworkLabelHoverOffset,
  resolveNetworkLabelHoverProgress,
  resolveNetworkLabelOpacity,
  resolveNetworkLabelScale,
  truncateNetworkLabel,
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
    expect(placement.maxTextWidth).toBe(312);
    expect(placement.textX).toBe(160);
    expect(placement.textY).toBeGreaterThan(BASE.nodeY + BASE.nodeSize);
  });

  it('scales font and gap with Sigma rendered/logical node scale', () => {
    expect(
      resolveNetworkLabelScale({ renderedNodeSize: 4, logicalNodeSize: 8 }),
    ).toMatchObject({ fontSize: 8, gap: 2.5, renderScale: 0.5 });
    expect(
      resolveNetworkLabelScale({ renderedNodeSize: 16, logicalNodeSize: 8 }),
    ).toMatchObject({ fontSize: 32, gap: 10, renderScale: 2 });
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

describe('shared All/Focus Network label truncation', () => {
  const measureText = (value: string) => ({
    width: Array.from(value).length * 8,
  });

  it('keeps short and reference-width labels unchanged', () => {
    expect(truncateNetworkLabel({ measureText }, 'Short.md', 500)).toBe(
      'Short.md',
    );
    const referenceWidth = measureText(NETWORK_LABEL_REFERENCE_TEXT).width;
    expect(
      truncateNetworkLabel(
        { measureText },
        NETWORK_LABEL_REFERENCE_TEXT,
        referenceWidth,
      ),
    ).toBe(NETWORK_LABEL_REFERENCE_TEXT);
  });

  it('ellipsizes long labels by measured width without splitting Unicode', () => {
    const referenceWidth = measureText(NETWORK_LABEL_REFERENCE_TEXT).width;
    const long = 'Hippocampus as a reward predictor + Cerebellum.md';
    const truncated = truncateNetworkLabel(
      { measureText },
      long,
      referenceWidth,
    );
    expect(truncated.endsWith('…')).toBe(true);
    expect(measureText(truncated).width).toBeLessThanOrEqual(referenceWidth);
    expect(truncateNetworkLabel({ measureText }, 'A🧠BC.md', 3 * 8)).toBe(
      'A🧠…',
    );
  });

  it('draws natural-width text with no Canvas maxWidth compression argument', () => {
    const drawn = drawingContext();
    drawNetworkNodeLabel(
      drawn.context,
      {
        color: '#8a5cf5',
        label: 'Hippocampus as a reward predictor + Cerebellum.md',
        networkLabelLogicalSize: 8,
        size: 8,
        x: 120,
        y: 80,
      },
      labelSettings() as never,
    );
    expect(drawn.fillText).toHaveBeenCalledOnce();
    expect(drawn.fillText.mock.calls[0]).toHaveLength(3);
    expect(drawn.fillText.mock.calls[0]?.[0]).toMatch(/…$/);
  });

  it('truncates further for a narrow viewport instead of squeezing glyphs', () => {
    const drawn = drawingContext(80);
    drawNetworkNodeLabel(
      drawn.context,
      {
        color: '#8a5cf5',
        label: NETWORK_LABEL_REFERENCE_TEXT,
        networkLabelLogicalSize: 8,
        size: 8,
        x: 40,
        y: 40,
      },
      labelSettings() as never,
    );
    const rendered = drawn.fillText.mock.calls[0]?.[0] as string;
    expect(rendered.endsWith('…')).toBe(true);
    expect(Array.from(rendered).length).toBeLessThan(
      Array.from(NETWORK_LABEL_REFERENCE_TEXT).length,
    );
    expect(drawn.fillText.mock.calls[0]).toHaveLength(3);
  });
});

describe('renderer-local hover label motion', () => {
  it('uses bounded monotonic ease-out and reduced-motion snapping', () => {
    const at = (elapsedMs: number) =>
      resolveNetworkLabelHoverProgress({
        elapsedMs,
        from: 0,
        to: 1,
      });
    expect(at(0)).toBe(0);
    expect(at(30)).toBeGreaterThan(0);
    expect(at(60)).toBeGreaterThan(at(30));
    expect(at(120)).toBe(1);
    expect(at(1_000)).toBe(1);
    expect(
      resolveNetworkLabelHoverProgress({
        elapsedMs: 0,
        from: 0,
        to: 1,
        reducedMotion: true,
      }),
    ).toBe(1);
    expect(resolveNetworkLabelHoverOffset(8, 1)).toBe(2.8);
    expect(resolveNetworkLabelHoverOffset(100, 1)).toBe(3);
  });

  it('animates entry and return, then releases the transient overlay', () => {
    let now = 0;
    let handle = 0;
    const frames: (() => void)[] = [];
    const onFrame = vi.fn();
    const onSettled = vi.fn();
    const hover = new NetworkLabelHoverController({
      now: () => now,
      onFrame,
      onSettled,
      requestFrame: (callback) => {
        frames.push(callback);
        return ++handle;
      },
    });

    hover.setHovered(undefined, 'node');
    expect(hover.ownsLabelLayer('node')).toBe(true);
    expect(hover.progress('node')).toBe(0);
    now = 60;
    expect(hover.progress('node')).toBeGreaterThan(0.5);
    frames.shift()?.();
    now = 120;
    frames.shift()?.();
    expect(hover.progress('node')).toBe(1);

    hover.setHovered('node', undefined);
    now = 180;
    expect(hover.progress('node')).toBeLessThan(0.5);
    frames.shift()?.();
    now = 240;
    frames.shift()?.();
    expect(hover.ownsLabelLayer('node')).toBe(false);
    expect(onFrame).toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledWith(['node']);
  });

  it('changes only label y while preserving text, x, and font', () => {
    let now = 0;
    const hover = new NetworkLabelHoverController({
      now: () => now,
      onFrame: () => undefined,
      onSettled: () => undefined,
      requestFrame: () => 1,
    });
    hover.setHovered(undefined, 'node');
    now = 120;
    const drawers = createNetworkLabelDrawers(hover);
    const ordinary = drawingContext();
    const animated = drawingContext();
    const data = {
      color: '#8a5cf5',
      key: 'node',
      label: 'Node',
      networkLabelLogicalSize: 8,
      size: 8,
      x: 120,
      y: 80,
    };

    drawNetworkNodeLabel(ordinary.context, data, labelSettings() as never);
    drawers.drawHover(animated.context, data, labelSettings() as never);

    const baseCall = ordinary.fillText.mock.calls[0]!;
    const hoverCall = animated.fillText.mock.calls[0]!;
    expect(hoverCall[0]).toBe(baseCall[0]);
    expect(hoverCall[1]).toBe(baseCall[1]);
    expect(hoverCall[2]).toBeGreaterThan(baseCall[2] as number);
    expect(animated.fontAtFill()).toBe(ordinary.fontAtFill());
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

function drawingContext(width = 320) {
  const fillText = vi.fn();
  const alphaAtFill = vi.fn<() => number>();
  const fontAtFill = vi.fn<() => string>();
  const state = { font: '', globalAlpha: 1 };
  const context = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    canvas: { width, height: 180 },
    fillText: (...args: unknown[]) => {
      alphaAtFill.mockReturnValue(state.globalAlpha);
      fontAtFill.mockReturnValue(state.font);
      fillText(...args);
    },
    get font() {
      return state.font;
    },
    set font(value: string) {
      state.font = value;
    },
    get globalAlpha() {
      return state.globalAlpha;
    },
    set globalAlpha(value: number) {
      state.globalAlpha = value;
    },
    getTransform: () => ({ a: 1, d: 1 }),
    measureText: (value: string) => ({ width: Array.from(value).length * 8 }),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  return { alphaAtFill, context, fillText, fontAtFill };
}

function labelSettings() {
  return {
    labelColor: { color: '#dadada' },
    labelFont: 'sans-serif',
    labelRenderedSizeThreshold: 4,
    labelWeight: 'normal',
  };
}
