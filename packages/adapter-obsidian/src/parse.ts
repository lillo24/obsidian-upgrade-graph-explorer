import type { Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { frontmatter } from 'micromark-extension-frontmatter';

import { deriveMarkdownStructureFromMdast } from '@icarus-graph-explorer/parser-markdown/mdast';

import { parseFrontmatter } from './frontmatter';
import { SourceIndex } from './source-index';
import { extractObsidianSyntax } from './syntax';
import type { ObsidianParseInput, ParsedObsidianDocument } from './types';

/** Parse the tested Obsidian syntax subset without resolving workspace targets. */
export function parseObsidianDocument(
  input: ObsidianParseInput,
): ParsedObsidianDocument {
  const root: Root = fromMarkdown(input.source, {
    extensions: [frontmatter(['yaml'])],
    mdastExtensions: [frontmatterFromMarkdown(['yaml'])],
  });
  const index = new SourceIndex(input.source);
  const structure = deriveMarkdownStructureFromMdast(root, {
    path: input.path,
    sourceLength: input.source.length,
  });
  const frontmatterFacts = parseFrontmatter(root, input.path, index);
  const syntaxFacts = extractObsidianSyntax(
    root,
    input.source,
    input.path,
    index,
  );

  return {
    structure,
    metadata: frontmatterFacts.metadata,
    references: syntaxFacts.references,
    blockAnchors: syntaxFacts.blockAnchors,
    diagnostics: [...frontmatterFacts.diagnostics, ...syntaxFacts.diagnostics],
  };
}
