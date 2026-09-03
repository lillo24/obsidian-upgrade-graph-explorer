import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';
import type { FolderClusterAnchorMap } from '@icarus-graph-explorer/spatial-overrides';
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
  createGlobalLayoutRequestFromAutomaticPositions,
  globalLayoutPositionsFromInput,
  globalLayoutFingerprint,
  reconcileGlobalAutomaticPositions,
  warmGlobalRendererInput,
} from './layout';
import { GlobalGraphEmptyState } from './GlobalGraphEmptyState';
import { mountGlobalRendererSession } from './lifecycle';
import { mapProjectionToGlobal } from './mapping';
import { GlobalRendererSession } from './session';
import { composeGlobalSpatialOverrides } from './spatial';
import { shouldApplyGlobalViewportRequest } from './viewport-request';
import type {
  GlobalCenterRequest,
  GlobalLayoutPosition,
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
  readonly onNodeSingleClick?: (nodeId: string) => void;
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
  /** All Network-only position intent composed after automatic layout. */
  readonly spatialOverrides?: FolderClusterAnchorMap;
  readonly trackpadZoomMode: GlobalTrackpadZoomMode;
  /** Style-only EntityId lookup; excluded from mapping and layout inputs. */
  readonly visualGroupStyles?: VisualGroupPresentationMap;
  /** Display-only File multipliers; never mapping/layout/fingerprint inputs. */
  readonly presentationOverrides?: EntityPresentationOverrideMap;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function layoutIterations(nodeCount: number): number {
  return nodeCount <= 1_000 ? 100 : nodeCount <= 5_000 ? 30 : 20;
}

function displayedPositions(
  automaticPositions: readonly GlobalLayoutPosition[],
  input: ReturnType<typeof mapProjectionToGlobal>,
  anchors: FolderClusterAnchorMap | undefined,
  instrumentation: GlobalRendererInstrumentation | undefined,
  forceSpatialOperation = false,
) {
  const hasAnchors = anchors !== undefined && anchors.size > 0;
  if (!hasAnchors && !forceSpatialOperation) return automaticPositions;
  const compose = () =>
    hasAnchors
      ? composeGlobalSpatialOverrides(automaticPositions, input, anchors)
          .displayedPositions
      : automaticPositions;
  return instrumentation === undefined
    ? compose()
    : instrumentation.measure(
        'spatial-compose',
        'spatial-compositions',
        compose,
      );
}

function applyDisplayedPositions(
  session: GlobalRendererSession,
  automaticPositions: readonly GlobalLayoutPosition[],
  input: ReturnType<typeof mapProjectionToGlobal>,
  anchors: FolderClusterAnchorMap | undefined,
  instrumentation: GlobalRendererInstrumentation | undefined,
  forceSpatialOperation = false,
): Promise<void> {
  const positions = displayedPositions(
    automaticPositions,
    input,
    anchors,
    instrumentation,
    forceSpatialOperation,
  );
  return applyComposedPositions(
    session,
    positions,
    anchors,
    instrumentation,
    forceSpatialOperation,
  );
}

function applyComposedPositions(
  session: GlobalRendererSession,
  positions: readonly GlobalLayoutPosition[],
  anchors: FolderClusterAnchorMap | undefined,
  instrumentation: GlobalRendererInstrumentation | undefined,
  forceSpatialOperation = false,
): Promise<void> {
  const apply = () => session.applyPositions(positions);
  return (anchors === undefined || anchors.size === 0) && !forceSpatialOperation
    ? apply()
    : instrumentation === undefined
      ? apply()
      : instrumentation.measure('spatial-apply', 'spatial-applies', apply);
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
  onNodeSingleClick,
  onSelectionChange,
  onTransitionAnchorApiChange,
  onViewportObservation,
  projection,
  selection,
  settings,
  spatialOverrides,
  trackpadZoomMode,
  visualGroupStyles,
  presentationOverrides,
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
    onNodeSingleClick,
    onSelectionChange,
    onViewportObservation,
  });
  useEffect(() => {
    callbacks.current = {
      onFailure,
      onNodeActivate,
      onNodeSingleClick,
      onSelectionChange,
      onViewportObservation,
    };
  }, [
    onFailure,
    onNodeActivate,
    onNodeSingleClick,
    onSelectionChange,
    onViewportObservation,
  ]);
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
    const automaticPositions = cached ?? globalLayoutPositionsFromInput(input);
    const initialDisplayedPositions = displayedPositions(
      automaticPositions,
      input,
      spatialOverrides,
      instrumentation,
    );
    return {
      automaticPositions,
      cached: cached !== undefined,
      initialViewport,
      input:
        cached === undefined && initialDisplayedPositions === automaticPositions
          ? input
          : warmGlobalRendererInput(input, initialDisplayedPositions),
      sourceInput: input,
      settings,
      spatialOverrides,
      trackpadZoomMode,
      visualGroupStyles,
      presentationOverrides,
    };
  });
  const appliedVisualGroupStyles = useRef(initial.visualGroupStyles);
  const appliedPresentationOverrides = useRef(initial.presentationOverrides);
  const appliedSpatialOverrides = useRef(initial.spatialOverrides);
  const latestAutomaticPositions = useRef(initial.automaticPositions);
  const latestSpatialOverrides = useRef(spatialOverrides);
  useLayoutEffect(() => {
    latestSpatialOverrides.current = spatialOverrides;
  }, [spatialOverrides]);
  const [ready, setReady] = useState(false);
  const [layoutCommitKey, setLayoutCommitKey] = useState(0);
  const [layoutStatus, setLayoutStatus] = useState<string | undefined>(
    initial.cached ? undefined : 'Preparing All Network layout…',
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
          ...(initial.presentationOverrides === undefined
            ? {}
            : { presentationOverrides: initial.presentationOverrides }),
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
          onNodeSingleClick: (key) =>
            callbacks.current.onNodeSingleClick?.(key),
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
    if (session === undefined || input === initial.sourceInput) return;
    try {
      const automaticPositions = reconcileGlobalAutomaticPositions(
        input,
        latestAutomaticPositions.current,
      );
      latestAutomaticPositions.current = automaticPositions;
      const anchors = latestSpatialOverrides.current;
      const previousAnchors = appliedSpatialOverrides.current;
      const clearingAnchors =
        (anchors === undefined || anchors.size === 0) &&
        previousAnchors !== undefined &&
        previousAnchors.size > 0;
      const positions = displayedPositions(
        automaticPositions,
        input,
        anchors,
        instrumentation,
        clearingAnchors,
      );
      appliedSpatialOverrides.current = anchors;
      session.update(
        anchors === undefined || anchors.size === 0
          ? input
          : warmGlobalRendererInput(input, positions),
      );
      if (
        (anchors !== undefined && anchors.size > 0) ||
        (previousAnchors !== undefined && previousAnchors.size > 0)
      ) {
        void applyComposedPositions(
          session,
          positions,
          anchors,
          instrumentation,
          clearingAnchors,
        ).catch((error: unknown) => {
          callbacks.current.onFailure(errorMessage(error));
        });
      }
    } catch (error: unknown) {
      callbacks.current.onFailure(errorMessage(error));
    }
  }, [initial.sourceInput, input, instrumentation]);

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
    if (appliedPresentationOverrides.current === presentationOverrides) return;
    appliedPresentationOverrides.current = presentationOverrides;
    sessionRef.current?.setPresentationOverrides(presentationOverrides);
  }, [presentationOverrides]);

  useEffect(() => {
    if (appliedSpatialOverrides.current === spatialOverrides) return;
    const previousSpatialOverrides = appliedSpatialOverrides.current;
    appliedSpatialOverrides.current = spatialOverrides;
    const session = sessionRef.current;
    if (session === undefined) return;
    void applyDisplayedPositions(
      session,
      latestAutomaticPositions.current,
      input,
      spatialOverrides,
      instrumentation,
      (spatialOverrides === undefined || spatialOverrides.size === 0) &&
        previousSpatialOverrides !== undefined &&
        previousSpatialOverrides.size > 0,
    ).catch((error: unknown) => {
      callbacks.current.onFailure(errorMessage(error));
    });
  }, [input, instrumentation, spatialOverrides]);

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
      latestAutomaticPositions.current = cached;
      void applyDisplayedPositions(
        session,
        cached,
        input,
        latestSpatialOverrides.current,
        instrumentation,
      )
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
      if (cancelled) return;
      setLayoutError(undefined);
      setLayoutStatus('Refining All Network layout in the background…');
    });
    const request = createGlobalLayoutRequestFromAutomaticPositions(
      input,
      settings,
      requestTemplate.iterations,
      latestAutomaticPositions.current,
    );
    instrumentation?.count('global-layouts');
    void layoutService
      .layout(request)
      .then(async (result) => {
        if (cancelled) return;
        latestAutomaticPositions.current = result.positions;
        const anchors = latestSpatialOverrides.current;
        const apply = () =>
          applyDisplayedPositions(
            session,
            result.positions,
            input,
            anchors,
            instrumentation,
          );
        const rendered =
          anchors === undefined || anchors.size === 0
            ? instrumentation === undefined
              ? apply()
              : instrumentation.measure('layout-apply', undefined, apply)
            : apply();
        await rendered;
        if (cancelled) return;
        instrumentation?.record('global-layout-worker', result.computeMs);
        instrumentation?.record('folder-prior', result.folderPriorMs);
        cache.set(fingerprint, result.positions);
        layoutPending.current = false;
        setLayoutStatus(undefined);
        setLayoutCommitKey((current) => current + 1);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = `All Network layout failed: ${errorMessage(error)}`;
        layoutPending.current = false;
        setLayoutError(message);
        setLayoutStatus('The last valid All Network positions remain visible.');
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
      {projection.nodes.length === 0 ? (
        <GlobalGraphEmptyState />
      ) : (
        <>
          <div
            aria-label="All Network canvas controls"
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
          {layoutStatus === undefined ? null : (
            <p
              className="global-graph-canvas__status"
              aria-live="polite"
              aria-atomic="true"
            >
              {layoutStatus}
            </p>
          )}
        </>
      )}
      {layoutError === undefined ? null : (
        <p className="global-graph-canvas__error" role="alert">
          {layoutError}
        </p>
      )}
    </div>
  );
}
