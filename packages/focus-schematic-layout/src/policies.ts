import type {
  FocusSchematicComputedLayout,
  FocusSchematicEndpointOrderPolicy,
  FocusSchematicInternalLayoutVariant,
} from './types';

export type { FocusSchematicEndpointOrderPolicy } from './types';

export type FocusSchematicProductInternalLayoutVariant = Exclude<
  FocusSchematicInternalLayoutVariant,
  'current'
>;

/** Persisted product choices sent verbatim to the layout worker and cache. */
export interface FocusSchematicProductLayoutPolicies {
  readonly endpointOrderPolicy: FocusSchematicEndpointOrderPolicy;
  readonly internalLayoutVariant: FocusSchematicProductInternalLayoutVariant;
}

export const DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES = {
  endpointOrderPolicy: 'crossing-optimized',
  internalLayoutVariant: 'adaptive-compass',
} as const satisfies FocusSchematicProductLayoutPolicies;

export function isFocusSchematicEndpointOrderPolicy(
  value: unknown,
): value is FocusSchematicEndpointOrderPolicy {
  return value === 'crossing-optimized' || value === 'document-order';
}

export function isFocusSchematicProductInternalLayoutVariant(
  value: unknown,
): value is FocusSchematicProductInternalLayoutVariant {
  return value === 'adaptive-compass' || value === 'vertical-spine';
}

export function focusSchematicLayoutMatchesProductPolicies(
  computed: FocusSchematicComputedLayout,
  policies: FocusSchematicProductLayoutPolicies,
): boolean {
  return (
    computed.internalLayoutEvidence.variant ===
      policies.internalLayoutVariant &&
    computed.folderBandPlan.enabled &&
    computed.folderBandPlan.optimization?.endpointOrderPolicy ===
      policies.endpointOrderPolicy
  );
}
