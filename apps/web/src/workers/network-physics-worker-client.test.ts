import { describe, expect, it, vi } from 'vitest';

import {
  NETWORK_PHYSICS_SCHEMA_VERSION,
  type NetworkPhysicsFrameResponse,
  type NetworkPhysicsSeed,
  type NetworkPhysicsWorkerResponse,
} from '@icarus-graph-explorer/renderer-sigma/physics';

import {
  createNetworkPhysicsWorkerService,
  type NetworkPhysicsWorkerTransport,
} from './network-physics-worker-client';

class FakeWorker implements NetworkPhysicsWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly messages: unknown[] = [];
  readonly terminate = vi.fn();

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  emit(message: NetworkPhysicsWorkerResponse | unknown): void {
    this.onmessage?.({ data: message } as MessageEvent<unknown>);
  }
}

function seed(): NetworkPhysicsSeed {
  return {
    schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
    kind: 'initialize',
    mode: 'focus',
    sessionGeneration: 'session-1',
    simulationGeneration: 'simulation-1',
    rootKey: 'a',
    nodes: [
      { key: 'a', x: 0, y: 0, size: 3, constraintEligible: true },
      { key: 'b', x: 10, y: 0, size: 3, constraintEligible: true },
    ],
    edges: [{ key: 'ab', source: 'a', target: 'b', weight: 1 }],
    settings: {
      edgeWeightInfluence: 1,
      scalingRatio: 1.35,
      strongGravityMode: true,
      gravity: 0.08,
      barnesHutThreshold: 600,
    },
    attractors: [],
    automaticFolderFieldPolicy: 'none',
  };
}

function begin() {
  return {
    schemaVersion: 1 as const,
    kind: 'begin' as const,
    sessionGeneration: 'session-1',
    simulationGeneration: 'simulation-1',
    gestureId: 'gesture-1',
    sequence: 0,
    nodeKey: 'a',
    target: { x: 20, y: -12 },
  };
}

function end() {
  return {
    ...begin(),
    kind: 'end' as const,
    sequence: 1,
    reason: 'released' as const,
  };
}

function update(
  sequence: number,
  target = { x: 20 + sequence, y: -12 - sequence },
) {
  return {
    ...begin(),
    kind: 'update' as const,
    sequence,
    target,
  };
}

function frame(
  frameSequence: number,
  overrides: Partial<NetworkPhysicsFrameResponse> = {},
): NetworkPhysicsFrameResponse {
  return {
    schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
    kind: 'frame',
    sessionGeneration: 'session-1',
    simulationGeneration: 'simulation-1',
    state: 'hot-constrained',
    frameSequence,
    iterationsCompleted: frameSequence * 4,
    interactionRevision: 1,
    gestureId: 'gesture-1',
    constraintNodeKey: 'a',
    commandSequence: 0,
    constraintSequence: 0,
    positions: [
      { key: 'a', x: 20, y: -12 },
      { key: 'b', x: 10 + frameSequence, y: 0 },
    ],
    ...overrides,
  };
}

describe('createNetworkPhysicsWorkerService', () => {
  it('stays lazy until begin and posts initialize before the constraint', () => {
    const worker = new FakeWorker();
    const createWorker = vi.fn(() => worker);
    const onConstraint = vi.fn();
    const service = createNetworkPhysicsWorkerService({
      createWorker,
      onFrame: vi.fn(),
      onConstraint,
      onFailure: vi.fn(),
    });

    service.initialize(seed());
    expect(createWorker).not.toHaveBeenCalled();
    service.begin(begin());
    expect(createWorker).toHaveBeenCalledOnce();
    expect(worker.messages).toEqual([
      seed(),
      {
        schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
        kind: 'constraint',
        command: begin(),
      },
    ]);
    expect(onConstraint).toHaveBeenCalledWith(begin());
  });

  it('coalesces whole-graph frames to the newest response per animation frame', () => {
    const worker = new FakeWorker();
    const callbacks: FrameRequestCallback[] = [];
    const onFrame = vi.fn();
    const service = createNetworkPhysicsWorkerService({
      createWorker: () => worker,
      scheduler: {
        request(callback) {
          callbacks.push(callback);
          return callbacks.length;
        },
        cancel: vi.fn(),
      },
      onFrame,
      onConstraint: vi.fn(),
      onFailure: vi.fn(),
    });
    service.initialize(seed());
    service.begin(begin());
    worker.emit(frame(1));
    worker.emit(frame(2));
    expect(callbacks).toHaveLength(1);
    expect(onFrame).not.toHaveBeenCalled();
    callbacks[0]!(0);
    expect(onFrame).toHaveBeenCalledOnce();
    expect(onFrame).toHaveBeenCalledWith(frame(2));
  });

  it('fails explicitly when an otherwise valid frame omits an initialized node', () => {
    const worker = new FakeWorker();
    const onFailure = vi.fn();
    const service = createNetworkPhysicsWorkerService({
      createWorker: () => worker,
      scheduler: { request: vi.fn(() => 1), cancel: vi.fn() },
      onFrame: vi.fn(),
      onConstraint: vi.fn(),
      onFailure,
    });
    service.initialize(seed());
    service.begin(begin());

    worker.emit(frame(1, { positions: [{ key: 'a', x: 20, y: -12 }] }));

    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failed',
        message: expect.stringContaining('initialized node set'),
      }),
    );
  });

  it('adopts lagging neighbor progress while keeping the File at the newest target', () => {
    const worker = new FakeWorker();
    const callbacks: FrameRequestCallback[] = [];
    const onFrame = vi.fn();
    const service = createNetworkPhysicsWorkerService({
      createWorker: () => worker,
      scheduler: {
        request(callback) {
          callbacks.push(callback);
          return callbacks.length;
        },
        cancel: vi.fn(),
      },
      onFrame,
      onConstraint: vi.fn(),
      onFailure: vi.fn(),
    });
    service.initialize(seed());
    service.begin(begin());
    service.update(update(1));
    worker.emit(frame(1));
    service.update(update(2, { x: 99, y: 44 }));

    callbacks[0]!(0);

    expect(onFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        positions: [
          { key: 'a', x: 99, y: 44 },
          { key: 'b', x: 11, y: 0 },
        ],
      }),
    );
    expect(
      worker.messages.filter(
        (message) => (message as { kind?: string }).kind === 'constraint',
      ),
    ).toEqual([
      expect.objectContaining({ command: begin() }),
      expect.objectContaining({ command: update(1) }),
    ]);
  });

  it('keeps adopting when the Worker remains one target behind for sustained input', () => {
    const worker = new FakeWorker();
    const callbacks: FrameRequestCallback[] = [];
    const onFrame = vi.fn();
    const service = createNetworkPhysicsWorkerService({
      createWorker: () => worker,
      scheduler: {
        request(callback) {
          callbacks.push(callback);
          return callbacks.length;
        },
        cancel: vi.fn(),
      },
      onFrame,
      onConstraint: vi.fn(),
      onFailure: vi.fn(),
    });
    service.initialize(seed());
    service.begin(begin());

    for (let sequence = 1; sequence <= 120; sequence += 1) {
      service.update(update(sequence));
      worker.emit(
        frame(sequence, {
          commandSequence: sequence - 1,
          constraintSequence: sequence - 1,
        }),
      );
      callbacks.at(-1)!(sequence * 16);
    }

    expect(onFrame).toHaveBeenCalledTimes(120);
    expect(onFrame.mock.calls.at(-1)?.[0].positions).toEqual([
      { key: 'a', x: 140, y: -132 },
      { key: 'b', x: 130, y: 0 },
    ]);
  });

  it('does not cancel a queued matching frame when another target arrives before RAF', () => {
    const worker = new FakeWorker();
    const callbacks: FrameRequestCallback[] = [];
    const cancel = vi.fn();
    const onFrame = vi.fn();
    const service = createNetworkPhysicsWorkerService({
      createWorker: () => worker,
      scheduler: {
        request(callback) {
          callbacks.push(callback);
          return callbacks.length;
        },
        cancel,
      },
      onFrame,
      onConstraint: vi.fn(),
      onFailure: vi.fn(),
    });
    service.initialize(seed());
    service.begin(begin());
    worker.emit(frame(1));
    service.update(update(1, { x: 77, y: -31 }));

    expect(cancel).not.toHaveBeenCalled();
    callbacks[0]!(0);
    expect(onFrame.mock.calls[0]?.[0].positions[0]).toEqual({
      key: 'a',
      x: 77,
      y: -31,
    });
  });

  it('bounds sustained updates and flushes only the newest pending target', () => {
    const worker = new FakeWorker();
    const service = createNetworkPhysicsWorkerService({
      createWorker: () => worker,
      scheduler: { request: vi.fn(() => 1), cancel: vi.fn() },
      onFrame: vi.fn(),
      onConstraint: vi.fn(),
      onFailure: vi.fn(),
    });
    service.initialize(seed());
    service.begin(begin());
    for (let sequence = 1; sequence <= 120; sequence += 1) {
      service.update(update(sequence));
    }
    expect(worker.messages).toHaveLength(2);

    worker.emit(frame(1));

    expect(worker.messages).toHaveLength(3);
    expect(worker.messages.at(-1)).toMatchObject({
      kind: 'constraint',
      command: { kind: 'update', sequence: 120 },
    });
  });

  it('preserves the newest target before an end while keeping the queue bounded', () => {
    const worker = new FakeWorker();
    const service = createNetworkPhysicsWorkerService({
      createWorker: () => worker,
      scheduler: { request: vi.fn(() => 1), cancel: vi.fn() },
      onFrame: vi.fn(),
      onConstraint: vi.fn(),
      onFailure: vi.fn(),
    });
    service.initialize(seed());
    service.begin(begin());
    for (let sequence = 1; sequence <= 80; sequence += 1) {
      service.update(update(sequence));
    }
    service.end({ ...end(), sequence: 81 });

    expect(
      worker.messages
        .filter(
          (message) => (message as { kind?: string }).kind === 'constraint',
        )
        .map(
          (message) =>
            (message as { command: { kind: string; sequence: number } })
              .command,
        ),
    ).toEqual([
      expect.objectContaining({ kind: 'begin', sequence: 0 }),
      expect.objectContaining({ kind: 'update', sequence: 80 }),
      expect.objectContaining({ kind: 'end', sequence: 81 }),
    ]);
  });

  it('rejects delayed frames across gestures at receipt and adoption', () => {
    const worker = new FakeWorker();
    const callbacks: FrameRequestCallback[] = [];
    const onFrame = vi.fn();
    const service = createNetworkPhysicsWorkerService({
      createWorker: () => worker,
      scheduler: {
        request(callback) {
          callbacks.push(callback);
          return callbacks.length;
        },
        cancel: vi.fn(),
      },
      onFrame,
      onConstraint: vi.fn(),
      onFailure: vi.fn(),
    });
    service.initialize(seed());
    service.begin(begin());
    worker.emit(frame(1));
    service.end(end());
    service.begin({
      ...begin(),
      gestureId: 'gesture-2',
      nodeKey: 'b',
      target: { x: 99, y: 0 },
    });

    callbacks[0]!(0);
    worker.emit(frame(2));
    expect(onFrame).not.toHaveBeenCalled();

    worker.emit(
      frame(3, {
        interactionRevision: 2,
        gestureId: 'gesture-2',
        constraintNodeKey: 'b',
        positions: [
          { key: 'a', x: 12, y: 0 },
          { key: 'b', x: 99, y: 0 },
        ],
      }),
    );
    callbacks[1]!(0);
    expect(onFrame).toHaveBeenCalledOnce();
    expect(onFrame.mock.calls[0]?.[0]).toMatchObject({
      interactionRevision: 2,
      gestureId: 'gesture-2',
      constraintNodeKey: 'b',
    });
  });

  it('reports coarse lifecycle transitions and reheats the same worker', () => {
    const worker = new FakeWorker();
    const createWorker = vi.fn(() => worker);
    const onStateChange = vi.fn();
    const service = createNetworkPhysicsWorkerService({
      createWorker,
      onFrame: vi.fn(),
      onConstraint: vi.fn(),
      onFailure: vi.fn(),
      onStateChange,
    });

    service.initialize(seed());
    expect(onStateChange).toHaveBeenLastCalledWith('sleeping');
    service.begin(begin());
    worker.emit({
      schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
      kind: 'state',
      sessionGeneration: 'session-1',
      simulationGeneration: 'simulation-1',
      state: 'hot-constrained',
    });
    service.end(end());
    worker.emit({
      schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
      kind: 'state',
      sessionGeneration: 'session-1',
      simulationGeneration: 'simulation-1',
      state: 'cooling',
    });
    worker.emit({
      schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
      kind: 'state',
      sessionGeneration: 'session-1',
      simulationGeneration: 'simulation-1',
      state: 'sleeping',
    });
    service.begin({ ...begin(), gestureId: 'gesture-2' });
    worker.emit({
      schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
      kind: 'state',
      sessionGeneration: 'session-1',
      simulationGeneration: 'simulation-1',
      state: 'hot-constrained',
    });

    expect(createWorker).toHaveBeenCalledOnce();
    expect(onStateChange.mock.calls.map(([state]) => state)).toEqual([
      'sleeping',
      'hot-constrained',
      'cooling',
      'sleeping',
      'hot-constrained',
    ]);
  });

  it('ignores stale generations and rejects stale command sequences', () => {
    const worker = new FakeWorker();
    const onFrame = vi.fn();
    const service = createNetworkPhysicsWorkerService({
      createWorker: () => worker,
      scheduler: { request: vi.fn(() => 1), cancel: vi.fn() },
      onFrame,
      onConstraint: vi.fn(),
      onFailure: vi.fn(),
    });
    service.initialize(seed());
    service.begin(begin());
    worker.emit({ ...frame(1), simulationGeneration: 'stale' });
    expect(onFrame).not.toHaveBeenCalled();
    expect(() =>
      service.update({ ...begin(), kind: 'update', sequence: 0 }),
    ).toThrow('sequence is stale');
  });

  it('terminates work on invalidation and disposal', () => {
    const first = new FakeWorker();
    const second = new FakeWorker();
    const workers = [first, second];
    const service = createNetworkPhysicsWorkerService({
      createWorker: () => workers.shift()!,
      onFrame: vi.fn(),
      onConstraint: vi.fn(),
      onFailure: vi.fn(),
    });
    service.initialize(seed());
    service.begin(begin());
    service.invalidate('topology-changed');
    expect(first.messages.at(-1)).toMatchObject({
      kind: 'invalidate',
      reason: 'topology-changed',
    });
    expect(first.terminate).toHaveBeenCalledOnce();

    service.initialize({ ...seed(), simulationGeneration: 'simulation-2' });
    service.begin({
      ...begin(),
      simulationGeneration: 'simulation-2',
    });
    service.dispose();
    expect(second.messages.at(-1)).toMatchObject({ kind: 'dispose' });
    expect(second.terminate).toHaveBeenCalledOnce();
  });

  it('reports malformed worker output as an explicit failure', () => {
    const worker = new FakeWorker();
    const onFailure = vi.fn();
    const service = createNetworkPhysicsWorkerService({
      createWorker: () => worker,
      onFrame: vi.fn(),
      onConstraint: vi.fn(),
      onFailure,
    });
    service.initialize(seed());
    service.begin(begin());

    expect(() => worker.emit({ kind: 'frame' })).not.toThrow();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'simulation-error',
        state: 'failed',
        message: expect.stringContaining('malformed output'),
      }),
    );
  });
});
