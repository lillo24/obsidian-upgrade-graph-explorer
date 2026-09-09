import type {
  FocusSchematicComputedLayout,
  FocusSchematicEndpointOrderPolicy,
  FocusSchematicInternalLayoutVariant,
  FocusSchematicSoftFolderScopeOverride,
} from './types';
import { canonicalFocusSchematicSoftFolderScopeOverrides } from './soft-folder-scope';

export type { FocusSchematicEndpointOrderPolicy } from './types';

export type FocusSchematicProductInternalLayoutVariant = Exclude<
  FocusSchematicInternalLayoutVariant,
  'current'
>;

export type FocusSchematicProductMacroLayout =
  'directional-bands' | 'soft-folder-clusters';

/** Persisted product choices sent verbatim to the layout worker and cache. */
export interface FocusSchematicProductLayoutPolicies {
  readonly macroLayout: FocusSchematicProductMacroLayout;
  readonly softFolderStrength: number;
  readonly softFolderScopeOverrides: readonly FocusSchematicSoftFolderScopeOverride[];
  readonly endpointOrderPolicy: FocusSchematicEndpointOrderPolicy;
  readonly internalLayoutVariant: FocusSchematicProductInternalLayoutVariant;
}

export const DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES = {
  macroLayout: 'directional-bands',
  softFolderStrength: 50,
  softFolderScopeOverrides: [],
  endpointOrderPolicy: 'crossing-optimized',
  internalLayoutVariant: 'adaptive-compass',
} as const satisfies FocusSchematicProductLayoutPolicies;

export function isFocusSchematicProductMacroLayout(
  value: unknown,
): value is FocusSchematicProductMacroLayout {
  return value === 'directional-bands' || value === 'soft-folder-clusters';
}

export function normalizeFocusSchematicSoftFolderStrength(
  value: unknown,
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES.softFolderStrength;
}

export function normalizeFocusSchematicSoftFolderScopeOverrides(
  value: unknown,
): readonly FocusSchematicSoftFolderScopeOverride[] {
  return canonicalFocusSchematicSoftFolderScopeOverrides(value ?? []);
}

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
  if (
    computed.internalLayoutEvidence.variant !== policies.internalLayoutVariant
  )
    return false;
  if (policies.macroLayout === 'directional-bands')
    return (
      computed.folderBandPlan.enabled &&
      computed.internalLayoutEvidence.softClusterPolicyEvidence === undefined &&
      computed.folderBandPlan.optimization?.endpointOrderPolicy ===
        policies.endpointOrderPolicy
    );
  const evidence = computed.internalLayoutEvidence.softClusterPolicyEvidence;
  const expectedScope = normalizeFocusSchematicSoftFolderScopeOverrides(
    policies.softFolderScopeOverrides,
  );
  return (
    !computed.folderBandPlan.enabled &&
    evidence?.layoutFamily === 'soft-folder-clusters' &&
    evidence.endpointOrderPolicy === policies.endpointOrderPolicy &&
    evidence.strength ===
      normalizeFocusSchematicSoftFolderStrength(policies.softFolderStrength) &&
    JSON.stringify(evidence.scopeOverrides) === JSON.stringify(expectedScope) &&
    evidence.fileAttachmentPolicy === 'spatial-cardinal'
  );
}
