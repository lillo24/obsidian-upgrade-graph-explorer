export const DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH = 100;

/**
 * Interpolates between the legacy Focus Fit ratio and the measured SPACING1B
 * decision. Strength is a transient Sandbox percentage, not layout identity.
 */
export function localDensityFramingRatio(
  densityDecisionRatio: number,
  strengthPercentage: number,
): number {
  if (!Number.isFinite(densityDecisionRatio) || densityDecisionRatio <= 0) {
    throw new Error(
      'Focus density framing requires a finite positive density ratio.',
    );
  }
  if (
    !Number.isFinite(strengthPercentage) ||
    strengthPercentage < 0 ||
    strengthPercentage > 150
  ) {
    throw new Error(
      'Focus density framing strength must be a finite percentage from 0 to 150.',
    );
  }
  return 1 + (densityDecisionRatio - 1) * (strengthPercentage / 100);
}
