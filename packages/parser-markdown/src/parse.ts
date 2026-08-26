import { fromMarkdown } from 'mdast-util-from-markdown';

import { deriveMarkdownStructure } from './structure';
import type { MarkdownParseInput, ParsedMarkdownDocument } from './types';

/** Parse CommonMark source and derive its root-level heading structure. */
export function parseMarkdownDocument(
  input: MarkdownParseInput,
): ParsedMarkdownDocument {
  const root = fromMarkdown(input.source);
  return deriveMarkdownStructure(root, {
    path: input.path,
    sourceLength: input.source.length,
  });
}
