import { isTauri } from '@tauri-apps/api/core';

/** Official Tauri v2 runtime detection without requiring a global API object. */
export function isTauriRuntime(): boolean {
  return isTauri();
}
