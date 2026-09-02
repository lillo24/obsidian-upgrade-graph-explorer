import { describe, expect, it } from 'vitest';

import { projectionFixture } from './test-fixture';
import {
  containingDocumentEntityId,
  deriveLocalProjectionState,
  projectLocalView,
} from './local';
import { createProjectionWorkspace } from './workspace';

describe('Local KG6 projection', () => {
  const workspace = createProjectionWorkspace(projectionFixture());

  it('normalizes section and block targets to a stable document root', () => {
    expect(containingDocumentEntityId(workspace, 'a-detail')).toBe('doc-a');
    expect(containingDocumentEntityId(workspace, 'a-block')).toBe('doc-a');
    expect(containingDocumentEntityId(workspace, 'missing')).toBeUndefined();
  });

  it('uses root-scoped automatic depth while keeping neighbor documents collapsed', () => {
    const state = deriveLocalProjectionState(
      workspace,
      {
        disclosure: {
          defaultDepth: 3,
          expandedEntityIds: [],
          collapsedEntityIds: [],
          includeBlocks: false,
        },
      },
      'a-detail',
    );
    const projection = projectLocalView(workspace, state);
    const entities = projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [node.entityId] : [],
    );

    expect(state.focus?.rootEntityId).toBe('doc-a');
    expect(state.disclosure.defaultDepth).toBe(3);
    expect(entities).toContain('doc-a');
    expect(entities).toContain('a-overview');
    expect(entities).toContain('a-detail');
    expect(entities).toContain('a-deep');
    expect(entities).toContain('doc-b');
    expect(entities).toContain('doc-c');
    expect(entities).not.toContain('b-target');
    expect(entities).not.toContain('c-third');
    expect(
      projection.nodes.flatMap((node) =>
        node.kind === 'reference-target' ? node.referenceIds : [],
      ),
    ).not.toContain('r-b-missing');
  });

  it('matches the shared focused hierarchy projection exactly', async () => {
    const { projectStructureView } = await import('./structure');
    const state = deriveLocalProjectionState(
      workspace,
      {
        disclosure: {
          defaultDepth: 2,
          expandedEntityIds: ['doc-b'],
          collapsedEntityIds: [],
          includeBlocks: false,
        },
        focus: {
          rootEntityId: 'doc-a',
          hops: 2,
          direction: 'outgoing',
          hierarchyContext: 'ancestors',
        },
      },
      'doc-a',
    );

    expect(projectLocalView(workspace, state)).toEqual(
      projectStructureView(workspace, state),
    );
  });

  it('preserves explicit neighbor disclosure without admitting unrelated documents', () => {
    const state = deriveLocalProjectionState(
      workspace,
      {
        disclosure: {
          defaultDepth: 0,
          expandedEntityIds: ['doc-b'],
          collapsedEntityIds: [],
          includeBlocks: false,
        },
        focus: {
          rootEntityId: 'doc-a',
          hops: 1,
          direction: 'outgoing',
          hierarchyContext: 'ancestors',
        },
      },
      'doc-a',
    );
    const projection = projectLocalView(workspace, state);
    const entities = projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [node.entityId] : [],
    );

    expect(entities).toContain('b-target');
    expect(entities).not.toContain('doc-c');
  });

  it('applies reference-status constraints before document Focus traversal', () => {
    const state = deriveLocalProjectionState(
      workspace,
      {
        disclosure: {
          defaultDepth: 0,
          expandedEntityIds: [],
          collapsedEntityIds: [],
          includeBlocks: false,
        },
        focus: {
          rootEntityId: 'doc-a',
          hops: 1,
          direction: 'both',
          hierarchyContext: 'ancestors',
        },
        filters: { referenceStatuses: ['unresolved'] },
      },
      'doc-a',
    );
    const projection = projectLocalView(workspace, state);

    expect(
      projection.nodes.flatMap((node) =>
        node.kind === 'entity' && node.entityKind === 'document'
          ? [node.entityId]
          : [],
      ),
    ).toEqual(['doc-a']);
  });

  it('keeps the Focus root as context when filters hide every visible file', () => {
    const state = deriveLocalProjectionState(
      workspace,
      {
        disclosure: {
          defaultDepth: 0,
          expandedEntityIds: [],
          collapsedEntityIds: [],
          includeBlocks: false,
        },
        filters: { entityKinds: ['section'] },
      },
      'doc-a',
    );
    const projection = projectLocalView(workspace, state);

    expect(projection.nodes).toEqual([
      expect.objectContaining({
        kind: 'entity',
        entityId: 'doc-a',
        entityKind: 'document',
        role: 'context',
        focusDistance: null,
        internalReferenceIds: [],
      }),
    ]);
    expect(projection.edges).toEqual([]);
  });

  it('does not mutate the source state or canonical workspace', () => {
    const source = {
      disclosure: {
        defaultDepth: 1 as const,
        expandedEntityIds: [] as readonly string[],
        collapsedEntityIds: ['doc-a'] as readonly string[],
        includeBlocks: false,
      },
    };
    const before = JSON.stringify({ source, snapshot: workspace.snapshot() });
    const state = deriveLocalProjectionState(workspace, source, 'doc-a');
    projectLocalView(workspace, state);

    expect(JSON.stringify({ source, snapshot: workspace.snapshot() })).toBe(
      before,
    );
  });
});
