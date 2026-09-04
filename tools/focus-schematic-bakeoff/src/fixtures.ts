import type {
  AddressableEntity,
  KnowledgeSnapshot,
  Reference,
  SourceSpan,
} from '@icarus-graph-explorer/core';
import { createFocusSchematicModel } from '@icarus-graph-explorer/focus-schematic';
import {
  createProjectionWorkspace,
  projectLocalView,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

export interface FixtureReference {
  readonly source: string;
  readonly target?: string;
  readonly status?: 'unresolved' | 'invalid' | 'ambiguous';
  readonly candidates?: readonly string[];
  readonly sourceEntityId?: string;
  readonly targetEntityId?: string;
}

export interface FixtureSpec {
  readonly id: string;
  readonly label: string;
  readonly root: string;
  readonly documents: readonly string[];
  readonly references: readonly FixtureReference[];
  readonly direction?: 'incoming' | 'outgoing' | 'both';
  readonly hops?: 1 | 2 | 3;
  readonly filters?: ViewProjectionState['filters'];
  readonly withStructure?: boolean;
  readonly withBlocks?: boolean;
  readonly sectionCount?: number;
}

const span = (line: number): SourceSpan => ({
  start: { line, column: 1, offset: line * 10 },
  end: { line, column: 2, offset: line * 10 + 1 },
});

export function buildFixture(spec: FixtureSpec) {
  const entities: AddressableEntity[] = spec.documents.flatMap((id) => {
    const path = `${id}.md`;
    const document: AddressableEntity = {
      id,
      kind: 'document',
      source: { path, span: span(1) },
    };
    if (spec.withStructure !== true) return [document];
    const sections: AddressableEntity[] = Array.from(
      { length: spec.sectionCount ?? 1 },
      (_, index) => ({
        id: index === 0 ? `${id}-section` : `${id}-section-${index + 1}`,
        kind: 'section' as const,
        parentId: id,
        title: `Synthetic heading ${index + 1}`,
        level: 1 as const,
        source: { path, span: span(2 + index) },
      }),
    );
    const block: AddressableEntity = {
      id: `${id}-block`,
      kind: 'block',
      parentId: sections[0]!.id,
      source: { path, span: span(3 + sections.length) },
    };
    return spec.withBlocks === true
      ? [document, ...sections, block]
      : [document, ...sections];
  });
  const references: Reference[] = spec.references.map((item, index) => {
    const resolution: Reference['resolution'] =
      item.status === 'unresolved'
        ? { status: 'unresolved', reason: 'Synthetic missing target.' }
        : item.status === 'invalid'
          ? { status: 'invalid', reason: 'Synthetic invalid target.' }
          : item.status === 'ambiguous'
            ? {
                status: 'ambiguous',
                candidateEntityIds: item.candidates ?? [],
                reason: 'Synthetic ambiguity.',
              }
            : {
                status: 'resolved',
                targetEntityId: item.targetEntityId ?? item.target ?? '',
              };
    return {
      id: `reference-${index}`,
      kind: 'link',
      sourceEntityId: item.sourceEntityId ?? item.source,
      rawTarget: item.target ?? item.status ?? '',
      sourceSpan: span(10 + index),
      resolution,
    };
  });
  const snapshot: KnowledgeSnapshot = {
    schemaVersion: 1,
    workspace: { id: `synthetic-hier2-${spec.id}` },
    entities,
    references,
  };
  const workspace = createProjectionWorkspace(snapshot);
  const state: ViewProjectionState = {
    disclosure: {
      defaultDepth: spec.withStructure === true ? 3 : 0,
      expandedEntityIds:
        spec.withStructure === true
          ? [
              ...spec.documents,
              ...(spec.withBlocks === true
                ? spec.documents.map((id) => `${id}-section`)
                : []),
            ]
          : [],
      collapsedEntityIds: [],
      includeBlocks: true,
    },
    focus: {
      rootEntityId: spec.root,
      hops: spec.hops ?? 3,
      direction: spec.direction ?? 'both',
      hierarchyContext: 'ancestors-and-children',
    },
    ...(spec.filters === undefined ? {} : { filters: spec.filters }),
  };
  const projection = projectLocalView(workspace, state);
  return {
    spec,
    projection,
    model: createFocusSchematicModel({ workspace, state, projection }),
  };
}

const fan = (prefix: string, count: number) =>
  Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`,
  );

export const SEMANTIC_FIXTURES: readonly FixtureSpec[] = [
  {
    id: 'F1',
    label: 'direct chain',
    root: 'Root',
    documents: ['A', 'Root', 'B'],
    references: [
      { source: 'A', target: 'Root' },
      { source: 'Root', target: 'B' },
    ],
  },
  {
    id: 'F2',
    label: 'incoming fan',
    root: 'Root',
    documents: ['A', 'B', 'C', 'Root'],
    references: ['A', 'B', 'C'].map((source) => ({ source, target: 'Root' })),
  },
  {
    id: 'F3',
    label: 'outgoing fan',
    root: 'Root',
    documents: ['Root', 'A', 'B', 'C'],
    references: ['A', 'B', 'C'].map((target) => ({ source: 'Root', target })),
  },
  {
    id: 'F4',
    label: 'mixed two-sided',
    root: 'Root',
    documents: ['A', 'C', 'Root', 'B', 'D'],
    references: [
      { source: 'A', target: 'Root' },
      { source: 'C', target: 'Root' },
      { source: 'Root', target: 'B' },
      { source: 'Root', target: 'D' },
    ],
    withStructure: true,
  },
  {
    id: 'F5',
    label: 'multi-hop',
    root: 'Root',
    documents: ['A', 'B', 'Root', 'C', 'D'],
    references: [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'Root' },
      { source: 'Root', target: 'C' },
      { source: 'C', target: 'D' },
    ],
    withStructure: true,
    withBlocks: true,
  },
  {
    id: 'F6',
    label: 'unequal mutual',
    root: 'Root',
    documents: ['Root', 'A', 'Bridge'],
    references: [
      { source: 'A', target: 'Root' },
      { source: 'Root', target: 'Bridge' },
      { source: 'Bridge', target: 'A' },
    ],
  },
  {
    id: 'F7',
    label: 'equal mutual',
    root: 'Root',
    documents: ['Root', 'A'],
    references: [
      { source: 'Root', target: 'A' },
      { source: 'A', target: 'Root' },
    ],
    withStructure: true,
  },
  {
    id: 'F8',
    label: 'cycle and secondary links',
    root: 'Root',
    documents: ['Root', 'A', 'B'],
    references: [
      { source: 'Root', target: 'A' },
      { source: 'Root', target: 'B' },
      { source: 'A', target: 'B' },
      { source: 'B', target: 'A' },
    ],
  },
  {
    id: 'F9',
    label: 'Heading endpoints',
    root: 'Root',
    documents: ['Root', 'A'],
    references: [
      {
        source: 'Root',
        sourceEntityId: 'Root-section',
        target: 'A',
        targetEntityId: 'A-section',
      },
    ],
    withStructure: true,
    withBlocks: true,
  },
  {
    id: 'F10',
    label: 'expanded neighbor and sibling order',
    root: 'Root',
    documents: ['Root', 'A'],
    references: [{ source: 'Root', target: 'A' }],
    withStructure: true,
    withBlocks: true,
    sectionCount: 4,
  },
  {
    id: 'F11',
    label: 'source folders',
    root: 'Root',
    documents: ['Root', 'one/A', 'one/two/B', 'two/C'],
    references: [
      { source: 'Root', target: 'one/A' },
      { source: 'one/A', target: 'one/two/B' },
      { source: 'Root', target: 'two/C' },
    ],
    withStructure: true,
  },
  {
    id: 'F12',
    label: 'duplicate basenames',
    root: 'Root',
    documents: ['Root', 'one/Note', 'two/Note'],
    references: [
      { source: 'Root', target: 'one/Note' },
      { source: 'Root', target: 'two/Note' },
    ],
  },
  {
    id: 'F13',
    label: 'diagnostics reserve',
    root: 'Root',
    documents: ['Root', 'External', 'External2'],
    references: [
      { source: 'Root', status: 'unresolved' },
      { source: 'Root', status: 'invalid' },
      {
        source: 'Root',
        status: 'ambiguous',
        candidates: ['External', 'External2'],
      },
    ],
    withStructure: true,
  },
  {
    id: 'F14',
    label: 'filtered intermediary',
    root: 'Root',
    documents: ['Root', 'Hidden', 'Visible'],
    references: [
      { source: 'Root', target: 'Hidden' },
      { source: 'Hidden', target: 'Visible' },
    ],
    direction: 'outgoing',
    filters: { text: 'Visible' },
    withStructure: true,
  },
  {
    id: 'F15',
    label: 'status filter',
    root: 'Root',
    documents: ['Root', 'A'],
    references: [
      { source: 'Root', target: 'A' },
      { source: 'Root', status: 'unresolved' },
    ],
    filters: { referenceStatuses: ['unresolved'] },
  },
  {
    id: 'F16',
    label: 'bounded hub',
    root: 'Root',
    documents: ['Root', ...fan('Leaf', 48)],
    references: fan('Leaf', 48).map((target) => ({ source: 'Root', target })),
    hops: 1,
  },
  {
    id: 'F17',
    label: 'permutation invariant chain',
    root: 'Root',
    documents: ['Root', 'A', 'B'],
    references: [
      { source: 'Root', target: 'A' },
      { source: 'A', target: 'B' },
    ],
    withStructure: true,
  },
  {
    id: 'F18',
    label: 'stable structure identity',
    root: 'Root',
    documents: ['Root', 'A'],
    references: [{ source: 'Root', target: 'A' }],
    withStructure: true,
  },
];

export function generatedFixture(seed: number, moduleCount = 18): FixtureSpec {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const documents = [
    'Root',
    ...Array.from(
      { length: moduleCount - 1 },
      (_, index) =>
        `${index % 3 === 0 ? 'one/' : index % 3 === 1 ? 'two/' : ''}N-${index + 1}`,
    ),
  ];
  const references: FixtureReference[] = [];
  const ranks: Record<'left' | 'right', string[][]> = {
    left: [['Root'], [], [], []],
    right: [['Root'], [], [], []],
  };
  for (let index = 1; index < documents.length; index += 1) {
    const node = documents[index]!;
    const side: 'left' | 'right' = random() < 0.5 ? 'left' : 'right';
    let rank = 1 + Math.floor(random() * 3);
    while (rank > 1 && ranks[side][rank - 1]?.length === 0) rank -= 1;
    const parentPool = ranks[side][rank - 1] ?? ['Root'];
    const parent =
      parentPool[Math.floor(random() * parentPool.length)] ?? 'Root';
    references.push(
      side === 'left'
        ? { source: node, target: parent }
        : { source: parent, target: node },
    );
    ranks[side][rank]?.push(node);
  }
  return {
    id: `G${String(seed).padStart(2, '0')}`,
    label: `generated seed ${seed}`,
    root: 'Root',
    documents,
    references,
    withStructure: true,
    withBlocks: seed % 2 === 0,
  };
}

export function hubFixture(moduleCount: number): FixtureSpec {
  const leaves = fan('Hub', moduleCount - 1);
  return {
    id: `hub-${moduleCount}`,
    label: `${moduleCount}-module hub`,
    root: 'Root',
    documents: ['Root', ...leaves],
    references: leaves.map((target) => ({ source: 'Root', target })),
    hops: 1,
  };
}

export interface StabilityPair {
  readonly id: string;
  readonly label: string;
  readonly before: FixtureSpec;
  readonly after: FixtureSpec;
}

const baseStability: FixtureSpec = {
  id: 'stability-base',
  label: 'stability base',
  root: 'Root',
  documents: ['A', 'Root', 'B', 'C'],
  references: [
    { source: 'A', target: 'Root' },
    { source: 'Root', target: 'B' },
    { source: 'B', target: 'C' },
  ],
};

export const STABILITY_PAIRS: readonly StabilityPair[] = [
  {
    id: 'S1',
    label: 'root depth',
    before: baseStability,
    after: {
      ...baseStability,
      id: 'S1-after',
      withStructure: true,
      withBlocks: true,
    },
  },
  {
    id: 'S2',
    label: 'neighbor disclosure',
    before: baseStability,
    after: { ...baseStability, id: 'S2-after', withStructure: true },
  },
  {
    id: 'S3',
    label: 'add same-rank File',
    before: baseStability,
    after: {
      ...baseStability,
      id: 'S3-after',
      documents: [...baseStability.documents, 'D'],
      references: [
        ...baseStability.references,
        { source: 'Root', target: 'D' },
      ],
    },
  },
  {
    id: 'S4',
    label: 'secondary edge only',
    before: baseStability,
    after: {
      ...baseStability,
      id: 'S4-after',
      references: [...baseStability.references, { source: 'A', target: 'B' }],
    },
  },
  {
    id: 'S5',
    label: 'filtered intermediary',
    before: SEMANTIC_FIXTURES[4]!,
    after: SEMANTIC_FIXTURES[13]!,
  },
  {
    id: 'S6',
    label: 'equal mutual added',
    before: baseStability,
    after: {
      ...baseStability,
      id: 'S6-after',
      references: [
        ...baseStability.references,
        { source: 'B', target: 'Root' },
      ],
    },
  },
  {
    id: 'S7',
    label: 'source edit stable IDs',
    before: { ...baseStability, withStructure: true },
    after: {
      ...baseStability,
      id: 'S7-after',
      withStructure: true,
      withBlocks: true,
    },
  },
  {
    id: 'S8',
    label: 'folder move',
    before: baseStability,
    after: {
      ...baseStability,
      id: 'S8-after',
      documents: ['one/A', 'Root', 'B', 'C'],
      references: [
        { source: 'one/A', target: 'Root' },
        { source: 'Root', target: 'B' },
        { source: 'B', target: 'C' },
      ],
    },
  },
  {
    id: 'S9',
    label: 'direction change',
    before: baseStability,
    after: {
      ...baseStability,
      id: 'S9-after',
      references: [
        { source: 'Root', target: 'A' },
        { source: 'Root', target: 'B' },
        { source: 'B', target: 'C' },
      ],
    },
  },
  {
    id: 'S10',
    label: 'diagnostic-only change',
    before: baseStability,
    after: {
      ...baseStability,
      id: 'S10-after',
      references: [
        ...baseStability.references,
        { source: 'Root', status: 'unresolved' },
      ],
    },
  },
];
