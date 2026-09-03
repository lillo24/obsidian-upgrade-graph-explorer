import type { GraphFlowNode } from './types';

export interface PositionedNodeRectangle {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Two 7px focus/keyboard outlines plus 2px breathing room. */
export const HIERARCHY_NODE_CLEARANCE = 16;

function validateRectangle(rectangle: PositionedNodeRectangle): void {
  if (
    ![
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
      rectangle.x + rectangle.width,
      rectangle.y + rectangle.height,
    ].every(Number.isFinite) ||
    rectangle.width <= 0 ||
    rectangle.height <= 0
  ) {
    throw new Error(
      'Hierarchy rectangle requires finite coordinates and positive finite dimensions.',
    );
  }
}

function validateClearance(clearance: number): void {
  if (!Number.isFinite(clearance) || clearance < 0) {
    throw new Error(
      'Hierarchy rectangle clearance must be finite and non-negative.',
    );
  }
}

export function nodeRectangle(node: GraphFlowNode): PositionedNodeRectangle {
  const rectangle = {
    id: node.id,
    ...node.position,
    width: node.width ?? NaN,
    height: node.height ?? NaN,
  };
  validateRectangle(rectangle);
  return rectangle;
}

function intersects(
  a: PositionedNodeRectangle,
  b: PositionedNodeRectangle,
  clearance: number,
): boolean {
  return (
    a.x < b.x + b.width + clearance &&
    b.x < a.x + a.width + clearance &&
    a.y < b.y + b.height + clearance &&
    b.y < a.y + a.height + clearance
  );
}

/** X sweep; touching boundaries are clear. Pair order is independent of input order. */
export function findRectangleOverlaps(
  rectangles: readonly PositionedNodeRectangle[],
  clearance = 0,
): readonly (readonly [string, string])[] {
  validateClearance(clearance);
  rectangles.forEach(validateRectangle);
  const ordered = [...rectangles].sort(
    (a, b) => a.x - b.x || a.id.localeCompare(b.id),
  );
  let active: PositionedNodeRectangle[] = [];
  const pairs: [string, string][] = [];
  for (const rectangle of ordered) {
    active = active.filter(
      (other) => other.x + other.width + clearance > rectangle.x,
    );
    for (const other of active) {
      if (intersects(other, rectangle, clearance)) {
        pairs.push(
          other.id < rectangle.id
            ? [other.id, rectangle.id]
            : [rectangle.id, other.id],
        );
      }
    }
    active.push(rectangle);
  }
  return pairs.sort(
    (a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]),
  );
}

/** Fixed-card spatial buckets used only when adopting layout, never on interaction. */
export class RectangleOccupancy {
  private readonly buckets = new Map<string, PositionedNodeRectangle[]>();
  private readonly cellSize = 256;
  right = 0;

  private keys(
    rectangle: PositionedNodeRectangle,
    clearance: number,
  ): string[] {
    const keys: string[] = [];
    for (
      let x = Math.floor((rectangle.x - clearance) / this.cellSize);
      x <=
      Math.floor((rectangle.x + rectangle.width + clearance) / this.cellSize);
      x++
    ) {
      for (
        let y = Math.floor((rectangle.y - clearance) / this.cellSize);
        y <=
        Math.floor(
          (rectangle.y + rectangle.height + clearance) / this.cellSize,
        );
        y++
      )
        keys.push(`${x}:${y}`);
    }
    return keys;
  }

  add(rectangle: PositionedNodeRectangle): void {
    validateRectangle(rectangle);
    for (const key of this.keys(rectangle, 0)) {
      const bucket = this.buckets.get(key) ?? [];
      bucket.push(rectangle);
      this.buckets.set(key, bucket);
    }
    this.right = Math.max(this.right, rectangle.x + rectangle.width);
  }

  collisions(
    rectangle: PositionedNodeRectangle,
    clearance = HIERARCHY_NODE_CLEARANCE,
  ): readonly PositionedNodeRectangle[] {
    validateRectangle(rectangle);
    validateClearance(clearance);
    const candidates = new Set(
      this.keys(rectangle, clearance).flatMap(
        (key) => this.buckets.get(key) ?? [],
      ),
    );
    return [...candidates].filter((other) =>
      intersects(rectangle, other, clearance),
    );
  }
}
