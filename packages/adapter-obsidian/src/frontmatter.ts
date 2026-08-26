import type { Root } from 'mdast';
import { parseDocument } from 'yaml';

import type { WorkspacePath } from '@icarus-graph-explorer/core';

import { SourceIndex } from './source-index';
import type { ObsidianParseDiagnostic, ParsedObsidianMetadata } from './types';

interface FrontmatterResult {
  readonly metadata: ParsedObsidianMetadata;
  readonly diagnostics: readonly ObsidianParseDiagnostic[];
}

interface YamlNode {
  readonly type: 'yaml';
  readonly value: string;
  readonly position?: Root['position'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isYamlNode(value: unknown): value is YamlNode {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as {
    readonly type?: unknown;
    readonly value?: unknown;
  };
  return candidate.type === 'yaml' && typeof candidate.value === 'string';
}

export function parseFrontmatter(
  root: Root,
  path: WorkspacePath,
  index: SourceIndex,
): FrontmatterResult {
  const firstChild: unknown = root.children[0];
  if (!isYamlNode(firstChild)) {
    return { metadata: { aliases: [] }, diagnostics: [] };
  }

  const frontmatterSpan = index.spanFromPosition(
    firstChild.position,
    `YAML frontmatter in "${path}"`,
  );
  const document = parseDocument(firstChild.value, {
    logLevel: 'error',
    prettyErrors: false,
    uniqueKeys: true,
  });

  if (document.errors.length > 0) {
    const firstError = document.errors[0];
    return {
      metadata: { aliases: [], frontmatterSpan },
      diagnostics: [
        {
          code: 'malformed-frontmatter',
          severity: 'error',
          message: `Malformed YAML frontmatter in "${path}": ${firstError?.message ?? 'unknown YAML parse error'}`,
          sourceSpan: frontmatterSpan,
        },
      ],
    };
  }

  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 100 });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      metadata: { aliases: [], frontmatterSpan },
      diagnostics: [
        {
          code: 'malformed-frontmatter',
          severity: 'error',
          message: `Cannot read YAML frontmatter in "${path}": ${detail}`,
          sourceSpan: frontmatterSpan,
        },
      ],
    };
  }

  if (!isRecord(value) || value.aliases === undefined) {
    return { metadata: { aliases: [], frontmatterSpan }, diagnostics: [] };
  }

  if (!Array.isArray(value.aliases)) {
    return {
      metadata: { aliases: [], frontmatterSpan },
      diagnostics: [
        {
          code: 'invalid-aliases',
          severity: 'warning',
          message: `The aliases property in "${path}" must be a YAML list of strings.`,
          sourceSpan: frontmatterSpan,
        },
      ],
    };
  }

  const aliases: string[] = [];
  const seen = new Set<string>();
  const diagnostics: ObsidianParseDiagnostic[] = [];

  for (const alias of value.aliases) {
    if (typeof alias !== 'string') {
      diagnostics.push({
        code: 'invalid-aliases',
        severity: 'warning',
        message: `The aliases property in "${path}" contains a non-string value.`,
        sourceSpan: frontmatterSpan,
      });
      continue;
    }

    if (seen.has(alias)) {
      diagnostics.push({
        code: 'duplicate-alias',
        severity: 'warning',
        message: `Duplicate document alias ${JSON.stringify(alias)} in "${path}" was ignored.`,
        sourceSpan: frontmatterSpan,
      });
      continue;
    }

    seen.add(alias);
    aliases.push(alias);
  }

  return {
    metadata: { aliases, frontmatterSpan },
    diagnostics,
  };
}
