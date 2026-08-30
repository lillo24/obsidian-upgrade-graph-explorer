import { describe, expect, it } from 'vitest';

import {
  normalizeWheelDeltaPixels,
  ratioAfterWheelDelta,
  WheelDirectionStabilizer,
} from './precision-wheel-zoom';

describe('precision wheel zoom', () => {
  it('gives tiny pixel deltas a visible floor without changing direction', () => {
    expect(
      normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: 0.125 }, 900),
    ).toBe(0.5);
    expect(
      normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: -0.125 }, 900),
    ).toBe(-0.5);
    expect(normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: 0 }, 900)).toBe(0);
    expect(ratioAfterWheelDelta(1, 0.5)).toBeGreaterThan(1);
    expect(ratioAfterWheelDelta(1, -0.5)).toBeLessThan(1);
  });

  it('makes equal opposite deltas reversible', () => {
    const zoomedOut = ratioAfterWheelDelta(0.8, 24);
    expect(ratioAfterWheelDelta(zoomedOut, -24)).toBeCloseTo(0.8, 12);
  });

  it('uses the original controlled continuous scale', () => {
    expect(ratioAfterWheelDelta(1, 100)).toBeCloseTo(Math.exp(0.17), 12);
  });

  it('accepts every same-direction fine delta without an activation threshold', () => {
    const stabilizer = new WheelDirectionStabilizer();

    expect(stabilizer.stabilize(0.01, 0)).toBe(0.01);
    expect(stabilizer.stabilize(0.01, 10)).toBe(0.01);
    expect(stabilizer.stabilize(0.01, 20)).toBe(0.01);
  });

  it('suppresses an immediate opposite inertia tail', () => {
    const stabilizer = new WheelDirectionStabilizer();

    expect(stabilizer.stabilize(12, 0)).toBe(12);
    expect(stabilizer.stabilize(-0.5, 20)).toBe(0);
    expect(stabilizer.stabilize(-4, 40)).toBe(0);
  });

  it('accepts a fine reversal immediately after a quiet gap', () => {
    const stabilizer = new WheelDirectionStabilizer();

    expect(stabilizer.stabilize(12, 0)).toBe(12);
    expect(stabilizer.stabilize(-0.01, 91)).toBe(-0.01);
  });

  it('normalizes line and page deltas before applying them', () => {
    expect(normalizeWheelDeltaPixels({ deltaMode: 1, deltaY: 2 }, 900)).toBe(
      32,
    );
    expect(normalizeWheelDeltaPixels({ deltaMode: 2, deltaY: 0.1 }, 900)).toBe(
      90,
    );
  });

  it('bounds unusually large events and rejects non-finite input', () => {
    expect(
      normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: 10_000 }, 900),
    ).toBe(240);
    expect(
      normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: -10_000 }, 900),
    ).toBe(-240);
    expect(
      normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: Number.NaN }, 900),
    ).toBe(0);
  });
});
