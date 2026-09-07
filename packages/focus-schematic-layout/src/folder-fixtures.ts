import type {
  EndpointFixtureDocument,
  EndpointFixtureEntity,
  EndpointFixtureReference,
  EndpointFixtureSpec,
} from './endpoint-fixtures';

const doc = (id: string, path: string): EndpointFixtureDocument => ({
  id,
  path,
});
const ref = (
  sourceEntityId: string,
  targetEntityId: string,
): EndpointFixtureReference => ({ sourceEntityId, targetEntityId });
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
const block = (
  id: string,
  documentId: string,
  parentId: string,
  line: number,
): EndpointFixtureEntity => ({
  id,
  kind: 'block',
  documentId,
  parentId,
  line,
});

const fixture = (
  id: `FB${number}` | `DB${number}` | `VS${number}` | `CP${number}`,
  label: string,
  documents: readonly EndpointFixtureDocument[],
  references: readonly EndpointFixtureReference[],
  options: Partial<EndpointFixtureSpec> = {},
): EndpointFixtureSpec => ({
  id,
  label,
  authored: options.authored ?? 'Synthetic exact-folder relationships.',
  expectation:
    options.expectation ??
    'Every visible exact folder owns a directional band.',
  inspect:
    options.inspect ??
    'Compare categorical Directional Folder Bands On with the pure A1 Off baseline.',
  rootDocumentId: options.rootDocumentId ?? 'Focus',
  documents,
  references,
  ...(options.entities === undefined ? {} : { entities: options.entities }),
  ...(options.direction === undefined ? {} : { direction: options.direction }),
  ...(options.hops === undefined ? {} : { hops: options.hops }),
  ...(options.filters === undefined ? {} : { filters: options.filters }),
  ...(options.collapsedEntityIds === undefined
    ? {}
    : { collapsedEntityIds: options.collapsedEntityIds }),
  ...(options.expandedEntityIds === undefined
    ? {}
    : { expandedEntityIds: options.expandedEntityIds }),
  ...(options.unresolvedFromEntityIds === undefined
    ? {}
    : { unresolvedFromEntityIds: options.unresolvedFromEntityIds }),
});

const root = doc('Focus', 'root/Focus.md');

export const FOLDER_FIXTURES: readonly EndpointFixtureSpec[] = [
  fixture(
    'FB1',
    'root folder central',
    [
      root,
      doc('RootPeerLeft', 'root/RootPeerLeft.md'),
      doc('RootPeerRight', 'root/RootPeerRight.md'),
      doc('ScienceA', 'science/ScienceA.md'),
      doc('ScienceB', 'science/ScienceB.md'),
      doc('LanguageA', 'language/LanguageA.md'),
      doc('LanguageB', 'language/LanguageB.md'),
    ],
    [
      ref('RootPeerLeft', 'Focus'),
      ref('Focus', 'RootPeerRight'),
      ref('Focus', 'ScienceA'),
      ref('ScienceA', 'ScienceB'),
      ref('LanguageA', 'Focus'),
      ref('LanguageB', 'LanguageA'),
    ],
    {
      authored: 'Root peers and two repeated folders span both macro sides.',
      expectation: 'The root folder stays central and repeated folders cohere.',
      inspect:
        'Root center, folder bands, rank sides, crossings, and inversions.',
    },
  ),
  fixture(
    'FB2',
    'same folder across ranks',
    [
      root,
      doc('SharedLeftFar', 'shared/LeftFar.md'),
      doc('SharedLeftNear', 'shared/LeftNear.md'),
      doc('SharedRightNear', 'shared/RightNear.md'),
      doc('SharedRightFar', 'shared/RightFar.md'),
    ],
    [
      ref('SharedLeftFar', 'SharedLeftNear'),
      ref('SharedLeftNear', 'Focus'),
      ref('Focus', 'SharedRightNear'),
      ref('SharedRightNear', 'SharedRightFar'),
    ],
    {
      expectation:
        'One exact folder shares a band target across ranks -2, -1, +1, and +2.',
      hops: 2,
    },
  ),
  fixture(
    'FB3',
    'FB4-safe · safe interleaving repair',
    [
      root,
      doc('01-Alpha', 'alpha/01.md'),
      doc('02-Beta', 'beta/02.md'),
      doc('03-Alpha', 'alpha/03.md'),
      doc('04-Beta', 'beta/04.md'),
    ],
    ['01-Alpha', '02-Beta', '03-Alpha', '04-Beta'].map((target) =>
      ref('Focus', target),
    ),
    {
      expectation:
        'Endpoint-safe adjacent swaps reduce alpha/beta rank fragments.',
      hops: 1,
    },
  ),
  fixture(
    'FB4',
    'FB4-topology-tension · candidate-specific ordering',
    [
      root,
      doc('01-Alpha', 'alpha/01.md'),
      doc('02-Beta', 'beta/02.md'),
      doc('Outer03', 'outer-03/Outer.md'),
      doc('Outer04', 'outer-04/Outer.md'),
      doc('Outer01', 'outer-01/Outer.md'),
      doc('Outer02', 'outer-02/Outer.md'),
    ],
    [
      ref('Focus', '01-Alpha'),
      ref('Focus', '02-Beta'),
      ref('01-Alpha', 'Outer01'),
      ref('01-Alpha', 'Outer02'),
      ref('02-Beta', 'Outer03'),
      ref('02-Beta', 'Outer04'),
    ],
    {
      entities: Array.from({ length: 3 }, (_, index) =>
        heading(`Alpha-H${index + 1}`, '01-Alpha', index * 2 + 2),
      ),
      expectation:
        'Beta is evaluated above and below Root after candidate-specific endpoint and module ordering.',
      hops: 2,
    },
  ),
  fixture(
    'FB5',
    'root folder across ranks',
    [
      root,
      doc('RootIncoming', 'root/Incoming.md'),
      doc('RootOutgoing', 'root/Outgoing.md'),
      doc('OtherA', 'other/A.md'),
      doc('OtherB', 'other/B.md'),
    ],
    [
      ref('OtherA', 'RootIncoming'),
      ref('RootIncoming', 'Focus'),
      ref('Focus', 'RootOutgoing'),
      ref('RootOutgoing', 'OtherB'),
    ],
    { hops: 2 },
  ),
  fixture(
    'FB6',
    'nested exact folders',
    [
      root,
      doc('ScienceA', 'science/A.md'),
      doc('ScienceB', 'science/B.md'),
      doc('NeuroA', 'science/neuro/A.md'),
      doc('NeuroB', 'science/neuro/B.md'),
      doc('CogA', 'science/cog/A.md'),
      doc('CogB', 'science/cog/B.md'),
    ],
    ['ScienceA', 'ScienceB', 'NeuroA', 'NeuroB', 'CogA', 'CogB'].map((target) =>
      ref('Focus', target),
    ),
    {
      expectation:
        'science, science/neuro, and science/cog stay distinct exact-folder bands.',
      hops: 1,
    },
  ),
  fixture(
    'FB7',
    'singleton folders',
    [
      root,
      ...Array.from({ length: 10 }, (_, index) =>
        doc(`Singleton-${index + 1}`, `unique-${index + 1}/Note.md`),
      ),
    ],
    Array.from({ length: 10 }, (_, index) =>
      ref('Focus', `Singleton-${index + 1}`),
    ),
    {
      expectation:
        'Every visible singleton folder receives a real band and placement target.',
      hops: 1,
    },
  ),
  fixture(
    'FB8',
    'filtered bridge',
    [
      root,
      doc('Hidden', 'private/Hidden.md'),
      doc('Visible', 'public/Visible.md'),
    ],
    [ref('Focus', 'Hidden'), ref('Hidden', 'Visible')],
    {
      direction: 'outgoing',
      hops: 2,
      filters: { text: 'Visible' },
      expectation: 'The filtered bridge creates no folder demand or label.',
    },
  ),
  fixture(
    'FB9',
    'duplicate basenames',
    [root, doc('OneNote', 'one/Note.md'), doc('TwoNote', 'two/Note.md')],
    [ref('Focus', 'OneNote'), ref('Focus', 'TwoNote')],
    {
      expectation:
        'Folder identity follows exact folderKey, never basename text.',
      hops: 1,
    },
  ),
  fixture(
    'FB10',
    'equal mutual',
    [root, doc('MutualA', 'shared/A.md'), doc('MutualB', 'shared/B.md')],
    [
      ref('Focus', 'MutualA'),
      ref('MutualA', 'Focus'),
      ref('Focus', 'MutualB'),
      ref('MutualB', 'Focus'),
    ],
    {
      expectation:
        'Folder pull never changes the accepted equal-mutual side decision.',
      hops: 1,
    },
  ),
  fixture(
    'FB11',
    'multi-hop folders',
    [
      root,
      doc('LeftNear', 'chain/LeftNear.md'),
      doc('LeftFar', 'chain/LeftFar.md'),
      doc('RightNear', 'chain/RightNear.md'),
      doc('RightFar', 'chain/RightFar.md'),
      doc('PeerA', 'peers/A.md'),
      doc('PeerB', 'peers/B.md'),
    ],
    [
      ref('LeftFar', 'LeftNear'),
      ref('LeftNear', 'Focus'),
      ref('Focus', 'RightNear'),
      ref('RightNear', 'RightFar'),
      ref('PeerA', 'LeftNear'),
      ref('RightNear', 'PeerB'),
    ],
    { hops: 2 },
  ),
  fixture(
    'FB12',
    'endpoint-rich folder fan',
    [
      root,
      doc('ScienceA', 'science/A.md'),
      doc('ScienceB', 'science/B.md'),
      doc('LanguageA', 'language/A.md'),
      doc('LanguageB', 'language/B.md'),
    ],
    [
      ref('Focus-H1', 'ScienceA-H1'),
      ref('Focus-H2', 'ScienceB-B1'),
      ref('Focus-H3', 'LanguageA-H1'),
      ref('Focus-H4', 'LanguageB-B1'),
    ],
    {
      entities: [
        heading('Focus-H1', 'Focus', 2),
        heading('Focus-H2', 'Focus', 4),
        heading('Focus-H3', 'Focus', 6),
        heading('Focus-H4', 'Focus', 8),
        heading('ScienceA-H1', 'ScienceA', 2),
        heading('ScienceB-H1', 'ScienceB', 2),
        block('ScienceB-B1', 'ScienceB', 'ScienceB-H1', 3),
        heading('LanguageA-H1', 'LanguageA', 2),
        heading('LanguageB-H1', 'LanguageB', 2),
        block('LanguageB-B1', 'LanguageB', 'LanguageB-H1', 3),
      ],
      expectation:
        'Repeated folders cohere without worsening precise Heading/Block links.',
      hops: 1,
    },
  ),
  fixture(
    'FB13',
    'center-spine root with folders',
    [
      root,
      doc('ScienceA', 'science/A.md'),
      doc('ScienceB', 'science/B.md'),
      doc('LanguageA', 'language/A.md'),
      doc('LanguageB', 'language/B.md'),
    ],
    ['ScienceA', 'ScienceB', 'LanguageA', 'LanguageB'].map((target, index) =>
      ref(`Focus-H${index + 1}`, target),
    ),
    {
      entities: Array.from({ length: 5 }, (_, index) =>
        heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
      ),
      expectation:
        'The five-Heading root center spine remains vertically centered.',
      hops: 1,
    },
  ),
  fixture(
    'FB14',
    'diagnostics with folder bands',
    [root, doc('ScienceA', 'science/A.md'), doc('ScienceB', 'science/B.md')],
    [ref('Focus', 'ScienceA'), ref('Focus', 'ScienceB')],
    {
      unresolvedFromEntityIds: ['Focus'],
      expectation:
        'Diagnostic reserve remains contained after folder movement.',
      hops: 1,
    },
  ),
  fixture(
    'FB15',
    'query hide and restore',
    [
      root,
      doc('VisibleA', 'shared/VisibleA.md'),
      doc('VisibleB', 'shared/VisibleB.md'),
      doc('Hideable', 'shared/Hideable.md'),
    ],
    [
      ref('Focus', 'VisibleA'),
      ref('Focus', 'VisibleB'),
      ref('Focus', 'Hideable'),
    ],
    {
      expectation:
        'Hide/restore recomputes the band and restores exact geometry.',
      hops: 1,
    },
  ),
  fixture(
    'FB16',
    'stable File moves folder',
    [
      root,
      doc('Moving', 'amber/Moving.md'),
      doc('AmberPeer', 'amber/Peer.md'),
      doc('BluePeer', 'blue/Peer.md'),
    ],
    [
      ref('Focus', 'Moving'),
      ref('Focus', 'AmberPeer'),
      ref('Focus', 'BluePeer'),
    ],
    {
      expectation:
        'Exact folder changes deterministically change band preference.',
      hops: 1,
    },
  ),
  fixture(
    'FB17',
    'secondary-only invariant',
    [root, doc('SharedA', 'shared/A.md'), doc('SharedB', 'shared/B.md')],
    [
      ref('Focus', 'SharedA'),
      ref('Focus', 'SharedB'),
      ref('SharedA', 'SharedB'),
    ],
    {
      expectation:
        'The secondary relationship has zero folder-plan or geometry influence.',
      hops: 1,
    },
  ),
  fixture(
    'FB18',
    'weird-motion regression',
    [
      root,
      doc('LanguageA', 'language/A.md'),
      doc('ScienceA', 'science/A.md'),
      doc('LanguageB', 'language/B.md'),
      doc('ScienceB', 'science/B.md'),
      doc('NeuroA', 'science/neuro/A.md'),
      doc('LanguageC', 'language/C.md'),
      doc('NeuroB', 'science/neuro/B.md'),
      doc('ScienceC', 'science/C.md'),
      doc('AmberOnly', 'amber/Only.md'),
      doc('BlueOnly', 'blue/Only.md'),
    ],
    [
      'LanguageA',
      'ScienceA',
      'LanguageB',
      'ScienceB',
      'NeuroA',
      'LanguageC',
      'NeuroB',
      'ScienceC',
      'AmberOnly',
      'BlueOnly',
    ].map((target) => ref('Focus', target)),
    {
      expectation:
        'Every visible File remains in or moves into its exact band without the old soft-pull drift.',
      inspect:
        'Language, science, nested, and singleton Files stay fully inside their exact guides.',
      hops: 1,
    },
  ),
];

/** Focused HIER4A categorical Directional Folder Bands review corpus. */
export const DIRECTIONAL_FOLDER_BAND_FIXTURES: readonly EndpointFixtureSpec[] =
  [
    fixture(
      'DB1',
      'all singleton folders',
      [
        root,
        doc('Amber', 'amber/Note.md'),
        doc('Blue', 'blue/Note.md'),
        doc('Cedar', 'cedar/Note.md'),
        doc('Delta', 'delta/Note.md'),
      ],
      ['Amber', 'Blue', 'Cedar', 'Delta'].map((target) => ref('Focus', target)),
      {
        expectation:
          'All five visible exact folders, including four non-root singletons, own real bands.',
        hops: 1,
      },
    ),
    fixture(
      'DB2',
      'singleton and repeated folder mix',
      [
        root,
        doc('AmberA', 'amber/A.md'),
        doc('AmberB', 'amber/B.md'),
        doc('AmberC', 'amber/C.md'),
        doc('Blue', 'blue/Only.md'),
        doc('CedarA', 'cedar/A.md'),
        doc('CedarB', 'cedar/B.md'),
        doc('Delta', 'delta/Only.md'),
      ],
      ['AmberA', 'Blue', 'CedarA', 'AmberB', 'Delta', 'CedarB', 'AmberC'].map(
        (target) => ref('Focus', target),
      ),
      {
        expectation:
          'Repeated and singleton exact folders share the same categorical ownership contract.',
        hops: 1,
      },
    ),
    fixture(
      'DB3',
      'contradictory rank folder order',
      [
        root,
        doc('AmberIn', 'amber/In.md'),
        doc('BlueIn', 'blue/In.md'),
        doc('AmberOut', 'amber/Out.md'),
        doc('BlueOut', 'blue/Out.md'),
      ],
      [
        ref('AmberIn-H', 'Focus-H1'),
        ref('BlueIn-H', 'Focus-H2'),
        ref('Focus-H1', 'BlueOut-H'),
        ref('Focus-H2', 'AmberOut-H'),
      ],
      {
        entities: [
          heading('Focus-H1', 'Focus', 2),
          heading('Focus-H2', 'Focus', 4),
          heading('AmberIn-H', 'AmberIn', 2),
          heading('BlueIn-H', 'BlueIn', 2),
          heading('AmberOut-H', 'AmberOut', 2),
          heading('BlueOut-H', 'BlueOut', 2),
        ],
        expectation:
          'Contradictory rank evidence produces the smallest explicit exception set.',
        hops: 1,
      },
    ),
    fixture(
      'DB4',
      'root folder singleton',
      [
        root,
        doc('AmberA', 'amber/A.md'),
        doc('AmberB', 'amber/B.md'),
        doc('BlueA', 'blue/A.md'),
        doc('BlueB', 'blue/B.md'),
      ],
      ['AmberA', 'AmberB', 'BlueA', 'BlueB'].map((target) =>
        ref('Focus', target),
      ),
      {
        expectation: 'The singleton root folder remains a real central band.',
        hops: 1,
      },
    ),
    fixture(
      'DB5',
      'center spine with directional bands',
      [
        root,
        doc('AmberA', 'amber/A.md'),
        doc('AmberB', 'amber/B.md'),
        doc('BlueA', 'blue/A.md'),
        doc('BlueB', 'blue/B.md'),
      ],
      ['AmberA', 'BlueA', 'AmberB', 'BlueB'].map((target, index) =>
        ref(`Focus-H${index + 1}`, target),
      ),
      {
        entities: Array.from({ length: 5 }, (_, index) =>
          heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
        ),
        expectation:
          'The five-Heading center spine stays internally unchanged while external Files band safely.',
        hops: 1,
      },
    ),
    fixture(
      'DB6',
      'query hides one exact folder',
      [
        root,
        doc('AmberVisible', 'amber/Visible.md'),
        doc('BlueHidden', 'blue/Hidden.md'),
      ],
      [ref('Focus', 'AmberVisible'), ref('Focus', 'BlueHidden')],
      {
        filters: { text: 'Visible' },
        expectation:
          'A folder with no currently visible File has no stale band and returns deterministically when restored.',
        hops: 1,
      },
    ),
    fixture(
      'DB7',
      'secondary-only relation change',
      [root, doc('AmberA', 'amber/A.md'), doc('AmberB', 'amber/B.md')],
      [ref('Focus', 'AmberA'), ref('Focus', 'AmberB'), ref('AmberA', 'AmberB')],
      {
        expectation:
          'A secondary-only relationship has zero band-plan, exception, or geometry influence.',
        hops: 1,
      },
    ),
    fixture(
      'DB8',
      'filtered bridge between visible bands',
      [
        root,
        doc('HiddenBridge', 'private/Bridge.md'),
        doc('AmberVisible', 'amber/Visible.md'),
        doc('BlueVisible', 'blue/Visible.md'),
      ],
      [
        ref('Focus', 'HiddenBridge'),
        ref('HiddenBridge', 'AmberVisible'),
        ref('HiddenBridge', 'BlueVisible'),
      ],
      {
        direction: 'outgoing',
        hops: 2,
        filters: { text: 'Visible' },
        expectation:
          'The filtered bridge remains an obstacle without exposing its exact folder.',
      },
    ),
    fixture(
      'DB9',
      'balanced two-folder partition',
      [root, doc('Amber', 'amber/Only.md'), doc('Blue', 'blue/Only.md')],
      [ref('Focus', 'Amber'), ref('Focus', 'Blue')],
      {
        expectation:
          'Two similarly sized non-root bands split one above and one below the root band.',
        hops: 1,
      },
    ),
    fixture(
      'DB10',
      'unequal-height root balance',
      [
        root,
        doc('Tall', 'tall/Deep.md'),
        doc('ShortA', 'short-a/Only.md'),
        doc('ShortB', 'short-b/Only.md'),
      ],
      [ref('Focus', 'Tall'), ref('Focus', 'ShortA'), ref('Focus', 'ShortB')],
      {
        entities: Array.from({ length: 6 }, (_, index) =>
          heading(`Tall-H${index + 1}`, 'Tall', index * 2 + 2),
        ),
        expectation:
          'The tall band occupies one side while the two short bands share the other by packed extent.',
        hops: 1,
      },
    ),
    fixture(
      'DB11',
      'root balance requiring endpoint reorder',
      [
        root,
        doc('RootPeer', 'root/Peer.md'),
        doc('Amber', 'amber/Only.md'),
        doc('Blue', 'blue/Only.md'),
      ],
      [
        ref('Focus-H1', 'RootPeer'),
        ref('Focus-H2', 'Amber'),
        ref('Focus-H3', 'Blue'),
      ],
      {
        entities: Array.from({ length: 3 }, (_, index) =>
          heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
        ),
        expectation:
          'Crossing-optimized visual sibling order unlocks a balanced split without changing source order.',
        hops: 1,
      },
    ),
    fixture(
      'DB12',
      'root internal-layout pressure',
      [
        root,
        doc('RootIncoming', 'root/Incoming.md'),
        doc('RootPeer', 'root/Peer.md'),
        doc('Amber', 'amber/Only.md'),
        doc('Blue', 'blue/Only.md'),
      ],
      [
        ref('RootIncoming', 'Focus-H1'),
        ref('Focus-H1', 'RootPeer'),
        ref('Focus-H2', 'Amber'),
        ref('Focus-H3', 'Blue'),
      ],
      {
        entities: Array.from({ length: 3 }, (_, index) =>
          heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
        ),
        direction: 'both',
        expectation:
          'Current mosaic pressure is compared neutrally against File-centered internal-layout candidates.',
        hops: 1,
      },
    ),
    fixture(
      'DB13',
      'root balance outranks baseline displacement',
      [root, doc('Amber', 'amber/Only.md'), doc('Blue', 'blue/Only.md')],
      [ref('Focus', 'Amber'), ref('Focus', 'Blue')],
      {
        expectation:
          'One folder moves across Root even though pure A1 initially places both on the same side.',
        hops: 1,
      },
    ),
    fixture(
      'DB14',
      'balanced assignment chooses shorter endpoints',
      [root, doc('Amber', 'amber/Only.md'), doc('Blue', 'blue/Only.md')],
      [ref('Focus-H1', 'Amber-H4'), ref('Focus-H2', 'Blue')],
      {
        entities: [
          heading('Focus-H1', 'Focus', 2),
          heading('Focus-H2', 'Focus', 12),
          ...Array.from({ length: 4 }, (_, index) =>
            heading(`Amber-H${index + 1}`, 'Amber', index * 2 + 2),
          ),
        ],
        expectation:
          'Equal-topology balanced assignments are resolved by exact primary endpoint vertical span.',
        hops: 1,
      },
    ),
    fixture(
      'DB15',
      'source order wins an exact visual tie',
      [root, doc('Amber', 'amber/Only.md'), doc('Blue', 'blue/Only.md')],
      [ref('Focus', 'Amber'), ref('Focus', 'Blue')],
      {
        entities: [
          heading('Focus-H1', 'Focus', 2),
          heading('Focus-H2', 'Focus', 4),
        ],
        expectation:
          'Uninfluenced legal siblings retain source order because no graph metric strictly improves.',
        hops: 1,
      },
    ),
    fixture(
      'DB16',
      'secondary-invariant joint ordering',
      [
        root,
        doc('RootPeer', 'root/Peer.md'),
        doc('Amber', 'amber/Only.md'),
        doc('Blue', 'blue/Only.md'),
      ],
      [
        ref('Focus-H1', 'RootPeer'),
        ref('Focus-H2', 'Amber'),
        ref('Focus-H3', 'Blue'),
        ref('Amber', 'Blue'),
      ],
      {
        entities: Array.from({ length: 3 }, (_, index) =>
          heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
        ),
        expectation:
          'The additional secondary relationship has zero joint-order or folder geometry influence.',
        hops: 1,
      },
    ),
    fixture(
      'DB17',
      'multiple reorderable sibling groups',
      [
        root,
        doc('AmberHub', 'amber/Hub.md'),
        doc('BlueHub', 'blue/Hub.md'),
        doc('AmberLeaf', 'amber-leaf/Only.md'),
        doc('BlueLeaf', 'blue-leaf/Only.md'),
      ],
      [
        ref('Focus-H1', 'BlueHub'),
        ref('Focus-H2', 'AmberHub'),
        ref('Amber-H1', 'BlueLeaf'),
        ref('Amber-H2', 'AmberLeaf'),
        ref('Blue-H1', 'AmberLeaf'),
        ref('Blue-H2', 'BlueLeaf'),
      ],
      {
        entities: [
          heading('Focus-H1', 'Focus', 2),
          heading('Focus-H2', 'Focus', 4),
          heading('Amber-H1', 'AmberHub', 2),
          heading('Amber-H2', 'AmberHub', 4),
          heading('Blue-H1', 'BlueHub', 2),
          heading('Blue-H2', 'BlueHub', 4),
        ],
        expectation:
          'Two candidate-local sibling groups refine within the same fixed two-round budget.',
        hops: 2,
      },
    ),
    fixture(
      'DB18',
      'reroot with crossing-optimized order',
      [
        doc('Focus', 'root/Focus.md'),
        doc('Amber', 'amber/Only.md'),
        doc('Blue', 'blue/Root.md'),
      ],
      [ref('Focus', 'Blue'), ref('Blue-H1', 'Amber'), ref('Blue-H2', 'Focus')],
      {
        rootDocumentId: 'Blue',
        entities: [
          heading('Blue-H1', 'Blue', 2),
          heading('Blue-H2', 'Blue', 4),
        ],
        direction: 'both',
        expectation:
          'The newly focused exact folder becomes central and candidate-local visual order is recomputed deterministically.',
        hops: 1,
      },
    ),
    fixture(
      'DB19',
      'true blocked after internal-layout optimization',
      [
        root,
        doc('AmberIn', 'amber/In.md'),
        doc('RootIn', 'root/In.md'),
        doc('BlueOut', 'blue/Out.md'),
        doc('RootOut', 'root/Out.md'),
      ],
      [
        ref('AmberIn', 'Focus-H2'),
        ref('RootIn', 'Focus-H1'),
        ref('Focus-H2', 'BlueOut'),
        ref('Focus-H1', 'RootOut'),
      ],
      {
        entities: [
          heading('Focus-H1', 'Focus', 2),
          heading('Focus-H2', 'Focus', 4),
        ],
        direction: 'both',
        expectation:
          'Opposite left/right folder orders make every balanced split add a crossing even after legal branch placement.',
        hops: 1,
      },
    ),
  ];

/** HIER4A-FIX2 synthetic internal-layout bakeoff corpus. */
export const INTERNAL_LAYOUT_FIXTURES: readonly EndpointFixtureSpec[] = [
  fixture(
    'VS1',
    'simple three-Heading root',
    [root, doc('Amber', 'amber/Only.md'), doc('Blue', 'blue/Only.md')],
    [ref('Focus-H1', 'Amber'), ref('Focus-H3', 'Blue')],
    {
      entities: [
        heading('Focus-H1', 'Focus', 2),
        heading('Focus-H2', 'Focus', 4),
        heading('Focus-H3', 'Focus', 6),
      ],
      expectation:
        'Vertical Spine keeps the File central with at least one whole branch above and below.',
      hops: 1,
    },
  ),
  fixture(
    'VS2',
    'five-Heading root',
    [
      root,
      doc('AmberA', 'amber/A.md'),
      doc('AmberB', 'amber/B.md'),
      doc('BlueA', 'blue/A.md'),
      doc('BlueB', 'blue/B.md'),
    ],
    ['AmberA', 'BlueA', 'AmberB', 'BlueB'].map((target, index) =>
      ref(`Focus-H${index + 1}`, target),
    ),
    {
      entities: Array.from({ length: 5 }, (_, index) =>
        heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
      ),
      expectation:
        'Five top-level branches form one compact vertical spine with no horizontal sibling row.',
      hops: 1,
    },
  ),
  fixture(
    'VS3',
    'nested structural branches',
    [root, doc('Amber', 'amber/Only.md'), doc('Blue', 'blue/Only.md')],
    [ref('Focus-B1', 'Amber'), ref('Focus-S2', 'Blue')],
    {
      entities: [
        heading('Focus-H1', 'Focus', 2),
        heading('Focus-S1', 'Focus', 3, 'Focus-H1'),
        block('Focus-B1', 'Focus', 'Focus-S1', 4),
        heading('Focus-H2', 'Focus', 8),
        heading('Focus-S2', 'Focus', 9, 'Focus-H2'),
        block('Focus-B2', 'Focus', 'Focus-S2', 10),
      ],
      expectation:
        'Nested descendants remain attached while each top-level branch moves as one unit.',
      hops: 1,
    },
  ),
  fixture(
    'VS4',
    'mixed incoming and outgoing endpoints',
    [
      root,
      doc('LeftA', 'left/A.md'),
      doc('LeftB', 'left/B.md'),
      doc('RightA', 'right/A.md'),
      doc('RightB', 'right/B.md'),
    ],
    [
      ref('LeftA', 'Focus-H1'),
      ref('LeftB', 'Focus-H2'),
      ref('Focus-H3', 'RightA'),
      ref('Focus-H4', 'RightB'),
    ],
    {
      entities: Array.from({ length: 4 }, (_, index) =>
        heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
      ),
      direction: 'both',
      expectation:
        'External rank ordering aligns to one center spine without changing authored direction.',
      hops: 1,
    },
  ),
  fixture('VS5', 'no external endpoint demand', [root], [], {
    entities: Array.from({ length: 4 }, (_, index) =>
      heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
    ),
    expectation:
      'Neutral branches balance around the File and retain source order as the tie-break.',
    hops: 1,
  }),
  fixture(
    'VS6',
    'variable branch heights',
    [root, doc('Amber', 'amber/Only.md'), doc('Blue', 'blue/Only.md')],
    [ref('Focus-H1', 'Amber'), ref('Focus-H3', 'Blue')],
    {
      entities: [
        heading('Focus-H1', 'Focus', 2),
        heading('Focus-H1-S1', 'Focus', 3, 'Focus-H1'),
        heading('Focus-H1-S2', 'Focus', 4, 'Focus-H1-S1'),
        block('Focus-H1-B1', 'Focus', 'Focus-H1-S2', 5),
        heading('Focus-H2', 'Focus', 8),
        heading('Focus-H3', 'Focus', 12),
        heading('Focus-H3-S1', 'Focus', 13, 'Focus-H3'),
      ],
      expectation:
        'The above/below split balances actual packed subtree height rather than branch count.',
      hops: 1,
    },
  ),
  fixture(
    'VS7',
    'diagnostics and direct File ring geometry',
    [root, doc('Beacon', 'beacon/Only.md')],
    [ref('Focus', 'Beacon')],
    {
      entities: Array.from({ length: 5 }, (_, index) =>
        heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
      ),
      unresolvedFromEntityIds: ['Focus'],
      expectation:
        'Diagnostic reserve and central File visibility remain intact around the vertical spine.',
      hops: 1,
    },
  ),
  fixture(
    'CP1',
    'simple compass demand',
    [root, doc('Left', 'left/Only.md'), doc('Right', 'right/Only.md')],
    [ref('Left', 'Focus-Left'), ref('Focus-Right', 'Right')],
    {
      entities: [
        heading('Focus-Left', 'Focus', 2),
        heading('Focus-Neutral', 'Focus', 4),
        heading('Focus-Right', 'Focus', 6),
      ],
      direction: 'both',
      expectation:
        'Compass may place left and right demand laterally while the neutral branch stays vertical.',
      hops: 1,
    },
  ),
  fixture(
    'CP2',
    'mixed-demand compass branch',
    [root, doc('Left', 'left/Only.md'), doc('Right', 'right/Only.md')],
    [ref('Left', 'Focus-Mixed'), ref('Focus-Mixed', 'Right')],
    {
      entities: [
        heading('Focus-Mixed', 'Focus', 2),
        heading('Focus-Neutral', 'Focus', 4),
      ],
      direction: 'both',
      expectation:
        'A branch demanded on both sides remains top/bottom and is never duplicated.',
      hops: 1,
    },
  ),
  fixture(
    'CP3',
    'many compass branches',
    [root, doc('Left', 'left/Only.md'), doc('Right', 'right/Only.md')],
    Array.from({ length: 10 }, (_, index) =>
      index % 2 === 0
        ? ref('Left', `Focus-H${index + 1}`)
        : ref(`Focus-H${index + 1}`, 'Right'),
    ),
    {
      entities: Array.from({ length: 10 }, (_, index) =>
        heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
      ),
      direction: 'both',
      expectation:
        'Ten branches use the capped deterministic Compass fallback without exponential search.',
      hops: 1,
    },
  ),
  fixture(
    'CP4',
    'compass width pressure',
    [root, doc('Left', 'left/Only.md'), doc('Right', 'right/Only.md')],
    [ref('Left', 'Focus-H1'), ref('Focus-H4', 'Right')],
    {
      entities: Array.from({ length: 5 }, (_, index) =>
        heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
      ),
      direction: 'both',
      expectation:
        'Compass reports its lateral width cost when it provides no crossing advantage.',
      hops: 1,
    },
  ),
  fixture(
    'CP5',
    'compass-helpful precise endpoints',
    [root, doc('Left', 'root/Left.md'), doc('Right', 'root/Right.md')],
    [ref('Left', 'Focus-Left'), ref('Focus-Right', 'Right')],
    {
      entities: [
        heading('Focus-Left', 'Focus', 2),
        ...Array.from({ length: 6 }, (_, index) =>
          heading(`Focus-Neutral-${index + 1}`, 'Focus', index * 2 + 4),
        ),
        heading('Focus-Right', 'Focus', 18),
      ],
      direction: 'both',
      expectation:
        'Compass gets a fair case where lateral placement can reduce precise endpoint distance.',
      hops: 1,
    },
  ),
];

export interface FolderStabilityPair {
  readonly id: `FS${number}`;
  readonly label: string;
  readonly before: EndpointFixtureSpec;
  readonly after: EndpointFixtureSpec;
}

function revision(
  id: `FS${number}-${'before' | 'after'}`,
  base: EndpointFixtureSpec,
  overrides: Partial<EndpointFixtureSpec>,
): EndpointFixtureSpec {
  return { ...base, ...overrides, id };
}

const stabilityBase = FOLDER_FIXTURES.find(({ id }) => id === 'FB15')!;
const rerootBase = fixture(
  'FB88',
  'reroot stability base',
  [root, doc('ScienceA', 'science/A.md'), doc('ScienceB', 'science/B.md')],
  [ref('Focus', 'ScienceA'), ref('ScienceA', 'ScienceB')],
  { hops: 2 },
);

export const FOLDER_STABILITY_PAIRS: readonly FolderStabilityPair[] = [
  {
    id: 'FS1',
    label: 'one module height changes',
    before: revision('FS1-before', stabilityBase, {}),
    after: revision('FS1-after', stabilityBase, {
      entities: [heading('VisibleA-H1', 'VisibleA', 2)],
    }),
  },
  {
    id: 'FS2',
    label: 'same-folder module added',
    before: revision('FS2-before', stabilityBase, {
      documents: stabilityBase.documents.slice(0, 3),
      references: stabilityBase.references.slice(0, 2),
    }),
    after: revision('FS2-after', stabilityBase, {}),
  },
  {
    id: 'FS3',
    label: 'singleton folder added',
    before: revision('FS3-before', stabilityBase, {}),
    after: revision('FS3-after', stabilityBase, {
      documents: [
        ...stabilityBase.documents,
        doc('Singleton', 'unique/Singleton.md'),
      ],
      references: [...stabilityBase.references, ref('Focus', 'Singleton')],
    }),
  },
  {
    id: 'FS4',
    label: 'banded module hidden by query',
    before: revision('FS4-before', stabilityBase, {}),
    after: revision('FS4-after', stabilityBase, {
      filters: { text: 'Visible' },
    }),
  },
  {
    id: 'FS5',
    label: 'stable File moves folder',
    before: revision(
      'FS5-before',
      FOLDER_FIXTURES.find(({ id }) => id === 'FB16')!,
      {},
    ),
    after: revision(
      'FS5-after',
      FOLDER_FIXTURES.find(({ id }) => id === 'FB16')!,
      {
        documents: [
          root,
          doc('Moving', 'blue/Moving.md'),
          doc('AmberPeer', 'amber/Peer.md'),
          doc('BluePeer', 'blue/Peer.md'),
        ],
      },
    ),
  },
  {
    id: 'FS6',
    label: 'secondary-only relationship',
    before: revision(
      'FS6-before',
      FOLDER_FIXTURES.find(({ id }) => id === 'FB17')!,
      {
        references: [ref('Focus', 'SharedA'), ref('Focus', 'SharedB')],
      },
    ),
    after: revision(
      'FS6-after',
      FOLDER_FIXTURES.find(({ id }) => id === 'FB17')!,
      {},
    ),
  },
  {
    id: 'FS7',
    label: 'stable Heading edit',
    before: revision(
      'FS7-before',
      FOLDER_FIXTURES.find(({ id }) => id === 'FB13')!,
      {},
    ),
    after: revision(
      'FS7-after',
      FOLDER_FIXTURES.find(({ id }) => id === 'FB13')!,
      {
        entities: [
          ...Array.from({ length: 5 }, (_, index) =>
            heading(`Focus-H${index + 1}`, 'Focus', index * 2 + 2),
          ),
          heading('Focus-neutral', 'Focus', 20),
        ],
      },
    ),
  },
  {
    id: 'FS8',
    label: 'reroot into another exact folder',
    before: revision('FS8-before', rerootBase, {}),
    after: revision('FS8-after', rerootBase, {
      rootDocumentId: 'ScienceA',
    }),
  },
];
