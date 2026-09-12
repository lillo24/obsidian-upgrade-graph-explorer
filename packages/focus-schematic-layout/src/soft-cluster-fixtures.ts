import type {
  EndpointFixtureDocument,
  EndpointFixtureEntity,
  EndpointFixtureReference,
  EndpointFixtureSpec,
} from './endpoint-fixtures';

const doc = (id: string, folder = 'root'): EndpointFixtureDocument => ({
  id,
  path: `${folder}/${id}.md`,
});
const ref = (
  sourceEntityId: string,
  targetEntityId: string,
): EndpointFixtureReference => ({
  sourceEntityId,
  targetEntityId,
});
const heading = (
  id: string,
  documentId: string,
  line: number,
  parentId = documentId,
): EndpointFixtureEntity => ({
  id,
  kind: 'section',
  documentId,
  parentId,
  line,
  title: id,
});

function fixture(
  id: `SC${number}` | `SS${number}-${'before' | 'after'}`,
  label: string,
  documents: readonly EndpointFixtureDocument[],
  references: readonly EndpointFixtureReference[],
  options: Partial<EndpointFixtureSpec> = {},
): EndpointFixtureSpec {
  return {
    id,
    label,
    authored:
      options.authored ??
      'Synthetic HIER4B topology and exact-folder identities.',
    expectation:
      options.expectation ??
      'Soft Clusters balances topology, hop structure, and repeated exact folders.',
    inspect:
      options.inspect ??
      'Compare the Directional Bands reference with Soft Clusters at every strength.',
    rootDocumentId: options.rootDocumentId ?? 'Focus',
    documents,
    references,
    ...(options.entities === undefined ? {} : { entities: options.entities }),
    ...(options.hops === undefined ? {} : { hops: options.hops }),
    ...(options.direction === undefined
      ? {}
      : { direction: options.direction }),
    ...(options.filters === undefined ? {} : { filters: options.filters }),
  };
}

const root = doc('Focus');

function starDocuments(count: number, folderFor: (index: number) => string) {
  return [
    root,
    ...Array.from({ length: count }, (_, index) =>
      doc(`Leaf${index + 1}`, folderFor(index)),
    ),
  ];
}

function starReferences(count: number) {
  return Array.from({ length: count }, (_, index) =>
    ref('Focus', `Leaf${index + 1}`),
  );
}

export function createSoftClusterHubFixture(
  count: number,
): EndpointFixtureSpec {
  return fixture(
    'SC11',
    `hub with ${count} leaves`,
    starDocuments(count, (index) => `hub-folder-${index % 5}`),
    starReferences(count),
    {
      hops: 1,
      inspect:
        'Check runtime scaling, collision freedom, and angular coverage around the root.',
    },
  );
}

export function createSoftClusterMultiplicityFixture(
  count: number,
): EndpointFixtureSpec {
  return fixture(
    'SC12',
    `relationship multiplicity ${count}`,
    [
      root,
      doc('RepeatedA', 'repeat'),
      doc('RepeatedB', 'repeat'),
      doc('Control', 'control'),
    ],
    [
      ...Array.from({ length: count }, () => ref('RepeatedA', 'RepeatedB')),
      ref('Focus', 'RepeatedA'),
      ref('Focus', 'Control'),
    ],
    {
      hops: 2,
      inspect:
        'Confirm logarithmic spring growth saturates rather than collapsing the pair.',
    },
  );
}

const sc17Before = fixture(
  'SS1-before',
  'small-change stability before',
  [
    root,
    doc('A1', 'alpha'),
    doc('A2', 'alpha'),
    doc('B1', 'beta'),
    doc('B2', 'beta'),
  ],
  [ref('Focus', 'A1'), ref('A1', 'A2'), ref('Focus', 'B1'), ref('B1', 'B2')],
  { hops: 2 },
);
const sc17After = fixture(
  'SS1-after',
  'small-change stability after',
  [...sc17Before.documents, doc('A3', 'alpha')],
  [...sc17Before.references, ref('A2', 'A3')],
  { hops: 3 },
);
const sc18Visible = fixture(
  'SS2-before',
  'hide/restore visible state',
  [
    root,
    doc('VisibleA', 'alpha'),
    doc('VisibleB', 'alpha'),
    doc('Hidden', 'alpha'),
  ],
  [ref('Focus', 'VisibleA'), ref('Focus', 'VisibleB'), ref('Focus', 'Hidden')],
  { hops: 1 },
);
const sc18Hidden = fixture(
  'SS2-after',
  'hide/restore filtered state',
  sc18Visible.documents,
  sc18Visible.references,
  { filters: { text: 'Visible' }, hops: 1 },
);
const sc19Focus = fixture(
  'SS3-before',
  'reroot from Focus',
  [
    root,
    doc('A1', 'alpha'),
    doc('A2', 'alpha'),
    doc('B1', 'beta'),
    doc('B2', 'beta'),
  ],
  [ref('Focus', 'A1'), ref('A1', 'A2'), ref('A1', 'B1'), ref('B1', 'B2')],
  { hops: 3 },
);
const sc19A1 = fixture(
  'SS3-after',
  'reroot to A1',
  sc19Focus.documents,
  sc19Focus.references,
  { rootDocumentId: 'A1', hops: 3 },
);

export interface SoftClusterStabilityPair {
  readonly id: string;
  readonly label: string;
  readonly before: EndpointFixtureSpec;
  readonly after: EndpointFixtureSpec;
}

export const SOFT_CLUSTER_STABILITY_PAIRS: readonly SoftClusterStabilityPair[] =
  [
    {
      id: 'SC17',
      label: 'one nearby File added',
      before: sc17Before,
      after: sc17After,
    },
    {
      id: 'SC18',
      label: 'one File hidden by query',
      before: sc18Visible,
      after: sc18Hidden,
    },
    { id: 'SC19', label: 'Focus rerooted', before: sc19Focus, after: sc19A1 },
  ];

export const SOFT_CLUSTER_FIXTURES: readonly EndpointFixtureSpec[] = [
  fixture(
    'SC1',
    'topology-only star',
    starDocuments(8, (index) => `single-${index}`),
    starReferences(8),
    {
      hops: 1,
      expectation: 'Strength zero produces a folder-independent topology star.',
    },
  ),
  fixture(
    'SC2',
    'two repeated folders',
    [
      root,
      doc('A1', 'alpha'),
      doc('A2', 'alpha'),
      doc('A3', 'alpha'),
      doc('B1', 'beta'),
      doc('B2', 'beta'),
      doc('B3', 'beta'),
    ],
    [
      ref('Focus', 'A1'),
      ref('Focus', 'B1'),
      ref('A1', 'A2'),
      ref('A1', 'A3'),
      ref('B1', 'B2'),
      ref('B1', 'B3'),
    ],
    { hops: 2 },
  ),
  fixture(
    'SC3',
    'topology versus folder conflict',
    [
      root,
      doc('A1', 'alpha'),
      doc('A2', 'alpha'),
      doc('B1', 'beta'),
      doc('B2', 'beta'),
    ],
    [ref('Focus', 'A1'), ref('A1', 'B1'), ref('B1', 'A2'), ref('A2', 'B2')],
    {
      hops: 3,
      expectation:
        'Folder attraction remains soft when the primary chain alternates folders.',
    },
  ),
  fixture(
    'SC4',
    'folder and topology cooperation',
    [
      root,
      doc('A1', 'alpha'),
      doc('A2', 'alpha'),
      doc('A3', 'alpha'),
      doc('B1', 'beta'),
      doc('B2', 'beta'),
    ],
    [
      ref('Focus', 'A1'),
      ref('A1', 'A2'),
      ref('A2', 'A3'),
      ref('Focus', 'B1'),
      ref('B1', 'B2'),
    ],
    { hops: 3 },
  ),
  fixture(
    'SC5',
    'disconnected same-folder islands',
    [
      root,
      doc('A1', 'shared'),
      doc('A2', 'shared'),
      doc('Bridge1', 'bridge'),
      doc('Bridge2', 'bridge'),
    ],
    [
      ref('Focus', 'A1'),
      ref('Focus', 'Bridge1'),
      ref('Bridge1', 'Bridge2'),
      ref('Bridge2', 'A2'),
    ],
    {
      hops: 3,
      expectation:
        'Same-folder attraction improves cohesion without erasing the topology bridge.',
    },
  ),
  fixture(
    'SC6',
    'singleton folders',
    starDocuments(7, (index) => `only-${index}`),
    starReferences(7),
    {
      hops: 1,
      expectation: 'Singleton folders exert exactly zero folder force.',
    },
  ),
  fixture(
    'SC7',
    'nested exact folders',
    [
      root,
      doc('Parent1', 'area'),
      doc('Parent2', 'area'),
      doc('Child1', 'area/child'),
      doc('Child2', 'area/child'),
      doc('Sibling', 'area/other'),
    ],
    [
      ref('Focus', 'Parent1'),
      ref('Parent1', 'Child1'),
      ref('Parent2', 'Child2'),
      ref('Focus', 'Parent2'),
      ref('Focus', 'Sibling'),
    ],
    {
      hops: 2,
      expectation:
        'Only exact folder keys cohere; parent and child folders stay distinct.',
    },
  ),
  fixture(
    'SC8',
    'repeated root folder',
    [
      root,
      doc('RootPeer1'),
      doc('RootPeer2'),
      doc('Other1', 'other'),
      doc('Other2', 'other'),
    ],
    [
      ref('RootPeer1', 'Focus'),
      ref('Focus', 'RootPeer2'),
      ref('Focus', 'Other1'),
      ref('Other1', 'Other2'),
    ],
    {
      hops: 2,
      expectation:
        'Root-folder peers attract each other while the visible root File remains a neutral centered anchor.',
    },
  ),
  fixture(
    'SC9',
    'long visible hop chain',
    [root, doc('Hop1', 'one'), doc('Hop2', 'two'), doc('Hop3', 'three')],
    [ref('Focus', 'Hop1'), ref('Hop1', 'Hop2'), ref('Hop2', 'Hop3')],
    {
      hops: 3,
      expectation:
        'Undirected minimum-hop radius remains legible through three hops.',
    },
  ),
  fixture(
    'SC10',
    'cycle',
    [
      root,
      doc('Cycle1', 'cycle'),
      doc('Cycle2', 'cycle'),
      doc('Cycle3', 'cycle'),
      doc('Cycle4', 'cycle'),
    ],
    [
      ref('Focus', 'Cycle1'),
      ref('Cycle1', 'Cycle2'),
      ref('Cycle2', 'Cycle3'),
      ref('Cycle3', 'Cycle4'),
      ref('Cycle4', 'Focus'),
    ],
    { hops: 2 },
  ),
  createSoftClusterHubFixture(20),
  createSoftClusterMultiplicityFixture(5),
  fixture(
    'SC13',
    'filtered bridge',
    [
      root,
      doc('VisibleA', 'visible'),
      doc('HiddenBridge', 'private'),
      doc('VisibleB', 'visible'),
    ],
    [
      ref('Focus', 'VisibleA'),
      ref('VisibleA', 'HiddenBridge'),
      ref('HiddenBridge', 'VisibleB'),
    ],
    {
      filters: { text: 'Visible' },
      hops: 3,
      expectation:
        'The filtered bridge participates in topology but never in a folder centroid.',
    },
  ),
  fixture(
    'SC14',
    'multi-heading Adaptive Compass',
    [
      root,
      ...Array.from({ length: 7 }, (_, index) =>
        doc(`Target${index + 1}`, `folder-${index % 3}`),
      ),
    ],
    Array.from({ length: 7 }, (_, index) =>
      ref(`H${index + 1}`, `Target${index + 1}`),
    ),
    {
      entities: Array.from({ length: 7 }, (_, index) =>
        heading(`H${index + 1}`, 'Focus', index * 2 + 2),
      ),
      hops: 1,
      inspect:
        'Inspect 5–8 root branches, endpoint facing, branch regions, and Compass churn.',
    },
  ),
  fixture(
    'SC15',
    'mixed direction on every side',
    [
      root,
      doc('InA', 'mix'),
      doc('InB', 'mix'),
      doc('OutA', 'other'),
      doc('OutB', 'other'),
      doc('Mutual', 'mutual'),
    ],
    [
      ref('InA', 'Focus'),
      ref('InB', 'Focus'),
      ref('Focus', 'OutA'),
      ref('Focus', 'OutB'),
      ref('Focus', 'Mutual'),
      ref('Mutual', 'Focus'),
    ],
    {
      hops: 1,
      expectation:
        'Authored arrows preserve direction while macro positions may occupy any side.',
    },
  ),
  fixture(
    'SC16',
    'strength progression',
    starDocuments(12, (index) =>
      index < 4 ? 'alpha' : index < 8 ? 'beta' : 'gamma',
    ),
    starReferences(12),
    {
      hops: 1,
      inspect:
        'View 0/25/50/75/100 side by side; cohesion should strengthen continuously without hard bands.',
    },
  ),
  { ...sc17Before, id: 'SC17', label: 'small-change stability base' },
  fixture(
    'SC18',
    'hide and restore',
    [
      root,
      doc('VisibleA', 'alpha'),
      doc('VisibleB', 'alpha'),
      doc('Hidden', 'alpha'),
    ],
    [
      ref('Focus', 'VisibleA'),
      ref('Focus', 'VisibleB'),
      ref('Focus', 'Hidden'),
    ],
    { filters: { text: 'Visible' }, hops: 1 },
  ),
  fixture(
    'SC19',
    'reroot',
    [
      root,
      doc('A1', 'alpha'),
      doc('A2', 'alpha'),
      doc('B1', 'beta'),
      doc('B2', 'beta'),
    ],
    [ref('Focus', 'A1'), ref('A1', 'A2'), ref('A1', 'B1'), ref('B1', 'B2')],
    {
      hops: 3,
      inspect:
        'Change the Focus between revisions and check exact root anchoring and bounded displacement.',
    },
  ),
  fixture(
    'SC20',
    'secondary-edge invariance',
    [root, doc('A', 'alpha'), doc('B', 'beta'), doc('Secondary', 'other')],
    [
      ref('Focus', 'A'),
      ref('Focus', 'B'),
      ref('A', 'Secondary'),
      ref('B', 'Secondary'),
      ref('A', 'B'),
    ],
    {
      hops: 2,
      expectation: 'Secondary relationships have zero geometry influence.',
    },
  ),
  fixture(
    'SC21',
    'large mixed-folder graph',
    starDocuments(36, (index) =>
      index % 7 === 0 ? `singleton-${index}` : `mixed-${index % 6}`,
    ),
    [
      ...starReferences(18),
      ...Array.from({ length: 18 }, (_, index) =>
        ref(`Leaf${(index % 18) + 1}`, `Leaf${index + 19}`),
      ),
    ],
    { hops: 2 },
  ),
  fixture(
    'SC22',
    'asymmetric variable rectangles',
    [root, doc('Tall', 'shape'), doc('Wide', 'shape'), doc('Plain', 'other')],
    [
      ref('Focus', 'Tall'),
      ref('Focus', 'Wide'),
      ref('TallH4', 'Plain'),
      ref('WideH1', 'Tall'),
    ],
    {
      entities: [
        heading('TallH1', 'Tall', 2),
        heading('TallH2', 'Tall', 4),
        heading('TallH3', 'Tall', 6),
        heading('TallH4', 'Tall', 8),
        heading('WideH1', 'Wide', 2),
        heading('WideH2', 'Wide', 4),
        heading('WideH3', 'Wide', 6),
      ],
      hops: 2,
      expectation:
        'Collision and spring distances use the final variable module rectangles.',
    },
  ),
  fixture(
    'SC23',
    'topology legitimately splits one folder',
    [
      root,
      doc('SharedA', 'shared'),
      doc('SharedB', 'shared'),
      doc('Left', 'left'),
      doc('Right', 'right'),
    ],
    [
      ref('Focus', 'Left'),
      ref('Left', 'SharedA'),
      ref('Focus', 'Right'),
      ref('Right', 'SharedB'),
    ],
    {
      hops: 2,
      expectation:
        'Soft folder attraction must not override two strong topology branches.',
    },
  ),
  fixture(
    'SC24',
    'root with several free 2D folders',
    starDocuments(15, (index) => `cluster-${index % 4}`),
    [
      ...starReferences(8),
      ...Array.from({ length: 7 }, (_, index) =>
        ref(`Leaf${(index % 8) + 1}`, `Leaf${index + 9}`),
      ),
    ],
    {
      hops: 2,
      expectation:
        'The result uses the full plane and does not recreate directional rank bands.',
    },
  ),
];
