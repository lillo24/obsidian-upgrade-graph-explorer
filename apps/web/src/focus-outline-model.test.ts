import { describe, expect, it } from 'vitest';

import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import {
  createProjectionWorkspace,
  projectView,
  structuralDepthProjectionState,
} from '@icarus-graph-explorer/view-projection';

import {
  createFocusOutlineModel,
  structuralSubtreeContains,
} from './focus-outline-model';

const source = (line: number, offset: number, path = 'Language.md') => ({
  path,
  span: {
    start: { line, column: 1, offset },
    end: { line, column: 2, offset: offset + 1 },
  },
});

const snapshot: KnowledgeSnapshot = {
  schemaVersion: 1,
  workspace: { id: 'focus-outline' },
  entities: [
    { id: 'doc', kind: 'document', source: source(1, 0) },
    {
      id: 'h1',
      kind: 'section',
      parentId: 'doc',
      title: 'One',
      level: 1,
      source: source(2, 10),
    },
    {
      id: 'h1-child',
      kind: 'section',
      parentId: 'h1',
      title: 'One child',
      level: 2,
      source: source(3, 20),
    },
    {
      id: 'h2',
      kind: 'section',
      parentId: 'doc',
      title: 'Two',
      level: 1,
      source: source(4, 30),
    },
    {
      id: 'h3',
      kind: 'section',
      parentId: 'doc',
      title: 'Three',
      level: 1,
      source: source(5, 40),
    },
    {
      id: 'block',
      kind: 'block',
      parentId: 'h1-child',
      source: source(4, 25),
    },
    { id: 'other-doc', kind: 'document', source: source(1, 0, 'Other.md') },
    {
      id: 'other-heading',
      kind: 'section',
      parentId: 'other-doc',
      title: 'Other',
      level: 1,
      source: source(2, 10, 'Other.md'),
    },
  ],
  references: [],
};

describe('Focus Outline canonical model', () => {
  it('retains source order and distinguishes hidden, inherited, visible, and undisclosed rows', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const state = {
      ...structuralDepthProjectionState(1),
      disclosure: {
        ...structuralDepthProjectionState(1).disclosure,
        hiddenEntityIds: ['h1'],
      },
    };
    const model = createFocusOutlineModel(
      workspace,
      'doc',
      projectView(workspace, state),
      ['h1', 'h1-child', 'other-heading'],
    );

    expect(
      model?.rows.map((row) => [row.entityId, row.depth, row.status]),
    ).toEqual([
      ['h1', 1, 'hidden'],
      ['h1-child', 2, 'hidden-by-ancestor'],
      ['h2', 1, 'visible'],
      ['h3', 1, 'visible'],
    ]);
    expect(model?.rows[1]?.explicitlyHidden).toBe(true);
    expect(model?.hiddenEntityIds).toEqual(['h1', 'h1-child']);
    expect(model?.rows.some((row) => row.entityId === 'block')).toBe(false);
  });

  it('lists canonical Headings that current depth does not disclose', () => {
    const workspace = createProjectionWorkspace(snapshot);
    const state = structuralDepthProjectionState(0);
    const model = createFocusOutlineModel(
      workspace,
      'h1-child',
      projectView(workspace, state),
      [],
    );
    expect(model?.documentEntityId).toBe('doc');
    expect(model?.rows.every((row) => row.status === 'not-disclosed')).toBe(
      true,
    );
  });

  it('recognizes only the selected Heading structural subtree', () => {
    const workspace = createProjectionWorkspace(snapshot);
    expect(structuralSubtreeContains(workspace, 'h1', 'h1-child')).toBe(true);
    expect(structuralSubtreeContains(workspace, 'h1', 'block')).toBe(true);
    expect(structuralSubtreeContains(workspace, 'h1', 'h2')).toBe(false);
  });
});
