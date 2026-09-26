import {
  createTauriSourceProvider,
  isTauriRuntime,
  type TauriSourceProvider,
} from '@icarus-graph-explorer/source-provider-tauri';
import { invoke } from '@tauri-apps/api/core';

import {
  isArgumentCompilerTunnelEnsureResult,
  type ArgumentCompilerTunnelCapability,
} from './argument-compiler-tunnel';

export function desktopSourceProvider(): TauriSourceProvider | undefined {
  return isTauriRuntime() ? createTauriSourceProvider() : undefined;
}

export function desktopArgumentCompilerTunnel():
  ArgumentCompilerTunnelCapability | undefined {
  if (!isTauriRuntime()) return undefined;
  return {
    async ensureRunning() {
      const result = await invoke<unknown>(
        'ensure_argument_compiler_tunnel_running',
      );
      if (!isArgumentCompilerTunnelEnsureResult(result)) {
        throw new Error(
          'The desktop Argument Compiler tunnel command returned an invalid result.',
        );
      }
      return result;
    },
  };
}
