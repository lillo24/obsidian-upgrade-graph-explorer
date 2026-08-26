import type {
  AddressableEntity,
  KnowledgeSnapshot,
  Reference,
  SourceLocation,
  SourceSpan,
} from '@icarus-graph-explorer/core';

function span(line: number, startOffset: number): SourceSpan {
  return {
    start: { line, column: 1, offset: startOffset },
    end: { line, column: 2, offset: startOffset + 1 },
  };
}

function source(
  path: string,
  line: number,
  startOffset: number,
): SourceLocation {
  return { path, span: span(line, startOffset) };
}

const entities: readonly AddressableEntity[] = [
  { id: 'doc-a', kind: 'document', source: source('A.md', 1, 0) },
  {
    id: 'a-overview',
    kind: 'section',
    parentId: 'doc-a',
    title: 'Overview',
    level: 1,
    source: source('A.md', 2, 10),
  },
  {
    id: 'a-detail',
    kind: 'section',
    parentId: 'a-overview',
    title: 'Detail',
    level: 3,
    source: source('A.md', 3, 20),
  },
  {
    id: 'a-deep',
    kind: 'section',
    parentId: 'a-detail',
    title: 'Deep',
    level: 5,
    source: source('A.md', 4, 30),
  },
  {
    id: 'a-block',
    kind: 'block',
    parentId: 'a-detail',
    source: source('A.md', 5, 40),
  },
  {
    id: 'doc-b',
    kind: 'document',
    source: source('folder/B.md', 1, 0),
  },
  {
    id: 'b-target',
    kind: 'section',
    parentId: 'doc-b',
    title: 'Target',
    level: 2,
    source: source('folder/B.md', 2, 10),
  },
  {
    id: 'b-leaf',
    kind: 'section',
    parentId: 'b-target',
    title: 'Leaf',
    level: 4,
    source: source('folder/B.md', 3, 20),
  },
  {
    id: 'doc-c',
    kind: 'document',
    source: source('other/C.md', 1, 0),
  },
  {
    id: 'c-third',
    kind: 'section',
    parentId: 'doc-c',
    title: 'Third',
    level: 1,
    source: source('other/C.md', 2, 10),
  },
];

function reference(
  id: string,
  sourceEntityId: string,
  rawTarget: string,
  resolution: Reference['resolution'],
  index: number,
): Reference {
  return {
    id,
    kind: 'link',
    sourceEntityId,
    rawTarget,
    sourceSpan: span(10 + index, 100 + index * 10),
    resolution,
  };
}

const references: readonly Reference[] = [
  reference(
    'r-a-detail-to-b-leaf',
    'a-detail',
    'B#Leaf',
    { status: 'resolved', targetEntityId: 'b-leaf' },
    0,
  ),
  reference(
    'r-a-deep-to-b-target',
    'a-deep',
    'B#Target',
    { status: 'resolved', targetEntityId: 'b-target' },
    1,
  ),
  reference(
    'r-a-internal',
    'a-detail',
    '#Deep',
    { status: 'resolved', targetEntityId: 'a-deep' },
    2,
  ),
  reference(
    'r-a-missing-1',
    'a-detail',
    'Missing',
    { status: 'unresolved', reason: 'No matching document.' },
    3,
  ),
  reference(
    'r-a-missing-2',
    'a-deep',
    'Missing',
    { status: 'unresolved', reason: 'No matching document.' },
    4,
  ),
  reference(
    'r-a-ambiguous',
    'a-detail',
    'Shared',
    {
      status: 'ambiguous',
      candidateEntityIds: ['doc-c', 'doc-b'],
      reason: 'Two basename matches.',
    },
    5,
  ),
  reference(
    'r-a-invalid',
    'a-detail',
    '../Outside',
    { status: 'invalid', reason: 'Target escapes the workspace.' },
    6,
  ),
  reference(
    'r-b-back',
    'b-target',
    'A',
    { status: 'resolved', targetEntityId: 'doc-a' },
    7,
  ),
  reference(
    'r-b-to-c',
    'b-leaf',
    'C#Third',
    { status: 'resolved', targetEntityId: 'c-third' },
    8,
  ),
  reference(
    'r-c-back',
    'c-third',
    'A',
    { status: 'resolved', targetEntityId: 'doc-a' },
    9,
  ),
  reference(
    'r-b-missing',
    'b-target',
    'Missing',
    { status: 'unresolved', reason: 'No matching document.' },
    10,
  ),
];

export function projectionFixture(): KnowledgeSnapshot {
  return {
    schemaVersion: 1,
    workspace: { id: 'projection-fixture' },
    entities,
    references,
  };
}
