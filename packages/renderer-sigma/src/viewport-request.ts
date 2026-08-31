export interface GlobalViewportRequestReadiness {
  readonly handledKey: number;
  readonly layoutPending: boolean;
  readonly ready: boolean;
  readonly requestKey: number | undefined;
}

/** A semantic camera intent is consumed only against committed layout positions. */
export function shouldApplyGlobalViewportRequest({
  handledKey,
  layoutPending,
  ready,
  requestKey,
}: GlobalViewportRequestReadiness): boolean {
  return (
    ready &&
    !layoutPending &&
    requestKey !== undefined &&
    requestKey > handledKey
  );
}
