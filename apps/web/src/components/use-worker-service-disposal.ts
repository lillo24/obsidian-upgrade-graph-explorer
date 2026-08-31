import { useEffect, useRef } from 'react';

interface DisposableWorkerService {
  readonly dispose: () => void;
}

/**
 * Defers disposal past React's development-only same-tick effect probe. A real
 * unmount has no replacement lease and still tears the worker down promptly.
 */
export function useWorkerServiceDisposal(
  service: DisposableWorkerService,
): void {
  const leaseTracker = useRef({ generation: 0 });
  useEffect(() => {
    const tracker = leaseTracker.current;
    const lease = ++tracker.generation;
    return () => {
      queueMicrotask(() => {
        if (tracker.generation === lease) service.dispose();
      });
    };
  }, [service]);
}
