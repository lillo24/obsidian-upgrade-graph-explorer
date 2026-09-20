import { describe, expect, it } from 'vitest';

import type {
  AddressableEntity,
  KnowledgeSnapshot,
  Reference,
  SourceLocation,
} from '@icarus-graph-explorer/core';

import { projectLocalView } from './local';
import type { ViewProjectionState } from './types';
import { createProjectionWorkspace } from './workspace';

function source(path: string, line: number, offset: number): SourceLocation {
  return {
    path,
    span: {
      start: { line, column: 1, offset },
      end: { line, column: 2, offset: offset + 1 },
    },
  };
}

function multiFileFixture(fileCount: number): KnowledgeSnapshot {
  const entities: AddressableEntity[] = [];
  const references: Reference[] = [];
  for (let fileIndex = 0; fileIndex < fileCount; fileIndex += 1) {
    const documentId = `doc-${fileIndex}`;
    entities.push({
      id: documentId,
      kind: 'document',
      source: source(`Folder/File-${fileIndex}.md`, 1, fileIndex * 100),
    });
    let parentId = documentId;
    for (let generation = 1; generation <= 3; generation += 1) {
      const sectionId = `${documentId}-section-${generation}`;
      entities.push({
        id: sectionId,
        kind: 'section',
        parentId,
        title: `Generation ${generation}`,
        level: generation,
        source: source(
          `Folder/File-${fileIndex}.md`,
          generation + 1,
          fileIndex * 100 + generation * 10,
        ),
      });
      parentId = sectionId;
    }
    if (fileIndex > 0) {
      references.push({
        id: `reference-${fileIndex}`,
        kind: 'link',
        sourceEntityId: 'doc-0',
        rawTarget: `File-${fileIndex}`,
        sourceSpan: source('Folder/File-0.md', 10 + fileIndex, 500 + fileIndex)
          .span,
        resolution: { status: 'resolved', targetEntityId: documentId },
      });
    }
  }
  return {
    schemaVersion: 1,
    workspace: { id: 'uniform-focus-depth-performance' },
    entities,
    references,
  };
}

describe('bounded multi-File Focus detail', () => {
  it('projects one 32-File three-generation neighborhood deterministically', () => {
    const workspace = createProjectionWorkspace(multiFileFixture(32));
    const state: ViewProjectionState = {
      disclosure: {
        defaultDepth: 3,
        expandedEntityIds: [],
        collapsedEntityIds: [],
        hiddenEntityIds: [],
        includeBlocks: false,
      },
      focus: {
        rootEntityId: 'doc-0',
        hops: 1,
        direction: 'outgoing',
        hierarchyContext: 'ancestors',
      },
    };

    const projection = projectLocalView(workspace, state);
    const repeated = projectLocalView(workspace, state);
    const projectedEntities = projection.nodes.filter(
      (node) => node.kind === 'entity',
    );

    expect(projection).toEqual(repeated);
    expect(
      projectedEntities.filter((node) => node.entityKind === 'document'),
    ).toHaveLength(32);
    expect(
      projectedEntities.filter((node) => node.entityKind === 'section'),
    ).toHaveLength(96);
    expect(projection.issues).toEqual([]);
  });
});
