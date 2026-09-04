import { describe, expect, it } from 'vitest';

import {
  ENDPOINT_FIXTURES,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  buildEndpointFixture,
  computeFocusSchematicComputedLayout,
} from '@icarus-graph-explorer/focus-schematic-layout';

import {
  focusSchematicNodeDimensions,
  prepareFocusSchematicRendererGraph,
  validateFocusSchematicRendererGraph,
} from './index';

function prepared(fixtureId: string, secondaryRelationshipsVisible = false) {
  const fixture = buildEndpointFixture(
    ENDPOINT_FIXTURES.find(({ id }) => id === fixtureId)!,
  );
  const layoutInput = {
    model: fixture.model,
    projection: fixture.projection,
    nodeDimensions: focusSchematicNodeDimensions(
      fixture.projection,
      fixture.model,
    ),
    settings: FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  };
  const computedLayout = computeFocusSchematicComputedLayout(layoutInput);
  const input = {
    projection: fixture.projection,
    model: fixture.model,
    layoutInput,
    computedLayout,
    rootEntityId: fixture.model.rootModuleId,
    secondaryRelationshipsVisible,
  };
  return {
    fixture,
    computedLayout,
    graph: prepareFocusSchematicRendererGraph(input),
    input,
  };
}

describe('production Focus Schematic React Flow mapping', () => {
  it.each(['EP2', 'EP3', 'EP4', 'EP12'])(
    'maps exact File/Heading/Block endpoints and A1 positions for %s',
    (fixtureId) => {
      const { computedLayout, graph, input } = prepared(fixtureId);
      expect(validateFocusSchematicRendererGraph(input, graph).valid).toBe(
        true,
      );
      for (const geometry of computedLayout.candidate.nodes) {
        const node = graph.nodes.find(
          ({ data }) => data.projectionNodeId === geometry.projectionNodeId,
        );
        expect(node).toMatchObject({
          position: { x: geometry.x, y: geometry.y },
          width: geometry.width,
          height: geometry.height,
        });
      }
      const attachmentSide = new Map(
        computedLayout.attachments.map((attachment) => [
          `${attachment.connectionId}\0${attachment.endpoint}`,
          attachment.side,
        ]),
      );
      for (const connection of computedLayout.endpointPlan.connections) {
        if (connection.role === 'secondary') continue;
        const source = graph.nodes.find((node) =>
          connection.source.kind === 'visible-entity'
            ? node.data.projectionNodeId === connection.source.projectionNodeId
            : node.data.projectionNodeId === null &&
              node.data.moduleId === connection.source.moduleId,
        );
        const target = graph.nodes.find((node) =>
          connection.target.kind === 'visible-entity'
            ? node.data.projectionNodeId === connection.target.projectionNodeId
            : node.data.projectionNodeId === null &&
              node.data.moduleId === connection.target.moduleId,
        );
        expect(source).toBeDefined();
        expect(target).toBeDefined();
        const edge =
          connection.projectedEdgeId === null
            ? graph.edges.find(
                ({ id }) =>
                  id === JSON.stringify(['focus-fallback-edge', connection.id]),
              )
            : graph.edges.find(
                ({ data }) =>
                  data?.projectionEdgeId === connection.projectedEdgeId,
              );
        expect(edge).toMatchObject({
          source: source!.id,
          target: target!.id,
          sourceHandle: `source-${attachmentSide.get(`${connection.id}\0source`)}`,
          targetHandle: `target-${attachmentSide.get(`${connection.id}\0target`)}`,
        });
      }

      for (const attachment of computedLayout.internalLanePlan
        .hierarchyAttachments) {
        const source = graph.nodes.find(
          ({ data }) =>
            data.projectionNodeId === attachment.sourceProjectionNodeId,
        )!;
        const target = graph.nodes.find(
          ({ data }) =>
            data.projectionNodeId === attachment.targetProjectionNodeId,
        )!;
        const dx =
          target.position.x +
          target.width! / 2 -
          (source.position.x + source.width! / 2);
        const dy =
          target.position.y +
          target.height! / 2 -
          (source.position.y + source.height! / 2);
        const automatic =
          Math.abs(dx) >= Math.abs(dy)
            ? dx >= 0
              ? { source: 'right', target: 'left' }
              : { source: 'left', target: 'right' }
            : dy >= 0
              ? { source: 'bottom', target: 'top' }
              : { source: 'top', target: 'bottom' };
        expect(
          graph.edges.find(
            ({ data }) => data?.projectionEdgeId === attachment.hierarchyEdgeId,
          ),
        ).toMatchObject({
          source: source.id,
          target: target.id,
          sourceHandle: `source-${attachment.sourceSide === 'auto' ? automatic.source : attachment.sourceSide}`,
          targetHandle: `target-${attachment.targetSide === 'auto' ? automatic.target : attachment.targetSide}`,
        });
      }
    },
  );

  it('renders the filtered module as an anonymous bridge with truthful fallback identity', () => {
    const { graph } = prepared('EP18');
    const bridge = graph.nodes.find(({ type }) => type === 'filtered-bridge');
    expect(bridge).toMatchObject({
      focusable: true,
      selectable: false,
      ariaLabel: 'Filtered File bridge',
      data: { projectionNodeId: null, ariaLabel: 'Filtered File bridge' },
    });
    expect(JSON.stringify(bridge)).not.toContain('.md');
    expect(
      graph.edges.filter(({ className }) =>
        className?.includes('graph-edge--focus-fallback'),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          selectable: false,
          data: expect.objectContaining({ projectionEdgeId: null }),
        }),
      ]),
    );
  });

  it('places diagnostics collision-free while preserving exact projection identity', () => {
    const { computedLayout, graph } = prepared('EP20');
    const diagnostic = graph.nodes.find(({ type }) => type === 'diagnostic');
    expect(diagnostic?.data.projectionNodeId).toEqual(expect.any(String));
    for (const module of computedLayout.candidate.modules) {
      expect(
        diagnostic!.position.x < module.x + module.width + 16 &&
          diagnostic!.position.x + diagnostic!.width! + 16 > module.x &&
          diagnostic!.position.y < module.y + module.height + 16 &&
          diagnostic!.position.y + diagnostic!.height! + 16 > module.y,
      ).toBe(false);
    }
  });

  it('shows secondary links without changing any node coordinate', () => {
    const hidden = prepared('EP16', false).graph;
    const visible = prepared('EP16', true).graph;
    expect(visible.nodes.map(({ id, position }) => ({ id, position }))).toEqual(
      hidden.nodes.map(({ id, position }) => ({ id, position })),
    );
    expect(visible.edges.length).toBeGreaterThan(hidden.edges.length);
  });
});
