import type {
  AddressableEntity,
  KnowledgeSnapshot,
} from '@icarus-graph-explorer/core';
import { reconcileStableIdentity } from '@icarus-graph-explorer/stable-identity';
import {
  createProjectionWorkspace,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import { describe, expect, it } from 'vitest';

import {
  createPersistedWorkspaceView,
  reconcileCurrentWorkspaceView,
  restorePersistedWorkspaceView,
  serializePersistedWorkspaceView,
  validatePersistedWorkspaceView,
  type PersistedWorkspaceView,
} from './index';

function source(path: string, line: number) {
  return {
    path,
    span: {
      start: { line, column: 1, offset: line * 10 },
      end: { line, column: 2, offset: line * 10 + 1 },
    },
  };
}

const ENTITIES: readonly AddressableEntity[] = [
  { id: 'doc-a', kind: 'document', source: source('folder/A.md', 1) },
  {
    id: 'section-one',
    kind: 'section',
    parentId: 'doc-a',
    title: 'Section One',
    level: 1,
    source: source('folder/A.md', 2),
  },
  {
    id: 'block-one',
    kind: 'block',
    parentId: 'section-one',
    source: source('folder/A.md', 3),
  },
  { id: 'doc-b', kind: 'document', source: source('B.md', 1) },
];

function snapshot(
  entities: readonly AddressableEntity[] = ENTITIES,
  workspaceId = 'stable-workspace',
): KnowledgeSnapshot {
  return {
    schemaVersion: 1,
    workspace: { id: workspaceId },
    entities,
    references: [],
  };
}

function fullState(): ViewProjectionState {
  return {
    disclosure: {
      defaultDepth: 1,
      maxSectionLevel: 1,
      expandedEntityIds: ['section-one', 'doc-a'],
      collapsedEntityIds: ['doc-b'],
      includeBlocks: true,
    },
    focus: {
      rootEntityId: 'section-one',
      hops: 2,
      direction: 'incoming',
      hierarchyContext: 'ancestors-and-children',
    },
    filters: {
      pathPrefixes: ['folder'],
      text: 'must not persist',
      entityKinds: ['section', 'block'],
      referenceStatuses: ['resolved', 'ambiguous'],
    },
  };
}

function persisted(): PersistedWorkspaceView {
  return createPersistedWorkspaceView({
    workspace: createProjectionWorkspace(snapshot()),
    state: fullState(),
    viewport: { anchorEntityId: 'section-one', zoom: 1.25 },
  });
}

describe('persisted workspace view', () => {
  it('round-trips its versioned plain-data schema through JSON', () => {
    const value = persisted();
    const validation = validatePersistedWorkspaceView(
      JSON.parse(serializePersistedWorkspaceView(value)),
    );

    expect(validation).toEqual({ valid: true, value, issues: [] });
  });

  it.each([0, 1, 2, 3] as const)(
    'round-trips structural depth %i under schema v2',
    (defaultDepth) => {
      const workspace = createProjectionWorkspace(snapshot());
      const value = createPersistedWorkspaceView({
        workspace,
        state: {
          ...fullState(),
          disclosure: { ...fullState().disclosure, defaultDepth },
        },
      });
      const validation = validatePersistedWorkspaceView(
        JSON.parse(serializePersistedWorkspaceView(value)),
      );

      expect(value.schemaVersion).toBe(2);
      expect(validation.valid).toBe(true);
      if (!validation.valid) return;
      expect(
        restorePersistedWorkspaceView(workspace, validation.value).state
          .disclosure.defaultDepth,
      ).toBe(defaultDepth);
    },
  );

  it.each([-1, 4, 5, 1.5, '2', null])(
    'rejects unsupported structural depth %s',
    (defaultDepth) => {
      const value = persisted();
      const validation = validatePersistedWorkspaceView({
        ...value,
        projection: {
          ...value.projection,
          disclosure: { ...value.projection.disclosure, defaultDepth },
        },
      });

      expect(validation.valid).toBe(false);
      expect(
        validation.valid ? [] : validation.issues.map(({ path }) => path),
      ).toContain('$.projection.disclosure.defaultDepth');
    },
  );

  it('accepts old schema-v1 views without a heading ceiling as no limit', () => {
    const value = persisted();
    const oldDisclosure = { ...value.projection.disclosure };
    delete oldDisclosure.maxSectionLevel;
    const oldValue = {
      ...value,
      projection: {
        ...value.projection,
        disclosure: oldDisclosure,
      },
    };
    const validation = validatePersistedWorkspaceView(oldValue);

    expect(validation.valid).toBe(true);
    if (!validation.valid) return;
    expect(
      restorePersistedWorkspaceView(
        createProjectionWorkspace(snapshot()),
        validation.value,
      ).state.disclosure.maxSectionLevel,
    ).toBeUndefined();
  });

  it('migrates a schema-v1 Structure viewport losslessly into schema v2', () => {
    const value = persisted();
    const validation = validatePersistedWorkspaceView({
      schemaVersion: 1,
      workspaceId: value.workspaceId,
      projection: value.projection,
      viewport: { anchorEntityId: 'section-one', zoom: 1.25 },
    });

    expect(validation.valid).toBe(true);
    if (!validation.valid) return;
    expect(validation.value).toMatchObject({
      schemaVersion: 2,
      rendererMode: 'structure',
      viewports: {
        structure: { anchorEntityId: 'section-one', zoom: 1.25 },
      },
    });
  });

  it('round-trips separate Structure and Global semantic viewports', () => {
    const workspace = createProjectionWorkspace(snapshot());
    const value = createPersistedWorkspaceView({
      workspace,
      state: fullState(),
      rendererMode: 'global',
      viewports: {
        structure: { anchorEntityId: 'section-one', zoom: 1.25 },
        global: { anchorEntityId: 'doc-a', ratio: 0.32 },
      },
    });
    const restored = restorePersistedWorkspaceView(workspace, value);

    expect(restored.rendererMode).toBe('global');
    expect(restored.viewports).toEqual({
      structure: { anchorEntityId: 'section-one', zoom: 1.25 },
      global: { anchorEntityId: 'doc-a', ratio: 0.32 },
    });
    expect(JSON.stringify(value)).not.toContain('coordinates');
  });

  it.each([0, 7, '1'])('rejects invalid heading ceiling %s', (level) => {
    const value = persisted();
    const validation = validatePersistedWorkspaceView({
      ...value,
      projection: {
        ...value.projection,
        disclosure: {
          ...value.projection.disclosure,
          maxSectionLevel: level,
        },
      },
    });

    expect(validation.valid).toBe(false);
    expect(
      validation.valid ? [] : validation.issues.map(({ path }) => path),
    ).toContain('$.projection.disclosure.maxSectionLevel');
  });

  it('restores all supported state exactly against the same workspace', () => {
    const workspace = createProjectionWorkspace(snapshot());
    const restored = restorePersistedWorkspaceView(workspace, persisted());

    expect(restored).toEqual({
      state: {
        ...fullState(),
        disclosure: {
          ...fullState().disclosure,
          expandedEntityIds: ['doc-a', 'section-one'],
        },
        filters: {
          pathPrefixes: ['folder'],
          entityKinds: ['block', 'section'],
          referenceStatuses: ['ambiguous', 'resolved'],
        },
      },
      rendererMode: 'structure',
      viewport: { anchorEntityId: 'section-one', zoom: 1.25 },
      viewports: {
        structure: { anchorEntityId: 'section-one', zoom: 1.25 },
      },
      issues: [],
    });
  });

  it('rejects a workspace mismatch', () => {
    const other = createProjectionWorkspace(snapshot(ENTITIES, 'other'));

    expect(() => restorePersistedWorkspaceView(other, persisted())).toThrow(
      'Cannot restore saved view for workspace "stable-workspace" into "other".',
    );
  });

  it('drops unknown disclosure IDs and reports each affected side', () => {
    const value = persisted();
    const restored = restorePersistedWorkspaceView(
      createProjectionWorkspace(snapshot()),
      {
        ...value,
        projection: {
          ...value.projection,
          disclosure: {
            ...value.projection.disclosure,
            expandedEntityIds: ['missing-expanded'],
            collapsedEntityIds: ['missing-collapsed'],
          },
        },
      },
    );

    expect(restored.state.disclosure.expandedEntityIds).toEqual([]);
    expect(restored.state.disclosure.collapsedEntityIds).toEqual([]);
    expect(restored.issues.map(({ code }) => code)).toEqual([
      'unknown-collapsed-entity',
      'unknown-expanded-entity',
    ]);
  });

  it('uses collapsed-wins for conflicting disclosure IDs', () => {
    const value = persisted();
    const restored = restorePersistedWorkspaceView(
      createProjectionWorkspace(snapshot()),
      {
        ...value,
        projection: {
          ...value.projection,
          disclosure: {
            ...value.projection.disclosure,
            expandedEntityIds: ['doc-a'],
            collapsedEntityIds: ['doc-a'],
          },
        },
      },
    );

    expect(restored.state.disclosure.expandedEntityIds).toEqual([]);
    expect(restored.state.disclosure.collapsedEntityIds).toEqual(['doc-a']);
    expect(restored.issues[0]?.code).toBe('conflicting-disclosure-state');
  });

  it('drops missing focus while preserving disclosure and filters', () => {
    const value = persisted();
    const restored = restorePersistedWorkspaceView(
      createProjectionWorkspace(snapshot()),
      {
        ...value,
        projection: {
          ...value.projection,
          focus: { ...value.projection.focus!, rootEntityId: 'missing' },
        },
      },
    );

    expect(restored.state.focus).toBeUndefined();
    expect(restored.state.filters).toEqual(value.projection.filters);
    expect(restored.issues[0]?.code).toBe('focus-root-missing');
  });

  it('keeps matching path prefixes and drops obsolete ones without fuzzy matching', () => {
    const value = persisted();
    const restored = restorePersistedWorkspaceView(
      createProjectionWorkspace(snapshot()),
      {
        ...value,
        projection: {
          ...value.projection,
          filters: {
            ...value.projection.filters,
            pathPrefixes: ['folder', 'renamed'],
          },
        },
      },
    );

    expect(restored.state.filters?.pathPrefixes).toEqual(['folder']);
    expect(restored.issues[0]).toMatchObject({
      code: 'path-filter-no-longer-matches',
      subject: 'renamed',
    });
  });

  it('preserves exact empty entity and reference-status filters', () => {
    const value = persisted();
    const restored = restorePersistedWorkspaceView(
      createProjectionWorkspace(snapshot()),
      {
        ...value,
        projection: {
          ...value.projection,
          filters: { entityKinds: [], referenceStatuses: [] },
        },
      },
    );

    expect(restored.state.filters).toEqual({
      entityKinds: [],
      referenceStatuses: [],
    });
  });

  it('never persists the non-user-facing projected text filter', () => {
    expect(persisted().projection.filters).not.toHaveProperty('text');
    expect(JSON.stringify(persisted())).not.toContain('must not persist');
  });

  it('preserves a present viewport anchor and drops a missing anchor', () => {
    const value = persisted();
    const evolved = createProjectionWorkspace(
      snapshot(
        ENTITIES.filter(({ id }) => id !== 'section-one' && id !== 'block-one'),
      ),
    );
    const restored = restorePersistedWorkspaceView(evolved, value);

    expect(value.viewports?.structure).toEqual({
      anchorEntityId: 'section-one',
      zoom: 1.25,
    });
    expect(restored.viewport).toBeUndefined();
    expect(restored.issues.map(({ code }) => code)).toContain(
      'viewport-anchor-missing',
    );
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid viewport zoom %s',
    (zoom) => {
      const result = validatePersistedWorkspaceView({
        ...persisted(),
        viewports: { structure: { anchorEntityId: 'doc-a', zoom } },
      });

      expect(result.valid).toBe(false);
      expect(
        result.valid ? [] : result.issues.map(({ path }) => path),
      ).toContain('$.viewports.structure.zoom');
    },
  );

  it('rejects unsupported versions, hidden fields, malformed enums, and paths', () => {
    const value = persisted();
    const result = validatePersistedWorkspaceView({
      ...value,
      schemaVersion: 3,
      projection: {
        ...value.projection,
        filters: {
          text: 'hidden',
          pathPrefixes: ['../private'],
          entityKinds: ['note'],
          referenceStatuses: ['maybe'],
        },
      },
    });

    expect(result.valid).toBe(false);
    expect(result.valid ? [] : result.issues.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        '$.schemaVersion',
        '$.projection.filters.text',
        '$.projection.filters.pathPrefixes[0]',
        '$.projection.filters.entityKinds[0]',
        '$.projection.filters.referenceStatuses[0]',
      ]),
    );
  });

  it('serializes the same state deterministically after sorting and de-duplication', () => {
    const workspace = createProjectionWorkspace(snapshot());
    const first = createPersistedWorkspaceView({
      workspace,
      state: fullState(),
    });
    const second = createPersistedWorkspaceView({
      workspace,
      state: {
        ...fullState(),
        disclosure: {
          ...fullState().disclosure,
          expandedEntityIds: ['doc-a', 'section-one', 'doc-a'],
        },
      },
    });

    expect(serializePersistedWorkspaceView(first)).toBe(
      serializePersistedWorkspaceView(second),
    );
  });

  it('does not mutate canonical snapshots, workspace indexes, or input state', () => {
    const canonical = snapshot();
    const before = JSON.stringify(canonical);
    const workspace = createProjectionWorkspace(canonical);
    const state = fullState();
    const stateBefore = JSON.stringify(state);

    restorePersistedWorkspaceView(
      workspace,
      createPersistedWorkspaceView({ workspace, state }),
    );

    expect(JSON.stringify(canonical)).toBe(before);
    expect(JSON.stringify(state)).toBe(stateBefore);
  });

  it('preserves KG9A-reconciled references across a supported revision and drops identity loss', () => {
    const revision = (
      revisionId: string,
      sectionTitle: string,
      sectionLine: number,
    ): KnowledgeSnapshot => ({
      schemaVersion: 1,
      workspace: { id: 'stable-workspace' },
      entities: [
        {
          id: `${revisionId}-document`,
          kind: 'document',
          source: source('folder/A.md', 1),
        },
        {
          id: `${revisionId}-section`,
          kind: 'section',
          parentId: `${revisionId}-document`,
          title: sectionTitle,
          level: 1,
          source: source('folder/A.md', sectionLine),
        },
      ],
      references: [],
    });
    const first = reconcileStableIdentity({
      snapshot: revision('one', 'Section One', 2),
    });
    const firstSectionId = first.snapshot.entities.find(
      ({ kind }) => kind === 'section',
    )!.id;
    const revisionOne = createProjectionWorkspace(first.snapshot);
    const saved = createPersistedWorkspaceView({
      workspace: revisionOne,
      state: {
        disclosure: {
          defaultDepth: 1,
          expandedEntityIds: [firstSectionId],
          collapsedEntityIds: [],
          includeBlocks: true,
        },
        focus: {
          rootEntityId: firstSectionId,
          hops: 2,
          direction: 'incoming',
          hierarchyContext: 'ancestors-and-children',
        },
      },
      viewport: { anchorEntityId: firstSectionId, zoom: 0.8 },
    });
    const second = reconcileStableIdentity({
      snapshot: revision('two', 'Section One', 5),
      previousCatalog: first.catalog,
    });
    const secondSectionId = second.snapshot.entities.find(
      ({ kind }) => kind === 'section',
    )!.id;
    const supported = restorePersistedWorkspaceView(
      createProjectionWorkspace(second.snapshot),
      saved,
    );
    const third = reconcileStableIdentity({
      snapshot: revision('three', 'Renamed weak section', 5),
      previousCatalog: second.catalog,
    });
    const thirdSectionId = third.snapshot.entities.find(
      ({ kind }) => kind === 'section',
    )!.id;
    const lost = restorePersistedWorkspaceView(
      createProjectionWorkspace(third.snapshot),
      saved,
    );

    expect(secondSectionId).toBe(firstSectionId);
    expect(supported.state.focus?.rootEntityId).toBe(firstSectionId);
    expect(supported.viewport?.anchorEntityId).toBe(firstSectionId);
    expect(supported.issues).toEqual([]);
    expect(thirdSectionId).not.toBe(firstSectionId);
    expect(lost.state.disclosure.expandedEntityIds).toEqual([]);
    expect(lost.state.focus).toBeUndefined();
    expect(lost.viewport).toBeUndefined();
    expect(lost.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'unknown-expanded-entity',
        'focus-root-missing',
        'viewport-anchor-missing',
      ]),
    );
  });
});

describe('current workspace view reconciliation', () => {
  it.each([0, 1, 2, 3] as const)(
    'preserves structural depth %i across a same-workspace live reconciliation',
    (defaultDepth) => {
      const state: ViewProjectionState = {
        ...fullState(),
        disclosure: { ...fullState().disclosure, defaultDepth },
      };

      expect(
        reconcileCurrentWorkspaceView(
          createProjectionWorkspace(snapshot()),
          state,
        ).state.disclosure.defaultDepth,
      ).toBe(defaultDepth);
    },
  );

  it('preserves surviving live state, including transient text and viewport', () => {
    const state = fullState();
    const viewport = { anchorEntityId: 'section-one', zoom: 0.9 } as const;
    const reconciled = reconcileCurrentWorkspaceView(
      createProjectionWorkspace(snapshot()),
      state,
      viewport,
    );

    expect(reconciled.state).toEqual({
      ...state,
      disclosure: {
        ...state.disclosure,
        expandedEntityIds: ['doc-a', 'section-one'],
      },
    });
    expect(reconciled.state.filters?.text).toBe('must not persist');
    expect(reconciled.viewport).toBe(viewport);
    expect(reconciled.issues).toEqual([]);
  });

  it('drops only state invalidated by a live snapshot without mutating inputs', () => {
    const state = fullState();
    const before = JSON.stringify(state);
    const evolved = createProjectionWorkspace(
      snapshot(ENTITIES.filter(({ id }) => id === 'doc-b')),
    );
    const reconciled = reconcileCurrentWorkspaceView(evolved, state, {
      anchorEntityId: 'section-one',
      zoom: 1.1,
    });

    expect(reconciled.state.disclosure.expandedEntityIds).toEqual([]);
    expect(reconciled.state.disclosure.collapsedEntityIds).toEqual(['doc-b']);
    expect(reconciled.state.focus).toBeUndefined();
    expect(reconciled.state.filters).toEqual({
      text: 'must not persist',
      entityKinds: ['section', 'block'],
      referenceStatuses: ['resolved', 'ambiguous'],
    });
    expect(reconciled.viewport).toBeUndefined();
    expect(reconciled.issues.map(({ code }) => code)).toEqual([
      'unknown-expanded-entity',
      'unknown-expanded-entity',
      'focus-root-missing',
      'path-filter-no-longer-matches',
      'viewport-anchor-missing',
    ]);
    expect(JSON.stringify(state)).toBe(before);
  });
});
