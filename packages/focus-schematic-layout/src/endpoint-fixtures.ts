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

export interface EndpointFixtureDocument {
  readonly id: string;
  readonly path?: string;
}

export interface EndpointFixtureEntity {
  readonly id: string;
  readonly kind: 'section' | 'block';
  readonly documentId: string;
  readonly parentId: string;
  readonly line: number;
  readonly title?: string;
}

export interface EndpointFixtureReference {
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
}

export interface EndpointFixtureSpec {
  readonly id:
    | `EP${number}`
    | `ES${number}-${'before' | 'after'}`
    | `CS${number}`
    | `FB${number}`
    | `DB${number}`
    | `VS${number}`
    | `CP${number}`
    | `AC-S${number}`
    | `SC${number}`
    | `HFA${number}`
    | `SS${number}-${'before' | 'after'}`
    | `FS${number}-${'before' | 'after'}`;
  readonly label: string;
  readonly authored: string;
  readonly expectation: string;
  readonly inspect: string;
  readonly rootDocumentId: string;
  readonly documents: readonly EndpointFixtureDocument[];
  readonly entities?: readonly EndpointFixtureEntity[];
  readonly references: readonly EndpointFixtureReference[];
  readonly direction?: 'incoming' | 'outgoing' | 'both';
  readonly hops?: 1 | 2 | 3;
  readonly filters?: ViewProjectionState['filters'];
  readonly collapsedEntityIds?: readonly string[];
  readonly expandedEntityIds?: readonly string[];
  readonly unresolvedFromEntityIds?: readonly string[];
}

const sourceSpan = (line: number): SourceSpan => ({
  start: { line, column: 1, offset: line * 20 },
  end: { line, column: 10, offset: line * 20 + 9 },
});

const doc = (id: string, path?: string): EndpointFixtureDocument => ({
  id,
  ...(path === undefined ? {} : { path }),
});

const section = (
  id: string,
  documentId: string,
  parentId: string = documentId,
  line = 2,
  title = id.replaceAll('-', ' '),
): EndpointFixtureEntity => ({
  id,
  kind: 'section',
  documentId,
  parentId,
  line,
  title,
});

const block = (
  id: string,
  documentId: string,
  parentId: string,
  line = 4,
): EndpointFixtureEntity => ({
  id,
  kind: 'block',
  documentId,
  parentId,
  line,
});

const ref = (
  sourceEntityId: string,
  targetEntityId: string,
): EndpointFixtureReference => ({ sourceEntityId, targetEntityId });

export function buildEndpointFixture(spec: EndpointFixtureSpec) {
  const pathByDocumentId = new Map(
    spec.documents.map((document) => [
      document.id,
      document.path ?? `${document.id}.md`,
    ]),
  );
  const entities: AddressableEntity[] = spec.documents.map((document) => ({
    id: document.id,
    kind: 'document',
    source: {
      path: pathByDocumentId.get(document.id)!,
      span: sourceSpan(1),
    },
  }));
  const fixtureEntityById = new Map(
    (spec.entities ?? []).map((entity) => [entity.id, entity]),
  );
  const sectionLevel = (
    entity: EndpointFixtureEntity,
  ): 1 | 2 | 3 | 4 | 5 | 6 => {
    let level = 1;
    let parent = fixtureEntityById.get(entity.parentId);
    const visited = new Set<string>();
    while (parent?.kind === 'section') {
      if (visited.has(parent.id))
        throw new Error(
          `Fixture "${spec.id}" contains a section-parent cycle.`,
        );
      visited.add(parent.id);
      level += 1;
      parent = fixtureEntityById.get(parent.parentId);
    }
    if (level > 6)
      throw new Error(
        `Fixture "${spec.id}" exceeds Markdown heading depth six.`,
      );
    return level as 1 | 2 | 3 | 4 | 5 | 6;
  };
  for (const entity of spec.entities ?? []) {
    const path = pathByDocumentId.get(entity.documentId);
    if (path === undefined)
      throw new Error(
        `Fixture "${spec.id}" entity "${entity.id}" has unknown document "${entity.documentId}".`,
      );
    entities.push(
      entity.kind === 'section'
        ? {
            id: entity.id,
            kind: 'section',
            parentId: entity.parentId,
            title: entity.title ?? entity.id,
            level: sectionLevel(entity),
            source: { path, span: sourceSpan(entity.line) },
          }
        : {
            id: entity.id,
            kind: 'block',
            parentId: entity.parentId,
            source: { path, span: sourceSpan(entity.line) },
          },
    );
  }
  const references: Reference[] = spec.references.map((item, index) => ({
    id: `${spec.id}-reference-${index + 1}`,
    kind: 'link',
    sourceEntityId: item.sourceEntityId,
    rawTarget: item.targetEntityId,
    sourceSpan: sourceSpan(50 + index),
    resolution: { status: 'resolved', targetEntityId: item.targetEntityId },
  }));
  references.push(
    ...(spec.unresolvedFromEntityIds ?? []).map((sourceEntityId, index) => ({
      id: `${spec.id}-unresolved-${index + 1}`,
      kind: 'link' as const,
      sourceEntityId,
      rawTarget: `Missing ${index + 1}`,
      sourceSpan: sourceSpan(80 + index),
      resolution: {
        status: 'unresolved' as const,
        reason: 'Synthetic missing endpoint target.',
      },
    })),
  );
  const snapshot: KnowledgeSnapshot = {
    schemaVersion: 1,
    workspace: { id: `hier3a-${spec.id.toLowerCase()}` },
    entities,
    references,
  };
  const workspace = createProjectionWorkspace(snapshot);
  const sectionIds = (spec.entities ?? [])
    .filter(({ kind }) => kind === 'section')
    .map(({ id }) => id);
  const state: ViewProjectionState = {
    disclosure: {
      defaultDepth: 3,
      expandedEntityIds: spec.expandedEntityIds ?? [
        ...spec.documents.map(({ id }) => id),
        ...sectionIds,
      ],
      collapsedEntityIds: spec.collapsedEntityIds ?? [],
      includeBlocks: true,
    },
    focus: {
      rootEntityId: spec.rootDocumentId,
      hops: spec.hops ?? 3,
      direction: spec.direction ?? 'both',
      hierarchyContext: 'ancestors-and-children',
    },
    ...(spec.filters === undefined ? {} : { filters: spec.filters }),
  };
  const projection = projectLocalView(workspace, state);
  return {
    spec,
    snapshot,
    workspace,
    state,
    projection,
    model: createFocusSchematicModel({ workspace, state, projection }),
  };
}

export const ENDPOINT_FIXTURES: readonly EndpointFixtureSpec[] = [
  {
    id: 'EP1',
    label: 'File to File',
    authored: 'Atlas.md → Beacon.md',
    expectation: 'Both File cards remain the exact endpoints.',
    inspect: 'No Heading lane should be invented.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    references: [ref('Atlas', 'Beacon')],
  },
  {
    id: 'EP2',
    label: 'Heading to File',
    authored: 'Atlas.md > Launch → Beacon.md',
    expectation:
      'The source Heading faces right; the target File remains central.',
    inspect:
      'The arrow must leave the Launch Heading and enter the Beacon File.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [section('Atlas-launch', 'Atlas')],
    references: [ref('Atlas-launch', 'Beacon')],
  },
  {
    id: 'EP3',
    label: 'File to Heading',
    authored: 'Atlas.md → Beacon.md > Arrival',
    expectation:
      'The target Heading faces left while the target File stays central.',
    inspect:
      'The arrow must touch the Arrival Heading instead of the module center.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [section('Beacon-arrival', 'Beacon')],
    references: [ref('Atlas', 'Beacon-arrival')],
  },
  {
    id: 'EP4',
    label: 'Heading to Heading',
    authored: 'Atlas.md > Launch → Beacon.md > Arrival',
    expectation:
      'The two exact Headings face each other around their File cores.',
    inspect: 'The reference arrow must touch both Heading cards.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [
      section('Atlas-launch', 'Atlas'),
      section('Beacon-arrival', 'Beacon'),
    ],
    references: [ref('Atlas-launch', 'Beacon-arrival')],
  },
  {
    id: 'EP5',
    label: 'Incoming Heading to root Heading',
    authored: 'Cedar.md > Source → Atlas.md > Target',
    expectation: 'The left source faces right and the root target faces left.',
    inspect: 'Authored direction still runs from Cedar into Atlas.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Cedar')],
    entities: [
      section('Atlas-target', 'Atlas'),
      section('Cedar-source', 'Cedar'),
    ],
    references: [ref('Cedar-source', 'Atlas-target')],
  },
  {
    id: 'EP6',
    label: 'Root two-sided',
    authored:
      'Cedar > Source → Atlas > Incoming; Atlas > Outgoing → Beacon > Target',
    expectation:
      'Atlas has a left target lane and a right source lane around one File.',
    inspect: 'Both relationships should remain exact and visually separate.',
    rootDocumentId: 'Atlas',
    documents: [doc('Cedar'), doc('Atlas'), doc('Beacon')],
    entities: [
      section('Cedar-source', 'Cedar'),
      section('Atlas-incoming', 'Atlas', 'Atlas', 2),
      section('Atlas-outgoing', 'Atlas', 'Atlas', 4),
      section('Beacon-target', 'Beacon'),
    ],
    references: [
      ref('Cedar-source', 'Atlas-incoming'),
      ref('Atlas-outgoing', 'Beacon-target'),
    ],
  },
  {
    id: 'EP7',
    label: 'Right multi-hop',
    authored:
      'Atlas > Source → Beacon > Target; Beacon > Source → Comet > Target',
    expectation:
      'Beacon exposes a target-facing left lane and source-facing right lane.',
    inspect:
      'The middle File should read as a two-sided relay without reversing arrows.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon'), doc('Comet')],
    entities: [
      section('Atlas-source', 'Atlas'),
      section('Beacon-target', 'Beacon', 'Beacon', 2),
      section('Beacon-source', 'Beacon', 'Beacon', 4),
      section('Comet-target', 'Comet'),
    ],
    references: [
      ref('Atlas-source', 'Beacon-target'),
      ref('Beacon-source', 'Comet-target'),
    ],
    direction: 'outgoing',
  },
  {
    id: 'EP8',
    label: 'Left multi-hop',
    authored:
      'Comet > Source → Beacon > Target; Beacon > Source → Atlas > Target',
    expectation:
      'Beacon again exposes both physical sides while authored flow points right.',
    inspect: 'The outer source and root target should stay exact.',
    rootDocumentId: 'Atlas',
    documents: [doc('Comet'), doc('Beacon'), doc('Atlas')],
    entities: [
      section('Comet-source', 'Comet'),
      section('Beacon-target', 'Beacon', 'Beacon', 2),
      section('Beacon-source', 'Beacon', 'Beacon', 4),
      section('Atlas-target', 'Atlas'),
    ],
    references: [
      ref('Comet-source', 'Beacon-target'),
      ref('Beacon-source', 'Atlas-target'),
    ],
    direction: 'incoming',
  },
  {
    id: 'EP9',
    label: 'Same Heading on both sides',
    authored: 'Atlas > Source → Beacon > Relay → Comet > Target',
    expectation:
      'Relay remains one centered node with left and right attachments.',
    inspect: 'There must be no duplicate Relay card.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon'), doc('Comet')],
    entities: [
      section('Atlas-source', 'Atlas'),
      section('Beacon-relay', 'Beacon'),
      section('Comet-target', 'Comet'),
    ],
    references: [
      ref('Atlas-source', 'Beacon-relay'),
      ref('Beacon-relay', 'Comet-target'),
    ],
    direction: 'outgoing',
  },
  {
    id: 'EP10',
    label: 'Mixed nested branch',
    authored:
      'Atlas > Source → Beacon > Left child; Beacon > Right child → Comet > Target',
    expectation:
      'The shared Beacon parent stays centered while its children split.',
    inspect: 'Hierarchy ownership stays clear across the left and right lanes.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon'), doc('Comet')],
    entities: [
      section('Atlas-source', 'Atlas'),
      section('Beacon-parent', 'Beacon'),
      section('Beacon-left', 'Beacon', 'Beacon-parent', 3),
      section('Beacon-right', 'Beacon', 'Beacon-parent', 5),
      section('Comet-target', 'Comet'),
    ],
    references: [
      ref('Atlas-source', 'Beacon-left'),
      ref('Beacon-right', 'Comet-target'),
    ],
    direction: 'outgoing',
  },
  {
    id: 'EP11',
    label: 'Neutral hierarchy',
    authored: 'Atlas.md → Beacon.md',
    expectation: 'Unrelated Headings remain neutral beneath their File cores.',
    inspect:
      'Neutral structure should not appear to participate in the reference.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [
      section('Atlas-notes', 'Atlas'),
      section('Atlas-details', 'Atlas', 'Atlas-notes', 3),
      section('Beacon-notes', 'Beacon'),
    ],
    references: [ref('Atlas', 'Beacon')],
  },
  {
    id: 'EP12',
    label: 'Block endpoints',
    authored: 'Five references cover Block/File/Heading combinations.',
    expectation: 'Every authored Block remains an exact visible endpoint.',
    inspect: 'Arrows should touch Block cards wherever a Block participates.',
    rootDocumentId: 'Atlas',
    documents: [
      doc('Atlas'),
      doc('Birch'),
      doc('Cedar'),
      doc('Dune'),
      doc('Elm'),
      doc('Flint'),
    ],
    entities: [
      section('Atlas-heading', 'Atlas'),
      section('Atlas-block-parent', 'Atlas', 'Atlas', 6),
      block('Atlas-block', 'Atlas', 'Atlas-block-parent', 7),
      section('Birch-heading', 'Birch'),
      section('Cedar-heading', 'Cedar'),
      block('Cedar-block', 'Cedar', 'Cedar-heading'),
      section('Dune-heading', 'Dune'),
      section('Elm-heading', 'Elm'),
      block('Elm-block', 'Elm', 'Elm-heading'),
      section('Flint-heading', 'Flint'),
      block('Flint-block', 'Flint', 'Flint-heading'),
    ],
    references: [
      ref('Atlas-block', 'Birch'),
      ref('Atlas', 'Cedar-block'),
      ref('Atlas-block', 'Dune-heading'),
      ref('Atlas-heading', 'Elm-block'),
      ref('Atlas-block', 'Flint-block'),
    ],
    direction: 'outgoing',
    hops: 1,
  },
  {
    id: 'EP13',
    label: 'Rolled-up target',
    authored: 'Atlas > Source → Beacon > Parent > Hidden child',
    expectation:
      'The reference lands on the visible Parent after disclosure rolls it up.',
    inspect: 'No ghost card for Hidden child may appear.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [
      section('Atlas-source', 'Atlas'),
      section('Beacon-parent', 'Beacon'),
      section('Beacon-hidden', 'Beacon', 'Beacon-parent', 3),
    ],
    references: [ref('Atlas-source', 'Beacon-hidden')],
    collapsedEntityIds: ['Beacon-parent'],
  },
  {
    id: 'EP14',
    label: 'Aggregated precise edge',
    authored: 'Two references share Atlas > Source → Beacon > Target.',
    expectation: 'One connection record retains both ReferenceIds.',
    inspect: 'The lab should report an aggregated reference count of two.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [
      section('Atlas-source', 'Atlas'),
      section('Beacon-target', 'Beacon'),
    ],
    references: [
      ref('Atlas-source', 'Beacon-target'),
      ref('Atlas-source', 'Beacon-target'),
    ],
  },
  {
    id: 'EP15',
    label: 'Multiple precise groups',
    authored: 'Two independent Heading pairs connect Atlas and Beacon.',
    expectation:
      'Both endpoint pairs remain separate inside one File-pair relationship.',
    inspect: 'Neither connection should collapse to a module-center edge.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [
      section('Atlas-source-one', 'Atlas', 'Atlas', 2),
      section('Atlas-source-two', 'Atlas', 'Atlas', 4),
      section('Beacon-target-one', 'Beacon', 'Beacon', 2),
      section('Beacon-target-two', 'Beacon', 'Beacon', 4),
    ],
    references: [
      ref('Atlas-source-one', 'Beacon-target-one'),
      ref('Atlas-source-two', 'Beacon-target-two'),
    ],
  },
  {
    id: 'EP16',
    label: 'Same-rank secondary',
    authored:
      'Atlas connects to Birch and Cedar; Birch > Detail also references Cedar > Detail.',
    expectation:
      'The same-rank precise secondary edge displays with automatic attachments.',
    inspect: 'Turning secondary display on must not move any geometry.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Birch'), doc('Cedar')],
    entities: [
      section('Birch-detail', 'Birch'),
      section('Cedar-detail', 'Cedar'),
    ],
    references: [
      ref('Atlas', 'Birch'),
      ref('Atlas', 'Cedar'),
      ref('Birch-detail', 'Cedar-detail'),
    ],
  },
  {
    id: 'EP17',
    label: 'Equal mutual',
    authored: 'Atlas > Exchange ↔ Beacon > Exchange',
    expectation:
      'The HIER2 chosen side controls physical attachments for both directions.',
    inspect:
      'Authored arrow directions remain opposite even though the macro side is shared.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [
      section('Atlas-exchange', 'Atlas'),
      section('Beacon-exchange', 'Beacon'),
    ],
    references: [
      ref('Atlas-exchange', 'Beacon-exchange'),
      ref('Beacon-exchange', 'Atlas-exchange'),
    ],
  },
  {
    id: 'EP18',
    label: 'Filtered bridge',
    authored: 'Atlas > Source → Hidden > Relay → Visible > Target',
    expectation:
      'Visible endpoints stay precise while the filtered module uses a compact anchor.',
    inspect:
      'The filtered bridge should remain legible without fabricating hidden Headings.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Hidden'), doc('Visible')],
    entities: [
      section('Atlas-source', 'Atlas'),
      section('Hidden-relay', 'Hidden'),
      section('Visible-target', 'Visible'),
    ],
    references: [
      ref('Atlas-source', 'Hidden-relay'),
      ref('Hidden-relay', 'Visible-target'),
    ],
    direction: 'outgoing',
    filters: { text: 'Visible' },
  },
  {
    id: 'EP19',
    label: 'Visible document precondition',
    authored: 'Atlas > Source → Beacon > Target',
    expectation:
      'KG6 includes a visible File card for every visible structural module.',
    inspect:
      'This records the current precondition instead of fabricating an impossible missing-File case.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [
      section('Atlas-source', 'Atlas'),
      section('Beacon-target', 'Beacon'),
    ],
    references: [ref('Atlas-source', 'Beacon-target')],
  },
  {
    id: 'EP20',
    label: 'Diagnostics reserve',
    authored: 'Atlas > Source → Beacon > Target plus one unresolved reference.',
    expectation:
      'Diagnostic reserve remains layout space, never a semantic endpoint.',
    inspect:
      'The exact Heading connection should stay clear of the diagnostic shelf.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [
      section('Atlas-source', 'Atlas'),
      section('Beacon-target', 'Beacon'),
    ],
    references: [ref('Atlas-source', 'Beacon-target')],
    unresolvedFromEntityIds: ['Atlas-source'],
  },
  {
    id: 'EP21',
    label: 'Duplicate basenames',
    authored: 'Atlas links to one/Note > Detail and two/Note > Detail.',
    expectation:
      'Equal display basenames retain distinct canonical and projection IDs.',
    inspect: 'Both target endpoints must remain independently inspectable.',
    rootDocumentId: 'Atlas',
    documents: [
      doc('Atlas'),
      doc('Note-one', 'one/Note.md'),
      doc('Note-two', 'two/Note.md'),
    ],
    entities: [
      section('Atlas-source-one', 'Atlas', 'Atlas', 2),
      section('Atlas-source-two', 'Atlas', 'Atlas', 4),
      section('Note-one-detail', 'Note-one'),
      section('Note-two-detail', 'Note-two'),
    ],
    references: [
      ref('Atlas-source-one', 'Note-one-detail'),
      ref('Atlas-source-two', 'Note-two-detail'),
    ],
  },
  {
    id: 'EP22',
    label: 'Large mixed module',
    authored:
      'Atlas connects through multiple nested branches in Beacon to Comet.',
    expectation:
      'Beacon combines neutral, left, right, and mixed branches without overlap.',
    inspect:
      'The module should stay readable and avoid excessive width or height.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon'), doc('Comet')],
    entities: [
      section('Atlas-source-one', 'Atlas', 'Atlas', 2),
      section('Atlas-source-two', 'Atlas', 'Atlas', 4),
      section('Beacon-mixed', 'Beacon', 'Beacon', 2),
      section('Beacon-left-one', 'Beacon', 'Beacon-mixed', 3),
      section('Beacon-right-one', 'Beacon', 'Beacon-mixed', 5),
      section('Beacon-neutral', 'Beacon', 'Beacon', 7),
      section('Beacon-neutral-child', 'Beacon', 'Beacon-neutral', 8),
      section('Beacon-left-two', 'Beacon', 'Beacon', 10),
      section('Beacon-right-two', 'Beacon', 'Beacon', 12),
      section('Comet-target-one', 'Comet', 'Comet', 2),
      section('Comet-target-two', 'Comet', 'Comet', 4),
    ],
    references: [
      ref('Atlas-source-one', 'Beacon-left-one'),
      ref('Atlas-source-two', 'Beacon-left-two'),
      ref('Beacon-right-one', 'Comet-target-one'),
      ref('Beacon-right-two', 'Comet-target-two'),
    ],
    direction: 'outgoing',
  },
  {
    id: 'EP23',
    label: 'Expansion revision',
    authored:
      'Atlas > Source → Beacon > Target after a neutral branch expands.',
    expectation: 'Stable IDs survive the added neutral branch.',
    inspect: 'Compare this with ES3 before/after for local movement.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [
      section('Atlas-source', 'Atlas'),
      section('Beacon-target', 'Beacon'),
      section('Beacon-neutral', 'Beacon', 'Beacon', 5),
      section('Beacon-neutral-child', 'Beacon', 'Beacon-neutral', 6),
    ],
    references: [ref('Atlas-source', 'Beacon-target')],
  },
  {
    id: 'EP24',
    label: 'Live semantic revision',
    authored: 'Atlas > Revised source → Beacon > Revised target',
    expectation:
      'Unrelated module and entity IDs remain stable as endpoint roles change.',
    inspect:
      'The new exact endpoints should face each other without stale demand.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [
      section('Atlas-old', 'Atlas', 'Atlas', 2),
      section('Atlas-revised', 'Atlas', 'Atlas', 4),
      section('Beacon-old', 'Beacon', 'Beacon', 2),
      section('Beacon-revised', 'Beacon', 'Beacon', 4),
    ],
    references: [ref('Atlas-revised', 'Beacon-revised')],
  },
  {
    id: 'EP25',
    label: 'Endpoint-aware module order',
    authored: 'Atlas > Upper → Birch > Target; Atlas > Lower → Cedar > Target.',
    expectation:
      'Cedar moves above Birch so the two exact cross-file edges do not cross.',
    inspect:
      'The right-side File order may override alphabetical order to remove the inversion.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Birch'), doc('Cedar')],
    entities: [
      section('Atlas-upper', 'Atlas', 'Atlas', 2),
      section('Atlas-lower', 'Atlas', 'Atlas', 8),
      section('Birch-target', 'Birch'),
      section('Cedar-target', 'Cedar'),
    ],
    references: [
      ref('Atlas-upper', 'Birch-target'),
      ref('Atlas-lower', 'Cedar-target'),
    ],
    direction: 'outgoing',
    hops: 1,
  },
  {
    id: 'EP26',
    label: 'Endpoint-aware sibling order',
    authored:
      'Atlas > First → Beacon > Second; Atlas > Second → Beacon > First.',
    expectation:
      'One sibling pair changes vertical order so the exact endpoint edges do not cross.',
    inspect:
      'Markdown order is a tie-break; the clearly crossing-free sibling order should win.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: [
      section('Atlas-parent', 'Atlas', 'Atlas', 2),
      section('Atlas-first', 'Atlas', 'Atlas-parent', 3),
      section('Atlas-second', 'Atlas', 'Atlas-parent', 5),
      section('Beacon-parent', 'Beacon', 'Beacon', 2),
      section('Beacon-first', 'Beacon', 'Beacon-parent', 3),
      section('Beacon-second', 'Beacon', 'Beacon-parent', 5),
    ],
    references: [
      ref('Atlas-first', 'Beacon-second'),
      ref('Atlas-second', 'Beacon-first'),
    ],
    direction: 'outgoing',
    hops: 1,
  },
];

const stabilityBase: EndpointFixtureSpec = {
  id: 'ES1-before',
  label: 'Endpoint stability base',
  authored: 'Atlas.md → Beacon.md',
  expectation: 'Baseline geometry for endpoint-specific revisions.',
  inspect: 'Use the paired after revision to assess local movement.',
  rootDocumentId: 'Atlas',
  documents: [doc('Atlas'), doc('Beacon'), doc('Comet')],
  entities: [
    section('Atlas-one', 'Atlas', 'Atlas', 2),
    section('Atlas-two', 'Atlas', 'Atlas', 4),
    section('Beacon-one', 'Beacon', 'Beacon', 2),
    section('Beacon-two', 'Beacon', 'Beacon', 4),
    section('Comet-one', 'Comet'),
  ],
  references: [ref('Atlas', 'Beacon')],
};

export interface EndpointStabilityPair {
  readonly id: `ES${number}`;
  readonly label: string;
  readonly before: EndpointFixtureSpec;
  readonly after: EndpointFixtureSpec;
}

const revision = (
  id: EndpointStabilityPair['id'],
  label: string,
  before: EndpointFixtureSpec,
  after: Omit<EndpointFixtureSpec, 'id' | 'label'>,
): EndpointStabilityPair => ({
  id,
  label,
  before: { ...before, id: `${id}-before`, label: `${label} — before` },
  after: { ...after, id: `${id}-after`, label: `${label} — after` },
});

export const ENDPOINT_STABILITY_PAIRS: readonly EndpointStabilityPair[] = [
  revision('ES1', 'Heading gains an outgoing reference', stabilityBase, {
    ...stabilityBase,
    authored: 'Atlas > One → Beacon.md',
    expectation: 'Only the affected source branch gains a right demand.',
    inspect: 'Unrelated modules and nodes should remain stable.',
    references: [ref('Atlas-one', 'Beacon')],
  }),
  revision(
    'ES2',
    'Heading loses an endpoint role',
    { ...stabilityBase, references: [ref('Atlas-one', 'Beacon')] },
    {
      ...stabilityBase,
      authored: 'Atlas.md → Beacon.md',
      expectation: 'The former endpoint returns to neutral structure.',
      inspect: 'The exact demand should disappear without stale lane state.',
    },
  ),
  revision('ES3', 'Neutral branch expands', stabilityBase, {
    ...stabilityBase,
    authored: stabilityBase.authored,
    expectation: 'A new neutral child stays with its neutral parent.',
    inspect:
      'Endpoint lanes should remain stable while the center grows locally.',
    entities: [
      ...(stabilityBase.entities ?? []),
      section('Beacon-neutral-child', 'Beacon', 'Beacon-two', 6),
    ],
  }),
  revision(
    'ES4',
    'Multi-hop module gains an outward endpoint branch',
    {
      ...stabilityBase,
      direction: 'outgoing',
      references: [ref('Atlas-one', 'Beacon-one')],
    },
    {
      ...stabilityBase,
      authored: 'Atlas > One → Beacon > One; Beacon > Two → Comet > One',
      expectation:
        'Beacon gains a right lane while preserving its left target lane.',
      inspect:
        'The relay should become two-sided without duplicating its File.',
      direction: 'outgoing',
      references: [
        ref('Atlas-one', 'Beacon-one'),
        ref('Beacon-two', 'Comet-one'),
      ],
    },
  ),
  revision(
    'ES5',
    'One-sided Heading becomes dual-demand',
    {
      ...stabilityBase,
      direction: 'outgoing',
      references: [ref('Atlas-one', 'Beacon-one')],
    },
    {
      ...stabilityBase,
      authored: 'Atlas > One → Beacon > One → Comet > One',
      expectation: 'Beacon > One becomes one centered dual-demand node.',
      inspect: 'There must still be exactly one Beacon > One card.',
      direction: 'outgoing',
      references: [
        ref('Atlas-one', 'Beacon-one'),
        ref('Beacon-one', 'Comet-one'),
      ],
    },
  ),
  revision(
    'ES6',
    'Secondary relationship added',
    {
      ...stabilityBase,
      references: [ref('Atlas', 'Beacon'), ref('Atlas', 'Comet')],
    },
    {
      ...stabilityBase,
      authored: 'Atlas.md → Beacon.md plus same-rank Beacon → Comet.',
      expectation: 'The secondary connection changes no candidate geometry.',
      inspect: 'Geometry must serialize byte-identically.',
      references: [
        ref('Atlas', 'Beacon'),
        ref('Atlas', 'Comet'),
        ref('Beacon-one', 'Comet-one'),
      ],
    },
  ),
  revision(
    'ES7',
    'Collapsed target becomes precise',
    {
      ...stabilityBase,
      references: [ref('Atlas-one', 'Beacon-two')],
      collapsedEntityIds: ['Beacon-one'],
      entities: [
        section('Atlas-one', 'Atlas'),
        section('Beacon-one', 'Beacon'),
        section('Beacon-two', 'Beacon', 'Beacon-one', 3),
        section('Comet-one', 'Comet'),
      ],
    },
    {
      ...stabilityBase,
      authored: 'Atlas > One → Beacon > One > Two after disclosure.',
      expectation: 'The visible child becomes the precise target.',
      inspect: 'The former rolled-up endpoint must not remain active.',
      references: [ref('Atlas-one', 'Beacon-two')],
      entities: [
        section('Atlas-one', 'Atlas'),
        section('Beacon-one', 'Beacon'),
        section('Beacon-two', 'Beacon', 'Beacon-one', 3),
        section('Comet-one', 'Comet'),
      ],
    },
  ),
  revision('ES8', 'Stable ID survives title-position edit', stabilityBase, {
    ...stabilityBase,
    authored: stabilityBase.authored,
    expectation: 'Stable entity IDs keep the same endpoint and lane identity.',
    inspect: 'Source-order movement may be reported without identity churn.',
    entities: (stabilityBase.entities ?? []).map((entity) =>
      entity.id === 'Atlas-one'
        ? { ...entity, line: 3, title: 'Renamed one' }
        : entity,
    ),
  }),
];

const centerHeadings = (
  documentId: string,
  count: number,
): readonly EndpointFixtureEntity[] =>
  Array.from({ length: count }, (_, index) =>
    section(
      `${documentId}-center-${index + 1}`,
      documentId,
      documentId,
      2 + index * 2,
      `Center ${index + 1}`,
    ),
  );

/** Synthetic FIX1 corpus; contains no private vault topology or content. */
export const CENTER_SPINE_FIXTURES: readonly EndpointFixtureSpec[] = [
  {
    id: 'CS1',
    label: 'Five center branches with both macro sides',
    authored: 'Cedar.md → Atlas.md → Beacon.md with five neutral Headings.',
    expectation: 'At least two branches sit above and below the central File.',
    inspect: 'The former five-wide Heading row is absent.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon'), doc('Cedar')],
    entities: centerHeadings('Atlas', 5),
    references: [ref('Cedar', 'Atlas'), ref('Atlas', 'Beacon')],
    hops: 1,
  },
  {
    id: 'CS2',
    label: 'Outgoing fan',
    authored: 'Atlas.md fans out while six neutral Headings remain structural.',
    expectation: 'The File stays central inside a narrow vertical module.',
    inspect: 'Macro fan ranks remain unchanged.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Birch'), doc('Cedar'), doc('Dune')],
    entities: centerHeadings('Atlas', 6),
    references: [
      ref('Atlas', 'Birch'),
      ref('Atlas', 'Cedar'),
      ref('Atlas', 'Dune'),
    ],
    direction: 'outgoing',
    hops: 1,
  },
  {
    id: 'CS3',
    label: 'Mixed two-sided center module',
    authored:
      'Two incoming and two outgoing Files surround a structured Atlas.',
    expectation: 'The signed macro sides and center spine coexist.',
    inspect:
      'Side demand never changes the source-contiguous center partition.',
    rootDocumentId: 'Atlas',
    documents: [
      doc('Atlas'),
      doc('Birch'),
      doc('Cedar'),
      doc('Dune'),
      doc('Elm'),
    ],
    entities: centerHeadings('Atlas', 5),
    references: [
      ref('Birch', 'Atlas'),
      ref('Cedar', 'Atlas'),
      ref('Atlas', 'Dune'),
      ref('Atlas', 'Elm'),
    ],
    hops: 1,
  },
  {
    id: 'CS4',
    label: 'Nested center branches',
    authored: 'Four top-level Headings each own one nested Heading.',
    expectation: 'Each top-level subtree is laid out independently.',
    inspect: 'Nested branch geometry remains contained and collision-free.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: centerHeadings('Atlas', 4).flatMap((parent, index) => [
      parent,
      section(
        `Atlas-nested-${index + 1}`,
        'Atlas',
        parent.id,
        parent.line + 1,
        `Nested ${index + 1}`,
      ),
    ]),
    references: [ref('Atlas', 'Beacon')],
    direction: 'outgoing',
  },
  {
    id: 'CS5',
    label: 'Non-root center fan',
    authored: 'Atlas.md → Beacon.md, where Beacon owns five Headings.',
    expectation: 'The same center-spine composition applies outside the root.',
    inspect: 'Root status must not control branch partitioning.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon'), doc('Cedar')],
    entities: centerHeadings('Beacon', 5),
    references: [ref('Atlas', 'Beacon'), ref('Beacon', 'Cedar')],
    direction: 'outgoing',
    hops: 2,
  },
  {
    id: 'CS6',
    label: 'Center spine with diagnostic reserve',
    authored: 'Atlas owns five Headings and one unresolved reference.',
    expectation: 'Diagnostic reserve stays valid around the center spine.',
    inspect: 'The diagnostic does not alter branch order or containment.',
    rootDocumentId: 'Atlas',
    documents: [doc('Atlas'), doc('Beacon')],
    entities: centerHeadings('Atlas', 5),
    references: [ref('Atlas', 'Beacon')],
    unresolvedFromEntityIds: ['Atlas'],
    direction: 'outgoing',
  },
];
