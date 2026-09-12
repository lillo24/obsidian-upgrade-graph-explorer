import { appLocalDataDir, dirname, join } from '@tauri-apps/api/path';
import {
  exists,
  mkdir,
  readFile,
  remove,
  rename,
  writeTextFile,
} from '@tauri-apps/plugin-fs';
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

export interface ArgumentLibraryTauriBridge {
  appLocalDataDirectory(): Promise<string>;
  joinPath(...parts: string[]): Promise<string>;
  dirname(path: string): Promise<string>;
  pathExists(path: string): Promise<boolean>;
  createDirectory(path: string): Promise<void>;
  readFileBytes(path: string): Promise<Uint8Array>;
  writeTextFile(
    path: string,
    content: string,
    options?: { readonly createNew?: boolean },
  ): Promise<void>;
  renamePath(fromPath: string, toPath: string): Promise<void>;
  removeFile(path: string): Promise<void>;
}

function nativeBridge(): ArgumentLibraryTauriBridge {
  return {
    appLocalDataDirectory: appLocalDataDir,
    joinPath: (...parts) => join(...parts),
    dirname,
    pathExists: exists,
    createDirectory: (path) => mkdir(path, { recursive: true }),
    readFileBytes: readFile,
    writeTextFile: (path, content, options) =>
      writeTextFile(path, content, {
        ...(options?.createNew === undefined
          ? {}
          : { createNew: options.createNew }),
      }),
    renamePath: rename,
    removeFile: (path) => remove(path),
  };
}

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

async function libraryPath(
  bridge: ArgumentLibraryTauriBridge,
): Promise<string> {
  return bridge.joinPath(
    await bridge.appLocalDataDirectory(),
    'argument-workspace',
    'library-v1.json',
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadAt(
  bridge: ArgumentLibraryTauriBridge,
  path: string,
): Promise<ArgumentLibraryStoreLoadResult> {
  try {
    if (!(await bridge.pathExists(path))) return { status: 'missing' };
    const source = UTF8_DECODER.decode(await bridge.readFileBytes(path));
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
  } catch (error: unknown) {
    return {
      status: 'unreadable',
      message: `Could not read the private Argument Library: ${message(error)}`,
    };
  }
}

async function writeAtomically(
  bridge: ArgumentLibraryTauriBridge,
  path: string,
  source: string,
  token: string,
): Promise<void> {
  const directory = await bridge.dirname(path);
  await bridge.createDirectory(directory);
  const temporaryPath = `${path}.${encodeURIComponent(token)}.tmp`;
  try {
    await bridge.writeTextFile(temporaryPath, source, { createNew: true });
    await bridge.renamePath(temporaryPath, path);
  } catch (error: unknown) {
    try {
      if (await bridge.pathExists(temporaryPath))
        await bridge.removeFile(temporaryPath);
    } catch (cleanupError: unknown) {
      throw new AggregateError(
        [error, cleanupError],
        'Argument Library replacement and temporary-file cleanup both failed.',
        { cause: cleanupError },
      );
    }
    throw new Error('Could not safely replace the private Argument Library.', {
      cause: error,
    });
  }
}

export interface CreateTauriArgumentLibraryStoreOptions {
  readonly bridge?: ArgumentLibraryTauriBridge;
  readonly temporaryToken?: () => string;
}

/** Dedicated app-local JSON storage; it never reads or writes the selected vault. */
export function createTauriArgumentLibraryStore(
  options: CreateTauriArgumentLibraryStoreOptions = {},
): ArgumentLibraryStore {
  const bridge = options.bridge ?? nativeBridge();
  const token =
    options.temporaryToken ??
    (() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  return {
    async load() {
      return loadAt(bridge, await libraryPath(bridge));
    },
    async save(
      library: ArgumentLibrary,
      expected: SnapshotDescriptor | 'missing',
    ): Promise<ArgumentLibraryStoreSaveResult> {
      const path = await libraryPath(bridge);
      const current = await loadAt(bridge, path);
      if (
        current.status === 'unreadable' ||
        current.status === 'corrupt' ||
        current.status === 'future-schema'
      ) {
        return {
          status: 'error',
          message: `${current.message} Existing private data was preserved.`,
        };
      }
      if (expected === 'missing') {
        if (current.status !== 'missing') {
          return {
            status: 'conflict',
            message:
              'The private Argument Library was initialized by another session.',
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
          message: 'The private Argument Library changed after it was read.',
          ...(current.status === 'loaded'
            ? { actual: current.snapshot.descriptor }
            : {}),
        };
      }
      let snapshot;
      try {
        snapshot = captureArgumentLibrarySnapshot(library);
        await writeAtomically(
          bridge,
          path,
          serializeArgumentLibrary(library),
          token(),
        );
      } catch (error: unknown) {
        return { status: 'error', message: message(error) };
      }
      return { status: 'saved', snapshot };
    },
  };
}
