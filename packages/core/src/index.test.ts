import { describe, expect, it } from 'vitest';

import { foundationIdentity } from './index';

describe('core foundation contract', () => {
  it('exports immutable, renderer-independent product metadata', () => {
    expect(Object.isFrozen(foundationIdentity)).toBe(true);
    expect(foundationIdentity.description).toBe(
      'Hierarchical Markdown graph explorer',
    );
  });
});
