import { describe, expect, it } from 'vitest';

import { createRuntimePerformanceRecorder } from './recorder';

describe('runtime performance recorder', () => {
  it('records only explicit in-memory measurements and counters', () => {
    let clock = 10;
    const recorder = createRuntimePerformanceRecorder({
      now: () => clock,
      markNextPaint: (record) => record(7),
    });
    expect(
      recorder.measure('project-view', 'projections', () => {
        clock += 3;
        return 'value';
      }),
    ).toBe('value');
    recorder.markCommit('graph-explorer-commit');
    recorder.markNextPaint();
    const snapshot = recorder.snapshot();
    expect(snapshot.operations.projections).toBe(1);
    expect(snapshot.phases['project-view']?.medianMs).toBe(3);
    expect(snapshot.phases['next-paint']?.medianMs).toBe(7);
  });
});
