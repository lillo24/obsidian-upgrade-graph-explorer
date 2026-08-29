import type { PerformanceSampleSummary } from './types';

function finiteDuration(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `Performance duration must be finite and non-negative; received ${value}.`,
    );
  }
  return Number(value.toFixed(3));
}

function percentile(sorted: readonly number[], proportion: number): number {
  const index = Math.max(0, Math.ceil(sorted.length * proportion) - 1);
  const value = sorted[index];
  if (value === undefined) throw new Error('Cannot summarize an empty sample.');
  return value;
}

export function summarizePerformanceDurations(
  valuesMs: readonly number[],
  warmupCount: number,
): PerformanceSampleSummary {
  if (!Number.isSafeInteger(warmupCount) || warmupCount < 0) {
    throw new Error(
      'Performance warm-up count must be a non-negative integer.',
    );
  }
  if (valuesMs.length === 0) {
    throw new Error('At least one measured performance sample is required.');
  }
  const values = valuesMs.map(finiteDuration);
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2
      : (sorted[midpoint] ?? 0);
  return {
    warmupCount,
    sampleCount: values.length,
    medianMs: Number(median.toFixed(3)),
    p95Ms: percentile(sorted, 0.95),
    maximumMs: sorted.at(-1) ?? 0,
    valuesMs: values,
  };
}

export function measureRepeated<Value>(input: {
  readonly warmupCount: number;
  readonly sampleCount: number;
  readonly now: () => number;
  readonly run: () => Value;
}): { readonly summary: PerformanceSampleSummary; readonly lastValue: Value } {
  if (!Number.isSafeInteger(input.sampleCount) || input.sampleCount < 1) {
    throw new Error('Performance sample count must be a positive integer.');
  }
  for (let index = 0; index < input.warmupCount; index += 1) input.run();
  const durations: number[] = [];
  let lastValue: Value | undefined;
  let completed = false;
  for (let index = 0; index < input.sampleCount; index += 1) {
    const start = input.now();
    lastValue = input.run();
    completed = true;
    durations.push(input.now() - start);
  }
  if (!completed) {
    throw new Error('Performance measurement completed without a result.');
  }
  return {
    summary: summarizePerformanceDurations(durations, input.warmupCount),
    lastValue: lastValue as Value,
  };
}
