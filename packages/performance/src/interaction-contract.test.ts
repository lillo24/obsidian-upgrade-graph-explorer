import { describe, expect, it } from 'vitest';

import { PERFORMANCE_INTERACTION_OPERATION_CONTRACTS } from './interaction-contract';
import { PERFORMANCE_INTERACTIONS } from './types';

describe('performance interaction operation contracts', () => {
  it('covers I1 through I18 exactly once', () => {
    expect(Object.keys(PERFORMANCE_INTERACTION_OPERATION_CONTRACTS)).toEqual(
      PERFORMANCE_INTERACTIONS,
    );
  });

  it.each([
    'I8-hover',
    'I9-select',
    'I10-canonical-search',
    'I12-inspector',
    'I13-maximize-restore',
    'I14-resize',
    'I15-pan-zoom',
    'I17-live-non-markdown',
  ] as const)(
    '%s forbids projection and layout recomputation',
    (interaction) => {
      const forbidden =
        PERFORMANCE_INTERACTION_OPERATION_CONTRACTS[interaction].forbidden;
      expect(forbidden).toContain('projections');
      expect(forbidden).toContain('renderer-mappings');
      expect(forbidden).toContain('layouts');
    },
  );
});
