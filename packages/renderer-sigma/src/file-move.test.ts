import { describe, expect, it, vi } from 'vitest';

import {
  FILE_MOVE_DRAG_THRESHOLD_PX,
  IDLE_FILE_MOVE_GESTURE,
  TemporaryFileMoveCoordinator,
  reduceFileMoveGesture,
  type FileMoveGestureEvent,
  type FileMoveGestureState,
} from './file-move';
import { RecordingTemporaryNodeConstraintPort } from './temporary-node-constraint';

const prime = {
  type: 'prime',
  gestureId: 'gesture-1',
  sessionGeneration: 'session-1',
  simulationGeneration: 'simulation-1',
  coordinateGeneration: 'coordinates-1',
  nodeKey: 'entity:file',
  startViewportPoint: { x: 10, y: 10 },
  startGraphPoint: { x: 12, y: 14 },
  displayedNodePoint: { x: 9, y: 8 },
  fixedTranslation: { x: 5, y: -2 },
} as const satisfies FileMoveGestureEvent;

function next(state: FileMoveGestureState, event: FileMoveGestureEvent) {
  return reduceFileMoveGesture(state, event);
}

describe('File move gesture state machine', () => {
  it('primes without a constraint and starts exactly at the 3px threshold', () => {
    const primed = next(IDLE_FILE_MOVE_GESTURE, prime);
    expect(primed.state.phase).toBe('primed');
    expect(primed.effects).toEqual([]);
    const under = next(primed.state, {
      type: 'move',
      gestureId: prime.gestureId,
      coordinateGeneration: prime.coordinateGeneration,
      sampleSequence: 0,
      viewportPoint: { x: 10 + FILE_MOVE_DRAG_THRESHOLD_PX - 0.01, y: 10 },
      graphPoint: { x: 20, y: 20 },
    });
    expect(under.state.phase).toBe('primed');
    expect(under.effects).toEqual([]);
    const started = next(under.state, {
      type: 'move',
      gestureId: prime.gestureId,
      coordinateGeneration: prime.coordinateGeneration,
      sampleSequence: 1,
      viewportPoint: { x: 10 + FILE_MOVE_DRAG_THRESHOLD_PX, y: 10 },
      graphPoint: { x: 20, y: 30 },
    });
    expect(started.state.phase).toBe('dragging');
    expect(started.effects).toEqual([
      expect.objectContaining({
        kind: 'begin',
        sequence: 0,
        // Grab offset is (3, 6): displayed target (17, 24), then Place (5, -2)
        // is removed once to produce dynamic target (12, 26).
        target: { x: 12, y: 26 },
      }),
    ]);
  });

  it('does not jump when the pointer starts away from the node center', () => {
    const primed = next(IDLE_FILE_MOVE_GESTURE, {
      ...prime,
      fixedTranslation: { x: 0, y: 0 },
    }).state;
    const started = next(primed, {
      type: 'move',
      gestureId: prime.gestureId,
      coordinateGeneration: prime.coordinateGeneration,
      sampleSequence: 0,
      viewportPoint: { x: 13, y: 10 },
      graphPoint: prime.startGraphPoint,
    });
    expect(started.effects[0]).toMatchObject({
      target: prime.displayedNodePoint,
    });
  });

  it('ignores stale gesture, coordinate-generation, and sample events', () => {
    const primed = next(IDLE_FILE_MOVE_GESTURE, prime).state;
    for (const event of [
      {
        type: 'move',
        gestureId: 'stale',
        coordinateGeneration: prime.coordinateGeneration,
        sampleSequence: 0,
        viewportPoint: { x: 20, y: 20 },
        graphPoint: { x: 20, y: 20 },
      },
      {
        type: 'move',
        gestureId: prime.gestureId,
        coordinateGeneration: 'stale',
        sampleSequence: 0,
        viewportPoint: { x: 20, y: 20 },
        graphPoint: { x: 20, y: 20 },
      },
    ] as const) {
      expect(next(primed, event).state).toBe(primed);
    }
    const moved = next(primed, {
      type: 'move',
      gestureId: prime.gestureId,
      coordinateGeneration: prime.coordinateGeneration,
      sampleSequence: 4,
      viewportPoint: { x: 20, y: 20 },
      graphPoint: { x: 20, y: 20 },
    });
    expect(
      next(moved.state, {
        type: 'move',
        gestureId: prime.gestureId,
        coordinateGeneration: prime.coordinateGeneration,
        sampleSequence: 4,
        viewportPoint: { x: 30, y: 30 },
        graphPoint: { x: 30, y: 30 },
      }).effects,
    ).toEqual([]);
  });

  it('releases a primed click without commands and ends a drag once', () => {
    const primed = next(IDLE_FILE_MOVE_GESTURE, prime).state;
    expect(
      next(primed, { type: 'release', gestureId: prime.gestureId }),
    ).toEqual({ state: IDLE_FILE_MOVE_GESTURE, effects: [] });
    const dragging = next(primed, {
      type: 'move',
      gestureId: prime.gestureId,
      coordinateGeneration: prime.coordinateGeneration,
      sampleSequence: 0,
      viewportPoint: { x: 20, y: 20 },
      graphPoint: { x: 20, y: 20 },
    }).state;
    expect(
      next(dragging, { type: 'release', gestureId: prime.gestureId }).effects,
    ).toEqual([
      expect.objectContaining({ kind: 'end', reason: 'released', sequence: 1 }),
    ]);
  });
});

describe('File move frame coordinator', () => {
  function harness() {
    const port = new RecordingTemporaryNodeConstraintPort();
    const frames: (() => void)[] = [];
    const canceled: number[] = [];
    const count = vi.fn();
    const onDragStart = vi.fn();
    const coordinator = new TemporaryFileMoveCoordinator({
      context: {
        active: true,
        capability: { status: 'available' },
        port,
        sessionGeneration: 'session-1',
        simulationGeneration: 'simulation-1',
        coordinateGeneration: 'coordinates-1',
        fixedTranslationByNodeKey: new Map([['entity:file', { x: 5, y: -2 }]]),
      },
      count,
      onDragStart,
      frameScheduler: {
        request: (callback) => {
          frames.push(callback);
          return frames.length;
        },
        cancel: (handle) => canceled.push(handle),
      },
    });
    coordinator.prime({
      gestureId: 'gesture-1',
      nodeKey: 'entity:file',
      startViewportPoint: { x: 0, y: 0 },
      startGraphPoint: { x: 10, y: 10 },
      displayedNodePoint: { x: 10, y: 10 },
    });
    return { canceled, coordinator, count, frames, onDragStart, port };
  }

  it('coalesces raw updates to the latest frame and flushes before release', () => {
    const { coordinator, count, frames, onDragStart, port } = harness();
    expect(
      coordinator.prime({
        gestureId: 'gesture-2',
        nodeKey: 'entity:other',
        startViewportPoint: { x: 0, y: 0 },
        startGraphPoint: { x: 0, y: 0 },
        displayedNodePoint: { x: 0, y: 0 },
      }),
    ).toBe(false);
    coordinator.move({ x: 3, y: 0 }, { x: 13, y: 10 });
    coordinator.move({ x: 4, y: 0 }, { x: 14, y: 10 });
    coordinator.move({ x: 5, y: 0 }, { x: 15, y: 10 });
    expect(frames).toHaveLength(1);
    expect(port.commands).toHaveLength(1);
    frames[0]!();
    expect(port.commands).toEqual([
      expect.objectContaining({ kind: 'begin', sequence: 0 }),
      expect.objectContaining({
        kind: 'update',
        sequence: 2,
        target: { x: 10, y: 12 },
      }),
    ]);
    expect(count).toHaveBeenCalledWith('file-move-coalesced-updates');
    expect(onDragStart).toHaveBeenCalledOnce();

    coordinator.move({ x: 6, y: 0 }, { x: 16, y: 10 });
    expect(coordinator.release()).toBe(true);
    expect(port.commands.slice(-2)).toEqual([
      expect.objectContaining({ kind: 'update', sequence: 3 }),
      expect.objectContaining({ kind: 'end', sequence: 4, reason: 'released' }),
    ]);
    expect(coordinator.consumeReleasedDragClick()).toBe(true);
    expect(coordinator.consumeReleasedDragClick()).toBe(false);
  });

  it('drops pending updates and cleans up exactly once on cancellation', () => {
    const { coordinator, frames, port } = harness();
    coordinator.move({ x: 3, y: 0 }, { x: 13, y: 10 });
    coordinator.move({ x: 4, y: 0 }, { x: 14, y: 10 });
    expect(frames).toHaveLength(1);
    expect(coordinator.invalidate('topology-changed')).toBe(true);
    expect(port.commands).toEqual([
      expect.objectContaining({ kind: 'begin' }),
      expect.objectContaining({ kind: 'end', reason: 'topology-changed' }),
    ]);
    expect(coordinator.invalidate('topology-changed')).toBe(false);
  });

  it.each([
    'cancelled',
    'pointer-lost',
    'mode-exit',
    'workspace-changed',
    'scope-changed',
    'layout-changed',
    'topology-changed',
    'spatial-rules-changed',
    'disposed',
  ] as const)('propagates %s lifecycle cleanup', (reason) => {
    const { coordinator, port } = harness();
    coordinator.move({ x: 3, y: 0 }, { x: 13, y: 10 });
    coordinator.cancel(reason);
    expect(port.commands.at(-1)).toMatchObject({ kind: 'end', reason });
  });

  it('ends and reports a consumer failure instead of retaining pointer ownership', () => {
    const commands: string[] = [];
    const onError = vi.fn();
    let frame: (() => void) | undefined;
    const coordinator = new TemporaryFileMoveCoordinator({
      context: {
        active: true,
        capability: { status: 'available' },
        port: {
          begin: () => commands.push('begin'),
          update: () => {
            throw new Error('consumer unavailable');
          },
          end: (command) => commands.push(`end:${command.reason}`),
        },
        sessionGeneration: 'session-1',
        simulationGeneration: 'simulation-1',
        coordinateGeneration: 'coordinates-1',
        fixedTranslationByNodeKey: new Map(),
      },
      onError,
      frameScheduler: {
        request: (callback) => {
          frame = callback;
          return 1;
        },
        cancel: () => undefined,
      },
    });
    coordinator.prime({
      gestureId: 'gesture-1',
      nodeKey: 'entity:file',
      startViewportPoint: { x: 0, y: 0 },
      startGraphPoint: { x: 0, y: 0 },
      displayedNodePoint: { x: 0, y: 0 },
    });
    coordinator.move({ x: 3, y: 0 }, { x: 3, y: 0 });
    coordinator.move({ x: 4, y: 0 }, { x: 4, y: 0 });
    expect(frame).toBeDefined();
    (frame as () => void)();
    expect(commands).toEqual(['begin', 'end:error']);
    expect(coordinator.ownsPointerSequence).toBe(false);
    expect(onError).toHaveBeenCalledWith(
      'File move was canceled: consumer unavailable',
    );
  });
});
