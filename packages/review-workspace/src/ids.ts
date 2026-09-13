import type { ReviewIdGenerator } from '@icarus-graph-explorer/ai-review';

export interface UuidSource {
  randomUUID(): string;
}

function systemUuidSource(): UuidSource {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('Collision-resistant UUID generation is unavailable.');
  }
  return globalThis.crypto;
}

export function createUuidReviewIdGenerator(
  source: UuidSource = systemUuidSource(),
): ReviewIdGenerator {
  return {
    next: (kind) => `${kind}-${source.randomUUID()}`,
  };
}

export function createReviewPreparationId(
  source: UuidSource = systemUuidSource(),
): string {
  return `preparation-${source.randomUUID()}`;
}
