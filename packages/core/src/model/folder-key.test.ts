import { describe, expect, it } from 'vitest';

import {
  isNormalizedWorkspaceFolderKey,
  workspaceFolderKeyContainsFolder,
  workspaceFolderKeyFromPath,
} from '../index';

describe('workspace folder keys', () => {
  it('derives root and exact nested folders', () => {
    expect(workspaceFolderKeyFromPath('Root.md')).toBe('.');
    expect(workspaceFolderKeyFromPath('one/two/Note.md')).toBe('one/two');
    expect(isNormalizedWorkspaceFolderKey('.')).toBe(true);
  });

  it('tests exact path-segment subtree membership including root', () => {
    expect(workspaceFolderKeyContainsFolder('Theory', 'Theory')).toBe(true);
    expect(workspaceFolderKeyContainsFolder('Theory', 'Theory/Sub')).toBe(true);
    expect(workspaceFolderKeyContainsFolder('Theory', 'Theory-old')).toBe(
      false,
    );
    expect(workspaceFolderKeyContainsFolder('Theory', 'Archive/Theory')).toBe(
      false,
    );
    expect(workspaceFolderKeyContainsFolder('.', 'Any/Folder')).toBe(true);
  });

  it.each(['/absolute.md', 'C:/absolute.md', '../outside.md', 'bad\\path.md'])(
    'rejects invalid workspace path %s',
    (path) => expect(() => workspaceFolderKeyFromPath(path)).toThrow(),
  );
});
