import { describe, expect, it } from 'vitest';

import { shouldApplyGlobalViewportRequest } from './viewport-request';

describe('Global semantic viewport requests', () => {
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
