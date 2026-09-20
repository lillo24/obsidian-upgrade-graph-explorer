import { describe, expect, it } from 'vitest';

import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import {
  createProjectionWorkspace,
  projectView,
  structuralDepthProjectionState,
} from '@icarus-graph-explorer/view-projection';

import { createFocusExplorerFilesModel } from './focus-explorer-files';
import { flattenSourceFolderRows } from './network-explorer-folders';

const source = (path: string, line = 1) => ({
  path,
  span: {
    start: { line, column: 1, offset: line * 10 },
    end: { line, column: 2, offset: line * 10 + 1 },
  },
});

const snapshot: KnowledgeSnapshot = {
  schemaVersion: 1,
  workspace: { id: 'focus-explorer-files' },
  entities: [
    { id: 'root', kind: 'document', source: source('Root.md') },
    {
      id: 'root-heading',
      kind: 'section',
      parentId: 'root',
      title: 'Root Heading',
      level: 1,
      source: source('Root.md', 2),
    },
    { id: 'a', kind: 'document', source: source('Notes/A.md') },
    { id: 'b', kind: 'document', source: source('Notes/Deep/B.md') },
  ],
  references: [
    {
      id: 'root-a',
      sourceEntityId: 'root',
      kind: 'link',
      rawTarget: 'A',
      sourceSpan: source('Root.md', 2).span,
      resolution: { status: 'resolved', targetEntityId: 'a' },
    },
    {
      id: 'root-b',
      sourceEntityId: 'root',
      kind: 'link',
      rawTarget: 'B',
      sourceSpan: source('Root.md', 3).span,
      resolution: { status: 'resolved', targetEntityId: 'b' },
    },
  ],
};

describe('Focus Explorer Files model', () => {
  it('lists only visible projection documents in deterministic source order', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const projection = projectView(workspace, {
      ...structuralDepthProjectionState(1),
      focus: {
        rootEntityId: 'root',
        hops: 2,
        direction: 'both',
        hierarchyContext: 'ancestors-and-children',
      },
    });
    const model = createFocusExplorerFilesModel(projection, workspace, 'root');

    expect(model.files.map((file) => file.sourcePath)).toEqual([
      'Notes/A.md',
      'Notes/Deep/B.md',
      'Root.md',
    ]);
    expect(model.files.filter((file) => file.focusRoot)).toMatchObject([
      { entityId: 'root', name: 'Root' },
    ]);
    expect(model.files.some((file) => file.entityId === 'root-heading')).toBe(
      false,
    );
    expect(
      flattenSourceFolderRows(model, new Map()).map((row) => row.id),
    ).toEqual([
      'folder:Notes',
      'folder:Notes/Deep',
      'node:["entity","b"]',
      'node:["entity","a"]',
      'node:["entity","root"]',
    ]);
  });
});
