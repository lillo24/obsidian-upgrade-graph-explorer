const LINE_HEIGHT_PIXELS = 16;
const MAX_EVENT_DELTA_PIXELS = 240;
const PRECISE_LINEAR_DELTA_PIXELS = 8;
const MAX_EFFECTIVE_DELTA_PIXELS = 34;
const REVERSAL_GAP_MS = 90;
export const GLOBAL_ZOOM_SENSITIVITY = 0.0017;

export interface WheelDeltaInput {
  readonly deltaMode: number;
  readonly deltaY: number;
}

interface SigmaWheelDefaultControl {
  sigmaDefaultPrevented: boolean;
  preventSigmaDefault(): void;
}

export class WheelDirectionStabilizer {
  private direction: -1 | 0 | 1 = 0;
  private lastEventAt = Number.NEGATIVE_INFINITY;

  stabilize(
    deltaPixels: number,
    nowMs: number,
    useReversalGuard = true,
  ): number {
    if (!Number.isFinite(deltaPixels) || deltaPixels === 0) return 0;
    if (!useReversalGuard) return deltaPixels;
    const direction = deltaPixels > 0 ? 1 : -1;
    const followsQuietGap = nowMs - this.lastEventAt > REVERSAL_GAP_MS;
    this.lastEventAt = nowMs;
    if (
      this.direction === 0 ||
      direction === this.direction ||
      followsQuietGap
    ) {
      this.direction = direction;
      return deltaPixels;
    }
    return 0;
  }
}

/**
 * Sigma 3.0.3 spreads its wheel coordinates after creating the prevention
 * closure. Calling that closure updates the pre-spread object rather than the
 * object checked by MouseCaptor, so set the public flag explicitly as well.
 */
export function preventSigmaWheelDefault(
  coordinates: SigmaWheelDefaultControl,
): void {
  coordinates.preventSigmaDefault();
  coordinates.sigmaDefaultPrevented = true;
}

export function normalizeWheelDeltaPixels(
  event: WheelDeltaInput,
  viewportHeight: number,
): number {
  const modeMultiplier =
    event.deltaMode === 1
      ? LINE_HEIGHT_PIXELS
      : event.deltaMode === 2
        ? Math.max(1, viewportHeight)
        : 1;
  const deltaPixels = event.deltaY * modeMultiplier;
  if (!Number.isFinite(deltaPixels)) return 0;
  const boundedPixels = Math.max(
    -MAX_EVENT_DELTA_PIXELS,
    Math.min(MAX_EVENT_DELTA_PIXELS, deltaPixels),
  );
  if (boundedPixels === 0) return 0;
  const boundedMagnitude = Math.abs(boundedPixels);
  if (boundedMagnitude <= PRECISE_LINEAR_DELTA_PIXELS) {
    return boundedPixels;
  }
  // Keep the curve continuous at the fine-input boundary, then ease coarse
  // events toward a finite per-event step without device or browser sniffing.
  const compressionRange =
    MAX_EFFECTIVE_DELTA_PIXELS - PRECISE_LINEAR_DELTA_PIXELS;
  const easedMagnitude = -Math.expm1(
    -(boundedMagnitude - PRECISE_LINEAR_DELTA_PIXELS) / compressionRange,
  );
  const compressedMagnitude =
    PRECISE_LINEAR_DELTA_PIXELS + compressionRange * easedMagnitude;
  return Math.sign(boundedPixels) * compressedMagnitude;
}

export function isCoarseWheelDelta(deltaPixels: number): boolean {
  return Math.abs(deltaPixels) > PRECISE_LINEAR_DELTA_PIXELS;
}

export function ratioAfterWheelDelta(
  currentRatio: number,
  deltaPixels: number,
): number {
  return currentRatio * Math.exp(deltaPixels * GLOBAL_ZOOM_SENSITIVITY);
}
