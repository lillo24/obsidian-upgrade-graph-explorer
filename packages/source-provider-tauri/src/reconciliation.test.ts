import { describe, expect, it } from 'vitest';

import type {
  NativeDirectoryEntry,
  NativeFileInfo,
  TauriNativeBridge,
} from './bridge';
import { createTauriSourceProvider } from './provider';
import type { VaultSelection, VaultWatchBatch } from './types';

const ENCODER = new TextEncoder();

function normalized(path: string): string {
  const segments: string[] = [];
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

function parent(path: string): string {
  const value = normalized(path);
  const index = value.lastIndexOf('/');
  return index <= 0 ? '/' : value.slice(0, index);
}

function leaf(path: string): string {
  const value = normalized(path);
  return value.slice(value.lastIndexOf('/') + 1);
}

class FakeVaultBridge implements TauriNativeBridge {
  readonly directories = new Set<string>(['/', '/vault']);
  readonly files = new Map<string, Uint8Array>();
  readonly symlinks = new Set<string>();
  readonly unreadableFiles = new Set<string>();

  addDirectory(path: string): void {
    const value = normalized(path);
    if (value !== '/') this.addDirectory(parent(value));
    this.directories.add(value);
  }

  addFile(path: string, source: string | Uint8Array): void {
    const value = normalized(path);
    this.addDirectory(parent(value));
    this.files.set(
      value,
      typeof source === 'string' ? ENCODER.encode(source) : source,
    );
  }

  deletePath(path: string): void {
    const value = normalized(path);
    for (const file of [...this.files.keys()]) {
      if (file === value || file.startsWith(`${value}/`))
        this.files.delete(file);
    }
    for (const directory of [...this.directories]) {
      if (directory === value || directory.startsWith(`${value}/`)) {
        this.directories.delete(directory);
      }
    }
  }

  movePath(fromPath: string, toPath: string): void {
    const from = normalized(fromPath);
    const to = normalized(toPath);
    const movedFiles = [...this.files].filter(
      ([path]) => path === from || path.startsWith(`${from}/`),
    );
    const movedDirectories = [...this.directories].filter(
      (path) => path === from || path.startsWith(`${from}/`),
    );
    this.deletePath(from);
    for (const directory of movedDirectories) {
      this.addDirectory(`${to}${directory.slice(from.length)}`);
    }
    for (const [path, bytes] of movedFiles) {
      this.addFile(`${to}${path.slice(from.length)}`, bytes);
    }
  }

  async selectDirectory(): Promise<string | undefined> {
    return undefined;
  }

  async readDirectory(path: string): Promise<readonly NativeDirectoryEntry[]> {
    const directory = normalized(path);
    if (!this.directories.has(directory)) throw new Error('missing directory');
    const names = new Set<string>();
    for (const candidate of [...this.directories, ...this.files.keys()]) {
      if (candidate !== directory && parent(candidate) === directory) {
        names.add(leaf(candidate));
      }
    }
    return [...names].map((name) => {
      const candidate = normalized(`${directory}/${name}`);
      return {
        name,
        isDirectory: this.directories.has(candidate),
        isFile: this.files.has(candidate),
        isSymlink: this.symlinks.has(candidate),
      };
    });
  }

  async readFileBytes(path: string): Promise<Uint8Array> {
    const filePath = normalized(path);
    if (this.unreadableFiles.has(filePath)) throw new Error('denied');
    const value = this.files.get(filePath);
    if (value === undefined) throw new Error('missing file');
    return value.slice();
  }

  async inspectPath(path: string): Promise<NativeFileInfo> {
    const value = normalized(path);
    if (!this.directories.has(value) && !this.files.has(value)) {
      throw new Error('missing path');
    }
    return {
      isDirectory: this.directories.has(value),
      isFile: this.files.has(value),
      isSymlink: this.symlinks.has(value),
    };
  }

  async watchDirectory(): Promise<() => void> {
    return () => undefined;
  }

  async appLocalDataDirectory(): Promise<string> {
    return '/app-data';
  }

  async basename(path: string): Promise<string> {
    return leaf(path);
  }

  async dirname(path: string): Promise<string> {
    return parent(path);
  }

  async isAbsolute(path: string): Promise<boolean> {
    return path.startsWith('/');
  }

  async joinPath(...parts: string[]): Promise<string> {
    return normalized(parts.join('/'));
  }

  async normalizePath(path: string): Promise<string> {
    return normalized(path);
  }

  async createDirectory(path: string): Promise<void> {
    this.addDirectory(path);
  }

  async pathExists(path: string): Promise<boolean> {
    const value = normalized(path);
    return this.directories.has(value) || this.files.has(value);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    this.addFile(path, content);
  }

  async renamePath(fromPath: string, toPath: string): Promise<void> {
    this.movePath(fromPath, toPath);
  }

  async removeFile(path: string): Promise<void> {
    this.deletePath(path);
  }
}

const selection: VaultSelection = { rootPath: '/vault', displayName: 'vault' };

function batch(
  paths: readonly string[],
  overrides: Partial<VaultWatchBatch> = {},
): VaultWatchBatch {
  return {
    paths,
    categories: ['modify'],
    requiresResync: false,
    reasons: [],
    ...overrides,
  };
}

describe('selected-vault change reconciliation', () => {
  it('returns no source change for a noisy event with unchanged final state', async () => {
    const bridge = new FakeVaultBridge();
    bridge.addFile('/vault/A.md', '# A');
    bridge.addFile('/vault/image.png', 'image');
    const provider = createTauriSourceProvider({ bridge });
    const previousInventory = await provider.discoverSelectedVault(selection);
    const result = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch(['image.png', 'A.md', 'A.md']),
    });
    expect(result).toEqual({
      status: 'planned',
      plan: {
        markdownChanges: [],
        nextInventory: previousInventory,
        nonMarkdownChanged: false,
        affectedPaths: ['A.md', 'image.png'],
      },
    });
  });

  it('plans deterministic edits, additions, deletions, and non-Markdown changes', async () => {
    const bridge = new FakeVaultBridge();
    bridge.addFile('/vault/A.md', '# old');
    bridge.addFile('/vault/B.md', '# delete');
    bridge.addFile('/vault/image.png', 'image');
    const provider = createTauriSourceProvider({ bridge });
    const previousInventory = await provider.discoverSelectedVault(selection);

    bridge.addFile('/vault/A.md', '# new');
    bridge.deletePath('/vault/B.md');
    bridge.addFile('/vault/C.md', '# create');
    bridge.deletePath('/vault/image.png');
    bridge.addFile('/vault/asset.pdf', 'asset');
    const result = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch(['C.md', 'A.md', 'image.png', 'B.md', 'asset.pdf']),
    });

    expect(result).toMatchObject({
      status: 'planned',
      plan: {
        markdownChanges: [
          { kind: 'upsert', path: 'A.md', source: '# new' },
          { kind: 'delete', path: 'B.md' },
          { kind: 'upsert', path: 'C.md', source: '# create' },
        ],
        nonMarkdownChanged: true,
        affectedPaths: ['A.md', 'B.md', 'C.md', 'asset.pdf', 'image.png'],
      },
    });
  });

  it('infers a move only for content unique in both inventories', async () => {
    const bridge = new FakeVaultBridge();
    bridge.addFile('/vault/Old.md', '# unique');
    const provider = createTauriSourceProvider({ bridge });
    const previousInventory = await provider.discoverSelectedVault(selection);
    bridge.movePath('/vault/Old.md', '/vault/New.md');

    const result = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch(['Old.md', 'New.md']),
    });
    expect(result).toMatchObject({
      status: 'planned',
      plan: {
        markdownChanges: [
          { kind: 'move', fromPath: 'Old.md', toPath: 'New.md' },
        ],
      },
    });
  });

  it('falls back to delete plus upsert for rename-with-edit and duplicate content', async () => {
    const edited = new FakeVaultBridge();
    edited.addFile('/vault/Old.md', '# before');
    const editedProvider = createTauriSourceProvider({ bridge: edited });
    const editedPrevious =
      await editedProvider.discoverSelectedVault(selection);
    edited.movePath('/vault/Old.md', '/vault/New.md');
    edited.addFile('/vault/New.md', '# after');
    const editedResult = await editedProvider.reconcileSelectedVaultChanges({
      selection,
      previousInventory: editedPrevious,
      watchBatch: batch(['Old.md', 'New.md']),
    });
    expect(editedResult).toMatchObject({
      status: 'planned',
      plan: {
        markdownChanges: [
          { kind: 'upsert', path: 'New.md', source: '# after' },
          { kind: 'delete', path: 'Old.md' },
        ],
      },
    });

    const duplicate = new FakeVaultBridge();
    duplicate.addFile('/vault/One.md', '# same');
    duplicate.addFile('/vault/Two.md', '# same');
    const duplicateProvider = createTauriSourceProvider({ bridge: duplicate });
    const duplicatePrevious =
      await duplicateProvider.discoverSelectedVault(selection);
    duplicate.movePath('/vault/One.md', '/vault/NewOne.md');
    duplicate.movePath('/vault/Two.md', '/vault/NewTwo.md');
    const duplicateResult =
      await duplicateProvider.reconcileSelectedVaultChanges({
        selection,
        previousInventory: duplicatePrevious,
        watchBatch: batch(['One.md', 'Two.md', 'NewOne.md', 'NewTwo.md']),
      });
    expect(duplicateResult.status).toBe('planned');
    if (duplicateResult.status === 'planned') {
      expect(
        duplicateResult.plan.markdownChanges.some(
          (change) => change.kind === 'move',
        ),
      ).toBe(false);
    }
  });

  it('re-observes directory subtrees for directory moves and deletions', async () => {
    const bridge = new FakeVaultBridge();
    bridge.addFile('/vault/Old/A.md', '# A');
    bridge.addFile('/vault/Old/Nested/B.md', '# B');
    bridge.addFile('/vault/Old/image.png', 'image');
    const provider = createTauriSourceProvider({ bridge });
    const previousInventory = await provider.discoverSelectedVault(selection);
    bridge.movePath('/vault/Old', '/vault/New');

    const moved = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch(['Old', 'New', 'New/Nested/B.md']),
    });
    expect(moved).toMatchObject({
      status: 'planned',
      plan: {
        markdownChanges: [
          { kind: 'move', fromPath: 'Old/A.md', toPath: 'New/A.md' },
          {
            kind: 'move',
            fromPath: 'Old/Nested/B.md',
            toPath: 'New/Nested/B.md',
          },
        ],
        nonMarkdownChanged: true,
        affectedPaths: ['New', 'Old'],
      },
    });
    if (moved.status !== 'planned') throw new Error('expected a plan');
    bridge.deletePath('/vault/New');
    const deleted = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory: moved.plan.nextInventory,
      watchBatch: batch(['New']),
    });
    expect(deleted).toMatchObject({
      status: 'planned',
      plan: {
        markdownChanges: [
          { kind: 'delete', path: 'New/A.md' },
          { kind: 'delete', path: 'New/Nested/B.md' },
        ],
        nonMarkdownChanged: true,
      },
    });
  });

  it('keeps independent unique folder moves while leaving duplicate content unpaired', async () => {
    const bridge = new FakeVaultBridge();
    bridge.addFile('/vault/Old/UniqueA.md', '# unique A');
    bridge.addFile('/vault/Old/UniqueB.md', '# unique B');
    bridge.addFile('/vault/Old/DuplicateA.md', '# duplicate');
    bridge.addFile('/vault/Old/DuplicateB.md', '# duplicate');
    const provider = createTauriSourceProvider({ bridge });
    const previousInventory = await provider.discoverSelectedVault(selection);
    bridge.movePath('/vault/Old', '/vault/New');

    const result = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch(['Old', 'New']),
    });

    expect(result).toMatchObject({
      status: 'planned',
      plan: {
        markdownChanges: [
          {
            kind: 'upsert',
            path: 'New/DuplicateA.md',
            source: '# duplicate',
          },
          {
            kind: 'upsert',
            path: 'New/DuplicateB.md',
            source: '# duplicate',
          },
          { kind: 'delete', path: 'Old/DuplicateA.md' },
          { kind: 'delete', path: 'Old/DuplicateB.md' },
          {
            kind: 'move',
            fromPath: 'Old/UniqueA.md',
            toPath: 'New/UniqueA.md',
          },
          {
            kind: 'move',
            fromPath: 'Old/UniqueB.md',
            toPath: 'New/UniqueB.md',
          },
        ],
        affectedPaths: ['New', 'Old'],
      },
    });
  });

  it('handles Markdown and non-Markdown path transitions from observed state', async () => {
    const bridge = new FakeVaultBridge();
    bridge.addFile('/vault/Note.md', '# Note');
    bridge.addFile('/vault/Asset.txt', '# Asset');
    const provider = createTauriSourceProvider({ bridge });
    const previousInventory = await provider.discoverSelectedVault(selection);
    bridge.movePath('/vault/Note.md', '/vault/Note.txt');
    bridge.movePath('/vault/Asset.txt', '/vault/Asset.md');
    const result = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch(['Note.md', 'Note.txt', 'Asset.txt', 'Asset.md']),
    });
    expect(result).toMatchObject({
      status: 'planned',
      plan: {
        markdownChanges: [
          { kind: 'upsert', path: 'Asset.md', source: '# Asset' },
          { kind: 'delete', path: 'Note.md' },
        ],
        nonMarkdownChanged: true,
      },
    });
  });

  it('produces the same plan for equivalent batch ordering', async () => {
    const bridge = new FakeVaultBridge();
    bridge.addFile('/vault/A.md', '# old');
    const provider = createTauriSourceProvider({ bridge });
    const previousInventory = await provider.discoverSelectedVault(selection);
    bridge.addFile('/vault/A.md', '# new');
    bridge.addFile('/vault/B.md', '# B');
    const first = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch(['B.md', 'A.md', 'B.md']),
    });
    const second = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch(['A.md', 'B.md']),
    });
    expect(first).toEqual(second);
  });

  it('ignores excluded activity and marks invalid UTF-8 or unsafe native state for resync', async () => {
    const bridge = new FakeVaultBridge();
    bridge.addFile('/vault/A.md', '# A');
    const provider = createTauriSourceProvider({ bridge });
    const previousInventory = await provider.discoverSelectedVault(selection);
    bridge.addFile('/vault/.obsidian/private.md', '# ignored');
    const ignored = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch(['.obsidian/private.md']),
    });
    expect(ignored).toMatchObject({
      status: 'planned',
      plan: { markdownChanges: [], affectedPaths: [] },
    });

    bridge.addFile('/vault/Invalid.md', new Uint8Array([0xff]));
    const invalid = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch(['Invalid.md']),
    });
    expect(invalid).toMatchObject({ status: 'resync-required' });

    bridge.addFile('/vault/Unreadable.md', '# unreadable');
    bridge.unreadableFiles.add('/vault/Unreadable.md');
    const unreadable = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch(['Unreadable.md']),
    });
    expect(unreadable).toMatchObject({ status: 'resync-required' });

    const requested = await provider.reconcileSelectedVaultChanges({
      selection,
      previousInventory,
      watchBatch: batch([], {
        requiresResync: true,
        reasons: ['The native watcher requested a full resynchronization.'],
      }),
    });
    expect(requested).toEqual({
      status: 'resync-required',
      reason: 'The native watcher requested a full resynchronization.',
      affectedPaths: [],
    });
  });
});
