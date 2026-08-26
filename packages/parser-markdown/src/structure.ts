import type { Heading, Root } from 'mdast';
import { toString } from 'mdast-util-to-string';

import type {
  SourcePoint,
  SourceSpan,
  WorkspacePath,
} from '@icarus-graph-explorer/core';

import type { ParsedMarkdownDocument, ParsedMarkdownSection } from './types';

type AstPosition = NonNullable<Root['position']>;

interface OffsetSourcePoint extends SourcePoint {
  readonly offset: number;
}

interface OffsetSourceSpan extends SourceSpan {
  readonly start: OffsetSourcePoint;
  readonly end: OffsetSourcePoint;
}

interface SectionDraft {
  readonly title: string;
  readonly level: number;
  readonly headingSpan: OffsetSourceSpan;
  readonly children: SectionDraft[];
  end?: OffsetSourcePoint;
}

export interface MarkdownStructureInput {
  readonly path: WorkspacePath;
  readonly sourceLength: number;
}

function structureError(
  path: WorkspacePath,
  context: string,
  detail: string,
): Error {
  return new Error(
    `Cannot derive Markdown structure for "${path}": ${context} ${detail}`,
  );
}

function comparePoints(start: SourcePoint, end: SourcePoint): number {
  if (start.line !== end.line) {
    return start.line - end.line;
  }

  return start.column - end.column;
}

function sourcePoint(
  point: AstPosition['start'],
  path: WorkspacePath,
  context: string,
): OffsetSourcePoint {
  if (
    !Number.isInteger(point.line) ||
    point.line < 1 ||
    !Number.isInteger(point.column) ||
    point.column < 1 ||
    point.offset === undefined ||
    !Number.isInteger(point.offset) ||
    point.offset < 0
  ) {
    throw structureError(
      path,
      context,
      'has invalid or missing line, column, or UTF-16 offset information.',
    );
  }

  return {
    line: point.line,
    column: point.column,
    offset: point.offset,
  };
}

function sourceSpan(
  position: AstPosition | undefined,
  path: WorkspacePath,
  context: string,
): OffsetSourceSpan {
  if (position === undefined) {
    throw structureError(path, context, 'is missing source position data.');
  }

  const start = sourcePoint(position.start, path, `${context} start`);
  const end = sourcePoint(position.end, path, `${context} end`);
  const pointOrder = comparePoints(start, end);
  const offsetOrder = start.offset - end.offset;

  if (
    pointOrder > 0 ||
    offsetOrder > 0 ||
    (pointOrder === 0) !== (offsetOrder === 0)
  ) {
    throw structureError(
      path,
      context,
      'has inconsistent half-open source boundaries.',
    );
  }

  return { start, end };
}

function assertDocumentExtent(
  span: OffsetSourceSpan,
  sourceLength: number,
  path: WorkspacePath,
): void {
  if (
    span.start.line !== 1 ||
    span.start.column !== 1 ||
    span.start.offset !== 0 ||
    span.end.offset !== sourceLength
  ) {
    throw structureError(
      path,
      'document position',
      `must cover offsets 0 through ${sourceLength}.`,
    );
  }
}

function closeSection(draft: SectionDraft, end: OffsetSourcePoint): void {
  draft.end = end;
}

function finalizeSection(
  draft: SectionDraft,
  path: WorkspacePath,
): ParsedMarkdownSection {
  if (draft.end === undefined) {
    throw structureError(
      path,
      `heading "${draft.title}"`,
      'was left without a section end boundary.',
    );
  }

  return {
    title: draft.title,
    level: draft.level,
    headingSpan: draft.headingSpan,
    span: {
      start: draft.headingSpan.start,
      end: draft.end,
    },
    children: draft.children.map((child) => finalizeSection(child, path)),
  };
}

function headingDraft(
  heading: Heading,
  path: WorkspacePath,
  documentSpan: OffsetSourceSpan,
): SectionDraft {
  const headingSpan = sourceSpan(
    heading.position,
    path,
    `level ${heading.depth} heading`,
  );

  if (
    headingSpan.start.offset < documentSpan.start.offset ||
    headingSpan.end.offset > documentSpan.end.offset
  ) {
    throw structureError(
      path,
      `level ${heading.depth} heading`,
      'falls outside the document extent.',
    );
  }

  return {
    title: toString(heading, { includeHtml: false }),
    level: heading.depth,
    headingSpan,
    children: [],
  };
}

/**
 * Derive parser IR from an mdast root.
 *
 * This is exposed only through the dedicated `parser-markdown/mdast`
 * integration subpath. The ordinary package entry point remains mdast-free.
 */
export function deriveMarkdownStructureFromMdast(
  root: Root,
  input: MarkdownStructureInput,
): ParsedMarkdownDocument {
  const documentSpan = sourceSpan(root.position, input.path, 'document');
  assertDocumentExtent(documentSpan, input.sourceLength, input.path);

  const roots: SectionDraft[] = [];
  const openSections: SectionDraft[] = [];
  let previousHeadingStart = documentSpan.start.offset;

  for (const node of root.children) {
    if (node.type !== 'heading') {
      continue;
    }

    const draft = headingDraft(node, input.path, documentSpan);
    if (draft.headingSpan.start.offset < previousHeadingStart) {
      throw structureError(
        input.path,
        `level ${draft.level} heading`,
        'appears before an earlier root heading.',
      );
    }
    previousHeadingStart = draft.headingSpan.start.offset;

    while (true) {
      const openSection = openSections.at(-1);
      if (openSection === undefined || openSection.level < draft.level) {
        break;
      }

      closeSection(openSection, draft.headingSpan.start);
      openSections.pop();
    }

    const parent = openSections.at(-1);
    if (parent === undefined) {
      roots.push(draft);
    } else {
      parent.children.push(draft);
    }
    openSections.push(draft);
  }

  for (const openSection of openSections) {
    closeSection(openSection, documentSpan.end);
  }

  return {
    path: input.path,
    span: documentSpan,
    sections: roots.map((section) => finalizeSection(section, input.path)),
  };
}
