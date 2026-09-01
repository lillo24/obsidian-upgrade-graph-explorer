import { describe, expect, it } from 'vitest';

import { buildLocalGraph, reconcileLocalGraph } from './local-graph';
import {
  mapProjectionToLocal,
  mapProjectionToLocalTopology,
  seedLocalRendererInput,
} from './local-mapping';
import { localTestProjection } from './local-test-fixture';

describe('Local Free mapping and reconciliation', () => {
  it('maps all Local node kinds and keeps hierarchy/reference semantics distinct', () => {
    const input = mapProjectionToLocal(localTestProjection(), 'root');
    const root = input.nodes.find(({ key }) => key === 'entity:root');

    expect(root?.attributes).toMatchObject({
      root: true,
      nodeKind: 'document',
      x: 0,
      y: 0,
    });
    expect(
      new Set(input.nodes.map(({ attributes }) => attributes.nodeKind)),
    ).toEqual(new Set(['document', 'section', 'block', 'diagnostic']));
    expect(
      new Set(input.edges.map(({ attributes }) => attributes.edgeKind)),
    ).toEqual(new Set(['hierarchy', 'reference']));
    expect(
      input.nodes.every(({ attributes }) => !('folderKey' in attributes)),
    ).toBe(true);
  });

  it('creates deterministic seed positions before worker refinement', () => {
    const topology = mapProjectionToLocalTopology(
      localTestProjection(),
      'root',
    );
    expect(seedLocalRendererInput(topology)).toEqual(
      seedLocalRendererInput(topology),
    );
  });

  it('warms surviving positions and seeds only additions during reconciliation', () => {
    const input = mapProjectionToLocal(localTestProjection(), 'root');
    const graph = buildLocalGraph(input);
    graph.mergeNodeAttributes('entity:heading', { x: 12, y: -4 });
    const next = {
      ...input,
      nodes: input.nodes.map((node) =>
        node.key === 'entity:heading'
          ? {
              ...node,
              attributes: { ...node.attributes, label: 'Renamed heading' },
            }
          : node,
      ),
    };
    const result = reconcileLocalGraph(graph, next);

    expect(result.nodesUpdated).toBe(1);
    expect(graph.getNodeAttributes('entity:heading')).toMatchObject({
      x: 12,
      y: -4,
      label: 'Renamed heading',
    });
  });
});
