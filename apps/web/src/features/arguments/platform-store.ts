import type {
  ArgumentLibraryStore,
  ArgumentLibraryStoreLoadResult,
  ArgumentLibraryStoreSaveResult,
} from '@icarus-graph-explorer/argument-workspace';

import { createBrowserArgumentLibraryStore } from '../../persistence/argument-library';
import { browserStorage, type StorageLike } from '../../persistence/storage';

function unavailableStore(message: string): ArgumentLibraryStore {
  return {
    async load(): Promise<ArgumentLibraryStoreLoadResult> {
      return { status: 'unreadable', message };
    },
    async save(): Promise<ArgumentLibraryStoreSaveResult> {
      return { status: 'error', message };
    },
  };
}

function isTauriRuntime(): boolean {
  return Reflect.has(globalThis, '__TAURI_INTERNALS__');
}

/**
 * Resolves the platform once, on first access. Desktop storage remains in the
 * app-local Argument Workspace directory; browser storage remains profile-level.
 */
export function createPlatformArgumentLibraryStore(
  storage: StorageLike | null | undefined = browserStorage(),
): ArgumentLibraryStore {
  let selected: Promise<ArgumentLibraryStore> | undefined;
  const resolve = () => {
    selected ??= isTauriRuntime()
      ? import('@icarus-graph-explorer/argument-workspace-tauri').then(
          ({ createTauriArgumentLibraryStore }) =>
            createTauriArgumentLibraryStore(),
        )
      : Promise.resolve(
          storage === undefined || storage === null
            ? unavailableStore(
                'Browser storage is unavailable. The Argument Library was not opened.',
              )
            : createBrowserArgumentLibraryStore(storage),
        );
    return selected;
  };
  return {
    async load() {
      return (await resolve()).load();
    },
    async save(library, expected) {
      return (await resolve()).save(library, expected);
    },
  };
}
