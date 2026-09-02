import { describe, expect, it } from 'vitest';

import { buildBaseProjection } from './base-projection';
import { retainDirectCandidateEntities } from './candidate-eligibility';
import { prepareViewProjectionFilters } from './filter-plan';
import type {
  ProjectionInstrumentation,
  ProjectionOperation,
  ProjectionPhase,
} from './instrumentation';
import {
  documentOnlyProjectionState,
  structuralDepthProjectionState,
} from './presets';
import { projectView } from './project';
import { applyFilters } from './slicing';
import { projectionFixture } from './test-fixture';
import type {
  StructuralDisclosureState,
  ViewProjectionFilters,
  ViewProjectionState,
} from './types';
import { createProjectionWorkspace } from './workspace';

const workspace = createProjectionWorkspace(projectionFixture());

function expandedCandidateState(
  state: StructuralDisclosureState,
  ownerIds: Iterable<string>,
): StructuralDisclosureState {
  const owners = new Set(ownerIds);
  return {
    ...state,
    expandedEntityIds: [
      ...new Set([...state.expandedEntityIds, ...owners]),
    ].sort(),
    collapsedEntityIds: state.collapsedEntityIds.filter(
      (entityId) => !owners.has(entityId),
    ),
  };
}

function legacyCandidateRetention(
  disclosure: StructuralDisclosureState,
  filters: ViewProjectionFilters,
): ReadonlySet<string> {
  const initial = buildBaseProjection(workspace, disclosure);
  const expanded = expandedCandidateState(
    disclosure,
    initial.disclosure.revealableDescendantIdsByEntityId.keys(),
  );
  const candidate = buildBaseProjection(workspace, expanded).projection;
  const filtered = applyFilters(
    workspace,
    candidate,
    prepareViewProjectionFilters(filters),
  );
  return new Set(
    filtered.nodes.flatMap((node) =>
      node.kind === 'entity' ? [node.entityId] : [],
    ),
  );
}

function directCandidateRetention(
  disclosure: StructuralDisclosureState,
  filters: ViewProjectionFilters,
): ReadonlySet<string> {
  const initial = buildBaseProjection(workspace, disclosure);
  return retainDirectCandidateEntities(
    workspace,
    initial.disclosure,
    prepareViewProjectionFilters(filters),
  );
}

function sorted(values: ReadonlySet<string>): readonly string[] {
  return [...values].sort();
}

describe('DISC1 canonical candidate fast path', () => {
  const disclosures: readonly StructuralDisclosureState[] = [
    documentOnlyProjectionState().disclosure,
    structuralDepthProjectionState(1).disclosure,
    structuralDepthProjectionState(2).disclosure,
    {
      ...documentOnlyProjectionState().disclosure,
      includeBlocks: true,
      expandedEntityIds: ['doc-a', 'a-overview', 'a-detail'],
    },
    {
      ...structuralDepthProjectionState(3).disclosure,
      maxSectionLevel: 2,
      collapsedEntityIds: ['b-target'],
    },
  ];
  const canonicalFilters: readonly ViewProjectionFilters[] = [
    { pathPrefixes: ['A.md'] },
    { pathPrefixes: ['folder'] },
    { pathPrefixes: ['../invalid'] },
    { entityKinds: ['document'] },
    { entityKinds: ['section'] },
    { entityKinds: ['block'] },
    { query: '(path:"folder" AND sections AND level<=2) OR title:"deep"' },
    { query: 'NOT text:"archive" AND (documents OR sections)' },
    { query: 'sections documents' },
    {
      pathPrefixes: ['A.md', 'folder'],
      entityKinds: ['section'],
      query: 'level>=2 AND NOT title:"leaf"',
    },
    {
      query: 'documents OR title:"overview"',
      referenceStatuses: ['unresolved'],
    },
    { query: 'documents OR sections', text: '   ' },
  ];

  for (const [disclosureIndex, disclosure] of disclosures.entries()) {
    for (const [filterIndex, filters] of canonicalFilters.entries()) {
      it(`matches the legacy oracle for disclosure ${disclosureIndex + 1}, filters ${filterIndex + 1}`, () => {
        expect(sorted(directCandidateRetention(disclosure, filters))).toEqual(
          sorted(legacyCandidateRetention(disclosure, filters)),
        );
      });
    }
  }

  it('keeps projected text on the legacy fallback', () => {
    const operations = operationRecorder();
    projectView(
      workspace,
      { ...documentOnlyProjectionState(), filters: { text: 'overview' } },
      operations.instrumentation,
    );

    expect(operations.counts.candidateDirectPlans).toBe(0);
    expect(operations.counts.candidateLegacyFallbacks).toBe(1);
    expect(operations.counts.candidateBaseProjectionBuilds).toBe(1);
    expect(operations.counts.legacyCandidateFilterApplications).toBe(1);
  });
});

function operationRecorder(): {
  readonly counts: Record<ProjectionOperation, number>;
  readonly phases: ProjectionPhase[];
  readonly instrumentation: ProjectionInstrumentation;
} {
  const counts = new Proxy({} as Record<ProjectionOperation, number>, {
    get(target, property: ProjectionOperation) {
      return target[property] ?? 0;
    },
  });
  const phases: ProjectionPhase[] = [];
  return {
    counts,
    phases,
    instrumentation: {
      measure<Value>(phase: ProjectionPhase, run: () => Value): Value {
        phases.push(phase);
        return run();
      },
      count(operation, amount = 1) {
        counts[operation] = counts[operation] + amount;
      },
    },
  };
}

describe('projection operation evidence', () => {
  it('uses one base build and no sort/rebuild pass for canonical query candidates', () => {
    const recorded = operationRecorder();
    projectView(
      workspace,
      {
        ...documentOnlyProjectionState(),
        filters: { query: 'documents OR title:"overview"' },
      },
      recorded.instrumentation,
    );

    expect(recorded.counts.baseProjectionBuilds).toBe(1);
    expect(recorded.counts.candidateBaseProjectionBuilds).toBe(0);
    expect(recorded.counts.filterPreparations).toBe(1);
    expect(recorded.counts.primaryFilterApplications).toBe(1);
    expect(recorded.counts.candidateDirectPlans).toBe(1);
    expect(recorded.counts.candidateLegacyFallbacks).toBe(0);
    expect(recorded.counts.canonicalReferencesScanned).toBe(11);
    expect(recorded.counts.hierarchyEdgesRebuilt).toBe(0);
    expect(recorded.counts.nodeSorts).toBe(0);
    expect(recorded.counts.edgeSorts).toBe(0);
    expect(recorded.counts.validationRuns).toBe(1);
    expect(recorded.phases).toContain('candidate-direct-plan');
  });

  it('fails an invalid query closed without evaluating canonical entities', () => {
    const recorded = operationRecorder();
    const projection = projectView(
      workspace,
      {
        ...documentOnlyProjectionState(),
        filters: { query: 'sections documents' },
      },
      recorded.instrumentation,
    );

    expect(projection.nodes).toEqual([]);
    expect(recorded.counts.entityFilterEvaluations).toBe(0);
    expect(recorded.counts.candidateDirectPlans).toBe(1);
    expect(recorded.counts.candidateBaseProjectionBuilds).toBe(0);
  });

  it('preserves exact no-op projection identity', () => {
    const state: ViewProjectionState = documentOnlyProjectionState();
    const base = buildBaseProjection(workspace, state.disclosure).projection;

    expect(
      applyFilters(workspace, base, prepareViewProjectionFilters(undefined)),
    ).toBe(base);
    expect(
      applyFilters(
        workspace,
        base,
        prepareViewProjectionFilters({
          referenceStatuses: ['resolved', 'unresolved', 'ambiguous', 'invalid'],
        }),
      ),
    ).toBe(base);
  });

  it('reuses unchanged nodes and edges during the stable filter scan', () => {
    const base = buildBaseProjection(
      workspace,
      documentOnlyProjectionState().disclosure,
    ).projection;
    const filtered = applyFilters(
      workspace,
      base,
      prepareViewProjectionFilters({ entityKinds: ['document'] }),
    );

    expect(filtered.nodes).toHaveLength(base.nodes.length);
    expect(filtered.edges).toHaveLength(base.edges.length);
    expect(
      filtered.nodes.every((node, index) => node === base.nodes[index]),
    ).toBe(true);
    expect(
      filtered.edges.every((edge, index) => edge === base.edges[index]),
    ).toBe(true);
  });
});

describe('pre-PERFQ1A projection byte oracle', () => {
  function projectionHash(value: string): string {
    let hash = 0xcbf29ce484222325n;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= BigInt(value.charCodeAt(index));
      hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return hash.toString(16).padStart(16, '0');
  }

  const documents = documentOnlyProjectionState();
  const cases = [
    ['no-filter', documents, '87c94f47a8296ea7'],
    [
      'status',
      {
        ...documents,
        filters: { referenceStatuses: ['unresolved', 'ambiguous'] },
      },
      '34bdd1d04b6e8a55',
    ],
    [
      'path',
      { ...documents, filters: { pathPrefixes: ['A.md'] } },
      '30ac1eb4509ddf05',
    ],
    [
      'kind',
      { ...documents, filters: { entityKinds: ['section'] } },
      'b577ab59fc8d6394',
    ],
    [
      'query',
      {
        ...documents,
        filters: { query: 'path:"A.md" AND (documents OR title:"overview")' },
      },
      '30ac1eb4509ddf05',
    ],
    [
      'text',
      { ...documents, filters: { text: 'Missing' } },
      'ce8410dcbcc2086d',
    ],
    [
      'combined',
      {
        ...structuralDepthProjectionState(3),
        filters: {
          pathPrefixes: ['A.md', 'folder'],
          entityKinds: ['section'],
          referenceStatuses: ['resolved', 'unresolved'],
          query: 'NOT title:"leaf"',
        },
      },
      '0655825ff1e15e33',
    ],
    [
      'invalid-path',
      { ...documents, filters: { pathPrefixes: ['../outside'] } },
      'b02340182b10fd03',
    ],
    [
      'invalid-query',
      { ...documents, filters: { query: 'sections documents' } },
      '39e685f6fc34e650',
    ],
    [
      'focus-query',
      {
        ...structuralDepthProjectionState(3),
        focus: {
          rootEntityId: 'doc-a',
          hops: 2,
          direction: 'both',
          hierarchyContext: 'ancestors-and-children',
        },
        filters: { query: 'NOT text:"archive"' },
      },
      'b614f64957e0cc1b',
    ],
    [
      'disclosure',
      {
        disclosure: {
          ...structuralDepthProjectionState(3).disclosure,
          maxSectionLevel: 2,
          includeBlocks: true,
          expandedEntityIds: ['doc-a', 'a-overview', 'a-detail'],
          collapsedEntityIds: ['b-target'],
        },
        filters: { query: 'documents OR sections' },
      },
      'ee33254d215cf72f',
    ],
  ] as const satisfies readonly (readonly [
    string,
    ViewProjectionState,
    string,
  ])[];

  for (const [id, state, expected] of cases) {
    it(`preserves the exact current-main bytes for ${id}`, () => {
      const serialized = JSON.stringify(projectView(workspace, state));
      expect(projectionHash(serialized)).toBe(expected);
    });
  }
});
