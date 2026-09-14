import { describe, expect, it } from 'vitest';

import { ARGUMENT_LIBRARY_BROWSER_STORAGE_KEY } from '../../persistence/argument-library';
import { createPlatformArgumentLibraryStore } from './platform-store';

describe('Argument Workspace platform store', () => {
  it('uses the profile browser adapter when no Tauri runtime is present', async () => {
    const values = new Map<string, string>();
    const store = createPlatformArgumentLibraryStore({
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    });

    expect(await store.load()).toEqual({ status: 'missing' });
    expect(values.has(ARGUMENT_LIBRARY_BROWSER_STORAGE_KEY)).toBe(false);
  });

  it('reports unavailable browser storage as unreadable rather than initializing data', async () => {
    const store = createPlatformArgumentLibraryStore(null);
    await expect(store.load()).resolves.toMatchObject({
      status: 'unreadable',
      message: expect.stringMatching(/storage is unavailable/i),
    });
  });
});
