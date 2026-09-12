import type { GlobalCenterRequest, SemanticGlobalViewport } from './types';

export interface GlobalViewportRequestReadiness {
  readonly geometryReady?: boolean;
  readonly handledKey: number;
  readonly layoutPending: boolean;
  readonly ready: boolean;
  readonly requestKey: number | undefined;
}

/**
 * A semantic viewport applied by the session constructor already fulfills the
 * matching one-shot Center request. Replaying it after reveal would duplicate
 * the same camera intent on remount/cache-hit paths.
 */
export function initialViewportSatisfiesGlobalCenterRequest({
  initialViewport,
  request,
  requestEntityId,
}: {
  readonly initialViewport: SemanticGlobalViewport | undefined;
  readonly request: GlobalCenterRequest | undefined;
  readonly requestEntityId: string | null | undefined;
}): boolean {
  return (
    initialViewport !== undefined &&
    request !== undefined &&
    requestEntityId === initialViewport.anchorEntityId &&
    request.ratio === initialViewport.ratio
  );
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
