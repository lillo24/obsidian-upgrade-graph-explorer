interface DisposableLocalRenderer {
  readonly destroy: () => void;
}

export interface LocalAnchoredRefreshHooks {
  readonly afterProcess: (callback: () => void) => void;
  readonly afterRender: (callback: () => void) => void;
  readonly scheduleRefresh: () => void;
}

/**
 * Repositions the camera after Sigma has recomputed graph normalization but
 * before it draws that changed graph. Waiting until afterRender exposes one
 * frame with stale camera coordinates and produces a visible viewport jump.
 */
export function refreshLocalRendererWithAnchor(
  hooks: LocalAnchoredRefreshHooks,
  restoreAnchor: () => void,
): Promise<void> {
  return new Promise((resolve) => {
    hooks.afterProcess(restoreAnchor);
    hooks.afterRender(resolve);
    hooks.scheduleRefresh();
  });
}

export type LocalRendererMountResult<T extends DisposableLocalRenderer> =
  | {
      readonly ok: true;
      readonly session: T;
      readonly dispose: () => void;
    }
  | { readonly ok: false; readonly message: string };

export function mountLocalRendererSession<T extends DisposableLocalRenderer>(
  create: () => T,
): LocalRendererMountResult<T> {
  try {
    const session = create();
    let disposed = false;
    return {
      ok: true,
      session,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        session.destroy();
      },
    };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Focus Network WebGL initialization failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
