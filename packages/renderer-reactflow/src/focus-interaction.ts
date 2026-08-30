export interface FocusActivationInput {
  readonly key: string;
  readonly repeat: boolean;
  readonly hasCanonicalEntityTarget: boolean;
  readonly originatesInControl: boolean;
}

/** Keeps Enter-to-focus local to a focused canonical graph node. */
export function shouldActivateEntityFocus({
  hasCanonicalEntityTarget,
  key,
  originatesInControl,
  repeat,
}: FocusActivationInput): boolean {
  return (
    key === 'Enter' &&
    !repeat &&
    hasCanonicalEntityTarget &&
    !originatesInControl
  );
}

/** A pointer double-click toggles disclosure once and remains disclosure-only. */
export function shouldToggleDisclosureForClick(clickCount: number): boolean {
  return clickCount <= 1;
}
