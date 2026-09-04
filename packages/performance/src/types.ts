export const PERFORMANCE_RESULT_SCHEMA_VERSION = 1 as const;

export const PERFORMANCE_WORKLOAD_PROFILES = [
  'smoke',
  'small',
  'medium',
  'large',
] as const;
export type PerformanceWorkloadProfile =
  (typeof PERFORMANCE_WORKLOAD_PROFILES)[number];

export const PERFORMANCE_CLASSES = ['A', 'B', 'C'] as const;
export type PerformanceClass = (typeof PERFORMANCE_CLASSES)[number];

export const PERFORMANCE_INTERACTIONS = [
  'I1-initial-view-preparation',
  'I2-expand',
  'I3-collapse',
  'I4-structural-depth',
  'I5-graph-filters',
  'I6-focus-enter',
  'I7-focus-exit',
  'I8-hover',
  'I9-select',
  'I10-canonical-search',
  'I11-search-backlink-navigation',
  'I12-inspector',
  'I13-maximize-restore',
  'I14-resize',
  'I15-pan-zoom',
  'I16-live-markdown',
  'I17-live-non-markdown',
  'I18-full-rescan',
] as const;
export type PerformanceInteraction = (typeof PERFORMANCE_INTERACTIONS)[number];

export const PERFORMANCE_PHASES = [
  'parse-adapt',
  'resolution',
  'identity-reconciliation',
  'source-reconciliation',
  'workspace-update',
  'report-construction',
  'identity-persistence',
  'live-total',
  'worker-compute',
  'worker-round-trip',
  'main-thread-gap',
  'projection-workspace',
  'inspection-workspace',
  'project-view',
  'renderer-mapping',
  'dagre-layout',
  'dagre-worker-compute',
  'dagre-worker-round-trip',
  'dagre-worker-startup',
  'dagre-result-apply',
  'dagre-main-thread-gap',
  'dagre-request-adoption',
  'highlight',
  'graph-explorer-commit',
  'graph-canvas-commit',
  'next-paint',
  'viewport',
  'search',
  'inspection',
  'global-projection',
  'global-map',
  'graphology-reconcile',
  'global-layout-worker',
  'folder-prior',
  'layout-apply',
  'spatial-compose',
  'spatial-apply',
  'spatial-preview-apply',
  'sigma-mount-render',
  'semantic-zoom-style',
  'global-hover',
  'global-selection',
  'global-center',
  'local-projection',
  'local-map',
  'local-seed',
  'local-sigma-mount',
  'local-layout-worker',
  'local-layout-apply',
  'local-density',
  'local-visual-lod',
  'local-hover',
  'local-selection',
  'local-center',
  'global-to-local-transition',
  'local-to-global-transition',
] as const;
export type PerformancePhase = (typeof PERFORMANCE_PHASES)[number];

export const PERFORMANCE_OPERATIONS = [
  'projection-workspace-builds',
  'inspection-workspace-builds',
  'projections',
  'renderer-mappings',
  'layouts',
  'highlight-applications',
  'searches',
  'inspections',
  'viewport-operations',
  'live-adoptions',
  'global-projections',
  'global-mappings',
  'graphology-reconciliations',
  'global-layouts',
  'spatial-compositions',
  'spatial-applies',
  'spatial-preview-applies',
  'global-style-updates',
  'global-hover-applications',
  'global-selection-applications',
  'global-centers',
  'local-projections',
  'local-mappings',
  'local-seeds',
  'local-topology-reconciliations',
  'local-layouts',
  'local-density-evaluations',
  'local-style-updates',
  'local-hover-applications',
  'local-selection-applications',
  'local-centers',
  'global-to-local-transitions',
  'local-to-global-transitions',
] as const;
export type PerformanceOperation = (typeof PERFORMANCE_OPERATIONS)[number];

export interface PerformanceCanonicalCounts {
  readonly documents: number;
  readonly sections: number;
  readonly blocks: number;
  readonly entities: number;
  readonly references: number;
}

export interface PerformanceProjectedCounts {
  readonly nodes: number;
  readonly edges: number;
  readonly referenceEdges: number;
  readonly diagnosticNodes: number;
}

export interface PerformanceSampleSummary {
  readonly warmupCount: number;
  readonly sampleCount: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly maximumMs: number;
  /** Raw timings are allowed only for synthetic or aggregate local output. */
  readonly valuesMs: readonly number[];
}

export interface PerformanceOperationCounts {
  readonly 'projection-workspace-builds': number;
  readonly 'inspection-workspace-builds': number;
  readonly projections: number;
  readonly 'renderer-mappings': number;
  readonly layouts: number;
  readonly 'highlight-applications': number;
  readonly searches: number;
  readonly inspections: number;
  readonly 'viewport-operations': number;
  readonly 'live-adoptions': number;
  readonly 'global-projections': number;
  readonly 'global-mappings': number;
  readonly 'graphology-reconciliations': number;
  readonly 'global-layouts': number;
  readonly 'spatial-compositions': number;
  readonly 'spatial-applies': number;
  readonly 'spatial-preview-applies': number;
  readonly 'global-style-updates': number;
  readonly 'global-hover-applications': number;
  readonly 'global-selection-applications': number;
  readonly 'global-centers': number;
  readonly 'local-projections': number;
  readonly 'local-mappings': number;
  readonly 'local-seeds': number;
  readonly 'local-topology-reconciliations': number;
  readonly 'local-layouts': number;
  readonly 'local-density-evaluations': number;
  readonly 'local-style-updates': number;
  readonly 'local-hover-applications': number;
  readonly 'local-selection-applications': number;
  readonly 'local-centers': number;
  readonly 'global-to-local-transitions': number;
  readonly 'local-to-global-transitions': number;
}

export interface PerformanceEnvironment {
  readonly surface: 'node' | 'browser' | 'tauri';
  readonly gitCommit: string;
  readonly runtime: string;
  readonly os: string;
  readonly architecture: string;
  readonly cpu: string;
  readonly browser?: string;
  readonly webview?: string;
  readonly tauri?: string;
}

export interface PerformanceScenarioResult {
  readonly id: string;
  readonly label: string;
  readonly performanceClass: PerformanceClass;
  readonly profile: PerformanceWorkloadProfile;
  readonly canonical: PerformanceCanonicalCounts;
  readonly projected?: PerformanceProjectedCounts;
  readonly phases: Readonly<
    Partial<Record<PerformancePhase, PerformanceSampleSummary>>
  >;
  readonly operations: PerformanceOperationCounts;
  readonly layoutMode?: 'structure' | 'focus' | 'none';
  readonly buildMode?: 'development' | 'production';
  readonly omittedPhases?: readonly {
    readonly phase: PerformancePhase;
    readonly reason: string;
  }[];
}

export interface PerformanceBudget {
  readonly performanceClass: PerformanceClass;
  readonly boundary: string;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly rationale: string;
  readonly enforcement: 'investigative';
}

export interface PerformanceWorkerDecision {
  readonly workload:
    | 'W1-workspace-engine-diagnostics'
    | 'W2-projection'
    | 'W3-dagre-layout'
    | 'W4-inspection';
  readonly decision: 'main-thread' | 'worker-in-KG12B' | 'defer';
  readonly evidence: string;
}

export interface PerformanceCacheDecision {
  readonly candidate: string;
  readonly decision: 'retain' | 'add-in-KG12B' | 'do-not-add';
  readonly evidence: string;
}

export interface PerformanceResult {
  readonly schemaVersion: typeof PERFORMANCE_RESULT_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly environment: PerformanceEnvironment;
  readonly scenarios: readonly PerformanceScenarioResult[];
  readonly budgets: readonly PerformanceBudget[];
  readonly decisions: {
    readonly workers: readonly PerformanceWorkerDecision[];
    readonly caching: readonly PerformanceCacheDecision[];
    readonly rendererScaleCliff: string;
    readonly kg12bScope: string;
  };
  readonly note: string;
}

export interface PerformanceInstrumentation {
  readonly measure: <Value>(
    phase: PerformancePhase,
    operation: PerformanceOperation | undefined,
    run: () => Value,
  ) => Value;
  readonly record: (phase: PerformancePhase, durationMs: number) => void;
  readonly count: (operation: PerformanceOperation, amount?: number) => void;
  readonly markCommit: (
    phase: 'graph-explorer-commit' | 'graph-canvas-commit',
  ) => void;
  readonly markNextPaint: () => void;
}

export function emptyPerformanceOperationCounts(): PerformanceOperationCounts {
  return {
    'projection-workspace-builds': 0,
    'inspection-workspace-builds': 0,
    projections: 0,
    'renderer-mappings': 0,
    layouts: 0,
    'highlight-applications': 0,
    searches: 0,
    inspections: 0,
    'viewport-operations': 0,
    'live-adoptions': 0,
    'global-projections': 0,
    'global-mappings': 0,
    'graphology-reconciliations': 0,
    'global-layouts': 0,
    'spatial-compositions': 0,
    'spatial-applies': 0,
    'spatial-preview-applies': 0,
    'global-style-updates': 0,
    'global-hover-applications': 0,
    'global-selection-applications': 0,
    'global-centers': 0,
    'local-projections': 0,
    'local-mappings': 0,
    'local-seeds': 0,
    'local-topology-reconciliations': 0,
    'local-layouts': 0,
    'local-density-evaluations': 0,
    'local-style-updates': 0,
    'local-hover-applications': 0,
    'local-selection-applications': 0,
    'local-centers': 0,
    'global-to-local-transitions': 0,
    'local-to-global-transitions': 0,
  };
}
