import { describe, expect, it } from 'vitest';
import { getSmoothStepPath, getStraightPath, Position } from '@xyflow/react';

import { graphEdgePath } from './edges';

const endpointGeometry = {
  sourceX: 10,
  sourceY: 20,
  sourcePosition: Position.Right,
  targetX: 210,
  targetY: 130,
  targetPosition: Position.Left,
  visualVariant: 'extended' as const,
};

describe('GraphEdge route styles', () => {
  it('uses one direct exact-endpoint path only when Modular Preview requests it', () => {
    expect(
      graphEdgePath({ ...endpointGeometry, routeStyle: 'direct' }),
    ).toEqual(getStraightPath(endpointGeometry));
  });

  it('keeps SmoothStep as the shared default and Electronic alternative', () => {
    const expected = getSmoothStepPath({
      ...endpointGeometry,
      borderRadius: 10,
    });
    expect(
      graphEdgePath({ ...endpointGeometry, routeStyle: 'electronic' }),
    ).toEqual(expected);
    expect(
      graphEdgePath({ ...endpointGeometry, routeStyle: undefined }),
    ).toEqual(expected);
  });
});
