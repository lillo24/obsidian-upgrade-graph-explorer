import {
  ContinuousNetworkSimulation,
  NETWORK_PHYSICS_SCHEMA_VERSION,
  validateNetworkPhysicsWorkerRequest,
  type NetworkPhysicsFailureResponse,
  type NetworkPhysicsWorkerRequest,
  type NetworkPhysicsWorkerResponse,
} from '@icarus-graph-explorer/renderer-sigma/physics';

interface NetworkPhysicsWorkerHost {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: NetworkPhysicsWorkerResponse): void;
  setTimeout(handler: () => void, timeout?: number): number;
  clearTimeout(handle: number): void;
  close(): void;
}

const host: NetworkPhysicsWorkerHost = self;
let simulation: ContinuousNetworkSimulation | undefined;
let scheduled: number | undefined;

function cancelScheduled(): void {
  if (scheduled === undefined) return;
  host.clearTimeout(scheduled);
  scheduled = undefined;
}

function schedule(): void {
  if (
    scheduled !== undefined ||
    simulation === undefined ||
    !simulation.hasScheduledWork
  ) {
    return;
  }
  scheduled = host.setTimeout(step, 0);
}

function step(): void {
  scheduled = undefined;
  const current = simulation;
  if (current === undefined || !current.hasScheduledWork) return;
  const result = current.advance();
  if (result.frame !== undefined) host.postMessage(result.frame);
  if (result.failure !== undefined) {
    host.postMessage(result.failure);
    return;
  }
  schedule();
}

function failure(error: unknown): NetworkPhysicsFailureResponse | undefined {
  if (simulation === undefined) return undefined;
  return {
    schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
    kind: 'failure',
    sessionGeneration: simulation.seed.sessionGeneration,
    simulationGeneration: simulation.seed.simulationGeneration,
    state: 'failed',
    code: 'invalid-command',
    message: error instanceof Error ? error.message : String(error),
    iterationsCompleted: 0,
  };
}

host.onmessage = (event: MessageEvent<unknown>) => {
  try {
    validateNetworkPhysicsWorkerRequest(event.data);
    const request: NetworkPhysicsWorkerRequest = event.data;
    if (request.kind === 'initialize') {
      if (simulation !== undefined) {
        throw new Error('Network physics worker is already initialized.');
      }
      simulation = new ContinuousNetworkSimulation(request);
      host.postMessage({
        schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
        kind: 'ready',
        sessionGeneration: request.sessionGeneration,
        simulationGeneration: request.simulationGeneration,
        state: 'sleeping',
      });
      return;
    }
    if (simulation === undefined) {
      throw new Error(
        'Network physics worker received work before initialization.',
      );
    }
    if (request.kind === 'constraint') {
      host.postMessage(simulation.handle(request.command));
      schedule();
      return;
    }
    cancelScheduled();
    if (request.kind === 'invalidate') {
      simulation.invalidate();
      host.postMessage({
        schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
        kind: 'state',
        sessionGeneration: simulation.seed.sessionGeneration,
        simulationGeneration: simulation.seed.simulationGeneration,
        state: 'sleeping',
      });
      return;
    }
    simulation.dispose();
    host.postMessage({
      schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
      kind: 'state',
      sessionGeneration: simulation.seed.sessionGeneration,
      simulationGeneration: simulation.seed.simulationGeneration,
      state: 'disposed',
    });
    host.close();
  } catch (error: unknown) {
    cancelScheduled();
    const response = failure(error);
    if (response !== undefined) host.postMessage(response);
    else throw error;
  }
};

export {};
