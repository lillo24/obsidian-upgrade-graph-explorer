import {
  dynamicTargetFromDisplayedTranslation,
  type AppliedFixedTranslationByNodeKey,
  type SpatialPoint,
} from '@icarus-graph-explorer/spatial-overrides';

import {
  TEMPORARY_NODE_CONSTRAINT_SCHEMA_VERSION,
  type EndTemporaryNodeConstraintCommand,
  type TemporaryNodeConstraintCapability,
  type TemporaryNodeConstraintEndReason,
  type TemporaryNodeConstraintPort,
} from './temporary-node-constraint';

export const FILE_MOVE_DRAG_THRESHOLD_PX = 3;

export interface FileMoveGestureBase {
  readonly gestureId: string;
  readonly sessionGeneration: string;
  readonly simulationGeneration: string;
  readonly coordinateGeneration: string;
  readonly nodeKey: string;
  readonly startViewportPoint: SpatialPoint;
  readonly grabOffset: SpatialPoint;
  readonly fixedTranslation: SpatialPoint;
  readonly lastSampleSequence: number;
}

export type FileMoveGestureState =
  | { readonly phase: 'idle' }
  | ({ readonly phase: 'primed' } & FileMoveGestureBase)
  | ({
      readonly phase: 'dragging';
      readonly commandSequence: number;
    } & FileMoveGestureBase);

export type FileMoveGestureEvent =
  | {
      readonly type: 'prime';
      readonly gestureId: string;
      readonly sessionGeneration: string;
      readonly simulationGeneration: string;
      readonly coordinateGeneration: string;
      readonly nodeKey: string;
      readonly startViewportPoint: SpatialPoint;
      readonly startGraphPoint: SpatialPoint;
      readonly displayedNodePoint: SpatialPoint;
      readonly fixedTranslation: SpatialPoint;
    }
  | {
      readonly type: 'move';
      readonly gestureId: string;
      readonly coordinateGeneration: string;
      readonly sampleSequence: number;
      readonly viewportPoint: SpatialPoint;
      readonly graphPoint: SpatialPoint;
    }
  | { readonly type: 'release'; readonly gestureId: string }
  | {
      readonly type: 'cancel' | 'invalidate';
      readonly gestureId: string;
      readonly reason: Exclude<
        TemporaryNodeConstraintEndReason,
        'released' | 'disposed'
      >;
    }
  | { readonly type: 'dispose' };

export type FileMoveGestureEffect =
  | {
      readonly kind: 'begin';
      readonly sessionGeneration: string;
      readonly simulationGeneration: string;
      readonly gestureId: string;
      readonly sequence: number;
      readonly nodeKey: string;
      readonly target: SpatialPoint;
    }
  | {
      readonly kind: 'update';
      readonly sessionGeneration: string;
      readonly simulationGeneration: string;
      readonly gestureId: string;
      readonly sequence: number;
      readonly nodeKey: string;
      readonly target: SpatialPoint;
    }
  | EndTemporaryNodeConstraintCommand;

export interface FileMoveGestureTransition {
  readonly state: FileMoveGestureState;
  readonly effects: readonly FileMoveGestureEffect[];
}

export const IDLE_FILE_MOVE_GESTURE = {
  phase: 'idle',
} as const satisfies FileMoveGestureState;

function finitePoint(point: SpatialPoint, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`${label} must contain finite x/y coordinates.`);
  }
}

function identifier(value: string, label: string): void {
  if (value.length === 0) throw new Error(`${label} must not be empty.`);
}

function sampleSequence(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      'Pointer sample sequence must be a non-negative safe integer.',
    );
  }
}

function targetForPointer(
  state: FileMoveGestureBase,
  graphPoint: SpatialPoint,
): SpatialPoint {
  const displayedTarget = {
    x: graphPoint.x - state.grabOffset.x,
    y: graphPoint.y - state.grabOffset.y,
  };
  return dynamicTargetFromDisplayedTranslation({
    displayedTarget,
    appliedFixedTranslation: state.fixedTranslation,
  });
}

function endEffect(
  state: Extract<FileMoveGestureState, { readonly phase: 'dragging' }>,
  reason: TemporaryNodeConstraintEndReason,
): EndTemporaryNodeConstraintCommand {
  return {
    schemaVersion: TEMPORARY_NODE_CONSTRAINT_SCHEMA_VERSION,
    kind: 'end',
    sessionGeneration: state.sessionGeneration,
    simulationGeneration: state.simulationGeneration,
    gestureId: state.gestureId,
    sequence: state.commandSequence + 1,
    nodeKey: state.nodeKey,
    reason,
  };
}

/** Pure state machine for one transient File constraint. */
export function reduceFileMoveGesture(
  state: FileMoveGestureState,
  event: FileMoveGestureEvent,
): FileMoveGestureTransition {
  switch (event.type) {
    case 'prime': {
      if (state.phase !== 'idle') return { state, effects: [] };
      identifier(event.gestureId, 'Gesture id');
      identifier(event.sessionGeneration, 'Session generation');
      identifier(event.simulationGeneration, 'Simulation generation');
      identifier(event.coordinateGeneration, 'Coordinate generation');
      identifier(event.nodeKey, 'Node key');
      finitePoint(event.startViewportPoint, 'Start viewport point');
      finitePoint(event.startGraphPoint, 'Start graph point');
      finitePoint(event.displayedNodePoint, 'Displayed node point');
      finitePoint(event.fixedTranslation, 'Fixed translation');
      return {
        state: {
          phase: 'primed',
          gestureId: event.gestureId,
          sessionGeneration: event.sessionGeneration,
          simulationGeneration: event.simulationGeneration,
          coordinateGeneration: event.coordinateGeneration,
          nodeKey: event.nodeKey,
          startViewportPoint: { ...event.startViewportPoint },
          grabOffset: {
            x: event.startGraphPoint.x - event.displayedNodePoint.x,
            y: event.startGraphPoint.y - event.displayedNodePoint.y,
          },
          fixedTranslation: { ...event.fixedTranslation },
          lastSampleSequence: -1,
        },
        effects: [],
      };
    }
    case 'move': {
      if (state.phase === 'idle') return { state, effects: [] };
      if (
        event.gestureId !== state.gestureId ||
        event.coordinateGeneration !== state.coordinateGeneration
      ) {
        return { state, effects: [] };
      }
      sampleSequence(event.sampleSequence);
      if (event.sampleSequence <= state.lastSampleSequence) {
        return { state, effects: [] };
      }
      finitePoint(event.viewportPoint, 'Viewport point');
      finitePoint(event.graphPoint, 'Graph point');
      if (
        state.phase === 'primed' &&
        Math.hypot(
          event.viewportPoint.x - state.startViewportPoint.x,
          event.viewportPoint.y - state.startViewportPoint.y,
        ) < FILE_MOVE_DRAG_THRESHOLD_PX
      ) {
        return {
          state: { ...state, lastSampleSequence: event.sampleSequence },
          effects: [],
        };
      }
      const sequence = state.phase === 'primed' ? 0 : state.commandSequence + 1;
      const target = targetForPointer(state, event.graphPoint);
      const next: Extract<FileMoveGestureState, { phase: 'dragging' }> = {
        ...state,
        phase: 'dragging',
        commandSequence: sequence,
        lastSampleSequence: event.sampleSequence,
      };
      return {
        state: next,
        effects: [
          {
            kind: state.phase === 'primed' ? 'begin' : 'update',
            sessionGeneration: state.sessionGeneration,
            simulationGeneration: state.simulationGeneration,
            gestureId: state.gestureId,
            sequence,
            nodeKey: state.nodeKey,
            target,
          },
        ],
      };
    }
    case 'release': {
      if (state.phase === 'idle' || event.gestureId !== state.gestureId) {
        return { state, effects: [] };
      }
      return {
        state: IDLE_FILE_MOVE_GESTURE,
        effects:
          state.phase === 'dragging' ? [endEffect(state, 'released')] : [],
      };
    }
    case 'cancel':
    case 'invalidate': {
      if (state.phase === 'idle' || event.gestureId !== state.gestureId) {
        return { state, effects: [] };
      }
      return {
        state: IDLE_FILE_MOVE_GESTURE,
        effects:
          state.phase === 'dragging' ? [endEffect(state, event.reason)] : [],
      };
    }
    case 'dispose':
      return {
        state: IDLE_FILE_MOVE_GESTURE,
        effects:
          state.phase === 'dragging' ? [endEffect(state, 'disposed')] : [],
      };
  }
}

export type AvailableTemporaryFileMoveSessionContext = {
  readonly active: true;
  readonly capability: { readonly status: 'available' };
  readonly port: TemporaryNodeConstraintPort;
  readonly sessionGeneration: string;
  readonly simulationGeneration: string;
  readonly coordinateGeneration: string;
  readonly fixedTranslationByNodeKey: AppliedFixedTranslationByNodeKey;
};

export type TemporaryFileMoveSessionContext =
  | AvailableTemporaryFileMoveSessionContext
  | {
      readonly active: true;
      readonly capability: Extract<
        TemporaryNodeConstraintCapability,
        { readonly status: 'unavailable' }
      >;
      readonly sessionGeneration: string;
      readonly simulationGeneration: string;
      readonly coordinateGeneration: string;
      readonly fixedTranslationByNodeKey: AppliedFixedTranslationByNodeKey;
    };

export function isAvailableTemporaryFileMoveContext(
  context: TemporaryFileMoveSessionContext,
): context is AvailableTemporaryFileMoveSessionContext {
  return context.capability.status === 'available';
}

export type FileMoveInstrumentationOperation =
  | 'file-move-primes'
  | 'file-move-begins'
  | 'file-move-coalesced-updates'
  | 'file-move-releases'
  | 'file-move-cancels'
  | 'file-move-unavailable-attempts';

export interface FileMoveFrameScheduler {
  readonly request: (callback: () => void) => number;
  readonly cancel: (handle: number) => void;
}

export interface TemporaryFileMoveCoordinatorOptions {
  readonly context: AvailableTemporaryFileMoveSessionContext;
  readonly count?: (operation: FileMoveInstrumentationOperation) => void;
  readonly onDragStart?: (nodeKey: string) => void;
  readonly onError?: (message: string) => void;
  readonly frameScheduler?: FileMoveFrameScheduler;
}

export type TemporaryFileMoveControllerStartResult =
  | { readonly status: 'started' }
  | {
      readonly status: 'unavailable';
      readonly reason: 'simulation-unavailable' | 'node-unavailable';
    };

/**
 * Coarse product-facing controller. Pointer and keyboard callers both enter the
 * same MOVE1A coordinator; viewport samples never pass through React state.
 */
export interface TemporaryFileMoveController {
  readonly start: (nodeKey: string) => TemporaryFileMoveControllerStartResult;
  readonly nudge: (delta: SpatialPoint) => boolean;
  readonly release: () => boolean;
  readonly cancel: (
    reason: Exclude<TemporaryNodeConstraintEndReason, 'released'>,
  ) => boolean;
}

export interface PrimeFileMoveInput {
  readonly gestureId: string;
  readonly nodeKey: string;
  readonly startViewportPoint: SpatialPoint;
  readonly startGraphPoint: SpatialPoint;
  readonly displayedNodePoint: SpatialPoint;
}

/** Imperative raw-pointer coordinator; React state is not on this hot path. */
export class TemporaryFileMoveCoordinator {
  private state: FileMoveGestureState = IDLE_FILE_MOVE_GESTURE;
  private nextSampleSequence = 0;
  private pendingUpdate:
    Extract<FileMoveGestureEffect, { readonly kind: 'update' }> | undefined;
  private frameHandle: number | undefined;
  private suppressReleasedClick = false;
  private readonly scheduler: FileMoveFrameScheduler;

  constructor(private readonly options: TemporaryFileMoveCoordinatorOptions) {
    this.scheduler =
      options.frameScheduler ??
      ({
        request: (callback) => {
          const request = (
            globalThis as {
              requestAnimationFrame?: (
                callback: (timestamp: number) => void,
              ) => number;
            }
          ).requestAnimationFrame;
          if (request === undefined) {
            throw new Error('Animation-frame scheduling is unavailable.');
          }
          return request(() => callback());
        },
        cancel: (handle) => {
          const cancel = (
            globalThis as {
              cancelAnimationFrame?: (handle: number) => void;
            }
          ).cancelAnimationFrame;
          if (cancel === undefined) {
            throw new Error('Animation-frame cancellation is unavailable.');
          }
          cancel(handle);
        },
      } satisfies FileMoveFrameScheduler);
  }

  get phase(): FileMoveGestureState['phase'] {
    return this.state.phase;
  }

  get ownsPointerSequence(): boolean {
    return this.state.phase === 'primed' || this.state.phase === 'dragging';
  }

  get isDragging(): boolean {
    return this.state.phase === 'dragging';
  }

  prime(input: PrimeFileMoveInput): boolean {
    if (this.state.phase !== 'idle') return false;
    const translation =
      this.options.context.fixedTranslationByNodeKey.get(input.nodeKey) ??
      ({ x: 0, y: 0 } as const);
    const transition = reduceFileMoveGesture(this.state, {
      type: 'prime',
      ...input,
      sessionGeneration: this.options.context.sessionGeneration,
      simulationGeneration: this.options.context.simulationGeneration,
      coordinateGeneration: this.options.context.coordinateGeneration,
      fixedTranslation: translation,
    });
    this.state = transition.state;
    this.nextSampleSequence = 0;
    this.options.count?.('file-move-primes');
    return this.state.phase === 'primed';
  }

  move(viewportPoint: SpatialPoint, graphPoint: SpatialPoint): void {
    if (this.state.phase === 'idle') return;
    const gestureId = this.state.gestureId;
    this.apply({
      type: 'move',
      gestureId,
      coordinateGeneration: this.options.context.coordinateGeneration,
      sampleSequence: this.nextSampleSequence++,
      viewportPoint,
      graphPoint,
    });
  }

  release(): boolean {
    if (this.state.phase === 'idle') return false;
    const gestureId = this.state.gestureId;
    const wasDragging = this.state.phase === 'dragging';
    this.apply({ type: 'release', gestureId });
    return wasDragging;
  }

  cancel(
    reason: Exclude<TemporaryNodeConstraintEndReason, 'released'>,
  ): boolean {
    if (this.state.phase === 'idle') return false;
    const gestureId = this.state.gestureId;
    const wasDragging = this.state.phase === 'dragging';
    if (reason === 'disposed') this.apply({ type: 'dispose' });
    else this.apply({ type: 'cancel', gestureId, reason });
    if (!wasDragging) this.options.count?.('file-move-cancels');
    return true;
  }

  invalidate(
    reason: Exclude<TemporaryNodeConstraintEndReason, 'released' | 'disposed'>,
  ): boolean {
    if (this.state.phase === 'idle') return false;
    const gestureId = this.state.gestureId;
    const wasDragging = this.state.phase === 'dragging';
    this.apply({ type: 'invalidate', gestureId, reason });
    if (!wasDragging) this.options.count?.('file-move-cancels');
    return true;
  }

  consumeReleasedDragClick(): boolean {
    const value = this.suppressReleasedClick;
    this.suppressReleasedClick = false;
    return value;
  }

  dispose(): void {
    this.cancel('disposed');
  }

  private apply(event: FileMoveGestureEvent): void {
    try {
      const transition = reduceFileMoveGesture(this.state, event);
      this.state = transition.state;
      for (const effect of transition.effects) this.handleEffect(effect);
    } catch (error: unknown) {
      this.fail(this.state, error);
    }
  }

  private handleEffect(effect: FileMoveGestureEffect): void {
    if (effect.kind === 'begin') {
      this.options.context.port.begin({
        schemaVersion: TEMPORARY_NODE_CONSTRAINT_SCHEMA_VERSION,
        ...effect,
      });
      this.options.count?.('file-move-begins');
      this.options.onDragStart?.(effect.nodeKey);
      return;
    }
    if (effect.kind === 'update') {
      this.pendingUpdate = effect;
      if (this.frameHandle === undefined) {
        this.frameHandle = this.scheduler.request(() => {
          this.frameHandle = undefined;
          try {
            this.flushUpdate();
          } catch (error: unknown) {
            this.fail(this.state, error);
          }
        });
      }
      return;
    }
    if (effect.reason === 'released') {
      this.flushUpdate();
      this.suppressReleasedClick = true;
      this.options.count?.('file-move-releases');
    } else {
      this.dropUpdate();
      this.options.count?.('file-move-cancels');
    }
    this.options.context.port.end(effect);
  }

  private flushUpdate(): void {
    if (this.frameHandle !== undefined) {
      this.scheduler.cancel(this.frameHandle);
      this.frameHandle = undefined;
    }
    const effect = this.pendingUpdate;
    this.pendingUpdate = undefined;
    if (effect === undefined) return;
    this.options.context.port.update({
      schemaVersion: TEMPORARY_NODE_CONSTRAINT_SCHEMA_VERSION,
      ...effect,
    });
    this.options.count?.('file-move-coalesced-updates');
  }

  private dropUpdate(): void {
    if (this.frameHandle !== undefined) {
      this.scheduler.cancel(this.frameHandle);
      this.frameHandle = undefined;
    }
    this.pendingUpdate = undefined;
  }

  private fail(state: FileMoveGestureState, error: unknown): void {
    this.dropUpdate();
    if (state.phase === 'dragging') {
      try {
        this.options.context.port.end(endEffect(state, 'error'));
      } catch {
        // The original port error remains the actionable failure.
      }
    }
    this.state = IDLE_FILE_MOVE_GESTURE;
    this.options.count?.('file-move-cancels');
    this.options.onError?.(
      `File move was canceled: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
