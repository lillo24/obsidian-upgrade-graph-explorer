import {
  createTauriSourceProvider,
  isTauriRuntime,
  type TauriSourceProvider,
} from '@icarus-graph-explorer/source-provider-tauri';

export function desktopSourceProvider(): TauriSourceProvider | undefined {
  return isTauriRuntime() ? createTauriSourceProvider() : undefined;
}
