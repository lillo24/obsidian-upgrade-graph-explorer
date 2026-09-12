import { describe, expect, it } from 'vitest';

import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import sampleReport from './sample-report.json';
import {
  captureSavedView,
  planSavedViewApply,
  sameSavedViewSnapshot,
} from './saved-view';

const validation = validateObsidianDiagnosticReport(sampleReport);
if (!validation.valid) throw new Error('Invalid Synthetic Sample.');
const snapshot = validation.value.snapshot;
const workspace = createProjectionWorkspace(snapshot);
const root = snapshot.entities.find(
  (candidate) => candidate.kind === 'document',
)!;
const sections = snapshot.entities.filter(
  (candidate) => candidate.kind === 'section',
);

function detailedState(focused: boolean): ViewProjectionState {
  return {
    disclosure: {
      defaultDepth: 2,
      maxSectionLevel: 4,
      expandedEntityIds: sections[0] === undefined ? [] : [sections[0].id],
      collapsedEntityIds: sections[1] === undefined ? [] : [sections[1].id],
      includeBlocks: true,
    },
    ...(focused
      ? {
          focus: {
            rootEntityId: root.id,
            hops: 3 as const,
            direction: 'incoming' as const,
            hierarchyContext: 'ancestors-and-children' as const,
          },
        }
      : {}),
    filters: {
      pathPrefixes: ['Notes'],
      entityKinds: ['document', 'section'],
      referenceStatuses: ['resolved', 'unresolved'],
      query: 'kind:document OR kind:section',
    },
  };
}

const available = {
  showExperimentalAllHierarchy: true,
  allNetworkAvailable: true,
};

describe('Named Saved View semantic composition', () => {
  it('captures canonical graph semantics and all semantic viewport bookmarks', () => {
    const saved = captureSavedView({
      name: '  Language Context  ',
      workspace,
      state: detailedState(true),
      presentationMode: 'local',
      layout: 'hierarchy',
      viewports: {
        structure: { anchorEntityId: root.id, zoom: 0.7 },
        global: { anchorEntityId: root.id, ratio: 0.32 },
        local: {
          anchorEntityId: root.id,
          freeRatio: 0.48,
          structuredZoom: 0.92,
        },
      },
    });
    expect(saved).toEqual({
      name: 'Language Context',
      layout: 'hierarchy',
      view: expect.objectContaining({
        schemaVersion: 3,
        workspaceId: snapshot.workspace.id,
        presentationMode: 'local',
        projection: expect.objectContaining({
          disclosure: expect.objectContaining({
            defaultDepth: 2,
            maxSectionLevel: 4,
            includeBlocks: true,
          }),
          focus: expect.objectContaining({
            rootEntityId: root.id,
            hops: 3,
            direction: 'incoming',
          }),
          filters: expect.objectContaining({
            query: 'kind:document OR kind:section',
          }),
        }),
        viewports: {
          structure: { anchorEntityId: root.id, zoom: 0.7 },
          global: { anchorEntityId: root.id, ratio: 0.32 },
          local: {
            anchorEntityId: root.id,
            freeRatio: 0.48,
            structuredZoom: 0.92,
          },
        },
      }),
    });
    const serialized = JSON.stringify(saved);
    for (const excluded of [
      'selection',
      'queryDraft',
      'graphPreferences',
      'spatialOverrides',
      'visualGroups',
      'presentationOverrides',
      'savedQueries',
      'panels',
      'coordinates',
    ]) {
      expect(serialized).not.toContain(excluded);
    }
  });

  it.each([
    ['global', 'network', 'global', 'free'],
    ['structure', 'hierarchy', 'structure', 'structured'],
    ['local', 'network', 'local', 'free'],
    ['local', 'hierarchy', 'local', 'structured'],
  ] as const)(
    'restores %s + %s independently of the current Focus layout',
    (presentationMode, layout, expectedPresentation, expectedLocalLayout) => {
      const entry = captureSavedView({
        name: `${presentationMode}-${layout}`,
        workspace,
        state: detailedState(presentationMode === 'local'),
        presentationMode,
        layout,
        viewports: {
          local: {
            anchorEntityId: root.id,
            freeRatio: 0.42,
            structuredZoom: 0.88,
          },
        },
      });
      const plan = planSavedViewApply({
        entry,
        workspace,
        availability: available,
      });
      expect(plan.presentationMode).toBe(expectedPresentation);
      expect(plan.localLayoutMode).toBe(expectedLocalLayout);
      expect(plan.state).toEqual(entry.view.projection);
      expect(plan.viewports).toEqual(entry.view.viewports);
    },
  );

  it('does not bypass the All Hierarchy experimental availability gate', () => {
    const entry = captureSavedView({
      name: 'Hierarchy',
      workspace,
      state: documentOnlyProjectionState(),
      presentationMode: 'structure',
      layout: 'hierarchy',
      viewports: {},
    });
    const plan = planSavedViewApply({
      entry,
      workspace,
      availability: {
        showExperimentalAllHierarchy: false,
        allNetworkAvailable: true,
      },
    });
    expect(plan.presentationMode).toBe('global');
    expect(plan.adjustment).toContain('currently unavailable');
  });

  it('drops stale disclosure and viewport anchors without rewriting the snapshot', () => {
    const original = captureSavedView({
      name: 'Stale details',
      workspace,
      state: detailedState(false),
      presentationMode: 'global',
      layout: 'network',
      viewports: {
        global: { anchorEntityId: root.id, ratio: 0.4 },
      },
    });
    const stale = {
      ...original,
      view: {
        ...original.view,
        projection: {
          ...original.view.projection,
          disclosure: {
            ...original.view.projection.disclosure,
            expandedEntityIds: ['missing-entity'],
          },
        },
        viewports: {
          global: { anchorEntityId: 'missing-entity', ratio: 0.4 },
        },
      },
    };
    const stored = JSON.stringify(stale);
    const plan = planSavedViewApply({
      entry: stale,
      workspace,
      availability: available,
    });
    expect(plan.state.disclosure.expandedEntityIds).toEqual([]);
    expect(plan.viewports.global).toBeUndefined();
    expect(plan.issues.map(({ code }) => code)).toEqual([
      'unknown-expanded-entity',
      'viewport-anchor-missing',
    ]);
    expect(JSON.stringify(stale)).toBe(stored);
  });

  it('follows a renamed File when its stable EntityId survives', () => {
    const original = captureSavedView({
      name: 'Stable focus',
      workspace,
      state: detailedState(true),
      presentationMode: 'local',
      layout: 'network',
      viewports: {
        local: { anchorEntityId: root.id, freeRatio: 0.4 },
      },
    });
    const renamedSnapshot = {
      ...snapshot,
      entities: snapshot.entities.map((candidate) =>
        candidate.source.path === root.source.path
          ? {
              ...candidate,
              source: { ...candidate.source, path: 'Renamed/Stable File.md' },
            }
          : candidate,
      ),
    };
    const plan = planSavedViewApply({
      entry: original,
      workspace: createProjectionWorkspace(renamedSnapshot),
      availability: available,
    });

    expect(plan.state.focus?.rootEntityId).toBe(root.id);
    expect(plan.viewports.local?.anchorEntityId).toBe(root.id);
    expect(plan.issues.some(({ code }) => code === 'focus-root-missing')).toBe(
      false,
    );
  });

  it('never fuzzy-retargets a deleted Focus root and keeps the stored root unchanged', () => {
    const original = captureSavedView({
      name: 'Deleted focus',
      workspace,
      state: detailedState(true),
      presentationMode: 'local',
      layout: 'hierarchy',
      viewports: {},
    });
    const missingRoot = 'missing-focus-root';
    const stale = {
      ...original,
      view: {
        ...original.view,
        projection: {
          ...original.view.projection,
          focus: {
            ...original.view.projection.focus!,
            rootEntityId: missingRoot,
          },
        },
      },
    };
    const plan = planSavedViewApply({
      entry: stale,
      workspace,
      availability: available,
    });
    expect(plan.state.focus).toBeUndefined();
    expect(plan.presentationMode).toBe('global');
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        code: 'focus-root-missing',
        subject: missingRoot,
      }),
    );
    expect(stale.view.projection.focus?.rootEntityId).toBe(missingRoot);
  });

  it('compares only deterministic semantic snapshots, never hidden active identity', () => {
    const left = captureSavedView({
      name: 'One',
      workspace,
      state: documentOnlyProjectionState(),
      presentationMode: 'global',
      layout: 'network',
      viewports: {},
    });
    expect(sameSavedViewSnapshot(left, { ...left, name: 'Two' })).toBe(true);
    expect(
      sameSavedViewSnapshot(left, {
        ...left,
        name: 'Two',
        layout: 'hierarchy',
      }),
    ).toBe(false);
  });
});
