import { describe, expect, it } from 'vitest';

import {
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  SOFT_CLUSTER_FIXTURES,
  buildEndpointFixture,
  computeFocusSchematicSoftClusterLayoutAttempt,
} from '@icarus-graph-explorer/focus-schematic-layout';
import { focusSchematicNodeDimensions } from '@icarus-graph-explorer/renderer-reactflow/focus-schematic';

import {
  prepareFocusSchematicDisplayedGraph,
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
});
