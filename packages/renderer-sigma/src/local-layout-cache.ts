import type { LocalLayoutPosition } from './local-types';

/** Bounded, page-lifetime derived cache. Local coordinates are never durable. */
export class LocalLayoutCache {
  readonly #capacity: number;
  readonly #entries = new Map<string, readonly LocalLayoutPosition[]>();

  constructor(capacity = 6) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 24) {
      throw new Error(
        'Local layout cache capacity must be an integer from 1 to 24.',
      );
    }
    this.#capacity = capacity;
  }

  get(fingerprint: string): readonly LocalLayoutPosition[] | undefined {
    const positions = this.#entries.get(fingerprint);
    if (positions === undefined) return undefined;
    this.#entries.delete(fingerprint);
    this.#entries.set(fingerprint, positions);
    return positions.map((position) => ({ ...position }));
  }

  set(fingerprint: string, positions: readonly LocalLayoutPosition[]): void {
    this.#entries.delete(fingerprint);
    this.#entries.set(
      fingerprint,
      positions.map((position) => ({ ...position })),
    );
    while (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  delete(fingerprint: string): void {
    this.#entries.delete(fingerprint);
  }

  get size(): number {
    return this.#entries.size;
  }
}
