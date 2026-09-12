export type WorkspaceWorkerTransportSchedulerKind =
  'message-channel' | 'timer-fallback';

export interface WorkspaceWorkerTransportScheduler {
  readonly kind: WorkspaceWorkerTransportSchedulerKind;
  yieldToNextTask(): Promise<void>;
  dispose(): void;
}

interface TransportMessagePort {
  postMessage(value: null): void;
  addEventListener(type: 'message', listener: () => void): void;
  start?(): void;
  close?(): void;
}

interface TransportMessageChannel {
  readonly port1: TransportMessagePort;
  readonly port2: TransportMessagePort;
}

interface WorkspaceWorkerTransportSchedulerOptions {
  readonly createMessageChannel?: () => TransportMessageChannel | undefined;
  readonly scheduleTimer?: (callback: () => void) => void;
}

function createNativeMessageChannel(): TransportMessageChannel | undefined {
  if (typeof MessageChannel !== 'function') return undefined;
  return new MessageChannel();
}

/**
 * Schedules transport continuation as an event-loop task without depending on
 * background-throttled window timers. Window and Dedicated Worker runtimes use
 * MessageChannel; the timer path is retained only for runtimes without it.
 */
export function createWorkspaceWorkerTransportScheduler(
  options: WorkspaceWorkerTransportSchedulerOptions = {},
): WorkspaceWorkerTransportScheduler {
  const createMessageChannel =
    options.createMessageChannel ?? createNativeMessageChannel;
  let channel: TransportMessageChannel | undefined;
  try {
    channel = createMessageChannel();
  } catch {
    channel = undefined;
  }

  if (channel === undefined) {
    let disposed = false;
    const pending = new Set<() => void>();
    const scheduleTimer =
      options.scheduleTimer ?? ((callback) => setTimeout(callback, 0));
    return {
      kind: 'timer-fallback',
      yieldToNextTask() {
        if (disposed) return Promise.resolve();
        return new Promise<void>((resolve) => {
          pending.add(resolve);
          scheduleTimer(() => {
            if (pending.delete(resolve)) resolve();
          });
        });
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const resolve of pending) resolve();
        pending.clear();
      },
    };
  }

  let disposed = false;
  const pending: Array<() => void> = [];
  channel.port1.addEventListener('message', () => pending.shift()?.());
  channel.port1.start?.();

  return {
    kind: 'message-channel',
    yieldToNextTask() {
      if (disposed) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        pending.push(resolve);
        try {
          channel.port2.postMessage(null);
        } catch (error: unknown) {
          if (pending.at(-1) === resolve) pending.pop();
          reject(error);
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      channel.port1.close?.();
      channel.port2.close?.();
      for (const resolve of pending.splice(0)) resolve();
    },
  };
}
