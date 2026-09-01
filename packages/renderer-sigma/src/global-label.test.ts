import { describe, expect, it } from 'vitest';

import { placeGlobalLabel } from './global-label';

const BASE = {
  nodeX: 120,
  nodeY: 80,
  nodeSize: 8,
  textWidth: 72,
  labelSize: 14,
  viewportWidth: 320,
  viewportHeight: 180,
} as const;

describe('Global viewport-aware label placement', () => {
  it('keeps the normal interior label on the right', () => {
    const placement = placeGlobalLabel(BASE);
    expect(placement.side).toBe('right');
    expect(placement.textX).toBe(BASE.nodeX + BASE.nodeSize + 3);
  });

  it('flips a right-boundary label to the left', () => {
    const placement = placeGlobalLabel({ ...BASE, nodeX: 300 });
    expect(placement.side).toBe('left');
    expect(placement.boxX).toBeGreaterThanOrEqual(4);
    expect(placement.boxX + placement.boxWidth).toBeLessThanOrEqual(316);
  });

  it('uses the right side at the left boundary', () => {
    const placement = placeGlobalLabel({ ...BASE, nodeX: 8 });
    expect(placement.side).toBe('right');
    expect(placement.boxX).toBeGreaterThanOrEqual(4);
  });

  it('clamps labels at the top and bottom', () => {
    const top = placeGlobalLabel({ ...BASE, nodeY: 0 });
    const bottom = placeGlobalLabel({ ...BASE, nodeY: 180 });
    expect(top.boxY).toBeGreaterThanOrEqual(4);
    expect(bottom.boxY + bottom.boxHeight).toBeLessThanOrEqual(176);
  });

  it('bounds a long label to the larger available side', () => {
    const placement = placeGlobalLabel({
      ...BASE,
      nodeX: 160,
      textWidth: 1_000,
    });
    expect(placement.textWidth).toBeLessThan(1_000);
    expect(placement.boxX).toBeGreaterThanOrEqual(4);
    expect(placement.boxX + placement.boxWidth).toBeLessThanOrEqual(316);
  });

  it('clamps a cramped label rather than crossing the viewport', () => {
    const placement = placeGlobalLabel({
      ...BASE,
      nodeX: 40,
      textWidth: 200,
      viewportWidth: 80,
    });
    expect(placement.boxX).toBeGreaterThanOrEqual(4);
    expect(placement.boxX + placement.boxWidth).toBeLessThanOrEqual(76);
  });
});
