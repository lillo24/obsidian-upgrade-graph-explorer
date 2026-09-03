import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
} from '@icarus-graph-explorer/view-projection';
import {
  createPersistedWorkspaceView,
  serializePersistedWorkspaceView,
  reconcileCurrentWorkspaceView,
} from '@icarus-graph-explorer/view-state';
import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import { createRuntimePerformanceRecorder } from '@icarus-graph-explorer/performance';
import {
  allHierarchyAvailable,
  resolveAvailablePresentationMode,
} from './exploration-model';
import {
  createGraphHistoryCheckpoint,
  normalizeAvailableGraphHistory,
  goBackInGraphHistory,
  goForwardInGraphHistory,
  returnToAllInGraphHistory,
} from './navigation-history';
import { GraphExplorer } from './components/GraphExplorer';
import { ExplorationControls } from './components/ExplorationControls';
import { hydrateGraphView } from './persistence/session';
import { workspaceViewStorageKey } from './persistence/storage';
import { GRAPH_PREFERENCES_STORAGE_KEY } from './preferences/graph-preferences';
import { planLocalEntityNavigation } from './local-view';
import sampleReport from './sample-report.json';

const report = validateObsidianDiagnosticReport(sampleReport);
if (!report.valid) throw new Error('Invalid Synthetic Sample.');
const snapshot = report.value.snapshot;
const workspace = createProjectionWorkspace(snapshot);
const root = snapshot.entities.find(
  (e) => e.kind === 'document' && e.source.path === 'Source.md',
)!;
const all = documentOnlyProjectionState();
const focus = {
  ...all,
  focus: {
    rootEntityId: root.id,
    hops: 1 as const,
    direction: 'both' as const,
    hierarchyContext: 'ancestors' as const,
  },
};
const off = { showExperimentalAllHierarchy: false, allNetworkAvailable: true };
const on = { ...off, showExperimentalAllHierarchy: true };
const recovery = { ...off, allNetworkAvailable: false };

describe('Shared presentation availability', () => {
  it.each([
    ['structure', all, off, 'global'],
    ['structure', all, on, 'structure'],
    ['global', all, off, 'global'],
    ['global', all, recovery, 'structure'],
    ['structure', all, recovery, 'structure'],
    ['local', focus, off, 'local'],
    ['local', all, off, 'global'],
    ['local', all, recovery, 'structure'],
  ] as const)(
    'resolves %s for reconciled state',
    (mode, state, availability, expected) => {
      expect(resolveAvailablePresentationMode(mode, state, availability)).toBe(
        expected,
      );
    },
  );
  it('uses the same policy for no-checkpoint Focus exit and live root deletion', () => {
    expect(
      resolveAvailablePresentationMode('local', all, on, 'structure'),
    ).toBe('structure');
    expect(
      resolveAvailablePresentationMode('local', all, off, 'structure'),
    ).toBe('global');
    const withoutRoot = createProjectionWorkspace({
      ...snapshot,
      entities: [],
      references: [],
    });
    const reconciled = reconcileCurrentWorkspaceView(withoutRoot, focus);
    expect(reconciled.state.focus).toBeUndefined();
    expect(
      resolveAvailablePresentationMode('local', reconciled.state, off),
    ).toBe('global');
    expect(
      resolveAvailablePresentationMode('local', reconciled.state, recovery),
    ).toBe('structure');
  });
  it.each([false, true])(
    'hydrates saved All Hierarchy without deleting disclosure/bookmarks, exposed=%s',
    (show) => {
      const state = {
        ...all,
        disclosure: { ...all.disclosure, defaultDepth: 3 as const },
      };
      const viewports = { structure: { anchorEntityId: root.id, zoom: 0.7 } };
      const stored = serializePersistedWorkspaceView(
        createPersistedWorkspaceView({
          workspace,
          state,
          presentationMode: 'structure',
          viewports,
        }),
      );
      const storage = {
        getItem: (key: string) =>
          key === GRAPH_PREFERENCES_STORAGE_KEY
            ? JSON.stringify({ showExperimentalAllHierarchy: show })
            : key === workspaceViewStorageKey(snapshot.workspace.id)
              ? stored
              : null,
        setItem: () => undefined,
        removeItem: () => undefined,
      };
      const hydrated = hydrateGraphView({
        workspace,
        storage,
        eligibility: 'stable',
      });
      expect(hydrated.viewports).toEqual(viewports);
      expect(hydrated.state.disclosure.defaultDepth).toBe(3);
      const markup = renderToStaticMarkup(
        <GraphExplorer
          snapshot={snapshot}
          storage={storage}
          identityStability="stable"
          maximized={false}
          onMaximizedChange={() => undefined}
        />,
      );
      expect(markup).toContain(
        show ? 'Hierarchy, experimental in All scope' : 'Loading All Network',
      );
      expect(markup.includes('>Hierarchy</button>')).toBe(show);
      expect(
        storage.getItem(workspaceViewStorageKey(snapshot.workspace.id)),
      ).toBe(stored);
    },
  );
  it('starts in All Network with old preferences and no invisible Structure projection', () => {
    const performance = createRuntimePerformanceRecorder({
      now: () => 0,
      markNextPaint: () => undefined,
    });
    const markup = renderToStaticMarkup(
      <GraphExplorer
        snapshot={snapshot}
        maximized={false}
        onMaximizedChange={() => undefined}
        performance={performance}
        storage={null}
      />,
    );
    expect(markup).toContain('Loading All Network');
    expect(markup).not.toContain('>Hierarchy</button>');
    expect(performance.snapshot().operations['projections']).toBe(0);
    expect(performance.snapshot().operations['global-projections']).toBe(1);
  });
  it.each(['section', 'block'] as const)(
    'exact %s navigation reuses bounded Focus and selects the exact node',
    (kind) => {
      const entity = snapshot.entities.find((e) => e.kind === kind)!;
      expect(entity).toBeDefined();
      const plan = planLocalEntityNavigation(workspace, all, entity.id);
      expect(plan.state.focus).toBeDefined();
      expect(
        plan.projection.nodes.find((n) => n.id === plan.projectionNodeId),
      ).toMatchObject({ entityId: entity.id });
      expect(workspace.entity(plan.rootEntityId)?.kind).toBe('document');
    },
  );
  it.each([
    ['all', off, false],
    ['all', on, true],
    ['focus', off, true],
    ['all', recovery, true],
  ] as const)('exposes controls for %s', (scope, availability, hierarchy) => {
    const markup = renderToStaticMarkup(
      <ExplorationControls
        scope={scope}
        layout="network"
        allHierarchyExposed={allHierarchyAvailable(availability)}
        {...(!availability.allNetworkAvailable
          ? { networkDisabledReason: 'All Network unavailable' }
          : {})}
        onLayoutChange={() => undefined}
        onScopeChange={() => undefined}
      />,
    );
    expect(markup.includes('>Hierarchy</button>')).toBe(hierarchy);
    if (!availability.allNetworkAvailable)
      expect(markup).toContain('Hierarchy, Network recovery');
  });
});

describe('History with the experiment hidden', () => {
  const network = createGraphHistoryCheckpoint(all, undefined, 'global', {
    global: { anchorEntityId: root.id, ratio: 0.4 },
  });
  const hierarchy = createGraphHistoryCheckpoint(all, undefined, 'structure', {
    ...network.viewports,
    structure: { anchorEntityId: root.id, zoom: 0.8 },
  });
  const local = createGraphHistoryCheckpoint(
    focus,
    undefined,
    'local',
    hierarchy.viewports,
  );
  it('coalesces All Network → All Hierarchy → Focus when disabled and preserves Back/Forward', () => {
    const normalized = normalizeAvailableGraphHistory(
      { past: [network, hierarchy], future: [] },
      local,
      off,
    );
    expect(normalized.history.past).toHaveLength(1);
    const back = goBackInGraphHistory(normalized.history, normalized.current)!;
    expect(back.target.presentationMode).toBe('global');
    expect(back.target.viewports).toEqual(hierarchy.viewports);
    expect(goForwardInGraphHistory(back.history, back.target)?.target).toEqual(
      local,
    );
    expect(
      returnToAllInGraphHistory(normalized.history, local)?.target,
    ).toEqual(back.target);
  });
  it('preserves distinct semantic/query state and future order while normalizing', () => {
    const filtered = {
      ...hierarchy,
      state: { ...all, filters: { query: 'kind:file' } },
    };
    const normalized = normalizeAvailableGraphHistory(
      { past: [network, filtered], future: [hierarchy] },
      local,
      off,
    );
    expect(normalized.history.past).toHaveLength(2);
    expect(normalized.history.past[1]?.state).toBe(filtered.state);
    expect(normalized.history.future[0]?.presentationMode).toBe('global');
    expect(normalized.history.future[0]?.viewports).toEqual(
      hierarchy.viewports,
    );
  });
  it('does not leave an invisible Back checkpoint when disabled while active', () => {
    const normalized = normalizeAvailableGraphHistory(
      { past: [network, hierarchy], future: [] },
      { ...hierarchy, presentationMode: 'global' },
      off,
    );
    expect(normalized.history.past).toEqual([]);
    expect(normalized.current.viewports).toEqual(hierarchy.viewports);
    expect(
      normalizeAvailableGraphHistory(
        { past: [network], future: [] },
        hierarchy,
        on,
      ).history.past,
    ).toEqual([network]);
  });
});
