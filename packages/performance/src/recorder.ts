import { summarizePerformanceDurations } from './statistics';
import {
  PERFORMANCE_OPERATIONS,
  emptyPerformanceOperationCounts,
  type PerformanceInstrumentation,
  type PerformanceOperation,
  type PerformanceOperationCounts,
  type PerformancePhase,
  type PerformanceSampleSummary,
} from './types';

export interface RuntimePerformanceSnapshot {
  readonly phases: Readonly<
    Partial<Record<PerformancePhase, PerformanceSampleSummary>>
  >;
  readonly operations: PerformanceOperationCounts;
}

export interface RuntimePerformanceRecorder extends PerformanceInstrumentation {
  readonly snapshot: () => RuntimePerformanceSnapshot;
  readonly reset: () => void;
}

export function createRuntimePerformanceRecorder(input: {
  readonly now: () => number;
  readonly markNextPaint: (record: (durationMs: number) => void) => void;
}): RuntimePerformanceRecorder {
  const phases = new Map<PerformancePhase, number[]>();
  let operations = emptyPerformanceOperationCounts();
  let interactionStart = input.now();

  function record(phase: PerformancePhase, durationMs: number): void {
    const values = phases.get(phase) ?? [];
    values.push(durationMs);
    phases.set(phase, values);
  }

  function count(operation: PerformanceOperation, amount = 1): void {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new Error(
        'Performance operation increments must be non-negative integers.',
      );
    }
    operations = { ...operations, [operation]: operations[operation] + amount };
  }

  return {
    measure(phase, operation, run) {
      const start = input.now();
      try {
        return run();
      } finally {
        record(phase, input.now() - start);
        if (operation !== undefined) count(operation);
      }
    },
    record,
    count,
    markCommit(phase) {
      record(phase, input.now() - interactionStart);
    },
    markNextPaint() {
      const start = interactionStart;
      input.markNextPaint((durationMs) =>
        record('next-paint', durationMs || input.now() - start),
      );
    },
    snapshot() {
      return {
        phases: Object.fromEntries(
          [...phases].map(([phase, values]) => [
            phase,
            summarizePerformanceDurations(values, 0),
          ]),
        ),
        operations: { ...operations },
      };
    },
    reset() {
      phases.clear();
      operations = emptyPerformanceOperationCounts();
      interactionStart = input.now();
    },
  };
}

export function isPerformanceOperation(
  value: string,
): value is PerformanceOperation {
  return (PERFORMANCE_OPERATIONS as readonly string[]).includes(value);
}
