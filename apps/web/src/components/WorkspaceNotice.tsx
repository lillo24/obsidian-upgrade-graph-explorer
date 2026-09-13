import {
  memo,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type {
  VaultDiscoveryNativeOperation,
  VaultDiscoveryProgress,
} from '@icarus-graph-explorer/source-provider-tauri';

import { formatVaultOpenElapsed } from '../vault-open-progress';
import type { VaultDiscoveryProgressStore } from '../vault-discovery-progress-store';

const EMPTY_DISCOVERY_STORE = {
  getSnapshot: () => undefined,
  subscribe: () => () => undefined,
};

const OPERATION_LABELS: Record<VaultDiscoveryNativeOperation, string> = {
  'inspect-root': 'vault root inspection',
  'inspect-path': 'vault path inspection',
  'read-directory': 'directory read',
  'join-path': 'path preparation',
  'read-markdown': 'Markdown file read',
};

function discoveryCounters(progress: VaultDiscoveryProgress): string {
  return `Directories ${progress.directoriesRead.toLocaleString()} · Entries ${progress.entriesExamined.toLocaleString()} · Markdown ${progress.markdownFilesRead.toLocaleString()} · Non-Markdown ${progress.nonMarkdownFilesSeen.toLocaleString()} · Depth ${progress.currentRecursionDepth.toLocaleString()} (max ${progress.maximumRecursionDepth.toLocaleString()})`;
}

const WorkspaceNoticeTiming = memo(function WorkspaceNoticeTiming({
  discoveryProgressStore,
  startedAt,
}: {
  readonly discoveryProgressStore?: VaultDiscoveryProgressStore;
  readonly startedAt: number;
}) {
  const store = discoveryProgressStore ?? EMPTY_DISCOVERY_STORE;
  const discoveryProgress = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const [currentTime, setCurrentTime] = useState(startedAt);

  useEffect(() => {
    const updateTime = () => setCurrentTime(performance.now());
    updateTime();
    const interval = window.setInterval(updateTime, 1_000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  const currentOperationElapsed =
    discoveryProgress?.currentOperationStartedAt === undefined
      ? undefined
      : Math.max(0, currentTime - discoveryProgress.currentOperationStartedAt);
  const slowOperation =
    discoveryProgress?.currentOperation !== undefined &&
    discoveryProgress.currentWorkspacePath !== undefined &&
    currentOperationElapsed !== undefined &&
    currentOperationElapsed >= discoveryProgress.slowOperationWarningMs
      ? {
          elapsedSeconds: Math.floor(currentOperationElapsed / 1_000),
          label: OPERATION_LABELS[discoveryProgress.currentOperation],
          workspacePath:
            discoveryProgress.currentWorkspacePath === '.'
              ? 'vault root'
              : discoveryProgress.currentWorkspacePath,
        }
      : undefined;

  return (
    <span aria-hidden="true" className="workspace-notice__timing">
      {discoveryProgress === undefined ? null : (
        <span className="workspace-notice__discovery">
          {discoveryCounters(discoveryProgress)}
        </span>
      )}
      {slowOperation === undefined ? null : (
        <span className="workspace-notice__slow-operation">
          <span>Still waiting for a {slowOperation.label}…</span>
          <span>
            Current item: {slowOperation.workspacePath} · Waiting on current
            operation: {slowOperation.elapsedSeconds.toLocaleString()} s
          </span>
        </span>
      )}
      <span className="workspace-notice__elapsed">
        Elapsed {formatVaultOpenElapsed(currentTime - startedAt)}
      </span>
    </span>
  );
});

export const WorkspaceNotice = memo(function WorkspaceNotice({
  children,
  discoveryProgressStore,
  progressLabel,
  startedAt,
  tone,
}: {
  readonly children: ReactNode;
  readonly discoveryProgressStore?: VaultDiscoveryProgressStore;
  readonly progressLabel?: string;
  readonly startedAt?: number;
  readonly tone: 'error' | 'progress' | 'warning';
}) {
  return (
    <div
      aria-live={tone === 'error' ? undefined : 'polite'}
      className={`workspace-notice workspace-notice--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {progressLabel === undefined ? null : (
        <strong className="workspace-notice__title">{progressLabel}</strong>
      )}
      <span className="workspace-notice__message">{children}</span>
      {progressLabel === undefined ? null : (
        <>
          <span
            aria-label={progressLabel}
            className="workspace-notice__progress"
            role="progressbar"
          >
            <span className="workspace-notice__progress-indicator" />
          </span>
          {startedAt === undefined ? null : (
            <WorkspaceNoticeTiming
              {...(discoveryProgressStore === undefined
                ? {}
                : { discoveryProgressStore })}
              startedAt={startedAt}
            />
          )}
        </>
      )}
    </div>
  );
});
