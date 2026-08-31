import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

import { GlobalLayoutCache } from './layout-cache';
import { createGlobalLayoutRequest, globalLayoutFingerprint } from './layout';
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
  SemanticGlobalViewport,
} from './types';

export interface GlobalGraphCanvasProps {
  readonly centerRequest?: GlobalCenterRequest;
  readonly fitRequestKey: number;
  readonly instrumentation?: GlobalRendererInstrumentation;
  readonly layoutRequestKey: number;
  /** Optional session cache owner; the lazy web module keeps this across mode switches. */
  readonly layoutCache?: GlobalLayoutCache;
  readonly layoutService: GlobalLayoutService;
  readonly onFailure: (message: string) => void;
  readonly onSelectionChange: (selection: GlobalSelection | null) => void;
  readonly onViewportObservation: (
    viewport: SemanticGlobalViewport | undefined,
  ) => void;
  readonly projection: ViewProjection;
  readonly selection: GlobalSelection | null;
  readonly settings: GlobalLayoutSettings;
  readonly trackpadZoomMode: GlobalTrackpadZoomMode;
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
  instrumentation,
  layoutRequestKey,
  layoutCache,
  layoutService,
  onFailure,
  onSelectionChange,
  onViewportObservation,
  projection,
  selection,
  settings,
  trackpadZoomMode,
}: GlobalGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<GlobalRendererSession | undefined>(undefined);
  const cacheRef = useRef(layoutCache ?? new GlobalLayoutCache());
  const handledCenterRequest = useRef(0);
  const handledFitRequest = useRef(0);
  const handledLayoutRequest = useRef(layoutRequestKey);
  const layoutPending = useRef(true);
  const callbacks = useRef({
    onFailure,
    onSelectionChange,
    onViewportObservation,
  });
  useEffect(() => {
    callbacks.current = {
      onFailure,
      onSelectionChange,
      onViewportObservation,
    };
  }, [onFailure, onSelectionChange, onViewportObservation]);
  const input = useMemo(() => {
    const map = () => mapProjectionToGlobal(projection, settings);
    return instrumentation === undefined
      ? map()
      : instrumentation.measure('global-map', 'global-mappings', map);
  }, [instrumentation, projection, settings]);
  const initial = useRef({ input, settings, trackpadZoomMode });
  const [ready, setReady] = useState(false);
  const [layoutCommitKey, setLayoutCommitKey] = useState(0);
  const [layoutStatus, setLayoutStatus] = useState('Preparing Global layout…');
  const [layoutError, setLayoutError] = useState<string>();

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    let cancelled = false;
    const mounted = mountGlobalRendererSession(
      () =>
        new GlobalRendererSession(container, initial.current.input, {
          settings: initial.current.settings,
          trackpadZoomMode: initial.current.trackpadZoomMode,
          ...(instrumentation === undefined ? {} : { instrumentation }),
          onNodeSelected: (key) =>
            callbacks.current.onSelectionChange(
              key === undefined ? null : { kind: 'node', id: key },
            ),
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
      if (sessionRef.current === session) sessionRef.current = undefined;
    };
  }, [instrumentation]);

  useEffect(() => {
    const session = sessionRef.current;
    if (session === undefined || input === initial.current.input) return;
    try {
      session.update(input);
    } catch (error: unknown) {
      callbacks.current.onFailure(errorMessage(error));
    }
  }, [input]);

  useEffect(() => {
    const session = sessionRef.current;
    if (session === undefined) return;
    session.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    sessionRef.current?.updateTrackpadZoomMode(trackpadZoomMode);
  }, [trackpadZoomMode]);

  useEffect(() => {
    sessionRef.current?.setControlledSelection(
      selection?.kind === 'node' ? selection.id : undefined,
    );
  }, [selection]);

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

  useEffect(() => {
    if (!ready) return;
    const session = sessionRef.current;
    if (session === undefined) return;
    layoutPending.current = true;
    const explicitRelayout = layoutRequestKey !== handledLayoutRequest.current;
    handledLayoutRequest.current = layoutRequestKey;
    if (explicitRelayout) cacheRef.current.delete(fingerprint);
    const cached = cacheRef.current.get(fingerprint);
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
        cacheRef.current.set(fingerprint, result.positions);
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
