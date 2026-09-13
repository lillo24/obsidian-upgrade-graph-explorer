import {
  MemoryReviewHistoryStore,
  type ReviewHistoryStore,
} from '@icarus-graph-explorer/review-workspace';

function isTauriRuntime(): boolean {
  return Reflect.has(globalThis, '__TAURI_INTERNALS__');
}

function unavailableStore(message: string): ReviewHistoryStore {
  return {
    durability: 'desktop-app-local',
    async list() {
      return {
        status: 'unreadable' as const,
        summaries: [],
        issues: [],
        message,
      };
    },
    async load() {
      return { status: 'unreadable' as const, message };
    },
    async save() {
      return { status: 'error' as const, message };
    },
    async delete() {
      return { status: 'error' as const, message };
    },
  };
}

/** Resolves once; desktop storage failures never fall back to browser memory. */
export function createPlatformReviewHistoryStore(): ReviewHistoryStore {
  let selected: Promise<ReviewHistoryStore> | undefined;
  const resolve = () => {
    selected ??= isTauriRuntime()
      ? import('@icarus-graph-explorer/review-workspace-tauri')
          .then(({ createTauriReviewHistoryStore }) =>
            createTauriReviewHistoryStore(),
          )
          .catch((error: unknown) =>
            unavailableStore(
              `Desktop review history could not be initialized: ${error instanceof Error ? error.message : String(error)}`,
            ),
          )
      : Promise.resolve(new MemoryReviewHistoryStore());
    return selected;
  };
  return {
    get durability() {
      return isTauriRuntime()
        ? ('desktop-app-local' as const)
        : ('browser-session-only' as const);
    },
    async list() {
      return (await resolve()).list();
    },
    async load(id) {
      return (await resolve()).load(id);
    },
    async save(entry, expected) {
      return (await resolve()).save(entry, expected);
    },
    async delete(id, expected) {
      return (await resolve()).delete(id, expected);
    },
  };
}
