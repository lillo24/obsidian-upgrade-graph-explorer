import type {
  AddressableEntity,
  KnowledgeSnapshot,
  Reference,
  SourceLocation,
  SourceSpan,
} from '@icarus-graph-explorer/core';

function span(
  line: number,
  column: number,
  offset: number,
  width = 4,
): SourceSpan {
  return {
    start: { line, column, offset },
    end: { line, column: column + width, offset: offset + width },
  };
}

function source(path: string, line: number, offset: number): SourceLocation {
  return { path, span: span(line, 1, offset) };
}

const entities: readonly AddressableEntity[] = [
  {
    id: 'doc-alpha',
    kind: 'document',
    source: source('alpha/Alpha.md', 1, 0),
  },
  {
    id: 'alpha-overview',
    kind: 'section',
    parentId: 'doc-alpha',
    title: 'Overview',
    level: 1,
    source: source('alpha/Alpha.md', 2, 10),
  },
  {
    id: 'alpha-nested',
    kind: 'section',
    parentId: 'alpha-overview',
    title: 'Nested Detail',
    level: 3,
    source: source('alpha/Alpha.md', 5, 40),
  },
  {
    id: 'alpha-duplicate',
    kind: 'section',
    parentId: 'doc-alpha',
    title: 'Overview',
    level: 2,
    source: source('alpha/Alpha.md', 12, 120),
  },
  {
    id: 'alpha-block',
    kind: 'block',
    parentId: 'alpha-nested',
    source: source('alpha/Alpha.md', 8, 80),
  },
  {
    id: 'doc-beta',
    kind: 'document',
    source: source('beta/Target.md', 1, 0),
  },
  {
    id: 'beta-target',
    kind: 'section',
    parentId: 'doc-beta',
    title: 'Target',
    level: 1,
    source: source('beta/Target.md', 3, 20),
  },
  {
    id: 'beta-deep',
    kind: 'section',
    parentId: 'beta-target',
    title: 'Deep Target',
    level: 4,
    source: source('beta/Target.md', 7, 60),
  },
  {
    id: 'doc-gamma',
    kind: 'document',
    source: source('gamma/Target.md', 1, 0),
  },
  {
    id: 'gamma-target',
    kind: 'section',
    parentId: 'doc-gamma',
    title: 'Target',
    level: 1,
    source: source('gamma/Target.md', 4, 30),
  },
];

function reference(
  id: string,
  sourceEntityId: string,
  rawTarget: string,
  resolution: Reference['resolution'],
  line: number,
  column = 3,
): Reference {
  return {
    id,
    kind: id.includes('embed') ? 'embed' : 'link',
    sourceEntityId,
    rawTarget,
    sourceSpan: span(line, column, line * 20 + column),
    resolution,
  };
}

const references: readonly Reference[] = [
  reference(
    'r-alpha-nested-beta',
    'alpha-nested',
    'Target#Target',
    { status: 'resolved', targetEntityId: 'beta-target' },
    6,
  ),
  reference(
    'r-alpha-overview-beta',
    'alpha-overview',
    'Target#Deep Target',
    { status: 'resolved', targetEntityId: 'beta-deep' },
    3,
  ),
  reference(
    'r-alpha-block-beta-embed',
    'alpha-block',
    'Target#Target',
    { status: 'resolved', targetEntityId: 'beta-target' },
    8,
  ),
  reference(
    'r-alpha-internal',
    'alpha-nested',
    '#Overview',
    { status: 'resolved', targetEntityId: 'alpha-overview' },
    7,
  ),
  reference(
    'r-alpha-unresolved',
    'alpha-nested',
    'Missing',
    { status: 'unresolved', reason: 'No matching document.' },
    9,
  ),
  reference(
    'r-alpha-ambiguous',
    'alpha-nested',
    'Target',
    {
      status: 'ambiguous',
      candidateEntityIds: ['beta-target', 'beta-deep', 'gamma-target'],
      reason: 'Several target headings match.',
    },
    10,
  ),
  reference(
    'r-alpha-invalid',
    'alpha-nested',
    '../Outside',
    { status: 'invalid', reason: 'Target escapes the workspace.' },
    11,
  ),
  reference(
    'r-beta-back-one',
    'beta-target',
    'Alpha#Nested Detail',
    { status: 'resolved', targetEntityId: 'alpha-nested' },
    4,
  ),
  reference(
    'r-beta-back-two',
    'beta-target',
    'Alpha#Nested Detail',
    { status: 'resolved', targetEntityId: 'alpha-nested' },
    5,
    8,
  ),
];

export function inspectionFixture(): KnowledgeSnapshot {
  return {
    schemaVersion: 1,
    workspace: { id: 'inspection-fixture' },
    entities,
    references,
  };
}
