import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import {
  GLOBAL_CONVERGENCE_BATCH_ITERATIONS,
  GLOBAL_CONVERGENCE_MAX_WALL_TIME_MS,
  GLOBAL_CONVERGENCE_STABLE_MACRO_STEPS_REQUIRED,
  createGlobalConvergenceDegreeIndex,
  globalConvergenceMacroStepIsStable,
  measureGlobalConvergenceMovement,
} from '../global-convergence';
import {
  LOCAL_CONVERGENCE_BATCH_ITERATIONS,
  LOCAL_CONVERGENCE_MAX_WALL_TIME_MS,
  LOCAL_CONVERGENCE_STABLE_BATCHES_REQUIRED,
  createLocalConvergenceDegreeIndex,
  localConvergenceBatchIsStable,
  localConvergenceMaxIterations,
  measureLocalConvergenceMovement,
} from '../local-convergence';
import {
  validateTemporaryNodeConstraintCommand,
  type TemporaryNodeConstraintCommand,
  type TemporaryNodeConstraintCommandBase,
} from '../temporary-node-constraint';
import { applyNetworkPhysicsPullIteration } from './pull';
import {
  NETWORK_PHYSICS_SCHEMA_VERSION,
  validateNetworkPhysicsSeed,
  type NetworkPhysicsFailureResponse,
  type NetworkPhysicsFrameResponse,
  type NetworkPhysicsLifecycleState,
  type NetworkPhysicsPosition,
  type NetworkPhysicsSeed,
} from './protocol';

type PhysicsGraph = MultiDirectedGraph<
  { x: number; y: number; size: number; constraintEligible: boolean },
  { weight: number }
>;

const HOT_ITERATIONS_PER_TURN = 4;

/** Interactive All displacement needs more tail work than a seeded base layout. */
export function networkPhysicsCoolingMaxIterations(
  mode: NetworkPhysicsSeed['mode'],
  nodeCount: number,
): number {
  if (mode === 'focus') return localConvergenceMaxIterations(nodeCount);
  return nodeCount <= 1_000 ? 8_192 : nodeCount <= 5_000 ? 1_024 : 256;
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

function buildGraph(seed: NetworkPhysicsSeed): PhysicsGraph {
  const graph = new MultiDirectedGraph<
    { x: number; y: number; size: number; constraintEligible: boolean },
    { weight: number }
  >();
  for (const node of seed.nodes) graph.addNode(node.key, { ...node });
  for (const edge of seed.edges) {
    graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, {
      weight: edge.weight,
    });
  }
  return graph;
}

function graphPositions(
  graph: PhysicsGraph,
): readonly NetworkPhysicsPosition[] {
  return graph
    .mapNodes((key, node) => ({ key, x: node.x, y: node.y }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export interface NetworkPhysicsAdvanceResult {
  readonly frame?: NetworkPhysicsFrameResponse;
  readonly failure?: NetworkPhysicsFailureResponse;
}

/** Retained worker-side simulation. Scheduling deliberately lives outside it. */
export class ContinuousNetworkSimulation {
  private readonly graph: PhysicsGraph;
  private readonly degreeByKey: ReadonlyMap<string, number>;
  private stateValue: NetworkPhysicsLifecycleState = 'sleeping';
  private active: TemporaryNodeConstraintCommandBase | undefined;
  private target: { x: number; y: number } | undefined;
  private lastConstraintSequence = -1;
  private lastEnd: TemporaryNodeConstraintCommand | undefined;
  private frameSequence = 0;
  private iterationsCompleted = 0;
  private stableBatches = 0;
  private coolingStartedAt = 0;

  constructor(
    readonly seed: NetworkPhysicsSeed,
    private readonly now: () => number = () => performance.now(),
  ) {
    validateNetworkPhysicsSeed(seed);
    this.graph = buildGraph(seed);
    this.degreeByKey =
      seed.mode === 'focus'
        ? createLocalConvergenceDegreeIndex(
            seed.nodes.map(({ key }) => key),
            seed.edges,
          )
        : createGlobalConvergenceDegreeIndex(
            seed.nodes.map(({ key }) => key),
            seed.edges,
          );
  }

  get state(): NetworkPhysicsLifecycleState {
    return this.stateValue;
  }

  get hasScheduledWork(): boolean {
    return (
      this.stateValue === 'hot-constrained' || this.stateValue === 'cooling'
    );
  }

  positions(): readonly NetworkPhysicsPosition[] {
    return graphPositions(this.graph);
  }

  handle(command: TemporaryNodeConstraintCommand): NetworkPhysicsFrameResponse {
    if (this.stateValue === 'disposed') {
      throw new Error('Network physics simulation is disposed.');
    }
    if (this.stateValue === 'failed') {
      throw new Error('Network physics simulation has failed.');
    }
    validateTemporaryNodeConstraintCommand(command);
    if (
      command.sessionGeneration !== this.seed.sessionGeneration ||
      command.simulationGeneration !== this.seed.simulationGeneration
    ) {
      throw new Error('Temporary constraint generation is stale.');
    }
    if (!this.graph.hasNode(command.nodeKey)) {
      throw new Error(
        `Temporary constraint node ${command.nodeKey} is missing.`,
      );
    }
    if (!this.graph.getNodeAttribute(command.nodeKey, 'constraintEligible')) {
      throw new Error(
        `Temporary constraint node ${command.nodeKey} is not a canonical File.`,
      );
    }
    if (command.kind === 'begin') {
      if (this.active !== undefined) {
        throw new Error('A temporary node constraint is already active.');
      }
      if (command.sequence !== 0) {
        throw new Error(
          'A temporary node constraint must begin at sequence 0.',
        );
      }
      this.active = { ...command };
      this.target = { ...command.target };
      this.lastConstraintSequence = 0;
      this.lastEnd = undefined;
      this.stateValue = 'hot-constrained';
      this.iterationsCompleted = 0;
      this.stableBatches = 0;
    } else if (command.kind === 'update') {
      if (this.active === undefined || !sameConstraint(this.active, command)) {
        throw new Error(
          'Temporary constraint update does not match the active gesture.',
        );
      }
      if (command.sequence <= this.lastConstraintSequence) {
        throw new Error('Temporary constraint update sequence is stale.');
      }
      this.target = { ...command.target };
      this.lastConstraintSequence = command.sequence;
    } else {
      if (
        this.active === undefined &&
        this.lastEnd?.kind === 'end' &&
        sameConstraint(this.lastEnd, command)
      ) {
        if (
          this.lastEnd.sequence === command.sequence &&
          this.lastEnd.reason === command.reason
        ) {
          return this.frame();
        }
        throw new Error(
          'Temporary constraint end conflicts with prior cleanup.',
        );
      }
      if (this.active === undefined || !sameConstraint(this.active, command)) {
        throw new Error(
          'Temporary constraint end does not match the active gesture.',
        );
      }
      if (command.sequence <= this.lastConstraintSequence) {
        throw new Error('Temporary constraint end sequence is stale.');
      }
      this.lastConstraintSequence = command.sequence;
      this.lastEnd = { ...command };
      this.active = undefined;
      this.target = undefined;
      this.stateValue = 'cooling';
      this.iterationsCompleted = 0;
      this.stableBatches = 0;
      this.coolingStartedAt = this.now();
    }
    this.reassertTarget();
    return this.frame();
  }

  invalidate(): void {
    if (this.stateValue === 'disposed') return;
    this.active = undefined;
    this.target = undefined;
    this.stateValue = 'sleeping';
    this.iterationsCompleted = 0;
    this.stableBatches = 0;
  }

  dispose(): void {
    this.active = undefined;
    this.target = undefined;
    this.stateValue = 'disposed';
  }

  advance(): NetworkPhysicsAdvanceResult {
    if (!this.hasScheduledWork) return {};
    try {
      if (this.stateValue === 'hot-constrained') {
        for (let index = 0; index < HOT_ITERATIONS_PER_TURN; index += 1) {
          this.reassertTarget();
          this.assign(1);
          if (this.seed.mode === 'all') {
            applyNetworkPhysicsPullIteration(this.graph, this.seed.attractors);
          }
          this.reassertTarget();
        }
        this.iterationsCompleted += HOT_ITERATIONS_PER_TURN;
        return { frame: this.frame() };
      }
      return this.advanceCooling();
    } catch (error: unknown) {
      return this.fail(
        'simulation-error',
        `Network physics step failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private advanceCooling(): NetworkPhysicsAdvanceResult {
    const before = this.positions();
    const batchIterations =
      this.seed.mode === 'focus'
        ? LOCAL_CONVERGENCE_BATCH_ITERATIONS
        : GLOBAL_CONVERGENCE_BATCH_ITERATIONS;
    const cap = networkPhysicsCoolingMaxIterations(
      this.seed.mode,
      this.graph.order,
    );
    const iterations = Math.min(
      batchIterations,
      Math.max(0, cap - this.iterationsCompleted),
    );
    if (iterations === 0) {
      return this.fail(
        'max-iterations',
        'Network physics cooling did not converge before its deterministic iteration cap.',
      );
    }
    if (
      this.seed.mode === 'all' &&
      this.seed.attractors.some(({ strength }) => strength > 0)
    ) {
      for (let index = 0; index < iterations; index += 1) {
        this.assign(1);
        applyNetworkPhysicsPullIteration(this.graph, this.seed.attractors);
      }
    } else this.assign(iterations);
    this.iterationsCompleted += iterations;
    const after = this.positions();
    const stable =
      this.seed.mode === 'focus'
        ? localConvergenceBatchIsStable(
            measureLocalConvergenceMovement({
              before,
              after,
              rootKey: this.seed.rootKey!,
              degreeByKey: this.degreeByKey,
            }),
          )
        : globalConvergenceMacroStepIsStable(
            measureGlobalConvergenceMovement({
              before,
              after,
              degreeByKey: this.degreeByKey,
            }),
          );
    this.stableBatches = stable ? this.stableBatches + 1 : 0;
    const required =
      this.seed.mode === 'focus'
        ? LOCAL_CONVERGENCE_STABLE_BATCHES_REQUIRED
        : GLOBAL_CONVERGENCE_STABLE_MACRO_STEPS_REQUIRED;
    if (this.stableBatches >= required || this.graph.order === 1) {
      this.stateValue = 'sleeping';
    } else {
      const limit =
        this.seed.mode === 'focus'
          ? LOCAL_CONVERGENCE_MAX_WALL_TIME_MS
          : GLOBAL_CONVERGENCE_MAX_WALL_TIME_MS;
      if (this.now() - this.coolingStartedAt > limit) {
        return this.fail(
          'max-wall-time',
          `Network physics cooling exceeded the ${limit} ms safety limit.`,
        );
      }
      if (this.iterationsCompleted >= cap) {
        return this.fail(
          'max-iterations',
          'Network physics cooling did not converge before its deterministic iteration cap.',
        );
      }
    }
    return { frame: this.frame() };
  }

  private assign(iterations: number): void {
    if (this.graph.order < 2 || iterations === 0) return;
    forceAtlas2.assign(this.graph, {
      iterations,
      getEdgeWeight: 'weight',
      settings: {
        ...forceAtlas2.inferSettings(this.graph),
        barnesHutOptimize:
          this.graph.order >= this.seed.settings.barnesHutThreshold,
        edgeWeightInfluence: this.seed.settings.edgeWeightInfluence,
        scalingRatio: this.seed.settings.scalingRatio,
        strongGravityMode: this.seed.settings.strongGravityMode,
        gravity: this.seed.settings.gravity,
      },
    });
  }

  private reassertTarget(): void {
    if (this.active === undefined || this.target === undefined) return;
    this.graph.mergeNodeAttributes(this.active.nodeKey, this.target);
  }

  private frame(): NetworkPhysicsFrameResponse {
    if (
      this.stateValue !== 'sleeping' &&
      this.stateValue !== 'hot-constrained' &&
      this.stateValue !== 'cooling'
    ) {
      throw new Error(`Cannot publish a frame while ${this.stateValue}.`);
    }
    return {
      schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
      kind: 'frame',
      sessionGeneration: this.seed.sessionGeneration,
      simulationGeneration: this.seed.simulationGeneration,
      state: this.stateValue,
      frameSequence: ++this.frameSequence,
      iterationsCompleted: this.iterationsCompleted,
      constraintSequence:
        this.active === undefined ? null : this.lastConstraintSequence,
      positions: this.positions(),
    };
  }

  private fail(
    code: NetworkPhysicsFailureResponse['code'],
    message: string,
  ): NetworkPhysicsAdvanceResult {
    this.stateValue = 'failed';
    this.active = undefined;
    this.target = undefined;
    return {
      failure: {
        schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
        kind: 'failure',
        sessionGeneration: this.seed.sessionGeneration,
        simulationGeneration: this.seed.simulationGeneration,
        state: 'failed',
        code,
        message,
        iterationsCompleted: this.iterationsCompleted,
      },
    };
  }
}
