import {
  createEmptyArgumentLibrary,
  createTopic,
  parseArgumentLibraryJson,
} from '@icarus-graph-explorer/argument-workspace';
import { describe, expect, it } from 'vitest';

import {
  createTauriArgumentLibraryStore,
  type ArgumentLibraryTauriBridge,
} from './index';

class MemoryBridge implements ArgumentLibraryTauriBridge {
  readonly files = new Map<string, string>();
  failRename = false;

  async appLocalDataDirectory() {
    return '/app-local';
  }
  async joinPath(...parts: string[]) {
    return parts.join('/');
  }
  async dirname(path: string) {
    return path.slice(0, path.lastIndexOf('/'));
  }
  async pathExists(path: string) {
    return this.files.has(path);
  }
  async createDirectory() {}
  async readFileBytes(path: string) {
    const value = this.files.get(path);
    if (value === undefined) throw new Error('missing');
    return new TextEncoder().encode(value);
  }
  async writeTextFile(
    path: string,
    content: string,
    options?: { readonly createNew?: boolean },
  ) {
    if (options?.createNew === true && this.files.has(path))
      throw new Error('exists');
    this.files.set(path, content);
  }
  async renamePath(fromPath: string, toPath: string) {
    if (this.failRename) throw new Error('rename denied');
    const value = this.files.get(fromPath);
    if (value === undefined) throw new Error('missing temporary');
    this.files.set(toPath, value);
    this.files.delete(fromPath);
  }
  async removeFile(path: string) {
    this.files.delete(path);
  }
}

const runtime = {
  createId: (kind: string) => `${kind}-1`,
  now: () => '2026-01-01T00:00:00.000Z',
};

describe('Tauri Argument Library storage', () => {
  it('migrates a legacy file atomically and keeps the v1 source recoverable', async () => {
    const bridge = new MemoryBridge();
    const legacyPath = '/app-local/argument-workspace/library-v1.json';
    const currentPath = '/app-local/argument-workspace/library-v3.json';
    const legacy = JSON.stringify({
      schemaVersion: 1,
      libraryId: 'legacy-library',
      libraryRevision: 4,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      topics: [],
      axioms: [],
      counterArguments: [],
    });
    bridge.files.set(legacyPath, legacy);
    const store = createTauriArgumentLibraryStore({
      bridge,
      temporaryToken: () => 'migration',
    });

    const loaded = await store.load();

    expect(loaded).toMatchObject({
      status: 'loaded',
      snapshot: { library: { schemaVersion: 3, arguments: [] } },
    });
    expect(bridge.files.get(legacyPath)).toBe(legacy);
    const current = bridge.files.get(currentPath);
    expect(current).toBeTypeOf('string');
    expect(parseArgumentLibraryJson(current!)).toMatchObject({
      status: 'valid',
      value: { schemaVersion: 3, libraryId: 'legacy-library' },
    });
  });

  it('prefers and preserves a recoverable v2 file while creating v3', async () => {
    const bridge = new MemoryBridge();
    const legacyPath = '/app-local/argument-workspace/library-v2.json';
    const currentPath = '/app-local/argument-workspace/library-v3.json';
    const legacy = JSON.stringify({
      schemaVersion: 2,
      libraryId: 'legacy-v2-library',
      libraryRevision: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      topics: [],
      axioms: [],
      arguments: [],
      counterArguments: [],
    });
    bridge.files.set(legacyPath, legacy);
    const store = createTauriArgumentLibraryStore({
      bridge,
      temporaryToken: () => 'v2-migration',
    });

    expect(await store.load()).toMatchObject({
      status: 'loaded',
      snapshot: { library: { schemaVersion: 3 } },
    });
    expect(bridge.files.get(legacyPath)).toBe(legacy);
    expect(
      parseArgumentLibraryJson(bridge.files.get(currentPath)!),
    ).toMatchObject({
      status: 'valid',
      value: { schemaVersion: 3, libraryId: 'legacy-v2-library' },
    });
  });

  it('writes a validated temporary sibling and checks revisions', async () => {
    const bridge = new MemoryBridge();
    const store = createTauriArgumentLibraryStore({
      bridge,
      temporaryToken: () => 'test',
    });
    const first = createEmptyArgumentLibrary(runtime, 'library-1');
    const saved = await store.save(first, 'missing');
    expect(saved.status).toBe('saved');
    expect([...bridge.files.keys()]).toEqual([
      '/app-local/argument-workspace/library-v3.json',
    ]);
    if (saved.status !== 'saved') return;
    const second = createTopic(
      first,
      {
        id: 'topic-1',
        title: 'Neutral topic',
        summary: 'For adapter testing.',
      },
      runtime,
    );
    expect(await store.save(second, saved.snapshot.descriptor)).toMatchObject({
      status: 'saved',
    });
    expect(await store.save(first, saved.snapshot.descriptor)).toMatchObject({
      status: 'conflict',
    });
  });

  it('preserves corrupt targets and cleans up a failed temporary replacement', async () => {
    const bridge = new MemoryBridge();
    const path = '/app-local/argument-workspace/library-v1.json';
    bridge.files.set(path, '{broken');
    const store = createTauriArgumentLibraryStore({
      bridge,
      temporaryToken: () => 'test',
    });
    expect(await store.load()).toMatchObject({ status: 'corrupt' });
    expect(
      await store.save(createEmptyArgumentLibrary(runtime), 'missing'),
    ).toMatchObject({ status: 'error' });
    expect(bridge.files.get(path)).toBe('{broken');

    bridge.files.clear();
    bridge.failRename = true;
    expect(
      await store.save(createEmptyArgumentLibrary(runtime), 'missing'),
    ).toMatchObject({ status: 'error' });
    expect([...bridge.files.keys()]).toEqual([]);
  });
});
