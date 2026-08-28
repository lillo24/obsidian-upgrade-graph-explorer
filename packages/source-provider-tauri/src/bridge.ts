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
  writeTextFile,
} from '@tauri-apps/plugin-fs';

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
