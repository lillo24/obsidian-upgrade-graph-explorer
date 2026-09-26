import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTauriSourceProvider: vi.fn(),
  invoke: vi.fn(),
  isTauriRuntime: vi.fn(),
}));

vi.mock('@icarus-graph-explorer/source-provider-tauri', () => ({
  createTauriSourceProvider: mocks.createTauriSourceProvider,
  isTauriRuntime: mocks.isTauriRuntime,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

import { desktopArgumentCompilerTunnel } from './desktop-runtime';

describe('desktop Argument Compiler tunnel bridge', () => {
  beforeEach(() => {
    mocks.createTauriSourceProvider.mockReset();
    mocks.invoke.mockReset();
    mocks.isTauriRuntime.mockReset();
  });

  it('omits the capability outside Tauri', () => {
    mocks.isTauriRuntime.mockReturnValue(false);

    expect(desktopArgumentCompilerTunnel()).toBeUndefined();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('invokes only the fixed zero-input native command', async () => {
    mocks.isTauriRuntime.mockReturnValue(true);
    mocks.invoke.mockResolvedValue({ status: 'already-running' });

    await expect(
      desktopArgumentCompilerTunnel()!.ensureRunning(),
    ).resolves.toEqual({ status: 'already-running' });
    expect(mocks.invoke).toHaveBeenCalledWith(
      'ensure_argument_compiler_tunnel_running',
    );
  });

  it('rejects malformed native results', async () => {
    mocks.isTauriRuntime.mockReturnValue(true);
    mocks.invoke.mockResolvedValue({ status: 'unknown' });

    await expect(
      desktopArgumentCompilerTunnel()!.ensureRunning(),
    ).rejects.toThrow('returned an invalid result');
  });
});
