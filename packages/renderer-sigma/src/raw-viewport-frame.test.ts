import { describe, expect, it, vi } from 'vitest';
import type {
  CameraState,
  CoordinateConversionOverride,
  Coordinates,
} from 'sigma/types';
import {
  createNormalizationFunction,
  matrixFromCamera,
  multiplyVec2,
} from 'sigma/utils';

import {
  captureRawViewportFrame,
  refreshPreservingRawViewportFrame,
  restoreRawViewportFrame,
  type RawViewportFrame,
  type RawViewportRenderer,
} from './raw-viewport-frame';
import { computeGlobalSpatialInfluence } from './spatial-influence';
import type { GlobalSpatialInfluenceRequest } from './types';

type Extent = { readonly x: [number, number]; readonly y: [number, number] };

function extentOf(
  positions: readonly { readonly x: number; readonly y: number }[],
): Extent {
  return {
    x: [
      Math.min(...positions.map(({ x }) => x)),
      Math.max(...positions.map(({ x }) => x)),
    ],
    y: [
      Math.min(...positions.map(({ y }) => y)),
      Math.max(...positions.map(({ y }) => y)),
    ],
  };
}

function diagnosticPullRequest(): GlobalSpatialInfluenceRequest {
  return {
    schemaVersion: 1,
    requestId: 1,
    algorithm: 'interleaved-centroid',
    algorithmVersion: 1,
    baseLayoutFingerprint: 'raw-viewport-diagnostic',
    iterations: 24,
    globalLayoutSettings: {
      folderClustering: false,
      spacingPreset: 'normal',
    },
    nodes: [
      { key: 'selected-a', x: -5, y: -1, size: 1 },
      { key: 'selected-b', x: -4, y: 1, size: 1 },
      { key: 'connected-outside', x: -1, y: 0, size: 1 },
      { key: 'unrelated-a', x: 4, y: 2, size: 1 },
      { key: 'unrelated-b', x: 5, y: 2, size: 1 },
      { key: 'isolated', x: 0, y: 8, size: 1 },
    ],
    edges: [
      {
        key: 'selected',
        source: 'selected-a',
        target: 'selected-b',
        weight: 1,
      },
      {
        key: 'boundary',
        source: 'selected-b',
        target: 'connected-outside',
        weight: 2,
      },
      {
        key: 'unrelated',
        source: 'unrelated-a',
        target: 'unrelated-b',
        weight: 1,
      },
    ],
    attractors: [
      {
        ruleFolderKey: 'selected',
        memberNodeKeys: ['selected-a', 'selected-b'],
        targetX: 5,
        targetY: 0,
        strength: 70,
      },
    ],
  };
}

class SyntheticSigmaTransform implements RawViewportRenderer {
  private readonly dimensions = { width: 1_200, height: 800 };
  private extent: Extent;
  private normalization;
  private readonly cameraState: CameraState = {
    angle: 0.31,
    ratio: 0.64,
    x: 0.72,
    y: 0.24,
  };
  private readonly camera = {
    getBoundedRatio: (ratio: number) => Math.max(0.02, Math.min(6, ratio)),
    getState: () => ({ ...this.cameraState }),
    setState: (state: Partial<CameraState>) => {
      Object.assign(this.cameraState, state);
    },
  };

  constructor(extent: Extent) {
    this.extent = extent;
    this.normalization = createNormalizationFunction(extent);
  }

  setExtent(extent: Extent): void {
    this.extent = extent;
    this.normalization = createNormalizationFunction(extent);
  }

  getCamera() {
    return this.camera;
  }

  getDimensions() {
    return this.dimensions;
  }

  getGraphDimensions() {
    return {
      width: this.extent.x[1] - this.extent.x[0] || 1,
      height: this.extent.y[1] - this.extent.y[0] || 1,
    };
  }

  viewportToFramedGraph(
    point: Coordinates,
    override: CoordinateConversionOverride = {},
  ) {
    const dimensions = override.viewportDimensions ?? this.dimensions;
    const matrix =
      override.matrix ??
      matrixFromCamera(
        override.cameraState ?? this.cameraState,
        dimensions,
        override.graphDimensions ?? this.getGraphDimensions(),
        override.padding ?? 24,
        true,
      );
    return multiplyVec2(matrix, {
      x: (point.x / dimensions.width) * 2 - 1,
      y: 1 - (point.y / dimensions.height) * 2,
    });
  }

  private framedGraphToViewport(
    point: Coordinates,
    override: CoordinateConversionOverride = {},
  ) {
    const dimensions = override.viewportDimensions ?? this.dimensions;
    const matrix =
      override.matrix ??
      matrixFromCamera(
        override.cameraState ?? this.cameraState,
        dimensions,
        override.graphDimensions ?? this.getGraphDimensions(),
        override.padding ?? 24,
      );
    const projected = multiplyVec2(matrix, point);
    return {
      x: ((1 + projected.x) * dimensions.width) / 2,
      y: ((1 - projected.y) * dimensions.height) / 2,
    };
  }

  viewportToGraph(
    point: Coordinates,
    override: CoordinateConversionOverride = {},
  ) {
    return this.normalization.inverse(
      this.viewportToFramedGraph(point, override),
    );
  }

  graphToViewport(
    point: Coordinates,
    override: CoordinateConversionOverride = {},
  ) {
    return this.framedGraphToViewport(this.normalization(point), override);
  }
}

function expectFrameToMatch(
  renderer: RawViewportRenderer,
  expected: RawViewportFrame,
): void {
  const actual = captureRawViewportFrame(renderer);
  expect(actual.center.x).toBeCloseTo(expected.center.x, 5);
  expect(actual.center.y).toBeCloseTo(expected.center.y, 5);
  expect(actual.graphUnitsPerPixel).toBeCloseTo(expected.graphUnitsPerPixel, 6);
  expect(actual.angle).toBeCloseTo(expected.angle, 8);
}

describe('raw viewport framing across Sigma normalization', () => {
  it('reproduces the current camera jump when graph bounds change but framed camera numbers do not', () => {
    const renderer = new SyntheticSigmaTransform({
      x: [-4, 5],
      y: [-3, 6],
    });
    const before = captureRawViewportFrame(renderer);
    const cameraBefore = renderer.getCamera().getState();

    renderer.setExtent({ x: [-42, 16], y: [-9, 49] });

    const after = captureRawViewportFrame(renderer);
    expect(renderer.getCamera().getState()).toEqual(cameraBefore);
    expect(
      Math.hypot(
        after.center.x - before.center.x,
        after.center.y - before.center.y,
      ),
    ).toBeGreaterThan(5);
    expect(
      after.graphUnitsPerPixel / before.graphUnitsPerPixel,
    ).toBeGreaterThan(4);
  });

  it.each([
    ['Dynamic Pull', { x: [-42, 16], y: [-9, 49] }],
    ['Fixed Placement', { x: [-13, 31], y: [-25, 14] }],
    ['dynamic cache hit', { x: [-35, 22], y: [-17, 39] }],
    ['Remove the only Place rule', { x: [-8, 12], y: [-7, 10] }],
    ['Remove the only Pull rule', { x: [-7, 13], y: [-5, 11] }],
    ['Remove one rule while another remains', { x: [-9, 18], y: [-4, 15] }],
    ['Reset all rules', { x: [-4, 5], y: [-3, 6] }],
  ] satisfies readonly (readonly [string, Extent])[])(
    'preserves raw center, scale, and angle for %s adoption',
    (_label, nextExtent) => {
      const renderer = new SyntheticSigmaTransform({
        x: [-4, 5],
        y: [-3, 6],
      });
      const before = captureRawViewportFrame(renderer);

      renderer.setExtent(nextExtent);
      restoreRawViewportFrame(renderer, before);

      expectFrameToMatch(renderer, before);
    },
  );

  it('keeps a manually owned raw frame across an Apply then Remove round-trip', () => {
    const baseExtent: Extent = { x: [-4, 5], y: [-3, 6] };
    const appliedExtent: Extent = { x: [-37, 24], y: [-18, 45] };
    const renderer = new SyntheticSigmaTransform(baseExtent);
    const userFrame = captureRawViewportFrame(renderer);

    renderer.setExtent(appliedExtent);
    restoreRawViewportFrame(renderer, userFrame);
    expectFrameToMatch(renderer, userFrame);

    renderer.setExtent(baseExtent);
    restoreRawViewportFrame(renderer, userFrame);
    expectFrameToMatch(renderer, userFrame);
    expect(appliedExtent).not.toEqual(baseExtent);
  });

  it('keeps the viewport stable while the dynamic cluster and connected outside node still move visibly', () => {
    const renderer = new SyntheticSigmaTransform({
      x: [-4, 5],
      y: [-3, 6],
    });
    const beforeFrame = captureRawViewportFrame(renderer);
    const clusterBefore = renderer.graphToViewport({ x: 2, y: 1 });
    const outsideBefore = renderer.graphToViewport({ x: -3, y: 2 });

    renderer.setExtent({ x: [-42, 16], y: [-9, 49] });
    restoreRawViewportFrame(renderer, beforeFrame);

    const clusterAfter = renderer.graphToViewport({ x: 12, y: -6 });
    const outsideAfter = renderer.graphToViewport({ x: -15, y: 21 });
    expectFrameToMatch(renderer, beforeFrame);
    expect(
      Math.hypot(
        clusterAfter.x - clusterBefore.x,
        clusterAfter.y - clusterBefore.y,
      ),
    ).toBeGreaterThan(40);
    expect(
      Math.hypot(
        outsideAfter.x - outsideBefore.x,
        outsideAfter.y - outsideBefore.y,
      ),
    ).toBeGreaterThan(40);
  });

  it('records camera, viewport, grouped geometry, and bounds across the existing whole-graph Pull refinement', () => {
    const request = diagnosticPullRequest();
    const beforePositions = request.nodes.map(({ key, x, y }) => ({
      key,
      x,
      y,
    }));
    const renderer = new SyntheticSigmaTransform(extentOf(beforePositions));
    const beforeFrame = captureRawViewportFrame(renderer);
    const cameraBefore = renderer.getCamera().getState();

    const result = computeGlobalSpatialInfluence(request);
    renderer.setExtent(extentOf(result.positions));
    restoreRawViewportFrame(renderer, beforeFrame);

    const positionGroup = (keys: readonly string[], after: boolean) =>
      keys.map((key) => {
        const positions = after ? result.positions : beforePositions;
        return positions.find((position) => position.key === key)!;
      });
    const evidence = {
      rawViewport: {
        before: {
          center: beforeFrame.center,
          graphUnitsPer100px: beforeFrame.graphUnitsPerPixel * 100,
        },
        after: (() => {
          const frame = captureRawViewportFrame(renderer);
          return {
            center: frame.center,
            graphUnitsPer100px: frame.graphUnitsPerPixel * 100,
          };
        })(),
      },
      camera: {
        before: cameraBefore,
        after: renderer.getCamera().getState(),
      },
      selectedPullMembers: {
        before: positionGroup(['selected-a', 'selected-b'], false),
        after: positionGroup(['selected-a', 'selected-b'], true),
      },
      connectedOutside: {
        before: positionGroup(['connected-outside'], false),
        after: positionGroup(['connected-outside'], true),
      },
      unrelatedComponent: {
        before: positionGroup(['unrelated-a', 'unrelated-b'], false),
        after: positionGroup(['unrelated-a', 'unrelated-b'], true),
      },
      isolated: {
        before: positionGroup(['isolated'], false),
        after: positionGroup(['isolated'], true),
      },
      bounds: {
        before: extentOf(beforePositions),
        after: extentOf(result.positions),
      },
    };
    expectFrameToMatch(renderer, beforeFrame);
    expect(evidence.selectedPullMembers.after).not.toEqual(
      evidence.selectedPullMembers.before,
    );
    expect(evidence.connectedOutside.after).not.toEqual(
      evidence.connectedOutside.before,
    );
    // This is diagnostic evidence for PHYSICS1: SPATIAL2A currently refines
    // the whole graph, so even disconnected/isolated geometry can move.
    expect(evidence.unrelatedComponent.after).not.toEqual(
      evidence.unrelatedComponent.before,
    );
    expect(evidence.isolated.after).not.toEqual(evidence.isolated.before);
    expect(evidence.bounds.after).not.toEqual(evidence.bounds.before);
  });

  it('does not intercept later explicit Fit or Search-style camera ownership', () => {
    const renderer = new SyntheticSigmaTransform({
      x: [-4, 5],
      y: [-3, 6],
    });
    const before = captureRawViewportFrame(renderer);
    renderer.setExtent({ x: [-42, 16], y: [-9, 49] });
    restoreRawViewportFrame(renderer, before);

    renderer.getCamera().setState({ angle: 0, ratio: 1, x: 0.5, y: 0.5 });

    const explicitCameraFrame = captureRawViewportFrame(renderer);
    expect(
      Math.hypot(
        explicitCameraFrame.center.x - before.center.x,
        explicitCameraFrame.center.y - before.center.y,
      ),
    ).toBeGreaterThan(1);
  });

  it('restores after process and before the changed normalization is rendered', async () => {
    const order: string[] = [];
    let afterProcess: () => void = () => undefined;
    let afterRender: () => void = () => undefined;
    const promise = refreshPreservingRawViewportFrame(
      {
        afterProcess: (callback) => {
          order.push('arm-process');
          afterProcess = callback;
        },
        afterRender: (callback) => {
          order.push('arm-render');
          afterRender = callback;
        },
        removeAfterProcess: vi.fn(),
        removeAfterRender: vi.fn(),
        scheduleRefresh: () => {
          order.push('process');
          afterProcess();
          order.push('render');
          afterRender();
        },
      },
      () => order.push('mutate'),
      () => order.push('restore'),
    );

    await promise;
    expect(order).toEqual([
      'arm-process',
      'arm-render',
      'mutate',
      'process',
      'restore',
      'render',
    ]);
  });

  it('repairs the raw frame when Graphology processes synchronously during mutation', async () => {
    const order: string[] = [];
    let afterProcess: () => void = () => undefined;
    let afterRender: () => void = () => undefined;
    const scheduleRefresh = vi.fn();
    const promise = refreshPreservingRawViewportFrame(
      {
        afterProcess: (callback) => {
          order.push('arm-process');
          afterProcess = callback;
        },
        afterRender: (callback) => {
          order.push('arm-render');
          afterRender = callback;
        },
        removeAfterProcess: vi.fn(),
        removeAfterRender: vi.fn(),
        scheduleRefresh,
      },
      () => {
        order.push('mutate');
        order.push('process');
        afterProcess();
        order.push('render');
        afterRender();
      },
      () => order.push('restore'),
    );

    await promise;
    expect(order).toEqual([
      'arm-process',
      'arm-render',
      'mutate',
      'process',
      'restore',
      'render',
    ]);
    expect(scheduleRefresh).not.toHaveBeenCalled();
  });
});
