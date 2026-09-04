import type { GlobalLayoutPosition } from './types';

/** Bounded memory-only dynamic-position cache; never stores fixed display output. */
export class GlobalSpatialInfluenceCache {
  readonly #capacity: number;
  readonly #entries = new Map<string, readonly GlobalLayoutPosition[]>();

  constructor(capacity = 4) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 16) {
      throw new Error('Spatial-influence cache capacity must be from 1 to 16.');
    }
    this.#capacity = capacity;
  }

  get(fingerprint: string): readonly GlobalLayoutPosition[] | undefined {
    const positions = this.#entries.get(fingerprint);
    if (positions === undefined) return undefined;
    this.#entries.delete(fingerprint);
    this.#entries.set(fingerprint, positions);
    return positions.map((position) => ({ ...position }));
  }

  set(fingerprint: string, positions: readonly GlobalLayoutPosition[]): void {
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

  clear(): void {
    this.#entries.clear();
  }

  get size(): number {
    return this.#entries.size;
  }
}
