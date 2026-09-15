export interface FocusSchematicSoftClusterSpacingPolicy {
  readonly hopSpacing: number;
  readonly moduleGap: number;
  readonly topologyExtraDistance: number;
  readonly packingStep: number;
  readonly radialJitter: number;
  readonly internalNodeSeparation: number;
  readonly internalRankSeparation: number;
  readonly modulePaddingX: number;
  readonly modulePaddingY: number;
}

export const DEFAULT_FOCUS_SCHEMATIC_SOFT_SPACING = 50;

/** Frozen pre-HIER4B-SPACING values retained as the bakeoff baseline. */
export const FOCUS_SCHEMATIC_SOFT_CLUSTER_BASELINE_SPACING = {
  hopSpacing: 520,
  moduleGap: 72,
  topologyExtraDistance: 155,
  packingStep: 64,
  radialJitter: 90,
  internalNodeSeparation: 24,
  internalRankSeparation: 48,
  modulePaddingX: 28,
  modulePaddingY: 24,
} as const satisfies FocusSchematicSoftClusterSpacingPolicy;

/** Validated lower anchor. It preserves the accepted pre-spacing geometry. */
export const FOCUS_SCHEMATIC_SOFT_SPACING_COMPACT = {
  ...FOCUS_SCHEMATIC_SOFT_CLUSTER_BASELINE_SPACING,
} as const satisfies FocusSchematicSoftClusterSpacingPolicy;

/** Evidence-selected default: moderate macro and internal breathing room. */
export const FOCUS_SCHEMATIC_SOFT_SPACING_SELECTED = {
  hopSpacing: 600,
  moduleGap: 88,
  topologyExtraDistance: 180,
  packingStep: 72,
  radialJitter: 104,
  internalNodeSeparation: 30,
  internalRankSeparation: 60,
  modulePaddingX: 34,
  modulePaddingY: 30,
} as const satisfies FocusSchematicSoftClusterSpacingPolicy;

/** Validated upper anchor selected from the wide/wide bakeoff candidate. */
export const FOCUS_SCHEMATIC_SOFT_SPACING_SPACIOUS = {
  hopSpacing: 680,
  moduleGap: 104,
  topologyExtraDistance: 210,
  packingStep: 84,
  radialJitter: 120,
  internalNodeSeparation: 36,
  internalRankSeparation: 72,
  modulePaddingX: 42,
  modulePaddingY: 36,
} as const satisfies FocusSchematicSoftClusterSpacingPolicy;

const POLICY_KEYS = Object.keys(
  FOCUS_SCHEMATIC_SOFT_CLUSTER_BASELINE_SPACING,
) as (keyof FocusSchematicSoftClusterSpacingPolicy)[];

export function normalizeFocusSchematicSoftSpacing(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : DEFAULT_FOCUS_SCHEMATIC_SOFT_SPACING;
}

function interpolate(
  from: FocusSchematicSoftClusterSpacingPolicy,
  to: FocusSchematicSoftClusterSpacingPolicy,
  factor: number,
): FocusSchematicSoftClusterSpacingPolicy {
  return Object.fromEntries(
    POLICY_KEYS.map((key) => [
      key,
      Math.round(from[key] + (to[key] - from[key]) * factor),
    ]),
  ) as unknown as FocusSchematicSoftClusterSpacingPolicy;
}

/** Resolves one bounded Sandbox value through the three validated anchors. */
export function resolveFocusSchematicSoftClusterSpacing(
  value: unknown,
): FocusSchematicSoftClusterSpacingPolicy {
  const normalized = normalizeFocusSchematicSoftSpacing(value);
  return normalized <= 50
    ? interpolate(
        FOCUS_SCHEMATIC_SOFT_SPACING_COMPACT,
        FOCUS_SCHEMATIC_SOFT_SPACING_SELECTED,
        normalized / 50,
      )
    : interpolate(
        FOCUS_SCHEMATIC_SOFT_SPACING_SELECTED,
        FOCUS_SCHEMATIC_SOFT_SPACING_SPACIOUS,
        (normalized - 50) / 50,
      );
}

/** Strict development comparator used only by the spacing bakeoff. */
export function validateFocusSchematicSoftClusterSpacingPolicy(
  value: FocusSchematicSoftClusterSpacingPolicy,
): FocusSchematicSoftClusterSpacingPolicy {
  for (const key of POLICY_KEYS) {
    if (!Number.isSafeInteger(value[key]) || value[key] <= 0)
      throw new Error(
        `Soft Cluster spacing ${key} must be a positive integer.`,
      );
  }
  return { ...value };
}
