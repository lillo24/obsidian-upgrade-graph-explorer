import type { PerformanceInteraction, PerformanceOperation } from './types';

export interface PerformanceInteractionOperationContract {
  /** Operations expected once for one completed production interaction. */
  readonly expected: readonly PerformanceOperation[];
  /** Expensive operations that must remain at zero for this interaction. */
  readonly forbidden: readonly PerformanceOperation[];
}

const NO_DERIVED_REBUILD = [
  'projection-workspace-builds',
  'inspection-workspace-builds',
  'projections',
  'renderer-mappings',
  'layouts',
] as const;

/**
 * Deterministic production-operation oracle for KG12 browser correlation.
 * React development Strict Mode is intentionally outside this count contract.
 */
export const PERFORMANCE_INTERACTION_OPERATION_CONTRACTS: Readonly<
  Record<PerformanceInteraction, PerformanceInteractionOperationContract>
> = {
  'I1-initial-view-preparation': {
    expected: [
      'projection-workspace-builds',
      'inspection-workspace-builds',
      'projections',
      'renderer-mappings',
      'layouts',
      'highlight-applications',
    ],
    forbidden: [],
  },
  'I2-expand': {
    expected: [
      'projections',
      'renderer-mappings',
      'layouts',
      'highlight-applications',
    ],
    forbidden: ['projection-workspace-builds', 'inspection-workspace-builds'],
  },
  'I3-collapse': {
    expected: [
      'projections',
      'renderer-mappings',
      'layouts',
      'highlight-applications',
    ],
    forbidden: ['projection-workspace-builds', 'inspection-workspace-builds'],
  },
  'I4-structural-depth': {
    expected: [
      'projections',
      'renderer-mappings',
      'layouts',
      'highlight-applications',
    ],
    forbidden: ['projection-workspace-builds', 'inspection-workspace-builds'],
  },
  'I5-graph-filters': {
    expected: [
      'projections',
      'renderer-mappings',
      'layouts',
      'highlight-applications',
    ],
    forbidden: ['projection-workspace-builds', 'inspection-workspace-builds'],
  },
  'I6-focus-enter': {
    expected: [
      'projections',
      'renderer-mappings',
      'layouts',
      'highlight-applications',
    ],
    forbidden: ['projection-workspace-builds', 'inspection-workspace-builds'],
  },
  'I7-focus-exit': {
    expected: [
      'projections',
      'renderer-mappings',
      'layouts',
      'highlight-applications',
    ],
    forbidden: ['projection-workspace-builds', 'inspection-workspace-builds'],
  },
  'I8-hover': {
    expected: ['highlight-applications'],
    forbidden: NO_DERIVED_REBUILD,
  },
  'I9-select': {
    expected: ['highlight-applications', 'inspections'],
    forbidden: [
      'projection-workspace-builds',
      'inspection-workspace-builds',
      'projections',
      'renderer-mappings',
      'layouts',
    ],
  },
  'I10-canonical-search': {
    expected: ['searches'],
    forbidden: NO_DERIVED_REBUILD,
  },
  'I11-search-backlink-navigation': {
    expected: [
      'projections',
      'renderer-mappings',
      'layouts',
      'highlight-applications',
    ],
    forbidden: ['projection-workspace-builds', 'inspection-workspace-builds'],
  },
  'I12-inspector': { expected: [], forbidden: NO_DERIVED_REBUILD },
  'I13-maximize-restore': { expected: [], forbidden: NO_DERIVED_REBUILD },
  'I14-resize': { expected: [], forbidden: NO_DERIVED_REBUILD },
  'I15-pan-zoom': {
    expected: ['viewport-operations'],
    forbidden: NO_DERIVED_REBUILD,
  },
  'I16-live-markdown': {
    expected: [
      'live-adoptions',
      'projection-workspace-builds',
      'inspection-workspace-builds',
      'projections',
      'renderer-mappings',
      'layouts',
      'highlight-applications',
    ],
    forbidden: [],
  },
  'I17-live-non-markdown': {
    expected: ['live-adoptions'],
    forbidden: NO_DERIVED_REBUILD,
  },
  'I18-full-rescan': {
    expected: [
      'live-adoptions',
      'projection-workspace-builds',
      'inspection-workspace-builds',
      'projections',
      'renderer-mappings',
      'layouts',
      'highlight-applications',
    ],
    forbidden: [],
  },
};
