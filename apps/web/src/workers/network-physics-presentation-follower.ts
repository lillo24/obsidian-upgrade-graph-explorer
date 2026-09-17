import type { NetworkPhysicsPosition } from '@icarus-graph-explorer/renderer-sigma/core';

export const NETWORK_PHYSICS_PRESENTATION_ANGULAR_FREQUENCY = 18;
export const NETWORK_PHYSICS_PRESENTATION_MAX_STEP_MS = 100;
export const NETWORK_PHYSICS_PRESENTATION_POSITION_EPSILON_RATIO = 0.00025;

type FollowerNode = {
  readonly key: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
};

export interface NetworkPhysicsPresentationSample {
  readonly positions: readonly NetworkPhysicsPosition[];
  readonly atRest: boolean;
}

function integrateCriticallyDampedAxis(input: {
  readonly position: number;
  readonly velocity: number;
  readonly target: number;
  readonly elapsedSeconds: number;
}): { readonly position: number; readonly velocity: number } {
  const omega = NETWORK_PHYSICS_PRESENTATION_ANGULAR_FREQUENCY;
  const error = input.position - input.target;
  const coefficient = input.velocity + omega * error;
  const decay = Math.exp(-omega * input.elapsedSeconds);
  return {
    position:
      input.target + (error + coefficient * input.elapsedSeconds) * decay,
    velocity:
      (input.velocity - omega * coefficient * input.elapsedSeconds) * decay,
  };
}

/**
 * Velocity-preserving, critically damped follower for raw cooling positions.
 * Retargeting changes only the target; visible position and velocity continue.
 */
export class NetworkPhysicsPresentationFollower {
  private readonly nodes: FollowerNode[];
  private readonly nodeByKey: ReadonlyMap<string, FollowerNode>;
  private readonly positionEpsilon: number;
  private readonly velocityEpsilon: number;
  private lastTimestamp: number;

  constructor(
    start: readonly NetworkPhysicsPosition[],
    positionScale: number,
    timestamp: number,
  ) {
    if (!Number.isFinite(positionScale) || positionScale <= 0) {
      throw new Error('Network physics presentation scale must be positive.');
    }
    if (!Number.isFinite(timestamp)) {
      throw new Error('Network physics presentation timestamp must be finite.');
    }
    this.nodes = start.map((position) => ({
      key: position.key,
      x: position.x,
      y: position.y,
      vx: 0,
      vy: 0,
      targetX: position.x,
      targetY: position.y,
    }));
    this.nodeByKey = new Map(this.nodes.map((node) => [node.key, node]));
    if (this.nodeByKey.size !== this.nodes.length) {
      throw new Error('Network physics presentation start duplicates a node.');
    }
    this.positionEpsilon = Math.max(
      1e-6,
      positionScale * NETWORK_PHYSICS_PRESENTATION_POSITION_EPSILON_RATIO,
    );
    this.velocityEpsilon =
      this.positionEpsilon * NETWORK_PHYSICS_PRESENTATION_ANGULAR_FREQUENCY;
    this.lastTimestamp = timestamp;
  }

  retarget(target: readonly NetworkPhysicsPosition[]): void {
    if (target.length !== this.nodes.length) {
      throw new Error(
        'Network physics presentation target changed the initialized node set.',
      );
    }
    const seen = new Set<string>();
    for (const position of target) {
      const node = this.nodeByKey.get(position.key);
      if (node === undefined || seen.has(position.key)) {
        throw new Error(
          `Network physics presentation target has an unknown or duplicate node ${position.key}.`,
        );
      }
      seen.add(position.key);
      node.targetX = position.x;
      node.targetY = position.y;
    }
  }

  sample(timestamp: number): NetworkPhysicsPresentationSample {
    if (!Number.isFinite(timestamp)) {
      throw new Error('Network physics presentation timestamp must be finite.');
    }
    const elapsedMs = Math.min(
      NETWORK_PHYSICS_PRESENTATION_MAX_STEP_MS,
      Math.max(0, timestamp - this.lastTimestamp),
    );
    this.lastTimestamp = Math.max(this.lastTimestamp, timestamp);
    const elapsedSeconds = elapsedMs / 1_000;
    let atRest = true;
    for (const node of this.nodes) {
      if (elapsedSeconds > 0) {
        const x = integrateCriticallyDampedAxis({
          position: node.x,
          velocity: node.vx,
          target: node.targetX,
          elapsedSeconds,
        });
        const y = integrateCriticallyDampedAxis({
          position: node.y,
          velocity: node.vy,
          target: node.targetY,
          elapsedSeconds,
        });
        node.x = x.position;
        node.vx = x.velocity;
        node.y = y.position;
        node.vy = y.velocity;
      }
      if (
        Math.hypot(node.x - node.targetX, node.y - node.targetY) >
          this.positionEpsilon ||
        Math.hypot(node.vx, node.vy) > this.velocityEpsilon
      ) {
        atRest = false;
      }
    }
    if (atRest) {
      for (const node of this.nodes) {
        node.x = node.targetX;
        node.y = node.targetY;
        node.vx = 0;
        node.vy = 0;
      }
    }
    return {
      positions: this.nodes.map(({ key, x, y }) => ({ key, x, y })),
      atRest,
    };
  }
}
