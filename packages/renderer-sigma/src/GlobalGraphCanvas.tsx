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

import { GlobalLayoutCache } from './layout-cache';
import {
  createGlobalLayoutRequest,
  globalLayoutFingerprint,
  warmGlobalRendererInput,
} from './layout';
import { mountGlobalRendererSession } from './lifecycle';
import { mapProjectionToGlobal } from './mapping';
import { GlobalRendererSession } from './session';
import { shouldApplyGlobalViewportRequest } from './viewport-request';
import type {
  GlobalCenterRequest,
  GlobalLayoutService,
  GlobalLayoutSettings,
  GlobalRendererInstrumentation,
  GlobalSelection,
  GlobalTrackpadZoomMode,
  GlobalTransitionAnchorApi,
  SemanticGlobalViewport,
} from './types';

export interface GlobalGraphCanvasProps {
  readonly centerRequest?: GlobalCenterRequest;
  readonly fitRequestKey: number;
  readonly initialViewport?: SemanticGlobalViewport;
  readonly instrumentation?: GlobalRendererInstrumentation;
  readonly layoutRequestKey: number;
  /** Optional session cache owner; the lazy web module keeps this across mode switches. */
  readonly layoutCache?: GlobalLayoutCache;
  readonly layoutService: GlobalLayoutService;
  readonly onFailure: (message: string) => void;
  readonly onNodeActivate: (entityId: string) => void;
  readonly onSelectionChange: (selection: GlobalSelection | null) => void;
  readonly onTransitionAnchorApiChange?: (
    api: GlobalTransitionAnchorApi | undefined,
  ) => void;
  readonly onViewportObservation: (
    viewport: SemanticGlobalViewport | undefined,
  ) => void;
  readonly projection: ViewProjection;
  readonly selection: GlobalSelection | null;
  readonly settings: GlobalLayoutSettings;
  readonly trackpadZoomMode: GlobalTrackpadZoomMode;
  /** Style-only EntityId lookup; excluded from mapping and layout inputs. */
  readonly visualGroupStyles?: VisualGroupPresentationMap;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function layoutIterations(nodeCount: number): number {
  return nodeCount <= 1_000 ? 100 : nodeCount <= 5_000 ? 30 : 20;
}

export function GlobalGraphCanvas({
  centerRequest,
  fitRequestKey,
  initialViewport,
  instrumentation,
  layoutRequestKey,
  layoutCache,
  layoutService,
  onFailure,
  onNodeActivate,
  onSelectionChange,
  onTransitionAnchorApiChange,
  onViewportObservation,
  projection,
  selection,
  settings,
  trackpadZoomMode,
  visualGroupStyles,
}: GlobalGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<GlobalRendererSession | undefined>(undefined);
  const [cache] = useState(() => layoutCache ?? new GlobalLayoutCache());
  const handledCenterRequest = useRef(0);
  const handledFitRequest = useRef(0);
  const handledLayoutRequest = useRef(layoutRequestKey);
  const layoutPending = useRef(true);
  const callbacks = useRef({
    onFailure,
    onNodeActivate,
    onSelectionChange,
    onViewportObservation,
  });
  useEffect(() => {
    callbacks.current = {
      onFailure,
      onNodeActivate,
      onSelectionChange,
      onViewportObservation,
    };
  }, [onFailure, onNodeActivate, onSelectionChange, onViewportObservation]);
  const input = useMemo(() => {
    const map = () => mapProjectionToGlobal(projection, settings);
    return instrumentation === undefined
      ? map()
      : instrumentation.measure('global-map', 'global-mappings', map);
  }, [instrumentation, projection, settings]);
  const requestTemplate = useMemo(
    () =>
      createGlobalLayoutRequest(
        input,
        settings,
        layoutIterations(input.nodes.length),
      ),
    [input, settings],
  );
  const fingerprint = useMemo(
    () => globalLayoutFingerprint(requestTemplate),
    [requestTemplate],
  );
  const [initial] = useState(() => {
    const cached = cache.get(fingerprint);
    return {
      cached: cached !== undefined,
      initialViewport,
      input:
        cached === undefined ? input : warmGlobalRendererInput(input, cached),
      settings,
      trackpadZoomMode,
      visualGroupStyles,
    };
  });
  const appliedVisualGroupStyles = useRef(initial.visualGroupStyles);
  const [ready, setReady] = useState(false);
  const [layoutCommitKey, setLayoutCommitKey] = useState(0);
  const [layoutStatus, setLayoutStatus] = useState(
    initial.cached
      ? 'Global layout restored from the in-memory cache.'
      : 'Preparing Global layout…',
  );
  const [layoutError, setLayoutError] = useState<string>();

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    let cancelled = false;
    const mounted = mountGlobalRendererSession(
      () =>
        new GlobalRendererSession(container, initial.input, {
          settings: initial.settings,
          trackpadZoomMode: initial.trackpadZoomMode,
          ...(initial.visualGroupStyles === undefined
            ? {}
            : { visualGroupStyles: initial.visualGroupStyles }),
          ...(initial.initialViewport === undefined
            ? {}
            : { initialViewport: initial.initialViewport }),
          ...(instrumentation === undefined ? {} : { instrumentation }),
          onNodeSelected: (key) =>
            callbacks.current.onSelectionChange(
              key === undefined ? null : { kind: 'node', id: key },
            ),
          onNodeActivated: (_key, attributes) => {
            if (attributes.entityId !== null) {
              callbacks.current.onNodeActivate(attributes.entityId);
            }
          },
          onViewportObservation: (viewport) =>
            callbacks.current.onViewportObservation(viewport),
        }),
    );
    if (!mounted.ok) {
      callbacks.current.onFailure(mounted.message);
      return;
    }
    const { lease } = mounted;
    const { session } = lease;
    sessionRef.current = session;
    onTransitionAnchorApiChange?.({
      nodeViewportPoint: (nodeId) => session.nodeViewportPoint(nodeId),
    });
    void session.ready
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) callbacks.current.onFailure(errorMessage(error));
      });
    return () => {
      cancelled = true;
      lease.dispose();
      onTransitionAnchorApiChange?.(undefined);
      if (sessionRef.current === session) sessionRef.current = undefined;
    };
  }, [initial, instrumentation, onTransitionAnchorApiChange]);

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
    const session = sessionRef.current;
    if (session === undefined) return;
    session.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    sessionRef.current?.updateTrackpadZoomMode(trackpadZoomMode);
  }, [trackpadZoomMode]);

  useEffect(() => {
    if (appliedVisualGroupStyles.current === visualGroupStyles) return;
    appliedVisualGroupStyles.current = visualGroupStyles;
    sessionRef.current?.setVisualGroupStyles(visualGroupStyles);
  }, [visualGroupStyles]);

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
    const explicitRelayout = layoutRequestKey !== handledLayoutRequest.current;
    handledLayoutRequest.current = layoutRequestKey;
    if (explicitRelayout) cache.delete(fingerprint);
    const cached = cache.get(fingerprint);
    let cancelled = false;
    if (cached !== undefined) {
      void session
        .applyPositions(cached)
        .then(() => {
          if (cancelled) return;
          layoutPending.current = false;
          setLayoutError(undefined);
          setLayoutStatus('Global layout restored from the in-memory cache.');
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
      if (cancelled) return;
      setLayoutError(undefined);
      setLayoutStatus('Refining Global layout in the background…');
    });
    const request = session.createLayoutRequest(
      input,
      settings,
      requestTemplate.iterations,
    );
    instrumentation?.count('global-layouts');
    void layoutService
      .layout(request)
      .then(async (result) => {
        if (cancelled) return;
        const apply = () => session.applyPositions(result.positions);
        const rendered =
          instrumentation === undefined
            ? apply()
            : instrumentation.measure('layout-apply', undefined, apply);
        await rendered;
        if (cancelled) return;
        instrumentation?.record('global-layout-worker', result.computeMs);
        instrumentation?.record('folder-prior', result.folderPriorMs);
        cache.set(fingerprint, result.positions);
        layoutPending.current = false;
        setLayoutStatus(
          result.algorithm === 'reference-only'
            ? 'Reference layout ready.'
            : 'Reference and soft folder layout ready.',
        );
        setLayoutCommitKey((current) => current + 1);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = `Global layout failed: ${errorMessage(error)}`;
        layoutPending.current = false;
        setLayoutError(message);
        setLayoutStatus('The last valid Global positions remain visible.');
        setLayoutCommitKey((current) => current + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [
    cache,
    fingerprint,
    input,
    instrumentation,
    layoutRequestKey,
    layoutService,
    ready,
    requestTemplate.iterations,
    settings,
  ]);

  useEffect(() => {
    if (
      !shouldApplyGlobalViewportRequest({
        handledKey: handledCenterRequest.current,
        layoutPending: layoutPending.current,
        ready,
        requestKey: centerRequest?.key,
      }) ||
      centerRequest === undefined
    ) {
      return;
    }
    handledCenterRequest.current = centerRequest.key;
    void sessionRef.current?.center(centerRequest).catch((error: unknown) => {
      setLayoutError(`Could not center Global: ${errorMessage(error)}`);
    });
  }, [centerRequest, layoutCommitKey, ready]);

  useEffect(() => {
    if (
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
  }, [fitRequestKey, layoutCommitKey, ready]);

  const zoomIn = useCallback(() => sessionRef.current?.zoomBy(0.82), []);
  const zoomOut = useCallback(() => sessionRef.current?.zoomBy(1.22), []);
  const fit = useCallback(() => sessionRef.current?.fit(), []);

  return (
    <div className="global-graph-canvas">
      <div className="global-graph-canvas__surface" ref={containerRef} />
      <div
        aria-label="Global canvas controls"
        className="global-graph-canvas__controls"
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
      <p
        className="global-graph-canvas__status"
        aria-live="polite"
        aria-atomic="true"
      >
        {layoutStatus}
      </p>
      {layoutError === undefined ? null : (
        <p className="global-graph-canvas__error" role="alert">
          {layoutError}
        </p>
      )}
    </div>
  );
}
