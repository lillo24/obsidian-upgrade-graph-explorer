import type { RetrievalMetadata } from '@icarus-graph-explorer/argument-workspace';

export interface RetrievalEditorText {
  readonly aliases: string;
  readonly keywords: string;
  readonly phrases: string;
}

export function normalizeRetrievalEditorText(
  source: RetrievalEditorText,
): RetrievalMetadata {
  const values = (value: string): readonly string[] =>
    [
      ...new Set(
        value
          .split(/[\n,]/u)
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    ].sort();
  return {
    aliases: values(source.aliases),
    keywords: values(source.keywords),
    phrases: values(source.phrases),
  };
}

export function retrievalEditorText(
  retrieval: RetrievalMetadata,
): RetrievalEditorText {
  return {
    aliases: retrieval.aliases.join('\n'),
    keywords: retrieval.keywords.join('\n'),
    phrases: retrieval.phrases.join('\n'),
  };
}
