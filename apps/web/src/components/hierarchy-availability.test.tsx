// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRuntimePerformanceRecorder } from '@icarus-graph-explorer/performance';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
} from '@icarus-graph-explorer/view-projection';
import {
  createPersistedWorkspaceView,
  serializePersistedWorkspaceView,
} from '@icarus-graph-explorer/view-state';
import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import type { GraphCanvasProps } from '@icarus-graph-explorer/renderer-reactflow';
import type { GlobalGraphViewProps } from './GlobalGraphView';
import type { LocalGraphViewProps } from './LocalGraphView';
import type { LocalStructuredGraphViewProps } from './LocalStructuredGraphView';
import type { ModularStructuredGraphViewProps } from './ModularStructuredGraphView';
import { GraphExplorer } from './GraphExplorer';
import { GRAPH_PREFERENCES_STORAGE_KEY } from '../preferences/graph-preferences';
import { workspaceViewStorageKey } from '../persistence/storage';
import sampleReport from '../sample-report.json';

const captured = vi.hoisted(() => ({
  global: undefined as GlobalGraphViewProps | undefined,
  local: undefined as LocalGraphViewProps | undefined,
  hierarchy: undefined as LocalStructuredGraphViewProps | undefined,
  modular: undefined as ModularStructuredGraphViewProps | undefined,
  structure: undefined as GraphCanvasProps | undefined,
  navigate: undefined as ((id: string, origin: string) => void) | undefined,
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
vi.mock('./ModularStructuredGraphView', () => ({
  default: (props: ModularStructuredGraphViewProps) => {
    captured.modular = props;
    return <div data-mode="local-modular" />;
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
// Capture the shared Search/Inspector navigation boundary; browser QA exercises
// the real search DOM. Projection, history, preferences and all callbacks are real.
vi.mock('./EntitySearch', () => ({
  EntitySearch: ({
    onNavigate,
  }: {
    onNavigate: (id: string, origin: string) => void;
  }) => {
    captured.navigate = onNavigate;
    return null;
  },
}));

const validation = validateObsidianDiagnosticReport(sampleReport);
if (!validation.valid) throw new Error('Invalid Synthetic Sample.');
const snapshot = validation.value.snapshot;
const source = snapshot.entities.find(
  (e) => e.kind === 'document' && e.source.path === 'Source.md',
)!;
const workspace = createProjectionWorkspace(snapshot);
const state = documentOnlyProjectionState();

describe('GraphExplorer experimental availability integration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let values: Map<string, string>;
  let performance: ReturnType<typeof createRuntimePerformanceRecorder>;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
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
    performance = createRuntimePerformanceRecorder({
      now: () => 0,
      markNextPaint: () => undefined,
    });
    captured.global = undefined;
    captured.local = undefined;
    captured.hierarchy = undefined;
    captured.modular = undefined;
    captured.structure = undefined;
  });
  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  async function mount(
    mode: 'global' | 'structure' | 'local' = 'global',
    show = false,
    initialViewport?: 'fit' | 'restore',
    localLayoutMode: 'free' | 'structured' = 'structured',
    focusHierarchyImplementation: 'classic' | 'modular-preview' = 'classic',
  ) {
    values.set(
      GRAPH_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        showExperimentalAllHierarchy: show,
        localLayoutMode,
        focusHierarchyImplementation,
      }),
    );
    values.set(
      workspaceViewStorageKey(snapshot.workspace.id),
      serializePersistedWorkspaceView(
        createPersistedWorkspaceView({
          workspace,
          presentationMode: mode,
          state:
            mode === 'local'
              ? {
                  ...state,
                  focus: {
                    rootEntityId: source.id,
                    hops: 1,
                    direction: 'both',
                    hierarchyContext: 'ancestors',
                  },
                }
              : state,
          viewports: {
            structure: { anchorEntityId: source.id, zoom: 0.65 },
            global: { anchorEntityId: source.id, ratio: 0.4 },
          },
        }),
      ),
    );
    await act(() =>
      root.render(
        <GraphExplorer
          snapshot={snapshot}
          storage={storage}
          identityStability="stable"
          {...(initialViewport === undefined ? {} : { initialViewport })}
          maximized={false}
          onMaximizedChange={() => undefined}
          performance={performance}
        />,
      ),
    );
  }
  function button(name: string) {
    const result = [...container.querySelectorAll('button')].find(
      (b) =>
        b.getAttribute('aria-label') === name ||
        b.textContent?.trim().replace(/^[\u25b8\u25be]\s*/, '') === name,
    );
    if (!result) throw new Error(`Missing test control ${name}`);
    return result;
  }
  async function click(name: string) {
    await act(() => button(name).click());
  }
  async function experimental(show: boolean) {
    if (!container.querySelector('#graph-settings-popover'))
      await click('Open Settings');
    if (!container.querySelector('#graph-experimental-controls'))
      await click('Experimental');
    const input = container.querySelector<HTMLInputElement>(
      '#graph-experimental-controls input[type="checkbox"]',
    )!;
    if (input.checked !== show) await act(() => input.click());
  }
  async function focusImplementation(
    implementation: 'classic' | 'modular-preview',
  ) {
    if (!container.querySelector('#graph-settings-popover'))
      await click('Open Settings');
    if (!container.querySelector('#graph-experimental-controls'))
      await click('Experimental');
    const input = container.querySelector<HTMLInputElement>(
      `#graph-experimental-controls input[value="${implementation}"]`,
    );
    if (input === null) throw new Error(`Missing ${implementation} radio.`);
    if (!input.checked)
      await act(async () => {
        input.click();
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
  }
  function mode() {
    return container.querySelector('[data-mode]')?.getAttribute('data-mode');
  }
  function preference() {
    return JSON.parse(values.get(GRAPH_PREFERENCES_STORAGE_KEY)!);
  }

  it.each(['global', 'structure', 'local'] as const)(
    'fits a fresh %s source session instead of restoring its stored camera',
    async (mode) => {
      await mount(mode, mode === 'structure', 'fit');
      const props =
        mode === 'global'
          ? captured.global
          : mode === 'structure'
            ? captured.structure
            : captured.hierarchy;

      expect(props?.fitRequestKey).toBe(1);
      expect(props?.centerRequest).toBeUndefined();
      expect(
        values.get(workspaceViewStorageKey(snapshot.workspace.id)),
      ).toContain('anchorEntityId');
      if (mode === 'global') {
        expect(captured.global?.initialViewport).toBeUndefined();
      }
    },
  );

  it('retires completed Global Fit and center intents at application scope', async () => {
    await mount('global', false, 'fit');
    expect(captured.global?.fitRequestKey).toBe(1);
    expect(captured.global?.automaticFitRequestKey).toBe(1);

    await act(() => captured.global?.onFitRequestConsumed?.(1));

    expect(captured.global?.fitRequestKey).toBe(0);
    expect(captured.global?.automaticFitRequestKey).toBeUndefined();

    await act(() => root.unmount());
    root = createRoot(container);
    await mount('global');
    expect(captured.global?.centerRequest?.key).toBe(1);

    await act(() => captured.global?.onCenterRequestConsumed?.(1));

    expect(captured.global?.centerRequest).toBeUndefined();
  });

  it('keeps All density strength transient and camera-only', async () => {
    await mount('global');
    expect(mode()).toBe('global');
    expect(captured.global!.densityFramingStrength).toBe(100);
    const layoutRequestKey = captured.global!.layoutRequestKey;

    await click('Open Settings');
    await click('Sandbox');
    const slider = container.querySelector<HTMLInputElement>(
      '#all-density-framing-strength',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(slider, '0');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(captured.global!.densityFramingStrength).toBe(0);
    expect(captured.global!.layoutRequestKey).toBe(layoutRequestKey);
    expect(preference()).not.toHaveProperty('allNetworkDensityFramingStrength');
    expect(performance.snapshot().operations['global-layouts']).toBe(0);
    expect(performance.snapshot().operations['spatial-pull-requests']).toBe(0);
  });

  it('keeps density strength transient and passes it to Focus Network without a layout request', async () => {
    await mount('local', false, undefined, 'free');
    expect(mode()).toBe('local-free');
    expect(captured.local!.densityFramingStrength).toBe(100);
    const layoutRequestKey = captured.local!.layoutRequestKey;

    await click('Open Settings');
    await click('Sandbox');
    const slider = container.querySelector<HTMLInputElement>(
      '#focus-density-framing-strength',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(slider, '0');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(captured.local!.densityFramingStrength).toBe(0);
    expect(captured.local!.layoutRequestKey).toBe(layoutRequestKey);
    expect(preference()).not.toHaveProperty('densityFramingStrength');

    await click('Reset Sandbox');
    expect(captured.local!.densityFramingStrength).toBe(100);
    expect(captured.local!.layoutRequestKey).toBe(layoutRequestKey);
    expect(preference()).not.toHaveProperty('densityFramingStrength');
  });

  it('reveals controls without projection work and preserves the flag when another preference changes', async () => {
    await mount();
    const projection = captured.global!.projection;
    performance.reset();
    await experimental(true);
    expect(mode()).toBe('global');
    expect(captured.structure).toBeUndefined();
    expect(captured.global!.projection).toBe(projection);
    expect(performance.snapshot().operations['projections']).toBe(0);
    expect(performance.snapshot().operations['global-projections']).toBe(0);
    expect(button('Hierarchy, experimental in All scope')).toBeDefined();
    await act(() =>
      container
        .querySelector<HTMLInputElement>('input[value="minimal"]')!
        .click(),
    );
    expect(preference()).toMatchObject({
      showExperimentalAllHierarchy: true,
      focusAppearance: 'minimal',
    });
    await experimental(false);
    expect(mode()).toBe('global');
    expect(performance.snapshot().operations['global-projections']).toBe(0);
  });
  it('disables active All Hierarchy once, retaining its semantic anchor and disclosure', async () => {
    await mount('structure', true);
    await experimental(false);
    expect(mode()).toBe('global');
    expect(preference().showExperimentalAllHierarchy).toBe(false);
    expect(container.textContent).toContain(
      'Experimental All Hierarchy hidden. Opened All Network.',
    );
    expect(captured.global!.centerRequest).toBeDefined();
    await experimental(true);
    await click('Close Settings');
    await click('Hierarchy, experimental in All scope');
    expect(mode()).toBe('structure');
    expect(captured.structure!.centerRequest?.zoom).toBe(0.65);
  });
  it('keeps Focus Hierarchy supported and returns to available All when no prior checkpoint exists', async () => {
    await mount('local');
    expect(mode()).toBe('local-structured');
    const projection = captured.hierarchy!.projection;
    performance.reset();
    await experimental(true);
    await experimental(false);
    expect(captured.hierarchy!.projection).toBe(projection);
    expect(performance.snapshot().operations['local-projections']).toBe(0);
    await click('Close Settings');
    await click('All');
    expect(mode()).toBe('global');
  });
  it('keeps Classic as the default and switches Modular Preview without graph history', async () => {
    await mount('local');
    expect(mode()).toBe('local-structured');
    const classicProjection = captured.hierarchy!.projection;
    await act(() =>
      captured.hierarchy!.onTransitionAnchorApiChange?.({
        nodeViewportPoint: () => ({ x: 120, y: 80 }),
        stageNodeAnchor: () => true,
      }),
    );
    await focusImplementation('modular-preview');
    expect(preference().focusHierarchyImplementation).toBe('modular-preview');
    expect(mode()).toBe('local-modular');
    expect(captured.modular!.projection).toBe(classicProjection);
    expect(captured.modular!.projectionState.focus?.rootEntityId).toBe(
      source.id,
    );
    expect(captured.modular!.initialTransitionAnchor).toMatchObject({
      point: { x: 120, y: 80 },
    });
    expect(button('Back in graph history').disabled).toBe(true);
    expect(preference().focusHierarchyImplementation).toBe('modular-preview');

    await focusImplementation('classic');
    expect(mode()).toBe('local-structured');
    expect(button('Back in graph history').disabled).toBe(true);
  });

  it('falls back to Classic for the session without rewriting the preview preference', async () => {
    await mount('local', false, undefined, 'structured', 'modular-preview');
    expect(mode()).toBe('local-modular');
    await act(() =>
      captured.modular!.onFatalFailure('synthetic worker failure'),
    );
    expect(mode()).toBe('local-structured');
    expect(preference().focusHierarchyImplementation).toBe('modular-preview');
    expect(container.textContent).toContain(
      'Classic Focus Hierarchy is active',
    );
  });
  it('normalizes the All Network → All Hierarchy → Focus history without duplicate Back steps', async () => {
    await mount();
    await experimental(true);
    await click('Close Settings');
    await click('Hierarchy, experimental in All scope');
    await act(() => captured.structure!.onFocusEntity!(source.id));
    expect(mode()).toBe('local-structured');
    await experimental(false);
    await click('Close Settings');
    await click('Back in graph history');
    expect(mode()).toBe('global');
    expect(button('Back in graph history').disabled).toBe(true);
    await click('Forward in graph history');
    expect(mode()).toBe('local-structured');
    await click('All');
    expect(mode()).toBe('global');
  });
  it.each(['section', 'block'] as const)(
    'routes exact %s Search/Inspector navigation through Focus Hierarchy',
    async (kind) => {
      await mount();
      const target = snapshot.entities.find((e) => e.kind === kind)!;
      await act(() => captured.navigate!(target.id, 'Search Result'));
      expect(mode()).toBe('local-structured');
      expect(container.textContent).toContain('Opened Focus Hierarchy');
      expect(container.textContent).not.toContain('Stayed in Focus');
      const props = captured.hierarchy!;
      expect(
        props.projection.nodes.find(
          (n) => n.id === props.centerRequest?.nodeId,
        ),
      ).toMatchObject({ entityId: target.id });
      expect(props.selection).toEqual({
        kind: 'node',
        id: props.centerRequest!.nodeId,
      });
      await click('Open Inspector');
      expect(container.textContent).not.toContain('Open full hierarchy');
    },
  );
  it('exposes All Hierarchy on Network failure without persistently enabling it', async () => {
    await mount();
    await act(() => captured.global!.onFailure('simulated load failure'));
    expect(mode()).toBe('structure');
    expect(preference().showExperimentalAllHierarchy).toBe(false);
    expect(button('Network').disabled).toBe(true);
    expect(button('Hierarchy, Network recovery')).toBeDefined();
    await experimental(true);
    await experimental(false);
    expect(mode()).toBe('structure');
    expect(container.textContent).toContain(
      'All Hierarchy remains visible because All Network is unavailable.',
    );
  });
  it('recovers failed Focus Network to supported Focus Hierarchy', async () => {
    await mount();
    await act(() => captured.global!.onNodeActivate(source.id));
    expect(mode()).toBe('local-free');
    await act(() => captured.local!.onFailure('simulated Focus failure'));
    expect(container.textContent).not.toContain('Open full hierarchy');
    await click('Open Focus Hierarchy');
    expect(mode()).toBe('local-structured');
  });
  it('closes Focus safely when a live revision removes the root', async () => {
    await mount('local');
    await act(() =>
      root.render(
        <GraphExplorer
          snapshot={{ ...snapshot, entities: [], references: [] }}
          storage={storage}
          identityStability="stable"
          maximized={false}
          onMaximizedChange={() => undefined}
          performance={performance}
        />,
      ),
    );
    expect(mode()).toBe('global');
    expect(container.textContent).toContain('Focus root was removed');
  });
});
