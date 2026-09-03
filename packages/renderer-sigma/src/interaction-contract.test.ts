import { describe, expect, it } from 'vitest';

import { GLOBAL_INTERACTION_OPERATION_CONTRACTS } from './interaction-contract';

describe('Global interaction operation contract', () => {
  it('treats layout and node-size settings as layout-only work', () => {
    expect(
      GLOBAL_INTERACTION_OPERATION_CONTRACTS['layout-settings-change'],
    ).toEqual({
      projection: 0,
      graphReconciliation: 0,
      layoutRequest: 1,
      visualRefresh: 1,
    });
  });

  it.each(['hover', 'selection', 'zoom', 'pan'] as const)(
    'keeps %s free of projection, reconciliation, and layout work',
    (interaction) => {
      expect(GLOBAL_INTERACTION_OPERATION_CONTRACTS[interaction]).toMatchObject(
        {
          projection: 0,
          graphReconciliation: 0,
          layoutRequest: 0,
        },
      );
    },
  );

  it('keeps Inspector outside renderer work', () => {
    expect(GLOBAL_INTERACTION_OPERATION_CONTRACTS.inspector).toEqual({
      projection: 0,
      graphReconciliation: 0,
      layoutRequest: 0,
      visualRefresh: 0,
    });
  });
});
