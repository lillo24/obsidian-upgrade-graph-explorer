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
const fixture = (
  id: `ND${number}`,
  label: string,
  documents: readonly EndpointFixtureDocument[],
  references: readonly EndpointFixtureReference[],
  options: Partial<EndpointFixtureSpec> = {},
): EndpointFixtureSpec => ({
  id,
  label,
  authored: 'Synthetic one-level nested Directional folder hierarchy.',
  expectation:
    'Canonical folder ancestry constrains deterministic macro Y placement.',
  inspect: 'Compare Flat with Nested (1 level) in the Modular preview.',
  rootDocumentId: options.rootDocumentId ?? 'Focus',
  documents,
  references,
  direction: options.direction ?? 'both',
  hops: options.hops ?? 3,
  ...(options.entities === undefined ? {} : { entities: options.entities }),
  ...(options.filters === undefined ? {} : { filters: options.filters }),
  ...(options.collapsedEntityIds === undefined
    ? {}
    : { collapsedEntityIds: options.collapsedEntityIds }),
  ...(options.expandedEntityIds === undefined
    ? {}
    : { expandedEntityIds: options.expandedEntityIds }),
});

const root = doc('Focus', 'root/Focus.md');

export const NESTED_DIRECTIONAL_FOLDER_FIXTURES: readonly EndpointFixtureSpec[] =
  [
    fixture(
      'ND1',
      'direct File plus sole singleton child',
      [root, doc('Parent', 'A/Parent.md'), doc('Only', 'A/B/Only.md')],
      [ref('Focus', 'Parent'), ref('Focus', 'Only')],
    ),
    fixture(
      'ND2',
      'direct File plus sole multi-File child',
      [
        root,
        doc('Parent', 'A/Parent.md'),
        doc('B1', 'A/B/B1.md'),
        doc('B2', 'A/B/B2.md'),
      ],
      [ref('Focus', 'Parent'), ref('Focus', 'B1'), ref('Focus', 'B2')],
    ),
    fixture(
      'ND3',
      'two singleton child folders',
      [root, doc('B1', 'A/B/B1.md'), doc('C1', 'A/C/C1.md')],
      [ref('Focus', 'B1'), ref('Focus', 'C1')],
    ),
    fixture(
      'ND4',
      'direct Files plus two child folders',
      [
        root,
        doc('Direct1', 'A/Direct1.md'),
        doc('Direct2', 'A/Direct2.md'),
        doc('B1', 'A/B/B1.md'),
        doc('B2', 'A/B/B2.md'),
        doc('C1', 'A/C/C1.md'),
      ],
      ['Direct1', 'Direct2', 'B1', 'B2', 'C1'].map((target) =>
        ref('Focus', target),
      ),
    ),
    fixture(
      'ND5',
      'redundant outer parent',
      [root, doc('B1', 'A/B/B1.md'), doc('B2', 'A/B/B2.md')],
      [ref('Focus', 'B1'), ref('Focus', 'B2')],
    ),
    fixture(
      'ND6',
      'child-order crossing optimization',
      [
        root,
        doc('B1', 'A/B/B1.md'),
        doc('C1', 'A/C/C1.md'),
        doc('Outer1', 'Z/Outer1.md'),
        doc('Outer2', 'Z/Outer2.md'),
      ],
      [
        ref('Focus', 'B1'),
        ref('Focus', 'C1'),
        ref('B1', 'Outer2'),
        ref('C1', 'Outer1'),
      ],
    ),
    fixture(
      'ND7',
      'folder containment beats crossing reduction',
      [
        root,
        doc('B1', 'A/B/B1.md'),
        doc('B2', 'A/B/B2.md'),
        doc('C1', 'A/C/C1.md'),
        doc('C2', 'A/C/C2.md'),
        doc('Outer1', 'Z/Outer1.md'),
        doc('Outer2', 'Z/Outer2.md'),
      ],
      [
        ref('Focus', 'B1'),
        ref('Focus', 'B2'),
        ref('Focus', 'C1'),
        ref('Focus', 'C2'),
        ref('B1', 'Outer1'),
        ref('B2', 'Outer2'),
        ref('C1', 'Outer2'),
        ref('C2', 'Outer1'),
      ],
    ),
    fixture(
      'ND8',
      'root exact folder excluded',
      [doc('Focus', 'A/B/Focus.md'), doc('C1', 'A/C/C1.md')],
      [ref('Focus', 'C1')],
    ),
    fixture(
      'ND9',
      'root exclusion with two other siblings',
      [
        doc('Focus', 'A/B/Focus.md'),
        doc('C1', 'A/C/C1.md'),
        doc('D1', 'A/D/D1.md'),
      ],
      [ref('Focus', 'C1'), ref('Focus', 'D1')],
    ),
    fixture(
      'ND10',
      'relative nested labels',
      [root, doc('B1', 'A/B/B1.md'), doc('C1', 'A/C/C1.md')],
      [ref('Focus', 'B1'), ref('Focus', 'C1')],
    ),
    fixture(
      'ND11',
      'deep source tree remains one displayed level',
      [
        root,
        doc('C1', 'A/B/C/C1.md'),
        doc('D1', 'A/B/D/D1.md'),
        doc('Elsewhere', 'X/Elsewhere.md'),
      ],
      [ref('Focus', 'C1'), ref('Focus', 'D1'), ref('Focus', 'Elsewhere')],
    ),
    fixture(
      'ND12',
      'Heading disclosure recomputes nested heights',
      [
        root,
        doc('B1', 'A/B/B1.md'),
        doc('B2', 'A/B/B2.md'),
        doc('C1', 'A/C/C1.md'),
      ],
      [
        ref('Focus', 'B1-H1'),
        ref('Focus', 'B1-H3'),
        ref('Focus', 'B2'),
        ref('Focus', 'C1-H2'),
      ],
      {
        entities: [
          heading('B1-H1', 'B1', 2),
          heading('B1-H2', 'B1', 4),
          heading('B1-H3', 'B1', 6),
          heading('C1-H1', 'C1', 2),
          heading('C1-H2', 'C1', 4),
        ],
        expandedEntityIds: ['B1', 'C1'],
      },
    ),
    fixture(
      'ND13',
      'query hide and restore',
      [
        root,
        doc('Parent', 'A/Parent.md'),
        doc('B1', 'A/B/B1.md'),
        doc('B2', 'A/B/B2.md'),
      ],
      [ref('Focus', 'Parent'), ref('Focus', 'B1'), ref('Focus', 'B2')],
    ),
    fixture(
      'ND14',
      'reroot recomputes the excluded folder',
      [
        root,
        doc('B1', 'A/B/B1.md'),
        doc('C1', 'A/C/C1.md'),
        doc('D1', 'A/D/D1.md'),
      ],
      [ref('Focus', 'B1'), ref('B1', 'C1'), ref('B1', 'D1')],
      { rootDocumentId: 'B1' },
    ),
    fixture(
      'ND15',
      'secondary-only geometry invariant',
      [root, doc('B1', 'A/B/B1.md'), doc('C1', 'A/C/C1.md')],
      [ref('Focus', 'B1'), ref('Focus', 'C1'), ref('B1', 'C1')],
      { hops: 1 },
    ),
  ];
