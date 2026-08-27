import { describe, expect, it } from 'vitest';

import { layoutRendererGraph } from './layout';
import { mapProjectionToReactFlow } from './mapping';
import { prepareRendererGraph } from './prepare';
import { rendererTestProjection } from './test-fixture';

function nodePosition(
  graph: ReturnType<typeof prepareRendererGraph>,
  projectionNodeId: string,
) {
  const node = graph.nodes.find(
    (candidate) => candidate.data.projectionNodeId === projectionNodeId,
  );
  if (node === undefined)
    throw new Error(`Missing test node ${projectionNodeId}.`);
  return node.position;
}

describe('deterministic renderer layout', () => {
  it('lays structure top-to-bottom and focus left-to-right deterministically', () => {
    const projection = rendererTestProjection();
    const structureA = prepareRendererGraph(projection, {
      layoutMode: 'structure',
    });
    const structureB = prepareRendererGraph(projection, {
      layoutMode: 'structure',
    });
    const focus = prepareRendererGraph(projection, { layoutMode: 'focus' });

    expect(structureA).toEqual(structureB);
    expect(nodePosition(structureA, 'projection-document').y).toBeLessThan(
      nodePosition(structureA, 'projection-section').y,
    );
    expect(nodePosition(focus, 'projection-document').x).toBeLessThan(
      nodePosition(focus, 'projection-section').x,
    );
    expect(nodePosition(focus, 'projection-diagnostic').x).toBeGreaterThan(
      nodePosition(focus, 'projection-section').x,
    );
  });

  it('surfaces layout failure and falls back to a deterministic grid', () => {
    const mapped = mapProjectionToReactFlow(
      rendererTestProjection(),
      'structure',
      new Set(),
    );
    const failingEngine = () => {
      throw new Error('synthetic engine failure');
    };
    const first = layoutRendererGraph(
      mapped.nodes,
      mapped.edges,
      'structure',
      failingEngine,
    );
    const second = layoutRendererGraph(
      mapped.nodes,
      mapped.edges,
      'structure',
      failingEngine,
    );

    expect(first.layoutWarning).toContain('synthetic engine failure');
    expect(first.nodes.map((node) => node.position)).toEqual(
      second.nodes.map((node) => node.position),
    );
  });
});
