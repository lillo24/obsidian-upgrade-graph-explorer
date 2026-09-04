import type { SpatialPoint } from '@icarus-graph-explorer/spatial-overrides';

export const TEMPORARY_NODE_CONSTRAINT_SCHEMA_VERSION = 1 as const;

export type TemporaryNodeConstraintEndReason =
  | 'released'
  | 'cancelled'
  | 'pointer-lost'
  | 'mode-exit'
  | 'workspace-changed'
  | 'scope-changed'
  | 'layout-changed'
  | 'topology-changed'
  | 'spatial-rules-changed'
  | 'disposed'
  | 'error';

const TEMPORARY_NODE_CONSTRAINT_END_REASONS =
  new Set<TemporaryNodeConstraintEndReason>([
    'released',
    'cancelled',
    'pointer-lost',
    'mode-exit',
    'workspace-changed',
    'scope-changed',
    'layout-changed',
    'topology-changed',
    'spatial-rules-changed',
    'disposed',
    'error',
  ]);

export interface TemporaryNodeConstraintCommandBase {
  readonly schemaVersion: typeof TEMPORARY_NODE_CONSTRAINT_SCHEMA_VERSION;
  readonly sessionGeneration: string;
  readonly simulationGeneration: string;
  readonly gestureId: string;
  readonly sequence: number;
  readonly nodeKey: string;
}

export interface BeginTemporaryNodeConstraintCommand extends TemporaryNodeConstraintCommandBase {
  readonly kind: 'begin';
  /** Dynamic/simulation-space target, never a displayed Place-composed point. */
  readonly target: SpatialPoint;
}

export interface UpdateTemporaryNodeConstraintCommand extends TemporaryNodeConstraintCommandBase {
  readonly kind: 'update';
  /** Dynamic/simulation-space target, never a displayed Place-composed point. */
  readonly target: SpatialPoint;
}

export interface EndTemporaryNodeConstraintCommand extends TemporaryNodeConstraintCommandBase {
  readonly kind: 'end';
  readonly reason: TemporaryNodeConstraintEndReason;
}

export type TemporaryNodeConstraintCommand =
  | BeginTemporaryNodeConstraintCommand
  | UpdateTemporaryNodeConstraintCommand
  | EndTemporaryNodeConstraintCommand;

/**
 * Narrow PHYSICS1-facing seam. It intentionally contains no simulation
 * tuning, worker instance, Graphology object, Sigma object, or persistence.
 */
export interface TemporaryNodeConstraintPort {
  readonly begin: (command: BeginTemporaryNodeConstraintCommand) => void;
  readonly update: (command: UpdateTemporaryNodeConstraintCommand) => void;
  readonly end: (command: EndTemporaryNodeConstraintCommand) => void;
}

export type TemporaryNodeConstraintCapability =
  | { readonly status: 'available' }
  | {
      readonly status: 'unavailable';
      readonly reason:
        | 'simulation-unavailable'
        | 'simulation-not-running'
        | 'unsupported-view';
    };

export const TEMPORARY_NODE_CONSTRAINT_UNAVAILABLE = {
  status: 'unavailable',
  reason: 'simulation-unavailable',
} as const satisfies TemporaryNodeConstraintCapability;

function requireIdentifier(value: string, label: string): void {
  if (value.length === 0) throw new Error(`${label} must not be empty.`);
}

function requireSequence(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Constraint sequence must be a non-negative safe integer.');
  }
}

function requireTarget(value: SpatialPoint): void {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error('Constraint target must contain finite x/y coordinates.');
  }
}

export function validateTemporaryNodeConstraintCommand(
  command: TemporaryNodeConstraintCommand,
): void {
  if (command.schemaVersion !== TEMPORARY_NODE_CONSTRAINT_SCHEMA_VERSION) {
    throw new Error('Unsupported temporary constraint schema version.');
  }
  requireIdentifier(command.sessionGeneration, 'Session generation');
  requireIdentifier(command.simulationGeneration, 'Simulation generation');
  requireIdentifier(command.gestureId, 'Gesture id');
  requireIdentifier(command.nodeKey, 'Node key');
  requireSequence(command.sequence);
  if (command.kind === 'end') {
    if (!TEMPORARY_NODE_CONSTRAINT_END_REASONS.has(command.reason)) {
      throw new Error('Temporary constraint end reason is invalid.');
    }
  } else requireTarget(command.target);
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

function copyCommand(
  command: TemporaryNodeConstraintCommand,
): TemporaryNodeConstraintCommand {
  return command.kind === 'end'
    ? { ...command }
    : { ...command, target: { ...command.target } };
}

/** Strict in-memory fake for renderer-session tests and development harnesses. */
export class RecordingTemporaryNodeConstraintPort implements TemporaryNodeConstraintPort {
  private active: TemporaryNodeConstraintCommandBase | undefined;
  private lastSequence = -1;
  private lastEnd: EndTemporaryNodeConstraintCommand | undefined;
  private readonly recorded: TemporaryNodeConstraintCommand[] = [];

  get commands(): readonly TemporaryNodeConstraintCommand[] {
    return this.recorded.map(copyCommand);
  }

  begin(command: BeginTemporaryNodeConstraintCommand): void {
    validateTemporaryNodeConstraintCommand(command);
    if (this.active !== undefined) {
      throw new Error('A temporary node constraint is already active.');
    }
    if (command.sequence !== 0) {
      throw new Error('A temporary node constraint must begin at sequence 0.');
    }
    this.active = { ...command };
    this.lastSequence = command.sequence;
    this.lastEnd = undefined;
    this.recorded.push(copyCommand(command));
  }

  update(command: UpdateTemporaryNodeConstraintCommand): void {
    validateTemporaryNodeConstraintCommand(command);
    if (this.active === undefined || !sameConstraint(this.active, command)) {
      throw new Error(
        'Temporary constraint update does not match the active gesture.',
      );
    }
    if (command.sequence <= this.lastSequence) {
      throw new Error('Temporary constraint update sequence is stale.');
    }
    this.lastSequence = command.sequence;
    this.recorded.push(copyCommand(command));
  }

  end(command: EndTemporaryNodeConstraintCommand): void {
    validateTemporaryNodeConstraintCommand(command);
    if (
      this.active === undefined &&
      this.lastEnd !== undefined &&
      sameConstraint(this.lastEnd, command)
    ) {
      if (
        this.lastEnd.sequence === command.sequence &&
        this.lastEnd.reason === command.reason
      ) {
        return;
      }
      throw new Error('Temporary constraint end conflicts with prior cleanup.');
    }
    if (this.active === undefined || !sameConstraint(this.active, command)) {
      throw new Error(
        'Temporary constraint end does not match the active gesture.',
      );
    }
    if (command.sequence <= this.lastSequence) {
      throw new Error('Temporary constraint end sequence is stale.');
    }
    this.lastSequence = command.sequence;
    this.lastEnd = { ...command };
    this.active = undefined;
    this.recorded.push(copyCommand(command));
  }
}
