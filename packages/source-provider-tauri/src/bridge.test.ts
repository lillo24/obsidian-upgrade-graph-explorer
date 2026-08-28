import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openMock, watchImmediateMock } = vi.hoisted(() => ({
  openMock: vi.fn(),
  watchImmediateMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  appLocalDataDir: vi.fn(),
  basename: vi.fn(),
  dirname: vi.fn(),
  isAbsolute: vi.fn(),
  join: vi.fn(),
  normalize: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: openMock }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  lstat: vi.fn(),
  mkdir: vi.fn(),
  readDir: vi.fn(),
  readFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
  writeTextFile: vi.fn(),
  watchImmediate: watchImmediateMock,
}));

import { createTauriNativeBridge } from './bridge';

describe('production Tauri bridge', () => {
  beforeEach(() => {
    openMock.mockReset();
    watchImmediateMock.mockReset();
  });

  it('authorizes only the selected directory tree recursively for this process', async () => {
    openMock.mockResolvedValue('C:\\selected-vault');

    await expect(createTauriNativeBridge().selectDirectory()).resolves.toBe(
      'C:\\selected-vault',
    );
    expect(openMock).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      recursive: true,
      title: 'Open Markdown Vault',
    });
  });

  it('maps recursive immediate watch events to bridge-owned plain data', async () => {
    const unwatch = vi.fn();
    watchImmediateMock.mockResolvedValue(unwatch);
    const listener = vi.fn();

    const stop = await createTauriNativeBridge().watchDirectory(
      'C:\\selected-vault',
      listener,
    );
    const nativeListener = watchImmediateMock.mock.calls[0]?.[1] as (
      event: unknown,
    ) => void;
    nativeListener({
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['C:\\selected-vault\\Old.md', 'C:\\selected-vault\\New.md'],
      attrs: {},
    });

    expect(watchImmediateMock).toHaveBeenCalledWith(
      'C:\\selected-vault',
      expect.any(Function),
      { recursive: true },
    );
    expect(listener).toHaveBeenCalledWith({
      category: 'rename',
      paths: ['C:\\selected-vault\\Old.md', 'C:\\selected-vault\\New.md'],
      requiresResync: false,
    });
    nativeListener({
      type: { modify: { kind: 'metadata', mode: 'access-time' } },
      paths: ['C:\\selected-vault\\New.md'],
      attrs: {},
    });
    expect(listener).toHaveBeenLastCalledWith({
      category: 'access',
      paths: ['C:\\selected-vault\\New.md'],
      requiresResync: false,
    });
    stop();
    stop();
    expect(unwatch).toHaveBeenCalledOnce();
    nativeListener({
      type: { remove: { kind: 'file' } },
      paths: ['C:\\selected-vault\\New.md'],
      attrs: {},
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('propagates native watcher startup failure', async () => {
    watchImmediateMock.mockRejectedValue(new Error('permission denied'));

    await expect(
      createTauriNativeBridge().watchDirectory(
        'C:\\selected-vault',
        () => undefined,
      ),
    ).rejects.toThrow('permission denied');
  });

  it('preserves the installed native rescan flag without leaking attrs', async () => {
    watchImmediateMock.mockResolvedValue(vi.fn());
    const listener = vi.fn();
    await createTauriNativeBridge().watchDirectory(
      'C:\\selected-vault',
      listener,
    );
    const nativeListener = watchImmediateMock.mock.calls[0]?.[1] as (
      event: unknown,
    ) => void;

    nativeListener({
      type: 'any',
      paths: ['C:\\selected-vault\\A.md'],
      attrs: { flag: 'rescan', tracker: 42 },
    });

    expect(listener).toHaveBeenCalledWith({
      category: 'other',
      paths: ['C:\\selected-vault\\A.md'],
      requiresResync: true,
    });
  });
});
