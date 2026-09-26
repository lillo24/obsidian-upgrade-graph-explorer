import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const argumentsCss = readFileSync(
  new URL('./arguments.css', import.meta.url),
  'utf8',
);

describe('Arguments view layout CSS', () => {
  it('gives desktop To store panes independent scrolling without page overflow', () => {
    expect(argumentsCss).toMatch(
      /\.arguments-mailbox\s*\{[^}]*min-width:\s*0;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/su,
    );
    expect(argumentsCss).toMatch(
      /\.arguments-mailbox__layout\s*\{[^}]*grid-template-columns:\s*minmax\(13rem, 16rem\) minmax\(0, 1fr\);[^}]*overflow:\s*hidden;/su,
    );
    expect(argumentsCss).toMatch(
      /\.arguments-mailbox__layout nav\s*\{[^}]*min-width:\s*0;[^}]*min-height:\s*0;[^}]*overflow:\s*auto;/su,
    );
    expect(argumentsCss).toMatch(
      /\.arguments-mailbox__detail\s*\{[^}]*min-width:\s*0;[^}]*min-height:\s*0;[^}]*overflow:\s*auto;/su,
    );
  });

  it('keeps compact rows on one line and stacks the panes on narrow screens', () => {
    expect(argumentsCss).toMatch(
      /\.arguments-mailbox__row-title,\s*\.arguments-mailbox__row-meta\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/su,
    );
    expect(argumentsCss).toMatch(
      /@media \(max-width: 560px\)[\s\S]*\.arguments-mailbox__layout\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*overflow:\s*visible;/su,
    );
  });
});
