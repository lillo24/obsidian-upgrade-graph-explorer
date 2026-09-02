import { describe, expect, it } from 'vitest';

import { GLOBAL_INTERACTION_OPERATION_CONTRACTS } from './interaction-contract';

describe('Global interaction operation contract', () => {
  it('treats folder strength as layout-only work', () => {
    expect(
      GLOBAL_INTERACTION_OPERATION_CONTRACTS['layout-settings-change'],
    ).toEqual({
      projection: 0,
      graphReconciliation: 0,
      layoutRequest: 1,
      visualRefresh: 1,
    });
  });
});
