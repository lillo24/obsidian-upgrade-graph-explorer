import { describe, expect, it } from 'vitest';

import { LocalLayoutCache } from './local-layout-cache';
import {
  computeLocalLayout,
  createLocalLayoutRequest,
  localLayoutFingerprint,
  warmLocalRendererInput,
} from './local-layout';
import { mapProjectionToLocal } from './local-mapping';
import { localTestProjection } from './local-test-fixture';

describe('Local Free layout contract', () => {
  it('returns every node with the root translated to the Local origin', () => {
    const request = createLocalLayoutRequest(
      mapProjectionToLocal(localTestProjection(), 'root'),
      2,
    );
    const result = computeLocalLayout({ ...request, requestId: 1 });

    expect(result.positions).toHaveLength(request.nodes.length);
    expect(result.positions.find(({ key }) => key === request.rootKey)).toEqual(
      {
        key: request.rootKey,
        x: 0,
        y: 0,
      },
    );
  });

  it('fingerprints semantic topology but excludes seed coordinates', () => {
    const request = createLocalLayoutRequest(
      mapProjectionToLocal(localTestProjection(), 'root'),
      2,
    );
    const moved = {
      ...request,
      nodes: request.nodes.map((node) => ({
        ...node,
        x: node.x + 50,
        y: node.y - 20,
      })),
    };
    const changed = {
      ...request,
      edges: request.edges.map((edge, index) =>
        index === 0 ? { ...edge, weight: edge.weight + 1 } : edge,
      ),
    };

    expect(localLayoutFingerprint(moved)).toBe(localLayoutFingerprint(request));
    expect(localLayoutFingerprint(changed)).not.toBe(
      localLayoutFingerprint(request),
    );
  });

  it('keeps exact results in a bounded memory-only LRU', () => {
    const cache = new LocalLayoutCache(2);
    cache.set('a', [{ key: 'a', x: 0, y: 0 }]);
    cache.set('b', [{ key: 'b', x: 1, y: 1 }]);
    cache.get('a');
    cache.set('c', [{ key: 'c', x: 2, y: 2 }]);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toEqual([{ key: 'a', x: 0, y: 0 }]);
    expect(cache.size).toBe(2);
  });

  it('warms a remounted renderer from an exact cached position set', () => {
    const input = mapProjectionToLocal(localTestProjection(), 'root');
    const positions = input.nodes.map((node, index) => ({
      key: node.key,
      x: index + 10,
      y: index - 10,
    }));

    const warmed = warmLocalRendererInput(input, positions);

    expect(
      warmed.nodes.map(({ attributes }) => [attributes.x, attributes.y]),
    ).toEqual(positions.map(({ x, y }) => [x, y]));
    expect(() => warmLocalRendererInput(input, positions.slice(1))).toThrow(
      'does not match the projected nodes',
    );
  });
});
