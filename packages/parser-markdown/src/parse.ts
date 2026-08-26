import { fromMarkdown } from 'mdast-util-from-markdown';

import { deriveMarkdownStructureFromMdast } from './structure';
import type { MarkdownParseInput, ParsedMarkdownDocument } from './types';

/** Parse CommonMark source and derive its root-level heading structure. */
export function parseMarkdownDocument(
  input: MarkdownParseInput,
): ParsedMarkdownDocument {
  const root = fromMarkdown(input.source);
  return deriveMarkdownStructureFromMdast(root, {
    path: input.path,
    sourceLength: input.source.length,
  });
}
