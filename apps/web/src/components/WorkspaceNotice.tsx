import { memo, type ReactNode } from 'react';

export const WorkspaceNotice = memo(function WorkspaceNotice({
  children,
  elapsed,
  progressLabel,
  tone,
}: {
  readonly children: ReactNode;
  readonly elapsed?: string;
  readonly progressLabel?: string;
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
          {elapsed === undefined ? null : (
            <span aria-hidden="true" className="workspace-notice__elapsed">
              Elapsed {elapsed}
            </span>
          )}
        </>
      )}
    </div>
  );
});
