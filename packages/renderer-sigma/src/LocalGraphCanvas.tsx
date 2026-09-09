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
import {
  createFocusNetworkPhysicsSeed,
  networkPhysicsNodeCountIsSupported,
  type NetworkPhysicsLifecycleState,
  type NetworkPhysicsPresentationState,
  type NetworkPhysicsService,
  type NetworkPhysicsServiceFactory,
} from './physics';
import type { TemporaryFileMoveController } from './file-move';
import type {
  TemporaryNodeConstraintCapability,
  TemporaryNodeConstraintEndReason,
} from './temporary-node-constraint';
import {
  DEFAULT_RESOLVED_NETWORK_SETTINGS,
  localLayoutSettingsFromNetworkSettings,
} from './local-network-settings';
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
import type { ResolvedNetworkSettings } from './types';
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
  /** PHYSICS1 transport seam; direct File dragging is armed while available. */
  readonly physicsServiceFactory?: NetworkPhysicsServiceFactory;
  readonly temporaryConstraintActive?: boolean;
  readonly temporaryConstraintRetryKey?: number;
  /** Shared Network preferences; only Reference Pull enters Local layout identity. */
  readonly networkSettings?: ResolvedNetworkSettings;
  /** Transient Sandbox policy; excluded from layout input and fingerprinting. */
  readonly densityFramingStrength?: number;
  readonly onFailure: (message: string) => void;
  readonly onTemporaryFileMoveCapabilityChange?: (
    capability: TemporaryNodeConstraintCapability,
  ) => void;
  readonly onTemporaryFileMoveControllerChange?: (
    controller: TemporaryFileMoveController | undefined,
  ) => void;
  readonly onTemporaryFileMoveFailure?: (message: string) => void;
  readonly onTemporaryFileMoveLifecycleChange?: (
    state: NetworkPhysicsLifecycleState,
  ) => void;
  readonly onTemporaryFileMovePresentationChange?: (
    state: NetworkPhysicsPresentationState,
  ) => void;
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
  physicsServiceFactory,
  networkSettings = DEFAULT_RESOLVED_NETWORK_SETTINGS,
  onFailure,
  onTemporaryFileMoveCapabilityChange,
  onTemporaryFileMoveControllerChange,
  onTemporaryFileMoveFailure,
  onTemporaryFileMoveLifecycleChange,
  onTemporaryFileMovePresentationChange,
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
  temporaryConstraintActive = false,
  temporaryConstraintRetryKey = 0,
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
    onTemporaryFileMoveCapabilityChange,
    onTemporaryFileMoveFailure,
    onTemporaryFileMoveLifecycleChange,
    onTemporaryFileMovePresentationChange,
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
      onTemporaryFileMoveCapabilityChange,
      onTemporaryFileMoveFailure,
      onTemporaryFileMoveLifecycleChange,
      onTemporaryFileMovePresentationChange,
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
    onTemporaryFileMoveCapabilityChange,
    onTemporaryFileMoveFailure,
    onTemporaryFileMoveLifecycleChange,
    onTemporaryFileMovePresentationChange,
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
  const referencePull = networkSettings.referencePull;
  const requestTemplate = useMemo(
    () =>
      createLocalLayoutRequest(
        input,
        localLayoutSettingsFromNetworkSettings({ referencePull }),
      ),
    [input, referencePull],
  );
  const physicsNodeCount = requestTemplate.nodes.length;
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
      networkSettings,
      trackpadZoomMode,
      visualGroupStyles,
      presentationOverrides,
    };
  });
  const appliedVisualGroupStyles = useRef(initial.visualGroupStyles);
  const appliedPresentationOverrides = useRef(initial.presentationOverrides);
  const latestAcceptedPositions = useRef(
    initial.cachedPositions ??
      requestTemplate.nodes.map(({ key, x, y }) => ({ key, x, y })),
  );
  const physicsSessionGeneration = useRef(`focus:${rootEntityId}`);
  const physicsSimulationSequence = useRef(0);
  const physicsServiceRef = useRef<NetworkPhysicsService | undefined>(
    undefined,
  );
  const physicsServiceGeneration = useRef(0);
  const [ready, setReady] = useState(false);
  const [layoutCommitKey, setLayoutCommitKey] = useState(0);
  const [layoutStatus, setLayoutStatus] = useState<string | undefined>(
    initial.cached ? undefined : 'Focus Network is ready; refining layout…',
  );
  const [layoutError, setLayoutError] = useState<string>();
  const latestTemporaryConstraintActive = useRef(temporaryConstraintActive);
  useLayoutEffect(() => {
    latestTemporaryConstraintActive.current = temporaryConstraintActive;
  }, [temporaryConstraintActive]);

  const temporaryFileMoveController = useMemo<TemporaryFileMoveController>(
    () => ({
      start: (nodeKey) =>
        sessionRef.current?.startKeyboardTemporaryFileMove(nodeKey) ?? {
          status: 'unavailable',
          reason: 'simulation-unavailable',
        },
      nudge: (delta) =>
        sessionRef.current?.nudgeKeyboardTemporaryFileMove(delta) ?? false,
      release: () =>
        sessionRef.current?.releaseKeyboardTemporaryFileMove() ?? false,
      cancel: (reason: Exclude<TemporaryNodeConstraintEndReason, 'released'>) =>
        sessionRef.current?.cancelTemporaryFileMove(reason) ?? false,
    }),
    [],
  );

  useEffect(() => {
    onTemporaryFileMoveControllerChange?.(temporaryFileMoveController);
    return () => onTemporaryFileMoveControllerChange?.(undefined);
  }, [onTemporaryFileMoveControllerChange, temporaryFileMoveController]);

  useEffect(() => {
    const generation = ++physicsServiceGeneration.current;
    const service = physicsServiceFactory?.({
      onRawFrame: (frame) => {
        if (physicsServiceGeneration.current !== generation) return;
        latestAcceptedPositions.current = frame.positions;
      },
      onFrame: (frame) => {
        if (physicsServiceGeneration.current !== generation) return;
        sessionRef.current?.applyPartialPositions(frame.positions);
      },
      onConstraint: (command) => {
        if (physicsServiceGeneration.current !== generation) return;
        if (command.kind === 'end') return;
        sessionRef.current?.applyPartialPositions([
          { key: command.nodeKey, ...command.target },
        ]);
      },
      onStateChange: (state) => {
        if (physicsServiceGeneration.current === generation) {
          callbacks.current.onTemporaryFileMoveLifecycleChange?.(state);
        }
      },
      onPresentationStateChange: (state) => {
        if (physicsServiceGeneration.current === generation) {
          callbacks.current.onTemporaryFileMovePresentationChange?.(state);
        }
      },
      onFailure: (failure) => {
        if (physicsServiceGeneration.current === generation) {
          callbacks.current.onTemporaryFileMoveFailure?.(failure.message);
          queueMicrotask(() => {
            if (physicsServiceGeneration.current === generation) {
              sessionRef.current?.setTemporaryFileMoveContext(
                undefined,
                'error',
              );
            }
          });
        }
      },
    });
    physicsServiceRef.current = service;
    return () => {
      if (physicsServiceRef.current === service) {
        physicsServiceRef.current = undefined;
      }
      queueMicrotask(() => service?.dispose());
    };
  }, [physicsServiceFactory]);

  useEffect(() => {
    const capability: TemporaryNodeConstraintCapability =
      physicsServiceFactory === undefined
        ? { status: 'unavailable', reason: 'simulation-unavailable' }
        : !ready || layoutPending.current
          ? { status: 'unavailable', reason: 'simulation-not-running' }
          : !networkPhysicsNodeCountIsSupported(physicsNodeCount)
            ? { status: 'unavailable', reason: 'graph-too-large' }
            : { status: 'available' };
    callbacks.current.onTemporaryFileMoveCapabilityChange?.(capability);
  }, [layoutCommitKey, physicsNodeCount, physicsServiceFactory, ready]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    let cancelled = false;
    const mounted = mountLocalRendererSession(
      () =>
        new LocalRendererSession(container, initial.input, {
          rootNodeKey: initial.input.rootNodeKey,
          densityFramingStrength: initial.densityFramingStrength,
          networkSettings: initial.networkSettings,
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
    sessionRef.current?.updateNetworkSettings(networkSettings);
  }, [networkSettings]);

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
    if (explicitRelayout) cache.delete(fingerprint);
    const cached = explicitRelayout ? undefined : cache.get(fingerprint);
    let cancelled = false;
    if (cached !== undefined) {
      if (
        !initialCacheAccepted.current &&
        initial.cachedPositions !== undefined &&
        fingerprint === initial.fingerprint
      ) {
        initialCacheAccepted.current = true;
        latestAcceptedPositions.current = initial.cachedPositions;
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
          latestAcceptedPositions.current = cached;
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
    const request = session.createLayoutRequest(input, { referencePull });
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
        latestAcceptedPositions.current = result.positions;
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
    referencePull,
  ]);

  useEffect(() => {
    const session = sessionRef.current;
    const physicsService = physicsServiceRef.current;
    if (!temporaryConstraintActive || session === undefined) {
      return;
    }
    if (
      physicsService === undefined ||
      !ready ||
      layoutPending.current ||
      !networkPhysicsNodeCountIsSupported(physicsNodeCount)
    ) {
      session.setTemporaryFileMoveContext({
        active: true,
        capability: {
          status: 'unavailable',
          reason:
            physicsService === undefined
              ? 'simulation-unavailable'
              : !networkPhysicsNodeCountIsSupported(physicsNodeCount)
                ? 'graph-too-large'
                : 'simulation-not-running',
        },
        sessionGeneration: physicsSessionGeneration.current,
        simulationGeneration: 'unavailable',
        coordinateGeneration: fingerprint,
        fixedTranslationByNodeKey: new Map(),
      });
      return;
    }
    const sessionGeneration = physicsSessionGeneration.current;
    const simulationGeneration = `${sessionGeneration}:simulation:${++physicsSimulationSequence.current}`;
    physicsService.initialize(
      createFocusNetworkPhysicsSeed({
        request: requestTemplate,
        positions: latestAcceptedPositions.current,
        sessionGeneration,
        simulationGeneration,
      }),
    );
    session.setTemporaryFileMoveContext({
      active: true,
      capability: { status: 'available' },
      port: physicsService,
      sessionGeneration,
      simulationGeneration,
      coordinateGeneration: `${fingerprint}:${layoutCommitKey}`,
      fixedTranslationByNodeKey: new Map(),
    });
    return () => {
      session.setTemporaryFileMoveContext(
        undefined,
        latestTemporaryConstraintActive.current
          ? 'layout-changed'
          : 'mode-exit',
      );
      physicsService.invalidate('layout-changed');
    };
  }, [
    fingerprint,
    layoutCommitKey,
    physicsNodeCount,
    physicsServiceFactory,
    ready,
    requestTemplate,
    temporaryConstraintActive,
    temporaryConstraintRetryKey,
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
