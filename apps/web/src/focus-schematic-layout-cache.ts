import {
  DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
  FOCUS_SCHEMATIC_SELECTED_LAYOUT_ALGORITHM_VERSION,
  FOCUS_SCHEMATIC_SOFT_CLUSTER_ALGORITHM_VERSION,
  FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
  focusSchematicLayoutMatchesProductPolicies,
  normalizeFocusSchematicSoftFolderScopeOverrides,
  normalizeFocusSchematicSoftFolderStrength,
  validateFocusSchematicComputedLayout,
  type FocusSchematicComputedLayout,
  type FocusSchematicLayoutInput,
  type FocusSchematicProductLayoutPolicies,
} from '@icarus-graph-explorer/focus-schematic-layout';

const SELECTED_ALGORITHM_ID = 'modular-focus-hierarchy';

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
  policiesOrAlgorithmVersion:
    | FocusSchematicProductLayoutPolicies
    | number = DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
  algorithmVersion: number = FOCUS_SCHEMATIC_SELECTED_LAYOUT_ALGORITHM_VERSION,
): string {
  const policies =
    typeof policiesOrAlgorithmVersion === 'number'
      ? DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES
      : policiesOrAlgorithmVersion;
  const selectedAlgorithmVersion =
    typeof policiesOrAlgorithmVersion === 'number'
      ? policiesOrAlgorithmVersion
      : algorithmVersion;
  return JSON.stringify({
    protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
    algorithm: SELECTED_ALGORITHM_ID,
    algorithmVersion:
      policies.macroLayout === 'soft-folder-clusters'
        ? FOCUS_SCHEMATIC_SOFT_CLUSTER_ALGORITHM_VERSION
        : selectedAlgorithmVersion,
    policies: {
      macroLayout: policies.macroLayout,
      softFolderStrength:
        policies.macroLayout === 'soft-folder-clusters'
          ? normalizeFocusSchematicSoftFolderStrength(
              policies.softFolderStrength,
            )
          : null,
      softFolderScopeOverrides:
        policies.macroLayout === 'soft-folder-clusters'
          ? normalizeFocusSchematicSoftFolderScopeOverrides(
              policies.softFolderScopeOverrides,
            )
          : null,
      endpointOrderPolicy: policies.endpointOrderPolicy,
      internalLayoutVariant: policies.internalLayoutVariant,
    },
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

  get(
    input: FocusSchematicLayoutInput,
    policies: FocusSchematicProductLayoutPolicies = DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
  ): FocusSchematicLayoutCacheLookup {
    const key = exactFocusSchematicLayoutCacheKey(input, policies);
    const entry = this.#entries.get(key);
    if (entry === undefined)
      return { status: 'miss', key, approximateBytes: 0 };
    const validation = validateFocusSchematicComputedLayout(input, entry.value);
    if (
      !validation.valid ||
      !focusSchematicLayoutMatchesProductPolicies(entry.value, policies)
    ) {
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
  ): void;
  set(
    input: FocusSchematicLayoutInput,
    policies: FocusSchematicProductLayoutPolicies,
    value: FocusSchematicComputedLayout,
  ): void;
  set(
    input: FocusSchematicLayoutInput,
    policiesOrValue:
      FocusSchematicProductLayoutPolicies | FocusSchematicComputedLayout,
    maybeValue?: FocusSchematicComputedLayout,
  ): void {
    const policies =
      maybeValue === undefined
        ? DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES
        : (policiesOrValue as FocusSchematicProductLayoutPolicies);
    const value =
      maybeValue ?? (policiesOrValue as FocusSchematicComputedLayout);
    const validation = validateFocusSchematicComputedLayout(input, value);
    if (
      !validation.valid ||
      !focusSchematicLayoutMatchesProductPolicies(value, policies)
    )
      throw new Error(
        `Cannot cache an invalid or policy-mismatched Focus Schematic layout: ${validation.valid ? 'policy mismatch' : (validation.issues[0]?.message ?? 'unknown issue')}`,
      );
    const key = exactFocusSchematicLayoutCacheKey(input, policies);
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
  ): void;
  replaceForTesting(
    input: FocusSchematicLayoutInput,
    policies: FocusSchematicProductLayoutPolicies,
    value: FocusSchematicComputedLayout,
  ): void;
  replaceForTesting(
    input: FocusSchematicLayoutInput,
    policiesOrValue:
      FocusSchematicProductLayoutPolicies | FocusSchematicComputedLayout,
    maybeValue?: FocusSchematicComputedLayout,
  ): void {
    const policies =
      maybeValue === undefined
        ? DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES
        : (policiesOrValue as FocusSchematicProductLayoutPolicies);
    const value =
      maybeValue ?? (policiesOrValue as FocusSchematicComputedLayout);
    const key = exactFocusSchematicLayoutCacheKey(input, policies);
    this.#entries.set(key, { key, value, approximateBytes: 1 });
  }

  get size(): number {
    return this.#entries.size;
  }
}

export const focusSchematicLayoutCache = new FocusSchematicLayoutCache();
