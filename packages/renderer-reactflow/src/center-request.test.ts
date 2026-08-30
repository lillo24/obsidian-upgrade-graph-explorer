import { describe, expect, it } from 'vitest';

import {
  resolveGraphCenterRequest,
  shouldApplyGraphFitRequest,
} from './center-request';
import { prepareRendererGraph } from './prepare';
import { rendererTestProjection } from './test-fixture';

function graph() {
  return prepareRendererGraph(rendererTestProjection(), {
    layoutMode: 'structure',
  });
}

describe('renderer center requests', () => {
  it('resolves an existing projected node to its laid-out center', () => {
    const prepared = graph();
    const node = prepared.nodes.find(
      (candidate) => candidate.data.projectionNodeId === 'projection-section',
    );
    const result = resolveGraphCenterRequest(
      prepared,
      { key: 1, nodeId: 'projection-section', zoom: 1.1 },
      null,
    );

    expect(result).toEqual({
      handledKey: 1,
      instruction: {
        x: (node?.position.x ?? 0) + (node?.width ?? 0) / 2,
        y: (node?.position.y ?? 0) + (node?.height ?? 0) / 2,
        zoom: 1.1,
      },
    });
  });

  it('consumes stale node IDs safely without fabricating a center', () => {
    expect(
      resolveGraphCenterRequest(graph(), { key: 2, nodeId: 'stale-node' }, 1),
    ).toEqual({ handledKey: 2, instruction: null });
  });

  it('does not retrigger the same key and handles a changed key', () => {
    const prepared = graph();
    const request = { key: 3, nodeId: 'projection-document' } as const;

    expect(resolveGraphCenterRequest(prepared, request, 3)).toBeNull();
    expect(
      resolveGraphCenterRequest(prepared, { ...request, key: 4 }, 3)
        ?.handledKey,
    ).toBe(4);
  });

  it('is independent from graph selection and full-fit request state', () => {
    expect(resolveGraphCenterRequest(graph(), undefined, 8)).toBeNull();
  });

  it('lets a current semantic center supersede a stale Fit request', () => {
    expect(shouldApplyGraphFitRequest(1, 2, undefined)).toBe(true);
    expect(
      shouldApplyGraphFitRequest(1, 2, {
        key: 3,
        nodeId: 'projection-document',
      }),
    ).toBe(false);
    expect(shouldApplyGraphFitRequest(2, 2, undefined)).toBe(false);
  });
});
