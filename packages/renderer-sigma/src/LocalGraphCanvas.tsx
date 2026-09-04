import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ViewProjection } from '@icarus-graph-explorer/view-projection';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';

import { LocalLayoutCache } from './local-layout-cache';
import { DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH } from './local-density-framing';
import {
  createLocalLayoutRequest,
  localLayoutFingerprint,
  warmLocalRendererInput,
} from './local-layout';
import { mountLocalRendererSession } from './local-lifecycle';
import {
  mapProjectionToLocalTopology,
  seedLocalRendererInput,
} from './local-mapping';
import { LocalRendererSession } from './local-session';
import type {
  LocalCenterRequest,
  LocalDensityQaDiagnostics,
  LocalLayoutService,
  LocalRendererInstrumentation,
  LocalSelection,
  LocalTrackpadZoomMode,
  LocalTransitionAnchor,
  LocalTransitionAnchorApi,
  SemanticLocalViewport,
} from './local-types';
import { shouldApplyGlobalViewportRequest } from './viewport-request';

export interface LocalGraphCanvasProps {
  readonly centerRequest?: LocalCenterRequest;
  readonly fitRequestKey?: number;
  readonly initialTransitionAnchor?: LocalTransitionAnchor;
  readonly initialViewport?: SemanticLocalViewport;
  readonly instrumentation?: LocalRendererInstrumentation;
  readonly layoutCache?: LocalLayoutCache;
  readonly layoutRequestKey: number;
  readonly layoutService: LocalLayoutService;
  /** Transient Sandbox policy; excluded from layout input and fingerprinting. */
  readonly densityFramingStrength?: number;
  readonly onFailure: (message: string) => void;
  readonly onDensityQaDiagnosticsChange?: (
    diagnostics: LocalDensityQaDiagnostics | undefined,
  ) => void;
  readonly onFitRequestConsumed?: (key: number) => void;
  readonly onSelectionChange: (selection: LocalSelection | null) => void;
  readonly onNodeSingleClick?: (nodeId: string) => void;
  readonly onNodeActivate?: (entityId: string) => void;
  readonly onTransitionAnchorConsumed?: (key: number) => void;
  readonly onTransitionAnchorApiChange?: (
    api: LocalTransitionAnchorApi | undefined,
  ) => void;
  readonly onViewportObservation: (
    viewport: SemanticLocalViewport | undefined,
  ) => void;
  readonly projection: ViewProjection;
  readonly rootEntityId: string;
  readonly selection: LocalSelection | null;
  readonly trackpadZoomMode: LocalTrackpadZoomMode;
  /** Style-only EntityId lookup; excluded from topology and layout inputs. */
  readonly visualGroupStyles?: VisualGroupPresentationMap;
  /** Display-only File multipliers; never topology/layout/fingerprint inputs. */
  readonly presentationOverrides?: EntityPresentationOverrideMap;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function layoutIterations(nodeCount: number): number {
  return nodeCount <= 100 ? 160 : nodeCount <= 500 ? 100 : 60;
}

export function LocalGraphCanvas({
  centerRequest,
  densityFramingStrength = DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH,
  fitRequestKey,
  initialTransitionAnchor,
  initialViewport,
  instrumentation,
  layoutCache,
  layoutRequestKey,
  layoutService,
  onFailure,
  onDensityQaDiagnosticsChange,
  onFitRequestConsumed,
  onSelectionChange,
  onNodeSingleClick,
  onNodeActivate,
  onTransitionAnchorApiChange,
  onTransitionAnchorConsumed,
  onViewportObservation,
  projection,
  rootEntityId,
  selection,
  trackpadZoomMode,
  visualGroupStyles,
  presentationOverrides,
}: LocalGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<LocalRendererSession | undefined>(undefined);
  const [cache] = useState(() => layoutCache ?? new LocalLayoutCache());
  const handledCenterRequest = useRef(0);
  const handledFitRequest = useRef(0);
  const handledLayoutRequest = useRef(layoutRequestKey);
  const initialCacheAccepted = useRef(false);
  const layoutPending = useRef(true);
  const callbacks = useRef({
    onFailure,
    onDensityQaDiagnosticsChange,
    onFitRequestConsumed,
    onSelectionChange,
    onNodeSingleClick,
    onNodeActivate,
    onTransitionAnchorApiChange,
    onTransitionAnchorConsumed,
    onViewportObservation,
  });
  useEffect(() => {
    callbacks.current = {
      onFailure,
      onDensityQaDiagnosticsChange,
      onFitRequestConsumed,
      onSelectionChange,
      onNodeSingleClick,
      onNodeActivate,
      onTransitionAnchorApiChange,
      onTransitionAnchorConsumed,
      onViewportObservation,
    };
  }, [
    onFailure,
    onDensityQaDiagnosticsChange,
    onFitRequestConsumed,
    onSelectionChange,
    onNodeSingleClick,
    onNodeActivate,
    onTransitionAnchorApiChange,
    onTransitionAnchorConsumed,
    onViewportObservation,
  ]);

  const topology = useMemo(() => {
    const map = () => mapProjectionToLocalTopology(projection, rootEntityId);
    return instrumentation === undefined
      ? map()
      : instrumentation.measure('local-map', 'local-mappings', map);
  }, [instrumentation, projection, rootEntityId]);
  const input = useMemo(() => {
    const seed = () => seedLocalRendererInput(topology);
    return instrumentation === undefined
      ? seed()
      : instrumentation.measure('local-seed', 'local-seeds', seed);
  }, [instrumentation, topology]);
  const requestTemplate = useMemo(
    () => createLocalLayoutRequest(input, layoutIterations(input.nodes.length)),
    [input],
  );
  const fingerprint = useMemo(
    () => localLayoutFingerprint(requestTemplate),
    [requestTemplate],
  );
  const [initial] = useState(() => {
    const cached = cache.get(fingerprint);
    return {
      cached: cached !== undefined,
      cachedPositions: cached,
      densityFramingStrength,
      fingerprint,
      input:
        cached === undefined ? input : warmLocalRendererInput(input, cached),
      initialTransitionAnchor,
      initialViewport,
      trackpadZoomMode,
      visualGroupStyles,
      presentationOverrides,
    };
  });
  const appliedVisualGroupStyles = useRef(initial.visualGroupStyles);
  const appliedPresentationOverrides = useRef(initial.presentationOverrides);
  const [ready, setReady] = useState(false);
  const [layoutCommitKey, setLayoutCommitKey] = useState(0);
  const [layoutStatus, setLayoutStatus] = useState<string | undefined>(
    initial.cached ? undefined : 'Focus Network is ready; refining layout…',
  );
  const [layoutError, setLayoutError] = useState<string>();

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    let cancelled = false;
    const mounted = mountLocalRendererSession(
      () =>
        new LocalRendererSession(container, initial.input, {
          rootNodeKey: initial.input.rootNodeKey,
          densityFramingStrength: initial.densityFramingStrength,
          trackpadZoomMode: initial.trackpadZoomMode,
          ...(initial.presentationOverrides === undefined
            ? {}
            : { presentationOverrides: initial.presentationOverrides }),
          ...(initial.visualGroupStyles === undefined
            ? {}
            : { visualGroupStyles: initial.visualGroupStyles }),
          ...(initial.initialTransitionAnchor === undefined
            ? {}
            : {
                initialViewportPoint: initial.initialTransitionAnchor.point,
                initialViewportNodeKey: initial.initialTransitionAnchor.nodeId,
              }),
          ...(initial.initialViewport === undefined
            ? {}
            : { initialViewport: initial.initialViewport }),
          ...(initial.cachedPositions === undefined
            ? {}
            : { initialAcceptedPositions: initial.cachedPositions }),
          ...(instrumentation === undefined ? {} : { instrumentation }),
          onNodeSelected: (key) =>
            callbacks.current.onSelectionChange(
              key === undefined ? null : { kind: 'node', id: key },
            ),
          onNodeSingleClick: (key) =>
            callbacks.current.onNodeSingleClick?.(key),
          onNodeActivated: (entityId) =>
            callbacks.current.onNodeActivate?.(entityId),
          onDensityQaDiagnosticsChange: (diagnostics) =>
            callbacks.current.onDensityQaDiagnosticsChange?.(diagnostics),
          onViewportObservation: (viewport) =>
            callbacks.current.onViewportObservation(viewport),
        }),
    );
    if (!mounted.ok) {
      callbacks.current.onFailure(mounted.message);
      return;
    }
    sessionRef.current = mounted.session;
    callbacks.current.onTransitionAnchorApiChange?.({
      nodeViewportPoint: (nodeId) => mounted.session.nodeViewportPoint(nodeId),
      stageNodeAnchor: (nodeId) => mounted.session.stageNodeAnchor(nodeId),
    });
    if (initial.initialTransitionAnchor !== undefined) {
      callbacks.current.onTransitionAnchorConsumed?.(
        initial.initialTransitionAnchor.key,
      );
    }
    void mounted.session.ready
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) callbacks.current.onFailure(errorMessage(error));
      });
    return () => {
      cancelled = true;
      mounted.dispose();
      callbacks.current.onDensityQaDiagnosticsChange?.(undefined);
      callbacks.current.onTransitionAnchorApiChange?.(undefined);
      if (sessionRef.current === mounted.session)
        sessionRef.current = undefined;
    };
  }, [initial, instrumentation]);

  useEffect(() => {
    const session = sessionRef.current;
    if (session === undefined || input === initial.input) return;
    try {
      session.update(input);
    } catch (error: unknown) {
      callbacks.current.onFailure(errorMessage(error));
    }
  }, [initial.input, input]);

  useEffect(() => {
    sessionRef.current?.updateTrackpadZoomMode(trackpadZoomMode);
  }, [trackpadZoomMode]);

  useEffect(() => {
    sessionRef.current?.updateDensityFramingStrength(densityFramingStrength);
  }, [densityFramingStrength]);

  useEffect(() => {
    if (appliedVisualGroupStyles.current === visualGroupStyles) return;
    appliedVisualGroupStyles.current = visualGroupStyles;
    sessionRef.current?.setVisualGroupStyles(visualGroupStyles);
  }, [visualGroupStyles]);

  useEffect(() => {
    if (appliedPresentationOverrides.current === presentationOverrides) return;
    appliedPresentationOverrides.current = presentationOverrides;
    sessionRef.current?.setPresentationOverrides(presentationOverrides);
  }, [presentationOverrides]);

  useEffect(() => {
    sessionRef.current?.setControlledSelection(
      selection?.kind === 'node' ? selection.id : undefined,
    );
  }, [selection]);

  useEffect(() => {
    if (!ready) return;
    const session = sessionRef.current;
    if (session === undefined) return;
    layoutPending.current = true;
    const explicitRelayout = layoutRequestKey > handledLayoutRequest.current;
    handledLayoutRequest.current = layoutRequestKey;
    const cached = explicitRelayout ? undefined : cache.get(fingerprint);
    let cancelled = false;
    if (cached !== undefined) {
      if (
        !initialCacheAccepted.current &&
        initial.cachedPositions !== undefined &&
        fingerprint === initial.fingerprint
      ) {
        initialCacheAccepted.current = true;
        layoutPending.current = false;
        setLayoutError(undefined);
        setLayoutStatus(undefined);
        setLayoutCommitKey((current) => current + 1);
        return;
      }
      void session
        .applyPositions(cached)
        .then(() => {
          if (cancelled) return;
          layoutPending.current = false;
          setLayoutError(undefined);
          setLayoutStatus(undefined);
          setLayoutCommitKey((current) => current + 1);
        })
        .catch((error: unknown) => {
          if (!cancelled) callbacks.current.onFailure(errorMessage(error));
        });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (!cancelled) {
        setLayoutError(undefined);
        setLayoutStatus('Focus Network is ready; refining layout…');
      }
    });
    const request = session.createLayoutRequest(
      input,
      requestTemplate.iterations,
    );
    instrumentation?.count('local-layouts');
    void layoutService
      .layout(request)
      .then(async (result) => {
        if (cancelled) return;
        const applyStarted = performance.now();
        await session.applyPositions(result.positions);
        instrumentation?.record(
          'local-layout-apply',
          performance.now() - applyStarted,
        );
        if (cancelled) return;
        instrumentation?.record('local-layout-worker', result.computeMs);
        cache.set(fingerprint, result.positions);
        layoutPending.current = false;
        setLayoutStatus(undefined);
        setLayoutCommitKey((current) => current + 1);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = `Focus Network layout failed: ${errorMessage(error)}`;
        layoutPending.current = false;
        setLayoutError(message);
        setLayoutStatus(
          'The last valid Focus Network positions remain visible.',
        );
        setLayoutCommitKey((current) => current + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [
    cache,
    fingerprint,
    initial.cachedPositions,
    initial.fingerprint,
    input,
    instrumentation,
    layoutService,
    layoutRequestKey,
    ready,
    requestTemplate.iterations,
  ]);

  useEffect(() => {
    if (
      centerRequest === undefined ||
      !shouldApplyGlobalViewportRequest({
        handledKey: handledCenterRequest.current,
        layoutPending: layoutPending.current,
        ready,
        requestKey: centerRequest.key,
      })
    ) {
      return;
    }
    handledCenterRequest.current = centerRequest.key;
    void sessionRef.current?.center(centerRequest).catch((error: unknown) => {
      setLayoutError(`Could not center Local: ${errorMessage(error)}`);
    });
  }, [centerRequest, layoutCommitKey, ready]);

  useEffect(() => {
    if (
      fitRequestKey === undefined ||
      !shouldApplyGlobalViewportRequest({
        handledKey: handledFitRequest.current,
        layoutPending: layoutPending.current,
        ready,
        requestKey: fitRequestKey,
      })
    ) {
      return;
    }
    handledFitRequest.current = fitRequestKey;
    sessionRef.current?.fit();
    callbacks.current.onFitRequestConsumed?.(fitRequestKey);
  }, [fitRequestKey, layoutCommitKey, ready]);

  const zoomIn = useCallback(() => sessionRef.current?.zoomBy(0.82), []);
  const zoomOut = useCallback(() => sessionRef.current?.zoomBy(1.22), []);
  const fit = useCallback(() => sessionRef.current?.fit(), []);

  return (
    <div className="local-graph-canvas">
      <div className="local-graph-canvas__surface" ref={containerRef} />
      <div
        aria-label="Focus Network canvas controls"
        className="local-graph-canvas__controls"
        role="group"
      >
        <button aria-label="Zoom in" onClick={zoomIn} type="button">
          +
        </button>
        <button aria-label="Zoom out" onClick={zoomOut} type="button">
          −
        </button>
        <button onClick={fit} type="button">
          Fit
        </button>
      </div>
      {layoutStatus === undefined ? null : (
        <p
          aria-atomic="true"
          aria-live="polite"
          className="local-graph-canvas__status"
        >
          {layoutStatus}
        </p>
      )}
      {layoutError === undefined ? null : (
        <p className="local-graph-canvas__error" role="alert">
          {layoutError}
        </p>
      )}
    </div>
  );
}
