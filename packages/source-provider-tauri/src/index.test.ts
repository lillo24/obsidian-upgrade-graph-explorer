import { describe, expect, it } from 'vitest';

import {
  createStableIdentityCatalog,
  type StableIdentityCatalog,
} from '@icarus-graph-explorer/stable-identity';

import type {
  NativeDirectoryEntry,
  NativeFileInfo,
  TauriNativeBridge,
} from './bridge';
import { createTauriSourceProvider } from './provider';
import type { VaultSelection } from './types';

const ENCODER = new TextEncoder();
const APP_DATA = '/private-app-data';
const REGISTRY = `${APP_DATA}/workspaces.json`;

function normalized(path: string): string {
  const absolute = path.replaceAll('\\', '/').startsWith('/');
  const segments: string[] = [];
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return (
    `${absolute ? '/' : ''}${segments.join('/')}` || (absolute ? '/' : '.')
  );
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

class FakeBridge implements TauriNativeBridge {
  readonly directories = new Set<string>(['/', APP_DATA]);
  readonly files = new Map<string, Uint8Array>();
  readonly symlinks = new Set<string>();
  readonly unreadableDirectories = new Set<string>();
  readonly unreadableFiles = new Set<string>();
  readonly renameFailures = new Set<string>();
  readonly renamedTargets: string[] = [];
  selected?: string;

  addDirectory(path: string): void {
    const value = normalized(path);
    if (value !== '/') this.addDirectory(parent(value));
    this.directories.add(value);
  }

  addFile(path: string, value: string | Uint8Array): void {
    const filePath = normalized(path);
    this.addDirectory(parent(filePath));
    this.files.set(
      filePath,
      typeof value === 'string' ? ENCODER.encode(value) : value,
    );
  }

  text(path: string): string | undefined {
    const value = this.files.get(normalized(path));
    return value === undefined ? undefined : new TextDecoder().decode(value);
  }

  async selectDirectory(): Promise<string | undefined> {
    return this.selected;
  }

  async readDirectory(path: string): Promise<readonly NativeDirectoryEntry[]> {
    const directory = normalized(path);
    if (this.unreadableDirectories.has(directory)) throw new Error('denied');
    if (!this.directories.has(directory)) throw new Error('missing directory');
    const names = new Set<string>();
    for (const candidate of [
      ...this.directories,
      ...this.files.keys(),
      ...this.symlinks,
    ]) {
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
    if (
      !this.directories.has(value) &&
      !this.files.has(value) &&
      !this.symlinks.has(value)
    ) {
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
    return APP_DATA;
  }

  async basename(path: string): Promise<string> {
    return leaf(path);
  }

  async dirname(path: string): Promise<string> {
    return parent(path);
  }

  async isAbsolute(path: string): Promise<boolean> {
    return path.replaceAll('\\', '/').startsWith('/');
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

  async writeTextFile(
    path: string,
    content: string,
    options?: { readonly createNew?: boolean },
  ): Promise<void> {
    const value = normalized(path);
    if (options?.createNew && this.files.has(value)) {
      throw new Error('already exists');
    }
    this.addFile(value, content);
  }

  async renamePath(fromPath: string, toPath: string): Promise<void> {
    const from = normalized(fromPath);
    const to = normalized(toPath);
    if (this.renameFailures.has(to)) throw new Error('rename denied');
    const value = this.files.get(from);
    if (value === undefined) throw new Error('missing source');
    this.files.set(to, value);
    this.files.delete(from);
    this.renamedTargets.push(to);
  }

  async removeFile(path: string): Promise<void> {
    if (!this.files.delete(normalized(path))) throw new Error('missing file');
  }
}

function selection(rootPath = '/vault'): VaultSelection {
  return { rootPath, displayName: leaf(rootPath) };
}

function provider(
  bridge: FakeBridge,
  ids: readonly string[] = ['workspace-1', 'workspace-2'],
) {
  let index = 0;
  let token = 0;
  return createTauriSourceProvider({
    bridge,
    workspaceIdFactory: () => ids[index++] ?? `workspace-${index}`,
    temporaryTokenFactory: () => `temporary-${(token += 1)}`,
  });
}

function catalogPath(workspaceId: string): string {
  return `${APP_DATA}/identity/${encodeURIComponent(workspaceId)}.json`;
}

function persistedRegistry(
  bridge: FakeBridge,
  rootPath: string,
  workspaceId: string,
  catalog: StableIdentityCatalog = createStableIdentityCatalog(workspaceId),
): void {
  bridge.addFile(
    REGISTRY,
    `${JSON.stringify({
      schemaVersion: 1,
      workspaces: [{ rootPath, workspaceId }],
    })}\n`,
  );
  bridge.addFile(catalogPath(workspaceId), `${JSON.stringify(catalog)}\n`);
}

describe('Tauri source provider', () => {
  it('treats dialog cancellation as an unchanged outcome', async () => {
    const bridge = new FakeBridge();
    expect(await provider(bridge).selectVaultDirectory()).toBeUndefined();
  });

  it('returns a normalized private root and safe display name', async () => {
    const bridge = new FakeBridge();
    bridge.selected = '/vault/../vault/';
    bridge.addDirectory('/vault');
    await expect(provider(bridge).selectVaultDirectory()).resolves.toEqual({
      rootPath: '/vault',
      displayName: 'vault',
    });
  });

  it('discovers deterministic strict Markdown and path-only non-Markdown inventory', async () => {
    const bridge = new FakeBridge();
    bridge.addFile('/vault/Z.MD', '# Z');
    bridge.addFile('/vault/Folder/A.md', '# A');
    bridge.addFile('/vault/Folder/image.png', new Uint8Array([0xff]));
    bridge.addFile('/vault/.obsidian/ignored.md', '# ignored');
    bridge.addFile('/vault/node_modules/ignored.md', '# ignored');
    bridge.addFile('/vault/Excluded/ignored.md', '# ignored');
    bridge.symlinks.add('/vault/linked.md');

    const inventory = await provider(bridge).discoverSelectedVault(
      selection(),
      { excludes: ['Excluded'] },
    );

    expect(inventory.markdownDocuments).toEqual([
      { path: 'Folder/A.md', source: '# A' },
      { path: 'Z.MD', source: '# Z' },
    ]);
    expect(inventory.nonMarkdownPaths).toEqual(['Folder/image.png']);
    expect(bridge.unreadableFiles.size).toBe(0);
  });

  it('rejects invalid UTF-8 and unreadable Markdown with relative context', async () => {
    const invalid = new FakeBridge();
    invalid.addFile('/vault/A.md', new Uint8Array([0xff]));
    await expect(
      provider(invalid).discoverSelectedVault(selection()),
    ).rejects.toThrow('not valid UTF-8: A.md');

    const unreadable = new FakeBridge();
    unreadable.addFile('/vault/Folder/A.md', '# A');
    unreadable.unreadableFiles.add('/vault/Folder/A.md');
    await expect(
      provider(unreadable).discoverSelectedVault(selection()),
    ).rejects.toThrow('Cannot read Markdown source Folder/A.md');
  });

  it('rejects an unreadable or symbolic-link root and unreadable subdirectories', async () => {
    const missing = new FakeBridge();
    await expect(
      provider(missing).discoverSelectedVault(selection()),
    ).rejects.toThrow('root cannot be inspected');

    const linked = new FakeBridge();
    linked.symlinks.add('/vault');
    await expect(
      provider(linked).discoverSelectedVault(selection()),
    ).rejects.toThrow('must not be a symbolic link');

    const unreadable = new FakeBridge();
    unreadable.addDirectory('/vault/Folder');
    unreadable.unreadableDirectories.add('/vault/Folder');
    await expect(
      provider(unreadable).discoverSelectedVault(selection()),
    ).rejects.toThrow('Cannot read vault directory Folder');
  });

  it('allocates and commits a new private workspace without leaking the absolute root into its catalog', async () => {
    const bridge = new FakeBridge();
    bridge.addDirectory('/vault');
    const sourceProvider = provider(bridge);
    const session =
      await sourceProvider.loadOrPrepareWorkspaceIdentity(selection());
    expect(session).toMatchObject({
      workspaceId: 'workspace-1',
      association: 'new',
    });

    await sourceProvider.commitWorkspaceIdentity(session, session.catalog);

    expect(bridge.text(REGISTRY)).toContain('"rootPath": "/vault"');
    expect(bridge.text(catalogPath('workspace-1'))).not.toContain('/vault');
  });

  it('reuses a known root and valid catalog exactly', async () => {
    const bridge = new FakeBridge();
    bridge.addDirectory('/vault');
    persistedRegistry(bridge, '/vault', 'known-workspace');
    const session = await provider(bridge).loadOrPrepareWorkspaceIdentity(
      selection('/vault/'),
    );
    expect(session).toMatchObject({
      workspaceId: 'known-workspace',
      association: 'existing',
    });
  });

  it('allocates different workspace IDs for different exact normalized roots', async () => {
    const bridge = new FakeBridge();
    bridge.addDirectory('/one');
    bridge.addDirectory('/two');
    const sourceProvider = provider(bridge);
    const first = await sourceProvider.loadOrPrepareWorkspaceIdentity(
      selection('/one'),
    );
    await sourceProvider.commitWorkspaceIdentity(first, first.catalog);
    const second = await sourceProvider.loadOrPrepareWorkspaceIdentity(
      selection('/two'),
    );
    expect(second.workspaceId).not.toBe(first.workspaceId);
  });

  it('rejects malformed and unsupported registry state without silent reset', async () => {
    for (const value of [
      '{',
      JSON.stringify({ schemaVersion: 2, workspaces: [] }),
      JSON.stringify({
        schemaVersion: 1,
        workspaces: [
          { rootPath: '/vault', workspaceId: 'same' },
          { rootPath: '/other', workspaceId: 'same' },
        ],
      }),
    ]) {
      const bridge = new FakeBridge();
      bridge.addDirectory('/vault');
      bridge.addFile(REGISTRY, value);
      await expect(
        provider(bridge).loadOrPrepareWorkspaceIdentity(selection()),
      ).rejects.toMatchObject({
        recovery: 'replace-corrupt-registry',
      });
    }
  });

  it('rejects missing, corrupt, and mismatched known catalogs', async () => {
    const missing = new FakeBridge();
    missing.addDirectory('/vault');
    missing.addFile(
      REGISTRY,
      JSON.stringify({
        schemaVersion: 1,
        workspaces: [{ rootPath: '/vault', workspaceId: 'known' }],
      }),
    );
    await expect(
      provider(missing).loadOrPrepareWorkspaceIdentity(selection()),
    ).rejects.toMatchObject({ recovery: 'reset-vault-identity' });

    const corrupt = new FakeBridge();
    corrupt.addDirectory('/vault');
    persistedRegistry(corrupt, '/vault', 'known');
    corrupt.addFile(catalogPath('known'), '{');
    await expect(
      provider(corrupt).loadOrPrepareWorkspaceIdentity(selection()),
    ).rejects.toMatchObject({ recovery: 'reset-vault-identity' });

    const mismatched = new FakeBridge();
    mismatched.addDirectory('/vault');
    persistedRegistry(
      mismatched,
      '/vault',
      'known',
      createStableIdentityCatalog('different'),
    );
    await expect(
      provider(mismatched).loadOrPrepareWorkspaceIdentity(selection()),
    ).rejects.toMatchObject({ recovery: 'reset-vault-identity' });
  });

  it('keeps the prior catalog intact when temporary replacement rename fails', async () => {
    const bridge = new FakeBridge();
    bridge.addDirectory('/vault');
    persistedRegistry(bridge, '/vault', 'known');
    const original = bridge.text(catalogPath('known'));
    const sourceProvider = provider(bridge);
    const session =
      await sourceProvider.loadOrPrepareWorkspaceIdentity(selection());
    bridge.renameFailures.add(catalogPath('known'));

    await expect(
      sourceProvider.commitWorkspaceIdentity(session, session.catalog),
    ).rejects.toThrow('Cannot safely replace private application state');
    expect(bridge.text(catalogPath('known'))).toBe(original);
    expect([...bridge.files.keys()].some((path) => path.endsWith('.tmp'))).toBe(
      false,
    );
  });

  it('never publishes a new registry association before its catalog is durable', async () => {
    const bridge = new FakeBridge();
    bridge.addDirectory('/vault');
    bridge.renameFailures.add(REGISTRY);
    const sourceProvider = provider(bridge);
    const session =
      await sourceProvider.loadOrPrepareWorkspaceIdentity(selection());

    await expect(
      sourceProvider.commitWorkspaceIdentity(session, session.catalog),
    ).rejects.toThrow('Cannot safely replace private application state');

    expect(bridge.text(REGISTRY)).toBeUndefined();
    expect(bridge.text(catalogPath(session.workspaceId))).toBeDefined();
    expect([...bridge.files.keys()].some((path) => path.endsWith('.tmp'))).toBe(
      false,
    );
  });

  it('registers new and reset sessions once while allowing repeated catalog commits', async () => {
    for (const reset of [false, true]) {
      const bridge = new FakeBridge();
      bridge.addDirectory('/vault');
      if (reset) persistedRegistry(bridge, '/vault', 'old-workspace');
      const sourceProvider = provider(bridge);
      const session = await sourceProvider.loadOrPrepareWorkspaceIdentity(
        selection(),
        reset ? { reset: true } : {},
      );

      await sourceProvider.commitWorkspaceIdentity(session, session.catalog);
      await sourceProvider.commitWorkspaceIdentity(session, session.catalog);
      await sourceProvider.commitWorkspaceIdentity(session, session.catalog);

      expect(
        bridge.renamedTargets.filter((target) => target === REGISTRY),
      ).toHaveLength(1);
      expect(
        bridge.renamedTargets.filter(
          (target) => target === catalogPath(session.workspaceId),
        ),
      ).toHaveLength(3);
    }
  });

  it('retries a failed first registry association before switching to catalog-only commits', async () => {
    const bridge = new FakeBridge();
    bridge.addDirectory('/vault');
    bridge.renameFailures.add(REGISTRY);
    const sourceProvider = provider(bridge);
    const session =
      await sourceProvider.loadOrPrepareWorkspaceIdentity(selection());

    await expect(
      sourceProvider.commitWorkspaceIdentity(session, session.catalog),
    ).rejects.toThrow('Cannot safely replace private application state');
    bridge.renameFailures.delete(REGISTRY);
    await sourceProvider.commitWorkspaceIdentity(session, session.catalog);
    await sourceProvider.commitWorkspaceIdentity(session, session.catalog);

    expect(
      bridge.renamedTargets.filter((target) => target === REGISTRY),
    ).toHaveLength(1);
  });

  it('does not advance a new session when its catalog replacement fails', async () => {
    const bridge = new FakeBridge();
    bridge.addDirectory('/vault');
    const sourceProvider = provider(bridge);
    const session =
      await sourceProvider.loadOrPrepareWorkspaceIdentity(selection());
    bridge.renameFailures.add(catalogPath(session.workspaceId));

    await expect(
      sourceProvider.commitWorkspaceIdentity(session, session.catalog),
    ).rejects.toThrow('Cannot safely replace private application state');
    expect(bridge.text(REGISTRY)).toBeUndefined();
    bridge.renameFailures.delete(catalogPath(session.workspaceId));
    await sourceProvider.commitWorkspaceIdentity(session, session.catalog);

    expect(bridge.text(REGISTRY)).toContain(session.workspaceId);
  });

  it('supports explicit confirmed identity and corrupt-registry recovery', async () => {
    const bridge = new FakeBridge();
    bridge.addDirectory('/vault');
    persistedRegistry(bridge, '/vault', 'old-workspace');
    const sourceProvider = provider(bridge);
    const reset = await sourceProvider.loadOrPrepareWorkspaceIdentity(
      selection(),
      { reset: true },
    );
    expect(reset).toMatchObject({
      workspaceId: 'workspace-1',
      association: 'reset',
      previousWorkspaceId: 'old-workspace',
    });
    await sourceProvider.commitWorkspaceIdentity(reset, reset.catalog);
    expect(bridge.text(REGISTRY)).toContain('workspace-1');

    bridge.addFile(REGISTRY, '{');
    const recovered = await sourceProvider.loadOrPrepareWorkspaceIdentity(
      selection(),
      { reset: true, replaceCorruptRegistry: true },
    );
    expect(recovered.association).toBe('new');
  });
});
