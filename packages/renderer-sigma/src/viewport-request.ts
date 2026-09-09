export interface GlobalViewportRequestReadiness {
  readonly geometryReady?: boolean;
  readonly handledKey: number;
  readonly layoutPending: boolean;
  readonly ready: boolean;
  readonly requestKey: number | undefined;
}

/** A semantic camera intent is consumed only against committed layout positions. */
export function shouldApplyGlobalViewportRequest({
  geometryReady = true,
  handledKey,
  layoutPending,
  ready,
  requestKey,
}: GlobalViewportRequestReadiness): boolean {
  return (
    ready &&
    geometryReady &&
    !layoutPending &&
    requestKey !== undefined &&
    requestKey > handledKey
  );
}
