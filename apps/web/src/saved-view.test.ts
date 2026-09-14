import { describe, expect, it } from 'vitest';

import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  createEmptySpatialOverrideRegistry,
  setFolderSpatialRule,
} from '@icarus-graph-explorer/spatial-overrides';
import {
  customGlobalLayoutSettings,
  resolveGlobalLayoutSettings,
} from '@icarus-graph-explorer/renderer-sigma/settings';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import sampleReport from './sample-report.json';
import {
  DEFAULT_GRAPH_PREFERENCES,
  type GraphPreferences,
} from './preferences/graph-preferences';
import {
  captureSavedView,
  matchingCurrentSavedViewName,
  matchingSavedViewName,
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
const spatial = createEmptySpatialOverrideRegistry(snapshot.workspace.id);
const profiledSpatial = setFolderSpatialRule(spatial, {
  folderKey: 'Architecture',
  behavior: 'pull',
  scope: {
    kind: 'subtree',
    includeRootFiles: true,
    excludedSubtrees: ['Architecture/Archive'],
  },
  anchor: { x: 0.55, y: -0.35 },
  strength: 72,
});
const savedPreferences: GraphPreferences = {
  ...DEFAULT_GRAPH_PREFERENCES,
  focusAppearance: 'minimal',
  focusHierarchyImplementation: 'modular-preview',
  globalLayoutSettings: {
    folderClustering: false,
    spacingPreset: 'spacious',
    custom: {
      ...customGlobalLayoutSettings('spacious'),
      linkForce: 1.6,
      folderCohesion: 0.11,
      withinFolderSpacing: 2.1,
      betweenFolderSpacing: 6.4,
      nodeSize: 7.5,
      referenceDegreeSizeInfluence: 83,
      linkThickness: 1.8,
      labelThreshold: 12,
    },
  },
  modularFocusInternalLayout: 'vertical-spine',
  modularFocusHeadingOrder: 'document-order',
  modularFocusMacroLayout: 'soft-folder-clusters',
  modularFocusSoftFolderStrength: 74,
  modularFolderStripsVisible: false,
  modularConnectionStyle: 'electronic',
  showExperimentalAllHierarchy: true,
  trackpadZoomMode: 'pinch-zoom',
};

function capture(
  options: Omit<
    Parameters<typeof captureSavedView>[0],
    'preferences' | 'spatial'
  >,
) {
  return captureSavedView({
    ...options,
    preferences: DEFAULT_GRAPH_PREFERENCES,
    spatial,
  });
}

function plan(
  options: Omit<Parameters<typeof planSavedViewApply>[0], 'preferences'>,
) {
  return planSavedViewApply({
    ...options,
    preferences: DEFAULT_GRAPH_PREFERENCES,
  });
}

describe('Named Saved View semantic composition', () => {
  it('captures canonical graph semantics and all semantic viewport bookmarks', () => {
    const saved = capture({
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
      profile: {
        kind: 'focus-hierarchy',
        hierarchy: expect.objectContaining({
          focusAppearance: 'inverted',
          focusHierarchyImplementation: 'classic',
          modularFocusMacroLayout: 'directional-bands',
        }),
      },
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
      const entry = capture({
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
      const result = plan({
        entry,
        workspace,
        availability: available,
      });
      expect(result.presentationMode).toBe(expectedPresentation);
      expect(result.localLayoutMode).toBe(expectedLocalLayout);
      expect(result.state).toEqual(entry.view.projection);
      expect(result.viewports).toEqual(entry.view.viewports);
    },
  );

  it('does not bypass the All Hierarchy experimental availability gate', () => {
    const entry = capture({
      name: 'Hierarchy',
      workspace,
      state: documentOnlyProjectionState(),
      presentationMode: 'structure',
      layout: 'hierarchy',
      viewports: {},
    });
    const result = plan({
      entry,
      workspace,
      availability: {
        showExperimentalAllHierarchy: false,
        allNetworkAvailable: true,
      },
    });
    expect(result.presentationMode).toBe('global');
    expect(result.adjustment).toContain('currently unavailable');
  });

  it('drops stale disclosure and viewport anchors without rewriting the snapshot', () => {
    const original = capture({
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
    const result = plan({
      entry: stale,
      workspace,
      availability: available,
    });
    expect(result.state.disclosure.expandedEntityIds).toEqual([]);
    expect(result.viewports.global).toBeUndefined();
    expect(result.issues.map(({ code }) => code)).toEqual([
      'unknown-expanded-entity',
      'viewport-anchor-missing',
    ]);
    expect(JSON.stringify(stale)).toBe(stored);
  });

  it('follows a renamed File when its stable EntityId survives', () => {
    const original = capture({
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
    const result = plan({
      entry: original,
      workspace: createProjectionWorkspace(renamedSnapshot),
      availability: available,
    });

    expect(result.state.focus?.rootEntityId).toBe(root.id);
    expect(result.viewports.local?.anchorEntityId).toBe(root.id);
    expect(
      result.issues.some(({ code }) => code === 'focus-root-missing'),
    ).toBe(false);
  });

  it('never fuzzy-retargets a deleted Focus root and keeps the stored root unchanged', () => {
    const original = capture({
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
    const result = plan({
      entry: stale,
      workspace,
      availability: available,
    });
    expect(result.state.focus).toBeUndefined();
    expect(result.presentationMode).toBe('global');
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'focus-root-missing',
        subject: missingRoot,
      }),
    );
    expect(stale.view.projection.focus?.rootEntityId).toBe(missingRoot);
  });

  it('captures exactly the layout-appropriate profile for every Scope and Layout', () => {
    const allNetwork = captureSavedView({
      name: 'All Network',
      workspace,
      state: documentOnlyProjectionState(),
      presentationMode: 'global',
      layout: 'network',
      viewports: {},
      preferences: savedPreferences,
      spatial: profiledSpatial,
    });
    expect(allNetwork.profile).toEqual({
      kind: 'all-network',
      network: savedPreferences.globalLayoutSettings,
      spatial: profiledSpatial,
    });

    const focusNetwork = captureSavedView({
      name: 'Focus Network',
      workspace,
      state: detailedState(true),
      presentationMode: 'local',
      layout: 'network',
      viewports: {},
      preferences: savedPreferences,
      spatial: profiledSpatial,
    });
    expect(focusNetwork.profile).toEqual({
      kind: 'focus-network',
      network: {
        referencePull: 1.6,
        nodeSize: 7.5,
        linkThickness: 1.8,
        labelThreshold: 12,
      },
    });
    expect(focusNetwork.profile).not.toHaveProperty('spatial');
    expect(focusNetwork.profile).not.toHaveProperty('folderClustering');

    const focusHierarchy = captureSavedView({
      name: 'Focus Hierarchy',
      workspace,
      state: detailedState(true),
      presentationMode: 'local',
      layout: 'hierarchy',
      viewports: {},
      preferences: savedPreferences,
      spatial: profiledSpatial,
    });
    expect(focusHierarchy.profile).toEqual({
      kind: 'focus-hierarchy',
      hierarchy: {
        focusAppearance: 'minimal',
        focusHierarchyImplementation: 'modular-preview',
        modularFocusInternalLayout: 'vertical-spine',
        modularFocusHeadingOrder: 'document-order',
        modularFocusMacroLayout: 'soft-folder-clusters',
        modularFocusSoftFolderStrength: 74,
        modularFolderStripsVisible: false,
        modularConnectionStyle: 'electronic',
      },
    });
    expect(JSON.stringify(focusHierarchy.profile)).not.toContain(
      'showExperimentalAllHierarchy',
    );
    expect(JSON.stringify(focusHierarchy.profile)).not.toContain(
      'trackpadZoomMode',
    );

    const allHierarchy = captureSavedView({
      name: 'All Hierarchy',
      workspace,
      state: documentOnlyProjectionState(),
      presentationMode: 'structure',
      layout: 'hierarchy',
      viewports: {},
      preferences: savedPreferences,
      spatial: profiledSpatial,
    });
    expect(allHierarchy.profile).toEqual({ kind: 'all-hierarchy' });
  });

  it('applies an All Network profile while preserving excluded preferences', () => {
    const entry = captureSavedView({
      name: 'All Network',
      workspace,
      state: documentOnlyProjectionState(),
      presentationMode: 'global',
      layout: 'network',
      viewports: {},
      preferences: savedPreferences,
      spatial: profiledSpatial,
    });
    const current: GraphPreferences = {
      ...DEFAULT_GRAPH_PREFERENCES,
      focusAppearance: 'outline',
      showExperimentalAllHierarchy: true,
      trackpadZoomMode: 'pinch-zoom',
    };

    const result = planSavedViewApply({
      entry,
      workspace,
      availability: available,
      preferences: current,
    });

    expect(result.preferences).toEqual({
      ...current,
      globalLayoutSettings: savedPreferences.globalLayoutSettings,
    });
    expect(result.spatial).toEqual(profiledSpatial);
    expect(result.preferences.trackpadZoomMode).toBe('pinch-zoom');
    expect(result.preferences.showExperimentalAllHierarchy).toBe(true);
    expect(result.preferences.focusAppearance).toBe('outline');
  });

  it('applies only the four shared Focus Network controls', () => {
    const entry = captureSavedView({
      name: 'Focus Network',
      workspace,
      state: detailedState(true),
      presentationMode: 'local',
      layout: 'network',
      viewports: {},
      preferences: savedPreferences,
      spatial: profiledSpatial,
    });
    const current: GraphPreferences = {
      ...DEFAULT_GRAPH_PREFERENCES,
      globalLayoutSettings: {
        folderClustering: true,
        spacingPreset: 'compact',
        custom: {
          ...customGlobalLayoutSettings('compact'),
          folderCohesion: 0.16,
          withinFolderSpacing: 0.65,
          betweenFolderSpacing: 7.1,
          referenceDegreeSizeInfluence: 14,
        },
      },
      trackpadZoomMode: 'pinch-zoom',
    };

    const result = planSavedViewApply({
      entry,
      workspace,
      availability: available,
      preferences: current,
    });
    const resolved = resolveGlobalLayoutSettings(
      result.preferences.globalLayoutSettings,
    );

    expect(resolved).toMatchObject({
      folderClustering: true,
      spacingPreset: 'compact',
      folderCohesion: 0.16,
      withinFolderSpacing: 0.65,
      betweenFolderSpacing: 7.1,
      referenceDegreeSizeInfluence: 14,
      linkForce: 1.6,
      nodeSize: 7.5,
      linkThickness: 1.8,
      labelThreshold: 12,
    });
    expect(result.preferences.trackpadZoomMode).toBe('pinch-zoom');
    expect(result.spatial).toBeUndefined();
  });

  it('applies only the Focus Hierarchy subset and treats All Hierarchy as a no-op profile', () => {
    const focusEntry = captureSavedView({
      name: 'Focus Hierarchy',
      workspace,
      state: detailedState(true),
      presentationMode: 'local',
      layout: 'hierarchy',
      viewports: {},
      preferences: savedPreferences,
      spatial: profiledSpatial,
    });
    const current: GraphPreferences = {
      ...DEFAULT_GRAPH_PREFERENCES,
      globalLayoutSettings: {
        folderClustering: false,
        spacingPreset: 'compact',
      },
      showExperimentalAllHierarchy: true,
      trackpadZoomMode: 'pinch-zoom',
    };
    const focusResult = planSavedViewApply({
      entry: focusEntry,
      workspace,
      availability: available,
      preferences: current,
    });
    expect(focusResult.preferences).toMatchObject({
      focusAppearance: 'minimal',
      focusHierarchyImplementation: 'modular-preview',
      modularFocusInternalLayout: 'vertical-spine',
      modularFocusHeadingOrder: 'document-order',
      modularFocusMacroLayout: 'soft-folder-clusters',
      modularFocusSoftFolderStrength: 74,
      modularFolderStripsVisible: false,
      modularConnectionStyle: 'electronic',
      globalLayoutSettings: current.globalLayoutSettings,
      showExperimentalAllHierarchy: true,
      trackpadZoomMode: 'pinch-zoom',
    });
    expect(focusResult.spatial).toBeUndefined();

    const allEntry = captureSavedView({
      name: 'All Hierarchy',
      workspace,
      state: documentOnlyProjectionState(),
      presentationMode: 'structure',
      layout: 'hierarchy',
      viewports: {},
      preferences: savedPreferences,
      spatial: profiledSpatial,
    });
    const allResult = planSavedViewApply({
      entry: allEntry,
      workspace,
      availability: available,
      preferences: current,
    });
    expect(allResult.preferences).toBe(current);
    expect(allResult.spatial).toBeUndefined();
  });

  it('compares only deterministic semantic snapshots, never hidden active identity', () => {
    const left = capture({
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

  it('derives the deterministic alphabetical match and keeps migrated entries semantic-only', () => {
    const current = captureSavedView({
      name: 'Current View',
      workspace,
      state: documentOnlyProjectionState(),
      presentationMode: 'global',
      layout: 'network',
      viewports: {},
      preferences: savedPreferences,
      spatial: profiledSpatial,
    });
    const equivalentZulu = { ...current, name: 'Zulu' };
    const equivalentAlpha = { ...current, name: 'alpha' };
    expect(
      matchingSavedViewName(current, [equivalentZulu, equivalentAlpha]),
    ).toBe('alpha');

    const changedProfile = captureSavedView({
      name: 'Changed',
      workspace,
      state: documentOnlyProjectionState(),
      presentationMode: 'global',
      layout: 'network',
      viewports: {},
      preferences: DEFAULT_GRAPH_PREFERENCES,
      spatial,
    });
    expect(sameSavedViewSnapshot(current, changedProfile)).toBe(false);
    const legacy = {
      name: changedProfile.name,
      layout: changedProfile.layout,
      view: changedProfile.view,
    };
    expect(sameSavedViewSnapshot(current, legacy)).toBe(true);
  });

  it('keeps render-time matching nonfatal without weakening strict capture', () => {
    const invalid = {
      name: 'Current View',
      workspace,
      state: {
        ...documentOnlyProjectionState(),
        filters: { query: 'kind:' },
      },
      presentationMode: 'global' as const,
      layout: 'network' as const,
      viewports: {},
      preferences: DEFAULT_GRAPH_PREFERENCES,
      spatial,
    };
    const existing = capture({
      name: 'Existing',
      workspace,
      state: documentOnlyProjectionState(),
      presentationMode: 'global',
      layout: 'network',
      viewports: {},
    });

    expect(() => captureSavedView(invalid)).toThrow(
      'Cannot persist invalid graph query',
    );
    expect(matchingCurrentSavedViewName(invalid, [existing])).toBeUndefined();
  });
});
