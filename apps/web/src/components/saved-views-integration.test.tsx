// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import { createRuntimePerformanceRecorder } from '@icarus-graph-explorer/performance';
import type { GraphCanvasProps } from '@icarus-graph-explorer/renderer-reactflow';
import type { TemporaryFileMoveController } from '@icarus-graph-explorer/renderer-sigma';
import {
  createEmptySpatialOverrideRegistry,
  serializeSpatialOverrideRegistry,
  setFolderSpatialRule,
} from '@icarus-graph-explorer/spatial-overrides';
import { customGlobalLayoutSettings } from '@icarus-graph-explorer/renderer-sigma/settings';
import {
  createPersistedWorkspaceView,
  serializePersistedWorkspaceView,
} from '@icarus-graph-explorer/view-state';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
} from '@icarus-graph-explorer/view-projection';

import {
  DEFAULT_GRAPH_PREFERENCES,
  GRAPH_PREFERENCES_STORAGE_KEY,
  serializeGraphPreferences,
} from '../preferences/graph-preferences';
import { captureSavedView } from '../saved-view';
import {
  savedViewStorageKey,
  serializeSavedViewRegistry,
} from '../persistence/saved-views';
import { workspaceViewStorageKey } from '../persistence/storage';
import { spatialOverrideStorageKey } from '../persistence/spatial-overrides';
import sampleReport from '../sample-report.json';
import type { GlobalGraphViewProps } from './GlobalGraphView';
import { GraphExplorer } from './GraphExplorer';
import type { LocalGraphViewProps } from './LocalGraphView';
import type { LocalStructuredGraphViewProps } from './LocalStructuredGraphView';

const captured = vi.hoisted(() => ({
  global: undefined as GlobalGraphViewProps | undefined,
  local: undefined as LocalGraphViewProps | undefined,
  hierarchy: undefined as LocalStructuredGraphViewProps | undefined,
  structure: undefined as GraphCanvasProps | undefined,
}));

vi.mock('./GlobalGraphView', () => ({
  default: (props: GlobalGraphViewProps) => {
    captured.global = props;
    return <div data-mode="global" />;
  },
}));
vi.mock('./LocalGraphView', () => ({
  default: (props: LocalGraphViewProps) => {
    captured.local = props;
    return <div data-mode="local-free" />;
  },
}));
vi.mock('./LocalStructuredGraphView', () => ({
  default: (props: LocalStructuredGraphViewProps) => {
    captured.hierarchy = props;
    return <div data-mode="local-structured" />;
  },
}));
vi.mock(
  '@icarus-graph-explorer/renderer-reactflow',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@icarus-graph-explorer/renderer-reactflow')
    >()),
    GraphCanvas: (props: GraphCanvasProps) => {
      captured.structure = props;
      return <div data-mode="structure" />;
    },
  }),
);

const validation = validateObsidianDiagnosticReport(sampleReport);
if (!validation.valid) throw new Error('Invalid Synthetic Sample.');
const snapshot = validation.value.snapshot;
const workspace = createProjectionWorkspace(snapshot);
const source = snapshot.entities.find(
  (candidate) => candidate.kind === 'document',
)!;
const emptySpatial = createEmptySpatialOverrideRegistry(snapshot.workspace.id);
const currentState = {
  ...documentOnlyProjectionState(),
  filters: { query: 'kind:document' },
};
const targetState = {
  ...documentOnlyProjectionState(),
  disclosure: {
    ...documentOnlyProjectionState().disclosure,
    defaultDepth: 2 as const,
    includeBlocks: true,
  },
  focus: {
    rootEntityId: source.id,
    hops: 3 as const,
    direction: 'outgoing' as const,
    hierarchyContext: 'ancestors-and-children' as const,
  },
  filters: { query: 'kind:section' },
};
const namedTarget = captureSavedView({
  name: 'Focus hierarchy',
  workspace,
  state: targetState,
  presentationMode: 'local',
  layout: 'hierarchy',
  viewports: {
    local: {
      anchorEntityId: source.id,
      freeRatio: 0.44,
      structuredZoom: 0.88,
    },
  },
  preferences: DEFAULT_GRAPH_PREFERENCES,
  spatial: emptySpatial,
});
const matchingCurrentTarget = captureSavedView({
  name: 'Current network',
  workspace,
  state: currentState,
  presentationMode: 'global',
  layout: 'network',
  viewports: {
    global: { anchorEntityId: source.id, ratio: 0.35 },
  },
  preferences: DEFAULT_GRAPH_PREFERENCES,
  spatial: emptySpatial,
});

describe('GraphExplorer Named Saved Views integration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let values: Map<string, string>;
  let writes: string[];
  let performance: ReturnType<typeof createRuntimePerformanceRecorder>;
  let openArguments: Mock<(trigger: HTMLElement) => void>;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes.push(key);
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    values = new Map();
    writes = [];
    storage.setItem = (key: string, value: string) => {
      writes.push(key);
      values.set(key, value);
    };
    performance = createRuntimePerformanceRecorder({
      now: () => 0,
      markNextPaint: () => undefined,
    });
    openArguments = vi.fn();
    captured.global = undefined;
    captured.local = undefined;
    captured.hierarchy = undefined;
    captured.structure = undefined;
    values.set(
      GRAPH_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        localLayoutMode: 'free',
        trackpadZoomMode: 'pinch-zoom',
        showExperimentalAllHierarchy: true,
      }),
    );
    values.set(
      workspaceViewStorageKey(snapshot.workspace.id),
      serializePersistedWorkspaceView(
        createPersistedWorkspaceView({
          workspace,
          state: currentState,
          presentationMode: 'global',
          viewports: {
            global: { anchorEntityId: source.id, ratio: 0.35 },
          },
        }),
      ),
    );
    values.set(
      savedViewStorageKey(snapshot.workspace.id),
      serializeSavedViewRegistry({
        schemaVersion: 2,
        workspaceId: snapshot.workspace.id,
        views: [namedTarget],
      }),
    );
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function mount(maximized = false) {
    await act(async () => {
      root.render(
        <GraphExplorer
          identityStability="stable"
          maximized={maximized}
          onMaximizedChange={() => undefined}
          onOpenArguments={openArguments}
          performance={performance}
          snapshot={snapshot}
          storage={storage}
        />,
      );
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function button(name: string) {
    const result = [
      ...document.body.querySelectorAll<HTMLButtonElement>('button'),
    ].find(
      (candidate) =>
        candidate.getAttribute('aria-label') === name ||
        candidate.getAttribute('aria-label')?.startsWith(`${name},`) ||
        candidate.textContent?.trim() === name,
    );
    if (result === undefined) throw new Error(`Missing test control ${name}`);
    return result;
  }

  async function click(name: string) {
    await act(async () => {
      button(name).click();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function quickSwitch() {
    const result = container.querySelector<HTMLSelectElement>(
      '[aria-label="Quick switch Saved View"]',
    );
    if (result === null) throw new Error('Missing Saved View quick switch.');
    return result;
  }

  async function quickApply(name: string) {
    const select = quickSwitch();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value',
    )?.set;
    if (setter === undefined) throw new Error('Missing select value setter.');
    await act(async () => {
      setter.call(select, name);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function transitionOverlay() {
    return container.querySelector<HTMLElement>('.saved-view-transition');
  }

  function statusCheckbox(status: string) {
    const result = document.body.querySelector<HTMLInputElement>(
      `[name="graph-status-${status}"]`,
    );
    if (result === null) throw new Error(`Missing ${status} status control.`);
    return result;
  }

  async function setReferenceStatus(status: string, enabled: boolean) {
    const control = statusCheckbox(status);
    if (control.checked === enabled) return;
    await act(async () => {
      control.click();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(statusCheckbox(status).checked).toBe(enabled);
  }

  function persistedReferenceStatuses() {
    return JSON.parse(
      values.get(workspaceViewStorageKey(snapshot.workspace.id))!,
    ).projection.filters.referenceStatuses as readonly string[];
  }

  function setControlValue(
    control: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ) {
    const prototype =
      control instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter === undefined) throw new Error('Missing native value setter.');
    setter.call(control, value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function applyNamedTarget() {
    await click('Manage Saved Views');
    await click('Apply');
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function mode() {
    return container.querySelector('[data-mode]')?.getAttribute('data-mode');
  }

  it('applies one reconciled transaction, clears history/selection, syncs the draft, and restores Focus layout/viewport', async () => {
    await mount();
    expect(mode()).toBe('global');
    const nodeId = captured.global!.projection.nodes[0]!.id;
    await act(() =>
      captured.global!.onSelectionChange({ kind: 'node', id: nodeId }),
    );
    const cancel = vi.fn(() => true);
    const controller: TemporaryFileMoveController = {
      start: () => ({ status: 'started' }),
      nudge: () => true,
      release: () => true,
      cancel,
    };
    await act(() =>
      captured.global!.onTemporaryFileMoveControllerChange?.(controller),
    );
    await click('Hierarchy');
    expect(mode()).toBe('structure');
    cancel.mockClear();
    await click('Filters');
    const query = document.body.querySelector<HTMLTextAreaElement>(
      '#filters-query-input',
    )!;
    await act(() => {
      setControlValue(query, 'kind:block');
    });
    expect(document.body.textContent).toContain('Draft not applied');
    writes = [];

    await applyNamedTarget();

    expect(mode()).toBe('local-structured');
    expect(captured.hierarchy?.selection).toBeNull();
    expect(captured.hierarchy?.centerRequest).toMatchObject({ zoom: 0.88 });
    expect(
      container.querySelector<HTMLButtonElement>(
        '[aria-label="Back in graph history"]',
      )?.disabled,
    ).toBe(true);
    expect(query.value).toBe('kind:section');
    expect(document.body.textContent).not.toContain('Draft not applied');
    expect(cancel).toHaveBeenCalledWith('scope-changed');
    expect(document.body.querySelector('.saved-views-popover')).toBeNull();

    const preferences = JSON.parse(values.get(GRAPH_PREFERENCES_STORAGE_KEY)!);
    expect(preferences.localLayoutMode).toBe('structured');
    expect(preferences.trackpadZoomMode).toBe('pinch-zoom');
    const persistedCurrent = JSON.parse(
      values.get(workspaceViewStorageKey(snapshot.workspace.id))!,
    );
    expect(persistedCurrent).toMatchObject({
      presentationMode: 'local',
      projection: { filters: { query: 'kind:section' } },
    });
    expect(
      JSON.parse(values.get(savedViewStorageKey(snapshot.workspace.id))!),
    ).toEqual({
      schemaVersion: 2,
      workspaceId: snapshot.workspace.id,
      views: [namedTarget],
    });
    expect(new Set(writes)).toEqual(
      new Set([
        GRAPH_PREFERENCES_STORAGE_KEY,
        workspaceViewStorageKey(snapshot.workspace.id),
      ]),
    );
  });

  it('blocks Apply while an Arrange Folders draft is dirty', async () => {
    await mount();
    await act(() =>
      captured.global!.folderArrangement?.onDraftDirtyChange?.(true),
    );
    await click('Manage Saved Views');
    await click('Apply');
    expect(mode()).toBe('global');
    expect(document.body.querySelector('.saved-views-popover')).not.toBeNull();
    expect(document.body.textContent).toContain(
      'Apply or cancel the current spatial rule changes before applying a Saved View.',
    );
  });

  it('quick-switches from derived matching, falls back to Current View after an edit, and matches again after Update', async () => {
    await mount();
    expect(quickSwitch().value).toBe('');

    await quickApply('Focus hierarchy');
    expect(mode()).toBe('local-structured');
    expect(quickSwitch().value).toBe('Focus hierarchy');
    expect(document.body.querySelector('.saved-views-popover')).toBeNull();

    await click('Filters');
    const query = document.body.querySelector<HTMLTextAreaElement>(
      '#filters-query-input',
    )!;
    await act(() => setControlValue(query, 'kind:block'));
    await click('Apply query');
    expect(quickSwitch().value).toBe('');
    expect(quickSwitch().title).toBe('Current View');

    await click('Manage Saved Views');
    await click('Update');
    expect(quickSwitch().value).toBe('Focus hierarchy');
    expect(
      JSON.parse(values.get(savedViewStorageKey(snapshot.workspace.id))!)
        .views[0].view.projection.filters.query,
    ).toBe('kind:block');
  });

  it('keeps All Network mounted through every explicit reference-status transition and recovery', async () => {
    await mount();
    await click('Filters');
    const initialFitRequestKey = captured.global!.fitRequestKey;

    for (const status of ['unresolved', 'ambiguous', 'invalid'] as const) {
      const before =
        performance.snapshot().operations['global-projections'] ?? 0;
      await setReferenceStatus(status, true);
      expect(performance.snapshot().operations['global-projections']).toBe(
        before + 1,
      );
      expect(persistedReferenceStatuses()).toEqual(['resolved', status].sort());
      expect(container.querySelector('.graph-workspace')).not.toBeNull();
      expect(captured.global?.projection.nodes).toBeInstanceOf(Array);
      expect(quickSwitch().disabled).toBe(false);

      await setReferenceStatus('resolved', false);
      expect(persistedReferenceStatuses()).toEqual([status]);
      expect(mode()).toBe('global');
      await setReferenceStatus('resolved', true);
      await setReferenceStatus(status, false);
      expect(persistedReferenceStatuses()).toEqual(['resolved']);
    }

    const selectedId = captured.global!.projection.nodes[0]!.id;
    await act(() =>
      captured.global!.onSelectionChange({ kind: 'node', id: selectedId }),
    );
    await setReferenceStatus('resolved', false);
    expect(persistedReferenceStatuses()).toEqual([]);
    expect(mode()).toBe('global');
    expect(captured.global?.projection.nodes).toBeInstanceOf(Array);
    if (
      captured.global?.projection.nodes.every(({ id }) => id !== selectedId)
    ) {
      expect(captured.global.selection).toBeNull();
    }
    await setReferenceStatus('resolved', true);

    await setReferenceStatus('unresolved', true);
    await setReferenceStatus('ambiguous', true);
    await setReferenceStatus('invalid', true);
    await setReferenceStatus('resolved', false);
    expect(persistedReferenceStatuses()).toEqual([
      'ambiguous',
      'invalid',
      'unresolved',
    ]);
    expect(container.querySelector('.graph-workspace')).not.toBeNull();
    expect(mode()).toBe('global');
    expect(captured.global?.fitRequestKey).toBe(initialFitRequestKey);
    expect(
      container.querySelector<HTMLButtonElement>(
        '[aria-label="Back in graph history"]',
      )?.disabled,
    ).toBe(false);
  });

  it.each([
    {
      label: 'no Named Saved Views',
      registry: serializeSavedViewRegistry({
        schemaVersion: 2,
        workspaceId: snapshot.workspace.id,
        views: [],
      }),
      expectedInitialName: '',
    },
    {
      label: 'a matching v2 Saved View',
      registry: serializeSavedViewRegistry({
        schemaVersion: 2,
        workspaceId: snapshot.workspace.id,
        views: [matchingCurrentTarget],
      }),
      expectedInitialName: 'Current network',
    },
    {
      label: 'a nonmatching v2 Saved View',
      registry: serializeSavedViewRegistry({
        schemaVersion: 2,
        workspaceId: snapshot.workspace.id,
        views: [namedTarget],
      }),
      expectedInitialName: '',
    },
    {
      label: 'a migrated profile-less v1 Saved View',
      registry: JSON.stringify({
        schemaVersion: 1,
        workspaceId: snapshot.workspace.id,
        views: [
          {
            name: matchingCurrentTarget.name,
            layout: matchingCurrentTarget.layout,
            view: matchingCurrentTarget.view,
          },
        ],
      }),
      expectedInitialName: 'Current network',
    },
  ])(
    'keeps an Unresolved live transition safe with $label',
    async ({ registry, expectedInitialName }) => {
      values.set(savedViewStorageKey(snapshot.workspace.id), registry);
      await mount();
      expect(quickSwitch().value).toBe(expectedInitialName);
      await click('Filters');

      await setReferenceStatus('unresolved', true);

      expect(mode()).toBe('global');
      expect(container.querySelector('.graph-workspace')).not.toBeNull();
      expect(statusCheckbox('unresolved').checked).toBe(true);
      expect(quickSwitch().value).toBe('');

      await setReferenceStatus('unresolved', false);
      expect(mode()).toBe('global');
      // The live round trip preserves the explicit Global resolved-only
      // filter, so it correctly remains distinct from an implicit-default
      // saved snapshot while the renderer and matcher stay usable.
      expect(quickSwitch().value).toBe('');
    },
  );

  it('converges live and cold Unresolved hydration to the same valid graph', async () => {
    await mount();
    await click('Filters');
    await setReferenceStatus('unresolved', true);
    const liveNodes = captured.global!.projection.nodes.map(({ id }) => id);
    const liveEdges = captured.global!.projection.edges.map(({ id }) => id);

    await act(() => root.unmount());
    root = createRoot(container);
    captured.global = undefined;
    await mount();

    expect(mode()).toBe('global');
    expect(captured.global!.projection.nodes.map(({ id }) => id)).toEqual(
      liveNodes,
    );
    expect(captured.global!.projection.edges.map(({ id }) => id)).toEqual(
      liveEdges,
    );
    await click('Filters');
    expect(statusCheckbox('unresolved').checked).toBe(true);
  });

  it('keeps a cold zero-node All Network projection inside the usable app shell', async () => {
    values.set(
      workspaceViewStorageKey(snapshot.workspace.id),
      serializePersistedWorkspaceView(
        createPersistedWorkspaceView({
          workspace,
          state: {
            ...currentState,
            filters: {
              query: 'documents AND path:"__no_matching_path__"',
              referenceStatuses: ['unresolved'],
            },
          },
          presentationMode: 'global',
          viewports: {},
        }),
      ),
    );

    await mount();

    expect(mode()).toBe('global');
    expect(captured.global?.projection.nodes).toEqual([]);
    expect(captured.global?.projection.edges).toEqual([]);
    expect(container.querySelector('.graph-workspace')).not.toBeNull();
    expect(quickSwitch()).toBeInstanceOf(HTMLSelectElement);
  });

  it('keeps status changes safe in Focus Network and Focus Hierarchy', async () => {
    await mount();
    await quickApply('Focus hierarchy');
    expect(mode()).toBe('local-structured');
    await click('Filters');
    await setReferenceStatus('unresolved', false);
    await setReferenceStatus('unresolved', true);
    expect(mode()).toBe('local-structured');

    await click('Network');
    expect(mode()).toBe('local-free');
    await setReferenceStatus('ambiguous', false);
    await setReferenceStatus('ambiguous', true);
    expect(mode()).toBe('local-free');
    expect(container.querySelector('.graph-workspace')).not.toBeNull();
  });

  it('does not animate unrelated manual filter changes', async () => {
    await mount();
    await click('Filters');
    await setReferenceStatus('unresolved', false);

    expect(transitionOverlay()).toBeNull();
  });

  it('uses the same successful Apply transition for quick switch and management', async () => {
    await mount();

    await quickApply('Focus hierarchy');
    const quickTransition = transitionOverlay();
    const quickToken = Number(
      quickTransition?.dataset.savedViewTransitionToken,
    );
    expect(quickTransition?.dataset.savedViewTransitionOrigin).toBe('apply');
    expect(
      quickTransition?.querySelector('.saved-view-transition__title')
        ?.textContent,
    ).toBe('Focus hierarchy');

    await applyNamedTarget();
    const managedTransition = transitionOverlay();
    expect(managedTransition?.dataset.savedViewTransitionOrigin).toBe('apply');
    expect(Number(managedTransition?.dataset.savedViewTransitionToken)).toBe(
      quickToken + 1,
    );
    expect(
      managedTransition?.querySelector('.saved-view-transition__title')
        ?.textContent,
    ).toBe('Focus hierarchy');
  });

  it('keeps only the latest presentation during rapid Saved View switching', async () => {
    const rapidViews = ['View A', 'View B', 'View C'].map((name) =>
      captureSavedView({
        name,
        workspace,
        state: targetState,
        presentationMode: 'local',
        layout: 'hierarchy',
        viewports: {
          local: {
            anchorEntityId: source.id,
            freeRatio: 0.44,
            structuredZoom: 0.88,
          },
        },
        preferences: DEFAULT_GRAPH_PREFERENCES,
        spatial: emptySpatial,
      }),
    );
    values.set(
      savedViewStorageKey(snapshot.workspace.id),
      serializeSavedViewRegistry({
        schemaVersion: 2,
        workspaceId: snapshot.workspace.id,
        views: rapidViews,
      }),
    );
    await mount();

    await quickApply('View A');
    await quickApply('View B');
    await quickApply('View C');

    expect(
      transitionOverlay()?.querySelector('.saved-view-transition__title')
        ?.textContent,
    ).toBe('View C');
    expect(transitionOverlay()?.dataset.savedViewTransitionToken).toBe('3');
    expect(container.querySelectorAll('.saved-view-transition')).toHaveLength(
      1,
    );
  });

  it('does not adopt semantic, presentation, selection, history, or preferences when profile persistence fails', async () => {
    const failedSpatial = setFolderSpatialRule(emptySpatial, {
      folderKey: 'Architecture',
      behavior: 'place',
      scope: { kind: 'exact' },
      anchor: { x: -0.4, y: 0.5 },
    });
    const failedPreferences = {
      ...DEFAULT_GRAPH_PREFERENCES,
      globalLayoutSettings: {
        folderClustering: false,
        spacingPreset: 'normal' as const,
        custom: {
          ...customGlobalLayoutSettings('normal'),
          linkForce: 1.65,
        },
      },
    };
    const failedTarget = captureSavedView({
      name: 'Failed profile',
      workspace,
      state: { ...currentState, filters: { query: 'kind:section' } },
      presentationMode: 'global',
      layout: 'network',
      viewports: {
        global: { anchorEntityId: source.id, ratio: 0.35 },
      },
      preferences: failedPreferences,
      spatial: failedSpatial,
    });
    const spatialKey = spatialOverrideStorageKey(snapshot.workspace.id);
    values.set(spatialKey, serializeSpatialOverrideRegistry(emptySpatial));
    values.set(
      savedViewStorageKey(snapshot.workspace.id),
      serializeSavedViewRegistry({
        schemaVersion: 2,
        workspaceId: snapshot.workspace.id,
        views: [failedTarget],
      }),
    );
    await mount();
    const selectedId = captured.global!.projection.nodes[0]!.id;
    await act(() =>
      captured.global!.onSelectionChange({ kind: 'node', id: selectedId }),
    );
    await click('Hierarchy');
    expect(mode()).toBe('structure');
    expect(captured.structure?.selection).toEqual({
      kind: 'node',
      id: selectedId,
    });
    const back = container.querySelector<HTMLButtonElement>(
      '[aria-label="Back in graph history"]',
    )!;
    expect(back.disabled).toBe(false);
    const beforePreferences = values.get(GRAPH_PREFERENCES_STORAGE_KEY);
    const beforeSpatial = values.get(spatialKey);
    const beforeCurrentView = values.get(
      workspaceViewStorageKey(snapshot.workspace.id),
    );
    let failOnce = true;
    storage.setItem = (key, value) => {
      writes.push(key);
      if (key === GRAPH_PREFERENCES_STORAGE_KEY && failOnce) {
        failOnce = false;
        throw new Error('quota exceeded');
      }
      values.set(key, value);
    };

    await click('Manage Saved Views');
    await click('Apply');

    expect(mode()).toBe('structure');
    expect(captured.structure?.selection).toEqual({
      kind: 'node',
      id: selectedId,
    });
    expect(back.disabled).toBe(false);
    expect(values.get(GRAPH_PREFERENCES_STORAGE_KEY)).toBe(beforePreferences);
    expect(values.get(spatialKey)).toBe(beforeSpatial);
    expect(values.get(workspaceViewStorageKey(snapshot.workspace.id))).toBe(
      beforeCurrentView,
    );
    expect(quickSwitch().value).toBe('');
    expect(document.body.textContent).toContain('quota exceeded');
    expect(transitionOverlay()).toBeNull();

    await click('Network');
    expect(captured.global?.spatialRules).toEqual([]);
    expect(captured.global?.settings).toEqual(
      DEFAULT_GRAPH_PREFERENCES.globalLayoutSettings,
    );
  });

  it.each([false, true])(
    'places one keyboard-accessible switcher immediately before Search in %s maximized mode',
    async (maximized) => {
      await mount(maximized);
      const searchRegion = container.querySelector('.graph-search-controls');
      const switchers = document.body.querySelectorAll(
        '[aria-label="Quick switch Saved View"]',
      );
      const triggers = document.body.querySelectorAll(
        'button[aria-label="Manage Saved Views"]',
      );
      const search = container.querySelector('.entity-search');
      expect(searchRegion).not.toBeNull();
      expect(searchRegion?.children).toHaveLength(2);
      expect(searchRegion?.firstElementChild).toContain(switchers[0]);
      expect(searchRegion?.lastElementChild).toBe(search);
      expect(switchers).toHaveLength(1);
      expect(triggers).toHaveLength(1);
      (switchers[0] as HTMLSelectElement).focus();
      expect(document.activeElement).toBe(switchers[0]);
      (triggers[0] as HTMLButtonElement).focus();
      expect(document.activeElement).toBe(triggers[0]);
      const controls = triggers[0]!.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      await act(() => (triggers[0] as HTMLButtonElement).click());
      expect(document.getElementById(controls!)).not.toBeNull();
    },
  );

  it('keeps the single switcher structurally beside Search at 320px', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 320,
    });
    await mount();

    const region = container.querySelector('.graph-search-controls');
    const switcher = quickSwitch().closest('.saved-view-switcher');
    expect(region?.firstElementChild).toBe(switcher);
    expect(region?.lastElementChild).toBe(
      container.querySelector('.entity-search'),
    );
    expect(
      document.body.querySelectorAll('[aria-label="Manage Saved Views"]'),
    ).toHaveLength(1);
  });

  it('saves without projection or layout work and writes only the Named Saved Views registry', async () => {
    await mount();
    const before = performance.snapshot().operations;
    writes = [];
    await click('Manage Saved Views');
    const input =
      document.body.querySelector<HTMLInputElement>('.saved-views input')!;
    await act(() => {
      setControlValue(input, 'Current network');
    });
    await click('Save current view');
    const after = performance.snapshot().operations;
    expect(after['global-projections']).toBe(before['global-projections']);
    expect(after['global-layouts']).toBe(before['global-layouts']);
    expect(after['local-projections']).toBe(before['local-projections']);
    expect(writes).toEqual([savedViewStorageKey(snapshot.workspace.id)]);
    expect(
      JSON.parse(values.get(savedViewStorageKey(snapshot.workspace.id))!).views,
    ).toHaveLength(2);
  });

  it.each([false, true])(
    'opens Arguments from the shared toolbar without graph work in %s maximized mode',
    async (maximized) => {
      await mount(maximized);
      const workspace = container.querySelector('.graph-workspace');
      const before = performance.snapshot().operations;
      if (maximized) await click('Tools');

      await click('Arguments');

      expect(openArguments).toHaveBeenCalledOnce();
      expect(openArguments.mock.calls[0]?.[0]).toBeInstanceOf(
        HTMLButtonElement,
      );
      expect(container.querySelector('.graph-workspace')).toBe(workspace);
      const after = performance.snapshot().operations;
      expect(after['global-projections']).toBe(before['global-projections']);
      expect(after['global-layouts']).toBe(before['global-layouts']);
      expect(after['local-projections']).toBe(before['local-projections']);
      if (maximized) {
        expect(
          document.getElementById('graph-tools-panel')?.hasAttribute('hidden'),
        ).toBe(true);
      }
    },
  );

  it('retains an unsaved Arrange Folders draft instead of opening Arguments', async () => {
    await mount();
    await act(() =>
      captured.global!.folderArrangement?.onDraftDirtyChange?.(true),
    );

    await click('Arguments');

    expect(openArguments).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      'Apply or cancel the current spatial rule changes before leaving Arrange Folders.',
    );
  });

  it('avoids projection, layout, and viewport work for an exact semantic match', async () => {
    const exact = captureSavedView({
      name: 'Current exact view',
      workspace,
      state: currentState,
      presentationMode: 'global',
      layout: 'network',
      viewports: {
        global: { anchorEntityId: source.id, ratio: 0.35 },
      },
      preferences: DEFAULT_GRAPH_PREFERENCES,
      spatial: emptySpatial,
    });
    values.set(
      savedViewStorageKey(snapshot.workspace.id),
      serializeSavedViewRegistry({
        schemaVersion: 2,
        workspaceId: snapshot.workspace.id,
        views: [exact],
      }),
    );
    await mount();
    const before = performance.snapshot().operations;
    writes = [];

    await applyNamedTarget();

    const after = performance.snapshot().operations;
    expect(after['global-projections']).toBe(before['global-projections']);
    expect(after['global-layouts']).toBe(before['global-layouts']);
    expect(after['local-projections']).toBe(before['local-projections']);
    expect(captured.global?.centerRequest).toBeUndefined();
    expect(writes).toEqual([]);
    expect(
      transitionOverlay()?.querySelector('.saved-view-transition__title')
        ?.textContent,
    ).toBe('Current exact view');
  });

  it('derives an exact startup label without applying or writing a Saved View', async () => {
    const exact = captureSavedView({
      name: 'Startup exact',
      workspace,
      state: currentState,
      presentationMode: 'global',
      layout: 'network',
      viewports: {
        global: { anchorEntityId: source.id, ratio: 0.35 },
      },
      preferences: DEFAULT_GRAPH_PREFERENCES,
      spatial: emptySpatial,
    });
    values.set(
      savedViewStorageKey(snapshot.workspace.id),
      serializeSavedViewRegistry({
        schemaVersion: 2,
        workspaceId: snapshot.workspace.id,
        views: [exact],
      }),
    );
    writes = [];

    await mount();

    expect(mode()).toBe('global');
    expect(quickSwitch().value).toBe('Startup exact');
    expect(writes).toEqual([]);
    const transition = transitionOverlay();
    const transitionToken = transition?.dataset.savedViewTransitionToken;
    expect(transition?.dataset.savedViewTransitionOrigin).toBe('startup-match');
    expect(
      transition?.querySelector('.saved-view-transition__title')?.textContent,
    ).toBe('Startup exact');
    const operations = performance.snapshot().operations;

    await mount();

    expect(transitionOverlay()?.dataset.savedViewTransitionToken).toBe(
      transitionToken,
    );
    expect(performance.snapshot().operations).toEqual(operations);
    expect(writes).toEqual([]);
  });

  it('preserves a modified Current View at startup instead of reapplying a Saved View', async () => {
    const saved = captureSavedView({
      name: 'Older view',
      workspace,
      state: { ...currentState, filters: { query: 'kind:section' } },
      presentationMode: 'global',
      layout: 'network',
      viewports: {
        global: { anchorEntityId: source.id, ratio: 0.35 },
      },
      preferences: DEFAULT_GRAPH_PREFERENCES,
      spatial: emptySpatial,
    });
    values.set(
      savedViewStorageKey(snapshot.workspace.id),
      serializeSavedViewRegistry({
        schemaVersion: 2,
        workspaceId: snapshot.workspace.id,
        views: [saved],
      }),
    );
    const persistedCurrent = values.get(
      workspaceViewStorageKey(snapshot.workspace.id),
    );
    writes = [];

    await mount();

    expect(mode()).toBe('global');
    expect(quickSwitch().value).toBe('');
    expect(values.get(workspaceViewStorageKey(snapshot.workspace.id))).toBe(
      persistedCurrent,
    );
    expect(writes).toEqual([]);
    expect(transitionOverlay()).toBeNull();
  });

  it('commits an All Network preference and spatial profile before adopting it and leaves independent registries unchanged', async () => {
    const spatialKey = spatialOverrideStorageKey(snapshot.workspace.id);
    const targetSpatial = setFolderSpatialRule(emptySpatial, {
      folderKey: 'Architecture',
      behavior: 'pull',
      scope: {
        kind: 'subtree',
        includeRootFiles: true,
        excludedSubtrees: [],
      },
      anchor: { x: 0.5, y: -0.4 },
      strength: 76,
    });
    const currentPreferences = {
      ...DEFAULT_GRAPH_PREFERENCES,
      focusAppearance: 'outline' as const,
      showExperimentalAllHierarchy: true,
      trackpadZoomMode: 'pinch-zoom' as const,
    };
    const targetPreferences = {
      ...DEFAULT_GRAPH_PREFERENCES,
      globalLayoutSettings: {
        folderClustering: false,
        spacingPreset: 'spacious' as const,
        custom: {
          ...customGlobalLayoutSettings('spacious'),
          linkForce: 1.7,
          betweenFolderSpacing: 6.2,
          nodeSize: 7,
        },
      },
    };
    const target = captureSavedView({
      name: 'Spatial profile',
      workspace,
      state: currentState,
      presentationMode: 'global',
      layout: 'network',
      viewports: {
        global: { anchorEntityId: source.id, ratio: 0.35 },
      },
      preferences: targetPreferences,
      spatial: targetSpatial,
    });
    values.set(
      GRAPH_PREFERENCES_STORAGE_KEY,
      serializeGraphPreferences(currentPreferences),
    );
    values.set(spatialKey, serializeSpatialOverrideRegistry(emptySpatial));
    const independent = new Map([
      ['icarus-graph-explorer:visual-groups:test', 'groups'],
      ['icarus-graph-explorer:saved-filters:test', 'queries'],
      ['icarus-graph-explorer:presentation-overrides:test', 'sizes'],
    ]);
    for (const [key, value] of independent) values.set(key, value);
    values.set(
      savedViewStorageKey(snapshot.workspace.id),
      serializeSavedViewRegistry({
        schemaVersion: 2,
        workspaceId: snapshot.workspace.id,
        views: [target],
      }),
    );
    await mount();
    const beforeLayoutRequest = captured.global!.layoutRequestKey;
    writes = [];

    await quickApply('Spatial profile');

    expect(writes).toEqual([spatialKey, GRAPH_PREFERENCES_STORAGE_KEY]);
    expect(captured.global?.layoutRequestKey).toBe(beforeLayoutRequest + 1);
    expect(JSON.parse(values.get(spatialKey)!)).toEqual(targetSpatial);
    const persistedPreferences = JSON.parse(
      values.get(GRAPH_PREFERENCES_STORAGE_KEY)!,
    );
    expect(persistedPreferences.globalLayoutSettings).toEqual(
      targetPreferences.globalLayoutSettings,
    );
    expect(persistedPreferences.focusAppearance).toBe('outline');
    expect(persistedPreferences.showExperimentalAllHierarchy).toBe(true);
    expect(persistedPreferences.trackpadZoomMode).toBe('pinch-zoom');
    for (const [key, value] of independent) expect(values.get(key)).toBe(value);
    expect(quickSwitch().value).toBe('Spatial profile');
  });

  it('applies a visual-only All Network profile without projection, layout, or camera work', async () => {
    const visualPreferences = {
      ...DEFAULT_GRAPH_PREFERENCES,
      globalLayoutSettings: {
        folderClustering: true,
        spacingPreset: 'normal' as const,
        custom: {
          ...customGlobalLayoutSettings('normal'),
          nodeSize: 8,
          linkThickness: 1.6,
          labelThreshold: 11,
        },
      },
    };
    const visual = captureSavedView({
      name: 'Visual profile',
      workspace,
      state: currentState,
      presentationMode: 'global',
      layout: 'network',
      viewports: {
        global: { anchorEntityId: source.id, ratio: 0.35 },
      },
      preferences: visualPreferences,
      spatial: emptySpatial,
    });
    values.set(
      savedViewStorageKey(snapshot.workspace.id),
      serializeSavedViewRegistry({
        schemaVersion: 2,
        workspaceId: snapshot.workspace.id,
        views: [visual],
      }),
    );
    await mount();
    const before = performance.snapshot().operations;
    const beforeLayoutRequest = captured.global!.layoutRequestKey;
    writes = [];

    await quickApply('Visual profile');

    const after = performance.snapshot().operations;
    expect(after['global-projections']).toBe(before['global-projections']);
    expect(after['global-layouts']).toBe(before['global-layouts']);
    expect(after['spatial-pull-requests']).toBe(
      before['spatial-pull-requests'],
    );
    expect(captured.global?.layoutRequestKey).toBe(beforeLayoutRequest);
    expect(captured.global?.centerRequest).toBeUndefined();
    expect(writes).toEqual([GRAPH_PREFERENCES_STORAGE_KEY]);
    expect(
      JSON.parse(values.get(GRAPH_PREFERENCES_STORAGE_KEY)!)
        .globalLayoutSettings.custom.nodeSize,
    ).toBe(8);
  });
});
