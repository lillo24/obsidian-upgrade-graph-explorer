import type {
  CameraState,
  CoordinateConversionOverride,
  Coordinates,
  Dimensions,
} from 'sigma/types';

const RAW_VIEWPORT_PROBE_PX = 100;

interface RawViewportCamera {
  getBoundedRatio(ratio: number): number;
  getState(): CameraState;
  setState(state: Partial<CameraState>): unknown;
}

export interface RawViewportRenderer {
  getCamera(): RawViewportCamera;
  getDimensions(): Dimensions;
  getGraphDimensions(): Dimensions;
  graphToViewport(
    point: Coordinates,
    override?: CoordinateConversionOverride,
  ): Coordinates;
  viewportToFramedGraph(
    point: Coordinates,
    override?: CoordinateConversionOverride,
  ): Coordinates;
  viewportToGraph(
    point: Coordinates,
    override?: CoordinateConversionOverride,
  ): Coordinates;
}

export interface RawViewportFrame {
  readonly angle: number;
  readonly center: Coordinates;
  readonly graphUnitsPerPixel: number;
}

function viewportProbe(dimensions: Dimensions) {
  const center = {
    x: dimensions.width / 2,
    y: dimensions.height / 2,
  };
  return {
    center,
    probe: { x: center.x + RAW_VIEWPORT_PROBE_PX, y: center.y },
  };
}

function rawGraphUnitsPerPixel(
  renderer: RawViewportRenderer,
  cameraState?: CameraState,
): number {
  const { center, probe } = viewportProbe(renderer.getDimensions());
  const graphDimensions = renderer.getGraphDimensions();
  const override =
    cameraState === undefined ? undefined : { cameraState, graphDimensions };
  const rawCenter = renderer.viewportToGraph(center, override);
  const rawProbe = renderer.viewportToGraph(probe, override);
  const scale =
    Math.hypot(rawProbe.x - rawCenter.x, rawProbe.y - rawCenter.y) /
    RAW_VIEWPORT_PROBE_PX;
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error('Sigma raw viewport scale is not positive and finite.');
  }
  return scale;
}

/** Captures the raw graph-space framing represented by the current viewport. */
export function captureRawViewportFrame(
  renderer: RawViewportRenderer,
): RawViewportFrame {
  const { center } = viewportProbe(renderer.getDimensions());
  const rawCenter = renderer.viewportToGraph(center);
  if (!Number.isFinite(rawCenter.x) || !Number.isFinite(rawCenter.y)) {
    throw new Error('Sigma raw viewport center is not finite.');
  }
  return {
    angle: renderer.getCamera().getState().angle,
    center: rawCenter,
    graphUnitsPerPixel: rawGraphUnitsPerPixel(renderer),
  };
}

/**
 * Restores a raw graph-space frame after Sigma has recomputed normalization.
 * Camera x/y remain framed coordinates, derived through Sigma's public
 * transforms rather than being confused with raw layout coordinates.
 */
export function restoreRawViewportFrame(
  renderer: RawViewportRenderer,
  frame: RawViewportFrame,
): void {
  const camera = renderer.getCamera();
  const currentState = { ...camera.getState(), angle: frame.angle };
  const currentScale = rawGraphUnitsPerPixel(renderer, currentState);
  const ratio = camera.getBoundedRatio(
    (currentState.ratio * frame.graphUnitsPerPixel) / currentScale,
  );
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error('Sigma restored camera ratio is not positive and finite.');
  }
  const graphDimensions = renderer.getGraphDimensions();
  const restoredState = { ...currentState, ratio };
  const rawCenterViewport = renderer.graphToViewport(frame.center, {
    cameraState: restoredState,
    graphDimensions,
  });
  const framedCenter = renderer.viewportToFramedGraph(rawCenterViewport, {
    cameraState: restoredState,
    graphDimensions,
  });
  camera.setState({
    angle: frame.angle,
    ratio,
    x: framedCenter.x,
    y: framedCenter.y,
  });
}
