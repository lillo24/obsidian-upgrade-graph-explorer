import type { LocalLayoutPosition, LocalLayoutRequest } from '../local-types';
import { resolveGlobalPhysicsSettings } from '../settings';
import type {
  GlobalLayoutPosition,
  GlobalLayoutRequest,
  GlobalSpatialInfluenceAttractor,
} from '../types';
import {
  NETWORK_PHYSICS_SCHEMA_VERSION,
  type NetworkPhysicsSeed,
} from './protocol';

function positionIndex(
  positions: readonly GlobalLayoutPosition[] | readonly LocalLayoutPosition[],
): ReadonlyMap<string, { readonly x: number; readonly y: number }> {
  const index = new Map<string, { readonly x: number; readonly y: number }>();
  for (const position of positions) {
    if (index.has(position.key)) {
      throw new Error(
        `Network physics positions duplicate node ${position.key}.`,
      );
    }
    index.set(position.key, position);
  }
  return index;
}

export function createFocusNetworkPhysicsSeed(input: {
  readonly request: Omit<LocalLayoutRequest, 'requestId'>;
  /** Accepted Local positions, not the request's deterministic pre-layout seeds. */
  readonly positions: readonly LocalLayoutPosition[];
  readonly sessionGeneration: string;
  readonly simulationGeneration: string;
}): NetworkPhysicsSeed {
  const byKey = positionIndex(input.positions);
  return {
    schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
    kind: 'initialize',
    mode: 'focus',
    sessionGeneration: input.sessionGeneration,
    simulationGeneration: input.simulationGeneration,
    rootKey: input.request.rootKey,
    nodes: input.request.nodes.map((node) => {
      const position = byKey.get(node.key);
      if (position === undefined) {
        throw new Error(`Accepted Local positions omitted node ${node.key}.`);
      }
      return {
        key: node.key,
        x: position.x,
        y: position.y,
        size: node.size,
        constraintEligible: node.kind === 'document',
      };
    }),
    edges: input.request.edges.map((edge) => ({
      key: edge.key,
      source: edge.source,
      target: edge.target,
      weight:
        edge.weight *
        (edge.kind === 'hierarchy'
          ? input.request.settings.hierarchyWeight
          : input.request.settings.referenceWeight),
    })),
    settings: {
      edgeWeightInfluence: 1,
      scalingRatio: input.request.settings.scalingRatio,
      strongGravityMode: true,
      gravity: 0.08,
      barnesHutThreshold: 600,
    },
    attractors: [],
    automaticFolderFieldPolicy: 'none',
  };
}

export function createAllNetworkPhysicsSeed(input: {
  readonly request: Omit<GlobalLayoutRequest, 'requestId'>;
  /** Dynamic pre-Place positions; persisted Place is excluded by contract. */
  readonly dynamicPositions: readonly GlobalLayoutPosition[];
  readonly attractors: readonly GlobalSpatialInfluenceAttractor[];
  readonly constraintEligibleNodeKeys: ReadonlySet<string>;
  readonly sessionGeneration: string;
  readonly simulationGeneration: string;
}): NetworkPhysicsSeed {
  const byKey = positionIndex(input.dynamicPositions);
  const settings = resolveGlobalPhysicsSettings(input.request.settings);
  return {
    schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
    kind: 'initialize',
    mode: 'all',
    sessionGeneration: input.sessionGeneration,
    simulationGeneration: input.simulationGeneration,
    nodes: input.request.nodes.map((node) => {
      const position = byKey.get(node.key);
      if (position === undefined) {
        throw new Error(`Dynamic All positions omitted node ${node.key}.`);
      }
      return {
        key: node.key,
        x: position.x,
        y: position.y,
        size: node.size,
        constraintEligible: input.constraintEligibleNodeKeys.has(node.key),
      };
    }),
    edges: input.request.edges.map((edge) => ({ ...edge })),
    settings: {
      edgeWeightInfluence: settings.linkForce,
      scalingRatio: Math.max(0.1, settings.withinFolderSpacing),
      strongGravityMode: false,
      gravity: 1,
      barnesHutThreshold: 1_000,
    },
    attractors: input.attractors.map((attractor) => ({
      ...attractor,
      memberNodeKeys: [...attractor.memberNodeKeys],
    })),
    automaticFolderFieldPolicy:
      input.request.macro.algorithm === 'fixed-total-field'
        ? 'seeded-output-relaxation'
        : 'none',
  };
}
