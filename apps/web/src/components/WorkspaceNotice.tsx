import { memo, useEffect, useState, type ReactNode } from 'react';

import { formatVaultOpenElapsed } from '../vault-open-progress';

const WorkspaceNoticeElapsed = memo(function WorkspaceNoticeElapsed({
  startedAt,
}: {
  readonly startedAt: number;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const updateElapsed = () =>
      setElapsedMs(Math.max(0, performance.now() - startedAt));
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  return (
    <span aria-hidden="true" className="workspace-notice__elapsed">
      Elapsed {formatVaultOpenElapsed(elapsedMs)}
    </span>
  );
});

export const WorkspaceNotice = memo(function WorkspaceNotice({
  children,
  progressLabel,
  startedAt,
  tone,
}: {
  readonly children: ReactNode;
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
            <WorkspaceNoticeElapsed startedAt={startedAt} />
          )}
        </>
      )}
    </div>
  );
});
