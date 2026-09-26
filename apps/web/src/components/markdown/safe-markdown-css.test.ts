import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const safeMarkdownCss = readFileSync(
  new URL('./safe-markdown.css', import.meta.url),
  'utf8',
);

describe('SafeMarkdown CSS', () => {
  it('keeps fenced whitespace and makes the pre the sole horizontal scroll viewport', () => {
    expect(safeMarkdownCss).toMatch(
      /\.safe-markdown__code-block\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*overflow:\s*hidden;/su,
    );
    expect(safeMarkdownCss).toMatch(
      /\.safe-markdown__code-block pre\s*\{[^}]*width:\s*100%;[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden;/su,
    );
    expect(safeMarkdownCss).toMatch(
      /\.safe-markdown__code-block pre,\s*\.safe-markdown__error pre\s*\{[^}]*white-space:\s*pre;/su,
    );
  });
});
