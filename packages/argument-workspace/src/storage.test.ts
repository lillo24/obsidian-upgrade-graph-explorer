import { describe, expect, it } from 'vitest';

import {
  captureArgumentLibrarySnapshot,
  clonePlainData,
  sameSnapshot,
} from './canonical';
import { ArgumentLibraryAuthoringService } from './authoring';
import { createEmptyArgumentLibrary } from './library';
import { ArgumentLibraryRepository } from './storage';
import {
  createNeutralArgumentLibrary,
  deterministicRuntime,
} from './test-fixture';
import type {
  ArgumentLibrary,
  ArgumentLibraryStore,
  ArgumentLibraryStoreSaveResult,
  SnapshotDescriptor,
} from './types';

class MemoryStore implements ArgumentLibraryStore {
  value?: ArgumentLibrary;
  failSave = false;
  writes = 0;
  release?: () => void;

  async load() {
    return this.value === undefined
      ? ({ status: 'missing' } as const)
      : ({
          status: 'loaded',
          snapshot: captureArgumentLibrarySnapshot(this.value),
        } as const);
  }

  async save(
    library: ArgumentLibrary,
    expected: SnapshotDescriptor | 'missing',
  ): Promise<ArgumentLibraryStoreSaveResult> {
    if (this.release !== undefined) {
      const pendingRelease = this.release;
      await new Promise<void>((resolve) => {
        this.release = () => {
          pendingRelease();
          resolve();
        };
      });
    }
    if (this.failSave) return { status: 'error', message: 'disk full' };
    if (expected === 'missing') {
      if (this.value !== undefined)
        return { status: 'conflict', message: 'already exists' };
    } else if (
      this.value === undefined ||
      !sameSnapshot(
        captureArgumentLibrarySnapshot(this.value).descriptor,
        expected,
      )
    ) {
      return { status: 'conflict', message: 'stale' };
    }
    this.writes += 1;
    this.value = clonePlainData(library);
    return {
      status: 'saved',
      snapshot: captureArgumentLibrarySnapshot(library),
    };
  }
}

describe('Argument Library repository', () => {
  it('initializes a supplied validated seed once and never reseeds an intentional reset', async () => {
    const store = new MemoryStore();
    const repository = new ArgumentLibraryRepository(store);
    const runtime = deterministicRuntime('repo');
    const initialized = await repository.initialize(
      runtime,
      createNeutralArgumentLibrary(),
    );
    expect(initialized.status).toBe('committed');
    expect(
      (await repository.initialize(runtime, createNeutralArgumentLibrary()))
        .status,
    ).toBe('conflict');
    const reset = await repository.reset(runtime);
    expect(reset.status).toBe('committed');
    expect(store.value).toMatchObject({
      topics: [],
      axioms: [],
      counterArguments: [],
    });

    const reopened = new ArgumentLibraryRepository(store);
    expect(
      await reopened.initialize(runtime, createNeutralArgumentLibrary()),
    ).toMatchObject({
      status: 'conflict',
    });
    expect(store.value?.topics).toEqual([]);
  });

  it('keeps the last confirmed snapshot after a failed save', async () => {
    const store = new MemoryStore();
    store.value = createNeutralArgumentLibrary();
    const repository = new ArgumentLibraryRepository(store);
    const opened = await repository.open();
    expect(opened.status).toBe('ready');
    if (opened.status !== 'ready') return;
    const before = repository.current()!;
    store.failSave = true;
    const authoring = new ArgumentLibraryAuthoringService(
      repository,
      deterministicRuntime('fail'),
    );
    expect(
      await authoring.editTopic(opened.snapshot.descriptor, 'T-NEUTRAL', {
        title: 'Not adopted',
      }),
    ).toMatchObject({ status: 'persistence-error', message: 'disk full' });
    expect(repository.current()).toEqual(before);
    expect(store.value?.topics[0]?.title).toBe('Measurement Boundaries');
  });

  it('serializes overlapping commits and rejects the stale second expectation', async () => {
    const store = new MemoryStore();
    store.value = createNeutralArgumentLibrary();
    const repository = new ArgumentLibraryRepository(store);
    const opened = await repository.open();
    if (opened.status !== 'ready')
      throw new Error('Expected ready repository.');
    const authoring = new ArgumentLibraryAuthoringService(
      repository,
      deterministicRuntime('queue'),
    );
    const first = authoring.editTopic(opened.snapshot.descriptor, 'T-NEUTRAL', {
      title: 'First edit',
    });
    const second = authoring.editTopic(
      opened.snapshot.descriptor,
      'T-NEUTRAL',
      { title: 'Second edit' },
    );
    expect((await first).status).toBe('committed');
    expect(await second).toMatchObject({ status: 'conflict' });
    expect(repository.current()?.library.topics[0]?.title).toBe('First edit');
    expect(store.writes).toBe(1);
  });

  it('treats an identical JSON import as a no-write idempotent commit', async () => {
    const store = new MemoryStore();
    store.value = createNeutralArgumentLibrary();
    const repository = new ArgumentLibraryRepository(store);
    const opened = await repository.open();
    if (opened.status !== 'ready')
      throw new Error('Expected ready repository.');
    const authoring = new ArgumentLibraryAuthoringService(
      repository,
      deterministicRuntime('idempotent'),
    );
    expect(
      await authoring.mergeImport(
        opened.snapshot.descriptor,
        clonePlainData(store.value),
      ),
    ).toMatchObject({ status: 'committed', snapshot: opened.snapshot });
    expect(store.writes).toBe(0);
  });

  it('distinguishes a genuinely missing store from corrupt and unreadable states', async () => {
    const states = ['corrupt', 'future-schema', 'unreadable'] as const;
    for (const status of states) {
      const store: ArgumentLibraryStore = {
        async load() {
          return { status, message: status, preservedValue: 'raw' };
        },
        async save() {
          throw new Error('must not save');
        },
      };
      const repository = new ArgumentLibraryRepository(store);
      expect(
        await repository.initialize(
          deterministicRuntime(),
          createNeutralArgumentLibrary(),
        ),
      ).toEqual({
        status: 'persistence-error',
        message: status,
      });
    }
  });

  it('creates an explicitly empty initialized library when no seed is supplied', async () => {
    const store = new MemoryStore();
    const repository = new ArgumentLibraryRepository(store);
    const result = await repository.initialize(deterministicRuntime('empty'));
    expect(result.status).toBe('committed');
    expect(store.value).toEqual(expect.objectContaining({ topics: [] }));
    expect(store.value).toEqual(
      expect.objectContaining(
        createEmptyArgumentLibrary(
          {
            createId: () => store.value!.libraryId,
            now: () => store.value!.createdAt,
          },
          store.value!.libraryId,
        ),
      ),
    );
  });
});
