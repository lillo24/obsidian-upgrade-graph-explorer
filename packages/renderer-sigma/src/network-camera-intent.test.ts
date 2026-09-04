import { describe, expect, it } from 'vitest';

import { NetworkPositionCameraIntentPolicy } from './network-camera-intent';

describe('Network position camera intent', () => {
  it('grants initial framing once and keeps later geometry camera-neutral', () => {
    const policy = new NetworkPositionCameraIntentPolicy(true);

    expect(policy.consumePositionAdoption()).toBe('initial-automatic-framing');
    expect(policy.consumePositionAdoption()).toBe('preserve-current-frame');
    expect(policy.consumePositionAdoption()).toBe('preserve-current-frame');
  });

  it('never grants automatic framing after cached or restored presentation', () => {
    const policy = new NetworkPositionCameraIntentPolicy(false);

    expect(policy.consumePositionAdoption()).toBe('preserve-current-frame');
    expect(policy.consumePositionAdoption()).toBe('preserve-current-frame');
  });

  it('withdraws initial framing when an explicit camera action happens first', () => {
    const policy = new NetworkPositionCameraIntentPolicy(true);

    policy.claimCamera();

    expect(policy.consumePositionAdoption()).toBe('preserve-current-frame');
  });
});
