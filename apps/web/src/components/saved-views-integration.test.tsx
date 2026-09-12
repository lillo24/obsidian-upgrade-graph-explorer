// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import { createRuntimePerformanceRecorder } from '@icarus-graph-explorer/performance';
import type { GraphCanvasProps } from '@icarus-graph-explorer/renderer-reactflow';
import type { TemporaryFileMoveController } from '@icarus-graph-explorer/renderer-sigma';
import {
  createPersistedWorkspaceView,
  serializePersistedWorkspaceView,
} from '@icarus-graph-explorer/view-state';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
} from '@icarus-graph-explorer/view-projection';

import { GRAPH_PREFERENCES_STORAGE_KEY } from '../preferences/graph-preferences';
import { captureSavedView } from '../saved-view';
import {
  savedViewStorageKey,
  serializeSavedViewRegistry,
} from '../persistence/saved-views';
import { workspaceViewStorageKey } from '../persistence/storage';
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
});

describe('GraphExplorer Named Saved Views integration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let values: Map<string, string>;
  let writes: string[];
  let performance: ReturnType<typeof createRuntimePerformanceRecorder>;
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
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    values = new Map();
    writes = [];
    performance = createRuntimePerformanceRecorder({
      now: () => 0,
      markNextPaint: () => undefined,
    });
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
        schemaVersion: 1,
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
    await click('Saved Views');
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
      schemaVersion: 1,
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
    await click('Saved Views');
    await click('Apply');
    expect(mode()).toBe('global');
    expect(document.body.querySelector('.saved-views-popover')).not.toBeNull();
    expect(document.body.textContent).toContain(
      'Apply or cancel the current spatial rule changes before applying a Saved View.',
    );
  });

  it.each([false, true])(
    'exposes one accessible trigger with unique controls in %s maximized mode',
    async (maximized) => {
      await mount(maximized);
      const triggers = document.body.querySelectorAll(
        'button[aria-label="Saved Views"]',
      );
      expect(triggers).toHaveLength(1);
      const controls = triggers[0]!.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      await act(() => (triggers[0] as HTMLButtonElement).click());
      expect(document.getElementById(controls!)).not.toBeNull();
    },
  );

  it('saves without projection or layout work and writes only the Named Saved Views registry', async () => {
    await mount();
    const before = performance.snapshot().operations;
    writes = [];
    await click('Saved Views');
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
    });
    values.set(
      savedViewStorageKey(snapshot.workspace.id),
      serializeSavedViewRegistry({
        schemaVersion: 1,
        workspaceId: snapshot.workspace.id,
        views: [exact],
      }),
    );
    await mount();
    const before = performance.snapshot().operations;

    await applyNamedTarget();

    const after = performance.snapshot().operations;
    expect(after['global-projections']).toBe(before['global-projections']);
    expect(after['global-layouts']).toBe(before['global-layouts']);
    expect(after['local-projections']).toBe(before['local-projections']);
    expect(captured.global?.centerRequest).toBeUndefined();
  });
});
