import { describe, expect, it } from 'vitest';

import {
  isNormalizedWorkspaceFolderKey,
  workspaceFolderKeyFromPath,
} from './folder-key';

describe('exact workspace folder keys', () => {
  it.each([
    ['File.md', '.'],
    ['Theory/File.md', 'Theory'],
    ['Theory/Language/File.md', 'Theory/Language'],
  ])('derives %s as %s', (path, expected) => {
    expect(workspaceFolderKeyFromPath(path)).toBe(expected);
    expect(isNormalizedWorkspaceFolderKey(expected)).toBe(true);
  });

  it.each(['', '/a', 'a/', 'a\\b', 'C:/a', 'a//b', '..', 'a/../b', './a'])(
    'rejects invalid key %j',
    (key) => expect(isNormalizedWorkspaceFolderKey(key)).toBe(false),
  );

  it('rejects invalid document paths before deriving a folder', () => {
    expect(() => workspaceFolderKeyFromPath('/absolute.md')).toThrow(
      'invalid workspace path',
    );
  });
});
