import { describe, expect, it } from 'vitest';

import { resolveLocalDensityFit } from './local-density';
import type { LocalDensityInput } from './local-density';

function input(
  coordinates: readonly {
    readonly key: string;
    readonly x: number;
    readonly y: number;
  }[],
  edges: readonly { readonly source: string; readonly target: string }[],
  size = 6,
): {
  readonly densityInput: LocalDensityInput;
  readonly positions: typeof coordinates;
} {
  return {
    densityInput: {
      rootNodeKey: coordinates[0]?.key ?? 'missing-root',
      nodes: coordinates.map(({ key }) => ({
        key,
        attributes: { size },
      })),
      edges,
    },
    positions: coordinates,
  };
}

describe('Focus density Fit policy', () => {
  it('is deterministic, bounded, and leaves accepted geometry untouched', () => {
    const scene = input(
      [
        { key: 'root', x: 0, y: 0 },
        { key: 'a', x: 20, y: 8 },
        { key: 'b', x: -15, y: 11 },
      ],
      [
        { source: 'root', target: 'a' },
        { source: 'root', target: 'b' },
      ],
    );
    const before = structuredClone(scene.positions);
    const first = resolveLocalDensityFit(scene.densityInput, scene.positions);
    const second = resolveLocalDensityFit(scene.densityInput, scene.positions);

    expect(first).toEqual(second);
    expect(first.fallback).toBe(false);
    expect(first.ratio).toBeGreaterThanOrEqual(0.7);
    expect(first.ratio).toBeLessThanOrEqual(1.4);
    expect(scene.positions).toEqual(before);
  });

  it('uses only one final clamp for valid sparse upper and lower cases', () => {
    const upper = input(
      [
        { key: 'root', x: 0, y: 0 },
        { key: 'leaf', x: 1, y: 0 },
      ],
      [{ source: 'root', target: 'leaf' }],
    );
    const lower = input(
      [
        { key: 'root', x: 0, y: 0 },
        { key: 'near', x: 1, y: 0 },
        { key: 'isolate', x: 1_000, y: 0 },
      ],
      [{ source: 'root', target: 'near' }],
      100,
    );

    expect(
      resolveLocalDensityFit(upper.densityInput, upper.positions),
    ).toMatchObject({
      fallback: false,
      ratio: 1.4,
    });
    expect(
      resolveLocalDensityFit(lower.densityInput, lower.positions),
    ).toMatchObject({
      fallback: false,
      ratio: 0.7,
    });
  });

  it('is invariant to uniform coordinate scaling and has no viewport input', () => {
    const scene = input(
      [
        { key: 'root', x: 0, y: 0 },
        { key: 'a', x: 4, y: 2 },
        { key: 'b', x: -2, y: 5 },
      ],
      [
        { source: 'root', target: 'a' },
        { source: 'a', target: 'b' },
      ],
    );
    const scaled = scene.positions.map((position) => ({
      ...position,
      x: position.x * 500,
      y: position.y * 500,
    }));

    expect(resolveLocalDensityFit(scene.densityInput, scaled)).toEqual(
      resolveLocalDensityFit(scene.densityInput, scene.positions),
    );
  });

  it.each([
    {
      name: 'single node',
      scene: input([{ key: 'root', x: 0, y: 0 }], []),
    },
    {
      name: 'no edges',
      scene: input(
        [
          { key: 'root', x: 0, y: 0 },
          { key: 'leaf', x: 1, y: 0 },
        ],
        [],
      ),
    },
    {
      name: 'duplicate coordinates',
      scene: input(
        [
          { key: 'root', x: 0, y: 0 },
          { key: 'leaf', x: 0, y: 0 },
        ],
        [{ source: 'root', target: 'leaf' }],
      ),
    },
    {
      name: 'non-finite coordinates',
      scene: input(
        [
          { key: 'root', x: 0, y: 0 },
          { key: 'leaf', x: Number.NaN, y: 0 },
        ],
        [{ source: 'root', target: 'leaf' }],
      ),
    },
  ])('falls back safely for $name', ({ scene }) => {
    expect(
      resolveLocalDensityFit(scene.densityInput, scene.positions),
    ).toMatchObject({ fallback: true, ratio: 1 });
  });
});
