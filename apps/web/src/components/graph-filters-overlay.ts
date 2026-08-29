interface FilterOverlayKeyboardEvent {
  readonly key: string;
  preventDefault(): void;
  stopImmediatePropagation(): void;
}

interface GraphFiltersOverlayHost {
  readonly trigger: { readonly isConnected?: boolean; focus(): void };
  addKeydownListener(
    listener: (event: FilterOverlayKeyboardEvent) => void,
  ): void;
  removeKeydownListener(
    listener: (event: FilterOverlayKeyboardEvent) => void,
  ): void;
  queueFocus(callback: () => void): void;
}

/** Gives the nearest nonmodal Filters panel ownership of Escape and focus. */
export function activateGraphFiltersEscape(
  host: GraphFiltersOverlayHost,
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
