import { describe, expect, it } from 'vitest';

import { emptyPerformanceOperationCounts } from './types';
import { validatePerformanceResult } from './validation';

function result(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    generatedAt: '2026-08-29T00:00:00.000Z',
    environment: {
      surface: 'node',
      gitCommit: 'abc123',
      runtime: 'Node 24',
      os: 'Windows 11',
      architecture: 'x64',
      cpu: 'Synthetic CPU',
    },
    scenarios: [
      {
        id: 'documents-only',
        label: 'Documents only',
        performanceClass: 'B',
        profile: 'small',
        canonical: {
          documents: 1,
          sections: 2,
          blocks: 2,
          entities: 5,
          references: 1,
        },
        projected: {
          nodes: 1,
          edges: 0,
          referenceEdges: 0,
          diagnosticNodes: 0,
        },
        phases: {
          'project-view': {
            warmupCount: 1,
            sampleCount: 2,
            medianMs: 1.5,
            p95Ms: 2,
            maximumMs: 2,
            valuesMs: [1, 2],
          },
        },
        operations: emptyPerformanceOperationCounts(),
        layoutMode: 'structure',
        buildMode: 'production',
      },
    ],
    budgets: [
      {
        performanceClass: 'A',
        boundary: 'feedback',
        medianMs: 16,
        p95Ms: 32,
        rationale: 'direct',
        enforcement: 'investigative',
      },
      {
        performanceClass: 'B',
        boundary: 'view',
        medianMs: 100,
        p95Ms: 200,
        rationale: 'derived',
        enforcement: 'investigative',
      },
      {
        performanceClass: 'C',
        boundary: 'workspace',
        medianMs: 1000,
        p95Ms: 2000,
        rationale: 'explicit',
        enforcement: 'investigative',
      },
    ],
    decisions: {
      workers: [
        {
          workload: 'W1-workspace-engine-diagnostics',
          decision: 'worker-in-KG12B',
          evidence: 'Measured whole-workspace cost.',
        },
        {
          workload: 'W2-projection',
          decision: 'main-thread',
          evidence: 'Bounded projection cost.',
        },
        {
          workload: 'W3-dagre-layout',
          decision: 'worker-in-KG12B',
          evidence: 'Measured layout cliff.',
        },
        {
          workload: 'W4-inspection',
          decision: 'main-thread',
          evidence: 'Bounded inspection cost.',
        },
      ],
      caching: [
        {
          candidate: 'existing memoization',
          decision: 'retain',
          evidence: 'Avoids unrelated recomputation.',
        },
      ],
      rendererScaleCliff: 'Measured separately.',
      kg12bScope: 'Pending evidence.',
    },
    note: 'Investigative; not a CI wall-clock gate.',
  };
}

describe('performance result validation', () => {
  it('accepts the versioned aggregate schema', () => {
    expect(validatePerformanceResult(result()).valid).toBe(true);
  });

  it('rejects private identifiers and source-shaped extensions', () => {
    const value = result();
    (value.environment as Record<string, unknown>).hostname = 'private-host';
    expect(validatePerformanceResult(value)).toMatchObject({
      valid: false,
      issues: [expect.stringContaining('private identifiers')],
    });
  });

  it('rejects private paths hidden inside otherwise allowed text fields', () => {
    const value = result();
    value.note =
      'Local evidence came from C:\\Users\\private-user\\vault\\note.md.';
    expect(validatePerformanceResult(value)).toMatchObject({
      valid: false,
      issues: [expect.stringContaining('private filesystem paths')],
    });
  });

  it('rejects summaries that do not match their raw aggregate samples', () => {
    const value = result();
    const scenario = (value.scenarios as Record<string, unknown>[])[0];
    const phases = scenario?.phases as Record<string, Record<string, unknown>>;
    if (phases?.['project-view'] === undefined)
      throw new Error('Validation fixture is missing its measured phase.');
    phases['project-view'].medianMs = 99;

    expect(validatePerformanceResult(value)).toMatchObject({
      valid: false,
      issues: [expect.stringContaining('does not match valuesMs')],
    });
  });
});
