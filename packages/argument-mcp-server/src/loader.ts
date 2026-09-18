import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  captureArgumentLibrarySnapshot,
  createKnowledgeReader,
  parseArgumentLibraryJson,
  sameSnapshot,
  serializeArgumentLibrary,
  type ArgumentLibrary,
  type ArgumentLibrarySnapshot,
  type ArgumentLibraryStore,
  type ArgumentLibraryStoreLoadResult,
  type ArgumentLibraryStoreSaveResult,
  type KnowledgeReader,
  type SnapshotDescriptor,
} from '@icarus-graph-explorer/argument-workspace';

export const ARGUMENT_LIBRARY_PATH_ENV = 'ICARUS_ARGUMENT_LIBRARY_PATH';
export const DEFAULT_MAX_LIBRARY_BYTES = 64 * 1024 * 1024;

const APP_IDENTIFIER = 'com.icarus.graph-explorer';
const LIBRARY_PARTS = [
  APP_IDENTIFIER,
  'argument-workspace',
  'library-v5.json',
] as const;

type Environment = Readonly<Record<string, string | undefined>>;

export type LibraryPathResolution =
  | { readonly status: 'resolved'; readonly path: string }
  | {
      readonly status: 'configuration-error';
      readonly message: string;
    };

export type LibraryLoadErrorCode =
  | 'configuration-unavailable'
  | 'library-missing'
  | 'library-unreadable'
  | 'library-too-large'
  | 'invalid-utf8'
  | 'invalid-json'
  | 'invalid-library'
  | 'future-schema';

export type LibraryLoadResult =
  | {
      readonly status: 'loaded';
      readonly library: ArgumentLibrary;
      readonly snapshot: ArgumentLibrarySnapshot;
      readonly reader: KnowledgeReader;
    }
  | {
      readonly status: 'error';
      readonly code: LibraryLoadErrorCode;
      readonly message: string;
    };

export interface ResolveLibraryPathOptions {
  readonly env?: Environment;
  readonly platform?: NodeJS.Platform;
  readonly homeDirectory?: string;
  readonly workingDirectory?: string;
}

export interface ArgumentLibraryLoaderOptions extends ResolveLibraryPathOptions {
  readonly libraryPath?: string;
  readonly maxLibraryBytes?: number;
}

function configuredValue(
  env: Environment,
  name: string,
):
  | { readonly present: false }
  | { readonly present: true; readonly value: string | undefined } {
  return Object.hasOwn(env, name)
    ? { present: true, value: env[name] }
    : { present: false };
}

function absoluteConfiguredPath(
  value: string,
  workingDirectory: string,
): string {
  return isAbsolute(value) ? value : resolve(workingDirectory, value);
}

export function resolveArgumentLibraryPath(
  options: ResolveLibraryPathOptions = {},
): LibraryPathResolution {
  const env = options.env ?? process.env;
  const configured = configuredValue(env, ARGUMENT_LIBRARY_PATH_ENV);
  if (configured.present) {
    const value = configured.value?.trim();
    if (value === undefined || value === '') {
      return {
        status: 'configuration-error',
        message: `${ARGUMENT_LIBRARY_PATH_ENV} must be a non-empty file path.`,
      };
    }
    return {
      status: 'resolved',
      path: absoluteConfiguredPath(
        value,
        options.workingDirectory ?? process.cwd(),
      ),
    };
  }

  const platform = options.platform ?? process.platform;
  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA?.trim();
    if (localAppData !== undefined && localAppData !== '') {
      return { status: 'resolved', path: join(localAppData, ...LIBRARY_PARTS) };
    }
  } else if (platform === 'darwin') {
    const home = options.homeDirectory ?? homedir();
    if (home !== '') {
      return {
        status: 'resolved',
        path: join(home, 'Library', 'Application Support', ...LIBRARY_PARTS),
      };
    }
  } else if (platform === 'linux') {
    const xdgDataHome = env.XDG_DATA_HOME?.trim();
    if (xdgDataHome !== undefined && xdgDataHome !== '') {
      return { status: 'resolved', path: join(xdgDataHome, ...LIBRARY_PARTS) };
    }
    const home = options.homeDirectory ?? homedir();
    if (home !== '') {
      return {
        status: 'resolved',
        path: join(home, '.local', 'share', ...LIBRARY_PARTS),
      };
    }
  }

  return {
    status: 'configuration-error',
    message: `The Argument Library location could not be derived. Set ${ARGUMENT_LIBRARY_PATH_ENV}.`,
  };
}

function fileErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}

function fixedLoadError(
  code: LibraryLoadErrorCode,
  message: string,
): LibraryLoadResult {
  return { status: 'error', code, message };
}

export class ArgumentLibraryLoader {
  readonly #path: LibraryPathResolution;
  readonly #legacyPath: string | undefined;
  readonly #maxLibraryBytes: number;

  public constructor(options: ArgumentLibraryLoaderOptions = {}) {
    this.#path =
      options.libraryPath === undefined
        ? resolveArgumentLibraryPath(options)
        : {
            status: 'resolved',
            path: absoluteConfiguredPath(
              options.libraryPath,
              options.workingDirectory ?? process.cwd(),
            ),
          };
    this.#legacyPath =
      options.libraryPath === undefined && this.#path.status === 'resolved'
        ? join(dirname(this.#path.path), 'library-v4.json')
        : undefined;
    this.#maxLibraryBytes =
      options.maxLibraryBytes ?? DEFAULT_MAX_LIBRARY_BYTES;
    if (
      !Number.isSafeInteger(this.#maxLibraryBytes) ||
      this.#maxLibraryBytes < 1
    ) {
      throw new Error('maxLibraryBytes must be a positive safe integer.');
    }
  }

  public async load(): Promise<LibraryLoadResult> {
    if (this.#path.status === 'configuration-error') {
      return fixedLoadError('configuration-unavailable', this.#path.message);
    }

    let handle;
    try {
      handle = await open(this.#path.path, 'r');
    } catch (error: unknown) {
      let openError = error;
      if (fileErrorCode(error) === 'ENOENT' && this.#legacyPath !== undefined) {
        try {
          handle = await open(this.#legacyPath, 'r');
        } catch (legacyError: unknown) {
          openError = legacyError;
        }
      }
      if (handle !== undefined) {
        // Continue with the recoverable prior-version file.
      } else {
        return fileErrorCode(openError) === 'ENOENT'
          ? fixedLoadError(
              'library-missing',
              `The Argument Library file is missing. Set ${ARGUMENT_LIBRARY_PATH_ENV} if Graph Explorer uses a different location.`,
            )
          : fixedLoadError(
              'library-unreadable',
              'The Argument Library file could not be opened for reading.',
            );
      }
    }
    if (handle === undefined) {
      return fixedLoadError(
        'library-unreadable',
        'The Argument Library file could not be opened for reading.',
      );
    }

    let bytes: Uint8Array;
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile()) {
        return fixedLoadError(
          'library-unreadable',
          'The configured Argument Library location is not a regular file.',
        );
      }
      if (metadata.size > this.#maxLibraryBytes) {
        return fixedLoadError(
          'library-too-large',
          `The Argument Library exceeds the ${this.#maxLibraryBytes}-byte read limit.`,
        );
      }
      bytes = await handle.readFile();
      if (bytes.byteLength > this.#maxLibraryBytes) {
        return fixedLoadError(
          'library-too-large',
          `The Argument Library exceeds the ${this.#maxLibraryBytes}-byte read limit.`,
        );
      }
    } catch {
      return fixedLoadError(
        'library-unreadable',
        'The Argument Library file could not be read.',
      );
    } finally {
      await handle.close().catch(() => undefined);
    }

    let source: string;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return fixedLoadError(
        'invalid-utf8',
        'The Argument Library is not valid UTF-8.',
      );
    }

    const parsed = parseArgumentLibraryJson(source);
    if (parsed.status !== 'valid') {
      const code = parsed.status;
      const message =
        code === 'invalid-json'
          ? 'The Argument Library is not valid JSON.'
          : code === 'future-schema'
            ? 'The Argument Library uses an unsupported future schema version.'
            : 'The Argument Library does not satisfy the schema-v5 contract.';
      return fixedLoadError(code, message);
    }

    const snapshot = captureArgumentLibrarySnapshot(parsed.value);
    return {
      status: 'loaded',
      library: snapshot.library,
      snapshot,
      reader: createKnowledgeReader(snapshot),
    };
  }

  public store(): ArgumentLibraryStore {
    return {
      load: async (): Promise<ArgumentLibraryStoreLoadResult> => {
        const result = await this.load();
        if (result.status === 'loaded') {
          return { status: 'loaded', snapshot: result.snapshot };
        }
        if (result.code === 'library-missing') return { status: 'missing' };
        if (result.code === 'future-schema') {
          return { status: 'future-schema', message: result.message };
        }
        if (
          result.code === 'invalid-json' ||
          result.code === 'invalid-library' ||
          result.code === 'invalid-utf8'
        ) {
          return { status: 'corrupt', message: result.message };
        }
        return { status: 'unreadable', message: result.message };
      },
      save: (library, expected) => this.#save(library, expected),
    };
  }

  async #save(
    library: ArgumentLibrary,
    expected: SnapshotDescriptor | 'missing',
  ): Promise<ArgumentLibraryStoreSaveResult> {
    if (this.#path.status === 'configuration-error') {
      return { status: 'error', message: this.#path.message };
    }
    const current = await this.store().load();
    if (
      current.status === 'unreadable' ||
      current.status === 'corrupt' ||
      current.status === 'future-schema'
    ) {
      return {
        status: 'error',
        message: `${current.message} Existing data was preserved.`,
      };
    }
    if (expected === 'missing') {
      if (current.status !== 'missing') {
        return {
          status: 'conflict',
          message: 'The Argument Library was initialized by another session.',
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
        message: 'The Argument Library changed after it was read.',
        ...(current.status === 'loaded'
          ? { actual: current.snapshot.descriptor }
          : {}),
      };
    }

    let source: string;
    let snapshot: ArgumentLibrarySnapshot;
    try {
      source = serializeArgumentLibrary(library);
      snapshot = captureArgumentLibrarySnapshot(library);
    } catch (error: unknown) {
      return {
        status: 'error',
        message: `Could not serialize the Argument Library: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
    if (Buffer.byteLength(source, 'utf8') > this.#maxLibraryBytes) {
      return {
        status: 'error',
        message: `The Argument Library exceeds the ${this.#maxLibraryBytes}-byte write limit.`,
      };
    }
    const temporaryPath = `${this.#path.path}.${process.pid}-${randomUUID()}.tmp`;
    try {
      await mkdir(dirname(this.#path.path), { recursive: true });
      await writeFile(temporaryPath, source, { encoding: 'utf8', flag: 'wx' });
      await rename(temporaryPath, this.#path.path);
    } catch (error: unknown) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      return {
        status: 'error',
        message: `Could not safely replace the Argument Library: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
    return { status: 'saved', snapshot };
  }
}
