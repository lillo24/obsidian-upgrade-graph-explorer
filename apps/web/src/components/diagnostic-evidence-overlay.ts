interface FocusTarget {
  readonly isConnected?: boolean;
  focus(): void;
}

interface OverlayKeyboardEvent {
  readonly key: string;
  preventDefault(): void;
  stopImmediatePropagation(): void;
}

interface DiagnosticEvidenceOverlayHost {
  readonly bodyStyle: { overflow: string };
  readonly initialFocus: FocusTarget;
  readonly returnFocus?: FocusTarget;
  readonly fallbackFocus?: FocusTarget;
  addKeydownListener(listener: (event: OverlayKeyboardEvent) => void): void;
  removeKeydownListener(listener: (event: OverlayKeyboardEvent) => void): void;
  queueFocus(callback: () => void): void;
}

/** Owns modal Escape, scroll lock, and deterministic focus restoration. */
export function activateDiagnosticEvidenceOverlay(
  host: DiagnosticEvidenceOverlayHost,
  onClose: () => void,
): () => void {
  const previousOverflow = host.bodyStyle.overflow;
  const closeOnEscape = (event: OverlayKeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    onClose();
  };
  host.bodyStyle.overflow = 'hidden';
  host.addKeydownListener(closeOnEscape);
  host.initialFocus.focus();
  return () => {
    host.removeKeydownListener(closeOnEscape);
    host.bodyStyle.overflow = previousOverflow;
    host.queueFocus(() => {
      if (host.returnFocus?.isConnected === true) host.returnFocus.focus();
      else host.fallbackFocus?.focus();
    });
  };
}
