import { memo, type ReactNode } from 'react';

export const WorkspaceNotice = memo(function WorkspaceNotice({
  children,
  tone,
}: {
  readonly children: ReactNode;
  readonly tone: 'error' | 'progress' | 'warning';
}) {
  return (
    <p
      aria-live={tone === 'error' ? undefined : 'polite'}
      className={`workspace-notice workspace-notice--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
});
