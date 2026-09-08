import {
  NETWORK_PHYSICS_SCHEMA_VERSION,
  type NetworkPhysicsAttractor,
  type NetworkPhysicsEdge,
  type NetworkPhysicsSeed,
} from '@icarus-graph-explorer/renderer-sigma/physics';

export interface Physics1LabFixture {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly seed: NetworkPhysicsSeed;
  readonly placeTranslationByNodeKey: ReadonlyMap<
    string,
    { readonly x: number; readonly y: number }
  >;
}

function nodes(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / Math.max(1, count)) * Math.PI * 2;
    const radius = 18 + (index % 7) * 2.2;
    return {
      key: `n${index}`,
      x: Math.cos(angle) * radius + ((index * 17) % 5),
      y: Math.sin(angle) * radius - ((index * 13) % 7),
      size: index === 0 ? 5 : 3,
      constraintEligible: true,
    };
  });
}

function edges(
  pairs: readonly (readonly [number, number, number?])[],
): readonly NetworkPhysicsEdge[] {
  return pairs.map(([source, target, weight = 1], index) => ({
    key: `e${index}`,
    source: `n${source}`,
    target: `n${target}`,
    weight,
  }));
}

function chain(count: number): readonly (readonly [number, number])[] {
  return Array.from(
    { length: Math.max(0, count - 1) },
    (_, index) => [index, index + 1] as const,
  );
}

function ring(count: number): readonly (readonly [number, number])[] {
  return Array.from(
    { length: count },
    (_, index) => [index, (index + 1) % count] as const,
  );
}

function makeFixture(input: {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly mode: 'focus' | 'all';
  readonly count: number;
  readonly pairs: readonly (readonly [number, number, number?])[];
  readonly attractors?: readonly NetworkPhysicsAttractor[];
  readonly place?: ReadonlyMap<
    string,
    { readonly x: number; readonly y: number }
  >;
}): Physics1LabFixture {
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    seed: {
      schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
      kind: 'initialize',
      mode: input.mode,
      sessionGeneration: `lab:${input.id}`,
      simulationGeneration: `lab:${input.id}:simulation:1`,
      ...(input.mode === 'focus' ? { rootKey: 'n0' } : {}),
      nodes: nodes(input.count),
      edges: edges(input.pairs),
      settings:
        input.mode === 'focus'
          ? {
              edgeWeightInfluence: 1,
              scalingRatio: 1.35,
              strongGravityMode: true,
              gravity: 0.08,
              barnesHutThreshold: 600,
            }
          : {
              edgeWeightInfluence: 1,
              scalingRatio: 1,
              strongGravityMode: false,
              gravity: 1,
              barnesHutThreshold: 1_000,
            },
      attractors: input.attractors ?? [],
    },
    placeTranslationByNodeKey: input.place ?? new Map(),
  };
}

const mediumCount = 180;
const mediumPairs = [
  ...ring(mediumCount - 4),
  ...Array.from(
    { length: 160 },
    (_, index) => [index, (index * 19 + 37) % (mediumCount - 4)] as const,
  ),
];
const leftMembers = Array.from({ length: 60 }, (_, index) => `n${index}`);
const rightMembers = Array.from({ length: 60 }, (_, index) => `n${index + 60}`);

export const PHYSICS1_LAB_FIXTURES: readonly Physics1LabFixture[] = [
  makeFixture({
    id: 'focus-chain',
    label: 'Focus · chain',
    description: 'A connected hierarchy-like chain.',
    mode: 'focus',
    count: 10,
    pairs: chain(10),
  }),
  makeFixture({
    id: 'focus-star',
    label: 'Focus · star',
    description: 'One high-degree root with leaf reactions.',
    mode: 'focus',
    count: 12,
    pairs: Array.from({ length: 11 }, (_, index) => [0, index + 1]),
  }),
  makeFixture({
    id: 'focus-weak-link',
    label: 'Focus · weak link',
    description: 'Two strong regions joined by one weak reference.',
    mode: 'focus',
    count: 8,
    pairs: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4, 0.05],
      [4, 5],
      [5, 6],
      [6, 7],
    ],
  }),
  makeFixture({
    id: 'focus-one-isolate',
    label: 'Focus · isolate',
    description: 'A connected component plus one isolated node.',
    mode: 'focus',
    count: 8,
    pairs: chain(7),
  }),
  makeFixture({
    id: 'focus-multiple-isolates',
    label: 'Focus · multiple isolates',
    description: 'A short chain plus four isolated nodes.',
    mode: 'focus',
    count: 10,
    pairs: chain(6),
  }),
  makeFixture({
    id: 'all-medium-pull-off',
    label: 'All · medium · Pull off',
    description: 'Medium mixed topology with no folder field.',
    mode: 'all',
    count: mediumCount,
    pairs: mediumPairs,
  }),
  makeFixture({
    id: 'all-medium-pull-on',
    label: 'All · Pull on',
    description: 'One folder field stays active during drag and cooling.',
    mode: 'all',
    count: mediumCount,
    pairs: mediumPairs,
    attractors: [
      {
        ruleFolderKey: 'left',
        memberNodeKeys: leftMembers,
        targetX: -42,
        targetY: 0,
        strength: 70,
      },
    ],
  }),
  makeFixture({
    id: 'all-competing-pulls',
    label: 'All · competing Pulls',
    description: 'Two disjoint folder fields compete through reference edges.',
    mode: 'all',
    count: mediumCount,
    pairs: mediumPairs,
    attractors: [
      {
        ruleFolderKey: 'left',
        memberNodeKeys: leftMembers,
        targetX: 40,
        targetY: -18,
        strength: 65,
      },
      {
        ruleFolderKey: 'right',
        memberNodeKeys: rightMembers,
        targetX: -40,
        targetY: 18,
        strength: 65,
      },
    ],
  }),
  makeFixture({
    id: 'all-cross-reference',
    label: 'All · cross reference',
    description:
      'Strong long-range references transmit the constrained reaction.',
    mode: 'all',
    count: 40,
    pairs: [...ring(40), [0, 20, 8], [4, 28, 7], [10, 35, 6]],
  }),
  makeFixture({
    id: 'all-place-layer',
    label: 'All · Place layer',
    description:
      'Nodes n0–n9 retain a final display translation over dynamic physics.',
    mode: 'all',
    count: 40,
    pairs: ring(40),
    place: new Map(
      Array.from(
        { length: 10 },
        (_, index) => [`n${index}`, { x: 18, y: -10 }] as const,
      ),
    ),
  }),
];
