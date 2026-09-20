import { describe, expect, it } from 'vitest';

import {
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  SOFT_CLUSTER_FIXTURES,
  buildEndpointFixture,
  computeFocusSchematicSoftClusterLayoutAttempt,
} from '@icarus-graph-explorer/focus-schematic-layout';
import { focusSchematicNodeDimensions } from '@icarus-graph-explorer/renderer-reactflow/focus-schematic';

import {
  deriveFocusSchematicCurrentGenerationValue,
  prepareFocusSchematicDisplayedGraph,
  retainFocusSchematicGraphDuringLayoutTransition,
  resolveFocusSchematicReplacementFailure,
  resolveFocusSchematicPresentation,
} from './focus-schematic-presentation';

describe('Modular Focus Schematic presentation', () => {
  it('sends different 0/50/100 Soft positions to GraphCanvas from one structural compute', () => {
    const fixture = buildEndpointFixture(
      SOFT_CLUSTER_FIXTURES.find(({ id }) => id === 'SC20')!,
    );
    const layoutInput = {
      model: fixture.model,
      projection: fixture.projection,
      nodeDimensions: focusSchematicNodeDimensions(
        fixture.projection,
        fixture.model,
      ),
      settings: {
        ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
        directionalFolderBandsEnabled: false,
      },
    };
    let structuralComputeCount = 0;
    structuralComputeCount += 1;
    const attempt = computeFocusSchematicSoftClusterLayoutAttempt(layoutInput);
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    const base = {
      projection: fixture.projection,
      model: fixture.model,
      layoutInput,
      computedLayout: attempt.result,
      rootEntityId: fixture.model.rootModuleId,
      secondaryRelationshipsVisible: false,
      macroLayout: 'soft-folder-clusters' as const,
      includeWorkspaceRootGroup: false,
    };
    const graphs = [0, 50, 100].map((softSpacing) =>
      prepareFocusSchematicDisplayedGraph({ ...base, softSpacing }),
    );
    const modulePositions = graphs.map((graph) =>
      graph.nodes
        .filter(({ type }) => type === 'module')
        .map(({ id, position }) => ({ id, position })),
    );
    expect(modulePositions[1]).not.toEqual(modulePositions[0]);
    expect(modulePositions[2]).not.toEqual(modulePositions[1]);
    expect(structuralComputeCount).toBe(1);
    for (const graph of graphs)
      expect(
        graph.edges.every(
          ({ sourceHandle, targetHandle }) =>
            sourceHandle !== undefined && targetHandle !== undefined,
        ),
      ).toBe(true);
  });

  it('exposes a presentation error and retains the validated adopted graph', () => {
    const fixture = buildEndpointFixture(
      SOFT_CLUSTER_FIXTURES.find(({ id }) => id === 'SC20')!,
    );
    const layoutInput = {
      model: fixture.model,
      projection: fixture.projection,
      nodeDimensions: focusSchematicNodeDimensions(
        fixture.projection,
        fixture.model,
      ),
      settings: {
        ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
        directionalFolderBandsEnabled: false,
      },
    };
    const attempt = computeFocusSchematicSoftClusterLayoutAttempt(layoutInput);
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    const validInput = {
      projection: fixture.projection,
      model: fixture.model,
      layoutInput,
      computedLayout: attempt.result,
      rootEntityId: fixture.model.rootModuleId,
      secondaryRelationshipsVisible: false,
      macroLayout: 'soft-folder-clusters' as const,
      softSpacing: 0,
      includeWorkspaceRootGroup: false,
    };
    const adopted = prepareFocusSchematicDisplayedGraph(validInput);
    const result = resolveFocusSchematicPresentation(
      {
        ...validInput,
        computedLayout: {
          ...attempt.result,
          candidate: { ...attempt.result.candidate, modules: [] },
        },
        softSpacing: 50,
      },
      adopted,
    );
    expect(result.graph).toBe(adopted);
    expect(result.warning).toMatch(
      /^Modular presentation failed: .+ The last valid modular graph remains visible\.$/,
    );
  });

  it('R1 retains every node of the previous validated File graph while reroot is pending', () => {
    const adopted = {
      nodes: [{ id: 'file-a' }, { id: 'heading-a' }],
      edges: [{ id: 'a-hierarchy' }],
      layoutWarning: null,
    } as unknown as Parameters<
      typeof retainFocusSchematicGraphDuringLayoutTransition
    >[0];

    expect(
      retainFocusSchematicGraphDuringLayoutTransition(
        adopted,
        'focus-file-a',
        'focus-file-b',
      ),
    ).toBe(adopted);
    expect(adopted.nodes).toHaveLength(2);
    expect(
      retainFocusSchematicGraphDuringLayoutTransition(
        adopted,
        'focus-file-b',
        'focus-file-b',
      ),
    ).toBeNull();
  });

  it('RF1/RF5 derives overlays for the adopted generation and suppresses mixed-generation work', () => {
    let derivations = 0;
    expect(
      deriveFocusSchematicCurrentGenerationValue('focus-b', 'focus-b', () => {
        derivations += 1;
        return ['guide-b'];
      }),
    ).toEqual(['guide-b']);
    expect(
      deriveFocusSchematicCurrentGenerationValue('focus-a', 'focus-b', () => {
        derivations += 1;
        throw new Error('old graph was combined with the new tree');
      }),
    ).toBeNull();
    expect(derivations).toBe(1);
  });

  it('RF2/RF3 preserves a prior adopted presentation for worker or Nested replacement failure', () => {
    const adopted = { key: 'focus-a', graph: { nodes: ['a'] } };
    for (const message of [
      'Worker failed.',
      'Nested Soft hierarchy validation failed: stage=post-group, containment=0, splits=2, blockers=0; postCohesion[containment=0 splits=2 blockers=0]; postNested[containment=0 splits=0 blockers=0]; postGroup[containment=0 splits=2 blockers=0]; maxRegions=2; closestGap=24; memberCount=1-4.',
    ])
      expect(resolveFocusSchematicReplacementFailure(adopted, message)).toEqual(
        {
          kind: 'warning-with-last-valid',
          adopted,
          message: `${message} The last valid modular graph remains visible.`,
        },
      );
  });

  it('RF4 promotes only a first-result failure to the explicit fatal lifecycle', () => {
    expect(
      resolveFocusSchematicReplacementFailure(undefined, 'First failed.'),
    ).toEqual({
      kind: 'fatal-no-valid-result',
      message: 'First failed.',
    });
  });
});
