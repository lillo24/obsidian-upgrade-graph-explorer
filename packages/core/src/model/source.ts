/**
 * A normalized path relative to the workspace root.
 *
 * Valid paths use forward slashes, have no leading slash or drive prefix, and
 * contain no empty, `.` or `..` segments.
 */
export type WorkspacePath = string;

/**
 * A source point compatible with unist-style positions.
 *
 * Lines and columns are 1-based. When present, offset is a 0-based index in
 * JavaScript UTF-16 code units from the beginning of the source document.
 */
export interface SourcePoint {
  readonly line: number;
  readonly column: number;
  readonly offset?: number;
}

/**
 * A half-open source range: start is inclusive and end is exclusive.
 * Both points either include offsets or omit them.
 */
export interface SourceSpan {
  readonly start: SourcePoint;
  readonly end: SourcePoint;
}

/** The workspace-relative file and exact syntax range backing an entity. */
export interface SourceLocation {
  readonly path: WorkspacePath;
  readonly span: SourceSpan;
}
