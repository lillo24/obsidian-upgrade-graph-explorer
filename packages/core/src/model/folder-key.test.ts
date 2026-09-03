import { describe, expect, it } from 'vitest';

import {
  isNormalizedWorkspaceFolderKey,
  workspaceFolderKeyFromPath,
} from '../index';

describe('workspace folder keys', () => {
  it('derives root and exact nested folders', () => {
    expect(workspaceFolderKeyFromPath('Root.md')).toBe('.');
    expect(workspaceFolderKeyFromPath('one/two/Note.md')).toBe('one/two');
    expect(isNormalizedWorkspaceFolderKey('.')).toBe(true);
  });

  it.each(['/absolute.md', 'C:/absolute.md', '../outside.md', 'bad\\path.md'])(
    'rejects invalid workspace path %s',
    (path) => expect(() => workspaceFolderKeyFromPath(path)).toThrow(),
  );
});
