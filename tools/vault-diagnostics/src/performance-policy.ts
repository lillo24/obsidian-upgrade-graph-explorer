import type {
  PerformanceBudget,
  PerformanceCacheDecision,
  PerformanceWorkerDecision,
} from '@icarus-graph-explorer/performance';

/**
 * Investigative responsiveness budgets. They describe user-visible boundaries
 * and are reported with measurements, but deliberately do not gate CI wall time.
 */
export const PERFORMANCE_BUDGETS = [
  {
    performanceClass: 'A',
    boundary:
      'direct feedback (hover, selection, Tools/Settings, Inspector, pan, or zoom)',
    medianMs: 16,
    p95Ms: 32,
    rationale:
      'Direct feedback should normally fit one 60 Hz frame and must not trigger projection or layout.',
    enforcement: 'investigative',
  },
  {
    performanceClass: 'B',
    boundary: 'derived view change (projection, layout, search, or inspection)',
    medianMs: 100,
    p95Ms: 250,
    rationale:
      'A deliberate graph-view change should feel immediate while allowing bounded derived work.',
    enforcement: 'investigative',
  },
  {
    performanceClass: 'C',
    boundary: 'workspace transaction (open, Markdown update, or full rescan)',
    medianMs: 1_000,
    p95Ms: 2_500,
    rationale:
      'Explicit workspace work may show progress but must retain the prior committed graph transactionally.',
    enforcement: 'investigative',
  },
] as const satisfies readonly PerformanceBudget[];

export const PERFORMANCE_WORKER_DECISIONS = [
  {
    workload: 'W1-workspace-engine-diagnostics',
    decision: 'worker-in-KG12B',
    evidence:
      'Implemented in KG12B1 as a stateful sequential worker with transactional candidate commit; medium/large direct work exceeded main-thread budgets.',
  },
  {
    workload: 'W2-projection',
    decision: 'main-thread',
    evidence:
      'PERFQ1A removed duplicate candidate projection/filter work for canonical QUERY1/path/kind filters and retained exact main-thread semantics. Medium depth-three query timing still misses Class B, but repeated evidence points to the remaining structural base as the next cache candidate rather than a W2 worker.',
  },
  {
    workload: 'W3-dagre-layout',
    decision: 'worker-in-KG12B',
    evidence:
      'Dagre dominates derived-view latency as projected node/edge counts rise and is the measured structural-renderer scale cliff.',
  },
  {
    workload: 'W4-inspection',
    decision: 'main-thread',
    evidence:
      'Inspection workspace construction is snapshot-scoped and memoized; bounded search and selected-item inspection remain below Class B budgets.',
  },
] as const satisfies readonly PerformanceWorkerDecision[];

export const PERFORMANCE_CACHE_DECISIONS = [
  {
    candidate: 'KG10 parsed-document cache',
    decision: 'retain',
    evidence:
      'It is correctness-tested and directly avoids reparsing unchanged Markdown files.',
  },
  {
    candidate: 'snapshot-scoped projection and inspection workspaces',
    decision: 'retain',
    evidence:
      'Existing React memoization already rebuilds them only when the canonical snapshot identity changes.',
  },
  {
    candidate: 'projectView result cache',
    decision: 'do-not-add',
    evidence:
      'Current state-identity memoization prevents unrelated interaction recomputation; PERFQ1A does not add a query-result cache or broaden invalidation state.',
  },
  {
    candidate: 'prepared structural projection cache (PERFQ1B candidate)',
    decision: 'do-not-add',
    evidence:
      'Not implemented in PERFQ1A. Repeated unchanged-disclosure query medians remain above 50 ms and the first structural base is about 40–50% of representative transitions, so a separate PERFQ1B should evaluate this evidence-backed candidate against the merged code.',
  },
  {
    candidate: 'renderer mapping and layout memoization',
    decision: 'retain',
    evidence:
      'Existing memoization keeps hover and selection in the highlight-only path and prevents layout on viewport interactions.',
  },
  {
    candidate: 'cross-snapshot inspection/search cache',
    decision: 'do-not-add',
    evidence:
      'Live snapshot replacement would require complex invalidation while measured bounded queries remain inexpensive.',
  },
] as const satisfies readonly PerformanceCacheDecision[];

export const RENDERER_SCALE_CLIFF =
  'The structural renderer cliff is Dagre layout over fully expanded projections: cost grows sharply once thousands of nodes and hierarchy/reference edges are simultaneously projected, well before mapping or inspection becomes dominant.';

export const KG12B_SCOPE =
  'KG12B1 moves stateful sequential W1 workspace-engine plus diagnostic transactions behind a versioned worker protocol. KG12B2 keeps W3 separate as a stateless latest-layout-wins worker; W2 projection and W4 inspection remain on the main thread with existing memoization and no new general-purpose cache.';
