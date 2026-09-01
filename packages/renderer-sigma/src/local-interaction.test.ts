import { describe, expect, it } from 'vitest';

import { LOCAL_INTERACTION_OPERATION_CONTRACTS } from './local-interaction-contract';

describe('Local operation oracle', () => {
  it.each(['zoom', 'pan', 'hover', 'selection'] as const)(
    '%s never projects, reconciles topology, or requests layout',
    (interaction) => {
      expect(LOCAL_INTERACTION_OPERATION_CONTRACTS[interaction]).toMatchObject({
        projection: 0,
        topologyReconciliation: 0,
        layoutRequest: 0,
        globalLayoutRequest: 0,
      });
    },
  );

  it('keeps Local disclosure isolated from Global layout', () => {
    expect(LOCAL_INTERACTION_OPERATION_CONTRACTS['disclosure-change']).toEqual({
      projection: 1,
      topologyReconciliation: 1,
      layoutRequest: 1,
      globalLayoutRequest: 0,
      visualRefresh: 1,
    });
  });
});
