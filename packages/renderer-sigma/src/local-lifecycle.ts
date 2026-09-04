interface DisposableLocalRenderer {
  readonly destroy: () => void;
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
