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

export const FOCUS_SCHEMATIC_SOFT_RADIAL_SPREAD_MIN_SCALE = 1;
export const FOCUS_SCHEMATIC_SOFT_RADIAL_SPREAD_MAX_SCALE = 2.4;

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

/**
 * Evidence-selected structural policy. Runtime spacing controls never alter
 * these solver inputs; they are applied as a radial post-layout transform.
 */
export const FOCUS_SCHEMATIC_SOFT_CLUSTER_STRUCTURAL_SPACING = {
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

export function normalizeFocusSchematicSoftSpacing(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : DEFAULT_FOCUS_SCHEMATIC_SOFT_SPACING;
}

/** Smooth spread-only mapping: 0 = base geometry, 50 = 1.7x, 100 = 2.4x. */
export function focusSchematicSoftRadialSpreadScale(value: unknown): number {
  const normalized = normalizeFocusSchematicSoftSpacing(value);
  return (
    FOCUS_SCHEMATIC_SOFT_RADIAL_SPREAD_MIN_SCALE +
    (FOCUS_SCHEMATIC_SOFT_RADIAL_SPREAD_MAX_SCALE -
      FOCUS_SCHEMATIC_SOFT_RADIAL_SPREAD_MIN_SCALE) *
      (normalized / 100)
  );
}
