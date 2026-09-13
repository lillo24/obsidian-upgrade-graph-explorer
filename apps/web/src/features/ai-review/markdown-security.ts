import type { UrlTransform } from 'react-markdown';

export function safeReviewExternalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? url : '';
  } catch {
    return '';
  }
}

export const reviewMarkdownUrlTransform: UrlTransform = (url) =>
  safeReviewExternalUrl(url);
