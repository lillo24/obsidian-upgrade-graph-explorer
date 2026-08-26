import type { SourceSpan, WorkspacePath } from '@icarus-graph-explorer/core';

/** Pure parser input; callers own path normalization and source acquisition. */
export interface MarkdownParseInput {
  readonly path: WorkspacePath;
  readonly source: string;
}

/**
 * A heading-backed source section without canonical identity.
 *
 * `headingSpan` covers only the Markdown heading construct. `span` covers the
 * logical section from that heading through its descendants until a heading of
 * the same or a higher level, or EOF.
 */
export interface ParsedMarkdownSection {
  readonly title: string;
  readonly level: number;
  readonly headingSpan: SourceSpan;
  readonly span: SourceSpan;
  readonly children: readonly ParsedMarkdownSection[];
}

/** Source-neutral, serializable structure for one Markdown file. */
export interface ParsedMarkdownDocument {
  readonly path: WorkspacePath;
  readonly span: SourceSpan;
  readonly sections: readonly ParsedMarkdownSection[];
}
