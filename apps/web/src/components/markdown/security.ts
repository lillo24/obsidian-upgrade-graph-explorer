import type { UrlTransform } from 'react-markdown';

export function safeMarkdownExternalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? url : '';
  } catch {
    return '';
  }
}

export const safeMarkdownUrlTransform: UrlTransform = (url) =>
  safeMarkdownExternalUrl(url);
