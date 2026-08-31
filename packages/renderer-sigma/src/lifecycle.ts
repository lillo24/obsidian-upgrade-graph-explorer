interface DisposableGlobalRenderer {
  readonly destroy: () => void;
}

export interface GlobalRendererLease<T extends DisposableGlobalRenderer> {
  readonly session: T;
  readonly dispose: () => void;
}

export type GlobalRendererMountResult<T extends DisposableGlobalRenderer> =
  | {
      readonly ok: true;
      readonly lease: GlobalRendererLease<T>;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Keeps the imperative WebGL construction boundary explicit and gives React a
 * cleanup lease that remains safe under development StrictMode's effect probe.
 */
export function mountGlobalRendererSession<T extends DisposableGlobalRenderer>(
  create: () => T,
): GlobalRendererMountResult<T> {
  try {
    const session = create();
    let disposed = false;
    return {
      ok: true,
      lease: {
        session,
        dispose: () => {
          if (disposed) return;
          disposed = true;
          session.destroy();
        },
      },
    };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Global WebGL renderer initialization failed: ${errorMessage(error)}`,
    };
  }
}
