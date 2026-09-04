import { describe, expect, it } from 'vitest';

import { graphSettingsTabForKey } from './graph-settings-tabs';

describe('Settings tab keyboard navigation', () => {
  it.each([
    ['preferences', 'ArrowRight', 'sandbox'],
    ['sandbox', 'ArrowRight', 'source'],
    ['source', 'ArrowRight', 'preferences'],
    ['preferences', 'ArrowLeft', 'source'],
    ['source', 'ArrowLeft', 'sandbox'],
    ['sandbox', 'ArrowLeft', 'preferences'],
    ['source', 'Home', 'preferences'],
    ['preferences', 'End', 'source'],
  ] as const)('moves %s with %s to %s', (current, key, expected) => {
    expect(graphSettingsTabForKey(current, key)).toBe(expected);
  });

  it('leaves unrelated keys to their native behavior', () => {
    expect(graphSettingsTabForKey('preferences', 'Tab')).toBeUndefined();
  });
});
