import { describe, expect, it } from 'vitest';

import { graphSettingsTabForKey } from './graph-settings-tabs';

describe('Settings tab keyboard navigation', () => {
  it.each([
    ['graph', 'ArrowRight', 'source'],
    ['source', 'ArrowRight', 'graph'],
    ['graph', 'ArrowLeft', 'source'],
    ['source', 'ArrowLeft', 'graph'],
    ['source', 'Home', 'graph'],
    ['graph', 'End', 'source'],
  ] as const)('moves %s with %s to %s', (current, key, expected) => {
    expect(graphSettingsTabForKey(current, key)).toBe(expected);
  });

  it('leaves unrelated keys to their native behavior', () => {
    expect(graphSettingsTabForKey('graph', 'Tab')).toBeUndefined();
  });
});
