import type { Image, Link, Root } from 'mdast';
import { toString } from 'mdast-util-to-string';

import type { WorkspacePath } from '@icarus-graph-explorer/core';

import { SourceIndex } from './source-index';
import {
  BLOCK_ID_PATTERN,
  isObviousExternalTarget,
  parseInternalTarget,
  type TargetParseFailure,
} from './targets';
import type {
  ObsidianParseDiagnostic,
  ParsedObsidianBlockAnchor,
  ParsedReferenceKind,
  ParsedSourceReference,
} from './types';

interface OffsetRange {
  readonly start: number;
  readonly end: number;
}

interface AstNode {
  readonly type: string;
  readonly position?: Root['position'];
  readonly children?: readonly AstNode[];
}

interface SyntaxFacts {
  readonly references: readonly ParsedSourceReference[];
  readonly blockAnchors: readonly ParsedObsidianBlockAnchor[];
  readonly diagnostics: readonly ObsidianParseDiagnostic[];
}

interface AstRanges {
  readonly text: readonly OffsetRange[];
  readonly shields: readonly OffsetRange[];
  readonly markdownReferences: readonly ParsedSourceReference[];
}

function positionRange(
  node: AstNode,
  index: SourceIndex,
  context: string,
): OffsetRange {
  const position = node.position;
  if (position === undefined) {
    throw new Error(`${context} is missing source position data.`);
  }
  return {
    start: index.offset(position.start, `${context} start`),
    end: index.offset(position.end, `${context} end`),
  };
}

function diagnosticForTargetFailure(
  failure: TargetParseFailure,
  path: WorkspacePath,
  rawTarget: string,
  range: OffsetRange,
  index: SourceIndex,
): ObsidianParseDiagnostic {
  if (failure === 'unsupported-search-shortcut') {
    return {
      code: 'unsupported-search-shortcut',
      severity: 'warning',
      message: `Persisted Obsidian search shortcut ${JSON.stringify(rawTarget)} in "${path}" is not a durable reference target.`,
      sourceSpan: index.span(range.start, range.end),
    };
  }

  if (failure === 'invalid-block-id') {
    return {
      code: 'invalid-block-id',
      severity: 'warning',
      message: `Block target ${JSON.stringify(rawTarget)} in "${path}" must use only Latin letters, numbers, and dashes.`,
      sourceSpan: index.span(range.start, range.end),
    };
  }

  return {
    code: 'malformed-wikilink',
    severity: 'warning',
    message: `Malformed internal target ${JSON.stringify(rawTarget)} in "${path}" was not emitted as a reference.`,
    sourceSpan: index.span(range.start, range.end),
  };
}

function markdownReference(
  node: Link | Image,
  index: SourceIndex,
): ParsedSourceReference | undefined {
  if (isObviousExternalTarget(node.url)) {
    return undefined;
  }

  const result = parseInternalTarget(node.url);
  if (!result.ok) {
    return undefined;
  }

  const sourceSpan = index.spanFromPosition(
    node.position,
    `Markdown ${node.type}`,
  );
  const kind: ParsedReferenceKind = node.type === 'image' ? 'embed' : 'link';
  const displayText =
    node.type === 'image' ? (node.alt ?? undefined) : toString(node);

  return displayText === undefined
    ? {
        kind,
        syntax: 'markdown',
        sourceSpan,
        rawTarget: node.url,
        target: result.target,
      }
    : {
        kind,
        syntax: 'markdown',
        sourceSpan,
        rawTarget: node.url,
        target: result.target,
        displayText,
      };
}

function collectAstRanges(root: Root, index: SourceIndex): AstRanges {
  const text: OffsetRange[] = [];
  const shields: OffsetRange[] = [];
  const markdownReferences: ParsedSourceReference[] = [];

  function walk(node: AstNode): void {
    if (
      node.type === 'code' ||
      node.type === 'inlineCode' ||
      node.type === 'html' ||
      node.type === 'yaml'
    ) {
      shields.push(positionRange(node, index, node.type));
      return;
    }

    if (node.type === 'link' || node.type === 'image') {
      shields.push(positionRange(node, index, node.type));
      const reference = markdownReference(
        node as unknown as Link | Image,
        index,
      );
      if (reference !== undefined) {
        markdownReferences.push(reference);
      }
      return;
    }

    if (
      node.type === 'linkReference' ||
      node.type === 'imageReference' ||
      node.type === 'definition'
    ) {
      shields.push(positionRange(node, index, node.type));
      return;
    }

    if (node.type === 'text') {
      text.push(positionRange(node, index, 'text node'));
      return;
    }

    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  walk(root as unknown as AstNode);
  return { text, shields, markdownReferences };
}

function isEscaped(source: string, offset: number, floor: number): boolean {
  let backslashes = 0;
  for (let cursor = offset - 1; cursor >= floor; cursor -= 1) {
    if (source[cursor] !== '\\') {
      break;
    }
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function collectComments(
  source: string,
  textRanges: readonly OffsetRange[],
  index: SourceIndex,
  path: WorkspacePath,
): {
  readonly ranges: readonly OffsetRange[];
  readonly diagnostics: readonly ObsidianParseDiagnostic[];
} {
  const ranges: OffsetRange[] = [];
  let openOffset: number | undefined;

  for (const range of textRanges) {
    for (let cursor = range.start; cursor + 1 < range.end; cursor += 1) {
      if (
        source[cursor] !== '%' ||
        source[cursor + 1] !== '%' ||
        isEscaped(source, cursor, range.start)
      ) {
        continue;
      }

      if (openOffset === undefined) {
        openOffset = cursor;
      } else {
        ranges.push({ start: openOffset, end: cursor + 2 });
        openOffset = undefined;
      }
      cursor += 1;
    }
  }

  if (openOffset === undefined) {
    return { ranges, diagnostics: [] };
  }

  const range = { start: openOffset, end: source.length };
  ranges.push(range);
  return {
    ranges,
    diagnostics: [
      {
        code: 'unterminated-comment',
        severity: 'warning',
        message: `Unterminated Obsidian comment in "${path}" shields the remainder of the document.`,
        sourceSpan: index.span(range.start, range.end),
      },
    ],
  };
}

function containingRange(
  offset: number,
  ranges: readonly OffsetRange[],
): OffsetRange | undefined {
  return ranges.find((range) => offset >= range.start && offset < range.end);
}

function wikilinkReferences(
  source: string,
  textRanges: readonly OffsetRange[],
  comments: readonly OffsetRange[],
  index: SourceIndex,
  path: WorkspacePath,
): {
  readonly references: readonly ParsedSourceReference[];
  readonly diagnostics: readonly ObsidianParseDiagnostic[];
} {
  const references: ParsedSourceReference[] = [];
  const diagnostics: ObsidianParseDiagnostic[] = [];

  for (const range of textRanges) {
    let cursor = range.start;
    while (cursor + 1 < range.end) {
      const comment = containingRange(cursor, comments);
      if (comment !== undefined) {
        cursor = comment.end;
        continue;
      }

      if (
        source[cursor] !== '[' ||
        source[cursor + 1] !== '[' ||
        isEscaped(source, cursor, range.start)
      ) {
        cursor += 1;
        continue;
      }

      const syntaxStart =
        cursor > range.start &&
        source[cursor - 1] === '!' &&
        !isEscaped(source, cursor - 1, range.start)
          ? cursor - 1
          : cursor;
      let closeOffset = -1;
      let nestedOffset = -1;

      for (let search = cursor + 2; search + 1 < range.end; search += 1) {
        const searchComment = containingRange(search, comments);
        if (searchComment !== undefined) {
          break;
        }
        if (source[search] === '[' && source[search + 1] === '[') {
          nestedOffset = search;
          break;
        }
        if (source[search] === ']' && source[search + 1] === ']') {
          closeOffset = search;
          break;
        }
      }

      if (nestedOffset >= 0) {
        diagnostics.push({
          code: 'malformed-wikilink',
          severity: 'warning',
          message: `Nested wikilink opener in "${path}" was not emitted as a reference.`,
          sourceSpan: index.span(syntaxStart, nestedOffset),
        });
        cursor = nestedOffset;
        continue;
      }

      if (closeOffset < 0) {
        diagnostics.push({
          code: 'unterminated-wikilink',
          severity: 'warning',
          message: `Unterminated wikilink in "${path}" was not emitted as a reference.`,
          sourceSpan: index.span(syntaxStart, range.end),
        });
        break;
      }

      const syntaxEnd = closeOffset + 2;
      const content = source.slice(cursor + 2, closeOffset);
      const pipeOffset = content.indexOf('|');
      const rawTarget = pipeOffset < 0 ? content : content.slice(0, pipeOffset);
      const displayText =
        pipeOffset < 0 ? undefined : content.slice(pipeOffset + 1);
      const result = parseInternalTarget(rawTarget);
      const syntaxRange = { start: syntaxStart, end: syntaxEnd };

      if (!result.ok || /[\r\n]/u.test(content)) {
        diagnostics.push(
          diagnosticForTargetFailure(
            result.ok ? 'malformed' : result.failure,
            path,
            rawTarget,
            syntaxRange,
            index,
          ),
        );
      } else {
        const base = {
          kind: syntaxStart < cursor ? ('embed' as const) : ('link' as const),
          syntax: 'wikilink' as const,
          sourceSpan: index.span(syntaxStart, syntaxEnd),
          rawTarget,
          target: result.target,
        };
        references.push(
          displayText === undefined ? base : { ...base, displayText },
        );
      }

      cursor = syntaxEnd;
    }
  }

  return { references, diagnostics };
}

function intersects(
  range: OffsetRange,
  excluded: readonly OffsetRange[],
): boolean {
  return excluded.some(
    (candidate) => range.start < candidate.end && range.end > candidate.start,
  );
}

function referenceRange(reference: ParsedSourceReference): OffsetRange {
  const start = reference.sourceSpan.start.offset;
  const end = reference.sourceSpan.end.offset;
  if (start === undefined || end === undefined) {
    throw new Error('Parsed source references must include UTF-16 offsets.');
  }
  return { start, end };
}

function blockAnchors(
  source: string,
  excluded: readonly OffsetRange[],
  index: SourceIndex,
  path: WorkspacePath,
): {
  readonly anchors: readonly ParsedObsidianBlockAnchor[];
  readonly diagnostics: readonly ObsidianParseDiagnostic[];
} {
  const anchors: ParsedObsidianBlockAnchor[] = [];
  const diagnostics: ObsidianParseDiagnostic[] = [];
  const seen = new Set<string>();
  let lineStart = 0;

  while (lineStart <= source.length) {
    let lineEnd = lineStart;
    while (
      lineEnd < source.length &&
      source[lineEnd] !== '\r' &&
      source[lineEnd] !== '\n'
    ) {
      lineEnd += 1;
    }

    const line = source.slice(lineStart, lineEnd);
    const match = /(?:^|[ \t])\^([^\s]+)[ \t]*$/u.exec(line);
    if (match !== null) {
      const blockId = match[1];
      const caretInMatch = match[0].indexOf('^');
      const markerStart = lineStart + match.index + caretInMatch;
      const markerEnd = markerStart + 1 + (blockId?.length ?? 0);
      const markerRange = { start: markerStart, end: markerEnd };

      if (
        blockId !== undefined &&
        !blockId.startsWith('[') &&
        !intersects(markerRange, excluded)
      ) {
        const markerSpan = index.span(markerStart, markerEnd);
        if (!BLOCK_ID_PATTERN.test(blockId)) {
          diagnostics.push({
            code: 'invalid-block-id',
            severity: 'warning',
            message: `Block marker "^${blockId}" in "${path}" must use only Latin letters, numbers, and dashes.`,
            sourceSpan: markerSpan,
          });
        } else {
          anchors.push({ blockId, markerSpan });
          if (seen.has(blockId)) {
            diagnostics.push({
              code: 'duplicate-block-id',
              severity: 'warning',
              message: `Duplicate block ID "${blockId}" in "${path}" remains ambiguous.`,
              sourceSpan: markerSpan,
            });
          }
          seen.add(blockId);
        }
      }
    }

    if (lineEnd >= source.length) {
      break;
    }
    lineStart =
      source[lineEnd] === '\r' && source[lineEnd + 1] === '\n'
        ? lineEnd + 2
        : lineEnd + 1;
  }

  return { anchors, diagnostics };
}

function spanOffset(value: {
  readonly sourceSpan?: { readonly start: { readonly offset?: number } };
}): number {
  return value.sourceSpan?.start.offset ?? Number.MAX_SAFE_INTEGER;
}

export function extractObsidianSyntax(
  root: Root,
  source: string,
  path: WorkspacePath,
  index: SourceIndex,
): SyntaxFacts {
  const ast = collectAstRanges(root, index);
  const commentFacts = collectComments(source, ast.text, index, path);
  const wiki = wikilinkReferences(
    source,
    ast.text,
    commentFacts.ranges,
    index,
    path,
  );
  const anchors = blockAnchors(
    source,
    [...ast.shields, ...commentFacts.ranges],
    index,
    path,
  );
  const visibleMarkdownReferences = ast.markdownReferences.filter(
    (reference) => !intersects(referenceRange(reference), commentFacts.ranges),
  );
  const references = [...visibleMarkdownReferences, ...wiki.references].sort(
    (left, right) =>
      (left.sourceSpan.start.offset ?? 0) -
      (right.sourceSpan.start.offset ?? 0),
  );
  const diagnostics = [
    ...commentFacts.diagnostics,
    ...wiki.diagnostics,
    ...anchors.diagnostics,
  ].sort((left, right) => spanOffset(left) - spanOffset(right));

  return {
    references,
    blockAnchors: anchors.anchors,
    diagnostics,
  };
}
