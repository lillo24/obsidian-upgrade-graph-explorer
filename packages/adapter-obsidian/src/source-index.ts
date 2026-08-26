import type { Root } from 'mdast';

import type { SourcePoint, SourceSpan } from '@icarus-graph-explorer/core';

type OffsetPoint = SourcePoint & { readonly offset: number };
type AstPosition = NonNullable<Root['position']>;
type AstPoint = AstPosition['start'];

/** Offset/line conversion over the original, non-normalized UTF-16 string. */
export class SourceIndex {
  readonly #source: string;
  readonly #lineStarts: readonly number[];

  constructor(source: string) {
    this.#source = source;
    const lineStarts = [0];

    for (let offset = 0; offset < source.length; offset += 1) {
      const character = source[offset];
      if (character === '\r') {
        if (source[offset + 1] === '\n') {
          offset += 1;
        }
        lineStarts.push(offset + 1);
      } else if (character === '\n') {
        lineStarts.push(offset + 1);
      }
    }

    this.#lineStarts = lineStarts;
  }

  span(start: number, end: number): SourceSpan {
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start ||
      end > this.#source.length
    ) {
      throw new RangeError(
        `Invalid half-open source span [${start}, ${end}) for length ${this.#source.length}.`,
      );
    }

    return { start: this.point(start), end: this.point(end) };
  }

  spanFromPosition(position: Root['position'], context: string): SourceSpan {
    if (position === undefined) {
      throw new Error(`${context} is missing source position data.`);
    }

    const start = this.offset(position.start, `${context} start`);
    const end = this.offset(position.end, `${context} end`);
    return this.span(start, end);
  }

  offset(point: AstPoint, context: string): number {
    if (
      point.offset === undefined ||
      !Number.isInteger(point.offset) ||
      point.offset < 0 ||
      point.offset > this.#source.length
    ) {
      throw new Error(`${context} has invalid or missing UTF-16 offset data.`);
    }
    return point.offset;
  }

  point(offset: number): OffsetPoint {
    let low = 0;
    let high = this.#lineStarts.length;

    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      const start = this.#lineStarts[middle];
      if (start !== undefined && start <= offset) {
        low = middle;
      } else {
        high = middle;
      }
    }

    const lineStart = this.#lineStarts[low];
    if (lineStart === undefined) {
      throw new Error(`Cannot locate source line for offset ${offset}.`);
    }

    return {
      line: low + 1,
      column: offset - lineStart + 1,
      offset,
    };
  }
}
