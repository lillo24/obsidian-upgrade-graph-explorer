import type { SourceSpan, WorkspacePath } from '@icarus-graph-explorer/core';
import type { ParsedMarkdownDocument } from '@icarus-graph-explorer/parser-markdown';

/** Pure adapter input; callers own path normalization and source acquisition. */
export interface ObsidianParseInput {
  readonly path: WorkspacePath;
  readonly source: string;
}

export interface ParsedObsidianMetadata {
  readonly aliases: readonly string[];
  readonly frontmatterSpan?: SourceSpan;
}

export type ParsedReferenceKind = 'link' | 'embed';
export type ParsedReferenceSyntax = 'wikilink' | 'markdown';

export type ParsedInternalTarget =
  | {
      readonly kind: 'file';
      readonly file: string;
    }
  | {
      readonly kind: 'heading';
      readonly file?: string;
      readonly headings: readonly string[];
    }
  | {
      readonly kind: 'block';
      readonly file?: string;
      readonly blockId: string;
    };

/** One unresolved source occurrence for KG4 to resolve against a workspace. */
export interface ParsedSourceReference {
  readonly kind: ParsedReferenceKind;
  readonly syntax: ParsedReferenceSyntax;
  readonly sourceSpan: SourceSpan;
  /** Exact wikilink target text, or the CommonMark-parsed link destination. */
  readonly rawTarget: string;
  readonly target: ParsedInternalTarget;
  readonly displayText?: string;
}

/** An exact marker occurrence; block-content ownership is deliberately absent. */
export interface ParsedObsidianBlockAnchor {
  readonly blockId: string;
  readonly markerSpan: SourceSpan;
}

export type ObsidianParseDiagnosticCode =
  | 'malformed-frontmatter'
  | 'invalid-aliases'
  | 'duplicate-alias'
  | 'unterminated-wikilink'
  | 'malformed-wikilink'
  | 'unsupported-search-shortcut'
  | 'invalid-block-id'
  | 'duplicate-block-id'
  | 'unterminated-comment';

export interface ObsidianParseDiagnostic {
  readonly code: ObsidianParseDiagnosticCode;
  readonly severity: 'warning' | 'error';
  readonly message: string;
  readonly sourceSpan?: SourceSpan;
}

/** Serializable, source-specific IR with no workspace resolution or IDs. */
export interface ParsedObsidianDocument {
  readonly structure: ParsedMarkdownDocument;
  readonly metadata: ParsedObsidianMetadata;
  readonly references: readonly ParsedSourceReference[];
  readonly blockAnchors: readonly ParsedObsidianBlockAnchor[];
  readonly diagnostics: readonly ObsidianParseDiagnostic[];
}
