import {
  appLocalDataDir,
  basename,
  dirname,
  isAbsolute,
  join,
  normalize,
} from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import {
  exists,
  lstat,
  mkdir,
  readDir,
  readFile,
  remove,
  rename,
  watchImmediate,
  writeTextFile,
  type WatchEvent,
} from '@tauri-apps/plugin-fs';

export type NativeWatchCategory =
  'access' | 'create' | 'modify' | 'remove' | 'rename' | 'other';

export interface NativeWatchEvent {
  readonly category: NativeWatchCategory;
  readonly paths: readonly string[];
  readonly requiresResync: boolean;
}

export interface NativeDirectoryEntry {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly isFile: boolean;
  readonly isSymlink: boolean;
}

export interface NativeFileInfo {
  readonly isDirectory: boolean;
  readonly isFile: boolean;
  readonly isSymlink: boolean;
}

export interface TauriNativeBridge {
  selectDirectory(): Promise<string | undefined>;
  readDirectory(path: string): Promise<readonly NativeDirectoryEntry[]>;
  readFileBytes(path: string): Promise<Uint8Array>;
  inspectPath(path: string): Promise<NativeFileInfo>;
  watchDirectory(
    path: string,
    listener: (event: NativeWatchEvent) => void,
  ): Promise<() => void>;
  appLocalDataDirectory(): Promise<string>;
  basename(path: string): Promise<string>;
  dirname(path: string): Promise<string>;
  isAbsolute(path: string): Promise<boolean>;
  joinPath(...parts: string[]): Promise<string>;
  normalizePath(path: string): Promise<string>;
  createDirectory(path: string): Promise<void>;
  pathExists(path: string): Promise<boolean>;
  writeTextFile(
    path: string,
    content: string,
    options?: { readonly createNew?: boolean },
  ): Promise<void>;
  renamePath(fromPath: string, toPath: string): Promise<void>;
  removeFile(path: string): Promise<void>;
}

function watchCategory(event: WatchEvent): NativeWatchCategory {
  if (typeof event.type === 'string') return 'other';
  if ('access' in event.type) return 'access';
  if ('create' in event.type) return 'create';
  if ('remove' in event.type) return 'remove';
  if ('modify' in event.type) {
    if (
      event.type.modify.kind === 'metadata' &&
      event.type.modify.mode === 'access-time'
    ) {
      return 'access';
    }
    return event.type.modify.kind === 'rename' ? 'rename' : 'modify';
  }
  return 'other';
}

function requestsResync(event: WatchEvent): boolean {
  if (event.type === 'any' && event.paths.length === 0) return true;
  if (event.type === 'other' && event.paths.length === 0) return true;
  if (typeof event.attrs !== 'object' || event.attrs === null) return false;
  const flag = Reflect.get(event.attrs, 'flag');
  return flag === 'rescan' || flag === 'Rescan';
}

export function createTauriNativeBridge(): TauriNativeBridge {
  return {
    async selectDirectory() {
      const selected = await open({
        directory: true,
        multiple: false,
        // Tauri's dialog scope is non-recursive by default. KG11A traverses
        // only the explicitly selected root, so authorize its descendants for
        // this process without adding any static home/drive scope.
        recursive: true,
        title: 'Open Markdown Vault',
      });
      return selected ?? undefined;
    },
    readDirectory: (path) => readDir(path),
    readFileBytes: (path) => readFile(path),
    inspectPath: (path) => lstat(path),
    watchDirectory: async (path, listener) => {
      let active = true;
      const unwatch = await watchImmediate(
        path,
        (event) => {
          if (!active) return;
          listener({
            category: watchCategory(event),
            paths: event.paths,
            requiresResync: requestsResync(event),
          });
        },
        { recursive: true },
      );
      return () => {
        if (!active) return;
        active = false;
        unwatch();
      };
    },
    appLocalDataDirectory: appLocalDataDir,
    basename,
    dirname,
    isAbsolute,
    joinPath: (...parts) => join(...parts),
    normalizePath: normalize,
    createDirectory: (path) => mkdir(path, { recursive: true }),
    pathExists: (path) => exists(path),
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
