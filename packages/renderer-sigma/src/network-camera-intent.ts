export type NetworkPositionCameraIntent =
  'initial-automatic-framing' | 'preserve-current-frame';

/**
 * Position adoption gets one automatic-framing grant for a fresh renderer.
 * Later geometry transactions stay camera-neutral even if the visible camera
 * originated from automatic Fit or density framing.
 */
export class NetworkPositionCameraIntentPolicy {
  private initialAutomaticFramingPending: boolean;

  constructor(initialAutomaticFramingPending: boolean) {
    this.initialAutomaticFramingPending = initialAutomaticFramingPending;
  }

  claimCamera(): void {
    this.initialAutomaticFramingPending = false;
  }

  consumePositionAdoption(): NetworkPositionCameraIntent {
    if (!this.initialAutomaticFramingPending) return 'preserve-current-frame';
    this.initialAutomaticFramingPending = false;
    return 'initial-automatic-framing';
  }
}
