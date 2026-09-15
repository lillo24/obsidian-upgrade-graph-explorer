import type { SpatialPoint } from '@icarus-graph-explorer/spatial-overrides';

export interface FileMovePointerOwnerCallbacks {
  readonly onMove: (viewportPoint: SpatialPoint) => void;
  readonly onRelease: () => boolean;
  readonly onCancel: () => void;
}

type OwnedPointer = {
  readonly pointerId: number;
  readonly captured: boolean;
};

/**
 * Owns one native pointer from graph press through release. Sigma 3.0.3 uses
 * document bubble-phase mouse listeners, so HTML overlays can otherwise stop
 * the compatibility event before File Move sees it.
 */
export class FileMovePointerOwner {
  private candidatePointerId: number | undefined;
  private owned: OwnedPointer | undefined;
  private attached = false;
  private clickSuppressionCleanup: (() => void) | undefined;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: FileMovePointerOwnerCallbacks,
  ) {}

  get ownsPointerSequence(): boolean {
    return this.owned !== undefined;
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.container.addEventListener('pointerdown', this.pointerDown, true);
    document.addEventListener('pointermove', this.pointerMove, true);
    document.addEventListener('pointerup', this.pointerUp, true);
    document.addEventListener('pointercancel', this.pointerCancel, true);
    document.addEventListener(
      'lostpointercapture',
      this.lostPointerCapture,
      true,
    );
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.container.removeEventListener('pointerdown', this.pointerDown, true);
    document.removeEventListener('pointermove', this.pointerMove, true);
    document.removeEventListener('pointerup', this.pointerUp, true);
    document.removeEventListener('pointercancel', this.pointerCancel, true);
    document.removeEventListener(
      'lostpointercapture',
      this.lostPointerCapture,
      true,
    );
    this.reset();
  }

  /** Claims the primary pointerdown that synchronously produced downNode. */
  claim(): boolean {
    const pointerId = this.candidatePointerId;
    this.candidatePointerId = undefined;
    if (pointerId === undefined || this.owned !== undefined) return false;
    let captured = false;
    try {
      this.container.setPointerCapture(pointerId);
      captured = this.container.hasPointerCapture(pointerId);
    } catch {
      // Document capture listeners remain the explicit fallback.
    }
    this.owned = { pointerId, captured };
    return true;
  }

  /** Clears native ownership after Escape, blur, invalidation, or disposal. */
  reset(): void {
    this.candidatePointerId = undefined;
    const owned = this.owned;
    this.owned = undefined;
    if (owned?.captured === true) {
      try {
        if (this.container.hasPointerCapture(owned.pointerId)) {
          this.container.releasePointerCapture(owned.pointerId);
        }
      } catch {
        // The browser may already have released capture during cancellation.
      }
    }
    this.clickSuppressionCleanup?.();
  }

  private readonly pointerDown = (event: PointerEvent): void => {
    if (event.isPrimary === false || event.button !== 0) return;
    this.candidatePointerId = event.pointerId;
  };

  private readonly pointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.owned?.pointerId) return;
    if ((event.buttons & 1) === 0) {
      this.callbacks.onCancel();
      this.reset();
      return;
    }
    if (event.cancelable) event.preventDefault();
    const bounds = this.container.getBoundingClientRect();
    this.callbacks.onMove({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  };

  private readonly pointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.candidatePointerId) {
      this.candidatePointerId = undefined;
    }
    if (event.pointerId !== this.owned?.pointerId) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    const suppressClick = this.callbacks.onRelease();
    this.reset();
    if (suppressClick) this.suppressImmediateClick();
  };

  private readonly pointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.candidatePointerId) {
      this.candidatePointerId = undefined;
    }
    if (event.pointerId !== this.owned?.pointerId) return;
    this.callbacks.onCancel();
    this.reset();
  };

  private readonly lostPointerCapture = (event: PointerEvent): void => {
    if (event.pointerId !== this.owned?.pointerId) return;
    this.callbacks.onCancel();
    this.reset();
  };

  private suppressImmediateClick(): void {
    this.clickSuppressionCleanup?.();
    let timer: number | undefined;
    const click = (event: MouseEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      cleanup();
    };
    const cleanup = () => {
      document.removeEventListener('click', click, true);
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (this.clickSuppressionCleanup === cleanup) {
        this.clickSuppressionCleanup = undefined;
      }
    };
    document.addEventListener('click', click, true);
    timer = window.setTimeout(cleanup, 0);
    this.clickSuppressionCleanup = cleanup;
  }
}
