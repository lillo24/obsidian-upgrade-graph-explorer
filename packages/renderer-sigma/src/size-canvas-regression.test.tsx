import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';
import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./canvas-test-harness')).canvasTestHooks,
}));
vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { CanvasTestHarness } from './canvas-test-harness';
import { SigmaTestRenderer } from './sigma-test-renderer';
import { GlobalGraphCanvas } from './GlobalGraphCanvas';
import { LocalGraphCanvas } from './LocalGraphCanvas';
import { GlobalLayoutCache } from './layout-cache';
import { LocalLayoutCache } from './local-layout-cache';
import * as globalLayout from './layout';
import * as localLayout from './local-layout';
import { globalTestProjection } from './test-fixture';
import type {
  GlobalLayoutRequest,
  GlobalLayoutResult,
  GlobalRendererInstrumentation,
} from './types';
import type { LocalRendererInstrumentation } from './local-types';

const sequence = [1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 2.5];
const noop = () => undefined;
const projection: ViewProjection = {
  ...globalTestProjection(),
  nodes: globalTestProjection()
    .nodes.slice(0, 3)
    .map((node, i) =>
      node.kind !== 'entity'
        ? node
        : { ...node, sourcePath: ['Source.md', 'Target.md', 'Note.md'][i]! },
    ),
  edges: globalTestProjection().edges.slice(0, 1),
};
const coordinates = (renderer: SigmaTestRenderer) =>
  renderer.graph.nodes().map((key) => ({
    key,
    x: renderer.graph.getNodeAttribute(key, 'x'),
    y: renderer.graph.getNodeAttribute(key, 'y'),
  }));

beforeEach(() => {
  SigmaTestRenderer.instances = [];
  vi.stubGlobal('window', {
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(['global', 'local'] as const)(
  '%s File-size canvas ownership',
  (mode) => {
    it.each([undefined, 1.5])(
      'submits zero layouts through rapid size edits and Reset (initial scale %s)',
      async (initialScale) => {
        let overrides: EntityPresentationOverrideMap | undefined =
          initialScale === undefined
            ? undefined
            : new Map([['doc-c', { sizeScale: initialScale }]]);
        let activeProjection = projection;
        const counts = new Map<string, number>();
        const instrumentation = {
          count: (operation: string) =>
            counts.set(operation, (counts.get(operation) ?? 0) + 1),
          measure: <T,>(
            _phase: string,
            operation: string | undefined,
            run: () => T,
          ): T => {
            if (operation !== undefined) instrumentation.count(operation);
            return run();
          },
          record: noop,
        };
        const layout = vi.fn(
          async (request: { nodes: GlobalLayoutRequest['nodes'] }) =>
            ({
              schemaVersion: 1,
              kind: 'result',
              requestId: 1,
              algorithm: 'reference-only',
              computeMs: 0,
              folderPriorMs: 0,
              positions: request.nodes.map((node, i) => ({
                key: node.key,
                x: node.x + i + 1,
                y: node.y - i,
              })),
              metrics: {
                meanWithinFolderDistance: 0,
                meanCrossFolderDistance: 0,
                meanCrossFolderReferenceLength: 0,
                meanDisplacementFromInput: 0,
              },
            }) as GlobalLayoutResult,
        );
        const layoutService = { layout, dispose: noop };
        const globalCache = new GlobalLayoutCache();
        const localCache = new LocalLayoutCache();
        const cache = mode === 'global' ? globalCache : localCache;
        const writes = vi.spyOn(cache, 'set');
        const settings = {
          folderClustering: false,
          spacingPreset: 'normal',
        } as const;
        const onFailure = vi.fn();
        const onSelectionChange = vi.fn();
        const requestTemplates =
          mode === 'global'
            ? vi.spyOn(globalLayout, 'createGlobalLayoutRequest')
            : vi.spyOn(localLayout, 'createLocalLayoutRequest');
        const fingerprints =
          mode === 'global'
            ? vi.spyOn(globalLayout, 'globalLayoutFingerprint')
            : vi.spyOn(localLayout, 'localLayoutFingerprint');
        const harness = new CanvasTestHarness(() =>
          mode === 'global'
            ? GlobalGraphCanvas({
                projection: activeProjection,
                settings,
                ...(overrides === undefined
                  ? {}
                  : { presentationOverrides: overrides }),
                fitRequestKey: 0,
                layoutRequestKey: 0,
                layoutService,
                layoutCache: globalCache,
                instrumentation:
                  instrumentation as GlobalRendererInstrumentation,
                onFailure,
                onNodeActivate: noop,
                onSelectionChange,
                onViewportObservation: noop,
                selection: null,
                trackpadZoomMode: 'pinch-zoom',
              })
            : LocalGraphCanvas({
                projection: activeProjection,
                rootEntityId: 'doc-a',
                ...(overrides === undefined
                  ? {}
                  : { presentationOverrides: overrides }),
                layoutRequestKey: 0,
                layoutService,
                layoutCache: localCache,
                instrumentation:
                  instrumentation as LocalRendererInstrumentation,
                onFailure,
                onSelectionChange,
                onViewportObservation: noop,
                selection: null,
                trackpadZoomMode: 'pinch-zoom',
              }),
        );
        await harness.flush();
        expect(onFailure).not.toHaveBeenCalled();
        expect(layout).toHaveBeenCalledTimes(1);
        const renderer = SigmaTestRenderer.instances[0]!;
        const cameraRatioBefore = renderer.camera.ratio;
        const before = coordinates(renderer);
        const distance = () =>
          Math.hypot(
            renderer.graph.getNodeAttribute('entity:doc-a', 'x') -
              renderer.graph.getNodeAttribute('entity:doc-b', 'x'),
            renderer.graph.getNodeAttribute('entity:doc-a', 'y') -
              renderer.graph.getNodeAttribute('entity:doc-b', 'y'),
          );
        const distanceBefore = distance();
        const templatesBefore = [...requestTemplates.mock.results];
        const fingerprintsBefore = [...fingerprints.mock.results];
        expect(fingerprintsBefore).toHaveLength(1);
        expect(templatesBefore.length).toBeGreaterThan(0);
        const countBefore = new Map(counts);
        const automaticSize = renderer.graph.getNodeAttribute(
          'entity:doc-c',
          'size',
        ) as number;
        expect(renderer.displayNodes.get('entity:doc-c')?.size).toBe(
          automaticSize * (initialScale ?? 1),
        );
        const snapshots = [];
        for (const sizeScale of sequence) {
          overrides = new Map([['doc-c', { sizeScale }]]);
          harness.invalidate();
          await harness.flush();
          snapshots.push({
            calls: layout.mock.calls.length,
            cameraRatio: renderer.camera.ratio,
            coordinates: coordinates(renderer),
            displayed: renderer.displayNodes.get('entity:doc-c')?.size,
          });
          expect(distance()).toBe(distanceBefore);
          // Observe the real canvas memo path, not a request with size stripped out.
          expect(requestTemplates.mock.results).toEqual(templatesBefore);
          expect(fingerprints.mock.results).toEqual(fingerprintsBefore);
        }
        // Original red sequence through 1.30: 1 -> 7 requests (1.00 hits cache).
        expect(snapshots.map((snapshot) => snapshot.calls)).toEqual(
          sequence.map(() => 1),
        );
        for (const [i, snapshot] of snapshots.entries()) {
          expect(snapshot.coordinates).toEqual(before);
          expect(snapshot.cameraRatio).toBe(cameraRatioBefore);
          expect(snapshot.displayed).toBeCloseTo(automaticSize * sequence[i]!);
        }
        expect(counts.get(`${mode}-layouts`)).toBe(
          countBefore.get(`${mode}-layouts`),
        );
        expect(counts.get(`${mode}-mappings`)).toBe(
          countBefore.get(`${mode}-mappings`),
        );
        expect(counts.get('local-seeds')).toBe(countBefore.get('local-seeds'));
        expect(counts.get('graphology-reconciliations')).toBe(
          countBefore.get('graphology-reconciliations'),
        );
        expect(counts.get('local-topology-reconciliations')).toBe(
          countBefore.get('local-topology-reconciliations'),
        );
        expect(counts.get('local-density-evaluations')).toBe(
          countBefore.get('local-density-evaluations'),
        );
        expect(writes).toHaveBeenCalledTimes(1);
        expect(onSelectionChange).not.toHaveBeenCalled();
        overrides = undefined;
        harness.invalidate();
        await harness.flush();
        expect(layout).toHaveBeenCalledTimes(1);
        expect(coordinates(renderer)).toEqual(before);
        expect(renderer.displayNodes.get('entity:doc-c')?.size).toBe(
          automaticSize,
        );
        expect(renderer.camera.ratio).toBe(cameraRatioBefore);
        expect(renderer.camera.setState.mock.calls.length).toBe(
          mode === 'global' ? 0 : 1,
        );
        // The same mounted canvas still submits work for a genuine topology edit.
        activeProjection = {
          ...projection,
          nodes: projection.nodes.slice(0, 2),
        };
        harness.invalidate();
        await harness.flush();
        expect(onFailure).not.toHaveBeenCalled();
        expect(layout).toHaveBeenCalledTimes(2);
        harness.destroy();
      },
    );
  },
);
