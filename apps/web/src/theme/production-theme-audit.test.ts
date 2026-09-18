/// <reference types="node" />

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const AUDIT_ROOTS = [
  'apps/web/src',
  'packages/renderer-sigma/src',
  'packages/renderer-reactflow/src',
] as const;
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
const SOURCE_EXTENSION = /\.(?:css|ts|tsx)$/;
const EXCLUDED_SOURCE = /(?:\.test\.|\.spec\.|fixture|sample-report)/i;

const THEME_BOUNDARIES = new Set([
  'apps/web/src/theme/tokens.css',
  'packages/renderer-reactflow/src/hierarchy-theme.ts',
  'packages/renderer-sigma/src/network-theme.ts',
  'packages/renderer-sigma/src/styles.css',
]);

const LITERAL_ALLOWLIST = new Map<string, readonly string[]>([
  [
    'apps/web/src/App.css',
    ['#275675', '#e7f1f8', '#4b476f', '#efedf8', '#645028', '#f8f0db'],
  ],
  [
    'apps/web/src/index.css',
    [
      '#e8eef2',
      '#10171c',
      '#8ed5c9',
      '#1d2a32',
      '#48606d',
      '#162129',
      '#334650',
      '#aee9dd',
      '#0d1418',
      '#0b1115',
      '#536873',
      '#73c8bb',
      '#d8fff8',
      '#f2b866',
      '#aebbc2',
    ],
  ],
]);

function productionFiles(root: string): string[] {
  const absoluteRoot = path.join(REPOSITORY_ROOT, root);
  const pending = [absoluteRoot];
  const files: string[] = [];
  while (pending.length > 0) {
    const directory = pending.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (
        SOURCE_EXTENSION.test(entry.name) &&
        !EXCLUDED_SOURCE.test(entry.name)
      ) {
        files.push(
          path.relative(REPOSITORY_ROOT, absolute).replaceAll('\\', '/'),
        );
      }
    }
  }
  return files.sort();
}

const auditedFiles = AUDIT_ROOTS.flatMap(productionFiles);

describe('production theme audit guard', () => {
  it('keeps UI color literals inside theme adapters or exact semantic/lab allowlists', () => {
    const violations: string[] = [];
    for (const relative of auditedFiles) {
      const source = readFileSync(path.join(REPOSITORY_ROOT, relative), 'utf8');
      const matches = [...source.matchAll(COLOR_LITERAL)].map((match) =>
        match[0].toLowerCase(),
      );
      if (matches.length === 0 || THEME_BOUNDARIES.has(relative)) continue;
      const allowed = LITERAL_ALLOWLIST.get(relative);
      if (
        allowed === undefined ||
        matches.slice().sort().join('\n') !==
          allowed
            .map((literal) => literal.toLowerCase())
            .sort()
            .join('\n')
      ) {
        violations.push(`${relative}: ${matches.join(', ')}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps system resolution and root theme tokens under the app theme owner', () => {
    const mediaOwners: string[] = [];
    const rootThemeOwners: string[] = [];
    for (const relative of auditedFiles) {
      const source = readFileSync(path.join(REPOSITORY_ROOT, relative), 'utf8');
      if (source.includes('prefers-color-scheme')) mediaOwners.push(relative);
      if (source.includes(':root[data-theme')) rootThemeOwners.push(relative);
    }
    expect(mediaOwners).toEqual(['apps/web/src/theme/runtime.ts']);
    expect(rootThemeOwners).toEqual(['apps/web/src/theme/tokens.css']);
  });
});
