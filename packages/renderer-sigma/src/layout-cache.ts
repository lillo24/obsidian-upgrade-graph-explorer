import type { GlobalLayoutPosition } from './types';

export class GlobalLayoutCache {
  readonly #capacity: number;
  readonly #entries = new Map<string, readonly GlobalLayoutPosition[]>();

  constructor(capacity = 4) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 16) {
      throw new Error(
        'Global layout cache capacity must be an integer from 1 to 16.',
      );
    }
    this.#capacity = capacity;
  }

  get(fingerprint: string): readonly GlobalLayoutPosition[] | undefined {
    const value = this.#entries.get(fingerprint);
    if (value === undefined) return undefined;
    this.#entries.delete(fingerprint);
    this.#entries.set(fingerprint, value);
    return value;
  }

  set(fingerprint: string, positions: readonly GlobalLayoutPosition[]): void {
    const copy = positions.map((position) => ({ ...position }));
    this.#entries.delete(fingerprint);
    this.#entries.set(fingerprint, copy);
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

  clear(): void {
    this.#entries.clear();
  }
}
