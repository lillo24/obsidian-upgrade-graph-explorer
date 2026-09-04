import { describe, expect, it } from 'vitest';

import {
  RecordingTemporaryNodeConstraintPort,
  TEMPORARY_NODE_CONSTRAINT_SCHEMA_VERSION,
  validateTemporaryNodeConstraintCommand,
} from './temporary-node-constraint';

const base = {
  schemaVersion: TEMPORARY_NODE_CONSTRAINT_SCHEMA_VERSION,
  sessionGeneration: 'session-1',
  simulationGeneration: 'simulation-4',
  gestureId: 'gesture-7',
  nodeKey: 'entity:file',
} as const;

describe('temporary node constraint port contract', () => {
  it('records a plain monotonic begin/update/end lifecycle', () => {
    const port = new RecordingTemporaryNodeConstraintPort();
    port.begin({ ...base, kind: 'begin', sequence: 0, target: { x: 1, y: 2 } });
    port.update({
      ...base,
      kind: 'update',
      sequence: 4,
      target: { x: 3, y: 5 },
    });
    port.end({ ...base, kind: 'end', sequence: 5, reason: 'released' });
    expect(port.commands).toEqual([
      { ...base, kind: 'begin', sequence: 0, target: { x: 1, y: 2 } },
      { ...base, kind: 'update', sequence: 4, target: { x: 3, y: 5 } },
      { ...base, kind: 'end', sequence: 5, reason: 'released' },
    ]);
    expect(JSON.parse(JSON.stringify(port.commands))).toEqual(port.commands);
  });

  it('makes duplicate cleanup idempotent but rejects concurrent and stale work', () => {
    const port = new RecordingTemporaryNodeConstraintPort();
    const begin = {
      ...base,
      kind: 'begin' as const,
      sequence: 0,
      target: { x: 1, y: 2 },
    };
    port.begin(begin);
    expect(() => port.begin(begin)).toThrow('already active');
    expect(() =>
      port.update({
        ...base,
        kind: 'update',
        sequence: 0,
        target: { x: 3, y: 4 },
      }),
    ).toThrow('stale');
    const end = {
      ...base,
      kind: 'end' as const,
      sequence: 1,
      reason: 'cancelled' as const,
    };
    port.end(end);
    port.end(end);
    expect(port.commands).toHaveLength(2);
  });

  it('rejects malformed identifiers, sequences, targets, and mismatched generations', () => {
    expect(() =>
      validateTemporaryNodeConstraintCommand({
        ...base,
        gestureId: '',
        kind: 'begin',
        sequence: 0,
        target: { x: 0, y: 0 },
      }),
    ).toThrow('Gesture id');
    expect(() =>
      validateTemporaryNodeConstraintCommand({
        ...base,
        kind: 'update',
        sequence: 0.5,
        target: { x: 0, y: 0 },
      }),
    ).toThrow('sequence');
    expect(() =>
      validateTemporaryNodeConstraintCommand({
        ...base,
        kind: 'begin',
        sequence: 0,
        target: { x: Number.NaN, y: 0 },
      }),
    ).toThrow('finite');

    const port = new RecordingTemporaryNodeConstraintPort();
    port.begin({ ...base, kind: 'begin', sequence: 0, target: { x: 0, y: 0 } });
    expect(() =>
      port.update({
        ...base,
        simulationGeneration: 'stale',
        kind: 'update',
        sequence: 1,
        target: { x: 0, y: 0 },
      }),
    ).toThrow('does not match');
  });
});
