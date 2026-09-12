interface FocusTarget {
  readonly isConnected?: boolean;
  readonly disabled?: boolean;
  focus(): void;
  closest?(selector: string): Element | null;
}

interface OverlayKeyboardEvent {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly target: EventTarget | null;
  preventDefault(): void;
  stopImmediatePropagation(): void;
}

export interface ArgumentWorkspaceOverlayHost {
  readonly bodyStyle: { overflow: string };
  readonly initialFocus: FocusTarget;
  readonly returnFocus?: FocusTarget;
  readonly fallbackFocus?: FocusTarget;
  readonly focusables: () => readonly FocusTarget[];
  addKeydownListener(listener: (event: OverlayKeyboardEvent) => void): void;
  removeKeydownListener(listener: (event: OverlayKeyboardEvent) => void): void;
  queueFocus(callback: () => void): void;
}

function visible(target: FocusTarget | undefined): target is FocusTarget {
  return (
    target !== undefined &&
    target.isConnected !== false &&
    target.disabled !== true &&
    target.closest?.('[hidden], [aria-hidden="true"]') === null
  );
}

/** Modal scroll, Escape, focus containment, and visible focus restoration. */
export function activateArgumentWorkspaceOverlay(
  host: ArgumentWorkspaceOverlayHost,
  onEscape: () => void,
): () => void {
  const previousOverflow = host.bodyStyle.overflow;
  const handleKeydown = (event: OverlayKeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = host.focusables().filter(visible);
    if (focusables.length === 0) {
      event.preventDefault();
      host.initialFocus.focus();
      return;
    }
    const currentIndex = focusables.findIndex(
      (candidate) => candidate === (event.target as unknown),
    );
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusables.length - 1
        : currentIndex - 1
      : currentIndex === -1 || currentIndex === focusables.length - 1
        ? 0
        : currentIndex + 1;
    if (
      (event.shiftKey && currentIndex <= 0) ||
      (!event.shiftKey &&
        (currentIndex === -1 || currentIndex === focusables.length - 1))
    ) {
      event.preventDefault();
      focusables[nextIndex]?.focus();
    }
  };
  host.bodyStyle.overflow = 'hidden';
  host.addKeydownListener(handleKeydown);
  host.initialFocus.focus();
  return () => {
    host.removeKeydownListener(handleKeydown);
    host.bodyStyle.overflow = previousOverflow;
    host.queueFocus(() => {
      if (visible(host.returnFocus)) host.returnFocus.focus();
      else if (visible(host.fallbackFocus)) host.fallbackFocus.focus();
    });
  };
}
