// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

import { GlobalGraphCanvas } from './GlobalGraphCanvas';
import { LocalGraphCanvas } from './LocalGraphCanvas';
import {
  createGlobalLayoutRequest,
  globalLayoutFingerprint,
  globalLayoutPositionsFromInput,
} from './layout';
import { GlobalLayoutCache } from './layout-cache';
import {
  createLocalLayoutRequest,
  localLayoutFingerprint,
} from './local-layout';
import { LocalLayoutCache } from './local-layout-cache';
import {
  mapProjectionToLocalTopology,
  seedLocalRendererInput,
} from './local-mapping';
import {
  DEFAULT_RESOLVED_NETWORK_SETTINGS,
  localLayoutSettingsFromNetworkSettings,
} from './local-network-settings';
import { localTestProjection } from './local-test-fixture';
import { mapProjectionToGlobalTopology } from './mapping';
import type { NetworkPhysicsServiceFactory } from './physics';
import { globalTestProjection } from './test-fixture';
import type {
  GlobalLayoutResult,
  GlobalLayoutService,
  LocalLayoutResult,
  LocalLayoutService,
} from './types';

const { globalApplySpatialPositions, globalCommitInitialPresentation } =
  vi.hoisted(() => ({
    globalApplySpatialPositions: vi.fn(async () => undefined),
    globalCommitInitialPresentation: vi.fn(async () => undefined),
  }));

vi.mock('./session', () => ({
  GlobalRendererSession: class {
    ready = Promise.resolve();
    applyPositions = vi.fn(async () => undefined);
    applySpatialPositions = globalApplySpatialPositions;
    commitInitialPresentation = globalCommitInitialPresentation;
    createLayoutRequest = createGlobalLayoutRequest;
    destroy = vi.fn();
    applyPartialPositions = vi.fn();
    setTemporaryFileMoveContext = vi.fn();
    setControlledSelection = vi.fn();
    update = vi.fn();
    updateSettings = vi.fn();
    updateTrackpadZoomMode = vi.fn();
  },
}));

vi.mock('./local-session', () => ({
  LocalRendererSession: class {
    ready = Promise.resolve();
    applyPositions = vi.fn(async () => undefined);
    commitInitialPresentation = vi.fn(async () => undefined);
    createLayoutRequest = (
      input: Parameters<typeof createLocalLayoutRequest>[0],
      networkSettings: Parameters<
        typeof localLayoutSettingsFromNetworkSettings
      >[0],
    ) =>
      createLocalLayoutRequest(
        input,
        localLayoutSettingsFromNetworkSettings(networkSettings),
      );
    destroy = vi.fn();
    applyPartialPositions = vi.fn();
    setTemporaryFileMoveContext = vi.fn();
    setControlledSelection = vi.fn();
    update = vi.fn();
    updateDensityFramingStrength = vi.fn();
    updateNetworkSettings = vi.fn();
    updateTrackpadZoomMode = vi.fn();
  },
}));

const globalSettings = {
  folderClustering: true,
  spacingPreset: 'normal',
} as const;

function networkProjection(nodeCount: number): ViewProjection {
  return {
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `entity:node-${index}`,
      kind: 'entity' as const,
      entityId: index === 0 ? 'root' : `node-${index}`,
      entityKind: 'document' as const,
      sourcePath: index === 0 ? 'Root.md' : `Folder/Node-${index}.md`,
      sourceStartLine: 1,
      title: null,
      revealableDescendantCount: 0,
      internalReferenceIds: [],
      role: 'content' as const,
      focusDistance: index === 0 ? 0 : 1,
    })),
    edges: [],
    issues: [],
  };
}

function globalCache(projection: ViewProjection): GlobalLayoutCache {
  const input = mapProjectionToGlobalTopology(projection);
  const request = createGlobalLayoutRequest(input, globalSettings);
  const cache = new GlobalLayoutCache();
  cache.set(
    globalLayoutFingerprint(request),
    globalLayoutPositionsFromInput(input),
  );
  return cache;
}

function localCache(projection: ViewProjection): LocalLayoutCache {
  const input = seedLocalRendererInput(
    mapProjectionToLocalTopology(projection, 'root'),
  );
  const request = createLocalLayoutRequest(
    input,
    localLayoutSettingsFromNetworkSettings(DEFAULT_RESOLVED_NETWORK_SETTINGS),
  );
  const cache = new LocalLayoutCache();
  cache.set(
    localLayoutFingerprint(request),
    request.nodes.map(({ key, x, y }) => ({ key, x, y })),
  );
  return cache;
}

describe.each(['global', 'local'] as const)(
  'visible %s layout status lifecycle',
  (mode) => {
    let container: HTMLDivElement;
    let root: Root;
    beforeEach(() => {
      vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
      globalCommitInitialPresentation.mockClear();
      container = document.createElement('div');
      document.body.append(container);
      root = createRoot(container);
    });
    afterEach(async () => {
      await act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    });

    async function mount() {
      let resolve!: (result: GlobalLayoutResult | LocalLayoutResult) => void;
      let reject!: (error: Error) => void;
      const layout = vi.fn(
        () =>
          new Promise<GlobalLayoutResult | LocalLayoutResult>((yes, no) => {
            resolve = yes;
            reject = no;
          }),
      );
      await act(() =>
        root.render(
          mode === 'global' ? (
            <GlobalGraphCanvas
              fitRequestKey={0}
              layoutRequestKey={0}
              layoutService={{
                dispose: vi.fn(),
                layout: layout as unknown as GlobalLayoutService['layout'],
              }}
              onFailure={vi.fn()}
              onNodeActivate={vi.fn()}
              onSelectionChange={vi.fn()}
              onViewportObservation={vi.fn()}
              projection={globalTestProjection()}
              selection={null}
              settings={{ folderClustering: true, spacingPreset: 'normal' }}
              trackpadZoomMode="pinch-zoom"
            />
          ) : (
            <LocalGraphCanvas
              layoutRequestKey={0}
              layoutService={{
                dispose: vi.fn(),
                layout: layout as unknown as LocalLayoutService['layout'],
              }}
              onFailure={vi.fn()}
              onSelectionChange={vi.fn()}
              onViewportObservation={vi.fn()}
              projection={localTestProjection()}
              rootEntityId="root"
              selection={null}
              trackpadZoomMode="pinch-zoom"
            />
          ),
        ),
      );
      expect(layout).toHaveBeenCalledTimes(1);
      return { resolve, reject };
    }

    it.each(['reference-only', 'fixed-total-field'] as const)(
      'shows progress and clears visible status after %s succeeds',
      async (algorithm) => {
        const pending = await mount();
        expect(container.textContent).toContain(
          mode === 'global' ? 'Refining All Network layout' : 'refining layout',
        );
        await act(() =>
          pending.resolve(
            mode === 'global'
              ? {
                  schemaVersion: 3,
                  kind: 'result',
                  requestId: 1,
                  positions: [],
                  computeMs: 1,
                  folderPriorMs: 0,
                  algorithm,
                  policyVersion: 'global-fa2-folder-convergence-v1',
                  macroVersion:
                    algorithm === 'reference-only'
                      ? 'global-folder-none-v1'
                      : 'global-folder-fixed-field-v1',
                  stopReason: 'degenerate',
                  iterationsCompleted: 0,
                  macroStepsCompleted: 0,
                  stableMacroSteps: 0,
                  finalMacroStepIterations: 0,
                  finalMovement: null,
                  metrics: {
                    meanWithinFolderDistance: 0,
                    meanCrossFolderDistance: 0,
                    meanCrossFolderReferenceLength: 0,
                    meanDisplacementFromInput: 0,
                  },
                }
              : {
                  schemaVersion: 2,
                  kind: 'result',
                  requestId: 1,
                  stopReason: 'degenerate',
                  policyVersion: 'local-fa2-convergence-v1',
                  iterationsCompleted: 0,
                  batchesCompleted: 0,
                  stableBatches: 0,
                  finalMovement: null,
                  positions: [],
                  computeMs: 1,
                },
          ),
        );
        expect(
          container.querySelector(`.${mode}-graph-canvas__status`),
        ).toBeNull();
        expect(container.querySelector('[role="alert"]')).toBeNull();
        if (mode === 'global') {
          expect(globalCommitInitialPresentation).not.toHaveBeenCalled();
        }
      },
    );

    it('keeps the failure and recovery information visible', async () => {
      const pending = await mount();
      await act(() => pending.reject(new Error('worker unavailable')));
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        `${mode === 'global' ? 'All' : 'Focus'} Network layout failed: worker unavailable`,
      );
      expect(container.textContent).toContain(
        `The last valid ${mode === 'global' ? 'All' : 'Focus'} Network positions remain visible.`,
      );
    });
  },
);

describe.each([
  ['global', 300, 'available'],
  ['global', 301, 'graph-too-large'],
  ['local', 100, 'available'],
  ['local', 101, 'graph-too-large'],
] as const)(
  '%s Move capability at %i visible nodes',
  (mode, nodeCount, result) => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
      container = document.createElement('div');
      document.body.append(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    });

    it('uses the mode-specific boundary before initializing dormant physics', async () => {
      const projection = networkProjection(nodeCount);
      const initialize = vi.fn();
      const begin = vi.fn();
      const physicsServiceFactory: NetworkPhysicsServiceFactory = () => ({
        begin,
        update: vi.fn(),
        end: vi.fn(),
        initialize,
        invalidate: vi.fn(),
        dispose: vi.fn(),
      });
      const onCapability = vi.fn();

      await act(async () => {
        root.render(
          mode === 'global' ? (
            <GlobalGraphCanvas
              fitRequestKey={0}
              layoutCache={globalCache(projection)}
              layoutRequestKey={0}
              layoutService={{ dispose: vi.fn(), layout: vi.fn() }}
              onFailure={vi.fn()}
              onNodeActivate={vi.fn()}
              onSelectionChange={vi.fn()}
              onTemporaryFileMoveCapabilityChange={onCapability}
              onViewportObservation={vi.fn()}
              physicsServiceFactory={physicsServiceFactory}
              projection={projection}
              selection={null}
              settings={globalSettings}
              temporaryConstraintActive
              trackpadZoomMode="pinch-zoom"
            />
          ) : (
            <LocalGraphCanvas
              layoutCache={localCache(projection)}
              layoutRequestKey={0}
              layoutService={{ dispose: vi.fn(), layout: vi.fn() }}
              onFailure={vi.fn()}
              onSelectionChange={vi.fn()}
              onTemporaryFileMoveCapabilityChange={onCapability}
              onViewportObservation={vi.fn()}
              physicsServiceFactory={physicsServiceFactory}
              projection={projection}
              rootEntityId="root"
              selection={null}
              temporaryConstraintActive
              trackpadZoomMode="pinch-zoom"
            />
          ),
        );
        for (let turn = 0; turn < 6; turn += 1) await Promise.resolve();
      });

      expect(onCapability).toHaveBeenLastCalledWith(
        result === 'available'
          ? { status: 'available' }
          : { status: 'unavailable', reason: 'graph-too-large' },
      );
      expect(initialize).toHaveBeenCalledTimes(result === 'available' ? 1 : 0);
      expect(begin).not.toHaveBeenCalled();
    });
  },
);

describe('empty Global layout generation', () => {
  it('waits for a non-empty source without requesting or framing a layout', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    globalCommitInitialPresentation.mockClear();
    globalApplySpatialPositions.mockClear();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const layout = vi.fn();
    const onFailure = vi.fn();

    await act(() =>
      root.render(
        <GlobalGraphCanvas
          fitRequestKey={0}
          layoutRequestKey={0}
          layoutService={{ dispose: vi.fn(), layout }}
          onFailure={onFailure}
          onNodeActivate={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportObservation={vi.fn()}
          projection={{ nodes: [], edges: [], issues: [] }}
          selection={null}
          settings={{ folderClustering: true, spacingPreset: 'normal' }}
          spatialRules={[]}
          trackpadZoomMode="pinch-zoom"
        />,
      ),
    );

    expect(layout).not.toHaveBeenCalled();
    expect(globalApplySpatialPositions).not.toHaveBeenCalled();
    expect(globalCommitInitialPresentation).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();

    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
});
