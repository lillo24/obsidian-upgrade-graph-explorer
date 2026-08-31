const LINE_HEIGHT_PIXELS = 16;
const MAX_EVENT_DELTA_PIXELS = 240;
const MIN_EVENT_DELTA_PIXELS = 0.5;
const REVERSAL_GAP_MS = 90;
export const GLOBAL_ZOOM_SENSITIVITY = 0.0017;

export interface WheelDeltaInput {
  readonly deltaMode: number;
  readonly deltaY: number;
}

export class WheelDirectionStabilizer {
  private direction: -1 | 0 | 1 = 0;
  private lastEventAt = Number.NEGATIVE_INFINITY;

  stabilize(deltaPixels: number, nowMs: number): number {
    if (!Number.isFinite(deltaPixels) || deltaPixels === 0) return 0;
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
  return (
    Math.sign(boundedPixels) *
    Math.max(MIN_EVENT_DELTA_PIXELS, Math.abs(boundedPixels))
  );
}

export function ratioAfterWheelDelta(
  currentRatio: number,
  deltaPixels: number,
): number {
  return currentRatio * Math.exp(deltaPixels * GLOBAL_ZOOM_SENSITIVITY);
}
