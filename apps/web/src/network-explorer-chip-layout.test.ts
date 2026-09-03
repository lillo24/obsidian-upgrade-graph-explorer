import { describe, expect, it } from 'vitest';
import { visibleHiddenChipCount } from './network-explorer-chip-layout';

describe('hidden-file chip row', () => {
  it('omits the disclosure when every chip fits, including exact fits', () => {
    expect(visibleHiddenChipCount([], 300, 48, 4)).toBe(0);
    expect(visibleHiddenChipCount([100], 100, 48, 4)).toBe(1);
    expect(visibleHiddenChipCount([100, 100], 204, 48, 4)).toBe(2);
  });

  it('reserves more-button space and only shows complete chips', () => {
    expect(visibleHiddenChipCount([100, 100, 100], 300, 48, 4)).toBe(2);
    expect(visibleHiddenChipCount([100, 100, 100], 200, 48, 4)).toBe(1);
    expect(visibleHiddenChipCount([160, 40], 180, 48, 4)).toBe(0);
  });

  it('recalculates after narrower sizing or restoring/removing a file', () => {
    expect(visibleHiddenChipCount([180, 90, 100], 300, 48, 4)).toBe(1);
    expect(visibleHiddenChipCount([90, 100], 300, 48, 4)).toBe(2);
    expect(visibleHiddenChipCount([90, 100], 160, 48, 4)).toBe(1);
  });
});
