import { describe, expect, it } from 'vitest';

import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
} from '@icarus-graph-explorer/view-projection';

import { planLocalEntityNavigation, planLocalEntry } from './local-view';

const snapshot: KnowledgeSnapshot = {
  schemaVersion: 1,
  workspace: { id: 'local-navigation-test' },
  entities: [
    {
      id: 'doc-a',
      kind: 'document',
      source: {
        path: 'A.md',
        span: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 20, column: 1, offset: 200 },
        },
      },
    },
    {
      id: 'section-a',
      kind: 'section',
      parentId: 'doc-a',
      title: 'A heading',
      level: 1,
      source: {
        path: 'A.md',
        span: {
          start: { line: 2, column: 1, offset: 10 },
          end: { line: 15, column: 1, offset: 150 },
        },
      },
    },
    {
      id: 'deep-a',
      kind: 'section',
      parentId: 'section-a',
      title: 'A deep heading',
      level: 3,
      source: {
        path: 'A.md',
        span: {
          start: { line: 5, column: 1, offset: 50 },
          end: { line: 8, column: 1, offset: 80 },
        },
      },
    },
    {
      id: 'doc-b',
      kind: 'document',
      source: {
        path: 'B.md',
        span: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 10, column: 1, offset: 100 },
        },
      },
    },
    {
      id: 'section-b',
      kind: 'section',
      parentId: 'doc-b',
      title: 'B heading',
      level: 1,
      source: {
        path: 'B.md',
        span: {
          start: { line: 2, column: 1, offset: 10 },
          end: { line: 5, column: 1, offset: 50 },
        },
      },
    },
  ],
  references: [
    {
      id: 'ref-a-b',
      sourceEntityId: 'section-a',
      kind: 'link',
      rawTarget: 'B',
      sourceSpan: {
        start: { line: 3, column: 1, offset: 20 },
        end: { line: 3, column: 6, offset: 25 },
      },
      resolution: { status: 'resolved', targetEntityId: 'doc-b' },
    },
  ],
};

describe('Local navigation planning', () => {
  const workspace = createProjectionWorkspace(snapshot);

  it('normalizes a selected heading to its document and opens a bounded Local view', () => {
    const plan = planLocalEntry(
      workspace,
      documentOnlyProjectionState(),
      'section-a',
      0,
    );

    expect(plan.rootEntityId).toBe('doc-a');
    expect(plan.state.focus?.rootEntityId).toBe('doc-a');
    expect(plan.state.disclosure.defaultDepth).toBe(0);
    expect(
      plan.projection.nodes.some(
        (node) => node.kind === 'entity' && node.entityId === 'section-a',
      ),
    ).toBe(false);
    expect(
      plan.projection.nodes.find((node) => node.id === plan.projectionNodeId),
    ).toMatchObject({ kind: 'entity', entityId: 'doc-a' });
    expect(
      plan.projection.nodes.some(
        (node) => node.kind === 'entity' && node.entityId === 'section-b',
      ),
    ).toBe(false);
  });

  it('keeps a visible target local and reroots a different-document target', () => {
    const entry = planLocalEntry(
      workspace,
      documentOnlyProjectionState(),
      'doc-a',
      0,
    );
    const visible = planLocalEntityNavigation(
      workspace,
      entry.state,
      'section-a',
    );
    const rerooted = planLocalEntityNavigation(
      workspace,
      visible.state,
      'section-b',
    );

    expect(visible.rootEntityId).toBe('doc-a');
    expect(rerooted.rootEntityId).toBe('doc-b');
    expect(rerooted.state.focus?.rootEntityId).toBe('doc-b');
    expect(
      rerooted.projection.nodes.some(
        (node) => node.kind === 'entity' && node.entityId === 'section-b',
      ),
    ).toBe(true);
  });

  it('widens only the minimum ancestor disclosure needed for a hidden heading', () => {
    const plan = planLocalEntityNavigation(
      workspace,
      planLocalEntry(workspace, documentOnlyProjectionState(), 'doc-a', 0)
        .state,
      'deep-a',
    );

    expect(plan.rootEntityId).toBe('doc-a');
    expect(plan.state.disclosure.defaultDepth).toBe(0);
    expect(plan.state.disclosure.expandedEntityIds).toEqual([
      'doc-a',
      'section-a',
    ]);
    expect(
      plan.projection.nodes.some(
        (node) => node.kind === 'entity' && node.entityId === 'deep-a',
      ),
    ).toBe(true);
  });

  it('starts Focus with the requested depth and no prior manual overrides', () => {
    const plan = planLocalEntry(
      workspace,
      {
        disclosure: {
          defaultDepth: 1,
          expandedEntityIds: ['doc-b'],
          collapsedEntityIds: ['doc-a'],
          includeBlocks: false,
        },
      },
      'doc-a',
      2,
    );

    expect(plan.state.disclosure).toMatchObject({
      defaultDepth: 2,
      expandedEntityIds: [],
      collapsedEntityIds: [],
    });
    expect(
      plan.projection.nodes.some(
        (node) => node.kind === 'entity' && node.entityId === 'deep-a',
      ),
    ).toBe(true);
    expect(
      plan.projection.nodes.some(
        (node) => node.kind === 'entity' && node.entityId === 'section-b',
      ),
    ).toBe(false);
  });

  it('fails loudly when a live update removed the requested canonical target', () => {
    expect(() =>
      planLocalEntityNavigation(
        workspace,
        documentOnlyProjectionState(),
        'removed',
      ),
    ).toThrow('is no longer present in the loaded report');
  });
});
