import { describe, expect, it } from 'vitest';
import { createProjectionWorkspace } from '@icarus-graph-explorer/view-projection';

import {
  createFocusSchematicModel,
  validateFocusSchematicModel,
} from './model';
import { summarizeFocusSchematicModel } from './summary';
import { graphFixture } from './test-fixture';

describe('Focus Schematic semantic fixtures F1-F18', () => {
  it('F1 direct chain assigns left, center, and right', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['A', 'Root', 'B'],
      references: [
        { source: 'A', target: 'Root' },
        { source: 'Root', target: 'B' },
      ],
    });
    expect(
      Object.fromEntries(
        model.modules.map(({ id, placement }) => [
          id,
          placement.preferredSignedRank,
        ]),
      ),
    ).toEqual({ A: -1, B: 1, Root: 0 });
  });

  it('F2 incoming fan selects one parent for every leaf', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['A', 'B', 'C', 'Root'],
      references: ['A', 'B', 'C'].map((source) => ({ source, target: 'Root' })),
    });
    expect(
      model.parentCandidates.filter(({ selected }) => selected),
    ).toHaveLength(3);
  });

  it('F3 outgoing fan assigns every leaf right', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', 'A', 'B', 'C'],
      references: ['A', 'B', 'C'].map((target) => ({ source: 'Root', target })),
    });
    expect(
      model.modules
        .filter(({ id }) => id !== 'Root')
        .every(({ placement }) => placement.preferredSide === 'right'),
    ).toBe(true);
  });

  it('F4 mixed two-sided graph preserves authored direction', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['A', 'C', 'Root', 'B', 'D'],
      references: [
        { source: 'A', target: 'Root' },
        { source: 'C', target: 'Root' },
        { source: 'Root', target: 'B' },
        { source: 'Root', target: 'D' },
      ],
    });
    expect(
      model.relationships
        .map(
          ({ sourceModuleId, targetModuleId }) =>
            `${sourceModuleId}->${targetModuleId}`,
        )
        .sort(),
    ).toEqual(['A->Root', 'C->Root', 'Root->B', 'Root->D']);
  });

  it('F5 multi-hop assigns signed ranks through two hops', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['A', 'B', 'Root', 'C', 'D'],
      references: [
        { source: 'A', target: 'B' },
        { source: 'B', target: 'Root' },
        { source: 'Root', target: 'C' },
        { source: 'C', target: 'D' },
      ],
    });
    expect(
      Object.fromEntries(
        model.modules.map((module) => [
          module.id,
          module.placement.preferredSignedRank,
        ]),
      ),
    ).toMatchObject({ A: -2, B: -1, Root: 0, C: 1, D: 2 });
  });

  it('F6 unequal mutual chooses the shorter direction', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', 'A', 'Bridge'],
      references: [
        { source: 'A', target: 'Root' },
        { source: 'Root', target: 'Bridge' },
        { source: 'Bridge', target: 'A' },
      ],
    });
    expect(model.modules.find(({ id }) => id === 'A')?.placement.reason).toBe(
      'shorter-incoming',
    );
  });

  it('F7 equal mutual keeps both sides and no selected parent', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', 'A'],
      references: [
        { source: 'Root', target: 'A' },
        { source: 'A', target: 'Root' },
      ],
    });
    const module = model.modules.find(({ id }) => id === 'A');
    expect(module?.placement).toMatchObject({
      allowedSides: ['left', 'right'],
      preferredSide: null,
      reason: 'equal-mutual',
    });
    expect(
      model.parentCandidates.some(
        ({ moduleId, selected }) => moduleId === 'A' && selected,
      ),
    ).toBe(false);
  });

  it('F8 cycles retain shortest-path roles and secondary links', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', 'A', 'B'],
      references: [
        { source: 'Root', target: 'A' },
        { source: 'Root', target: 'B' },
        { source: 'A', target: 'B' },
        { source: 'B', target: 'A' },
      ],
    });
    expect(
      model.relationships.filter(({ secondary }) => secondary),
    ).toHaveLength(2);
  });

  it('F9 Heading-specific references produce precise endpoint groups', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', 'A'],
      withStructure: true,
      references: [
        {
          source: 'Root',
          sourceEntityId: 'Root-section',
          target: 'A',
          targetEntityId: 'A-section',
        },
      ],
    });
    expect(model.relationships[0]?.visibleEndpointGroups[0]).toMatchObject({
      sourcePrecision: 'section',
      targetPrecision: 'section',
    });
  });

  it('F10 expanded neighbor owns its visible internal hierarchy', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', 'A'],
      withStructure: true,
      references: [{ source: 'Root', target: 'A' }],
    });
    expect(model.modules.find(({ id }) => id === 'A')).toMatchObject({
      visibleEntityNodeIds: expect.arrayContaining([expect.any(String)]),
      hierarchyEdgeIds: expect.arrayContaining([expect.any(String)]),
    });
  });

  it('F11 exact folders include ancestry and the root folder', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', 'one/A', 'one/two/B'],
      references: [
        { source: 'Root', target: 'one/A' },
        { source: 'one/A', target: 'one/two/B' },
      ],
    });
    expect(model.folders.map(({ key }) => key)).toEqual([
      '.',
      'one',
      'one/two',
    ]);
  });

  it('F12 duplicate basenames remain distinct by canonical module ID', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', 'one/Note', 'two/Note'],
      references: [
        { source: 'Root', target: 'one/Note' },
        { source: 'Root', target: 'two/Note' },
      ],
    });
    expect(new Set(model.modules.map(({ id }) => id)).size).toBe(3);
  });

  it('F13 diagnostics preserve statuses and external candidates', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', 'External', 'External2'],
      references: [
        { source: 'Root', status: 'unresolved' },
        { source: 'Root', status: 'invalid' },
        {
          source: 'Root',
          status: 'ambiguous',
          candidates: ['External', 'External2'],
        },
      ],
    });
    expect(model.diagnostics.map(({ status }) => status).sort()).toEqual([
      'ambiguous',
      'invalid',
      'unresolved',
    ]);
    expect(
      model.diagnostics.find(({ status }) => status === 'ambiguous')
        ?.candidateDocumentEntityIds,
    ).toEqual(['External', 'External2']);
  });

  it('F14 filtered path intermediate remains a semantic module', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', 'Hidden', 'Visible'],
      references: [
        { source: 'Root', target: 'Hidden' },
        { source: 'Hidden', target: 'Visible' },
      ],
      direction: 'outgoing',
      filters: { text: 'Visible' },
    });
    expect(model.modules.find(({ id }) => id === 'Hidden')?.presentation).toBe(
      'filtered',
    );
    expect(
      model.issues.some(({ code }) => code === 'filtered-path-intermediate'),
    ).toBe(true);
  });

  it('F15 path/status filters use KG6 neighborhood membership', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', 'A'],
      references: [
        { source: 'Root', target: 'A' },
        { source: 'Root', status: 'unresolved' },
      ],
      filters: { referenceStatuses: ['unresolved'] },
    });
    expect(model.modules.map(({ id }) => id)).toEqual(['Root']);
  });

  it('F16 hub remains complete under a bounded fan', () => {
    const leaves = Array.from({ length: 250 }, (_, index) => `Leaf-${index}`);
    const { model } = graphFixture({
      root: 'Root',
      documents: ['Root', ...leaves],
      references: leaves.map((target) => ({ source: 'Root', target })),
      hops: 1,
    });
    expect(summarizeFocusSchematicModel(model)).toMatchObject({
      moduleCount: 251,
      crossModuleRelationshipCount: 250,
      selectedBackboneCount: 250,
    });
  });

  it('F17 input permutation produces byte-identical JSON', () => {
    const fixture = graphFixture({
      root: 'Root',
      documents: ['Root', 'A', 'B'],
      references: [
        { source: 'Root', target: 'A' },
        { source: 'A', target: 'B' },
      ],
    });
    const snapshot = fixture.workspace.snapshot();
    const workspace = createProjectionWorkspace({
      ...snapshot,
      entities: [...snapshot.entities].reverse(),
      references: [...snapshot.references].reverse(),
    });
    const projection = {
      ...fixture.projection,
      nodes: [...fixture.projection.nodes].reverse(),
      edges: [...fixture.projection.edges].reverse(),
    };
    const permuted = createFocusSchematicModel({
      workspace,
      state: fixture.state,
      projection,
    });
    expect(JSON.stringify(permuted)).toBe(JSON.stringify(fixture.model));
  });

  it('F18 stable document IDs retain module identity across Heading edits', () => {
    const before = graphFixture({
      root: 'Root',
      documents: ['Root', 'A'],
      withStructure: true,
      references: [{ source: 'Root', target: 'A' }],
    });
    const after = graphFixture({
      root: 'Root',
      documents: ['Root', 'A'],
      references: [{ source: 'Root', target: 'A' }],
    });
    expect(after.model.modules.map(({ id }) => id)).toEqual(
      before.model.modules.map(({ id }) => id),
    );
  });
});

describe('Focus Schematic validation', () => {
  it('requires Focus and rejects prepared-neighborhood contradictions', () => {
    const fixture = graphFixture({
      root: 'Root',
      documents: ['Root'],
      references: [],
    });
    expect(() =>
      createFocusSchematicModel({
        ...fixture,
        state: { disclosure: fixture.state.disclosure },
      }),
    ).toThrow(/without KG6 Focus/);
    expect(() =>
      createFocusSchematicModel({
        ...fixture,
        neighborhood: {
          rootDocumentEntityId: 'wrong',
          focus: { direction: 'both', hops: 3 },
          documentProjection: fixture.projection,
          documentDistances: [],
          allowedDiagnosticReferenceIds: [],
          issues: [],
        },
      }),
    ).toThrow(/contradicts/);
  });

  it('accepts JSON round-trip and rejects extra, missing, and changed fields', () => {
    const fixture = graphFixture({
      root: 'Root',
      documents: ['Root', 'A'],
      references: [{ source: 'Root', target: 'A' }],
    });
    const roundTrip: unknown = JSON.parse(JSON.stringify(fixture.model));
    expect(
      validateFocusSchematicModel(
        fixture.workspace,
        fixture.state,
        fixture.projection,
        roundTrip,
      ).valid,
    ).toBe(true);
    expect(
      validateFocusSchematicModel(
        fixture.workspace,
        fixture.state,
        fixture.projection,
        { ...fixture.model, extra: true },
      ).valid,
    ).toBe(false);
    expect(
      validateFocusSchematicModel(
        fixture.workspace,
        fixture.state,
        fixture.projection,
        { ...fixture.model, modules: [] },
      ).valid,
    ).toBe(false);
    expect(
      validateFocusSchematicModel(
        fixture.workspace,
        fixture.state,
        fixture.projection,
        { ...fixture.model, schemaVersion: 2 },
      ).valid,
    ).toBe(false);
  });
});
