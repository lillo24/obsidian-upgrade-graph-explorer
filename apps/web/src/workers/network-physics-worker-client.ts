import {
  NETWORK_PHYSICS_SCHEMA_VERSION,
  validateNetworkPhysicsSeed,
  validateNetworkPhysicsWorkerResponse,
  validateTemporaryNodeConstraintCommand,
  type EndTemporaryNodeConstraintCommand,
  type NetworkPhysicsFrameResponse,
  type NetworkPhysicsInvalidateMessage,
  type NetworkPhysicsLifecycleState,
  type NetworkPhysicsPosition,
  type NetworkPhysicsPresentationState,
  type NetworkPhysicsSeed,
  type NetworkPhysicsService,
  type NetworkPhysicsServiceFactoryOptions,
  type NetworkPhysicsWorkerRequest,
  type TemporaryNodeConstraintCommand,
  type TemporaryNodeConstraintCommandBase,
  type UpdateTemporaryNodeConstraintCommand,
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

const RELEASE_PRESENTATION_MAX_DURATION_MS = 120;
const RELEASE_PRESENTATION_FULL_DURATION_DISTANCE = 0.5;
const REGRAB_HANDOFF_DURATION_MS = 80;

interface CoolingPresentation {
  readonly frame: NetworkPhysicsFrameResponse;
  readonly start: readonly NetworkPhysicsPosition[];
  readonly startedAt: number;
  readonly durationMs: number;
}

interface HotHandoff {
  readonly start: readonly NetworkPhysicsPosition[];
  readonly startedAt?: number;
}

function copyPositions(
  positions: readonly NetworkPhysicsPosition[],
): readonly NetworkPhysicsPosition[] {
  return positions.map((position) => ({ ...position }));
}

function positionScale(positions: readonly NetworkPhysicsPosition[]): number {
  let centerX = 0;
  let centerY = 0;
  for (const position of positions) {
    centerX += position.x / positions.length;
    centerY += position.y / positions.length;
  }
  let squaredDistance = 0;
  for (const position of positions) {
    squaredDistance +=
      (position.x - centerX) ** 2 + (position.y - centerY) ** 2;
  }
  return Math.max(1e-6, Math.sqrt(squaredDistance / positions.length));
}

function maximumDisplacement(
  start: readonly NetworkPhysicsPosition[],
  target: readonly NetworkPhysicsPosition[],
): number {
  const startByKey = new Map(start.map((position) => [position.key, position]));
  let maximum = 0;
  for (const position of target) {
    const prior = startByKey.get(position.key);
    if (prior === undefined) continue;
    maximum = Math.max(
      maximum,
      Math.hypot(position.x - prior.x, position.y - prior.y),
    );
  }
  return maximum;
}

function interpolatePositions(
  start: readonly NetworkPhysicsPosition[],
  target: readonly NetworkPhysicsPosition[],
  progress: number,
  exactNode?: { readonly key: string; readonly x: number; readonly y: number },
): readonly NetworkPhysicsPosition[] {
  const startByKey = new Map(start.map((position) => [position.key, position]));
  return target.map((position) => {
    if (position.key === exactNode?.key) return { ...exactNode };
    const prior = startByKey.get(position.key) ?? position;
    return progress >= 1
      ? { ...position }
      : {
          key: position.key,
          x: prior.x + (position.x - prior.x) * progress,
          y: prior.y + (position.y - prior.y) * progress,
        };
  });
}

function easedProgress(progress: number): number {
  const bounded = Math.max(0, Math.min(1, progress));
  return bounded * bounded * (3 - 2 * bounded);
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
    readonly reducedMotion?: boolean;
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
  const reducedMotion =
    options.reducedMotion ??
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ===
      true;
  let seed: NetworkPhysicsSeed | undefined;
  let worker: NetworkPhysicsWorkerTransport | undefined;
  let active: TemporaryNodeConstraintCommandBase | undefined;
  let lastSequence = -1;
  let lastEnd: EndTemporaryNodeConstraintCommand | undefined;
  let latestTarget: { readonly x: number; readonly y: number } | undefined;
  let interactionRevision = 0;
  let inFlightSequence: number | undefined;
  let pendingUpdate: UpdateTemporaryNodeConstraintCommand | undefined;
  let latestFrame: NetworkPhysicsFrameResponse | undefined;
  let scheduledFrame: number | undefined;
  let lastPresentedPositions: readonly NetworkPhysicsPosition[] | undefined;
  let coolingPresentation: CoolingPresentation | undefined;
  let hotHandoff: HotHandoff | undefined;
  let presentationState: NetworkPhysicsPresentationState = 'idle';
  let simulationPositionScale = 1;
  let disposed = false;
  let reportedState: NetworkPhysicsLifecycleState | undefined;
  let lastFrameSequence = 0;
  let expectedNodeIndex: ReadonlyMap<string, number> = new Map();
  let seenNodeMarks = new Uint32Array();
  let validationPass = 0;

  function emitState(state: NetworkPhysicsLifecycleState): void {
    if (reportedState === state) return;
    reportedState = state;
    options.onStateChange?.(state);
  }

  function emitPresentationState(state: NetworkPhysicsPresentationState): void {
    if (presentationState === state) return;
    presentationState = state;
    options.onPresentationStateChange?.(state);
  }

  function cancelFrame(): void {
    if (scheduledFrame !== undefined) {
      scheduler.cancel(scheduledFrame);
      scheduledFrame = undefined;
    }
    latestFrame = undefined;
    coolingPresentation = undefined;
    hotHandoff = undefined;
    emitPresentationState('idle');
  }

  function scheduleFrame(): void {
    if (scheduledFrame !== undefined) return;
    scheduledFrame = scheduler.request(adoptLatestFrame);
  }

  function prepareHotHandoff(): void {
    const presentationWasBehind =
      coolingPresentation !== undefined ||
      (latestFrame !== undefined && latestFrame.state !== 'hot-constrained');
    if (scheduledFrame !== undefined) {
      scheduler.cancel(scheduledFrame);
      scheduledFrame = undefined;
    }
    latestFrame = undefined;
    coolingPresentation = undefined;
    emitPresentationState('idle');
    hotHandoff =
      presentationWasBehind &&
      !reducedMotion &&
      lastPresentedPositions !== undefined
        ? { start: copyPositions(lastPresentedPositions) }
        : undefined;
  }

  function recordImmediateConstraintTarget(
    command: TemporaryNodeConstraintCommand,
  ): void {
    if (command.kind === 'end' || lastPresentedPositions === undefined) return;
    lastPresentedPositions = lastPresentedPositions.map((position) =>
      position.key === command.nodeKey
        ? { key: position.key, ...command.target }
        : position,
    );
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
    latestTarget = undefined;
    inFlightSequence = undefined;
    pendingUpdate = undefined;
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

  function frameMatchesCurrentInteraction(
    frame: NetworkPhysicsFrameResponse,
  ): boolean {
    const interaction = active ?? lastEnd;
    if (
      interaction === undefined ||
      frame.interactionRevision !== interactionRevision ||
      frame.gestureId !== interaction.gestureId ||
      frame.constraintNodeKey !== interaction.nodeKey ||
      frame.commandSequence > lastSequence
    ) {
      return false;
    }
    if (active !== undefined) {
      return (
        frame.state === 'hot-constrained' &&
        frame.constraintSequence !== null &&
        frame.constraintSequence <= lastSequence
      );
    }
    return (
      frame.state !== 'hot-constrained' && frame.constraintSequence === null
    );
  }

  function frameWithLatestConstraintTarget(
    frame: NetworkPhysicsFrameResponse,
  ): NetworkPhysicsFrameResponse {
    if (active === undefined || latestTarget === undefined) return frame;
    const nodeKey = active.nodeKey;
    const target = latestTarget;
    return {
      ...frame,
      positions: frame.positions.map((position) =>
        position.key === nodeKey
          ? { key: position.key, x: target.x, y: target.y }
          : position,
      ),
    };
  }

  function present(frame: NetworkPhysicsFrameResponse): void {
    lastPresentedPositions = copyPositions(frame.positions);
    options.onFrame(frame);
    emitState(frame.state);
  }

  function coolingDuration(
    start: readonly NetworkPhysicsPosition[],
    target: readonly NetworkPhysicsPosition[],
  ): number {
    if (reducedMotion) return 0;
    const normalized =
      maximumDisplacement(start, target) / simulationPositionScale;
    return Math.min(
      RELEASE_PRESENTATION_MAX_DURATION_MS,
      (normalized / RELEASE_PRESENTATION_FULL_DURATION_DISTANCE) *
        RELEASE_PRESENTATION_MAX_DURATION_MS,
    );
  }

  function presentedCoolingPositions(
    presentation: CoolingPresentation,
    timestamp: number,
  ): readonly NetworkPhysicsPosition[] {
    const progress =
      presentation.durationMs === 0
        ? 1
        : Math.min(
            1,
            Math.max(0, timestamp - presentation.startedAt) /
              presentation.durationMs,
          );
    return interpolatePositions(
      presentation.start,
      presentation.frame.positions,
      easedProgress(progress),
    );
  }

  function adoptLatestFrame(timestamp: number): void {
    scheduledFrame = undefined;
    const frame = latestFrame;
    latestFrame = undefined;
    if (frame !== undefined) {
      if (seed === undefined) return;
      if (
        frame.sessionGeneration !== seed.sessionGeneration ||
        frame.simulationGeneration !== seed.simulationGeneration ||
        !frameMatchesCurrentInteraction(frame)
      ) {
        return;
      }
      const adopted = frameWithLatestConstraintTarget(frame);
      if (adopted.state === 'hot-constrained') {
        coolingPresentation = undefined;
        emitPresentationState('idle');
        const handoff = hotHandoff;
        if (handoff === undefined || reducedMotion) {
          hotHandoff = undefined;
          present(adopted);
          return;
        }
        const startedAt = handoff.startedAt ?? timestamp;
        if (handoff.startedAt === undefined) {
          hotHandoff = { ...handoff, startedAt };
        }
        const progress = Math.min(
          1,
          Math.max(0, timestamp - startedAt) / REGRAB_HANDOFF_DURATION_MS,
        );
        const target = latestTarget;
        const positions = interpolatePositions(
          handoff.start,
          adopted.positions,
          easedProgress(progress),
          target === undefined || active === undefined
            ? undefined
            : { key: active.nodeKey, ...target },
        );
        if (progress >= 1) hotHandoff = undefined;
        present({ ...adopted, positions });
        return;
      }
      const start = coolingPresentation
        ? presentedCoolingPositions(coolingPresentation, timestamp)
        : (lastPresentedPositions ??
          seed.nodes.map(({ key, x, y }) => ({ key, x, y })));
      coolingPresentation = {
        frame: adopted,
        start: copyPositions(start),
        startedAt: timestamp,
        durationMs: coolingDuration(start, adopted.positions),
      };
      if (coolingPresentation.durationMs > 0) {
        emitPresentationState('settling');
        present({ ...adopted, positions: start });
        scheduleFrame();
        return;
      }
    }
    const presentation = coolingPresentation;
    if (presentation === undefined) return;
    if (!frameMatchesCurrentInteraction(presentation.frame)) {
      coolingPresentation = undefined;
      emitPresentationState('idle');
      return;
    }
    const progress =
      presentation.durationMs === 0
        ? 1
        : Math.min(
            1,
            Math.max(0, timestamp - presentation.startedAt) /
              presentation.durationMs,
          );
    present({
      ...presentation.frame,
      positions: presentedCoolingPositions(presentation, timestamp),
    });
    if (progress >= 1) {
      coolingPresentation = undefined;
      emitPresentationState('idle');
    } else scheduleFrame();
  }

  function validateFrameNodeSet(frame: NetworkPhysicsFrameResponse): boolean {
    if (seed === undefined || frame.positions.length !== seed.nodes.length) {
      reportFailure(
        'Network physics worker frame does not match the initialized node set.',
      );
      return false;
    }
    if (validationPass === 0xffff_ffff) {
      seenNodeMarks.fill(0);
      validationPass = 0;
    }
    validationPass += 1;
    for (const position of frame.positions) {
      const index = expectedNodeIndex.get(position.key);
      if (index === undefined || seenNodeMarks[index] === validationPass) {
        reportFailure(
          `Network physics worker frame has an unknown or duplicate node ${position.key}.`,
        );
        return false;
      }
      seenNodeMarks[index] = validationPass;
    }
    return true;
  }

  function postConstraint(command: TemporaryNodeConstraintCommand): void {
    ensureWorker().postMessage({
      schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
      kind: 'constraint',
      command,
    });
    inFlightSequence = command.sequence;
  }

  function acknowledgeAndFlush(frame: NetworkPhysicsFrameResponse): void {
    if (
      inFlightSequence === undefined ||
      frame.commandSequence < inFlightSequence
    ) {
      return;
    }
    inFlightSequence = undefined;
    const update = pendingUpdate;
    pendingUpdate = undefined;
    if (active !== undefined && update !== undefined) postConstraint(update);
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
        if (!frameMatchesCurrentInteraction(response)) return;
        if (!validateFrameNodeSet(response)) return;
        lastFrameSequence = response.frameSequence;
        acknowledgeAndFlush(response);
        options.onRawFrame?.(response);
        latestFrame = response;
        scheduleFrame();
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
      prepareHotHandoff();
      active = { ...command };
      lastSequence = 0;
      lastEnd = undefined;
      latestTarget = { ...command.target };
      interactionRevision += 1;
      pendingUpdate = undefined;
      inFlightSequence = undefined;
    } else if (command.kind === 'update') {
      if (active === undefined || !sameConstraint(active, command)) {
        throw new Error(
          'Temporary constraint update does not match the active gesture.',
        );
      }
      if (command.sequence <= lastSequence) {
        throw new Error('Temporary constraint update sequence is stale.');
      }
      lastSequence = command.sequence;
      latestTarget = { ...command.target };
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
      active = undefined;
      lastSequence = command.sequence;
      lastEnd = { ...command };
      latestTarget = undefined;
    }
    recordImmediateConstraintTarget(command);
    options.onConstraint(command);
    if (command.kind === 'begin') {
      postConstraint(command);
    } else if (command.kind === 'update') {
      if (inFlightSequence === undefined) postConstraint(command);
      else pendingUpdate = { ...command, target: { ...command.target } };
    } else {
      const update = pendingUpdate;
      pendingUpdate = undefined;
      if (update !== undefined) postConstraint(update);
      postConstraint(command);
    }
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
      latestTarget = undefined;
      interactionRevision = 0;
      inFlightSequence = undefined;
      pendingUpdate = undefined;
      lastFrameSequence = 0;
      lastPresentedPositions = nextSeed.nodes.map(({ key, x, y }) => ({
        key,
        x,
        y,
      }));
      simulationPositionScale = positionScale(lastPresentedPositions);
      expectedNodeIndex = new Map(
        nextSeed.nodes.map(({ key }, index) => [key, index] as const),
      );
      seenNodeMarks = new Uint32Array(nextSeed.nodes.length);
      validationPass = 0;
      emitPresentationState('idle');
      emitState('sleeping');
    },
    invalidate(reason: NetworkPhysicsInvalidateMessage['reason']) {
      if (disposed) return;
      active = undefined;
      lastSequence = -1;
      lastEnd = undefined;
      latestTarget = undefined;
      interactionRevision = 0;
      inFlightSequence = undefined;
      pendingUpdate = undefined;
      lastFrameSequence = 0;
      cancelFrame();
      lastPresentedPositions = seed?.nodes.map(({ key, x, y }) => ({
        key,
        x,
        y,
      }));
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
      latestTarget = undefined;
      inFlightSequence = undefined;
      pendingUpdate = undefined;
      seed = undefined;
      lastPresentedPositions = undefined;
      emitState('disposed');
    },
  };
}
