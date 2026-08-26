import type { SourceSpan } from '@icarus-graph-explorer/core';

export interface OffsetRange {
  readonly start: number;
  readonly end: number;
}

export function offsetRange(span: SourceSpan): OffsetRange | undefined {
  const start = span.start.offset;
  const end = span.end.offset;
  const pointOrder =
    span.start.line === span.end.line
      ? span.start.column - span.end.column
      : span.start.line - span.end.line;
  if (
    !Number.isInteger(span.start.line) ||
    !Number.isInteger(span.start.column) ||
    !Number.isInteger(span.end.line) ||
    !Number.isInteger(span.end.column) ||
    span.start.line < 1 ||
    span.start.column < 1 ||
    span.end.line < 1 ||
    span.end.column < 1 ||
    start === undefined ||
    end === undefined ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    pointOrder > 0 ||
    (pointOrder === 0) !== (start === end)
  ) {
    return undefined;
  }
  return { start, end };
}

export function contains(owner: OffsetRange, contained: OffsetRange): boolean {
  return owner.start <= contained.start && contained.end <= owner.end;
}
