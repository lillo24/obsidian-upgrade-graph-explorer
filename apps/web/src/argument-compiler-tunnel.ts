export type ArgumentCompilerTunnelEnsureStatus =
  'already-running' | 'started' | 'unsupported-platform';

export interface ArgumentCompilerTunnelEnsureResult {
  readonly status: ArgumentCompilerTunnelEnsureStatus;
}

export interface ArgumentCompilerTunnelCapability {
  ensureRunning(): Promise<ArgumentCompilerTunnelEnsureResult>;
}

const ENSURE_STATUSES = new Set<ArgumentCompilerTunnelEnsureStatus>([
  'already-running',
  'started',
  'unsupported-platform',
]);

export function isArgumentCompilerTunnelEnsureResult(
  value: unknown,
): value is ArgumentCompilerTunnelEnsureResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const status = (value as { readonly status?: unknown }).status;
  return (
    typeof status === 'string' &&
    ENSURE_STATUSES.has(status as ArgumentCompilerTunnelEnsureStatus)
  );
}
