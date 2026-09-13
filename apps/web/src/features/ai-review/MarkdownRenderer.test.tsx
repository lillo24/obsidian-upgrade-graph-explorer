// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MarkdownRenderer } from './MarkdownRenderer';
import { reviewMarkdownUrlTransform } from './markdown-security';

describe('safe review Markdown rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('blocks HTML, remote images, unsafe protocols, and keeps rich local formatting', async () => {
    const markdown = [
      '# Synthetic result',
      '',
      '<script>globalThis.pwned = true</script>',
      '',
      '![remote](https://example.test/image.png)',
      '',
      '[unsafe](javascript:alert(1)) [file](file:///secret) [safe](https://example.test)',
      '',
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '```ts',
      'const exact = "  whitespace";',
      '```',
      '',
      '$x^2 + y^2$',
    ].join('\n');
    await act(() => root.render(<MarkdownRenderer markdown={markdown} />));
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Remote image blocked: remote');
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      'https://example.test',
    );
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('pre')?.textContent).toContain(
      'const exact = "  whitespace";',
    );
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(Reflect.get(globalThis, 'pwned')).toBeUndefined();
  });

  it('accepts only deliberate web/mail protocols in the URL boundary', () => {
    expect(
      reviewMarkdownUrlTransform('https://example.test', 'href', {} as never),
    ).toBe('https://example.test');
    expect(
      reviewMarkdownUrlTransform('javascript:alert(1)', 'href', {} as never),
    ).toBe('');
    expect(
      reviewMarkdownUrlTransform('file:///secret', 'href', {} as never),
    ).toBe('');
    expect(
      reviewMarkdownUrlTransform('[[Local Note]]', 'href', {} as never),
    ).toBe('');
  });
});
