import {
  PERFORMANCE_CLASSES,
  PERFORMANCE_OPERATIONS,
  PERFORMANCE_PHASES,
  PERFORMANCE_RESULT_SCHEMA_VERSION,
  PERFORMANCE_WORKLOAD_PROFILES,
  type PerformanceResult,
} from './types';
import { summarizePerformanceDurations } from './statistics';

export interface PerformanceValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly value?: PerformanceResult;
}

const PRIVATE_FIELD_PATTERN =
  /(?:path|source|content|workspace(?:id|name)?|hostname|username|query|correlation)/i;
const PRIVATE_PATH_VALUE_PATTERN =
  /(?:[a-z]:[\\/]|\\\\[^\\/\s]+[\\/]|file:\/\/|\/(?:users|home)\/[^/\s]+)/i;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function checkAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  at: string,
  issues: string[],
): void {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    if (PRIVATE_FIELD_PATTERN.test(key)) {
      issues.push(
        `${at}.${key}: private identifiers or source material are forbidden.`,
      );
    } else {
      issues.push(`${at}.${key}: unknown field.`);
    }
  }
}

function checkPrivatePathValues(
  value: unknown,
  at: string,
  issues: string[],
): void {
  if (typeof value === 'string') {
    if (PRIVATE_PATH_VALUE_PATTERN.test(value))
      issues.push(`${at}: private filesystem paths are forbidden.`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      checkPrivatePathValues(item, `${at}[${index}]`, issues),
    );
    return;
  }
  if (!record(value)) return;
  for (const [key, item] of Object.entries(value))
    checkPrivatePathValues(item, `${at}.${key}`, issues);
}

function validateCounts(
  value: unknown,
  keys: readonly string[],
  at: string,
  issues: string[],
): void {
  if (!record(value)) {
    issues.push(`${at}: expected an object.`);
    return;
  }
  checkAllowedKeys(value, keys, at, issues);
  for (const key of keys) {
    if (!Number.isSafeInteger(value[key]) || (value[key] as number) < 0) {
      issues.push(`${at}.${key}: expected a non-negative integer.`);
    }
  }
}

function validateSample(value: unknown, at: string, issues: string[]): void {
  if (!record(value)) {
    issues.push(`${at}: expected a sample summary object.`);
    return;
  }
  const keys = [
    'warmupCount',
    'sampleCount',
    'medianMs',
    'p95Ms',
    'maximumMs',
    'valuesMs',
  ];
  checkAllowedKeys(value, keys, at, issues);
  if (
    !Number.isSafeInteger(value.warmupCount) ||
    (value.warmupCount as number) < 0
  )
    issues.push(`${at}.warmupCount: expected a non-negative integer.`);
  if (
    !Number.isSafeInteger(value.sampleCount) ||
    (value.sampleCount as number) < 1
  )
    issues.push(`${at}.sampleCount: expected a positive integer.`);
  for (const key of ['medianMs', 'p95Ms', 'maximumMs']) {
    if (!finiteNonNegative(value[key]))
      issues.push(`${at}.${key}: expected a finite non-negative duration.`);
  }
  if (
    !Array.isArray(value.valuesMs) ||
    value.valuesMs.some((item) => !finiteNonNegative(item))
  ) {
    issues.push(`${at}.valuesMs: expected finite non-negative durations.`);
  } else if (value.valuesMs.length !== value.sampleCount) {
    issues.push(`${at}.valuesMs: length must equal sampleCount.`);
  } else if (
    Number.isSafeInteger(value.warmupCount) &&
    (value.warmupCount as number) >= 0 &&
    value.valuesMs.length > 0
  ) {
    const expected = summarizePerformanceDurations(
      value.valuesMs as number[],
      value.warmupCount as number,
    );
    for (const key of ['medianMs', 'p95Ms', 'maximumMs'] as const) {
      if (value[key] !== expected[key])
        issues.push(`${at}.${key}: does not match valuesMs.`);
    }
  }
}

export function validatePerformanceResult(
  value: unknown,
): PerformanceValidationResult {
  const issues: string[] = [];
  if (!record(value))
    return { valid: false, issues: ['$: expected an object.'] };
  checkPrivatePathValues(value, '$', issues);
  checkAllowedKeys(
    value,
    [
      'schemaVersion',
      'generatedAt',
      'environment',
      'scenarios',
      'budgets',
      'decisions',
      'note',
    ],
    '$',
    issues,
  );
  if (value.schemaVersion !== PERFORMANCE_RESULT_SCHEMA_VERSION)
    issues.push('$.schemaVersion: expected 1.');
  if (
    typeof value.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.generatedAt))
  )
    issues.push('$.generatedAt: expected an ISO timestamp.');
  if (!record(value.environment))
    issues.push('$.environment: expected an object.');
  else {
    const keys = [
      'surface',
      'gitCommit',
      'runtime',
      'os',
      'architecture',
      'cpu',
      'browser',
      'webview',
      'tauri',
    ];
    checkAllowedKeys(value.environment, keys, '$.environment', issues);
    for (const key of [
      'surface',
      'gitCommit',
      'runtime',
      'os',
      'architecture',
      'cpu',
    ]) {
      if (
        typeof value.environment[key] !== 'string' ||
        value.environment[key] === ''
      )
        issues.push(`$.environment.${key}: expected a non-empty string.`);
    }
    if (
      !['node', 'browser', 'tauri'].includes(String(value.environment.surface))
    )
      issues.push('$.environment.surface: unsupported surface.');
  }
  if (!Array.isArray(value.scenarios) || value.scenarios.length === 0) {
    issues.push('$.scenarios: expected at least one scenario.');
  } else {
    value.scenarios.forEach((scenario, index) => {
      const at = `$.scenarios[${index}]`;
      if (!record(scenario)) {
        issues.push(`${at}: expected an object.`);
        return;
      }
      checkAllowedKeys(
        scenario,
        [
          'id',
          'label',
          'performanceClass',
          'profile',
          'canonical',
          'projected',
          'phases',
          'operations',
          'layoutMode',
          'buildMode',
          'omittedPhases',
        ],
        at,
        issues,
      );
      if (typeof scenario.id !== 'string' || scenario.id === '')
        issues.push(`${at}.id: expected a non-empty string.`);
      if (typeof scenario.label !== 'string' || scenario.label === '')
        issues.push(`${at}.label: expected a non-empty string.`);
      if (
        !(PERFORMANCE_CLASSES as readonly unknown[]).includes(
          scenario.performanceClass,
        )
      )
        issues.push(`${at}.performanceClass: unsupported class.`);
      if (
        !(PERFORMANCE_WORKLOAD_PROFILES as readonly unknown[]).includes(
          scenario.profile,
        )
      )
        issues.push(`${at}.profile: unsupported profile.`);
      validateCounts(
        scenario.canonical,
        ['documents', 'sections', 'blocks', 'entities', 'references'],
        `${at}.canonical`,
        issues,
      );
      if (
        record(scenario.canonical) &&
        finiteNonNegative(scenario.canonical.documents) &&
        finiteNonNegative(scenario.canonical.sections) &&
        finiteNonNegative(scenario.canonical.blocks) &&
        scenario.canonical.entities !==
          scenario.canonical.documents +
            scenario.canonical.sections +
            scenario.canonical.blocks
      )
        issues.push(
          `${at}.canonical.entities: must equal document + section + block counts.`,
        );
      if (scenario.projected !== undefined)
        validateCounts(
          scenario.projected,
          ['nodes', 'edges', 'referenceEdges', 'diagnosticNodes'],
          `${at}.projected`,
          issues,
        );
      if (!record(scenario.phases))
        issues.push(`${at}.phases: expected an object.`);
      else {
        checkAllowedKeys(
          scenario.phases,
          PERFORMANCE_PHASES,
          `${at}.phases`,
          issues,
        );
        for (const [phase, sample] of Object.entries(scenario.phases))
          validateSample(sample, `${at}.phases.${phase}`, issues);
      }
      validateCounts(
        scenario.operations,
        PERFORMANCE_OPERATIONS,
        `${at}.operations`,
        issues,
      );
      if (
        scenario.layoutMode !== undefined &&
        !['structure', 'focus', 'none'].includes(String(scenario.layoutMode))
      )
        issues.push(`${at}.layoutMode: unsupported layout mode.`);
      if (
        scenario.buildMode !== undefined &&
        !['development', 'production'].includes(String(scenario.buildMode))
      )
        issues.push(`${at}.buildMode: unsupported build mode.`);
      if (scenario.omittedPhases !== undefined) {
        if (!Array.isArray(scenario.omittedPhases)) {
          issues.push(`${at}.omittedPhases: expected an array.`);
        } else {
          scenario.omittedPhases.forEach((omission, omissionIndex) => {
            const omissionAt = `${at}.omittedPhases[${omissionIndex}]`;
            if (!record(omission)) {
              issues.push(`${omissionAt}: expected an object.`);
              return;
            }
            checkAllowedKeys(omission, ['phase', 'reason'], omissionAt, issues);
            if (
              !(PERFORMANCE_PHASES as readonly unknown[]).includes(
                omission.phase,
              )
            ) {
              issues.push(`${omissionAt}.phase: unsupported phase.`);
            }
            if (typeof omission.reason !== 'string' || omission.reason === '') {
              issues.push(`${omissionAt}.reason: expected a non-empty string.`);
            }
          });
        }
      }
    });
  }
  if (!Array.isArray(value.budgets) || value.budgets.length !== 3) {
    issues.push(
      '$.budgets: expected exactly one budget for each performance class.',
    );
  } else {
    const seenClasses = new Set<unknown>();
    value.budgets.forEach((budget, index) => {
      const at = `$.budgets[${index}]`;
      if (!record(budget)) {
        issues.push(`${at}: expected an object.`);
        return;
      }
      checkAllowedKeys(
        budget,
        [
          'performanceClass',
          'boundary',
          'medianMs',
          'p95Ms',
          'rationale',
          'enforcement',
        ],
        at,
        issues,
      );
      if (
        !(PERFORMANCE_CLASSES as readonly unknown[]).includes(
          budget.performanceClass,
        )
      )
        issues.push(`${at}.performanceClass: unsupported class.`);
      else if (seenClasses.has(budget.performanceClass))
        issues.push(`${at}.performanceClass: duplicate class.`);
      else seenClasses.add(budget.performanceClass);
      for (const key of ['boundary', 'rationale'] as const) {
        if (typeof budget[key] !== 'string' || budget[key] === '')
          issues.push(`${at}.${key}: expected a non-empty string.`);
      }
      for (const key of ['medianMs', 'p95Ms'] as const) {
        if (!finiteNonNegative(budget[key]))
          issues.push(`${at}.${key}: expected a finite non-negative duration.`);
      }
      if (budget.enforcement !== 'investigative')
        issues.push(`${at}.enforcement: expected investigative.`);
    });
  }
  if (!record(value.decisions)) {
    issues.push('$.decisions: expected an object.');
  } else {
    checkAllowedKeys(
      value.decisions,
      ['workers', 'caching', 'rendererScaleCliff', 'kg12bScope'],
      '$.decisions',
      issues,
    );
    if (
      !Array.isArray(value.decisions.workers) ||
      value.decisions.workers.length !== 4
    ) {
      issues.push('$.decisions.workers: expected W1 through W4 exactly once.');
    } else {
      const seenWorkloads = new Set<unknown>();
      value.decisions.workers.forEach((decision, index) => {
        const at = `$.decisions.workers[${index}]`;
        if (!record(decision)) {
          issues.push(`${at}: expected an object.`);
          return;
        }
        checkAllowedKeys(
          decision,
          ['workload', 'decision', 'evidence'],
          at,
          issues,
        );
        if (
          ![
            'W1-workspace-engine-diagnostics',
            'W2-projection',
            'W3-dagre-layout',
            'W4-inspection',
          ].includes(String(decision.workload))
        )
          issues.push(`${at}.workload: unsupported workload.`);
        else if (seenWorkloads.has(decision.workload))
          issues.push(`${at}.workload: duplicate workload.`);
        else seenWorkloads.add(decision.workload);
        if (
          !['main-thread', 'worker-in-KG12B', 'defer'].includes(
            String(decision.decision),
          )
        )
          issues.push(`${at}.decision: unsupported decision.`);
        if (typeof decision.evidence !== 'string' || decision.evidence === '')
          issues.push(`${at}.evidence: expected a non-empty string.`);
      });
    }
    if (
      !Array.isArray(value.decisions.caching) ||
      value.decisions.caching.length === 0
    ) {
      issues.push('$.decisions.caching: expected at least one decision.');
    } else {
      value.decisions.caching.forEach((decision, index) => {
        const at = `$.decisions.caching[${index}]`;
        if (!record(decision)) {
          issues.push(`${at}: expected an object.`);
          return;
        }
        checkAllowedKeys(
          decision,
          ['candidate', 'decision', 'evidence'],
          at,
          issues,
        );
        if (typeof decision.candidate !== 'string' || decision.candidate === '')
          issues.push(`${at}.candidate: expected a non-empty string.`);
        if (
          !['retain', 'add-in-KG12B', 'do-not-add'].includes(
            String(decision.decision),
          )
        )
          issues.push(`${at}.decision: unsupported decision.`);
        if (typeof decision.evidence !== 'string' || decision.evidence === '')
          issues.push(`${at}.evidence: expected a non-empty string.`);
      });
    }
    for (const key of ['rendererScaleCliff', 'kg12bScope'] as const) {
      if (
        typeof value.decisions[key] !== 'string' ||
        value.decisions[key] === ''
      )
        issues.push(`$.decisions.${key}: expected a non-empty string.`);
    }
  }
  if (typeof value.note !== 'string' || value.note === '')
    issues.push('$.note: expected a non-empty string.');
  return issues.length === 0
    ? { valid: true, issues, value: value as unknown as PerformanceResult }
    : { valid: false, issues };
}
