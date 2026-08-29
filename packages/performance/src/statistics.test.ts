import { describe, expect, it } from 'vitest';

import { measureRepeated, summarizePerformanceDurations } from './statistics';

describe('performance statistics', () => {
  it('reports deterministic median, nearest-rank p95, and raw samples', () => {
    expect(summarizePerformanceDurations([5, 1, 4, 2, 3], 2)).toEqual({
      warmupCount: 2,
      sampleCount: 5,
      medianMs: 3,
      p95Ms: 5,
      maximumMs: 5,
      valuesMs: [5, 1, 4, 2, 3],
    });
  });

  it('excludes warm-ups and executes the requested repeated samples', () => {
    let clock = 0;
    let runs = 0;
    const measured = measureRepeated({
      warmupCount: 2,
      sampleCount: 3,
      now: () => clock,
      run: () => {
        runs += 1;
        clock += 4;
        return runs;
      },
    });
    expect(runs).toBe(5);
    expect(measured.lastValue).toBe(5);
    expect(measured.summary.valuesMs).toEqual([4, 4, 4]);
  });
});
