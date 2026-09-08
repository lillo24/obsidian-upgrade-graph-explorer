import { MultiDirectedGraph } from 'graphology';
import { describe, expect, it } from 'vitest';

import { applyNetworkPhysicsPullIteration } from './pull';

describe('applyNetworkPhysicsPullIteration', () => {
  it('keeps zero strength inert and moves a group by one shared translation', () => {
    const graph = new MultiDirectedGraph<
      { x: number; y: number; size: number; constraintEligible?: boolean },
      { weight: number }
    >();
    graph.addNode('a', { x: 0, y: 0, size: 1 });
    graph.addNode('b', { x: 2, y: 0, size: 1 });
    graph.addNode('outside', { x: -4, y: 1, size: 1 });
    const before = graph.mapNodes((key, value) => ({ key, ...value }));
    applyNetworkPhysicsPullIteration(graph, [
      {
        ruleFolderKey: 'zero',
        memberNodeKeys: ['a', 'b'],
        targetX: 20,
        targetY: 5,
        strength: 0,
      },
    ]);
    expect(graph.mapNodes((key, value) => ({ key, ...value }))).toEqual(before);

    applyNetworkPhysicsPullIteration(graph, [
      {
        ruleFolderKey: 'active',
        memberNodeKeys: ['a', 'b'],
        targetX: 20,
        targetY: 5,
        strength: 70,
      },
    ]);
    const a = graph.getNodeAttributes('a');
    const b = graph.getNodeAttributes('b');
    expect(a.x).toBeGreaterThan(0);
    expect(a.y).toBeGreaterThan(0);
    expect(b.x - a.x).toBeCloseTo(2, 12);
    expect(b.y - a.y).toBeCloseTo(0, 12);
    expect(graph.getNodeAttributes('outside')).toMatchObject({ x: -4, y: 1 });
  });
});
