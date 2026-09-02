interface FilterOverlayKeyboardEvent {
  readonly key: string;
  preventDefault(): void;
  stopImmediatePropagation(): void;
}

interface FilterOverlayPointerEvent {
  readonly target: unknown;
}

interface GraphFiltersEscapeHost {
  readonly trigger: { readonly isConnected?: boolean; focus(): void };
  addKeydownListener(
    listener: (event: FilterOverlayKeyboardEvent) => void,
  ): void;
  removeKeydownListener(
    listener: (event: FilterOverlayKeyboardEvent) => void,
  ): void;
  queueFocus(callback: () => void): void;
}

interface GraphFiltersOverlayHost extends GraphFiltersEscapeHost {
  panelContains(target: unknown): boolean;
  triggerContains(target: unknown): boolean;
  addPointerdownListener(
    listener: (event: FilterOverlayPointerEvent) => void,
  ): void;
  removePointerdownListener(
    listener: (event: FilterOverlayPointerEvent) => void,
  ): void;
}

/** Gives the nearest nonmodal tool panel ownership of Escape and focus. */
export function activateGraphFiltersEscape(
  host: GraphFiltersEscapeHost,
  onClose: () => void,
): () => void {
  const closeOnEscape = (event: FilterOverlayKeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    onClose();
    host.queueFocus(() => {
      if (host.trigger.isConnected !== false) host.trigger.focus();
    });
  };
  host.addKeydownListener(closeOnEscape);
  return () => host.removeKeydownListener(closeOnEscape);
}

/** Adds outside-pointer dismissal to the Filters panel's Escape behavior. */
export function activateGraphFiltersOverlay(
  host: GraphFiltersOverlayHost,
  onClose: () => void,
): () => void {
  const cleanupEscape = activateGraphFiltersEscape(host, onClose);
  const closeOnOutsidePointer = (event: FilterOverlayPointerEvent) => {
    if (
      host.triggerContains(event.target) ||
      host.panelContains(event.target)
    ) {
      return;
    }
    onClose();
  };
  host.addPointerdownListener(closeOnOutsidePointer);
  return () => {
    cleanupEscape();
    host.removePointerdownListener(closeOnOutsidePointer);
  };
}
