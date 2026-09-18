import {
  VaultDiscoveryTimeoutError,
  type DiscoverSelectedVaultOptions,
  type VaultDiscoveryCompletedOperation,
  type VaultDiscoveryNativeOperation,
  type VaultDiscoveryProgress,
  type VaultDiscoveryWorkspacePath,
} from './types';

export const VAULT_DISCOVERY_SLOW_OPERATION_WARNING_MS = 3_000;
export const VAULT_DISCOVERY_OPERATION_TIMEOUT_MS = 60_000;

export interface VaultDiscoveryTracker {
  throwIfAborted(): void;
  setRecursionDepth(depth: number): void;
  examineEntry(): void;
  recordDirectoryRead(): void;
  recordMarkdownRead(bytesRead: number): void;
  recordNonMarkdownFile(): void;
  operation<T>(
    operation: VaultDiscoveryNativeOperation,
    workspacePath: VaultDiscoveryWorkspacePath,
    task: () => Promise<T>,
  ): Promise<T>;
}

function positiveDuration(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite duration.`);
  }
  return value;
}

export function createVaultDiscoveryTracker(
  options: DiscoverSelectedVaultOptions,
): VaultDiscoveryTracker {
  const slowOperationWarningMs = positiveDuration(
    options.slowOperationWarningMs,
    VAULT_DISCOVERY_SLOW_OPERATION_WARNING_MS,
    'Vault discovery slowOperationWarningMs',
  );
  const operationTimeoutMs = positiveDuration(
    options.operationTimeoutMs,
    VAULT_DISCOVERY_OPERATION_TIMEOUT_MS,
    'Vault discovery operationTimeoutMs',
  );
  let directoriesRead = 0;
  let entriesExamined = 0;
  let markdownFilesRead = 0;
  let nonMarkdownFilesSeen = 0;
  let bytesRead = 0;
  let currentRecursionDepth = 0;
  let maximumRecursionDepth = 0;
  let current:
    | {
        readonly operation: VaultDiscoveryNativeOperation;
        readonly workspacePath: VaultDiscoveryWorkspacePath;
        readonly startedAt: number;
      }
    | undefined;
  let lastCompletedOperation: VaultDiscoveryCompletedOperation | undefined;

  function snapshot(): VaultDiscoveryProgress {
    return {
      directoriesRead,
      entriesExamined,
      markdownFilesRead,
      nonMarkdownFilesSeen,
      bytesRead,
      currentRecursionDepth,
      maximumRecursionDepth,
      slowOperationWarningMs,
      ...(current === undefined
        ? {}
        : {
            currentOperation: current.operation,
            currentWorkspacePath: current.workspacePath,
            currentOperationStartedAt: current.startedAt,
          }),
      ...(lastCompletedOperation === undefined
        ? {}
        : { lastCompletedOperation }),
    };
  }

  function publish(): void {
    try {
      options.onProgress?.(snapshot());
    } catch {
      // Discovery progress is observer-only and cannot control acquisition.
    }
  }

  return {
    throwIfAborted() {
      options.signal?.throwIfAborted();
    },
    setRecursionDepth(depth) {
      if (currentRecursionDepth === depth) return;
      currentRecursionDepth = depth;
      maximumRecursionDepth = Math.max(maximumRecursionDepth, depth);
      publish();
    },
    examineEntry() {
      entriesExamined += 1;
      publish();
    },
    recordDirectoryRead() {
      directoriesRead += 1;
      publish();
    },
    recordMarkdownRead(readBytes) {
      markdownFilesRead += 1;
      bytesRead += readBytes;
      publish();
    },
    recordNonMarkdownFile() {
      nonMarkdownFilesSeen += 1;
      publish();
    },
    async operation(operation, workspacePath, task) {
      options.signal?.throwIfAborted();
      const startedAt = performance.now();
      current = { operation, workspacePath, startedAt };
      publish();
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_resolve, reject) => {
        watchdog = setTimeout(
          () =>
            reject(
              new VaultDiscoveryTimeoutError(
                operation,
                workspacePath,
                operationTimeoutMs,
                snapshot(),
              ),
            ),
          operationTimeoutMs,
        );
      });
      let abort: (() => void) | undefined;
      const aborted = new Promise<never>((_resolve, reject) => {
        if (options.signal === undefined) return;
        abort = () => reject(options.signal?.reason);
        options.signal.addEventListener('abort', abort, { once: true });
      });
      try {
        const result = await Promise.race([task(), timeout, aborted]);
        const durationMs = Number((performance.now() - startedAt).toFixed(3));
        lastCompletedOperation = { operation, workspacePath, durationMs };
        current = undefined;
        publish();
        return result;
      } finally {
        if (watchdog !== undefined) clearTimeout(watchdog);
        if (abort !== undefined) {
          options.signal?.removeEventListener('abort', abort);
        }
      }
    },
  };
}
