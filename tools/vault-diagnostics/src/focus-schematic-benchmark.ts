import { performance } from 'node:perf_hooks';

import type {
  AddressableEntity,
  KnowledgeSnapshot,
  Reference,
  SourceSpan,
} from '@icarus-graph-explorer/core';
import {
  createFocusSchematicModel,
  summarizeFocusSchematicModel,
  validateFocusSchematicModel,
} from '@icarus-graph-explorer/focus-schematic';
import {
  createProjectionWorkspace,
  describeFocusedDocumentNeighborhood,
  projectLocalView,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

type Profile = 'small' | 'medium' | 'hub';
const requested = process.argv.indexOf('--profile');
const profile = (
  requested === -1 ? 'small' : process.argv[requested + 1]
) as Profile;
const settings = {
  small: { modules: 32, sections: 4, repeats: 11 },
  medium: { modules: 320, sections: 5, repeats: 5 },
  hub: { modules: 1000, sections: 3, repeats: 3 },
}[profile];
if (settings === undefined)
  throw new Error(`Unknown Focus Schematic benchmark profile "${profile}".`);

const span = (line: number): SourceSpan => ({
  start: { line, column: 1, offset: line * 16 },
  end: { line, column: 2, offset: line * 16 + 1 },
});
const documents = Array.from(
  { length: settings.modules },
  (_, index) => `document-${index.toString().padStart(4, '0')}`,
);
const entities: AddressableEntity[] = documents.flatMap((id, documentIndex) => {
  const path = `folder-${documentIndex % 24}/${id}.md`;
  return [
    { id, kind: 'document', source: { path, span: span(1) } } as const,
    ...Array.from({ length: settings.sections }, (_, sectionIndex) => ({
      id: `${id}-section-${sectionIndex}`,
      kind: 'section' as const,
      parentId: id,
      title: 'Synthetic benchmark section',
      level: 1,
      source: { path, span: span(sectionIndex + 2) },
    })),
  ];
});
const references: Reference[] = [];
let referenceIndex = 0;
function addReference(sourceEntityId: string, targetEntityId: string): void {
  references.push({
    id: `reference-${referenceIndex}`,
    kind: 'link',
    sourceEntityId,
    rawTarget: 'synthetic-target',
    sourceSpan: span(20 + referenceIndex),
    resolution: { status: 'resolved', targetEntityId },
  });
  referenceIndex += 1;
}
for (let index = 1; index < documents.length; index += 1) {
  const target = documents[index];
  if (target === undefined) continue;
  addReference(documents[0]!, target);
  for (let section = 0; section < settings.sections; section += 1)
    addReference(
      `document-0000-section-${section}`,
      `${target}-section-${section}`,
    );
  if (index % 10 === 0) addReference(target, documents[0]!);
  if (index > 1 && index % 7 === 0) addReference(documents[index - 1]!, target);
}
references.push({
  id: `reference-${referenceIndex}`,
  kind: 'link',
  sourceEntityId: documents[0]!,
  rawTarget: 'synthetic-missing',
  sourceSpan: span(30 + referenceIndex),
  resolution: { status: 'unresolved', reason: 'Synthetic benchmark target.' },
});
const snapshot: KnowledgeSnapshot = {
  schemaVersion: 1,
  workspace: { id: 'focus-schematic-benchmark' },
  entities,
  references,
};
const workspace = createProjectionWorkspace(snapshot);
const state: ViewProjectionState = {
  disclosure: {
    defaultDepth: 3,
    expandedEntityIds: documents,
    collapsedEntityIds: [],
    includeBlocks: false,
  },
  focus: {
    rootEntityId: documents[0]!,
    hops: 1,
    direction: 'both',
    hierarchyContext: 'ancestors-and-children',
  },
};

const samples: Record<string, number[]> = Object.fromEntries(
  [
    'neighborhoodDescription',
    'detailedProjection',
    'modelUnprepared',
    'modelPrepared',
    'validation',
    'summary',
    'serialization',
    'totalPrepared',
  ].map((key) => [key, []]),
);
let finalSummary: ReturnType<typeof summarizeFocusSchematicModel> | undefined;
for (let repeat = 0; repeat < settings.repeats; repeat += 1) {
  const totalStart = performance.now();
  let start = performance.now();
  const neighborhood = describeFocusedDocumentNeighborhood(workspace, state);
  samples.neighborhoodDescription!.push(performance.now() - start);
  start = performance.now();
  const projection = projectLocalView(workspace, state);
  samples.detailedProjection!.push(performance.now() - start);
  start = performance.now();
  createFocusSchematicModel({ workspace, state, projection });
  samples.modelUnprepared!.push(performance.now() - start);
  start = performance.now();
  const model = createFocusSchematicModel({
    workspace,
    state,
    projection,
    neighborhood,
  });
  samples.modelPrepared!.push(performance.now() - start);
  start = performance.now();
  const validation = validateFocusSchematicModel(
    workspace,
    state,
    projection,
    model,
  );
  if (!validation.valid)
    throw new Error(
      validation.issues[0]?.message ?? 'Model validation failed.',
    );
  samples.validation!.push(performance.now() - start);
  start = performance.now();
  finalSummary = summarizeFocusSchematicModel(model);
  samples.summary!.push(performance.now() - start);
  start = performance.now();
  JSON.stringify(model);
  samples.serialization!.push(performance.now() - start);
  samples.totalPrepared!.push(performance.now() - totalStart);
}
const percentile = (values: readonly number[], fraction: number) => {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(ordered.length * fraction) - 1] ?? 0;
};
const timings = Object.fromEntries(
  Object.entries(samples).map(([phase, values]) => [
    phase,
    {
      medianMs: Number(percentile(values, 0.5).toFixed(3)),
      p95Ms: Number(percentile(values, 0.95).toFixed(3)),
    },
  ]),
) as Record<string, { medianMs: number; p95Ms: number }>;
process.stdout.write(
  `${JSON.stringify(
    {
      benchmark: 'focus-schematic',
      profile,
      repeats: settings.repeats,
      input: {
        moduleCount: settings.modules,
        entityCount: entities.length,
        referenceCount: references.length,
      },
      summary: finalSummary,
      timings,
    },
    null,
    2,
  )}\n`,
);
