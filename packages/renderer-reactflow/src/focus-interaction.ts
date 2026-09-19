export interface FocusActivationInput {
  readonly key: string;
  readonly repeat: boolean;
  readonly hasCanonicalEntityTarget: boolean;
  readonly originatesInControl: boolean;
}

export type EntityActivationRoute = 'focus' | 'subfocus';

/** Keeps Heading/Block dispatch opt-in so All Hierarchy behavior is unchanged. */
export function entityActivationRoute(
  kind: 'document' | 'section' | 'block',
  subfocusAvailable: boolean,
): EntityActivationRoute {
  return subfocusAvailable && kind !== 'document' ? 'subfocus' : 'focus';
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
