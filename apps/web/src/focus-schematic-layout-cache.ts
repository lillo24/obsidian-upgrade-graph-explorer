import {
  FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
  validateFocusSchematicComputedLayout,
  type FocusSchematicComputedLayout,
  type FocusSchematicLayoutInput,
} from '@icarus-graph-explorer/focus-schematic-layout';

const SELECTED_ALGORITHM_ID = 'A1-endpoint-facing-split-lanes';

export interface FocusSchematicLayoutCacheLookup {
  readonly status: 'hit' | 'miss' | 'invalid';
  readonly key: string;
  readonly approximateBytes: number;
  readonly value?: FocusSchematicComputedLayout;
}

interface CacheEntry {
  readonly key: string;
  readonly value: FocusSchematicComputedLayout;
  readonly approximateBytes: number;
}

export function exactFocusSchematicLayoutCacheKey(
  input: FocusSchematicLayoutInput,
): string {
  return JSON.stringify({
    protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
    algorithm: SELECTED_ALGORITHM_ID,
    input,
  });
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** Bounded page-lifetime cache. Exact serialized inputs gate every hit. */
export class FocusSchematicLayoutCache {
  readonly #maximumEntries: number;
  readonly #entries = new Map<string, CacheEntry>();

  constructor(maximumEntries = 24) {
    if (!Number.isSafeInteger(maximumEntries) || maximumEntries <= 0)
      throw new Error(
        'Focus Schematic cache bound must be a positive integer.',
      );
    this.#maximumEntries = maximumEntries;
  }

  get(input: FocusSchematicLayoutInput): FocusSchematicLayoutCacheLookup {
    const key = exactFocusSchematicLayoutCacheKey(input);
    const entry = this.#entries.get(key);
    if (entry === undefined)
      return { status: 'miss', key, approximateBytes: 0 };
    const validation = validateFocusSchematicComputedLayout(input, entry.value);
    if (!validation.valid) {
      this.#entries.delete(key);
      return {
        status: 'invalid',
        key,
        approximateBytes: entry.approximateBytes,
      };
    }
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return {
      status: 'hit',
      key,
      approximateBytes: entry.approximateBytes,
      value: validation.value,
    };
  }

  set(
    input: FocusSchematicLayoutInput,
    value: FocusSchematicComputedLayout,
  ): void {
    const validation = validateFocusSchematicComputedLayout(input, value);
    if (!validation.valid)
      throw new Error(
        `Cannot cache an invalid Focus Schematic layout: ${validation.issues[0]?.message ?? 'unknown issue'}`,
      );
    const key = exactFocusSchematicLayoutCacheKey(input);
    const entry: CacheEntry = {
      key,
      value,
      approximateBytes: byteLength(key) + byteLength(JSON.stringify(value)),
    };
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    while (this.#entries.size > this.#maximumEntries) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  /** Test/failure-injection seam; production callers only use validated get/set. */
  replaceForTesting(
    input: FocusSchematicLayoutInput,
    value: FocusSchematicComputedLayout,
  ): void {
    const key = exactFocusSchematicLayoutCacheKey(input);
    this.#entries.set(key, { key, value, approximateBytes: 1 });
  }

  get size(): number {
    return this.#entries.size;
  }
}

export const focusSchematicLayoutCache = new FocusSchematicLayoutCache();
