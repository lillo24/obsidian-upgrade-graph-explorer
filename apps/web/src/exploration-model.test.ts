import { describe, expect, it } from 'vitest';

import {
  allPresentationMode,
  explorationLayout,
  explorationScope,
  focusLayoutMode,
} from './exploration-model';

describe('Scope and Layout mapping', () => {
  it.each([
    ['global', 'free', 'all', 'network'],
    ['structure', 'free', 'all', 'hierarchy'],
    ['local', 'free', 'focus', 'network'],
    ['local', 'structured', 'focus', 'hierarchy'],
  ] as const)(
    'maps %s/%s to %s/%s',
    (presentation, localLayout, scope, layout) => {
      expect(explorationScope(presentation)).toBe(scope);
      expect(explorationLayout(presentation, localLayout)).toBe(layout);
    },
  );

  it('maps exposed layouts back to the compatible internal modes', () => {
    expect(allPresentationMode('network')).toBe('global');
    expect(allPresentationMode('hierarchy')).toBe('structure');
    expect(focusLayoutMode('network')).toBe('free');
    expect(focusLayoutMode('hierarchy')).toBe('structured');
  });
});
