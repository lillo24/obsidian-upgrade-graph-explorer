import {
  captureArgumentLibrarySnapshot,
  parseArgumentLibraryJson,
  sameSnapshot,
  serializeArgumentLibrary,
  type ArgumentLibrary,
  type ArgumentLibraryStore,
  type ArgumentLibraryStoreLoadResult,
  type ArgumentLibraryStoreSaveResult,
  type SnapshotDescriptor,
} from '@icarus-graph-explorer/argument-workspace';

import type { StorageLike } from './storage';

export const ARGUMENT_LIBRARY_BROWSER_STORAGE_KEY =
  'icarus-graph-explorer:argument-library:v1';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseStoredValue(source: string): ArgumentLibraryStoreLoadResult {
  const parsed = parseArgumentLibraryJson(source);
  if (parsed.status === 'valid') {
    return {
      status: 'loaded',
      snapshot: captureArgumentLibrarySnapshot(parsed.value),
    };
  }
  return {
    status: parsed.status === 'future-schema' ? 'future-schema' : 'corrupt',
    message: parsed.message,
    preservedValue: source,
  };
}

/** One prose-sized Argument Library per browser profile, independent of graph workspace keys. */
export function createBrowserArgumentLibraryStore(
  storage: StorageLike,
): ArgumentLibraryStore {
  const load = (): ArgumentLibraryStoreLoadResult => {
    let source: string | null;
    try {
      source = storage.getItem(ARGUMENT_LIBRARY_BROWSER_STORAGE_KEY);
    } catch (error: unknown) {
      return {
        status: 'unreadable',
        message: `Could not read the browser Argument Library: ${errorMessage(error)}`,
      };
    }
    return source === null ? { status: 'missing' } : parseStoredValue(source);
  };
  return {
    async load() {
      return load();
    },
    async save(
      library: ArgumentLibrary,
      expected: SnapshotDescriptor | 'missing',
    ): Promise<ArgumentLibraryStoreSaveResult> {
      const current = load();
      if (current.status === 'unreadable') {
        return { status: 'error', message: current.message };
      }
      if (current.status === 'corrupt' || current.status === 'future-schema') {
        return {
          status: 'error',
          message: `${current.message} Existing browser data was preserved.`,
        };
      }
      if (expected === 'missing') {
        if (current.status !== 'missing') {
          return {
            status: 'conflict',
            message:
              'The browser Argument Library was initialized by another session.',
            ...(current.status === 'loaded'
              ? { actual: current.snapshot.descriptor }
              : {}),
          };
        }
      } else if (
        current.status !== 'loaded' ||
        !sameSnapshot(current.snapshot.descriptor, expected)
      ) {
        return {
          status: 'conflict',
          message: 'The browser Argument Library changed after it was read.',
          ...(current.status === 'loaded'
            ? { actual: current.snapshot.descriptor }
            : {}),
        };
      }
      let snapshot;
      let serialized;
      try {
        snapshot = captureArgumentLibrarySnapshot(library);
        serialized = serializeArgumentLibrary(library);
        storage.setItem(ARGUMENT_LIBRARY_BROWSER_STORAGE_KEY, serialized);
      } catch (error: unknown) {
        return {
          status: 'error',
          message: `Could not save the browser Argument Library: ${errorMessage(error)}`,
        };
      }
      return { status: 'saved', snapshot };
    },
  };
}
