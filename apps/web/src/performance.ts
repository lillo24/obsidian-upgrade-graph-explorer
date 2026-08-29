import {
  PERFORMANCE_INTERACTIONS,
  createRuntimePerformanceRecorder,
  type PerformanceInstrumentation,
  type PerformanceInteraction,
  type RuntimePerformanceSnapshot,
} from '@icarus-graph-explorer/performance';

export interface BrowserPerformanceSnapshot extends RuntimePerformanceSnapshot {
  readonly interaction: PerformanceInteraction;
}

export interface BrowserPerformanceSession {
  readonly instrumentation: PerformanceInstrumentation;
  readonly begin: (
    interaction: PerformanceInteraction,
    correlationId?: string,
  ) => void;
  readonly snapshot: () => BrowserPerformanceSnapshot;
  readonly reset: () => void;
}

export interface BrowserPerformanceApi {
  readonly interactions: typeof PERFORMANCE_INTERACTIONS;
  readonly begin: (interaction: PerformanceInteraction) => void;
  readonly snapshot: () => BrowserPerformanceSnapshot;
  /** Schedules an explicit next-paint mark for resize/native automation. */
  readonly finish: () => void;
  readonly reset: () => void;
}

declare global {
  interface Window {
    icarusPerformance?: BrowserPerformanceApi;
  }
}

function performanceRequested(search: string): boolean {
  return new URLSearchParams(search).get('performance') === '1';
}

/**
 * Opt-in runtime measurements are enabled only by `?performance=1`. The
 * recorder is memory-only and deliberately omits source/private identifiers.
 */
export function createBrowserPerformanceSession(
  locationSearch = typeof window === 'undefined' ? '' : window.location.search,
  buildEnabled = import.meta.env.VITE_ICARUS_PERFORMANCE === '1',
): BrowserPerformanceSession | undefined {
  if (
    (!performanceRequested(locationSearch) && !buildEnabled) ||
    typeof window === 'undefined'
  ) {
    return undefined;
  }
  let interaction: PerformanceInteraction = 'I1-initial-view-preparation';
  let activeCorrelationId: string | undefined;
  let generation = 0;
  const recorder = createRuntimePerformanceRecorder({
    now: () => performance.now(),
    markNextPaint: (record) => {
      const scheduledGeneration = generation;
      const scheduledCorrelationId = activeCorrelationId;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (
            generation !== scheduledGeneration ||
            activeCorrelationId !== scheduledCorrelationId
          )
            return;
          // The recorder owns the interaction start. Zero asks it to calculate
          // the complete correlation-to-paint duration with its own clock.
          record(0);
        }),
      );
    },
  });
  return {
    instrumentation: recorder,
    begin(nextInteraction, correlationId) {
      if (!PERFORMANCE_INTERACTIONS.includes(nextInteraction)) {
        throw new Error(
          `Unsupported performance interaction: ${nextInteraction}.`,
        );
      }
      interaction = nextInteraction;
      activeCorrelationId = correlationId;
      generation += 1;
      recorder.reset();
    },
    snapshot() {
      return { interaction, ...recorder.snapshot() };
    },
    reset() {
      activeCorrelationId = undefined;
      generation += 1;
      recorder.reset();
    },
  };
}

export function installBrowserPerformanceApi(
  session: BrowserPerformanceSession | undefined,
): () => void {
  if (session === undefined || typeof window === 'undefined')
    return () => undefined;
  const api: BrowserPerformanceApi = {
    interactions: PERFORMANCE_INTERACTIONS,
    begin: (interaction) => session.begin(interaction),
    snapshot: session.snapshot,
    finish: session.instrumentation.markNextPaint,
    reset: session.reset,
  };
  window.icarusPerformance = api;
  return () => {
    if (window.icarusPerformance === api) delete window.icarusPerformance;
  };
}

/** One page-lifetime query/build opt-in session; normal loads stay disabled. */
export const browserPerformanceSession = createBrowserPerformanceSession();
installBrowserPerformanceApi(browserPerformanceSession);
