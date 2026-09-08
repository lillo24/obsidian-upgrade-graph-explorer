import { describe, expect, it } from 'vitest';

import {
  ENDPOINT_FIXTURES,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  buildEndpointFixture,
  computeFocusSchematicComputedLayout,
  type EndpointFixtureSpec,
} from '@icarus-graph-explorer/focus-schematic-layout';

import {
  focusSchematicNodeDimensions,
  prepareFocusSchematicRendererGraph,
  validateFocusSchematicRendererGraph,
} from './index';
import { applyRendererHighlight } from '../highlight';

function projectedEntityId(
  fixture: ReturnType<typeof buildEndpointFixture>,
  entityId: string,
): string {
  const node = fixture.projection.nodes.find(
    (candidate) =>
      candidate.kind === 'entity' && candidate.entityId === entityId,
  );
  if (node === undefined) throw new Error(`Missing entity ${entityId}.`);
  return node.id;
}

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

function preparedSpec(
  fixtureSpec: EndpointFixtureSpec,
  secondaryRelationshipsVisible = false,
) {
  const fixture = buildEndpointFixture(fixtureSpec);
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
  return {
    fixture,
    computedLayout,
    graph: prepareFocusSchematicRendererGraph({
      projection: fixture.projection,
      model: fixture.model,
      layoutInput,
      computedLayout,
      rootEntityId: fixture.model.rootModuleId,
      secondaryRelationshipsVisible,
    }),
  };
}

function highlightedReferenceIds(
  fixture: ReturnType<typeof buildEndpointFixture>,
  graph: ReturnType<typeof prepareFocusSchematicRendererGraph>,
): readonly string[] {
  const edgeById = new Map(
    fixture.projection.edges.map((edge) => [edge.id, edge]),
  );
  return [
    ...new Set(
      graph.edges.flatMap((edge) => {
        if (!edge.className?.includes('is-highlighted')) return [];
        const projectionEdgeId = edge.data?.projectionEdgeId;
        if (projectionEdgeId === null || projectionEdgeId === undefined)
          return [];
        const projected = edgeById.get(projectionEdgeId);
        return projected?.kind === 'reference' ? projected.referenceIds : [];
      }),
    ),
  ].sort();
}

describe('production Focus Schematic React Flow mapping', () => {
  it('changes only Modular Preview route drawing between Direct and Electronic', () => {
    const { graph: direct, input } = prepared('EP12');
    const electronic = prepareFocusSchematicRendererGraph({
      ...input,
      routeStyle: 'electronic',
    });

    expect(direct.edges.map(({ data }) => data?.routeStyle)).toEqual(
      Array(direct.edges.length).fill('direct'),
    );
    expect(electronic.edges.map(({ data }) => data?.routeStyle)).toEqual(
      Array(electronic.edges.length).fill('electronic'),
    );
    expect(
      electronic.edges.map(
        ({ id, source, target, sourceHandle, targetHandle, data }) => ({
          id,
          source,
          target,
          sourceHandle,
          targetHandle,
          projectionEdgeId: data?.projectionEdgeId,
          status: data?.status,
        }),
      ),
    ).toEqual(
      direct.edges.map(
        ({ id, source, target, sourceHandle, targetHandle, data }) => ({
          id,
          source,
          target,
          sourceHandle,
          targetHandle,
          projectionEdgeId: data?.projectionEdgeId,
          status: data?.status,
        }),
      ),
    );
  });

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

  it('FH1/FH3/FH6/FH7/FH9 aggregates a modular File while Heading and Block hover stay exact', () => {
    const { fixture, graph } = prepared('EP12');
    const fileId = projectedEntityId(fixture, 'Atlas');
    const headingId = projectedEntityId(fixture, 'Atlas-heading');
    const blockId = projectedEntityId(fixture, 'Atlas-block');
    const fileNode = graph.nodes.find(
      ({ data }) => data.projectionNodeId === fileId,
    );
    expect(fileNode?.type).toBe('entity');
    expect(fileNode?.data).toMatchObject({
      focusSchematicModuleId: 'Atlas',
      focusSchematicHoverBehavior: 'module-aggregate',
    });

    const aggregate = applyRendererHighlight(graph, {
      kind: 'node',
      id: fileId,
    });
    const atlasNodeIds = new Set(
      graph.nodes
        .filter(
          (node) =>
            (node.type === 'entity' &&
              node.data.focusSchematicModuleId === 'Atlas') ||
            (node.type === 'module' && node.data.moduleId === 'Atlas'),
        )
        .map(({ id }) => id),
    );
    expect(
      aggregate.nodes
        .filter(({ id }) => atlasNodeIds.has(id))
        .every(({ className }) => className?.includes('is-highlighted')),
    ).toBe(true);
    expect(
      aggregate.edges
        .filter(
          (edge) =>
            edge.data?.kind === 'reference' &&
            (atlasNodeIds.has(edge.source) || atlasNodeIds.has(edge.target)),
        )
        .every((edge) => edge.className?.includes('is-highlighted')),
    ).toBe(true);

    for (const exactId of [headingId, blockId]) {
      const exact = applyRendererHighlight(graph, {
        kind: 'node',
        id: exactId,
      });
      const exactNode = graph.nodes.find(
        ({ data }) => data.projectionNodeId === exactId,
      )!;
      expect(
        exact.edges
          .filter(({ className }) => className?.includes('is-highlighted'))
          .every(
            (edge) =>
              edge.source === exactNode.id || edge.target === exactNode.id,
          ),
      ).toBe(true);
    }
  });

  it('FH1/FH4/FH5 derives the direct File ring from displayed exact reference endpoints without moving nodes', () => {
    const direct = prepared('EP11').graph;
    const headingOnly = prepared('EP15').graph;
    const hiddenSecondary = prepared('EP16', false).graph;
    const visibleSecondary = prepared('EP16', true).graph;
    expect(
      direct.nodes.filter(
        (node) =>
          node.type === 'entity' &&
          node.data.hasDirectFileConnectionRing === true,
      ),
    ).toHaveLength(2);
    expect(
      headingOnly.nodes.some(
        (node) =>
          node.type === 'entity' &&
          node.data.hasDirectFileConnectionRing === true,
      ),
    ).toBe(false);
    expect(
      visibleSecondary.nodes.map(({ id, position }) => ({ id, position })),
    ).toEqual(
      hiddenSecondary.nodes.map(({ id, position }) => ({ id, position })),
    );
  });

  it('FH1/FH8 document-direct hover includes only rendered reference edges incident to the File', () => {
    const { fixture, graph } = prepared('EP11');
    const fileId = projectedEntityId(fixture, 'Atlas');
    const fileNode = graph.nodes.find(
      ({ data }) => data.projectionNodeId === fileId,
    )!;
    const highlighted = applyRendererHighlight(graph, {
      kind: 'document-direct',
      id: fileId,
    });
    const activeEdges = highlighted.edges.filter(({ className }) =>
      className?.includes('is-highlighted'),
    );
    expect(activeEdges.length).toBeGreaterThan(0);
    expect(
      activeEdges.every(
        (edge) =>
          edge.data?.kind === 'reference' &&
          (edge.source === fileNode.id || edge.target === fileNode.id),
      ),
    ).toBe(true);
  });

  it('FH2 preserves underlying reference coverage across collapsed and expanded File aggregate hover', () => {
    const base = {
      id: 'CS90' as const,
      label: 'Collapse continuity',
      authored: 'Atlas > Detail → Beacon.md',
      expectation: 'File aggregate hover retains provenance across disclosure.',
      inspect: 'Projection edge identity may change; ReferenceId does not.',
      rootDocumentId: 'Atlas',
      documents: [{ id: 'Atlas' }, { id: 'Beacon' }],
      entities: [
        {
          id: 'Atlas-detail',
          kind: 'section' as const,
          documentId: 'Atlas',
          parentId: 'Atlas',
          line: 2,
        },
      ],
      references: [
        { sourceEntityId: 'Atlas-detail', targetEntityId: 'Beacon' },
      ],
      direction: 'outgoing' as const,
    } satisfies EndpointFixtureSpec;
    const collapsed = preparedSpec({
      ...base,
      collapsedEntityIds: ['Atlas'],
      expandedEntityIds: [],
    });
    const expanded = preparedSpec({
      ...base,
      collapsedEntityIds: [],
      expandedEntityIds: ['Atlas'],
    });
    const highlightFile = (value: typeof expanded) => {
      const id = projectedEntityId(value.fixture, 'Atlas');
      return applyRendererHighlight(value.graph, { kind: 'node', id });
    };
    expect(
      highlightedReferenceIds(collapsed.fixture, highlightFile(collapsed)),
    ).toEqual(
      highlightedReferenceIds(expanded.fixture, highlightFile(expanded)),
    );
    expect(
      collapsed.graph.nodes.some(
        (node) =>
          node.type === 'entity' &&
          node.data.hasDirectFileConnectionRing === true,
      ),
    ).toBe(false);
  });

  it('FH5 lets displayed direct secondary references control the ring with byte-identical geometry', () => {
    const fixtureSpec = {
      id: 'CS91',
      label: 'Direct secondary ring',
      authored:
        'Heading-owned backbone connections plus Birch.md → Cedar.md secondary.',
      expectation: 'Only the displayed direct secondary creates File rings.',
      inspect: 'Secondary visibility cannot change node geometry.',
      rootDocumentId: 'Atlas',
      documents: [{ id: 'Atlas' }, { id: 'Birch' }, { id: 'Cedar' }],
      entities: [
        {
          id: 'Atlas-birch',
          kind: 'section',
          documentId: 'Atlas',
          parentId: 'Atlas',
          line: 2,
        },
        {
          id: 'Atlas-cedar',
          kind: 'section',
          documentId: 'Atlas',
          parentId: 'Atlas',
          line: 4,
        },
        {
          id: 'Birch-detail',
          kind: 'section',
          documentId: 'Birch',
          parentId: 'Birch',
          line: 2,
        },
        {
          id: 'Cedar-detail',
          kind: 'section',
          documentId: 'Cedar',
          parentId: 'Cedar',
          line: 2,
        },
      ],
      references: [
        { sourceEntityId: 'Atlas-birch', targetEntityId: 'Birch-detail' },
        { sourceEntityId: 'Atlas-cedar', targetEntityId: 'Cedar-detail' },
        { sourceEntityId: 'Birch', targetEntityId: 'Cedar' },
      ],
      direction: 'outgoing',
      hops: 1,
    } satisfies EndpointFixtureSpec;
    const hidden = preparedSpec(fixtureSpec, false).graph;
    const visible = preparedSpec(fixtureSpec, true).graph;
    const rings = (graph: typeof visible) =>
      graph.nodes
        .filter(
          (node) =>
            node.type === 'entity' &&
            node.data.hasDirectFileConnectionRing === true,
        )
        .map((node) => (node.type === 'entity' ? node.data.entityId : ''))
        .sort();
    expect(rings(hidden)).toEqual([]);
    expect(rings(visible)).toEqual(['Birch', 'Cedar']);
    expect(
      visible.nodes.map(({ id, position, width, height }) => ({
        id,
        position,
        width,
        height,
      })),
    ).toEqual(
      hidden.nodes.map(({ id, position, width, height }) => ({
        id,
        position,
        width,
        height,
      })),
    );
  });
});
