import {
  captureArgumentLibrarySnapshot,
  clonePlainData,
  sameSnapshot,
} from './canonical';
import { createEmptyArgumentLibrary } from './library';
import type {
  ArgumentLibrary,
  ArgumentLibraryCommitResult,
  ArgumentLibrarySnapshot,
  ArgumentLibraryStore,
  ArgumentLibraryStoreLoadResult,
  ArgumentRuntime,
  SnapshotDescriptor,
} from './types';
import { assertValidArgumentLibrary } from './validation';

export type ArgumentLibraryRepositoryOpenResult =
  | { readonly status: 'ready'; readonly snapshot: ArgumentLibrarySnapshot }
  | Exclude<ArgumentLibraryStoreLoadResult, { readonly status: 'loaded' }>;

/**
 * Serializes one profile's commits and adopts a candidate only after its store
 * confirms the write. Store implementations still perform their own expected
 * descriptor check to detect other sessions.
 */
export class ArgumentLibraryRepository {
  #confirmed?: ArgumentLibrarySnapshot;
  #queue: Promise<void> = Promise.resolve();

  constructor(private readonly store: ArgumentLibraryStore) {}

  async open(): Promise<ArgumentLibraryRepositoryOpenResult> {
    const result = await this.store.load();
    if (result.status === 'loaded') this.#confirmed = result.snapshot;
    return result.status === 'loaded'
      ? { status: 'ready', snapshot: result.snapshot }
      : result;
  }

  current(): ArgumentLibrarySnapshot | undefined {
    return this.#confirmed === undefined
      ? undefined
      : captureArgumentLibrarySnapshot(this.#confirmed.library);
  }

  async initialize(
    runtime: ArgumentRuntime,
    suppliedSeed?: ArgumentLibrary,
  ): Promise<ArgumentLibraryCommitResult> {
    const loaded = await this.store.load();
    if (loaded.status === 'loaded') {
      this.#confirmed = loaded.snapshot;
      return {
        status: 'conflict',
        message: 'Argument Library is already initialized.',
        actual: loaded.snapshot.descriptor,
      };
    }
    if (loaded.status !== 'missing') {
      return { status: 'persistence-error', message: loaded.message };
    }
    const library =
      suppliedSeed === undefined
        ? createEmptyArgumentLibrary(runtime)
        : assertValidArgumentLibrary(clonePlainData(suppliedSeed));
    const saved = await this.store.save(library, 'missing');
    if (saved.status === 'saved') {
      this.#confirmed = saved.snapshot;
      return { status: 'committed', snapshot: saved.snapshot };
    }
    return saved.status === 'conflict'
      ? {
          status: 'conflict',
          message: saved.message,
          ...(saved.actual === undefined ? {} : { actual: saved.actual }),
        }
      : { status: 'persistence-error', message: saved.message };
  }

  async reset(runtime: ArgumentRuntime): Promise<ArgumentLibraryCommitResult> {
    const confirmed = this.#confirmed;
    if (confirmed === undefined) {
      return {
        status: 'not-loaded',
        message: 'Argument Library has not been loaded.',
      };
    }
    return this.commit(confirmed.descriptor, () => {
      const replacement = createEmptyArgumentLibrary(runtime);
      if (replacement.libraryId === confirmed.library.libraryId) {
        throw new Error('Reset must create a new Argument Library lineage ID.');
      }
      return replacement;
    });
  }

  commit(
    expected: SnapshotDescriptor,
    update: (library: ArgumentLibrary) => ArgumentLibrary,
  ): Promise<ArgumentLibraryCommitResult> {
    return new Promise((resolve) => {
      this.#queue = this.#queue
        .then(async () => {
          const confirmed = this.#confirmed;
          if (confirmed === undefined) {
            resolve({
              status: 'not-loaded',
              message: 'Argument Library has not been loaded.',
            });
            return;
          }
          if (!sameSnapshot(confirmed.descriptor, expected)) {
            resolve({
              status: 'conflict',
              message: 'Expected Argument Library snapshot is stale.',
              actual: confirmed.descriptor,
            });
            return;
          }
          let candidate: ArgumentLibrary;
          try {
            candidate = assertValidArgumentLibrary(
              clonePlainData(update(clonePlainData(confirmed.library))),
            );
          } catch (error: unknown) {
            resolve({
              status: 'persistence-error',
              message: error instanceof Error ? error.message : String(error),
            });
            return;
          }
          const candidateSnapshot = captureArgumentLibrarySnapshot(candidate);
          if (
            sameSnapshot(candidateSnapshot.descriptor, confirmed.descriptor)
          ) {
            resolve({ status: 'committed', snapshot: confirmed });
            return;
          }
          const saved = await this.store.save(candidate, confirmed.descriptor);
          if (saved.status === 'saved') {
            this.#confirmed = saved.snapshot;
            resolve({ status: 'committed', snapshot: saved.snapshot });
          } else if (saved.status === 'conflict') {
            resolve({
              status: 'conflict',
              message: saved.message,
              ...(saved.actual === undefined ? {} : { actual: saved.actual }),
            });
          } else {
            resolve({ status: 'persistence-error', message: saved.message });
          }
        })
        .catch((error: unknown) => {
          resolve({
            status: 'persistence-error',
            message: error instanceof Error ? error.message : String(error),
          });
        });
    });
  }
}
