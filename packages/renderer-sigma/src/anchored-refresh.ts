export interface AnchoredRefreshHooks {
  readonly onAfterProcess: (callback: () => void) => void;
  readonly offAfterProcess: (callback: () => void) => void;
  readonly onAfterRender: (callback: () => void) => void;
  readonly offAfterRender: (callback: () => void) => void;
}

export interface AtomicAnchoredGraphMutationResult<T> {
  readonly result: T;
  readonly rendered: Promise<void>;
}

/**
 * Arms camera repair before a Graphology mutation can make Sigma schedule its
 * next process/render pass. Sigma's Graphology listeners own that refresh;
 * adding another explicit refresh would create a redundant render request.
 */
export function atomicAnchoredGraphMutation<T>(
  hooks: AnchoredRefreshHooks,
  restoreAnchor: () => void,
  mutate: () => T,
): AtomicAnchoredGraphMutationResult<T> {
  let resolveRendered: (() => void) | undefined;
  const rendered = new Promise<void>((resolve) => {
    resolveRendered = resolve;
  });
  const afterProcess = () => {
    hooks.offAfterProcess(afterProcess);
    restoreAnchor();
  };
  const afterRender = () => {
    hooks.offAfterRender(afterRender);
    resolveRendered?.();
  };
  const cleanup = () => {
    hooks.offAfterProcess(afterProcess);
    hooks.offAfterRender(afterRender);
  };

  hooks.onAfterProcess(afterProcess);
  hooks.onAfterRender(afterRender);
  try {
    return { result: mutate(), rendered };
  } catch (error: unknown) {
    cleanup();
    throw error;
  }
}
