import {
  seedLocalRendererInput,
  type LocalEdgeKind,
  type LocalNodeKind,
  type LocalRendererInput,
} from '@icarus-graph-explorer/renderer-sigma/core';

export interface FocusSpacingFixture {
  readonly id: string;
  readonly description: string;
  readonly input: LocalRendererInput;
}

interface FixtureBuilder {
  readonly nodes: LocalRendererInput['nodes'];
  readonly edges: LocalRendererInput['edges'];
  addNode(kind?: LocalNodeKind, root?: boolean): string;
  addEdge(source: string, target: string, kind?: LocalEdgeKind): void;
}

const NODE_SIZE = {
  document: 6.4,
  section: 4.7,
  block: 3.1,
  diagnostic: 3.8,
} as const satisfies Record<LocalNodeKind, number>;

function builder(): FixtureBuilder {
  const nodes: LocalRendererInput['nodes'][number][] = [];
  const edges: LocalRendererInput['edges'][number][] = [];
  return {
    nodes,
    edges,
    addNode(kind = 'document', root = false) {
      const key = `node-${nodes.length}`;
      nodes.push({
        key,
        attributes: {
          x: 0,
          y: 0,
          size: root ? 8.4 : NODE_SIZE[kind],
          color: '#607d8b',
          label: `Synthetic ${kind} ${nodes.length}`,
          nodeKind: kind,
          entityId: `synthetic-${nodes.length}`,
          sourcePath: `synthetic/node-${nodes.length}.md`,
          status: null,
          root,
          revealableDescendantCount: 0,
        },
      });
      return key;
    },
    addEdge(source, target, kind = 'reference') {
      const key = `edge-${edges.length}`;
      edges.push({
        key,
        source,
        target,
        attributes: {
          edgeKind: kind,
          referenceCount: kind === 'reference' ? 1 : 0,
          weight: kind === 'hierarchy' ? 6 : 1,
          size: kind === 'hierarchy' ? 1.25 : 1,
          color: kind === 'hierarchy' ? '#8b96a0' : '#91aab2',
        },
      });
    },
  };
}

function fixture(
  id: string,
  description: string,
  configure: (value: FixtureBuilder) => string,
): FocusSpacingFixture {
  const value = builder();
  const rootNodeKey = configure(value);
  return {
    id,
    description,
    input: seedLocalRendererInput({
      rootNodeKey,
      nodes: value.nodes,
      edges: value.edges,
      projectionIssues: [],
    }),
  };
}

function chain(
  id: string,
  count: number,
  kind: LocalEdgeKind = 'reference',
): FocusSpacingFixture {
  return fixture(id, `${count}-node ${kind} chain`, (value) => {
    const keys = Array.from({ length: count }, (_, index) =>
      value.addNode(index % 4 === 2 ? 'section' : 'document', index === 0),
    );
    for (let index = 1; index < keys.length; index += 1) {
      value.addEdge(keys[index - 1]!, keys[index]!, kind);
    }
    return keys[0]!;
  });
}

function star(id: string, count: number): FocusSpacingFixture {
  return fixture(id, `${count}-node reference star`, (value) => {
    const root = value.addNode('document', true);
    for (let index = 1; index < count; index += 1) {
      const kind: LocalNodeKind = index % 4 === 0 ? 'diagnostic' : 'document';
      value.addEdge(root, value.addNode(kind), 'reference');
    }
    return root;
  });
}

function mixed(id: string, count: number): FocusSpacingFixture {
  return fixture(id, `${count}-node mixed local neighborhood`, (value) => {
    const keys = Array.from({ length: count }, (_, index) => {
      const kind: LocalNodeKind =
        index === 0 || index % 5 < 2
          ? 'document'
          : index % 5 === 2
            ? 'section'
            : index % 5 === 3
              ? 'block'
              : 'diagnostic';
      return value.addNode(kind, index === 0);
    });
    for (let index = 1; index < keys.length; index += 1) {
      const parent = Math.max(0, Math.floor((index - 1) / 2));
      const kind: LocalEdgeKind =
        index % 5 === 2 || index % 5 === 3 ? 'hierarchy' : 'reference';
      value.addEdge(keys[parent]!, keys[index]!, kind);
      if (index > 4 && index % 4 === 0) {
        value.addEdge(keys[index - 3]!, keys[index]!, 'reference');
      }
    }
    return keys[0]!;
  });
}

function twoClusters(): FocusSpacingFixture {
  return fixture(
    'two-dense-clusters-bridge',
    'Two dense six-node clusters joined by one weak reference',
    (value) => {
      const keys = Array.from({ length: 12 }, (_, index) =>
        value.addNode(index % 3 === 2 ? 'section' : 'document', index === 0),
      );
      for (const start of [0, 6]) {
        for (let offset = 1; offset < 6; offset += 1) {
          value.addEdge(keys[start]!, keys[start + offset]!, 'reference');
          if (offset > 1) {
            value.addEdge(
              keys[start + offset - 1]!,
              keys[start + offset]!,
              'reference',
            );
          }
        }
      }
      value.addEdge(keys[5]!, keys[6]!, 'reference');
      return keys[0]!;
    },
  );
}

function weakAndIsolated(): FocusSpacingFixture {
  return fixture(
    'root-weak-and-isolated',
    'Root with three weak references and four disconnected nodes',
    (value) => {
      const root = value.addNode('document', true);
      for (let index = 0; index < 3; index += 1) {
        value.addEdge(root, value.addNode('document'), 'reference');
      }
      value.addNode('document');
      value.addNode('section');
      value.addNode('block');
      value.addNode('diagnostic');
      return root;
    },
  );
}

function hierarchyHeavy(): FocusSpacingFixture {
  return fixture(
    'hierarchy-heavy',
    'Twelve nodes dominated by strong hierarchy edges',
    (value) => {
      const keys = Array.from({ length: 12 }, (_, index) =>
        value.addNode(
          index === 0 ? 'document' : index < 5 ? 'section' : 'block',
          index === 0,
        ),
      );
      for (let index = 1; index < keys.length; index += 1) {
        value.addEdge(
          keys[Math.max(0, Math.floor((index - 1) / 3))]!,
          keys[index]!,
          'hierarchy',
        );
      }
      value.addEdge(keys[3]!, keys[9]!, 'reference');
      return keys[0]!;
    },
  );
}

function referenceHeavy(): FocusSpacingFixture {
  return fixture(
    'reference-heavy',
    'Twelve documents with a star plus cross-reference ring',
    (value) => {
      const keys = Array.from({ length: 12 }, (_, index) =>
        value.addNode('document', index === 0),
      );
      for (let index = 1; index < keys.length; index += 1) {
        value.addEdge(keys[0]!, keys[index]!, 'reference');
        value.addEdge(
          keys[index]!,
          keys[index === keys.length - 1 ? 1 : index + 1]!,
          'reference',
        );
      }
      return keys[0]!;
    },
  );
}

export function focusSpacingFixtures(): readonly FocusSpacingFixture[] {
  return [
    star('two-reference', 2),
    chain('three-chain', 3),
    star('three-star', 3),
    chain('five-chain', 5),
    star('five-star', 5),
    fixture(
      'five-mixed-isolate',
      'Five mixed nodes, including one disconnected diagnostic',
      (value) => {
        const root = value.addNode('document', true);
        const document = value.addNode('document');
        const section = value.addNode('section');
        const block = value.addNode('block');
        value.addNode('diagnostic');
        value.addEdge(root, document, 'reference');
        value.addEdge(root, section, 'hierarchy');
        value.addEdge(section, block, 'hierarchy');
        return root;
      },
    ),
    star('eight-star', 8),
    mixed('ten-mixed', 10),
    mixed('twenty-mixed', 20),
    mixed('fifty-mixed', 50),
    twoClusters(),
    chain('long-chain', 20),
    weakAndIsolated(),
    hierarchyHeavy(),
    referenceHeavy(),
  ];
}
