import { describe, expect, it } from 'vitest';

import {
  NETWORK_PHYSICS_SCHEMA_VERSION,
  validateNetworkPhysicsSeed,
  validateNetworkPhysicsWorkerRequest,
  validateNetworkPhysicsWorkerResponse,
} from './protocol';

const seed = {
  schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
  kind: 'initialize',
  mode: 'focus',
  sessionGeneration: 'session',
  simulationGeneration: 'simulation',
  rootKey: 'node',
  nodes: [{ key: 'node', x: 0, y: 0, size: 2, constraintEligible: true }],
  edges: [],
  settings: {
    edgeWeightInfluence: 1,
    scalingRatio: 1,
    strongGravityMode: true,
    gravity: 0.08,
    barnesHutThreshold: 600,
  },
  attractors: [],
  automaticFolderFieldPolicy: 'none',
} as const;

describe('network physics protocol validation', () => {
  it('accepts a complete serializable seed', () => {
    expect(() => validateNetworkPhysicsSeed(seed)).not.toThrow();
  });

  it('rejects malformed nested seed fields with explicit errors', () => {
    expect(() =>
      validateNetworkPhysicsSeed({ ...seed, edges: undefined }),
    ).toThrow('edge array');
    expect(() =>
      validateNetworkPhysicsSeed({ ...seed, settings: undefined }),
    ).toThrow('settings');
    expect(() =>
      validateNetworkPhysicsSeed({ ...seed, nodes: [null] }),
    ).toThrow('invalid node');
  });

  it('strictly validates constraint commands received by the worker', () => {
    expect(() =>
      validateNetworkPhysicsWorkerRequest({
        schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
        kind: 'constraint',
        command: {
          schemaVersion: 1,
          kind: 'begin',
          sessionGeneration: 7,
          simulationGeneration: 'simulation',
          gestureId: 'gesture',
          sequence: 0,
          nodeKey: 'node',
          target: { x: 0, y: 0 },
        },
      }),
    ).toThrow('non-empty string');
  });

  it('requires gesture identity and consistent command counters on frames', () => {
    const frame = {
      schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
      kind: 'frame',
      sessionGeneration: 'session',
      simulationGeneration: 'simulation',
      state: 'hot-constrained',
      frameSequence: 1,
      iterationsCompleted: 4,
      interactionRevision: 1,
      gestureId: 'gesture',
      constraintNodeKey: 'node',
      commandSequence: 2,
      constraintSequence: 2,
      positions: [{ key: 'node', x: 4, y: 5 }],
    } as const;
    expect(() => validateNetworkPhysicsWorkerResponse(frame)).not.toThrow();
    expect(() =>
      validateNetworkPhysicsWorkerResponse({
        ...frame,
        interactionRevision: 0,
      }),
    ).toThrow('counters');
    expect(() =>
      validateNetworkPhysicsWorkerResponse({
        ...frame,
        gestureId: '',
      }),
    ).toThrow('gesture id');
    expect(() =>
      validateNetworkPhysicsWorkerResponse({
        ...frame,
        state: 'cooling',
      }),
    ).toThrow('constraint state');
  });
});
