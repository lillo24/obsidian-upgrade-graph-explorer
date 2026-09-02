export type ProjectionPhase =
  | 'base-projection'
  | 'focus-slice'
  | 'filter-preparation'
  | 'primary-filter'
  | 'candidate-direct-plan'
  | 'candidate-legacy-base'
  | 'candidate-legacy-filter'
  | 'actionable-count-finalization'
  | 'validation';

export type ProjectionOperation =
  | 'baseProjectionBuilds'
  | 'candidateBaseProjectionBuilds'
  | 'filterPreparations'
  | 'primaryFilterApplications'
  | 'legacyCandidateFilterApplications'
  | 'candidateDirectPlans'
  | 'candidateLegacyFallbacks'
  | 'canonicalReferencesScanned'
  | 'entityFilterEvaluations'
  | 'ancestorWalkSteps'
  | 'hierarchyEdgesRebuilt'
  | 'nodeSorts'
  | 'edgeSorts'
  | 'validationRuns';

/**
 * Optional aggregate-only projection evidence. Product callers omit it, so no
 * recorder, query text, paths, entity IDs, or other source data are retained.
 */
export interface ProjectionInstrumentation {
  readonly measure: <Value>(phase: ProjectionPhase, run: () => Value) => Value;
  readonly count: (operation: ProjectionOperation, amount?: number) => void;
}

export function measureProjectionPhase<Value>(
  instrumentation: ProjectionInstrumentation | undefined,
  phase: ProjectionPhase,
  run: () => Value,
): Value {
  return instrumentation === undefined
    ? run()
    : instrumentation.measure(phase, run);
}

export function countProjectionOperation(
  instrumentation: ProjectionInstrumentation | undefined,
  operation: ProjectionOperation,
  amount = 1,
): void {
  instrumentation?.count(operation, amount);
}
