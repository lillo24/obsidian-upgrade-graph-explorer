export type GraphHistoryDirection = 'back' | 'forward';

export interface GraphHistoryShortcutInput {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly repeat: boolean;
  readonly editableTarget: boolean;
  readonly graphContext: boolean;
  readonly applicationOverlayOpen: boolean;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

export function graphHistoryShortcut(
  input: GraphHistoryShortcutInput,
): GraphHistoryDirection | null {
  if (
    input.repeat ||
    input.editableTarget ||
    !input.graphContext ||
    input.applicationOverlayOpen
  ) {
    return null;
  }

  const altDirection =
    input.altKey &&
    !input.ctrlKey &&
    !input.metaKey &&
    !input.shiftKey &&
    input.key === 'ArrowLeft'
      ? 'back'
      : input.altKey &&
          !input.ctrlKey &&
          !input.metaKey &&
          !input.shiftKey &&
          input.key === 'ArrowRight'
        ? 'forward'
        : null;
  const undoModifier = input.ctrlKey !== input.metaKey;
  const undoDirection =
    !input.altKey && undoModifier && input.key.toLowerCase() === 'z'
      ? input.shiftKey
        ? 'forward'
        : 'back'
      : null;
  const direction = altDirection ?? undoDirection;
  if (direction === 'back' && input.canGoBack) return direction;
  if (direction === 'forward' && input.canGoForward) return direction;
  return null;
}
