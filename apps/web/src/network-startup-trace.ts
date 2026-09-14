import type {
  NetworkStartupTrace,
  NetworkStartupTraceEntry,
} from '@icarus-graph-explorer/renderer-sigma';

export interface BrowserNetworkStartupTraceEntry extends NetworkStartupTraceEntry {
  readonly relativeMs: number;
}

export interface BrowserNetworkStartupTraceApi {
  readonly version: 1;
  readonly entries: BrowserNetworkStartupTraceEntry[];
  complete: boolean;
  summary?: NetworkStartupStabilitySummary;
}

export interface NetworkStartupStabilitySummary {
  readonly complete: boolean;
  readonly pass: boolean;
  readonly observationMs: number;
  readonly cameraCommandCount: number;
  readonly cameraMaxDelta: number;
  readonly customBBoxChanged: boolean;
  readonly rawNodeMaxDelta: number;
  readonly shellMaxDeltaPx: number;
  readonly rendererMaxDeltaPx: number;
  readonly nodeViewportMaxDeltaPx: number;
  readonly lodChanged: boolean;
  readonly windowResizeEvents: number;
}

declare global {
  interface Window {
    icarusNetworkStartupTrace?: BrowserNetworkStartupTraceApi;
  }
}

export interface BrowserNetworkStartupTraceSession {
  readonly api: BrowserNetworkStartupTraceApi;
  readonly trace: NetworkStartupTrace;
}

function maximumDelta<Value extends object>(
  left: Value | undefined,
  right: Value | undefined,
): number {
  if (left === undefined || right === undefined) {
    return left === right ? 0 : Number.POSITIVE_INFINITY;
  }
  return Math.max(
    ...Object.keys(left).map((key) => {
      const field = key as keyof Value;
      return Math.abs(Number(left[field]) - Number(right[field]));
    }),
  );
}

function extentChanged(
  left: NetworkStartupTraceEntry['customBBox'],
  right: NetworkStartupTraceEntry['customBBox'],
): boolean {
  return JSON.stringify(left) !== JSON.stringify(right);
}

export function summarizeNetworkStartupStability(
  entries: readonly NetworkStartupTraceEntry[],
  {
    allowExternalResize = false,
  }: { readonly allowExternalResize?: boolean } = {},
): NetworkStartupStabilitySummary {
  const revealIndex = entries.findIndex(
    ({ reason }) => reason === 'surface-reveal',
  );
  const endIndex = entries.findIndex(
    ({ reason }, index) =>
      index > revealIndex && reason === 'observation-complete',
  );
  if (revealIndex < 0 || endIndex < 0) {
    return {
      complete: false,
      pass: false,
      observationMs: 0,
      cameraCommandCount: 0,
      cameraMaxDelta: Number.POSITIVE_INFINITY,
      customBBoxChanged: true,
      rawNodeMaxDelta: Number.POSITIVE_INFINITY,
      shellMaxDeltaPx: Number.POSITIVE_INFINITY,
      rendererMaxDeltaPx: Number.POSITIVE_INFINITY,
      nodeViewportMaxDeltaPx: Number.POSITIVE_INFINITY,
      lodChanged: true,
      windowResizeEvents: 0,
    };
  }
  const reveal = entries[revealIndex]!;
  const observation = entries.slice(revealIndex, endIndex + 1);
  const revealNodes = new Map(
    (reveal.nodes ?? []).map((node) => [node.key, node]),
  );
  let cameraMaxDelta = 0;
  let customBBoxChanged = false;
  let rawNodeMaxDelta = 0;
  let shellMaxDeltaPx = 0;
  let rendererMaxDeltaPx = 0;
  let nodeViewportMaxDeltaPx = 0;
  for (const entry of observation) {
    cameraMaxDelta = Math.max(
      cameraMaxDelta,
      maximumDelta(reveal.camera, entry.camera),
    );
    customBBoxChanged ||= extentChanged(reveal.customBBox, entry.customBBox);
    rendererMaxDeltaPx = Math.max(
      rendererMaxDeltaPx,
      maximumDelta(reveal.rendererDimensions, entry.rendererDimensions),
    );
    for (const field of ['toolbar', 'stage', 'canvas', 'surface'] as const) {
      shellMaxDeltaPx = Math.max(
        shellMaxDeltaPx,
        maximumDelta(reveal.dom?.[field], entry.dom?.[field]),
      );
    }
    for (const node of entry.nodes ?? []) {
      const baseline = revealNodes.get(node.key);
      if (baseline === undefined) {
        rawNodeMaxDelta = Number.POSITIVE_INFINITY;
        nodeViewportMaxDeltaPx = Number.POSITIVE_INFINITY;
        continue;
      }
      rawNodeMaxDelta = Math.max(
        rawNodeMaxDelta,
        maximumDelta(baseline.raw, node.raw),
      );
      nodeViewportMaxDeltaPx = Math.max(
        nodeViewportMaxDeltaPx,
        maximumDelta(baseline.viewport, node.viewport),
      );
    }
  }
  const cameraCommandCount = observation.filter(
    ({ reason }) =>
      reason.startsWith('camera-command:') ||
      reason.startsWith('camera-write:'),
  ).length;
  const windowResizeEvents = observation.filter(
    ({ reason }) => reason === 'window-resize',
  ).length;
  const lodChanged = observation.some(({ lod }) => lod !== reveal.lod);
  const observationMs = Number(
    (
      entries[endIndex]!.timestampMs - entries[revealIndex]!.timestampMs
    ).toFixed(3),
  );
  const physicalStable = shellMaxDeltaPx <= 0.5 && rendererMaxDeltaPx <= 1;
  return {
    complete: true,
    pass:
      observationMs >= 300 &&
      cameraCommandCount === 0 &&
      cameraMaxDelta <= 1e-6 &&
      !customBBoxChanged &&
      rawNodeMaxDelta <= 1e-9 &&
      !lodChanged &&
      (allowExternalResize ||
        (windowResizeEvents === 0 &&
          physicalStable &&
          nodeViewportMaxDeltaPx <= 1)),
    observationMs,
    cameraCommandCount,
    cameraMaxDelta,
    customBBoxChanged,
    rawNodeMaxDelta,
    shellMaxDeltaPx,
    rendererMaxDeltaPx,
    nodeViewportMaxDeltaPx,
    lodChanged,
    windowResizeEvents,
  };
}

export function networkStartupCapabilityDelayMs(
  locationSearch = typeof window === 'undefined' ? '' : window.location.search,
): number {
  const parameters = new URLSearchParams(locationSearch);
  if (parameters.get('network-startup-trace') !== '1') return 0;
  const requested = Number(
    parameters.get('network-startup-capability-delay-ms') ?? '0',
  );
  return Number.isFinite(requested)
    ? Math.max(0, Math.min(2_000, requested))
    : 0;
}

/**
 * Enables a bounded, memory-only Network startup trace for browser/native QA.
 * The hook is absent unless the explicit query flag is present.
 */
export function createBrowserNetworkStartupTraceSession(
  locationSearch = typeof window === 'undefined' ? '' : window.location.search,
): BrowserNetworkStartupTraceSession | undefined {
  if (
    new URLSearchParams(locationSearch).get('network-startup-trace') !== '1'
  ) {
    return undefined;
  }
  const api: BrowserNetworkStartupTraceApi = {
    version: 1,
    entries: [],
    complete: false,
  };
  const traceElement =
    typeof document === 'undefined'
      ? undefined
      : document.createElement('script');
  if (traceElement !== undefined) {
    traceElement.id = 'network-startup-trace';
    traceElement.type = 'application/json';
    document.body.append(traceElement);
  }
  let origin: number | undefined;
  const trace: NetworkStartupTrace = (entry) => {
    if (api.complete && entry.reason !== 'session-created') return;
    if (entry.reason === 'session-created' && api.entries.length > 0) {
      api.entries.splice(0);
      api.complete = false;
      delete api.summary;
      origin = undefined;
    }
    origin ??= entry.timestampMs;
    api.entries.push({
      ...entry,
      relativeMs: Number((entry.timestampMs - origin).toFixed(3)),
    });
    if (entry.reason === 'observation-complete') {
      api.complete = true;
      api.summary = summarizeNetworkStartupStability(api.entries);
    }
    if (traceElement !== undefined)
      traceElement.textContent = JSON.stringify(api);
  };
  if (typeof window !== 'undefined') window.icarusNetworkStartupTrace = api;
  return { api, trace };
}

export const browserNetworkStartupTrace =
  createBrowserNetworkStartupTraceSession();
export const browserNetworkStartupCapabilityDelayMs =
  networkStartupCapabilityDelayMs();
