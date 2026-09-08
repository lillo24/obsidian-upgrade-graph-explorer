import { describe, expect, it } from 'vitest';

import {
  NETWORK_PHYSICS_SCHEMA_VERSION,
  type NetworkPhysicsSeed,
} from './protocol';
import { ContinuousNetworkSimulation } from './simulation';

function focusSeed(): NetworkPhysicsSeed {
  return {
    schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
    kind: 'initialize',
    mode: 'focus',
    sessionGeneration: 'session-1',
    simulationGeneration: 'simulation-1',
    rootKey: 'a',
    nodes: [
      { key: 'a', x: 0, y: 0, size: 4, constraintEligible: true },
      { key: 'b', x: 12, y: 0, size: 4, constraintEligible: true },
      { key: 'c', x: -8, y: 6, size: 4, constraintEligible: false },
    ],
    edges: [
      { key: 'ab', source: 'a', target: 'b', weight: 6 },
      { key: 'ac', source: 'a', target: 'c', weight: 1 },
    ],
    settings: {
      edgeWeightInfluence: 1,
      scalingRatio: 1.35,
      strongGravityMode: true,
      gravity: 0.08,
      barnesHutThreshold: 600,
    },
    attractors: [],
  };
}

function begin(sequence = 0) {
  return {
    schemaVersion: 1 as const,
    kind: 'begin' as const,
    sessionGeneration: 'session-1',
    simulationGeneration: 'simulation-1',
    gestureId: 'gesture-1',
    sequence,
    nodeKey: 'a',
    target: { x: 30, y: -20 },
  };
}

function end(sequence = 2) {
  return {
    schemaVersion: 1 as const,
    kind: 'end' as const,
    sessionGeneration: 'session-1',
    simulationGeneration: 'simulation-1',
    gestureId: 'gesture-1',
    sequence,
    nodeKey: 'a',
    reason: 'released' as const,
  };
}

describe('ContinuousNetworkSimulation', () => {
  it('is dormant until begin and keeps the constrained node exact while neighbors react', () => {
    const simulation = new ContinuousNetworkSimulation(focusSeed());
    expect(simulation.state).toBe('sleeping');
    expect(simulation.hasScheduledWork).toBe(false);
    expect(simulation.advance()).toEqual({});

    const initialNeighbor = simulation
      .positions()
      .find(({ key }) => key === 'b')!;
    simulation.handle(begin());
    const stepped = simulation.advance().frame!;
    expect(stepped.state).toBe('hot-constrained');
    expect(stepped.positions.find(({ key }) => key === 'a')).toMatchObject({
      x: 30,
      y: -20,
    });
    expect(stepped.positions.find(({ key }) => key === 'b')).not.toEqual(
      initialNeighbor,
    );
  });

  it('enforces generations and monotonic gesture sequences', () => {
    const simulation = new ContinuousNetworkSimulation(focusSeed());
    expect(() => simulation.handle(begin(1))).toThrow('sequence 0');
    simulation.handle(begin());
    expect(() => simulation.handle(begin())).toThrow('already active');
    expect(() =>
      simulation.handle({
        ...begin(),
        kind: 'update',
        sequence: 0,
      }),
    ).toThrow('sequence is stale');
    expect(() =>
      simulation.handle({
        ...begin(),
        kind: 'update',
        sequence: 1,
        sessionGeneration: 'stale',
      }),
    ).toThrow('generation is stale');
    expect(() =>
      new ContinuousNetworkSimulation(focusSeed()).handle({
        ...begin(),
        nodeKey: 'c',
      }),
    ).toThrow('not a canonical File');
  });

  it('releases into bounded cooling and reaches practical sleep', () => {
    const simulation = new ContinuousNetworkSimulation(focusSeed());
    simulation.handle(begin());
    simulation.advance();
    simulation.handle(end());
    expect(simulation.state).toBe('cooling');

    for (let count = 0; count < 40 && simulation.hasScheduledWork; count += 1) {
      const result = simulation.advance();
      expect(result.failure).toBeUndefined();
    }
    expect(simulation.state).toBe('sleeping');
    expect(simulation.advance()).toEqual({});
  });

  it('accepts an identical repeated end as idempotent cleanup', () => {
    const simulation = new ContinuousNetworkSimulation(focusSeed());
    simulation.handle(begin());
    simulation.handle(end());
    expect(() => simulation.handle(end())).not.toThrow();
  });

  it.each([
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
  ] as const)('clears the hard target for end reason %s', (reason) => {
    const simulation = new ContinuousNetworkSimulation(focusSeed());
    simulation.handle(begin());
    simulation.handle({ ...end(), reason });
    expect(simulation.state).toBe('cooling');
    expect(simulation.positions().find(({ key }) => key === 'a')).toMatchObject(
      {
        x: 30,
        y: -20,
      },
    );
  });

  it('wakes again for a second gesture after sleeping', () => {
    const simulation = new ContinuousNetworkSimulation({
      ...focusSeed(),
      nodes: [{ key: 'a', x: 0, y: 0, size: 4, constraintEligible: true }],
      edges: [],
    });
    simulation.handle(begin());
    simulation.handle(end());
    simulation.advance();
    expect(simulation.state).toBe('sleeping');
    simulation.handle({
      ...begin(),
      gestureId: 'gesture-2',
      target: { x: -5, y: 9 },
    });
    expect(simulation.state).toBe('hot-constrained');
    expect(simulation.positions()[0]).toMatchObject({ x: -5, y: 9 });
  });

  it('makes disposal terminal', () => {
    const simulation = new ContinuousNetworkSimulation(focusSeed());
    simulation.dispose();
    expect(simulation.state).toBe('disposed');
    expect(simulation.hasScheduledWork).toBe(false);
    expect(() => simulation.handle(begin())).toThrow('disposed');
  });

  it('fails loudly when cooling exceeds its wall-time limit', () => {
    const times = [0, 2_001];
    const simulation = new ContinuousNetworkSimulation(
      focusSeed(),
      () => times.shift() ?? 2_001,
    );
    simulation.handle(begin());
    simulation.handle(end());
    const result = simulation.advance();
    expect(result.failure).toMatchObject({
      kind: 'failure',
      code: 'max-wall-time',
      state: 'failed',
    });
    expect(simulation.state).toBe('failed');
  });
});
