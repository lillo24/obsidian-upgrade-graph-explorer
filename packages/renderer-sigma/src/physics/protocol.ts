import {
  validateTemporaryNodeConstraintCommand,
  type TemporaryNodeConstraintCommand,
  type TemporaryNodeConstraintEndReason,
  type TemporaryNodeConstraintPort,
} from '../temporary-node-constraint';

export const NETWORK_PHYSICS_SCHEMA_VERSION = 2 as const;

export type NetworkPhysicsMode = 'focus' | 'all';
export type NetworkPhysicsLifecycleState =
  'sleeping' | 'hot-constrained' | 'cooling' | 'failed' | 'disposed';

export interface NetworkPhysicsNode {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  /** Only canonical File/document nodes may receive a temporary constraint. */
  readonly constraintEligible: boolean;
}

export interface NetworkPhysicsEdge {
  readonly key: string;
  readonly source: string;
  readonly target: string;
  /** Already includes Focus hierarchy/reference weighting when applicable. */
  readonly weight: number;
}

export interface NetworkPhysicsSettings {
  readonly edgeWeightInfluence: number;
  readonly scalingRatio: number;
  readonly strongGravityMode: boolean;
  readonly gravity: number;
  readonly barnesHutThreshold: number;
}

export interface NetworkPhysicsAttractor {
  readonly ruleFolderKey: string;
  readonly memberNodeKeys: readonly string[];
  readonly targetX: number;
  readonly targetY: number;
  /** Same normalized 0..100 strength used by saved Pull rules. */
  readonly strength: number;
}

export interface NetworkPhysicsSeed {
  readonly schemaVersion: typeof NETWORK_PHYSICS_SCHEMA_VERSION;
  readonly kind: 'initialize';
  readonly mode: NetworkPhysicsMode;
  readonly sessionGeneration: string;
  readonly simulationGeneration: string;
  readonly rootKey?: string;
  readonly nodes: readonly NetworkPhysicsNode[];
  readonly edges: readonly NetworkPhysicsEdge[];
  readonly settings: NetworkPhysicsSettings;
  readonly attractors: readonly NetworkPhysicsAttractor[];
  /**
   * M2 is an output-only base-layout field. All Move starts from that shaped
   * snapshot but deliberately does not feed or reapply the field per tick.
   */
  readonly automaticFolderFieldPolicy: 'none' | 'seeded-output-relaxation';
}

export interface NetworkPhysicsConstraintMessage {
  readonly schemaVersion: typeof NETWORK_PHYSICS_SCHEMA_VERSION;
  readonly kind: 'constraint';
  readonly command: TemporaryNodeConstraintCommand;
}

export interface NetworkPhysicsInvalidateMessage {
  readonly schemaVersion: typeof NETWORK_PHYSICS_SCHEMA_VERSION;
  readonly kind: 'invalidate';
  readonly reason: Extract<
    TemporaryNodeConstraintEndReason,
    | 'workspace-changed'
    | 'scope-changed'
    | 'layout-changed'
    | 'topology-changed'
    | 'spatial-rules-changed'
  >;
}

export interface NetworkPhysicsDisposeMessage {
  readonly schemaVersion: typeof NETWORK_PHYSICS_SCHEMA_VERSION;
  readonly kind: 'dispose';
}

export type NetworkPhysicsWorkerRequest =
  | NetworkPhysicsSeed
  | NetworkPhysicsConstraintMessage
  | NetworkPhysicsInvalidateMessage
  | NetworkPhysicsDisposeMessage;

export interface NetworkPhysicsPosition {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

interface NetworkPhysicsResponseBase {
  readonly schemaVersion: typeof NETWORK_PHYSICS_SCHEMA_VERSION;
  readonly sessionGeneration: string;
  readonly simulationGeneration: string;
}

export interface NetworkPhysicsReadyResponse extends NetworkPhysicsResponseBase {
  readonly kind: 'ready';
  readonly state: 'sleeping';
}

export interface NetworkPhysicsFrameResponse extends NetworkPhysicsResponseBase {
  readonly kind: 'frame';
  readonly state: 'sleeping' | 'hot-constrained' | 'cooling';
  readonly frameSequence: number;
  readonly iterationsCompleted: number;
  /** Monotonic within one retained simulation; increments on every begin. */
  readonly interactionRevision: number;
  readonly gestureId: string;
  readonly constraintNodeKey: string;
  /** Last begin/update/end command incorporated into this frame. */
  readonly commandSequence: number;
  readonly constraintSequence: number | null;
  readonly positions: readonly NetworkPhysicsPosition[];
}

export interface NetworkPhysicsStateResponse extends NetworkPhysicsResponseBase {
  readonly kind: 'state';
  readonly state: NetworkPhysicsLifecycleState;
}

export interface NetworkPhysicsFailureResponse extends NetworkPhysicsResponseBase {
  readonly kind: 'failure';
  readonly state: 'failed';
  readonly code:
    'invalid-command' | 'max-iterations' | 'max-wall-time' | 'simulation-error';
  readonly message: string;
  readonly iterationsCompleted: number;
}

export type NetworkPhysicsWorkerResponse =
  | NetworkPhysicsReadyResponse
  | NetworkPhysicsFrameResponse
  | NetworkPhysicsStateResponse
  | NetworkPhysicsFailureResponse;

/** Lazy browser-owned transport; initialize stores a seed but starts no work. */
export interface NetworkPhysicsService extends TemporaryNodeConstraintPort {
  readonly initialize: (seed: NetworkPhysicsSeed) => void;
  readonly invalidate: (
    reason: NetworkPhysicsInvalidateMessage['reason'],
  ) => void;
  readonly dispose: () => void;
}

export interface NetworkPhysicsServiceFactoryOptions {
  /** Exact validated Worker state; never presentation-interpolated. */
  readonly onRawFrame?: (frame: NetworkPhysicsFrameResponse) => void;
  /** Imperative browser presentation; may contain bounded catch-up positions. */
  readonly onFrame: (frame: NetworkPhysicsFrameResponse) => void;
  readonly onConstraint: (command: TemporaryNodeConstraintCommand) => void;
  readonly onStateChange?: (state: NetworkPhysicsLifecycleState) => void;
  /** Browser display catch-up; independent from raw simulation lifecycle. */
  readonly onPresentationStateChange?: (
    state: NetworkPhysicsPresentationState,
  ) => void;
  readonly onFailure: (failure: NetworkPhysicsFailureResponse) => void;
}

export type NetworkPhysicsPresentationState = 'idle' | 'settling';

export type NetworkPhysicsServiceFactory = (
  options: NetworkPhysicsServiceFactoryOptions,
) => NetworkPhysicsService;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Network physics ${label} must not be empty.`);
  }
}

function finite(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Network physics ${label} must be finite.`);
  }
}

export function validateNetworkPhysicsSeed(
  value: unknown,
): asserts value is NetworkPhysicsSeed {
  if (!record(value)) {
    throw new Error('Network physics seed must be an object.');
  }
  if (value.schemaVersion !== NETWORK_PHYSICS_SCHEMA_VERSION) {
    throw new Error('Unsupported network physics schema version.');
  }
  if (value.kind !== 'initialize') {
    throw new Error('Network physics seed must be an initialize message.');
  }
  if (value.mode !== 'focus' && value.mode !== 'all') {
    throw new Error('Network physics seed has an invalid mode.');
  }
  identifier(value.sessionGeneration, 'session generation');
  identifier(value.simulationGeneration, 'simulation generation');
  if (!Array.isArray(value.nodes) || value.nodes.length === 0) {
    throw new Error('Network physics seed requires at least one node.');
  }
  const nodeKeys = new Set<string>();
  for (const node of value.nodes) {
    if (!record(node)) {
      throw new Error('Network physics seed contains an invalid node.');
    }
    identifier(node.key, 'node key');
    if (nodeKeys.has(node.key)) {
      throw new Error(`Network physics seed duplicates node ${node.key}.`);
    }
    nodeKeys.add(node.key);
    finite(node.x, `node ${node.key} x`);
    finite(node.y, `node ${node.key} y`);
    finite(node.size, `node ${node.key} size`);
    if (typeof node.constraintEligible !== 'boolean') {
      throw new Error(
        `Network physics node ${node.key} requires constraint eligibility.`,
      );
    }
    if (node.size <= 0) {
      throw new Error(
        `Network physics node ${node.key} size must be positive.`,
      );
    }
  }
  if (value.mode === 'focus') {
    identifier(value.rootKey, 'Focus root key');
    if (!nodeKeys.has(value.rootKey)) {
      throw new Error('Network physics Focus root is missing from the seed.');
    }
  } else if (value.rootKey !== undefined) {
    throw new Error('Network physics All seed must not contain a root key.');
  }
  if (!Array.isArray(value.edges)) {
    throw new Error('Network physics seed requires an edge array.');
  }
  const edgeKeys = new Set<string>();
  for (const edge of value.edges) {
    if (!record(edge)) {
      throw new Error('Network physics seed contains an invalid edge.');
    }
    identifier(edge.key, 'edge key');
    if (edgeKeys.has(edge.key)) {
      throw new Error(`Network physics seed duplicates edge ${edge.key}.`);
    }
    edgeKeys.add(edge.key);
    identifier(edge.source, `edge ${edge.key} source`);
    identifier(edge.target, `edge ${edge.key} target`);
    if (!nodeKeys.has(edge.source) || !nodeKeys.has(edge.target)) {
      throw new Error(
        `Network physics edge ${edge.key} has a missing endpoint.`,
      );
    }
    finite(edge.weight, `edge ${edge.key} weight`);
    if (edge.weight <= 0) {
      throw new Error(
        `Network physics edge ${edge.key} weight must be positive.`,
      );
    }
  }
  if (!record(value.settings)) {
    throw new Error('Network physics seed requires settings.');
  }
  finite(value.settings.edgeWeightInfluence, 'edge weight influence');
  finite(value.settings.scalingRatio, 'scaling ratio');
  finite(value.settings.gravity, 'gravity');
  if (
    value.settings.edgeWeightInfluence < 0 ||
    value.settings.scalingRatio <= 0 ||
    value.settings.gravity < 0 ||
    typeof value.settings.strongGravityMode !== 'boolean' ||
    typeof value.settings.barnesHutThreshold !== 'number' ||
    !Number.isSafeInteger(value.settings.barnesHutThreshold) ||
    value.settings.barnesHutThreshold < 1
  ) {
    throw new Error('Network physics settings are outside their valid range.');
  }
  if (!Array.isArray(value.attractors)) {
    throw new Error('Network physics seed requires an attractor array.');
  }
  if (
    value.automaticFolderFieldPolicy !== 'none' &&
    value.automaticFolderFieldPolicy !== 'seeded-output-relaxation'
  ) {
    throw new Error(
      'Network physics seed has an invalid automatic folder-field policy.',
    );
  }
  if (value.mode === 'focus' && value.automaticFolderFieldPolicy !== 'none') {
    throw new Error(
      'Network physics Focus seed cannot relax an automatic folder field.',
    );
  }
  if (value.mode === 'focus' && value.attractors.length !== 0) {
    throw new Error(
      'Network physics Focus seed cannot contain Pull attractors.',
    );
  }
  const attractorKeys = new Set<string>();
  const claimedMembers = new Set<string>();
  for (const attractor of value.attractors) {
    if (!record(attractor)) {
      throw new Error('Network physics seed contains an invalid attractor.');
    }
    identifier(attractor.ruleFolderKey, 'attractor folder key');
    if (attractorKeys.has(attractor.ruleFolderKey)) {
      throw new Error(
        `Network physics seed duplicates attractor ${attractor.ruleFolderKey}.`,
      );
    }
    attractorKeys.add(attractor.ruleFolderKey);
    finite(attractor.targetX, `attractor ${attractor.ruleFolderKey} target x`);
    finite(attractor.targetY, `attractor ${attractor.ruleFolderKey} target y`);
    finite(attractor.strength, `attractor ${attractor.ruleFolderKey} strength`);
    if (attractor.strength < 0 || attractor.strength > 100) {
      throw new Error('Network physics Pull strength must be from 0 to 100.');
    }
    if (
      !Array.isArray(attractor.memberNodeKeys) ||
      attractor.memberNodeKeys.length === 0
    ) {
      throw new Error('Network physics Pull attractor requires a member node.');
    }
    for (const key of attractor.memberNodeKeys) {
      identifier(key, `attractor ${attractor.ruleFolderKey} member key`);
      if (!nodeKeys.has(key) || claimedMembers.has(key)) {
        throw new Error(
          `Network physics attractor ${attractor.ruleFolderKey} has a missing or multiply claimed member.`,
        );
      }
      claimedMembers.add(key);
    }
  }
}

export function validateNetworkPhysicsWorkerRequest(
  value: unknown,
): asserts value is NetworkPhysicsWorkerRequest {
  if (
    !record(value) ||
    value.schemaVersion !== NETWORK_PHYSICS_SCHEMA_VERSION
  ) {
    throw new Error('Unsupported network physics worker request.');
  }
  if (value.kind === 'initialize') {
    validateNetworkPhysicsSeed(value);
    return;
  }
  if (value.kind === 'constraint') {
    if (!record(value.command)) {
      throw new Error('Network physics constraint message requires a command.');
    }
    validateTemporaryNodeConstraintCommand(value.command);
    return;
  }
  if (value.kind === 'invalidate') {
    if (
      value.reason !== 'workspace-changed' &&
      value.reason !== 'scope-changed' &&
      value.reason !== 'layout-changed' &&
      value.reason !== 'topology-changed' &&
      value.reason !== 'spatial-rules-changed'
    ) {
      throw new Error('Network physics invalidation requires a reason.');
    }
    return;
  }
  if (value.kind !== 'dispose') {
    throw new Error('Network physics worker request has an invalid kind.');
  }
}

export function validateNetworkPhysicsWorkerResponse(
  value: unknown,
): asserts value is NetworkPhysicsWorkerResponse {
  if (
    !record(value) ||
    value.schemaVersion !== NETWORK_PHYSICS_SCHEMA_VERSION
  ) {
    throw new Error('Unsupported network physics worker response.');
  }
  identifier(value.sessionGeneration, 'response session generation');
  identifier(value.simulationGeneration, 'response simulation generation');
  if (
    value.kind !== 'ready' &&
    value.kind !== 'frame' &&
    value.kind !== 'state' &&
    value.kind !== 'failure'
  ) {
    throw new Error('Network physics worker response has an invalid kind.');
  }
  if (value.kind === 'frame') {
    if (
      value.state !== 'sleeping' &&
      value.state !== 'hot-constrained' &&
      value.state !== 'cooling'
    ) {
      throw new Error('Network physics frame has an invalid lifecycle state.');
    }
    if (
      !Number.isSafeInteger(value.frameSequence) ||
      (value.frameSequence as number) < 1 ||
      !Number.isSafeInteger(value.iterationsCompleted) ||
      (value.iterationsCompleted as number) < 0 ||
      !Number.isSafeInteger(value.interactionRevision) ||
      (value.interactionRevision as number) < 1 ||
      !Number.isSafeInteger(value.commandSequence) ||
      (value.commandSequence as number) < 0 ||
      (value.constraintSequence !== null &&
        (!Number.isSafeInteger(value.constraintSequence) ||
          (value.constraintSequence as number) < 0)) ||
      (value.constraintSequence !== null &&
        value.constraintSequence !== value.commandSequence)
    ) {
      throw new Error('Network physics frame counters are invalid.');
    }
    identifier(value.gestureId, 'frame gesture id');
    identifier(value.constraintNodeKey, 'frame constraint node key');
    if (
      (value.state === 'hot-constrained') !==
      (value.constraintSequence !== null)
    ) {
      throw new Error(
        'Network physics frame constraint state is inconsistent.',
      );
    }
    if (!Array.isArray(value.positions)) {
      throw new Error('Network physics frame requires positions.');
    }
    for (const position of value.positions) {
      if (!record(position)) {
        throw new Error('Network physics frame contains an invalid position.');
      }
      identifier(position.key, 'frame node key');
      finite(position.x, `frame ${position.key} x`);
      finite(position.y, `frame ${position.key} y`);
    }
    return;
  }
  if (value.kind === 'ready') {
    if (value.state !== 'sleeping') {
      throw new Error('Network physics ready response must be sleeping.');
    }
    return;
  }
  if (value.kind === 'failure') {
    if (
      value.state !== 'failed' ||
      (value.code !== 'invalid-command' &&
        value.code !== 'max-iterations' &&
        value.code !== 'max-wall-time' &&
        value.code !== 'simulation-error') ||
      typeof value.message !== 'string' ||
      value.message.length === 0 ||
      !Number.isSafeInteger(value.iterationsCompleted) ||
      (value.iterationsCompleted as number) < 0
    ) {
      throw new Error('Network physics failure response is invalid.');
    }
    return;
  }
  if (
    value.state !== 'sleeping' &&
    value.state !== 'hot-constrained' &&
    value.state !== 'cooling' &&
    value.state !== 'failed' &&
    value.state !== 'disposed'
  ) {
    throw new Error('Network physics state response is invalid.');
  }
}
