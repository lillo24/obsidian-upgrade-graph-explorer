export type NetworkStartupTraceReason =
  | 'session-created'
  | 'layout-accepted'
  | 'spatial-generation-accepted'
  | 'initial-presentation-begin'
  | 'custom-bbox-write'
  | 'camera-write:initial-fit'
  | 'camera-write:raw-viewport-restore'
  | 'camera-write:density-framing'
  | 'camera-write:scene-replacement'
  | 'camera-write:viewport-anchor'
  | 'camera-write:initial-viewport-center'
  | 'camera-command:wheel-zoom'
  | 'camera-command:wheel-pan'
  | 'camera-command:density-strength'
  | 'camera-command:exercise'
  | 'camera-command:fit'
  | 'camera-command:center'
  | 'camera-command:zoom'
  | 'camera-changed'
  | 'lod-transition'
  | 'sigma-before-render'
  | 'sigma-after-render'
  | 'initial-presentation-ready'
  | 'surface-reveal'
  | 'layout-status-transition'
  | 'temporary-file-move-capability'
  | 'resize-observer'
  | 'window-resize'
  | 'animation-frame'
  | 'observation-complete';

export interface NetworkStartupRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface NetworkStartupCameraState {
  readonly x: number;
  readonly y: number;
  readonly ratio: number;
  readonly angle: number;
}

export interface NetworkStartupExtent {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
}

export interface NetworkStartupNodeSample {
  readonly key: string;
  readonly raw: { readonly x: number; readonly y: number };
  readonly viewport?: { readonly x: number; readonly y: number };
  readonly radius?: number;
}

export interface NetworkStartupNetworkState {
  readonly initialPresentationReady: boolean;
  readonly layoutPending: boolean;
  readonly finalGeometryGeneration: string;
  readonly layoutStatus?: string;
  readonly temporaryFileMoveCapability?: string;
}

export interface NetworkStartupTraceEntry {
  readonly timestampMs: number;
  readonly frame: number;
  readonly reason: NetworkStartupTraceReason;
  readonly window?: {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
  };
  readonly dom?: {
    readonly workspace?: NetworkStartupRect;
    readonly toolbar?: NetworkStartupRect;
    readonly toolbarRows?: number;
    readonly stage?: NetworkStartupRect;
    readonly canvas?: NetworkStartupRect;
    readonly surface?: NetworkStartupRect;
    readonly toolbarStatus?: string;
  };
  readonly rendererDimensions?: {
    readonly width: number;
    readonly height: number;
  };
  readonly camera?: NetworkStartupCameraState;
  readonly cameraOwnership?: 'auto' | 'user';
  readonly customBBox?: NetworkStartupExtent;
  readonly liveBBox?: NetworkStartupExtent;
  readonly nodes?: readonly NetworkStartupNodeSample[];
  readonly lod?: string;
  readonly network?: NetworkStartupNetworkState;
}

/** Opt-in, bounded startup diagnostics. Ordinary production sessions omit it. */
export type NetworkStartupTrace = (entry: NetworkStartupTraceEntry) => void;
