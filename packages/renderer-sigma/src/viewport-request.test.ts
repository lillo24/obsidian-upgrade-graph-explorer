import { describe, expect, it } from 'vitest';

import {
  initialViewportSatisfiesGlobalCenterRequest,
  shouldApplyGlobalViewportRequest,
} from './viewport-request';

describe('Global semantic viewport requests', () => {
  it('does not replay a matching initial semantic viewport after reveal', () => {
    const request = { key: 3, nodeId: 'node-a', ratio: 0.32 };
    const initialViewport = { anchorEntityId: 'entity-a', ratio: 0.32 };

    expect(
      initialViewportSatisfiesGlobalCenterRequest({
        initialViewport,
        request,
        requestEntityId: 'entity-a',
      }),
    ).toBe(true);
    expect(
      initialViewportSatisfiesGlobalCenterRequest({
        initialViewport,
        request,
        requestEntityId: 'entity-b',
      }),
    ).toBe(false);
    expect(
      initialViewportSatisfiesGlobalCenterRequest({
        initialViewport,
        request: { ...request, ratio: 0.4 },
        requestEntityId: 'entity-a',
      }),
    ).toBe(false);
  });

  it('waits for the worker layout commit before consuming an entry anchor', () => {
    const request = {
      handledKey: 0,
      ready: true,
      requestKey: 1,
    };

    expect(
      shouldApplyGlobalViewportRequest({ ...request, layoutPending: true }),
    ).toBe(false);
    expect(
      shouldApplyGlobalViewportRequest({ ...request, layoutPending: false }),
    ).toBe(true);
  });

  it('does not replay an already handled anchor after later live layouts', () => {
    expect(
      shouldApplyGlobalViewportRequest({
        handledKey: 4,
        layoutPending: false,
        ready: true,
        requestKey: 4,
      }),
    ).toBe(false);
  });

  it('waits for the latest final displayed geometry generation', () => {
    const request = {
      handledKey: 0,
      layoutPending: false,
      ready: true,
      requestKey: 1,
    };

    expect(
      shouldApplyGlobalViewportRequest({
        ...request,
        geometryReady: false,
      }),
    ).toBe(false);
    expect(
      shouldApplyGlobalViewportRequest({
        ...request,
        geometryReady: true,
      }),
    ).toBe(true);
  });
});
