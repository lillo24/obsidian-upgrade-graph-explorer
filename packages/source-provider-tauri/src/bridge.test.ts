import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openMock } = vi.hoisted(() => ({ openMock: vi.fn() }));

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
}));

import { createTauriNativeBridge } from './bridge';

describe('production Tauri bridge', () => {
  beforeEach(() => openMock.mockReset());

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
});
