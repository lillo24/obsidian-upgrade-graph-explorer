import { describe, expect, it, vi } from 'vitest';

import {
  saveMarkdownDirectory,
  type SelectedDirectoryHandle,
} from './markdown-directory-export';

describe('Markdown directory export', () => {
  it('preserves safe directory layout under an explicitly selected root', async () => {
    const writes = new Map<string, string>();
    const directory = (prefix: string): SelectedDirectoryHandle => ({
      getDirectoryHandle: async (name) => directory(`${prefix}${name}/`),
      getFileHandle: async (name) => ({
        createWritable: async () => ({
          write: async (value) => {
            writes.set(`${prefix}${name}`, value);
          },
          close: async () => undefined,
        }),
      }),
    });
    const picker = vi.fn(async () => directory(''));

    expect(
      await saveMarkdownDirectory(
        [
          { path: 'topics/Topic--T.md', text: '# Topic\n' },
          { path: 'axioms/Axiom--AX.md', text: '# Axiom\n' },
        ],
        picker,
      ),
    ).toBe(2);
    expect(writes).toEqual(
      new Map([
        ['topics/Topic--T.md', '# Topic\n'],
        ['axioms/Axiom--AX.md', '# Axiom\n'],
      ]),
    );
  });

  it('rejects traversal and absolute paths before writing a file', async () => {
    const getFileHandle = vi.fn();
    const root: SelectedDirectoryHandle = {
      getDirectoryHandle: async () => root,
      getFileHandle,
    };
    await expect(
      saveMarkdownDirectory(
        [{ path: '../private.md', text: 'no' }],
        async () => root,
      ),
    ).rejects.toThrow(/unsafe/i);
    expect(getFileHandle).not.toHaveBeenCalled();
  });
});
