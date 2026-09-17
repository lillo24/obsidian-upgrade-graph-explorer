import { describe, expect, it, vi } from 'vitest';

import {
  drawNetworkNodeHover,
  drawNetworkNodeLabel,
  placeNetworkLabel,
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
      labelWeight: 'normal',
    };

    drawNetworkNodeLabel(context, data, settings as never);
    drawNetworkNodeHover(context, data, settings as never);

    expect(fillText).toHaveBeenCalledTimes(2);
    expect(fillText.mock.calls[0]).toEqual(fillText.mock.calls[1]);
  });
});
