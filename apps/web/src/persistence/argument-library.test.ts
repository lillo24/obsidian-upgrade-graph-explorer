import {
  createEmptyArgumentLibrary,
  createTopic,
  type ArgumentRuntime,
} from '@icarus-graph-explorer/argument-workspace';
import { describe, expect, it } from 'vitest';

import {
  ARGUMENT_LIBRARY_BROWSER_STORAGE_KEY,
  createBrowserArgumentLibraryStore,
} from './argument-library';
import type { StorageLike } from './storage';

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failWrite = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.failWrite) throw new Error('quota exceeded');
    this.values.set(key, value);
  }
}

function runtime(): ArgumentRuntime {
  let tick = 0;
  return {
    createId: (kind) => `${kind}-${++tick}`,
    now: () => `2026-01-01T00:00:${String(tick++).padStart(2, '0')}.000Z`,
  };
}

describe('browser Argument Library storage', () => {
  it('uses one profile key and checks the expected snapshot', async () => {
    const storage = new MemoryStorage();
    const store = createBrowserArgumentLibraryStore(storage);
    const first = createEmptyArgumentLibrary(runtime(), 'library-1');

    expect(await store.load()).toEqual({ status: 'missing' });
    const initialized = await store.save(first, 'missing');
    expect(initialized.status).toBe('saved');
    expect([...storage.values.keys()]).toEqual([
      ARGUMENT_LIBRARY_BROWSER_STORAGE_KEY,
    ]);
    if (initialized.status !== 'saved') return;

    const second = createTopic(
      first,
      { id: 'topic-1', title: 'Limits', summary: 'A neutral test topic.' },
      runtime(),
    );
    expect(
      await store.save(second, initialized.snapshot.descriptor),
    ).toMatchObject({
      status: 'saved',
    });
    expect(
      await store.save(first, initialized.snapshot.descriptor),
    ).toMatchObject({
      status: 'conflict',
    });
  });

  it('preserves malformed values and reports failed writes', async () => {
    const storage = new MemoryStorage();
    storage.values.set(ARGUMENT_LIBRARY_BROWSER_STORAGE_KEY, '{broken');
    const store = createBrowserArgumentLibraryStore(storage);

    expect(await store.load()).toMatchObject({ status: 'corrupt' });
    expect(
      await store.save(createEmptyArgumentLibrary(runtime()), 'missing'),
    ).toMatchObject({
      status: 'error',
    });
    expect(storage.values.get(ARGUMENT_LIBRARY_BROWSER_STORAGE_KEY)).toBe(
      '{broken',
    );

    storage.values.clear();
    storage.failWrite = true;
    expect(
      await store.save(createEmptyArgumentLibrary(runtime()), 'missing'),
    ).toMatchObject({
      status: 'error',
      message: expect.stringContaining('quota exceeded'),
    });
  });
});
