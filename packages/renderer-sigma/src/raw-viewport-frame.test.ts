import { describe, expect, it } from 'vitest';
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

type Extent = { readonly x: [number, number]; readonly y: [number, number] };

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
    ['Remove rule', { x: [-8, 12], y: [-7, 10] }],
    ['Reset rules', { x: [-4, 5], y: [-3, 6] }],
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
          afterProcess = callback;
        },
        afterRender: (callback) => {
          afterRender = callback;
        },
        scheduleRefresh: () => {
          order.push('process');
          afterProcess();
          order.push('render');
          afterRender();
        },
      },
      () => order.push('restore'),
    );

    await promise;
    expect(order).toEqual(['process', 'restore', 'render']);
  });
});
