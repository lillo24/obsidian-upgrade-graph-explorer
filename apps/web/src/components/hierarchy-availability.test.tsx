// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AddressableEntity,
  KnowledgeSnapshot,
} from '@icarus-graph-explorer/core';
import { createRuntimePerformanceRecorder } from '@icarus-graph-explorer/performance';
import { createFocusSchematicModel } from '@icarus-graph-explorer/focus-schematic';
import {
  FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
  FOCUS_SCHEMATIC_PRODUCTION_LAYOUT_SETTINGS,
  type FocusSchematicLayoutInput,
  type FocusSchematicProductLayoutPolicies,
} from '@icarus-graph-explorer/focus-schematic-layout';
import { handleFocusSchematicLayoutWorkerRequest } from '@icarus-graph-explorer/focus-schematic-layout/worker-runtime';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
} from '@icarus-graph-explorer/view-projection';
import {
  createPersistedWorkspaceView,
  serializePersistedWorkspaceView,
} from '@icarus-graph-explorer/view-state';
import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  focusSchematicNodeDimensions,
  prepareFocusSchematicRendererGraph,
} from '@icarus-graph-explorer/renderer-reactflow/focus-schematic';
import type {
  GraphCanvasProps,
  RendererGraph,
} from '@icarus-graph-explorer/renderer-reactflow';
import type { GlobalGraphViewProps } from './GlobalGraphView';
import type { LocalGraphViewProps } from './LocalGraphView';
import type { LocalStructuredGraphViewProps } from './LocalStructuredGraphView';
import type { ModularStructuredGraphViewProps } from './ModularStructuredGraphView';
import { GraphExplorer as GraphExplorerComponent } from './GraphExplorer';
import { GRAPH_PREFERENCES_STORAGE_KEY } from '../preferences/graph-preferences';
import { workspaceViewStorageKey } from '../persistence/storage';
import sampleReport from '../sample-report.json';
import { TEST_THEME_CONTROLLER } from '../theme/test-controller';

function GraphExplorer(
  props: Omit<ComponentProps<typeof GraphExplorerComponent>, 'theme'>,
) {
  return <GraphExplorerComponent {...props} theme={TEST_THEME_CONTROLLER} />;
}

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
const state = documentOnlyProjectionState();
const rerootEntities: readonly AddressableEntity[] = ['a', 'b', 'c'].map(
  (id) => ({
    id: `reroot-${id}`,
    kind: 'document',
    source: {
      path: `Folder/${id.toUpperCase()}.md`,
      span: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 2, column: 1, offset: 10 },
      },
    },
  }),
);
const rerootSnapshot: KnowledgeSnapshot = {
  schemaVersion: 1,
  workspace: { id: 'modular-reroot-regression' },
  entities: rerootEntities,
  references: [
    {
      id: 'reroot-a-b',
      sourceEntityId: 'reroot-a',
      kind: 'link',
      rawTarget: 'B',
      sourceSpan: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 2, offset: 1 },
      },
      resolution: { status: 'resolved', targetEntityId: 'reroot-b' },
    },
    {
      id: 'reroot-b-c',
      sourceEntityId: 'reroot-b',
      kind: 'link',
      rawTarget: 'C',
      sourceSpan: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 2, offset: 1 },
      },
      resolution: { status: 'resolved', targetEntityId: 'reroot-c' },
    },
  ],
};

function prepareModularGraph(
  props: ModularStructuredGraphViewProps,
): RendererGraph {
  const model = createFocusSchematicModel({
    workspace: props.projectionWorkspace,
    state: props.projectionState,
    projection: props.projection,
  });
  const input: FocusSchematicLayoutInput = {
    model,
    projection: props.projection,
    nodeDimensions: focusSchematicNodeDimensions(props.projection, model),
    settings: {
      ...FOCUS_SCHEMATIC_PRODUCTION_LAYOUT_SETTINGS,
      directionalFolderBandsEnabled: props.macroLayout === 'directional-bands',
      directionalFolderHierarchy: 'nested-one-level',
    },
  };
  const policies: FocusSchematicProductLayoutPolicies = {
    macroLayout: props.macroLayout,
    softFolderStrength: props.softFolderStrength,
    softFolderScopeMode: props.directFoldersOnly ? 'nearest-only' : 'nested',
    softAncestorDecayBase: props.softAncestorDecayBase,
    softFolderDisplayIntent: props.softFolderDisplayIntent,
    endpointOrderPolicy: props.endpointOrderPolicy,
    internalLayoutVariant: props.internalLayoutVariant,
  };
  let clock = 0;
  const response = handleFocusSchematicLayoutWorkerRequest(
    {
      protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
      requestId: 1,
      kind: 'layout',
      input,
      policies,
    },
    () => ++clock,
  );
  if (response.kind !== 'success') throw new Error(response.message);
  return prepareFocusSchematicRendererGraph({
    projection: props.projection,
    model,
    layoutInput: input,
    computedLayout: response.result,
    rootEntityId: props.rootEntityId,
    secondaryRelationshipsVisible: false,
    ...(props.routeStyle === undefined ? {} : { routeStyle: props.routeStyle }),
    visualVariant: 'extended',
  });
}

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
    focusHops: 1 | 2 | 3 = 1,
    mountedSnapshot: KnowledgeSnapshot = snapshot,
    mountedSource: AddressableEntity = source,
  ) {
    const mountedWorkspace = createProjectionWorkspace(mountedSnapshot);
    values.set(
      GRAPH_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        showExperimentalAllHierarchy: show,
        localLayoutMode,
        focusHierarchyImplementation,
      }),
    );
    values.set(
      workspaceViewStorageKey(mountedSnapshot.workspace.id),
      serializePersistedWorkspaceView(
        createPersistedWorkspaceView({
          workspace: mountedWorkspace,
          presentationMode: mode,
          state:
            mode === 'local'
              ? {
                  ...state,
                  focus: {
                    rootEntityId: mountedSource.id,
                    hops: focusHops,
                    direction: 'both',
                    hierarchyContext: 'ancestors',
                  },
                }
              : state,
          viewports: {
            structure: { anchorEntityId: mountedSource.id, zoom: 0.65 },
            global: { anchorEntityId: mountedSource.id, ratio: 0.4 },
          },
        }),
      ),
    );
    await act(async () =>
      root.render(
        <GraphExplorer
          snapshot={mountedSnapshot}
          storage={storage}
          identityStability="stable"
          {...(initialViewport === undefined ? {} : { initialViewport })}
          maximized={false}
          onMaximizedChange={() => undefined}
          performance={performance}
        />,
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });
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
    await act(async () => {
      button(name).click();
      await Promise.resolve();
    });
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
      expect(props?.theme).toBe('light');
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

  it('routes the shared maximized workspace owner into both Network renderers', async () => {
    await mount('global');
    expect(captured.global?.maximized).toBe(false);
    expect(captured.global?.onMaximizedChange).toEqual(expect.any(Function));

    await act(() => root.unmount());
    root = createRoot(container);
    await mount('local', false, undefined, 'free');
    expect(captured.local?.maximized).toBe(false);
    expect(captured.local?.onMaximizedChange).toEqual(expect.any(Function));
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

  it('arms direct File dragging and keeps Arrange Folders an exclusive explicit tool', async () => {
    await mount('global');
    expect(captured.global!.temporaryConstraintActive).toBe(true);
    expect(container.textContent).not.toContain('Move Files');
    expect(button('Arrange Folders')).toBeDefined();
    const cancel = vi.fn(() => false);
    await act(() =>
      captured.global!.onTemporaryFileMoveControllerChange?.({
        start: () => ({ status: 'started' }),
        nudge: () => true,
        release: () => true,
        cancel,
      }),
    );
    expect(captured.global!.folderArrangement?.active).toBe(false);

    await act(() =>
      captured.global!.onTemporaryFileMoveCapabilityChange?.({
        status: 'unavailable',
        reason: 'graph-too-large',
      }),
    );
    expect(container.textContent).toContain(
      'File movement supports up to 300 visible nodes in All Network in this release.',
    );

    await act(() =>
      captured.global!.onTemporaryFileMoveCapabilityChange?.({
        status: 'available',
      }),
    );
    await act(() =>
      captured.global!.onTemporaryFileMoveLifecycleChange?.('hot-constrained'),
    );
    expect(container.textContent).not.toContain('Moving…');
    await act(() =>
      captured.global!.onTemporaryFileMoveLifecycleChange?.('cooling'),
    );
    expect(container.textContent).toContain('Settling…');
    await act(() =>
      captured.global!.onTemporaryFileMoveLifecycleChange?.('sleeping'),
    );
    expect(container.textContent).not.toContain('Settled — ready to move.');
    await act(() =>
      captured.global!.onTemporaryFileMovePresentationChange?.('settling'),
    );
    expect(container.textContent).toContain('Settling…');
    await act(() =>
      captured.global!.onTemporaryFileMovePresentationChange?.('idle'),
    );
    expect(container.textContent).not.toContain('Settling…');

    await act(() =>
      captured.global!.folderArrangement?.onAvailabilityChange(true, undefined),
    );

    await click('Arrange Folders');
    expect(cancel).toHaveBeenCalledWith('mode-exit');
    expect(captured.global!.temporaryConstraintActive).toBe(false);
    expect(captured.global!.folderArrangement?.active).toBe(true);
    expect(captured.global!.folderArrangement?.activeFolderKey).toBeUndefined();
    expect(button('Arrange Folders').getAttribute('aria-pressed')).toBe('true');

    await click('Done');
    expect(captured.global!.temporaryConstraintActive).toBe(true);
    expect(captured.global!.folderArrangement?.active).toBe(false);
    expect(button('Arrange Folders')).toBeDefined();
  });

  it('keeps direct dragging armed across All and Focus Network only', async () => {
    await mount('global');

    await act(() => captured.global!.onNodeActivate(source.id));
    expect(mode()).toBe('local-free');
    expect(captured.local!.temporaryConstraintActive).toBe(true);
    await act(() =>
      captured.local!.onTemporaryFileMoveCapabilityChange?.({
        status: 'unavailable',
        reason: 'graph-too-large',
      }),
    );
    expect(container.textContent).toContain(
      'File movement supports up to 100 visible nodes in Focus Network in this release.',
    );
    await act(() =>
      captured.local!.onTemporaryFileMoveCapabilityChange?.({
        status: 'available',
      }),
    );
    expect(
      [...container.querySelectorAll('button')].some(
        (candidate) => candidate.textContent?.trim() === 'Arrange Folders',
      ),
    ).toBe(false);

    await click('Hierarchy');
    expect(mode()).toBe('local-structured');
    expect(
      [...container.querySelectorAll('button')].some(
        (candidate) =>
          candidate.getAttribute('aria-label') === 'Edit Network layout',
      ),
    ).toBe(false);

    await click('Network');
    expect(mode()).toBe('local-free');
    expect(captured.local!.temporaryConstraintActive).toBe(true);
  });

  it('retains the graph on Move failure and exposes explicit retry', async () => {
    await mount('global');
    const retryKey = captured.global!.temporaryConstraintRetryKey;

    await act(() =>
      captured.global!.onTemporaryFileMoveFailure?.('simulated worker failure'),
    );
    expect(mode()).toBe('global');
    expect(container.textContent).toContain(
      'File movement stopped: simulated worker failure',
    );
    expect(button('Retry Move')).toBeDefined();

    await click('Retry Move');
    expect(captured.global!.temporaryConstraintRetryKey).toBe(
      (retryKey ?? 0) + 1,
    );
    expect(mode()).toBe('global');
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
        .querySelector<HTMLInputElement>('input[value="pinch-zoom"]')!
        .click(),
    );
    expect(preference()).toMatchObject({
      showExperimentalAllHierarchy: true,
      trackpadZoomMode: 'pinch-zoom',
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
  it('R1-R4 reroots Modular File focus through non-empty prepared graphs and symmetric history', async () => {
    await mount(
      'local',
      false,
      undefined,
      'structured',
      'modular-preview',
      1,
      rerootSnapshot,
      rerootEntities[0]!,
    );
    const initialRoot = captured.modular!.rootEntityId;
    expect(prepareModularGraph(captured.modular!).nodes.length).toBeGreaterThan(
      0,
    );
    const firstTarget = captured.modular!.projection.nodes.find(
      (node) =>
        node.kind === 'entity' &&
        node.entityKind === 'document' &&
        node.entityId !== initialRoot,
    );
    if (firstTarget?.kind !== 'entity')
      throw new Error('Missing first connected File target.');

    await act(async () => {
      captured.modular!.onFocusEntity(firstTarget.entityId);
      await Promise.resolve();
    });
    const firstReroot = captured.modular!;
    expect(mode()).toBe('local-modular');
    expect(firstReroot.projectionState.focus?.rootEntityId).toBe(
      firstTarget.entityId,
    );
    expect(firstReroot.rootEntityId).toBe(firstTarget.entityId);
    expect(firstReroot.projection.nodes.length).toBeGreaterThan(0);
    expect(prepareModularGraph(firstReroot).nodes.length).toBeGreaterThan(0);
    expect(
      firstReroot.projection.nodes.some(
        ({ id }) => id === firstReroot.centerRequest?.nodeId,
      ),
    ).toBe(true);
    expect(firstReroot.selection).toEqual({
      kind: 'node',
      id: firstReroot.centerRequest!.nodeId,
    });

    await click('Back in graph history');
    expect(captured.modular!.rootEntityId).toBe(initialRoot);
    await click('Forward in graph history');
    expect(captured.modular!.rootEntityId).toBe(firstTarget.entityId);

    const secondTarget = captured.modular!.projection.nodes.find(
      (node) =>
        node.kind === 'entity' &&
        node.entityKind === 'document' &&
        node.entityId !== firstTarget.entityId &&
        node.entityId !== initialRoot,
    );
    if (secondTarget?.kind !== 'entity')
      throw new Error('Missing second connected File target.');
    await act(async () => {
      captured.modular!.onFocusEntity(secondTarget.entityId);
      await Promise.resolve();
    });
    expect(captured.modular!.rootEntityId).toBe(secondTarget.entityId);
    expect(prepareModularGraph(captured.modular!).nodes.length).toBeGreaterThan(
      0,
    );
    await click('Back in graph history');
    expect(captured.modular!.rootEntityId).toBe(firstTarget.entityId);
    await click('Forward in graph history');
    expect(captured.modular!.rootEntityId).toBe(secondTarget.entityId);
    const validatedGraph = captured.modular!;
    await act(async () => {
      captured.modular!.onFocusEntity('removed-file');
      await Promise.resolve();
    });
    expect(captured.modular!.rootEntityId).toBe(secondTarget.entityId);
    expect(captured.modular!.projection).toBe(validatedGraph.projection);
    expect(container.textContent).toContain(
      'Cannot navigate: entity "removed-file" is no longer present',
    );
  });

  it('S4-S9 keeps subfocus presentation-only and restores it with history shortcuts', async () => {
    await mount('local', false, undefined, 'structured', 'modular-preview');
    const sourceSections = snapshot.entities.filter(
      (entity) =>
        entity.kind === 'section' && entity.source.path === source.source.path,
    );
    const nested = sourceSections.find(
      (entity) => entity.kind === 'section' && entity.title === 'Nested',
    )!;
    await act(() => captured.navigate!(nested.id, 'Search Result'));
    const visibleSections = captured.modular!.projection.nodes.filter(
      (node) => node.kind === 'entity' && node.entityKind === 'section',
    );
    expect(visibleSections.length).toBeGreaterThanOrEqual(2);
    const [headingA, headingB] = visibleSections;
    if (headingA?.kind !== 'entity' || headingB?.kind !== 'entity')
      throw new Error('Missing visible Heading pair.');
    const projection = captured.modular!.projection;
    const projectionState = captured.modular!.projectionState;
    performance.reset();

    await act(() =>
      captured.modular!.onSubfocusEntity(headingA.entityId, 'section'),
    );
    expect(captured.modular!.focusHierarchySubfocus).toEqual({
      entityId: headingA.entityId,
      kind: 'section',
    });
    expect(captured.modular!.projection).toBe(projection);
    expect(captured.modular!.projectionState).toBe(projectionState);
    expect(performance.snapshot().operations['local-projections']).toBe(0);

    await act(() =>
      captured.modular!.onSubfocusEntity(headingB.entityId, 'section'),
    );
    await click('Back in graph history');
    expect(captured.modular!.focusHierarchySubfocus?.entityId).toBe(
      headingA.entityId,
    );
    const workspace = container.querySelector<HTMLElement>('.graph-workspace')!;
    await act(() =>
      workspace.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key: 'z',
        }),
      ),
    );
    expect(captured.modular!.focusHierarchySubfocus).toBeNull();
    await act(() =>
      workspace.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          shiftKey: true,
          key: 'z',
        }),
      ),
    );
    expect(captured.modular!.focusHierarchySubfocus?.entityId).toBe(
      headingA.entityId,
    );

    const input = document.createElement('input');
    workspace.append(input);
    const editableUndo = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'z',
    });
    await act(() => input.dispatchEvent(editableUndo));
    expect(editableUndo.defaultPrevented).toBe(false);
    expect(captured.modular!.focusHierarchySubfocus?.entityId).toBe(
      headingA.entityId,
    );

    await act(() =>
      workspace.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Escape',
        }),
      ),
    );
    expect(captured.modular!.focusHierarchySubfocus).toBeNull();
    await click('Forward in graph history');
    expect(captured.modular!.focusHierarchySubfocus?.entityId).toBe(
      headingA.entityId,
    );
    await click('Network');
    expect(mode()).toBe('local-free');
    await click('Hierarchy');
    expect(captured.modular!.focusHierarchySubfocus).toBeNull();
  });

  it('S9 clears subfocus for File reroot and Back restores both Focus and subfocus', async () => {
    await mount('local', false, undefined, 'structured', 'modular-preview');
    const heading = snapshot.entities.find(
      (entity) =>
        entity.kind === 'section' && entity.source.path === source.source.path,
    )!;
    await act(() => captured.navigate!(heading.id, 'Search Result'));
    await act(() => captured.modular!.onSubfocusEntity(heading.id, 'section'));
    const originalRoot = captured.modular!.rootEntityId;
    const file = captured.modular!.projection.nodes.find(
      (node) =>
        node.kind === 'entity' &&
        node.entityKind === 'document' &&
        node.entityId !== originalRoot,
    );
    if (file?.kind !== 'entity') throw new Error('Missing connected File.');

    await act(() => captured.modular!.onFocusEntity(file.entityId));
    expect(captured.modular!.rootEntityId).toBe(file.entityId);
    expect(captured.modular!.focusHierarchySubfocus).toBeNull();
    await click('Back in graph history');
    expect(captured.modular!.rootEntityId).toBe(originalRoot);
    expect(captured.modular!.focusHierarchySubfocus).toEqual({
      entityId: heading.id,
      kind: 'section',
    });
  });
  it('S10/S11 clears a removed live subfocus target without blanking Focus', async () => {
    await mount('local', false, undefined, 'structured', 'modular-preview');
    const block = snapshot.entities.find(
      (entity) =>
        entity.kind === 'block' && entity.source.path === source.source.path,
    )!;
    await act(() => captured.navigate!(block.id, 'Search Result'));
    await act(() => captured.modular!.onSubfocusEntity(block.id, 'block'));
    expect(captured.modular!.focusHierarchySubfocus?.entityId).toBe(block.id);

    const revisedSnapshot: KnowledgeSnapshot = {
      ...snapshot,
      entities: snapshot.entities.filter(({ id }) => id !== block.id),
      references: snapshot.references.filter(
        (reference) =>
          reference.sourceEntityId !== block.id &&
          !(
            reference.resolution.status === 'resolved' &&
            reference.resolution.targetEntityId === block.id
          ),
      ),
    };
    await act(async () => {
      root.render(
        <GraphExplorer
          snapshot={revisedSnapshot}
          storage={storage}
          identityStability="stable"
          maximized={false}
          onMaximizedChange={() => undefined}
          performance={performance}
        />,
      );
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mode()).toBe('local-modular');
    expect(captured.modular!.focusHierarchySubfocus).toBeNull();
    expect(captured.modular!.projection.nodes.length).toBeGreaterThan(0);
    expect(container.textContent).toContain(
      'subfocus is no longer projected and was cleared',
    );
  });
  it('drops a stale historical subfocus target while restoring the remaining checkpoint', async () => {
    await mount('local', false, undefined, 'structured', 'modular-preview');
    const block = snapshot.entities.find(
      (entity) =>
        entity.kind === 'block' && entity.source.path === source.source.path,
    )!;
    await act(() => captured.navigate!(block.id, 'Search Result'));
    await act(() => captured.modular!.onSubfocusEntity(block.id, 'block'));
    const originalRoot = captured.modular!.rootEntityId;
    const file = captured.modular!.projection.nodes.find(
      (node) =>
        node.kind === 'entity' &&
        node.entityKind === 'document' &&
        node.entityId !== originalRoot,
    );
    if (file?.kind !== 'entity') throw new Error('Missing connected File.');
    await act(() => captured.modular!.onFocusEntity(file.entityId));

    const revisedSnapshot: KnowledgeSnapshot = {
      ...snapshot,
      entities: snapshot.entities.filter(({ id }) => id !== block.id),
      references: snapshot.references.filter(
        (reference) =>
          reference.sourceEntityId !== block.id &&
          !(
            reference.resolution.status === 'resolved' &&
            reference.resolution.targetEntityId === block.id
          ),
      ),
    };
    await act(async () => {
      root.render(
        <GraphExplorer
          snapshot={revisedSnapshot}
          storage={storage}
          identityStability="stable"
          maximized={false}
          onMaximizedChange={() => undefined}
          performance={performance}
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await click('Back in graph history');

    expect(captured.modular!.rootEntityId).toBe(originalRoot);
    expect(captured.modular!.focusHierarchySubfocus).toBeNull();
    expect(captured.modular!.projection.nodes.length).toBeGreaterThan(0);
    expect(container.textContent).toContain(
      'saved Heading or Block subfocus is no longer visible and was dropped',
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
