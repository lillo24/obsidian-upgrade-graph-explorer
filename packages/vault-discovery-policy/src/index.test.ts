import { describe, expect, it } from 'vitest';

import {
  isDiscoveryPathExcluded,
  isMarkdownWorkspacePath,
  normalizeDiscoveryExclude,
  shouldSkipVaultEntry,
  workspacePathFromSegments,
} from './index';

describe('vault discovery policy', () => {
  it('normalizes conservative relative excludes', () => {
    expect(normalizeDiscoveryExclude('.\\Archive\\')).toBe('Archive');
    expect(isDiscoveryPathExcluded('Archive/A.md', ['Archive'])).toBe(true);
    expect(isDiscoveryPathExcluded('Archived/A.md', ['Archive'])).toBe(false);
    for (const invalid of ['', '..', '../A', '/A', 'C:\\A', 'A//B']) {
      expect(() => normalizeDiscoveryExclude(invalid)).toThrow();
    }
  });

  it('shares hidden, node_modules, Markdown, and safe-segment rules', () => {
    expect(shouldSkipVaultEntry('.obsidian', true)).toBe(true);
    expect(shouldSkipVaultEntry('node_modules', true)).toBe(true);
    expect(shouldSkipVaultEntry('node_modules.md', false)).toBe(false);
    expect(isMarkdownWorkspacePath('Folder/NOTE.MD')).toBe(true);
    expect(workspacePathFromSegments(['Folder', 'A.md'])).toBe('Folder/A.md');
    expect(() => workspacePathFromSegments(['Folder', '..'])).toThrow();
  });
});
