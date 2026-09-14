import { appLocalDataDir, dirname, join } from '@tauri-apps/api/path';
import {
  exists,
  mkdir,
  readDir,
  readFile,
  remove,
  rename,
  writeTextFile,
} from '@tauri-apps/plugin-fs';
import {
  MAX_REVIEW_HISTORY_ITEMS,
  assertReviewRecordId,
  captureReviewHistoryDescriptor,
  parseReviewHistoryEntryJson,
  reviewHistoryEntryId,
  sameReviewHistoryDescriptor,
  serializeReviewHistoryEntry,
  summarizeReviewHistoryEntry,
  validateReviewHistoryEntry,
  type ReviewHistoryListResult,
  type ReviewHistoryStore,
  type ReviewHistorySummary,
} from '@icarus-graph-explorer/review-workspace';

export interface ReviewHistoryTauriBridge {
  appLocalDataDirectory(): Promise<string>;
  joinPath(...parts: string[]): Promise<string>;
  dirname(path: string): Promise<string>;
  pathExists(path: string): Promise<boolean>;
  createDirectory(path: string): Promise<void>;
  listFileNames(path: string): Promise<string[]>;
  readFileBytes(path: string): Promise<Uint8Array>;
  writeTextFile(
    path: string,
    content: string,
    options?: { readonly createNew?: boolean },
  ): Promise<void>;
  renamePath(fromPath: string, toPath: string): Promise<void>;
  removeFile(path: string): Promise<void>;
  nowMs(): number;
}

function nativeBridge(): ReviewHistoryTauriBridge {
  return {
    appLocalDataDirectory: appLocalDataDir,
    joinPath: (...parts) => join(...parts),
    dirname,
    pathExists: exists,
    createDirectory: (path) => mkdir(path, { recursive: true }),
    listFileNames: async (path) =>
      (await readDir(path))
        .filter(({ isFile }) => isFile)
        .map(({ name }) => name),
    readFileBytes: readFile,
    writeTextFile: (path, content, options) =>
      writeTextFile(path, content, {
        ...(options?.createNew === undefined
          ? {}
          : { createNew: options.createNew }),
      }),
    renamePath: rename,
    removeFile: (path) => remove(path),
    nowMs: () => Date.now(),
  };
}

interface ReviewSummaryIndex {
  readonly schemaVersion: 1;
  readonly items: readonly ReviewHistorySummary[];
}

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const INDEX_LIMIT_BYTES = 1024 * 1024;
const LEASE_MAX_AGE_MS = 120_000;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function basePath(bridge: ReviewHistoryTauriBridge): Promise<string> {
  return bridge.joinPath(
    await bridge.appLocalDataDirectory(),
    'review-workspace-v1',
  );
}

async function recordPath(
  bridge: ReviewHistoryTauriBridge,
  id: string,
): Promise<string> {
  assertReviewRecordId(id);
  return bridge.joinPath(
    await basePath(bridge),
    'records',
    `${encodeURIComponent(id)}.json`,
  );
}

async function indexPath(bridge: ReviewHistoryTauriBridge): Promise<string> {
  return bridge.joinPath(await basePath(bridge), 'index-v1.json');
}

async function readText(
  bridge: ReviewHistoryTauriBridge,
  path: string,
): Promise<string> {
  return UTF8_DECODER.decode(await bridge.readFileBytes(path));
}

function parseIndex(source: string): ReviewSummaryIndex {
  if (new TextEncoder().encode(source).byteLength > INDEX_LIMIT_BYTES) {
    throw new Error('Review history summary index exceeds its 1 MiB limit.');
  }
  const parsed: unknown = JSON.parse(source);
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    Reflect.get(parsed, 'schemaVersion') !== 1 ||
    !Array.isArray(Reflect.get(parsed, 'items'))
  ) {
    throw new Error('Review history summary index is invalid.');
  }
  const items = Reflect.get(parsed, 'items') as unknown[];
  if (items.length > MAX_REVIEW_HISTORY_ITEMS) {
    throw new Error('Review history summary index exceeds its item limit.');
  }
  for (const item of items) {
    if (
      item === null ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      typeof Reflect.get(item, 'id') !== 'string' ||
      typeof Reflect.get(item, 'fingerprint') !== 'string' ||
      typeof Reflect.get(item, 'title') !== 'string' ||
      typeof Reflect.get(item, 'updatedAt') !== 'string'
    ) {
      throw new Error('Review history summary index contains an invalid item.');
    }
    assertReviewRecordId(Reflect.get(item, 'id') as string);
  }
  return parsed as ReviewSummaryIndex;
}

async function loadIndex(
  bridge: ReviewHistoryTauriBridge,
): Promise<ReviewSummaryIndex> {
  const path = await indexPath(bridge);
  if (!(await bridge.pathExists(path))) return { schemaVersion: 1, items: [] };
  return parseIndex(await readText(bridge, path));
}

async function writeAtomically(
  bridge: ReviewHistoryTauriBridge,
  path: string,
  source: string,
  token: string,
): Promise<void> {
  const directory = await bridge.dirname(path);
  await bridge.createDirectory(directory);
  const temporary = `${path}.${encodeURIComponent(token)}.tmp`;
  try {
    await bridge.writeTextFile(temporary, source, { createNew: true });
    await bridge.renamePath(temporary, path);
  } catch (error) {
    try {
      if (await bridge.pathExists(temporary))
        await bridge.removeFile(temporary);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Review history replacement and temporary-file cleanup both failed.',
        { cause: cleanupError },
      );
    }
    throw error;
  }
}

async function acquireLease(
  bridge: ReviewHistoryTauriBridge,
  token: string,
): Promise<() => Promise<void>> {
  const directory = await basePath(bridge);
  await bridge.createDirectory(directory);
  const path = await bridge.joinPath(directory, 'writer.lock');
  const source = JSON.stringify({ token, createdAtMs: bridge.nowMs() });
  try {
    await bridge.writeTextFile(path, source, { createNew: true });
  } catch (error) {
    let existing: unknown;
    try {
      existing = JSON.parse(await readText(bridge, path));
    } catch {
      throw new Error(
        'Review history is locked by another app session; the lease could not be inspected.',
        { cause: error },
      );
    }
    const createdAtMs =
      existing !== null && typeof existing === 'object'
        ? Reflect.get(existing, 'createdAtMs')
        : undefined;
    if (
      typeof createdAtMs !== 'number' ||
      bridge.nowMs() - createdAtMs <= LEASE_MAX_AGE_MS
    ) {
      throw new Error(
        'Review history is being written by another app session.',
        { cause: error },
      );
    }
    const stalePath = `${path}.${encodeURIComponent(token)}.stale`;
    await bridge.renamePath(path, stalePath);
    await bridge.writeTextFile(path, source, { createNew: true });
  }
  return async () => {
    if (!(await bridge.pathExists(path))) return;
    try {
      const current = JSON.parse(await readText(bridge, path)) as {
        token?: unknown;
      };
      if (current.token === token) await bridge.removeFile(path);
    } catch {
      // Do not remove a lease that cannot be proven to belong to this writer.
    }
  };
}

async function loadRecord(bridge: ReviewHistoryTauriBridge, id: string) {
  let path: string;
  try {
    path = await recordPath(bridge, id);
  } catch (error) {
    return { status: 'unreadable' as const, message: message(error) };
  }
  try {
    if (!(await bridge.pathExists(path))) return { status: 'missing' as const };
    const source = await readText(bridge, path);
    try {
      const entry = parseReviewHistoryEntryJson(source);
      if (reviewHistoryEntryId(entry) !== id) {
        throw new Error(
          `Record filename ${id} does not match its embedded ID.`,
        );
      }
      return {
        status: 'loaded' as const,
        entry,
        descriptor: captureReviewHistoryDescriptor(entry),
      };
    } catch (error) {
      const future =
        /Unsupported .*schema|Unsupported review-history envelope/u.test(
          message(error),
        );
      return {
        status: future ? ('future-schema' as const) : ('corrupt' as const),
        message: message(error),
        preservedValue: source,
      };
    }
  } catch (error) {
    return {
      status: 'unreadable' as const,
      message: `Could not read review record ${id}: ${message(error)}`,
    };
  }
}

async function recoverList(
  bridge: ReviewHistoryTauriBridge,
  indexError: unknown,
): Promise<ReviewHistoryListResult> {
  const recordsDirectory = await bridge.joinPath(
    await basePath(bridge),
    'records',
  );
  if (!(await bridge.pathExists(recordsDirectory))) {
    return {
      status: 'unreadable',
      summaries: [],
      issues: [],
      message: `Review history index is unreadable: ${message(indexError)}`,
    };
  }
  const names = (await bridge.listFileNames(recordsDirectory))
    .filter((name) => name.endsWith('.json'))
    .slice(0, MAX_REVIEW_HISTORY_ITEMS + 1);
  const summaries: ReviewHistorySummary[] = [];
  const issues: ReviewHistoryListResult['issues'][number][] = [];
  for (const name of names.slice(0, MAX_REVIEW_HISTORY_ITEMS)) {
    let id: string;
    try {
      id = decodeURIComponent(name.slice(0, -5));
      assertReviewRecordId(id);
    } catch {
      issues.push({
        id: name,
        status: 'corrupt',
        message: 'Record filename is not a safe review ID.',
      });
      continue;
    }
    const loaded = await loadRecord(bridge, id);
    if (loaded.status === 'loaded')
      summaries.push(summarizeReviewHistoryEntry(loaded.entry));
    else if (loaded.status !== 'missing') {
      issues.push({ id, status: loaded.status, message: loaded.message });
    }
  }
  if (names.length > MAX_REVIEW_HISTORY_ITEMS) {
    issues.push({
      id: 'history-limit',
      status: 'unreadable',
      message: `More than ${MAX_REVIEW_HISTORY_ITEMS} review files exist; extras were not loaded.`,
    });
  }
  return {
    status: 'loaded',
    summaries: summaries.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
    issues,
    message: `The summary index is unreadable (${message(indexError)}); valid records were recovered individually.`,
  };
}

export interface CreateTauriReviewHistoryStoreOptions {
  readonly bridge?: ReviewHistoryTauriBridge;
  readonly temporaryToken?: () => string;
}

/** Dedicated app-local review storage; it never accesses the selected vault. */
export function createTauriReviewHistoryStore(
  options: CreateTauriReviewHistoryStoreOptions = {},
): ReviewHistoryStore {
  const bridge = options.bridge ?? nativeBridge();
  const token =
    options.temporaryToken ?? (() => globalThis.crypto.randomUUID());
  let writeQueue = Promise.resolve();
  const serializeWrite = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = writeQueue.catch(() => undefined).then(operation);
    writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  return {
    durability: 'desktop-app-local',
    async list() {
      try {
        const index = await loadIndex(bridge);
        return {
          status: 'loaded' as const,
          summaries: [...index.items].sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
          ),
          issues: [],
        };
      } catch (error) {
        try {
          return await recoverList(bridge, error);
        } catch (recoveryError) {
          return {
            status: 'unreadable' as const,
            summaries: [],
            issues: [],
            message: `Review history could not be listed: ${message(recoveryError)}`,
          };
        }
      }
    },
    async load(id) {
      return loadRecord(bridge, id);
    },
    async save(entry, expected) {
      return serializeWrite(async () => {
        const snapshot = validateReviewHistoryEntry(entry);
        const id = reviewHistoryEntryId(snapshot);
        const leaseToken = token();
        let release: (() => Promise<void>) | undefined;
        try {
          release = await acquireLease(bridge, leaseToken);
          const current = await loadRecord(bridge, id);
          if (
            current.status === 'corrupt' ||
            current.status === 'future-schema' ||
            current.status === 'unreadable'
          ) {
            return {
              status: 'error' as const,
              message: `${current.message} Existing bytes were preserved.`,
            };
          }
          if (
            (expected === 'missing' && current.status !== 'missing') ||
            (expected !== 'missing' &&
              (current.status !== 'loaded' ||
                !sameReviewHistoryDescriptor(current.descriptor, expected)))
          ) {
            return {
              status: 'conflict' as const,
              message: `Review record ${id} changed after it was read.`,
              ...(current.status === 'loaded'
                ? { actual: current.descriptor }
                : {}),
            };
          }
          const index = await loadIndex(bridge);
          const priorIndex = JSON.stringify(index);
          if (
            current.status === 'missing' &&
            index.items.length >= MAX_REVIEW_HISTORY_ITEMS
          ) {
            return {
              status: 'error' as const,
              message: `Review history has reached its ${MAX_REVIEW_HISTORY_ITEMS}-item limit; no record was evicted.`,
            };
          }
          const path = await recordPath(bridge, id);
          const previousSource =
            current.status === 'loaded'
              ? serializeReviewHistoryEntry(current.entry)
              : undefined;
          await writeAtomically(
            bridge,
            path,
            serializeReviewHistoryEntry(snapshot),
            `${leaseToken}-record`,
          );
          const summary = summarizeReviewHistoryEntry(snapshot);
          const nextIndex: ReviewSummaryIndex = {
            schemaVersion: 1,
            items: [summary, ...index.items.filter((item) => item.id !== id)],
          };
          try {
            await writeAtomically(
              bridge,
              await indexPath(bridge),
              `${JSON.stringify(nextIndex, null, 2)}\n`,
              `${leaseToken}-index`,
            );
          } catch (error) {
            if (previousSource === undefined) await bridge.removeFile(path);
            else {
              await writeAtomically(
                bridge,
                path,
                previousSource,
                `${leaseToken}-rollback`,
              );
            }
            throw new Error(
              `Review record was rolled back because its summary index could not be replaced (previous index ${priorIndex.length} bytes).`,
              { cause: error },
            );
          }
          return {
            status: 'saved' as const,
            descriptor: captureReviewHistoryDescriptor(snapshot),
            summary,
          };
        } catch (error) {
          return { status: 'error' as const, message: message(error) };
        } finally {
          await release?.();
        }
      });
    },
    async delete(id, expected) {
      return serializeWrite(async () => {
        let release: (() => Promise<void>) | undefined;
        const leaseToken = token();
        try {
          release = await acquireLease(bridge, leaseToken);
          const current = await loadRecord(bridge, id);
          if (current.status === 'missing')
            return { status: 'missing' as const };
          if (current.status !== 'loaded') {
            return { status: 'error' as const, message: current.message };
          }
          if (!sameReviewHistoryDescriptor(current.descriptor, expected)) {
            return {
              status: 'conflict' as const,
              message: `Review record ${id} changed after it was read.`,
            };
          }
          const index = await loadIndex(bridge);
          const path = await recordPath(bridge, id);
          const source = serializeReviewHistoryEntry(current.entry);
          await bridge.removeFile(path);
          try {
            await writeAtomically(
              bridge,
              await indexPath(bridge),
              `${JSON.stringify(
                {
                  schemaVersion: 1,
                  items: index.items.filter((item) => item.id !== id),
                },
                null,
                2,
              )}\n`,
              `${leaseToken}-index`,
            );
          } catch (error) {
            await writeAtomically(
              bridge,
              path,
              source,
              `${leaseToken}-rollback`,
            );
            throw error;
          }
          return { status: 'deleted' as const };
        } catch (error) {
          return { status: 'error' as const, message: message(error) };
        } finally {
          await release?.();
        }
      });
    },
  };
}
