interface MaximizedGraphModeHost {
  readonly bodyStyle: { overflow: string };
  readonly addKeydownListener: (
    listener: (event: KeyboardEvent) => void,
  ) => void;
  readonly removeKeydownListener: (
    listener: (event: KeyboardEvent) => void,
  ) => void;
}

export function activateMaximizedGraphMode(
  host: MaximizedGraphModeHost,
  onExit: () => void,
): () => void {
  const previousOverflow = host.bodyStyle.overflow;
  const exitOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onExit();
  };
  host.bodyStyle.overflow = 'hidden';
  host.addKeydownListener(exitOnEscape);
  return () => {
    host.removeKeydownListener(exitOnEscape);
    host.bodyStyle.overflow = previousOverflow;
  };
}
