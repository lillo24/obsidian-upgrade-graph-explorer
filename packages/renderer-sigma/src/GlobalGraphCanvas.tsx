import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';
import {
  offsetNormalizedFolderAnchor,
  type FolderClusterAnchorMap,
  type FolderSpatialRule,
  type NormalizedFolderAnchor,
  type SpatialPoint,
} from '@icarus-graph-explorer/spatial-overrides';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import type { ViewProjection } from '@icarus-graph-explorer/view-projection';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';

import { GlobalLayoutCache } from './layout-cache';
import { GlobalSpatialInfluenceCache } from './spatial-influence-cache';
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
import {
  mapProjectionToGlobal,
  mapProjectionToGlobalTopology,
} from './mapping';
import { GlobalRendererSession } from './session';
import {
  globalLayoutSettingsFromPhysics,
  resolveGlobalPhysicsSettings,
} from './settings';
import {
  composeGlobalFolderSpatialRules,
  composeGlobalSpatialOverrides,
  resolveGlobalFolderSpatialRules,
} from './spatial';
import {
  createGlobalSpatialInfluenceRequest,
  globalSpatialInfluenceFingerprint,
} from './spatial-influence';
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
  GlobalSpatialInfluenceService,
  SemanticGlobalViewport,
} from './types';

const EMPTY_FOLDER_ANCHOR_MAP: FolderClusterAnchorMap = new Map();

export interface GlobalFolderArrangementProps {
  readonly active: boolean;
  readonly activeFolderKey?: string;
  readonly anchorCount: number;
  readonly editable: boolean;
  readonly blockedReason?: string;
  readonly canRecoverCorrupt?: boolean;
  readonly focusRequestKey: number;
  readonly persistenceStatus: string;
  readonly onActiveChange: (active: boolean) => void;
  readonly onActiveFolderChange: (folderKey: string | undefined) => void;
  readonly onAnnouncement: (message: string) => void;
  readonly onAvailabilityChange: (
    available: boolean,
    reason: string | undefined,
  ) => void;
  readonly onCommitAnchor: (
    folderKey: string,
    anchor: NormalizedFolderAnchor,
  ) => string | undefined;
  readonly onRecoverCorrupt?: () => string | undefined;
  readonly onResetAll: () => string | undefined;
  readonly onResetFolder: (folderKey: string) => string | undefined;
}

export interface GlobalGraphCanvasProps {
  readonly folderArrangement?: GlobalFolderArrangementProps;
  readonly centerRequest?: GlobalCenterRequest;
  readonly fitRequestKey: number;
  readonly initialViewport?: SemanticGlobalViewport;
  readonly instrumentation?: GlobalRendererInstrumentation;
  readonly layoutRequestKey: number;
  /** Optional session cache owner; the lazy web module keeps this across mode switches. */
  readonly layoutCache?: GlobalLayoutCache;
  readonly layoutService: GlobalLayoutService;
  /** Separate latest-result worker for schema-v2 dynamic pull rules. */
  readonly spatialInfluenceService?: GlobalSpatialInfluenceService;
  readonly spatialInfluenceCache?: GlobalSpatialInfluenceCache;
  readonly spatialSourceKey?: string;
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
  /** Full schema-v2 rules; current production controls still author place/exact only. */
  readonly spatialRules?: readonly FolderSpatialRule[];
  readonly trackpadZoomMode: GlobalTrackpadZoomMode;
  /** Style-only EntityId lookup; excluded from mapping and layout inputs. */
  readonly visualGroupStyles?: VisualGroupPresentationMap;
  /** Display-only File multipliers; never mapping/layout/fingerprint inputs. */
  readonly presentationOverrides?: EntityPresentationOverrideMap;
}

function folderLabel(folderKey: string): string {
  return folderKey === '.' ? 'Root folder' : folderKey;
}

export function describeNormalizedFolderAnchor(
  anchor: NormalizedFolderAnchor,
): string {
  const horizontal =
    Math.abs(anchor.x) < 0.005
      ? undefined
      : `${Math.round(Math.abs(anchor.x) * 100)}% ${anchor.x > 0 ? 'right' : 'left'}`;
  const vertical =
    Math.abs(anchor.y) < 0.005
      ? undefined
      : `${Math.round(Math.abs(anchor.y) * 100)}% ${anchor.y > 0 ? 'down' : 'up'}`;
  if (horizontal === undefined && vertical === undefined) return 'Centered';
  const beyond = Math.abs(anchor.x) > 1 || Math.abs(anchor.y) > 1;
  return `${[horizontal, vertical].filter(Boolean).join(', ')}${beyond ? ' — beyond the automatic graph edge' : ''}`;
}

function anchorsEqual(
  left: NormalizedFolderAnchor | undefined,
  right: NormalizedFolderAnchor,
): boolean {
  return (
    left !== undefined &&
    Math.abs(left.x - right.x) <= 1e-9 &&
    Math.abs(left.y - right.y) <= 1e-9
  );
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
  folderArrangement,
  initialViewport,
  instrumentation,
  layoutRequestKey,
  layoutCache,
  layoutService,
  spatialInfluenceService,
  spatialInfluenceCache,
  spatialSourceKey,
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
  spatialRules,
  trackpadZoomMode,
  visualGroupStyles,
  presentationOverrides,
}: GlobalGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const arrangementPanelRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<GlobalRendererSession | undefined>(undefined);
  const [cache] = useState(() => layoutCache ?? new GlobalLayoutCache());
  const [dynamicCache] = useState(
    () => spatialInfluenceCache ?? new GlobalSpatialInfluenceCache(),
  );
  const handledCenterRequest = useRef(0);
  const handledFitRequest = useRef(0);
  const handledLayoutRequest = useRef(layoutRequestKey);
  const layoutPending = useRef(true);
  const callbacks = useRef({
    folderArrangement,
    onFailure,
    onNodeActivate,
    onNodeSingleClick,
    onSelectionChange,
    onViewportObservation,
  });
  useEffect(() => {
    callbacks.current = {
      folderArrangement,
      onFailure,
      onNodeActivate,
      onNodeSingleClick,
      onSelectionChange,
      onViewportObservation,
    };
  }, [
    folderArrangement,
    onFailure,
    onNodeActivate,
    onNodeSingleClick,
    onSelectionChange,
    onViewportObservation,
  ]);
  const resolvedPhysics = resolveGlobalPhysicsSettings(settings);
  const {
    folderClustering,
    folderCohesion,
    linkForce,
    withinFolderSpacing,
    betweenFolderSpacing,
  } = resolvedPhysics;
  const layoutSettings = useMemo(
    () =>
      globalLayoutSettingsFromPhysics({
        folderClustering,
        folderCohesion,
        linkForce,
        withinFolderSpacing,
        betweenFolderSpacing,
      }),
    [
      betweenFolderSpacing,
      folderClustering,
      folderCohesion,
      linkForce,
      withinFolderSpacing,
    ],
  );
  const input = useMemo(() => {
    const map = () => mapProjectionToGlobalTopology(projection);
    return instrumentation === undefined
      ? map()
      : instrumentation.measure('global-map', 'global-mappings', map);
  }, [instrumentation, projection]);
  const requestTemplate = useMemo(
    () =>
      createGlobalLayoutRequest(
        input,
        layoutSettings,
        layoutIterations(input.nodes.length),
      ),
    [input, layoutSettings],
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
      displayedPositions: initialDisplayedPositions,
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
  const latestDynamicPositions = useRef(initial.automaticPositions);
  const latestDisplayedPositions = useRef(initial.displayedPositions);
  const latestSpatialOverrides = useRef(spatialOverrides);
  const latestInput = useRef(input);
  const pendingArrangementCommit = useRef<
    | {
        readonly folderKey: string;
        readonly anchor: NormalizedFolderAnchor;
      }
    | undefined
  >(undefined);
  useLayoutEffect(() => {
    latestSpatialOverrides.current = spatialOverrides;
    latestInput.current = input;
  }, [input, spatialOverrides]);
  const [ready, setReady] = useState(false);
  const [layoutCommitKey, setLayoutCommitKey] = useState(0);
  const [layoutStatus, setLayoutStatus] = useState<string | undefined>(
    initial.cached ? undefined : 'Preparing All Network layout…',
  );
  const [layoutError, setLayoutError] = useState<string>();
  const [spatialError, setSpatialError] = useState<string>();
  const [layoutPendingState, setLayoutPendingState] = useState(!initial.cached);
  const [spatialCommitKey, setSpatialCommitKey] = useState(0);
  const spatialGeneration = useRef(0);
  const [arrangementGesturePhase, setArrangementGesturePhase] = useState<
    'idle' | 'primed' | 'dragging' | 'committing'
  >('idle');
  const [keyboardPreview, setKeyboardPreview] = useState<{
    readonly folderKey: string;
    readonly anchor: NormalizedFolderAnchor;
  }>();
  const keyboardPreviewRef = useRef(keyboardPreview);
  useLayoutEffect(() => {
    keyboardPreviewRef.current = keyboardPreview;
  }, [keyboardPreview]);
  const [activeFolderPosition, setActiveFolderPosition] =
    useState<NormalizedFolderAnchor>();
  const [arrangementError, setArrangementError] = useState<string>();
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const restoreArrangementDisplay = useCallback(() => {
    const session = sessionRef.current;
    if (session === undefined) return;
    if (spatialRules !== undefined) {
      void session
        .applyPositions(latestDisplayedPositions.current)
        .catch((error: unknown) => {
          setArrangementError(
            `Could not restore confirmed folder positions: ${errorMessage(error)}`,
          );
        });
      return;
    }
    void applyDisplayedPositions(
      session,
      latestAutomaticPositions.current,
      latestInput.current,
      latestSpatialOverrides.current,
      instrumentation,
      true,
    ).catch((error: unknown) => {
      setArrangementError(
        `Could not restore confirmed folder positions: ${errorMessage(error)}`,
      );
    });
  }, [instrumentation, spatialRules]);

  const cancelArrangementPreview = useCallback(
    (announcement?: string): boolean => {
      if (callbacks.current.folderArrangement === undefined) return false;
      const cancelled =
        sessionRef.current?.cancelFolderArrangementGesture() === true;
      if (!cancelled && keyboardPreviewRef.current === undefined) return false;
      pendingArrangementCommit.current = undefined;
      setKeyboardPreview(undefined);
      setArrangementGesturePhase('idle');
      restoreArrangementDisplay();
      if (announcement !== undefined) {
        callbacks.current.folderArrangement?.onAnnouncement(announcement);
      }
      return true;
    },
    [restoreArrangementDisplay],
  );

  const commitArrangementAnchor = useCallback(
    (folderKey: string, anchor: NormalizedFolderAnchor) => {
      let failure: string | undefined;
      try {
        failure = callbacks.current.folderArrangement?.onCommitAnchor(
          folderKey,
          anchor,
        );
      } catch (error: unknown) {
        failure = errorMessage(error);
      }
      if (failure !== undefined) {
        pendingArrangementCommit.current = undefined;
        sessionRef.current?.cancelFolderArrangementGesture();
        setKeyboardPreview(undefined);
        setArrangementGesturePhase('idle');
        setArrangementError(`Folder position was not saved: ${failure}`);
        restoreArrangementDisplay();
        return;
      }
      pendingArrangementCommit.current = { folderKey, anchor };
      setKeyboardPreview(undefined);
      setArrangementError(undefined);
      const status = callbacks.current.folderArrangement?.persistenceStatus;
      callbacks.current.folderArrangement?.onAnnouncement(
        status?.includes('session only') === true
          ? 'Folder position set for this session only'
          : 'Folder position saved',
      );
    },
    [restoreArrangementDisplay],
  );

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
          onArrangementFolderChange: (folderKey) =>
            callbacks.current.folderArrangement?.onActiveFolderChange(
              folderKey,
            ),
          onArrangementCommit: commitArrangementAnchor,
          onArrangementGestureChange: setArrangementGesturePhase,
          onArrangementPointerMove: (point: SpatialPoint | undefined) => {
            const spotlight = spotlightRef.current;
            if (spotlight === null || point === undefined) return;
            spotlight.style.setProperty('--arrange-x', `${point.x}px`);
            spotlight.style.setProperty('--arrange-y', `${point.y}px`);
          },
          onArrangementError: (message) => {
            setArrangementError(message);
            callbacks.current.folderArrangement?.onAnnouncement(message);
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
  }, [
    commitArrangementAnchor,
    initial,
    instrumentation,
    onTransitionAnchorApiChange,
  ]);

  const arrangeableFolderKeys = useMemo(
    () =>
      new Set(
        input.nodes.flatMap((node) =>
          node.attributes.nodeKind === 'document' &&
          node.attributes.folderKey !== null
            ? [node.attributes.folderKey]
            : [],
        ),
      ),
    [input],
  );
  const arrangementUnavailableReason =
    folderArrangement === undefined
      ? undefined
      : !ready
        ? 'Wait for the All Network renderer to start'
        : layoutPendingState
          ? 'Wait for the current Network layout to finish'
          : !folderArrangement.editable
            ? (folderArrangement.blockedReason ??
              'Folder arrangement is unavailable until saved positions are recovered')
            : arrangeableFolderKeys.size === 0
              ? 'No visible File has an arrangeable folder'
              : undefined;
  const arrangementAvailable =
    folderArrangement !== undefined &&
    arrangementUnavailableReason === undefined;

  useEffect(() => {
    folderArrangement?.onAvailabilityChange(
      arrangementAvailable,
      arrangementUnavailableReason,
    );
  }, [arrangementAvailable, arrangementUnavailableReason, folderArrangement]);

  useLayoutEffect(() => {
    const session = sessionRef.current;
    if (session === undefined || folderArrangement === undefined) return;
    const active = folderArrangement.active && arrangementAvailable;
    session.setFolderArrangementContext({
      active,
      ...(folderArrangement.activeFolderKey === undefined
        ? {}
        : { activeFolderKey: folderArrangement.activeFolderKey }),
      anchors: spatialOverrides ?? EMPTY_FOLDER_ANCHOR_MAP,
      automaticPositions: latestAutomaticPositions.current,
      currentPositions: latestDynamicPositions.current,
      input,
    });
    const next =
      active && folderArrangement.activeFolderKey !== undefined
        ? session.currentFolderAnchor(folderArrangement.activeFolderKey)
        : undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setActiveFolderPosition((current) =>
        current?.x === next?.x && current?.y === next?.y ? current : next,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [
    arrangementAvailable,
    folderArrangement,
    input,
    layoutCommitKey,
    spatialCommitKey,
    spatialOverrides,
  ]);

  useEffect(() => {
    const folderKey = folderArrangement?.activeFolderKey;
    if (
      folderArrangement?.active !== true ||
      folderKey === undefined ||
      arrangeableFolderKeys.has(folderKey)
    ) {
      return;
    }
    cancelArrangementPreview('The active folder is no longer visible.');
    folderArrangement.onActiveFolderChange(undefined);
  }, [arrangeableFolderKeys, cancelArrangementPreview, folderArrangement]);

  useEffect(() => {
    if (folderArrangement?.active !== true) return;
    arrangementPanelRef.current?.focus({ preventScroll: true });
  }, [folderArrangement?.active, folderArrangement?.focusRequestKey]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setKeyboardPreview(undefined);
      setConfirmResetAll(false);
    });
    return () => {
      cancelled = true;
    };
  }, [folderArrangement?.activeFolderKey]);

  useEffect(() => {
    if (folderArrangement?.active !== true) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (cancelArrangementPreview('Folder movement canceled')) return;
      folderArrangement.onActiveChange(false);
    };
    const handleBlur = () => {
      cancelArrangementPreview(
        'Window focus changed; folder movement canceled',
      );
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        cancelArrangementPreview(
          'App visibility changed; folder movement canceled',
        );
      }
    };
    window.addEventListener('keydown', handleEscape, true);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('keydown', handleEscape, true);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [cancelArrangementPreview, folderArrangement]);

  useEffect(() => {
    const session = sessionRef.current;
    if (session === undefined || input === initial.sourceInput) return;
    try {
      if (
        cancelArrangementPreview(
          'The graph changed; the unfinished folder movement was canceled.',
        )
      ) {
        queueMicrotask(() => setArrangementError(undefined));
      }
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
  }, [cancelArrangementPreview, initial.sourceInput, input, instrumentation]);

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
    if (spatialRules !== undefined) return;
    if (appliedSpatialOverrides.current === spatialOverrides) return;
    const previousSpatialOverrides = appliedSpatialOverrides.current;
    appliedSpatialOverrides.current = spatialOverrides;
    const session = sessionRef.current;
    if (session === undefined) return;
    const pending = pendingArrangementCommit.current;
    const incomingPendingAnchor =
      pending === undefined
        ? undefined
        : spatialOverrides?.get(pending.folderKey);
    const confirmsPendingCommit =
      pending !== undefined &&
      anchorsEqual(incomingPendingAnchor, pending.anchor);
    void applyDisplayedPositions(
      session,
      latestAutomaticPositions.current,
      input,
      spatialOverrides,
      instrumentation,
      (spatialOverrides === undefined || spatialOverrides.size === 0) &&
        previousSpatialOverrides !== undefined &&
        previousSpatialOverrides.size > 0,
    )
      .then(() => {
        if (pending === undefined) return;
        if (pendingArrangementCommit.current !== pending) return;
        pendingArrangementCommit.current = undefined;
        if (confirmsPendingCommit) {
          session.completeFolderArrangementCommit();
          setArrangementGesturePhase('idle');
          setActiveFolderPosition(incomingPendingAnchor);
          return;
        }
        session.cancelFolderArrangementGesture();
        setArrangementGesturePhase('idle');
        setArrangementError(
          'The saved folder positions changed before this movement was adopted; the confirmed positions are shown.',
        );
      })
      .catch((error: unknown) => {
        callbacks.current.onFailure(errorMessage(error));
      });
  }, [input, instrumentation, spatialOverrides, spatialRules]);

  useEffect(() => {
    dynamicCache.clear();
    latestDynamicPositions.current = latestAutomaticPositions.current;
  }, [dynamicCache, spatialSourceKey]);

  useEffect(() => {
    if (
      spatialRules === undefined ||
      !ready ||
      layoutPendingState ||
      sessionRef.current === undefined
    ) {
      return;
    }
    const generation = ++spatialGeneration.current;
    let cancelled = false;
    const session = sessionRef.current;
    const basePositions = latestAutomaticPositions.current;
    const resolve = () => resolveGlobalFolderSpatialRules(input, spatialRules);
    const resolved =
      instrumentation === undefined
        ? resolve()
        : instrumentation.measure(
            'spatial-rule-resolution',
            'spatial-rule-resolutions',
            resolve,
          );
    const request = createGlobalSpatialInfluenceRequest(
      input,
      layoutSettings,
      Math.min(30, requestTemplate.iterations),
      basePositions,
      fingerprint,
      resolved,
    );

    const composeAndApply = async (
      dynamicPositions: readonly GlobalLayoutPosition[],
    ): Promise<void> => {
      if (cancelled || generation !== spatialGeneration.current) return;
      latestDynamicPositions.current = dynamicPositions;
      const compose = () =>
        composeGlobalFolderSpatialRules(
          basePositions,
          dynamicPositions,
          input,
          resolved,
        ).displayedPositions;
      const positions =
        instrumentation === undefined
          ? compose()
          : instrumentation.measure(
              'spatial-fixed-compose',
              'spatial-fixed-compositions',
              compose,
            );
      await session.applyPositions(positions);
      if (cancelled || generation !== spatialGeneration.current) return;
      latestDisplayedPositions.current = positions;
      appliedSpatialOverrides.current = spatialOverrides;
      setSpatialError(undefined);
      setSpatialCommitKey((current) => current + 1);
      const pending = pendingArrangementCommit.current;
      if (pending === undefined) return;
      const incoming = spatialOverrides?.get(pending.folderKey);
      pendingArrangementCommit.current = undefined;
      if (anchorsEqual(incoming, pending.anchor)) {
        session.completeFolderArrangementCommit();
        setArrangementGesturePhase('idle');
        setActiveFolderPosition(incoming);
        return;
      }
      session.cancelFolderArrangementGesture();
      setArrangementGesturePhase('idle');
      setArrangementError(
        'The saved folder positions changed before this movement was adopted; the confirmed positions are shown.',
      );
    };

    const effectivePull = request.attractors.some(
      ({ strength }) => strength > 0,
    );
    if (!effectivePull) {
      void composeAndApply(basePositions).catch((error: unknown) => {
        if (!cancelled) callbacks.current.onFailure(errorMessage(error));
      });
      return () => {
        cancelled = true;
      };
    }

    const requestFingerprint = globalSpatialInfluenceFingerprint(request);
    const cached = dynamicCache.get(requestFingerprint);
    if (cached !== undefined) {
      instrumentation?.count('spatial-pull-cache-hits');
      instrumentation?.record('spatial-pull-cache-hit', 0);
      void composeAndApply(cached).catch((error: unknown) => {
        if (!cancelled) callbacks.current.onFailure(errorMessage(error));
      });
      return () => {
        cancelled = true;
      };
    }

    if (spatialInfluenceService === undefined) {
      void composeAndApply(basePositions)
        .then(() => {
          if (!cancelled && generation === spatialGeneration.current) {
            setSpatialError(
              'Dynamic folder pull is unavailable; base layout plus fixed placements remain visible.',
            );
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) callbacks.current.onFailure(errorMessage(error));
        });
      return () => {
        cancelled = true;
      };
    }
    instrumentation?.count('spatial-pull-requests');
    instrumentation?.record('spatial-pull-request', 0);
    queueMicrotask(() => {
      if (!cancelled) setLayoutStatus('Applying dynamic folder pull…');
    });
    void spatialInfluenceService
      .layout(request)
      .then(async (result) => {
        if (cancelled || generation !== spatialGeneration.current) return;
        dynamicCache.set(requestFingerprint, result.positions);
        instrumentation?.record('spatial-pull-worker', result.computeMs);
        instrumentation?.record('spatial-pull-forceatlas', result.forceAtlasMs);
        instrumentation?.record('spatial-pull-attractor', result.attractorMs);
        await composeAndApply(result.positions);
        if (!cancelled) setLayoutStatus(undefined);
      })
      .catch(async (error: unknown) => {
        if (cancelled || generation !== spatialGeneration.current) return;
        try {
          await composeAndApply(basePositions);
        } catch (fallbackError: unknown) {
          if (!cancelled) {
            callbacks.current.onFailure(errorMessage(fallbackError));
          }
          return;
        }
        if (cancelled) return;
        setLayoutStatus(undefined);
        setSpatialError(
          `Dynamic folder pull failed: ${errorMessage(error)} Base layout plus fixed placements remain visible.`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [
    dynamicCache,
    fingerprint,
    input,
    instrumentation,
    layoutCommitKey,
    layoutPendingState,
    layoutSettings,
    ready,
    requestTemplate.iterations,
    spatialInfluenceService,
    spatialOverrides,
    spatialRules,
    spatialSourceKey,
  ]);

  useEffect(() => {
    sessionRef.current?.setControlledSelection(
      selection?.kind === 'node' ? selection.id : undefined,
    );
  }, [selection]);

  useEffect(() => {
    if (!ready) return;
    const session = sessionRef.current;
    if (session === undefined) return;
    let cancelled = false;
    const cancelledPreview = cancelArrangementPreview(
      'The layout changed; the unfinished folder movement was canceled.',
    );
    layoutPending.current = true;
    queueMicrotask(() => {
      if (cancelled) return;
      if (cancelledPreview) setArrangementError(undefined);
      setLayoutPendingState(true);
    });
    const explicitRelayout = layoutRequestKey !== handledLayoutRequest.current;
    handledLayoutRequest.current = layoutRequestKey;
    if (explicitRelayout) cache.delete(fingerprint);
    const cached = cache.get(fingerprint);
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
          setLayoutPendingState(false);
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
      layoutSettings,
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
        setLayoutPendingState(false);
        setLayoutStatus(undefined);
        setLayoutCommitKey((current) => current + 1);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = `All Network layout failed: ${errorMessage(error)}`;
        layoutPending.current = false;
        setLayoutPendingState(false);
        setLayoutError(message);
        setLayoutStatus('The last valid All Network positions remain visible.');
        setLayoutCommitKey((current) => current + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [
    cache,
    cancelArrangementPreview,
    fingerprint,
    input,
    instrumentation,
    layoutRequestKey,
    layoutService,
    ready,
    requestTemplate.iterations,
    layoutSettings,
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
  const activeArrangementFolderKey = folderArrangement?.activeFolderKey;
  const displayedArrangementAnchor =
    keyboardPreview !== undefined &&
    keyboardPreview.folderKey === activeArrangementFolderKey
      ? keyboardPreview.anchor
      : activeFolderPosition;

  const nudgeActiveFolder = useCallback(
    (x: number, y: number) => {
      const session = sessionRef.current;
      const folderKey = folderArrangement?.activeFolderKey;
      if (session === undefined || folderKey === undefined) return;
      const base =
        keyboardPreview?.folderKey === folderKey
          ? keyboardPreview.anchor
          : (session.currentFolderAnchor(folderKey) ?? { x: 0, y: 0 });
      try {
        const anchor = offsetNormalizedFolderAnchor(base, { x, y });
        session.previewFolderAnchor(folderKey, anchor);
        setKeyboardPreview({ folderKey, anchor });
        setActiveFolderPosition(anchor);
        setArrangementError(undefined);
        callbacks.current.folderArrangement?.onAnnouncement(
          `${folderLabel(folderKey)} moved to ${describeNormalizedFolderAnchor(anchor)}`,
        );
      } catch (error: unknown) {
        setArrangementError(
          `Could not preview folder position: ${errorMessage(error)}`,
        );
      }
    },
    [folderArrangement?.activeFolderKey, keyboardPreview],
  );

  const handleArrangementPanelKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      const amount = event.shiftKey ? 0.1 : 0.02;
      const offset =
        event.key === 'ArrowLeft'
          ? { x: -amount, y: 0 }
          : event.key === 'ArrowRight'
            ? { x: amount, y: 0 }
            : event.key === 'ArrowUp'
              ? { x: 0, y: -amount }
              : event.key === 'ArrowDown'
                ? { x: 0, y: amount }
                : undefined;
      if (offset === undefined) return;
      event.preventDefault();
      nudgeActiveFolder(offset.x, offset.y);
    },
    [nudgeActiveFolder],
  );

  const saveKeyboardPreview = useCallback(() => {
    if (keyboardPreview === undefined) return;
    setArrangementGesturePhase('committing');
    commitArrangementAnchor(keyboardPreview.folderKey, keyboardPreview.anchor);
  }, [commitArrangementAnchor, keyboardPreview]);

  const finishArrangement = useCallback(() => {
    cancelArrangementPreview();
    folderArrangement?.onActiveChange(false);
  }, [cancelArrangementPreview, folderArrangement]);

  const resetActiveFolder = useCallback(() => {
    const folderKey = folderArrangement?.activeFolderKey;
    if (folderArrangement === undefined || folderKey === undefined) return;
    const failure = folderArrangement.onResetFolder(folderKey);
    if (failure !== undefined) {
      setArrangementError(`Folder position was not reset: ${failure}`);
      return;
    }
    sessionRef.current?.cancelFolderArrangementGesture();
    pendingArrangementCommit.current = undefined;
    setKeyboardPreview(undefined);
    setArrangementGesturePhase('idle');
    setArrangementError(undefined);
    folderArrangement.onAnnouncement(
      `${folderLabel(folderKey)} position reset`,
    );
  }, [folderArrangement]);

  const resetAllFolders = useCallback(() => {
    if (folderArrangement === undefined) return;
    const failure = folderArrangement.onResetAll();
    if (failure !== undefined) {
      setArrangementError(`Folder positions were not reset: ${failure}`);
      return;
    }
    sessionRef.current?.cancelFolderArrangementGesture();
    pendingArrangementCommit.current = undefined;
    setKeyboardPreview(undefined);
    setArrangementGesturePhase('idle');
    setConfirmResetAll(false);
    setArrangementError(undefined);
    folderArrangement.onAnnouncement('All custom folder positions reset');
  }, [folderArrangement]);

  const recoverCorruptArrangement = useCallback(() => {
    const failure = folderArrangement?.onRecoverCorrupt?.();
    if (failure !== undefined) {
      setArrangementError(
        `Saved folder positions were not recovered: ${failure}`,
      );
      return;
    }
    setArrangementError(undefined);
    folderArrangement?.onAnnouncement(
      'Invalid saved folder positions were cleared; arrangement is available again',
    );
  }, [folderArrangement]);

  return (
    <div
      className={`global-graph-canvas${folderArrangement?.active === true ? ' global-graph-canvas--arranging' : ''}`}
      data-arrangement-phase={arrangementGesturePhase}
    >
      <div className="global-graph-canvas__surface" ref={containerRef} />
      {folderArrangement?.active === true ? (
        <div
          aria-hidden="true"
          className={`global-graph-canvas__arrangement-spotlight${arrangementGesturePhase === 'dragging' ? ' global-graph-canvas__arrangement-spotlight--dragging' : ''}`}
          ref={spotlightRef}
        />
      ) : null}
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
            {folderArrangement === undefined ? null : (
              <>
                <button
                  aria-label="Arrange folders"
                  aria-pressed={folderArrangement.active}
                  disabled={!folderArrangement.active && !arrangementAvailable}
                  onClick={() => {
                    if (folderArrangement.active) finishArrangement();
                    else folderArrangement.onActiveChange(true);
                  }}
                  title={
                    folderArrangement.active
                      ? 'Done arranging folders'
                      : (arrangementUnavailableReason ?? 'Arrange folders')
                  }
                  type="button"
                >
                  {folderArrangement.active ? 'Done' : 'Arrange'}
                </button>
                {folderArrangement.canRecoverCorrupt === true &&
                !folderArrangement.active ? (
                  <button
                    onClick={recoverCorruptArrangement}
                    title="Clear invalid saved folder positions"
                    type="button"
                  >
                    Recover positions
                  </button>
                ) : null}
              </>
            )}
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
          {folderArrangement?.active === true ? (
            <div
              aria-label="Arrange folders"
              className="global-graph-canvas__arrangement-panel"
              onKeyDown={handleArrangementPanelKeyDown}
              ref={arrangementPanelRef}
              role="region"
              tabIndex={-1}
            >
              <div className="global-graph-canvas__arrangement-heading">
                <div>
                  <strong>Arrange folders</strong>
                  <p>Drag any File to move its folder.</p>
                </div>
                <button onClick={finishArrangement} type="button">
                  Done
                </button>
              </div>
              {activeArrangementFolderKey === undefined ? (
                <p className="global-graph-canvas__arrangement-hint">
                  Choose a File on the canvas or use Arrange folder in Network
                  Explorer. Stage dragging still pans the graph.
                </p>
              ) : (
                <>
                  <p className="global-graph-canvas__arrangement-folder">
                    <span>Active folder</span>
                    <strong>{folderLabel(activeArrangementFolderKey)}</strong>
                  </p>
                  <p className="global-graph-canvas__arrangement-position">
                    {displayedArrangementAnchor === undefined
                      ? 'Automatic position'
                      : describeNormalizedFolderAnchor(
                          displayedArrangementAnchor,
                        )}
                  </p>
                  <div
                    aria-label="Nudge active folder"
                    className="global-graph-canvas__arrangement-nudges"
                    role="group"
                  >
                    <button
                      aria-label="Nudge folder up"
                      onClick={(event) =>
                        nudgeActiveFolder(0, event.shiftKey ? -0.1 : -0.02)
                      }
                      title="Nudge up (hold Shift for a larger step)"
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label="Nudge folder left"
                      onClick={(event) =>
                        nudgeActiveFolder(event.shiftKey ? -0.1 : -0.02, 0)
                      }
                      title="Nudge left (hold Shift for a larger step)"
                      type="button"
                    >
                      ←
                    </button>
                    <button
                      aria-label="Nudge folder down"
                      onClick={(event) =>
                        nudgeActiveFolder(0, event.shiftKey ? 0.1 : 0.02)
                      }
                      title="Nudge down (hold Shift for a larger step)"
                      type="button"
                    >
                      ↓
                    </button>
                    <button
                      aria-label="Nudge folder right"
                      onClick={(event) =>
                        nudgeActiveFolder(event.shiftKey ? 0.1 : 0.02, 0)
                      }
                      title="Nudge right (hold Shift for a larger step)"
                      type="button"
                    >
                      →
                    </button>
                  </div>
                  <div className="global-graph-canvas__arrangement-actions">
                    <button
                      disabled={keyboardPreview === undefined}
                      onClick={saveKeyboardPreview}
                      type="button"
                    >
                      Save position
                    </button>
                    <button
                      disabled={
                        keyboardPreview === undefined &&
                        arrangementGesturePhase === 'idle'
                      }
                      onClick={() =>
                        cancelArrangementPreview('Folder movement canceled')
                      }
                      type="button"
                    >
                      Cancel movement
                    </button>
                    <button onClick={resetActiveFolder} type="button">
                      Reset folder
                    </button>
                  </div>
                </>
              )}
              <p className="global-graph-canvas__arrangement-persistence">
                {folderArrangement.persistenceStatus} ·{' '}
                {folderArrangement.anchorCount} custom{' '}
                {folderArrangement.anchorCount === 1 ? 'position' : 'positions'}
              </p>
              {folderArrangement.canRecoverCorrupt === true ? (
                <button onClick={recoverCorruptArrangement} type="button">
                  Clear invalid saved positions
                </button>
              ) : folderArrangement.anchorCount ===
                0 ? null : confirmResetAll ? (
                <div
                  className="global-graph-canvas__arrangement-confirm"
                  role="group"
                  aria-label="Confirm reset all folder positions"
                >
                  <span>Reset every custom folder position?</span>
                  <button onClick={resetAllFolders} type="button">
                    Reset all
                  </button>
                  <button
                    onClick={() => setConfirmResetAll(false)}
                    type="button"
                  >
                    Keep positions
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmResetAll(true)} type="button">
                  Reset all positions…
                </button>
              )}
            </div>
          ) : null}
        </>
      )}
      {layoutError === undefined ? null : (
        <p className="global-graph-canvas__error" role="alert">
          {layoutError}
        </p>
      )}
      {spatialError === undefined ? null : (
        <p className="global-graph-canvas__error" role="alert">
          {spatialError}
        </p>
      )}
      {arrangementError === undefined ? null : (
        <p className="global-graph-canvas__arrangement-error" role="alert">
          {arrangementError}
        </p>
      )}
    </div>
  );
}
