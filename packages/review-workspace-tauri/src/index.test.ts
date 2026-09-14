import { describe, expect, it } from 'vitest';

import {
  DEFAULT_COMPILER_POLICY,
  DEFAULT_REVIEW_LIMITS,
  DEFAULT_REVIEW_TEMPLATES,
} from '@icarus-graph-explorer/ai-review';
import type {
  ReviewHistoryEntry,
  ReviewPreparationRecord,
} from '@icarus-graph-explorer/review-workspace';

import {
  createTauriReviewHistoryStore,
  type ReviewHistoryTauriBridge,
} from './index';

class MemoryBridge implements ReviewHistoryTauriBridge {
  readonly files = new Map<string, string>();
  now = 1_000;

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
    return (
      this.files.has(path) ||
      [...this.files].some(([name]) => name.startsWith(`${path}/`))
    );
  }
  async createDirectory() {}
  async listFileNames(path: string) {
    return [...this.files.keys()]
      .filter(
        (name) =>
          name.startsWith(`${path}/`) &&
          !name.slice(path.length + 1).includes('/'),
      )
      .map((name) => name.slice(path.length + 1));
  }
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
    const value = this.files.get(fromPath);
    if (value === undefined) throw new Error('missing temporary');
    this.files.set(toPath, value);
    this.files.delete(fromPath);
  }
  async removeFile(path: string) {
    this.files.delete(path);
  }
  nowMs() {
    return this.now;
  }
}

function entry(id: string): ReviewHistoryEntry {
  const preparation: ReviewPreparationRecord = {
    schemaVersion: 1,
    id,
    revision: 1,
    createdAt: '2026-09-13T08:00:00.000Z',
    updatedAt: '2026-09-13T08:00:00.000Z',
    title: id,
    workspace: { id: 'synthetic-workspace', label: 'Synthetic Vault' },
    source: {
      mode: 'supplied-material',
      selectedPaths: ['example.md'],
      materials: [
        {
          id: 'source-1',
          relativePath: 'example.md',
          kind: 'source',
          content: '# Synthetic',
          provenance: { kind: 'supplied', label: 'fixture' },
        },
      ],
      completeness: 'complete',
      missingMaterial: [],
      omissions: [],
    },
    additionalRequest: '',
    templates: DEFAULT_REVIEW_TEMPLATES,
    limits: DEFAULT_REVIEW_LIMITS,
    compilerPolicy: DEFAULT_COMPILER_POLICY,
    origin: { kind: 'duplicated-run', capturedAt: '2026-09-13T08:00:00.000Z' },
  };
  return { schemaVersion: 1, kind: 'preparation', preparation };
}

describe('Tauri review history storage', () => {
  it('uses app-local per-record files, expected fingerprints, and deletion', async () => {
    const bridge = new MemoryBridge();
    let token = 0;
    const store = createTauriReviewHistoryStore({
      bridge,
      temporaryToken: () => `token-${++token}`,
    });
    const saved = await store.save(entry('preparation-1'), 'missing');
    expect(saved.status).toBe('saved');
    expect([...bridge.files.keys()].sort()).toEqual([
      '/app-local/review-workspace-v1/index-v1.json',
      '/app-local/review-workspace-v1/records/preparation-1.json',
    ]);
    if (saved.status !== 'saved') return;
    expect(await store.save(entry('preparation-1'), 'missing')).toMatchObject({
      status: 'conflict',
    });
    expect(await store.delete('preparation-1', saved.descriptor)).toEqual({
      status: 'deleted',
    });
    expect((await store.list()).summaries).toEqual([]);
  });

  it('recovers valid neighbors when the summary index and one record are corrupt', async () => {
    const bridge = new MemoryBridge();
    let token = 0;
    const store = createTauriReviewHistoryStore({
      bridge,
      temporaryToken: () => `token-${++token}`,
    });
    await store.save(entry('preparation-good'), 'missing');
    await store.save(entry('preparation-bad'), 'missing');
    bridge.files.set('/app-local/review-workspace-v1/index-v1.json', '{broken');
    bridge.files.set(
      '/app-local/review-workspace-v1/records/preparation-bad.json',
      '{broken',
    );
    const recovered = await store.list();
    expect(recovered.status).toBe('loaded');
    expect(recovered.summaries.map(({ id }) => id)).toEqual([
      'preparation-good',
    ]);
    expect(recovered.issues).toMatchObject([
      { id: 'preparation-bad', status: 'corrupt' },
    ]);
    expect(await store.load('preparation-bad')).toMatchObject({
      status: 'corrupt',
      preservedValue: '{broken',
    });
  });
});
