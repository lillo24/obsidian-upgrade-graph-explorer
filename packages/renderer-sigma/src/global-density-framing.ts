export const DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH = 100;

/** Camera-only interpolation between legacy All Fit and its density decision. */
export function globalDensityFramingRatio(
  densityDecisionRatio: number,
  strengthPercentage: number,
): number {
  if (!Number.isFinite(densityDecisionRatio) || densityDecisionRatio <= 0) {
    throw new Error(
      'All Network density framing requires a finite positive density ratio.',
    );
  }
  if (
    !Number.isFinite(strengthPercentage) ||
    strengthPercentage < 0 ||
    strengthPercentage > 150
  ) {
    throw new Error(
      'All Network density framing strength must be a finite percentage from 0 to 150.',
    );
  }
  return 1 + (densityDecisionRatio - 1) * (strengthPercentage / 100);
}
