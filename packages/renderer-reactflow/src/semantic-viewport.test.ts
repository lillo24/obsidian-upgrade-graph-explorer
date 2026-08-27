import { describe, expect, it } from 'vitest';

import { mapProjectionToReactFlow } from './mapping';
import { observeSemanticViewport } from './semantic-viewport';
import { rendererTestProjection } from './test-fixture';
import type { RendererGraph } from './types';

function graph(): RendererGraph {
  const mapped = mapProjectionToReactFlow(
    rendererTestProjection(),
    'structure',
    new Set(),
  );
  return {
    nodes: mapped.nodes.map((node) => ({
      ...node,
      position:
        node.type === 'entity' && node.data.entityId === 'document-a'
          ? { x: 0, y: 0 }
          : node.type === 'entity'
            ? { x: 500, y: 0 }
            : { x: 250, y: 0 },
    })),
    edges: mapped.edges,
    layoutWarning: null,
  };
}

describe('semantic viewport observation', () => {
  it('chooses the canonical entity node nearest the actual viewport center', () => {
    expect(
      observeSemanticViewport(
        graph(),
        { x: -400, y: 0, zoom: 1 },
        { width: 500, height: 200 },
      ),
    ).toEqual({ anchorEntityId: 'section-a', zoom: 1 });
  });

  it('accounts for zoom when converting the screen center to graph space', () => {
    expect(
      observeSemanticViewport(
        graph(),
        { x: -900, y: 0, zoom: 2 },
        { width: 400, height: 200 },
      ),
    ).toEqual({ anchorEntityId: 'section-a', zoom: 2 });
  });

  it('never selects a diagnostic synthetic node even when it is closest', () => {
    expect(
      observeSemanticViewport(
        graph(),
        { x: -250, y: 0, zoom: 1 },
        { width: 208, height: 94 },
      ).anchorEntityId,
    ).toBe('document-a');
  });

  it('uses renderer ID as a deterministic equal-distance tie breaker', () => {
    const value = graph();
    const entities = value.nodes.filter((node) => node.type === 'entity');
    const tied: RendererGraph = {
      ...value,
      nodes: [
        { ...entities[1]!, position: { x: 250, y: 0 } },
        { ...entities[0]!, position: { x: -250, y: 0 } },
      ],
    };

    const first = observeSemanticViewport(
      tied,
      { x: 0, y: 0, zoom: 1 },
      { width: 208, height: 104 },
    );
    const second = observeSemanticViewport(
      { ...tied, nodes: [...tied.nodes].reverse() },
      { x: 0, y: 0, zoom: 1 },
      { width: 208, height: 104 },
    );

    expect(first).toEqual(second);
  });

  it('returns a null anchor when no canonical entity can be observed', () => {
    const value = graph();
    expect(
      observeSemanticViewport(
        {
          ...value,
          nodes: value.nodes.filter((node) => node.type !== 'entity'),
        },
        { x: 0, y: 0, zoom: 1 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ anchorEntityId: null, zoom: 1 });
  });
});
