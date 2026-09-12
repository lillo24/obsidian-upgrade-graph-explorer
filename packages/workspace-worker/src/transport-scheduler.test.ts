import { describe, expect, it, vi } from 'vitest';

import { createWorkspaceWorkerTransportScheduler } from './transport-scheduler';

interface TestPort {
  postMessage(value: null): void;
  addEventListener(type: 'message', listener: () => void): void;
  close(): void;
}

function controllableMessageChannel() {
  const tasks: Array<() => void> = [];
  let receiveMessage: (() => void) | undefined;
  const port1: TestPort = {
    postMessage: vi.fn(),
    addEventListener: vi.fn((_type, listener) => {
      receiveMessage = listener;
    }),
    close: vi.fn(),
  };
  const port2: TestPort = {
    postMessage: vi.fn(() => {
      tasks.push(() => receiveMessage?.());
    }),
    addEventListener: vi.fn(),
    close: vi.fn(),
  };
  return {
    channel: { port1, port2 },
    runNextTask() {
      tasks.shift()?.();
    },
  };
}

describe('workspace worker transport scheduler', () => {
  it('uses ordered MessageChannel tasks without consulting the timer fallback', async () => {
    const transport = controllableMessageChannel();
    const scheduleTimer = vi.fn();
    const scheduler = createWorkspaceWorkerTransportScheduler({
      createMessageChannel: () => transport.channel,
      scheduleTimer,
    });
    const completions: number[] = [];
    const first = scheduler.yieldToNextTask().then(() => completions.push(1));
    const second = scheduler.yieldToNextTask().then(() => completions.push(2));

    expect(scheduler.kind).toBe('message-channel');
    expect(scheduleTimer).not.toHaveBeenCalled();
    transport.runNextTask();
    await first;
    expect(completions).toEqual([1]);
    transport.runNextTask();
    await second;
    expect(completions).toEqual([1, 2]);
    scheduler.dispose();
  });

  it('retains a timer fallback only when MessageChannel is unavailable', async () => {
    const timers: Array<() => void> = [];
    const scheduler = createWorkspaceWorkerTransportScheduler({
      createMessageChannel: () => undefined,
      scheduleTimer: (callback) => timers.push(callback),
    });
    let completed = false;
    const yielded = scheduler.yieldToNextTask().then(() => (completed = true));

    expect(scheduler.kind).toBe('timer-fallback');
    expect(completed).toBe(false);
    timers.shift()?.();
    await yielded;
    expect(completed).toBe(true);
  });

  it('releases pending continuations when disposed', async () => {
    const transport = controllableMessageChannel();
    const scheduler = createWorkspaceWorkerTransportScheduler({
      createMessageChannel: () => transport.channel,
    });
    const pending = scheduler.yieldToNextTask();

    scheduler.dispose();

    await expect(pending).resolves.toBeUndefined();
    expect(transport.channel.port1.close).toHaveBeenCalledOnce();
    expect(transport.channel.port2.close).toHaveBeenCalledOnce();
  });
});
