import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrowserPerformanceSession } from './performance';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubBrowserClock() {
  let clock = 0;
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('window', { location: { search: '' } });
  vi.stubGlobal('performance', { now: () => clock });
  vi.stubGlobal(
    'requestAnimationFrame',
    (callback: FrameRequestCallback): number => {
      frames.push(callback);
      return frames.length;
    },
  );
  return {
    advance(milliseconds: number) {
      clock += milliseconds;
    },
    flushFrames() {
      while (frames.length > 0) {
        const scheduled = frames.splice(0);
        for (const callback of scheduled) callback(clock);
      }
    },
  };
}

describe('browser performance session', () => {
  it('is disabled when neither explicit opt-in is present', () => {
    expect(createBrowserPerformanceSession('')).toBeUndefined();
    expect(createBrowserPerformanceSession('?performance=0')).toBeUndefined();
  });

  it('supports an explicit diagnostic build flag for Tauri', () => {
    stubBrowserClock();
    expect(createBrowserPerformanceSession('', true)).toBeDefined();
  });

  it('isolates a source switch from a stale scheduled live paint', () => {
    const clock = stubBrowserClock();
    const session = createBrowserPerformanceSession('?performance=1');
    if (session === undefined)
      throw new Error('The explicit performance session was not created.');

    session.begin('I16-live-markdown', 'live-1');
    session.instrumentation.markNextPaint();
    session.begin('I1-initial-view-preparation');
    clock.advance(5);
    clock.flushFrames();

    expect(session.snapshot().phases['next-paint']).toBeUndefined();
    session.instrumentation.markNextPaint();
    clock.advance(8);
    clock.flushFrames();
    expect(session.snapshot().phases['next-paint']?.medianMs).toBe(13);
  });
});
