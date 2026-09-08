import {
  NETWORK_PHYSICS_SCHEMA_VERSION,
  validateNetworkPhysicsSeed,
  validateNetworkPhysicsWorkerResponse,
  validateTemporaryNodeConstraintCommand,
  type EndTemporaryNodeConstraintCommand,
  type NetworkPhysicsFrameResponse,
  type NetworkPhysicsInvalidateMessage,
  type NetworkPhysicsLifecycleState,
  type NetworkPhysicsSeed,
  type NetworkPhysicsService,
  type NetworkPhysicsServiceFactoryOptions,
  type NetworkPhysicsWorkerRequest,
  type TemporaryNodeConstraintCommand,
  type TemporaryNodeConstraintCommandBase,
} from '@icarus-graph-explorer/renderer-sigma/core';

export interface NetworkPhysicsWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: NetworkPhysicsWorkerRequest): void;
  terminate(): void;
}

interface FrameScheduler {
  readonly request: (callback: FrameRequestCallback) => number;
  readonly cancel: (handle: number) => void;
}

function sameConstraint(
  left: TemporaryNodeConstraintCommandBase,
  right: TemporaryNodeConstraintCommandBase,
): boolean {
  return (
    left.sessionGeneration === right.sessionGeneration &&
    left.simulationGeneration === right.simulationGeneration &&
    left.gestureId === right.gestureId &&
    left.nodeKey === right.nodeKey
  );
}

export function createNetworkPhysicsWorkerService(
  options: NetworkPhysicsServiceFactoryOptions & {
    readonly createWorker?: () => NetworkPhysicsWorkerTransport;
    readonly scheduler?: FrameScheduler;
  },
): NetworkPhysicsService {
  const createWorker =
    options.createWorker ??
    (() =>
      new Worker(new URL('./network-physics.worker.ts', import.meta.url), {
        type: 'module',
      }));
  const scheduler =
    options.scheduler ??
    ({
      request: (callback) => requestAnimationFrame(callback),
      cancel: (handle) => cancelAnimationFrame(handle),
    } satisfies FrameScheduler);
  let seed: NetworkPhysicsSeed | undefined;
  let worker: NetworkPhysicsWorkerTransport | undefined;
  let active: TemporaryNodeConstraintCommandBase | undefined;
  let lastSequence = -1;
  let lastEnd: EndTemporaryNodeConstraintCommand | undefined;
  let latestFrame: NetworkPhysicsFrameResponse | undefined;
  let scheduledFrame: number | undefined;
  let disposed = false;
  let reportedState: NetworkPhysicsLifecycleState | undefined;
  let lastFrameSequence = 0;

  function emitState(state: NetworkPhysicsLifecycleState): void {
    if (reportedState === state) return;
    reportedState = state;
    options.onStateChange?.(state);
  }

  function cancelFrame(): void {
    if (scheduledFrame === undefined) return;
    scheduler.cancel(scheduledFrame);
    scheduledFrame = undefined;
    latestFrame = undefined;
  }

  function terminate(): void {
    if (worker === undefined) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
    worker = undefined;
  }

  function reportFailure(message: string): Error {
    const current = seed;
    terminate();
    cancelFrame();
    active = undefined;
    if (current !== undefined) {
      emitState('failed');
      options.onFailure({
        schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
        kind: 'failure',
        sessionGeneration: current.sessionGeneration,
        simulationGeneration: current.simulationGeneration,
        state: 'failed',
        code: 'simulation-error',
        message,
        iterationsCompleted: 0,
      });
    }
    return new Error(message);
  }

  function adoptLatestFrame(): void {
    scheduledFrame = undefined;
    const frame = latestFrame;
    latestFrame = undefined;
    if (frame === undefined || seed === undefined) return;
    if (
      frame.sessionGeneration !== seed.sessionGeneration ||
      frame.simulationGeneration !== seed.simulationGeneration
    ) {
      return;
    }
    options.onFrame(frame);
    emitState(frame.state);
  }

  function validateFrameNodeSet(frame: NetworkPhysicsFrameResponse): boolean {
    if (seed === undefined || frame.positions.length !== seed.nodes.length) {
      reportFailure(
        'Network physics worker frame does not match the initialized node set.',
      );
      return false;
    }
    const expected = new Set(seed.nodes.map(({ key }) => key));
    for (const position of frame.positions) {
      if (!expected.delete(position.key)) {
        reportFailure(
          `Network physics worker frame has an unknown or duplicate node ${position.key}.`,
        );
        return false;
      }
    }
    if (expected.size !== 0) {
      reportFailure('Network physics worker frame omitted initialized nodes.');
      return false;
    }
    return true;
  }

  function ensureWorker(): NetworkPhysicsWorkerTransport {
    if (seed === undefined) {
      throw new Error('Network physics service has not been initialized.');
    }
    if (worker !== undefined) return worker;
    let next: NetworkPhysicsWorkerTransport;
    try {
      next = createWorker();
    } catch (error: unknown) {
      throw reportFailure(
        `Network physics worker could not start: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    worker = next;
    next.onmessage = (event) => {
      try {
        validateNetworkPhysicsWorkerResponse(event.data);
      } catch (error: unknown) {
        reportFailure(
          `Network physics worker returned malformed output: ${error instanceof Error ? error.message : String(error)}`,
        );
        return;
      }
      const response = event.data;
      if (
        seed === undefined ||
        response.sessionGeneration !== seed.sessionGeneration ||
        response.simulationGeneration !== seed.simulationGeneration
      ) {
        return;
      }
      if (response.kind === 'frame') {
        if (response.frameSequence <= lastFrameSequence) return;
        if (
          (active === undefined && response.constraintSequence !== null) ||
          (active !== undefined && response.constraintSequence !== lastSequence)
        ) {
          return;
        }
        if (!validateFrameNodeSet(response)) return;
        lastFrameSequence = response.frameSequence;
        latestFrame = response;
        if (scheduledFrame === undefined) {
          scheduledFrame = scheduler.request(adoptLatestFrame);
        }
      } else if (response.kind === 'failure') {
        terminate();
        cancelFrame();
        active = undefined;
        emitState('failed');
        options.onFailure(response);
      } else emitState(response.state);
    };
    next.onerror = (event) => {
      reportFailure(
        `Network physics worker error: ${event.message || 'unknown error'}`,
      );
    };
    next.onmessageerror = () => {
      reportFailure('Network physics worker response could not be cloned.');
    };
    next.postMessage(seed);
    return next;
  }

  function send(command: TemporaryNodeConstraintCommand): void {
    if (disposed) throw new Error('Network physics service is disposed.');
    validateTemporaryNodeConstraintCommand(command);
    if (seed === undefined) {
      throw new Error('Network physics service has not been initialized.');
    }
    if (
      command.sessionGeneration !== seed.sessionGeneration ||
      command.simulationGeneration !== seed.simulationGeneration
    ) {
      throw new Error('Temporary constraint generation is stale.');
    }
    if (command.kind === 'begin') {
      if (active !== undefined) {
        throw new Error('A temporary node constraint is already active.');
      }
      if (command.sequence !== 0) {
        throw new Error(
          'A temporary node constraint must begin at sequence 0.',
        );
      }
      active = { ...command };
      lastSequence = 0;
      lastEnd = undefined;
    } else if (command.kind === 'update') {
      if (active === undefined || !sameConstraint(active, command)) {
        throw new Error(
          'Temporary constraint update does not match the active gesture.',
        );
      }
      if (command.sequence <= lastSequence) {
        throw new Error('Temporary constraint update sequence is stale.');
      }
      cancelFrame();
      lastSequence = command.sequence;
    } else {
      if (
        active === undefined &&
        lastEnd !== undefined &&
        sameConstraint(lastEnd, command)
      ) {
        if (
          lastEnd.sequence === command.sequence &&
          lastEnd.reason === command.reason
        ) {
          return;
        }
        throw new Error(
          'Temporary constraint end conflicts with prior cleanup.',
        );
      }
      if (active === undefined || !sameConstraint(active, command)) {
        throw new Error(
          'Temporary constraint end does not match the active gesture.',
        );
      }
      if (command.sequence <= lastSequence) {
        throw new Error('Temporary constraint end sequence is stale.');
      }
      cancelFrame();
      active = undefined;
      lastSequence = command.sequence;
      lastEnd = { ...command };
    }
    options.onConstraint(command);
    ensureWorker().postMessage({
      schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
      kind: 'constraint',
      command,
    });
  }

  return {
    initialize(nextSeed) {
      if (disposed) throw new Error('Network physics service is disposed.');
      validateNetworkPhysicsSeed(nextSeed);
      terminate();
      cancelFrame();
      seed = nextSeed;
      active = undefined;
      lastSequence = -1;
      lastEnd = undefined;
      lastFrameSequence = 0;
      emitState('sleeping');
    },
    invalidate(reason: NetworkPhysicsInvalidateMessage['reason']) {
      if (disposed) return;
      active = undefined;
      lastSequence = -1;
      lastEnd = undefined;
      lastFrameSequence = 0;
      cancelFrame();
      if (worker !== undefined) {
        worker.postMessage({
          schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
          kind: 'invalidate',
          reason,
        });
        terminate();
      }
      emitState('sleeping');
    },
    begin: send,
    update: send,
    end: send,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelFrame();
      if (worker !== undefined) {
        worker.postMessage({
          schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
          kind: 'dispose',
        });
      }
      terminate();
      active = undefined;
      seed = undefined;
      emitState('disposed');
    },
  };
}
