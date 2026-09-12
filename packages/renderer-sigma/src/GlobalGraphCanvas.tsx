import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';
import {
  classifyFolderSpatialDraftScope,
  createFolderSpatialRuleDraft,
  folderSpatialRuleDraftIsDirty,
  folderSpatialRuleDraftScope,
  folderSpatialRuleFromDraft,
  nearestExcludedFolder,
  offsetNormalizedFolderAnchor,
  setFolderSpatialDraftAnchor,
  setFolderSpatialDraftBehavior,
  setFolderSpatialDraftRootFiles,
  setFolderSpatialDraftScopePreset,
  setFolderSpatialDraftStrength,
  toggleFolderSpatialDraftSubtree,
  indexAppliedFixedTranslations,
  type FolderClusterAnchorMap,
  type FolderScopeVisualization,
  type FolderSpatialRule,
  type FolderSpatialRuleDraft,
  type FolderSpatialScopePreset,
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
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

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
import { NetworkViewportControls } from './NetworkViewportControls';
import { mountGlobalRendererSession } from './lifecycle';
import {
  mapProjectionToGlobal,
  mapProjectionToGlobalTopology,
} from './mapping';
import { GlobalRendererSession } from './session';
import {
  createAllNetworkPhysicsSeed,
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
  globalLayoutSettingsFromPhysics,
  resolveGlobalPhysicsSettings,
} from './settings';
import {
  composeGlobalFolderSpatialRules,
  composeGlobalSpatialOverrides,
  globalFolderKeyByNodeKey,
  resolveGlobalFolderSpatialRules,
} from './spatial';
import {
  createGlobalSpatialInfluenceRequest,
  globalSpatialInfluenceFingerprint,
} from './spatial-influence';
import {
  initialViewportSatisfiesGlobalCenterRequest,
  shouldApplyGlobalViewportRequest,
} from './viewport-request';
import type {
  GlobalCenterRequest,
  GlobalDensityQaDiagnostics,
  GlobalLayoutPosition,
  GlobalLayoutService,
  GlobalLayoutSettings,
  GlobalRendererInstrumentation,
  GlobalSelection,
  GlobalSpatialInfluenceAttractor,
  GlobalTrackpadZoomMode,
  GlobalTransitionAnchorApi,
  GlobalSpatialInfluenceService,
  SemanticGlobalViewport,
} from './types';
import type { NetworkStartupNetworkState } from './startup-trace';

const EMPTY_FOLDER_ANCHOR_MAP: FolderClusterAnchorMap = new Map();
const SCOPE_TREE_PAGE_SIZE = 200;

export interface GlobalFolderArrangementProps {
  readonly active: boolean;
  readonly editorPhase?:
    | 'active-no-folder'
    | 'editing'
    | 'choosing-scope'
    | 'dragging-target'
    | 'committing'
    | 'settling-pull';
  readonly activeFolderKey?: string;
  readonly anchorCount: number;
  readonly ruleCount?: number;
  readonly scopeTree?: GlobalFolderScopeTreeNode;
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
  readonly onCommitRule?: (rule: FolderSpatialRule) => string | undefined;
  readonly onRemoveRule?: (folderKey: string) => string | undefined;
  readonly onClearRules?: () => string | undefined;
  readonly onEditChildRule?: (folderKey: string) => void;
  readonly onChoosingScopeChange?: (active: boolean) => void;
  readonly onTargetDraggingChange?: (active: boolean) => void;
  readonly onCommitStarted?: (behavior: FolderSpatialRule['behavior']) => void;
  readonly onAdopted?: () => void;
  readonly onDraftDirtyChange?: (dirty: boolean) => void;
  readonly onRecoverCorrupt?: () => string | undefined;
  readonly onResetAll: () => string | undefined;
  readonly onResetFolder: (folderKey: string) => string | undefined;
}

export interface GlobalFolderScopeTreeNode {
  readonly folderKey: string;
  readonly name: string;
  readonly depth: number;
  readonly directFileCount: number;
  readonly totalFileCount: number;
  readonly visibleFileCount: number;
  readonly ownRule?: FolderSpatialRule;
  readonly children: readonly GlobalFolderScopeTreeNode[];
}

export interface GlobalGraphCanvasProps {
  /** Identifies a startup Fit that must yield to newer manual camera input. */
  readonly automaticFitRequestKey?: number;
  readonly folderArrangement?: GlobalFolderArrangementProps;
  readonly centerRequest?: GlobalCenterRequest;
  readonly fitRequestKey: number;
  readonly initialViewport?: SemanticGlobalViewport;
  /** Transient Sandbox policy; excluded from layout input and fingerprinting. */
  readonly densityFramingStrength?: number;
  readonly instrumentation?: GlobalRendererInstrumentation;
  /** Opt-in, bounded startup diagnostics; ordinary production omits it. */
  readonly startupTrace?: import('./startup-trace').NetworkStartupTrace;
  readonly layoutRequestKey: number;
  /** Optional session cache owner; the lazy web module keeps this across mode switches. */
  readonly layoutCache?: GlobalLayoutCache;
  readonly layoutService: GlobalLayoutService;
  readonly maximized?: boolean;
  /** PHYSICS1 transport seam; direct File dragging is armed while available. */
  readonly physicsServiceFactory?: NetworkPhysicsServiceFactory;
  readonly temporaryConstraintActive?: boolean;
  readonly temporaryConstraintRetryKey?: number;
  /** Separate latest-result worker for schema-v2 dynamic pull rules. */
  readonly spatialInfluenceService?: GlobalSpatialInfluenceService;
  readonly spatialInfluenceCache?: GlobalSpatialInfluenceCache;
  readonly spatialSourceKey?: string;
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
    diagnostics: GlobalDensityQaDiagnostics | undefined,
  ) => void;
  readonly onCenterRequestConsumed?: (key: number) => void;
  readonly onFitRequestConsumed?: (key: number) => void;
  /** Routes the visible Fit action through the final-geometry request gate. */
  readonly onFitRequested?: () => void;
  readonly onMaximizedChange?: (maximized: boolean) => void;
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

interface ArrangementTargetPointerDrag {
  readonly pointerId: number;
  readonly element: HTMLDivElement;
  readonly folderKey: string;
  readonly behavior: FolderSpatialRule['behavior'];
  readonly startAnchor: NormalizedFolderAnchor;
  readonly startViewportPoint: SpatialPoint;
  latestAnchor: NormalizedFolderAnchor;
  moved: boolean;
}

function releaseTargetPointerCapture(drag: ArrangementTargetPointerDrag): void {
  if (drag.element.hasPointerCapture?.(drag.pointerId) === true) {
    drag.element.releasePointerCapture(drag.pointerId);
  }
}

function rulesEqual(
  left: FolderSpatialRule | undefined,
  right: FolderSpatialRule,
): boolean {
  return left !== undefined && JSON.stringify(left) === JSON.stringify(right);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function scopePresetLabel(preset: FolderSpatialScopePreset): string {
  return preset === 'exact'
    ? 'This folder'
    : preset === 'subtree'
      ? 'Folder + subfolders'
      : 'Custom';
}

function flattenScopeTree(
  root: GlobalFolderScopeTreeNode | undefined,
  activeFolderKey: string,
): readonly GlobalFolderScopeTreeNode[] {
  if (root === undefined) return [];
  const pending = [root];
  let active: GlobalFolderScopeTreeNode | undefined;
  while (pending.length > 0) {
    const candidate = pending.pop()!;
    if (candidate.folderKey === activeFolderKey) {
      active = candidate;
      break;
    }
    for (let index = candidate.children.length - 1; index >= 0; index -= 1) {
      pending.push(candidate.children[index]!);
    }
  }
  if (active === undefined) return [];
  const rows: GlobalFolderScopeTreeNode[] = [];
  const descendants = [...active.children].reverse();
  while (descendants.length > 0) {
    const candidate = descendants.pop()!;
    rows.push(candidate);
    for (let index = candidate.children.length - 1; index >= 0; index -= 1) {
      descendants.push(candidate.children[index]!);
    }
  }
  return rows;
}

function folderScopeTreeContains(
  root: GlobalFolderScopeTreeNode | undefined,
  folderKey: string,
): boolean {
  if (root === undefined) return false;
  const pending = [root];
  while (pending.length > 0) {
    const candidate = pending.pop()!;
    if (candidate.folderKey === folderKey) return true;
    pending.push(...candidate.children);
  }
  return false;
}

function displayedPositions(
  automaticPositions: readonly GlobalLayoutPosition[],
  input: ReturnType<typeof mapProjectionToGlobal>,
  anchors: FolderClusterAnchorMap | undefined,
  instrumentation: GlobalRendererInstrumentation | undefined,
  forceSpatialOperation = false,
  rules?: readonly FolderSpatialRule[],
) {
  if (rules !== undefined) {
    const resolve = () => resolveGlobalFolderSpatialRules(input, rules);
    const resolved =
      instrumentation === undefined
        ? resolve()
        : instrumentation.measure(
            'spatial-rule-resolution',
            'spatial-rule-resolutions',
            resolve,
          );
    const compose = () =>
      composeGlobalFolderSpatialRules(
        automaticPositions,
        automaticPositions,
        input,
        resolved,
      ).displayedPositions;
    return instrumentation === undefined
      ? compose()
      : instrumentation.measure(
          'spatial-fixed-compose',
          'spatial-fixed-compositions',
          compose,
        );
  }
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

function spatialInfluenceIterations(nodeCount: number): number {
  return nodeCount <= 1_000 ? 30 : nodeCount <= 5_000 ? 30 : 20;
}

function applyDisplayedPositions(
  session: GlobalRendererSession,
  automaticPositions: readonly GlobalLayoutPosition[],
  input: ReturnType<typeof mapProjectionToGlobal>,
  anchors: FolderClusterAnchorMap | undefined,
  instrumentation: GlobalRendererInstrumentation | undefined,
  forceSpatialOperation = false,
  rules?: readonly FolderSpatialRule[],
): Promise<readonly GlobalLayoutPosition[]> {
  const positions = displayedPositions(
    automaticPositions,
    input,
    anchors,
    instrumentation,
    forceSpatialOperation || rules !== undefined,
    rules,
  );
  return applyComposedPositions(
    session,
    positions,
    anchors,
    instrumentation,
    forceSpatialOperation || rules !== undefined,
  ).then(() => positions);
}

function applyComposedPositions(
  session: GlobalRendererSession,
  positions: readonly GlobalLayoutPosition[],
  anchors: FolderClusterAnchorMap | undefined,
  instrumentation: GlobalRendererInstrumentation | undefined,
  forceSpatialOperation = false,
): Promise<void> {
  const spatialOperation =
    (anchors !== undefined && anchors.size > 0) || forceSpatialOperation;
  const apply = () =>
    spatialOperation
      ? session.applySpatialPositions(positions)
      : session.applyPositions(positions);
  return !spatialOperation
    ? apply()
    : instrumentation === undefined
      ? apply()
      : instrumentation.measure('spatial-apply', 'spatial-applies', apply);
}

export function GlobalGraphCanvas({
  automaticFitRequestKey,
  centerRequest,
  densityFramingStrength,
  fitRequestKey,
  folderArrangement,
  initialViewport,
  instrumentation,
  layoutRequestKey,
  layoutCache,
  layoutService,
  maximized,
  physicsServiceFactory,
  spatialInfluenceService,
  spatialInfluenceCache,
  spatialSourceKey,
  onFailure,
  onTemporaryFileMoveCapabilityChange,
  onTemporaryFileMoveControllerChange,
  onTemporaryFileMoveFailure,
  onTemporaryFileMoveLifecycleChange,
  onTemporaryFileMovePresentationChange,
  onDensityQaDiagnosticsChange,
  onCenterRequestConsumed,
  onFitRequestConsumed,
  onFitRequested,
  onMaximizedChange,
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
  startupTrace,
  temporaryConstraintActive = false,
  temporaryConstraintRetryKey = 0,
  trackpadZoomMode,
  visualGroupStyles,
  presentationOverrides,
}: GlobalGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const arrangementPanelRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const targetMarkerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<GlobalRendererSession | undefined>(undefined);
  const [cache] = useState(() => layoutCache ?? new GlobalLayoutCache());
  const [dynamicCache] = useState(
    () => spatialInfluenceCache ?? new GlobalSpatialInfluenceCache(),
  );
  const handledCenterRequest = useRef(0);
  const handledFitRequest = useRef(0);
  const automaticFitRequestKeyRef = useRef(automaticFitRequestKey);
  const userCameraIntentGeneration = useRef(0);
  const pendingInitialPresentation = useRef<number | 'initial' | undefined>(
    automaticFitRequestKey ?? 'initial',
  );
  const presentationCameraIntentGeneration = useRef(0);
  const presentationCommitGeneration = useRef<object | undefined>(undefined);
  const startupObservationStarted = useRef(false);
  const [initialPresentationReady, setInitialPresentationReady] =
    useState(false);
  const handledLayoutRequest = useRef(layoutRequestKey);
  const layoutPending = useRef(true);
  const callbacks = useRef({
    folderArrangement,
    onFailure,
    onTemporaryFileMoveCapabilityChange,
    onTemporaryFileMoveFailure,
    onTemporaryFileMoveLifecycleChange,
    onTemporaryFileMovePresentationChange,
    onDensityQaDiagnosticsChange,
    onCenterRequestConsumed,
    onFitRequestConsumed,
    onFitRequested,
    onNodeActivate,
    onNodeSingleClick,
    onSelectionChange,
    onViewportObservation,
  });
  useEffect(() => {
    callbacks.current = {
      folderArrangement,
      onFailure,
      onTemporaryFileMoveCapabilityChange,
      onTemporaryFileMoveFailure,
      onTemporaryFileMoveLifecycleChange,
      onTemporaryFileMovePresentationChange,
      onDensityQaDiagnosticsChange,
      onCenterRequestConsumed,
      onFitRequestConsumed,
      onFitRequested,
      onNodeActivate,
      onNodeSingleClick,
      onSelectionChange,
      onViewportObservation,
    };
  }, [
    folderArrangement,
    onFailure,
    onTemporaryFileMoveCapabilityChange,
    onTemporaryFileMoveFailure,
    onTemporaryFileMoveLifecycleChange,
    onTemporaryFileMovePresentationChange,
    onDensityQaDiagnosticsChange,
    onCenterRequestConsumed,
    onFitRequestConsumed,
    onFitRequested,
    onNodeActivate,
    onNodeSingleClick,
    onSelectionChange,
    onViewportObservation,
  ]);
  useEffect(() => {
    if (
      centerRequest === undefined ||
      centerRequest.key <= handledCenterRequest.current
    ) {
      return;
    }
    const requestNode = projection.nodes.find(
      ({ id }) => id === centerRequest.nodeId,
    );
    if (
      !initialViewportSatisfiesGlobalCenterRequest({
        initialViewport,
        request: centerRequest,
        requestEntityId:
          requestNode?.kind === 'entity' ? requestNode.entityId : undefined,
      })
    ) {
      return;
    }
    handledCenterRequest.current = centerRequest.key;
    onCenterRequestConsumed?.(centerRequest.key);
  }, [
    centerRequest,
    initialViewport,
    onCenterRequestConsumed,
    projection.nodes,
  ]);
  useLayoutEffect(() => {
    automaticFitRequestKeyRef.current = automaticFitRequestKey;
    if (
      automaticFitRequestKey !== undefined &&
      automaticFitRequestKey > handledFitRequest.current &&
      pendingInitialPresentation.current !== automaticFitRequestKey
    ) {
      pendingInitialPresentation.current = automaticFitRequestKey;
      presentationCameraIntentGeneration.current =
        userCameraIntentGeneration.current;
      setInitialPresentationReady(false);
    }
  }, [automaticFitRequestKey]);
  const resolvedPhysics = resolveGlobalPhysicsSettings(settings);
  const {
    folderClustering,
    folderCohesion,
    linkForce,
    withinFolderSpacing,
    betweenFolderSpacing,
  } = resolvedPhysics;
  const layoutSettings = useMemo(
    () => ({
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
  // The separate schema-v1 soft-attractor worker still accepts the persisted
  // shape. Freeze its visual fields to the baseline while its protocol remains
  // backward compatible; the finite Global layout worker is spatial-only.
  const spatialInfluenceSettings = useMemo(
    () => globalLayoutSettingsFromPhysics(layoutSettings),
    [layoutSettings],
  );
  const input = useMemo(() => {
    const map = () => mapProjectionToGlobalTopology(projection);
    return instrumentation === undefined
      ? map()
      : instrumentation.measure('global-map', 'global-mappings', map);
  }, [instrumentation, projection]);
  const requestTemplate = useMemo(
    () => createGlobalLayoutRequest(input, layoutSettings),
    [input, layoutSettings],
  );
  const physicsNodeCount = requestTemplate.nodes.length;
  const fingerprint = useMemo(
    () => globalLayoutFingerprint(requestTemplate),
    [requestTemplate],
  );
  const layoutGeneration = useMemo(
    () => ({ fingerprint, input, layoutRequestKey }),
    [fingerprint, input, layoutRequestKey],
  );
  const layoutGenerationRef = useRef(layoutGeneration);
  useLayoutEffect(() => {
    if (layoutGenerationRef.current === layoutGeneration) return;
    layoutGenerationRef.current = layoutGeneration;
    // Establish pending ownership before ordinary effects can start spatial
    // work for a new source/layout generation.
    layoutPending.current = true;
  }, [layoutGeneration]);
  const [initial] = useState(() => {
    const cached = cache.get(fingerprint);
    const automaticPositions = cached ?? globalLayoutPositionsFromInput(input);
    const initialDisplayedPositions = displayedPositions(
      automaticPositions,
      input,
      spatialOverrides,
      instrumentation,
      false,
      spatialRules,
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
      densityFramingStrength,
      spatialOverrides,
      trackpadZoomMode,
      visualGroupStyles,
      presentationOverrides,
    };
  });
  const finalGeometryGeneration = useMemo(
    () => ({
      fingerprint,
      input,
      layoutRequestKey,
      spatialOverrides,
      spatialRules,
      spatialSourceKey,
    }),
    [
      fingerprint,
      input,
      layoutRequestKey,
      spatialOverrides,
      spatialRules,
      spatialSourceKey,
    ],
  );
  const finalGeometryGenerationRef = useRef(finalGeometryGeneration);
  const finalGeometryTraceKey = `${fingerprint}:${layoutRequestKey}:${spatialSourceKey ?? 'no-spatial-source'}`;
  const [
    committedFinalGeometryGeneration,
    setCommittedFinalGeometryGeneration,
  ] = useState<object>();
  useLayoutEffect(() => {
    finalGeometryGenerationRef.current = finalGeometryGeneration;
  }, [finalGeometryGeneration]);
  const commitFinalGeometry = useCallback(
    (generation: object, positions: readonly GlobalLayoutPosition[]): void => {
      if (finalGeometryGenerationRef.current !== generation) return;
      const pending = pendingInitialPresentation.current;
      if (pending === undefined) {
        setCommittedFinalGeometryGeneration((current) =>
          current === generation ? current : generation,
        );
        return;
      }
      if (presentationCommitGeneration.current === generation) return;
      const session = sessionRef.current;
      if (session === undefined) return;
      presentationCommitGeneration.current = generation;
      const automaticKey = typeof pending === 'number' ? pending : undefined;
      const fitAll =
        automaticKey !== undefined &&
        automaticFitRequestKeyRef.current === automaticKey &&
        userCameraIntentGeneration.current ===
          presentationCameraIntentGeneration.current;
      void session
        .commitInitialPresentation(positions, fitAll)
        .then(() => {
          if (presentationCommitGeneration.current === generation) {
            presentationCommitGeneration.current = undefined;
          }
          if (finalGeometryGenerationRef.current !== generation) return;
          pendingInitialPresentation.current = undefined;
          if (startupTrace !== undefined) {
            session.traceStartupEvent('initial-presentation-ready', {
              initialPresentationReady: true,
              layoutPending: false,
              finalGeometryGeneration: finalGeometryTraceKey,
            });
          }
          setInitialPresentationReady(true);
          setCommittedFinalGeometryGeneration(generation);
          if (
            automaticKey !== undefined &&
            automaticFitRequestKeyRef.current === automaticKey
          ) {
            automaticFitRequestKeyRef.current = undefined;
            handledFitRequest.current = Math.max(
              handledFitRequest.current,
              automaticKey,
            );
            callbacks.current.onFitRequestConsumed?.(automaticKey);
          }
        })
        .catch((error: unknown) => {
          if (presentationCommitGeneration.current === generation) {
            presentationCommitGeneration.current = undefined;
          }
          callbacks.current.onFailure(
            `Could not establish the initial All Network presentation: ${errorMessage(error)}`,
          );
        });
    },
    [finalGeometryTraceKey, startupTrace],
  );
  const appliedVisualGroupStyles = useRef(initial.visualGroupStyles);
  const appliedPresentationOverrides = useRef(initial.presentationOverrides);
  const appliedSpatialOverrides = useRef(initial.spatialOverrides);
  const latestAutomaticPositions = useRef(initial.automaticPositions);
  const latestDynamicPositions = useRef(initial.automaticPositions);
  const latestDisplayedPositions = useRef(initial.displayedPositions);
  const latestSpatialOverrides = useRef(spatialOverrides);
  const latestSpatialRules = useRef(spatialRules);
  const latestInput = useRef(input);
  const physicsFixedTranslationByNodeKey = useRef<
    ReadonlyMap<string, SpatialPoint>
  >(new Map());
  const physicsSessionGeneration = useRef('all-network');
  const physicsSimulationSequence = useRef(0);
  const physicsServiceRef = useRef<NetworkPhysicsService | undefined>(
    undefined,
  );
  const physicsServiceGeneration = useRef(0);
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
  const applyPhysicsDisplayTranslation = useCallback(
    (positions: readonly GlobalLayoutPosition[]) =>
      positions.map((position) => {
        const translation = physicsFixedTranslationByNodeKey.current.get(
          position.key,
        );
        return translation === undefined
          ? position
          : {
              key: position.key,
              x: position.x + translation.x,
              y: position.y + translation.y,
            };
      }),
    [],
  );
  useEffect(() => {
    const generation = ++physicsServiceGeneration.current;
    const service = physicsServiceFactory?.({
      onRawFrame: (frame) => {
        if (physicsServiceGeneration.current !== generation) return;
        latestDynamicPositions.current = frame.positions;
      },
      onFrame: (frame) => {
        if (physicsServiceGeneration.current !== generation) return;
        const displayed = applyPhysicsDisplayTranslation(frame.positions);
        latestDisplayedPositions.current = displayed;
        sessionRef.current?.applyPartialPositions(displayed);
      },
      onConstraint: (command) => {
        if (physicsServiceGeneration.current !== generation) return;
        if (command.kind === 'end') return;
        const translation = physicsFixedTranslationByNodeKey.current.get(
          command.nodeKey,
        );
        sessionRef.current?.applyPartialPositions([
          {
            key: command.nodeKey,
            x: command.target.x + (translation?.x ?? 0),
            y: command.target.y + (translation?.y ?? 0),
          },
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
  }, [applyPhysicsDisplayTranslation, physicsServiceFactory]);

  const pendingArrangementCommit = useRef<
    | {
        readonly folderKey: string;
        readonly anchor: NormalizedFolderAnchor;
        readonly rule?: FolderSpatialRule;
      }
    | undefined
  >(undefined);
  useLayoutEffect(() => {
    latestSpatialOverrides.current = spatialOverrides;
    latestSpatialRules.current = spatialRules;
    latestInput.current = input;
  }, [input, spatialOverrides, spatialRules]);
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
  const startupNetworkStateRef = useRef<NetworkStartupNetworkState>({
    initialPresentationReady,
    layoutPending: layoutPendingState,
    finalGeometryGeneration: finalGeometryTraceKey,
    ...(layoutStatus === undefined ? {} : { layoutStatus }),
  });
  useLayoutEffect(() => {
    startupNetworkStateRef.current = {
      initialPresentationReady,
      layoutPending: layoutPendingState,
      finalGeometryGeneration: finalGeometryTraceKey,
      ...(layoutStatus === undefined ? {} : { layoutStatus }),
    };
  }, [
    finalGeometryTraceKey,
    initialPresentationReady,
    layoutPendingState,
    layoutStatus,
  ]);
  const startupNetworkState = useCallback(
    (
      capability?: TemporaryNodeConstraintCapability,
    ): NetworkStartupNetworkState => ({
      ...startupNetworkStateRef.current,
      ...(capability === undefined
        ? {}
        : {
            temporaryFileMoveCapability:
              capability.status === 'available'
                ? 'available'
                : `unavailable:${capability.reason}`,
          }),
    }),
    [],
  );
  useEffect(() => {
    const capability: TemporaryNodeConstraintCapability =
      physicsServiceFactory === undefined
        ? { status: 'unavailable', reason: 'simulation-unavailable' }
        : !ready || layoutPendingState
          ? { status: 'unavailable', reason: 'simulation-not-running' }
          : !networkPhysicsNodeCountIsSupported(physicsNodeCount)
            ? { status: 'unavailable', reason: 'graph-too-large' }
            : { status: 'available' };
    if (startupTrace !== undefined) {
      sessionRef.current?.traceStartupEvent(
        'temporary-file-move-capability',
        startupNetworkState(capability),
      );
    }
    callbacks.current.onTemporaryFileMoveCapabilityChange?.(capability);
  }, [
    layoutPendingState,
    physicsNodeCount,
    physicsServiceFactory,
    ready,
    startupNetworkState,
    startupTrace,
  ]);
  useEffect(() => {
    if (startupTrace === undefined) return;
    sessionRef.current?.traceStartupEvent(
      'layout-status-transition',
      startupNetworkState(),
    );
  }, [layoutStatus, startupNetworkState, startupTrace]);
  useLayoutEffect(() => {
    if (startupTrace === undefined) return;
    if (!initialPresentationReady) {
      startupObservationStarted.current = false;
      return;
    }
    if (startupObservationStarted.current) return;
    startupObservationStarted.current = true;
    sessionRef.current?.markInitialPresentationRevealed(startupNetworkState());
  }, [initialPresentationReady, startupNetworkState, startupTrace]);
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
  const [, setActiveFolderPosition] = useState<NormalizedFolderAnchor>();
  const [ruleDraft, setRuleDraft] = useState<FolderSpatialRuleDraft>();
  const [draftBaselineRule, setDraftBaselineRule] =
    useState<FolderSpatialRule>();
  const ruleDraftRef = useRef(ruleDraft);
  const targetPointerDragRef = useRef<ArrangementTargetPointerDrag | undefined>(
    undefined,
  );
  const scopeVisualizationRef = useRef<FolderScopeVisualization | undefined>(
    undefined,
  );
  const [scopePulseKey, setScopePulseKey] = useState<string>();
  const [scopeTreeRowLimit, setScopeTreeRowLimit] =
    useState(SCOPE_TREE_PAGE_SIZE);
  const [arrangementError, setArrangementError] = useState<string>();
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const activeConfirmedRule = useMemo(
    () =>
      spatialRules?.find(
        (rule) => rule.folderKey === folderArrangement?.activeFolderKey,
      ),
    [folderArrangement?.activeFolderKey, spatialRules],
  );
  const draftRule = useMemo(() => {
    if (ruleDraft === undefined) return undefined;
    const resolve = () => folderSpatialRuleFromDraft(ruleDraft);
    return instrumentation === undefined
      ? resolve()
      : instrumentation.measure(
          'spatial-rule-draft-resolution',
          undefined,
          resolve,
        );
  }, [instrumentation, ruleDraft]);
  const draftScopeFolderKey = ruleDraft?.folderKey;
  const draftScopePreset = ruleDraft?.scopePreset;
  const draftCustomScope = ruleDraft?.customScope;
  const scopeVisualization = useMemo<FolderScopeVisualization | undefined>(
    () =>
      draftScopeFolderKey === undefined ||
      draftScopePreset === undefined ||
      draftCustomScope === undefined
        ? undefined
        : (() => {
            const classificationRule: FolderSpatialRule = {
              folderKey: draftScopeFolderKey,
              behavior: 'place',
              scope: folderSpatialRuleDraftScope({
                folderKey: draftScopeFolderKey,
                scopePreset: draftScopePreset,
                customScope: draftCustomScope,
              }),
              anchor: { x: 0, y: 0 },
            };
            const classify = () =>
              classifyFolderSpatialDraftScope({
                confirmedRules: spatialRules ?? [],
                draftRule: classificationRule,
                folderKeyByNodeKey: globalFolderKeyByNodeKey(input),
              });
            return instrumentation === undefined
              ? classify()
              : instrumentation.measure(
                  'spatial-scope-visualization',
                  undefined,
                  classify,
                );
          })(),
    [
      draftCustomScope,
      draftScopeFolderKey,
      draftScopePreset,
      input,
      instrumentation,
      spatialRules,
    ],
  );
  const draftDirty =
    draftRule !== undefined &&
    ruleDraft !== undefined &&
    draftBaselineRule !== undefined &&
    folderSpatialRuleDraftIsDirty(ruleDraft, draftBaselineRule);
  const draftDirtyRef = useRef(draftDirty);
  const onArrangementDraftDirtyChange = folderArrangement?.onDraftDirtyChange;
  const scopePulseNodeKeys = useMemo(
    () =>
      scopePulseKey === undefined
        ? undefined
        : new Set(
            [...globalFolderKeyByNodeKey(input)].flatMap(
              ([nodeKey, folderKey]) =>
                folderKey === scopePulseKey ||
                folderKey.startsWith(`${scopePulseKey}/`)
                  ? [nodeKey]
                  : [],
            ),
          ),
    [input, scopePulseKey],
  );
  const pulseScope = useCallback((folderKey: string) => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    )
      return;
    setScopePulseKey(folderKey);
  }, []);
  useLayoutEffect(() => {
    ruleDraftRef.current = ruleDraft;
    scopeVisualizationRef.current = scopeVisualization;
    draftDirtyRef.current = draftDirty;
  }, [draftDirty, ruleDraft, scopeVisualization]);

  useEffect(() => {
    onArrangementDraftDirtyChange?.(draftDirty);
  }, [draftDirty, onArrangementDraftDirtyChange]);

  useEffect(() => {
    if (scopePulseKey === undefined) return;
    const timer = window.setTimeout(() => setScopePulseKey(undefined), 220);
    return () => window.clearTimeout(timer);
  }, [scopePulseKey]);

  const restoreArrangementDisplay = useCallback(() => {
    const session = sessionRef.current;
    if (session === undefined) return;
    if (latestSpatialRules.current !== undefined) {
      void session
        .applySpatialPositions(latestDisplayedPositions.current)
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
  }, [instrumentation]);

  const cancelArrangementPreview = useCallback(
    (announcement?: string): boolean => {
      if (callbacks.current.folderArrangement === undefined) return false;
      const targetDrag = targetPointerDragRef.current;
      if (targetDrag !== undefined) {
        targetPointerDragRef.current = undefined;
        sessionRef.current?.setFolderTargetPointerActive(false);
        releaseTargetPointerCapture(targetDrag);
        setRuleDraft((current) =>
          current?.folderKey === targetDrag.folderKey
            ? setFolderSpatialDraftAnchor(current, targetDrag.startAnchor)
            : current,
        );
        callbacks.current.folderArrangement?.onTargetDraggingChange?.(false);
      }
      const cancelled =
        sessionRef.current?.cancelFolderArrangementGesture() === true ||
        targetDrag !== undefined;
      if (targetDrag !== undefined) {
        sessionRef.current?.positionFolderTargetAnchor(targetDrag.startAnchor);
      }
      if (!cancelled && keyboardPreviewRef.current === undefined) return false;
      pendingArrangementCommit.current = undefined;
      keyboardPreviewRef.current = undefined;
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
      const confirmedRule = latestSpatialRules.current?.find(
        (rule) => rule.folderKey === folderKey,
      );
      const currentDraft = ruleDraftRef.current;
      const nextDraft = setFolderSpatialDraftAnchor(
        currentDraft?.folderKey === folderKey
          ? currentDraft
          : createFolderSpatialRuleDraft({
              folderKey,
              confirmedRule,
              defaultAnchor: anchor,
            }),
        anchor,
      );
      const rule = folderSpatialRuleFromDraft(nextDraft);
      try {
        const arrangement = callbacks.current.folderArrangement;
        const persist = () =>
          arrangement?.onCommitRule
            ? arrangement.onCommitRule(rule)
            : arrangement?.onCommitAnchor(folderKey, anchor);
        failure =
          instrumentation === undefined
            ? persist()
            : instrumentation.measure(
                'spatial-rule-persist',
                undefined,
                persist,
              );
      } catch (error: unknown) {
        failure = errorMessage(error);
      }
      if (failure !== undefined) {
        pendingArrangementCommit.current = undefined;
        sessionRef.current?.cancelFolderArrangementGesture();
        keyboardPreviewRef.current = undefined;
        setKeyboardPreview(undefined);
        setArrangementGesturePhase('idle');
        setArrangementError(`Folder position was not saved: ${failure}`);
        restoreArrangementDisplay();
        return;
      }
      pendingArrangementCommit.current = { folderKey, anchor, rule };
      setRuleDraft(nextDraft);
      keyboardPreviewRef.current = undefined;
      setKeyboardPreview(undefined);
      setArrangementError(undefined);
      callbacks.current.folderArrangement?.onCommitStarted?.(rule.behavior);
      const status = callbacks.current.folderArrangement?.persistenceStatus;
      callbacks.current.folderArrangement?.onAnnouncement(
        status?.includes('session only') === true
          ? 'Spatial rule set for this session only'
          : rule.behavior === 'pull'
            ? 'Spatial rule saved; Dynamic pull is settling'
            : 'Spatial rule saved',
      );
    },
    [instrumentation, restoreArrangementDisplay],
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
          ...(initial.densityFramingStrength === undefined
            ? {}
            : { densityFramingStrength: initial.densityFramingStrength }),
          ...(initial.cached
            ? { initialAcceptedPositions: initial.displayedPositions }
            : {}),
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
          ...(startupTrace === undefined ? {} : { startupTrace }),
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
          onArrangementFolderChange: (folderKey) => {
            if (
              draftDirtyRef.current &&
              ruleDraftRef.current?.folderKey !== folderKey
            ) {
              callbacks.current.folderArrangement?.onAnnouncement(
                'Apply or cancel the current spatial rule changes before switching folders.',
              );
              return;
            }
            callbacks.current.folderArrangement?.onActiveFolderChange(
              folderKey,
            );
          },
          onArrangementCommit: commitArrangementAnchor,
          onArrangementGestureChange: (phase) => {
            setArrangementGesturePhase(phase);
            callbacks.current.folderArrangement?.onTargetDraggingChange?.(
              phase === 'dragging',
            );
          },
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
          onArrangementScopeFolderClick: (nodeKey, folderKey) => {
            const draft = ruleDraftRef.current;
            const visualization = scopeVisualizationRef.current;
            if (draft === undefined || visualization === undefined) return;
            if (
              visualization.stateByNodeKey.get(nodeKey) === 'shadowed-by-child'
            ) {
              const childFolderKey =
                visualization.owningRuleFolderKeyByNodeKey.get(nodeKey);
              if (childFolderKey !== undefined) {
                if (draftDirtyRef.current) {
                  callbacks.current.folderArrangement?.onAnnouncement(
                    'Apply or cancel the current spatial rule changes before editing a child rule.',
                  );
                  return;
                }
                callbacks.current.folderArrangement?.onAnnouncement(
                  `${folderLabel(childFolderKey)} has its own spatial rule. Edit that child rule to change it.`,
                );
                callbacks.current.folderArrangement?.onEditChildRule?.(
                  childFolderKey,
                );
              }
              return;
            }
            setRuleDraft((current) => {
              if (current === undefined) return current;
              return folderKey === current.folderKey
                ? setFolderSpatialDraftRootFiles(
                    current,
                    !current.customScope.includeRootFiles,
                  )
                : toggleFolderSpatialDraftSubtree(current, folderKey);
            });
            pulseScope(folderKey);
          },
          onArrangementTargetPoint: (point) => {
            const marker = targetMarkerRef.current;
            if (marker === null || point === undefined) return;
            marker.style.setProperty('--arrange-target-x', `${point.x}px`);
            marker.style.setProperty('--arrange-target-y', `${point.y}px`);
          },
          onViewportObservation: (viewport) =>
            callbacks.current.onViewportObservation(viewport),
          onDensityQaDiagnosticsChange: (diagnostics) =>
            callbacks.current.onDensityQaDiagnosticsChange?.(diagnostics),
          onUserCameraIntent: () => {
            userCameraIntentGeneration.current += 1;
            const key = automaticFitRequestKeyRef.current;
            if (key === undefined) return;
            automaticFitRequestKeyRef.current = undefined;
            handledFitRequest.current = Math.max(
              handledFitRequest.current,
              key,
            );
            callbacks.current.onFitRequestConsumed?.(key);
          },
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
      callbacks.current.onDensityQaDiagnosticsChange?.(undefined);
      onTransitionAnchorApiChange?.(undefined);
      if (sessionRef.current === session) sessionRef.current = undefined;
    };
  }, [
    commitArrangementAnchor,
    initial,
    instrumentation,
    onTransitionAnchorApiChange,
    pulseScope,
    startupTrace,
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
            : arrangeableFolderKeys.size === 0 && !folderArrangement.active
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
      ...(ruleDraft === undefined ? {} : { behavior: ruleDraft.behavior }),
      ...(folderArrangement.activeFolderKey === undefined
        ? {}
        : { activeFolderKey: folderArrangement.activeFolderKey }),
      anchors: spatialOverrides ?? EMPTY_FOLDER_ANCHOR_MAP,
      automaticPositions: latestAutomaticPositions.current,
      currentPositions: latestDisplayedPositions.current,
      ...(scopeVisualization === undefined
        ? {}
        : {
            activeMemberNodeKeys: scopeVisualization.activeMemberNodeKeys,
            scopeStateByNodeKey: scopeVisualization.stateByNodeKey,
          }),
      ...(scopePulseNodeKeys === undefined ? {} : { scopePulseNodeKeys }),
      chooseScope: folderArrangement.editorPhase === 'choosing-scope',
      ...(ruleDraft === undefined ? {} : { targetAnchor: ruleDraft.anchor }),
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
    scopeVisualization,
    scopePulseNodeKeys,
    ruleDraft,
  ]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const folderKey = folderArrangement?.activeFolderKey;
      if (folderArrangement?.active !== true || folderKey === undefined) {
        setRuleDraft(undefined);
        setDraftBaselineRule(undefined);
        return;
      }
      const defaultAnchor = sessionRef.current?.currentFolderAnchor(
        folderKey,
      ) ??
        activeConfirmedRule?.anchor ?? { x: 0, y: 0 };
      const nextDraft = createFolderSpatialRuleDraft({
        folderKey,
        confirmedRule: activeConfirmedRule,
        defaultAnchor,
      });
      setRuleDraft(nextDraft);
      setDraftBaselineRule(folderSpatialRuleFromDraft(nextDraft));
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeConfirmedRule,
    folderArrangement?.active,
    folderArrangement?.activeFolderKey,
  ]);

  useEffect(() => {
    const folderKey = folderArrangement?.activeFolderKey;
    if (
      folderArrangement?.active !== true ||
      folderKey === undefined ||
      folderArrangement.scopeTree === undefined ||
      folderScopeTreeContains(folderArrangement.scopeTree, folderKey)
    ) {
      return;
    }
    cancelArrangementPreview();
    folderArrangement.onAnnouncement(
      'The active folder no longer exists at its exact workspace path; its old rule remains dormant.',
    );
    folderArrangement.onActiveFolderChange(undefined);
  }, [cancelArrangementPreview, folderArrangement]);

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
      setScopeTreeRowLimit(SCOPE_TREE_PAGE_SIZE);
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
      if (draftDirty && ruleDraft !== undefined) {
        const defaultAnchor =
          sessionRef.current?.currentFolderAnchor(ruleDraft.folderKey) ??
          activeConfirmedRule?.anchor ??
          ruleDraft.anchor;
        setRuleDraft(
          createFolderSpatialRuleDraft({
            folderKey: ruleDraft.folderKey,
            confirmedRule: draftBaselineRule,
            defaultAnchor,
          }),
        );
        folderArrangement.onAnnouncement(
          'Unapplied spatial rule changes canceled',
        );
        return;
      }
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
  }, [
    activeConfirmedRule,
    cancelArrangementPreview,
    draftDirty,
    draftBaselineRule,
    folderArrangement,
    ruleDraft,
  ]);

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
        latestSpatialRules.current,
      );
      latestDisplayedPositions.current = positions;
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
    if (densityFramingStrength === undefined) return;
    sessionRef.current?.updateDensityFramingStrength?.(densityFramingStrength);
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
    if (
      spatialRules !== undefined ||
      !ready ||
      layoutPending.current ||
      layoutPendingState
    ) {
      return;
    }
    if (appliedSpatialOverrides.current === spatialOverrides) {
      commitFinalGeometry(
        finalGeometryGeneration,
        latestDisplayedPositions.current,
      );
      return;
    }
    const generation = finalGeometryGeneration;
    let cancelled = false;
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
      .then((positions) => {
        if (cancelled || finalGeometryGenerationRef.current !== generation) {
          return;
        }
        latestDisplayedPositions.current = positions;
        commitFinalGeometry(generation, positions);
        if (pending === undefined) return;
        if (pendingArrangementCommit.current !== pending) return;
        pendingArrangementCommit.current = undefined;
        if (confirmsPendingCommit) {
          session.completeFolderArrangementCommit();
          setArrangementGesturePhase('idle');
          setActiveFolderPosition(incomingPendingAnchor);
          callbacks.current.folderArrangement?.onAdopted?.();
          return;
        }
        session.cancelFolderArrangementGesture();
        setArrangementGesturePhase('idle');
        setArrangementError(
          'The saved folder positions changed before this movement was adopted; the confirmed positions are shown.',
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) callbacks.current.onFailure(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [
    commitFinalGeometry,
    finalGeometryGeneration,
    input,
    instrumentation,
    layoutPendingState,
    ready,
    spatialOverrides,
    spatialRules,
  ]);

  useEffect(() => {
    dynamicCache.clear();
    latestDynamicPositions.current = latestAutomaticPositions.current;
  }, [dynamicCache, spatialSourceKey]);

  useEffect(() => {
    if (
      spatialRules === undefined ||
      !ready ||
      layoutPending.current ||
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
      spatialInfluenceSettings,
      spatialInfluenceIterations(input.nodes.length),
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
      await session.applySpatialPositions(positions);
      if (cancelled || generation !== spatialGeneration.current) return;
      latestDisplayedPositions.current = positions;
      if (startupTrace !== undefined) {
        session.traceStartupEvent(
          'spatial-generation-accepted',
          startupNetworkState(),
        );
      }
      appliedSpatialOverrides.current = spatialOverrides;
      setSpatialError(undefined);
      setSpatialCommitKey((current) => current + 1);
      commitFinalGeometry(finalGeometryGeneration, positions);
      const pending = pendingArrangementCommit.current;
      if (pending === undefined) return;
      const incomingRule = spatialRules.find(
        (rule) => rule.folderKey === pending.folderKey,
      );
      const incomingAnchor = spatialOverrides?.get(pending.folderKey);
      pendingArrangementCommit.current = undefined;
      if (
        pending.rule === undefined
          ? anchorsEqual(incomingAnchor, pending.anchor)
          : rulesEqual(incomingRule, pending.rule)
      ) {
        session.completeFolderArrangementCommit();
        setArrangementGesturePhase('idle');
        setActiveFolderPosition(incomingRule?.anchor ?? incomingAnchor);
        callbacks.current.folderArrangement?.onAdopted?.();
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
    const settleStarted = performance.now();
    void spatialInfluenceService
      .layout(request)
      .then(async (result) => {
        if (cancelled || generation !== spatialGeneration.current) return;
        dynamicCache.set(requestFingerprint, result.positions);
        instrumentation?.record('spatial-pull-worker', result.computeMs);
        instrumentation?.record('spatial-pull-forceatlas', result.forceAtlasMs);
        instrumentation?.record('spatial-pull-attractor', result.attractorMs);
        instrumentation?.record(
          'spatial-pull-settle',
          performance.now() - settleStarted,
        );
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
        instrumentation?.record(
          'spatial-pull-settle',
          performance.now() - settleStarted,
        );
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
    commitFinalGeometry,
    finalGeometryGeneration,
    fingerprint,
    input,
    instrumentation,
    layoutCommitKey,
    layoutPendingState,
    spatialInfluenceSettings,
    ready,
    spatialInfluenceService,
    spatialOverrides,
    spatialRules,
    spatialSourceKey,
    startupNetworkState,
    startupTrace,
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
        false,
        latestSpatialRules.current,
      )
        .then((positions) => {
          if (cancelled) return;
          latestDisplayedPositions.current = positions;
          if (startupTrace !== undefined) {
            session.traceStartupEvent('layout-accepted', startupNetworkState());
          }
          layoutPending.current = false;
          setLayoutPendingState(false);
          setLayoutError(undefined);
          setLayoutStatus(undefined);
          setLayoutCommitKey((current) => current + 1);
          if (latestSpatialRules.current === undefined) {
            commitFinalGeometry(finalGeometryGenerationRef.current, positions);
          }
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
            false,
            latestSpatialRules.current,
          );
        const rendered =
          anchors === undefined || anchors.size === 0
            ? instrumentation === undefined
              ? apply()
              : instrumentation.measure('layout-apply', undefined, apply)
            : apply();
        const positions = await rendered;
        if (cancelled) return;
        latestDisplayedPositions.current = positions;
        if (startupTrace !== undefined) {
          session.traceStartupEvent('layout-accepted', startupNetworkState());
        }
        instrumentation?.record('global-layout-worker', result.computeMs);
        instrumentation?.record('folder-prior', result.folderPriorMs);
        cache.set(fingerprint, result.positions);
        layoutPending.current = false;
        setLayoutPendingState(false);
        setLayoutStatus(undefined);
        setLayoutCommitKey((current) => current + 1);
        if (latestSpatialRules.current === undefined) {
          commitFinalGeometry(finalGeometryGenerationRef.current, positions);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = `All Network layout failed: ${errorMessage(error)}`;
        layoutPending.current = false;
        setLayoutPendingState(false);
        setLayoutError(message);
        setLayoutStatus('The last valid All Network positions remain visible.');
        setLayoutCommitKey((current) => current + 1);
        if (latestSpatialRules.current === undefined) {
          commitFinalGeometry(
            finalGeometryGenerationRef.current,
            latestDisplayedPositions.current,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    cache,
    cancelArrangementPreview,
    commitFinalGeometry,
    fingerprint,
    input,
    instrumentation,
    layoutRequestKey,
    layoutService,
    ready,
    layoutSettings,
    startupNetworkState,
    startupTrace,
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
      layoutPendingState ||
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
        fixedTranslationByNodeKey: physicsFixedTranslationByNodeKey.current,
      });
      return;
    }
    const basePositions = latestAutomaticPositions.current;
    const dynamicPositions = latestDynamicPositions.current;
    let attractors: GlobalSpatialInfluenceAttractor[] = [];
    let activeFolders: ReturnType<
      typeof composeGlobalFolderSpatialRules
    >['activeFolders'] = [];
    if (latestSpatialRules.current !== undefined) {
      const resolved = resolveGlobalFolderSpatialRules(
        latestInput.current,
        latestSpatialRules.current,
      );
      attractors = [
        ...createGlobalSpatialInfluenceRequest(
          latestInput.current,
          spatialInfluenceSettings,
          spatialInfluenceIterations(latestInput.current.nodes.length),
          basePositions,
          fingerprint,
          resolved,
        ).attractors,
      ];
      activeFolders = composeGlobalFolderSpatialRules(
        basePositions,
        dynamicPositions,
        latestInput.current,
        resolved,
      ).activeFolders;
    } else if (
      latestSpatialOverrides.current !== undefined &&
      latestSpatialOverrides.current.size > 0
    ) {
      activeFolders = composeGlobalSpatialOverrides(
        basePositions,
        latestInput.current,
        latestSpatialOverrides.current,
      ).activeFolders;
    }
    const fixedTranslationByNodeKey =
      indexAppliedFixedTranslations(activeFolders);
    physicsFixedTranslationByNodeKey.current = fixedTranslationByNodeKey;
    const sessionGeneration = physicsSessionGeneration.current;
    const simulationGeneration = `${sessionGeneration}:simulation:${++physicsSimulationSequence.current}`;
    physicsService.initialize(
      createAllNetworkPhysicsSeed({
        request: requestTemplate,
        dynamicPositions,
        attractors,
        constraintEligibleNodeKeys: new Set(
          latestInput.current.nodes.flatMap((node) =>
            node.attributes.nodeKind === 'document' ? [node.key] : [],
          ),
        ),
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
      coordinateGeneration: `${fingerprint}:${layoutCommitKey}:${spatialCommitKey}`,
      fixedTranslationByNodeKey,
    });
    return () => {
      session.setTemporaryFileMoveContext(
        undefined,
        latestTemporaryConstraintActive.current
          ? 'layout-changed'
          : 'mode-exit',
      );
      physicsService.invalidate('layout-changed');
      physicsFixedTranslationByNodeKey.current = new Map();
    };
  }, [
    fingerprint,
    layoutCommitKey,
    layoutPendingState,
    layoutSettings,
    physicsNodeCount,
    physicsServiceFactory,
    ready,
    requestTemplate,
    spatialCommitKey,
    spatialOverrides,
    spatialRules,
    spatialInfluenceSettings,
    temporaryConstraintActive,
    temporaryConstraintRetryKey,
  ]);

  useEffect(() => {
    const geometryReady =
      committedFinalGeometryGeneration === finalGeometryGeneration;
    if (
      !shouldApplyGlobalViewportRequest({
        geometryReady,
        handledKey: handledCenterRequest.current,
        layoutPending: layoutPending.current,
        ready,
        requestKey: centerRequest?.key,
      }) ||
      centerRequest === undefined
    ) {
      return;
    }
    const session = sessionRef.current;
    if (session === undefined) return;
    let cancelled = false;
    const request = centerRequest;
    void session
      .center(request)
      .then(() => {
        if (
          cancelled ||
          finalGeometryGenerationRef.current !== finalGeometryGeneration
        ) {
          return;
        }
        handledCenterRequest.current = request.key;
        callbacks.current.onCenterRequestConsumed?.(request.key);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        handledCenterRequest.current = request.key;
        callbacks.current.onCenterRequestConsumed?.(request.key);
        setLayoutError(`Could not center Global: ${errorMessage(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [
    centerRequest,
    committedFinalGeometryGeneration,
    finalGeometryGeneration,
    layoutCommitKey,
    ready,
  ]);

  useEffect(() => {
    const geometryReady =
      committedFinalGeometryGeneration === finalGeometryGeneration;
    if (
      !shouldApplyGlobalViewportRequest({
        geometryReady,
        handledKey: handledFitRequest.current,
        layoutPending: layoutPending.current,
        ready,
        requestKey: fitRequestKey,
      })
    ) {
      return;
    }
    handledFitRequest.current = fitRequestKey;
    const automaticRequestSuperseded =
      automaticFitRequestKey === fitRequestKey &&
      userCameraIntentGeneration.current > 0;
    if (!automaticRequestSuperseded) sessionRef.current?.fit();
    callbacks.current.onFitRequestConsumed?.(fitRequestKey);
  }, [
    automaticFitRequestKey,
    committedFinalGeometryGeneration,
    finalGeometryGeneration,
    fitRequestKey,
    layoutCommitKey,
    ready,
  ]);

  const zoomIn = useCallback(() => sessionRef.current?.zoomBy(0.82), []);
  const zoomOut = useCallback(() => sessionRef.current?.zoomBy(1.22), []);
  const fit = useCallback(() => {
    if (callbacks.current.onFitRequested !== undefined) {
      callbacks.current.onFitRequested();
      return;
    }
    sessionRef.current?.fit();
  }, []);
  const activeArrangementFolderKey = folderArrangement?.activeFolderKey;

  const nudgeActiveFolder = useCallback(
    (x: number, y: number) => {
      const session = sessionRef.current;
      const folderKey = folderArrangement?.activeFolderKey;
      if (session === undefined || folderKey === undefined) return;
      const base =
        ruleDraft?.folderKey === folderKey
          ? ruleDraft.anchor
          : keyboardPreview?.folderKey === folderKey
            ? keyboardPreview.anchor
            : (session.currentFolderAnchor(folderKey) ?? { x: 0, y: 0 });
      try {
        const anchor = offsetNormalizedFolderAnchor(base, { x, y });
        if (ruleDraft?.behavior === 'place') {
          session.previewFolderAnchor(folderKey, anchor);
        } else {
          session.positionFolderTargetAnchor(anchor);
        }
        keyboardPreviewRef.current = { folderKey, anchor };
        setKeyboardPreview({ folderKey, anchor });
        setRuleDraft((current) =>
          current?.folderKey === folderKey
            ? setFolderSpatialDraftAnchor(current, anchor)
            : current,
        );
        setActiveFolderPosition(anchor);
        setArrangementError(undefined);
        callbacks.current.folderArrangement?.onAnnouncement(
          `${folderLabel(folderKey)} target moved to ${describeNormalizedFolderAnchor(anchor)}`,
        );
      } catch (error: unknown) {
        setArrangementError(
          `Could not preview folder position: ${errorMessage(error)}`,
        );
      }
    },
    [folderArrangement?.activeFolderKey, keyboardPreview, ruleDraft],
  );

  const targetPointerViewportPoint = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): SpatialPoint => {
      const bounds = containerRef.current?.getBoundingClientRect();
      return {
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0),
      };
    },
    [],
  );

  const beginTargetPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const draft = ruleDraftRef.current;
      const arrangement = callbacks.current.folderArrangement;
      const session = sessionRef.current;
      if (
        event.button !== 0 ||
        draft === undefined ||
        session === undefined ||
        arrangement?.editorPhase === 'choosing-scope'
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      targetPointerDragRef.current = {
        pointerId: event.pointerId,
        element: event.currentTarget,
        folderKey: draft.folderKey,
        behavior: draft.behavior,
        startAnchor: draft.anchor,
        startViewportPoint: targetPointerViewportPoint(event),
        latestAnchor: draft.anchor,
        moved: false,
      };
      session.setFolderTargetPointerActive(true);
      setArrangementGesturePhase('primed');
    },
    [targetPointerViewportPoint],
  );

  const moveTargetPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = targetPointerDragRef.current;
      const session = sessionRef.current;
      if (
        drag === undefined ||
        drag.pointerId !== event.pointerId ||
        session === undefined
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        const anchor = session.folderTargetAnchorFromPointer(
          drag.startAnchor,
          drag.startViewportPoint,
          targetPointerViewportPoint(event),
        );
        if (anchorsEqual(drag.latestAnchor, anchor)) return;
        const firstMovement = !drag.moved;
        drag.latestAnchor = anchor;
        drag.moved = true;
        if (drag.behavior === 'place') {
          session.previewFolderAnchor(drag.folderKey, anchor);
        } else {
          session.positionFolderTargetAnchor(anchor);
        }
        keyboardPreviewRef.current = {
          folderKey: drag.folderKey,
          anchor,
        };
        setKeyboardPreview({ folderKey: drag.folderKey, anchor });
        setRuleDraft((current) =>
          current?.folderKey === drag.folderKey
            ? setFolderSpatialDraftAnchor(current, anchor)
            : current,
        );
        setActiveFolderPosition(anchor);
        setArrangementError(undefined);
        if (firstMovement) {
          setArrangementGesturePhase('dragging');
          callbacks.current.folderArrangement?.onTargetDraggingChange?.(true);
        }
      } catch (error: unknown) {
        cancelArrangementPreview('Target movement canceled');
        setArrangementError(
          `Could not move the spatial target: ${errorMessage(error)}`,
        );
      }
    },
    [cancelArrangementPreview, targetPointerViewportPoint],
  );

  const finishTargetPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = targetPointerDragRef.current;
      if (drag === undefined || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      targetPointerDragRef.current = undefined;
      sessionRef.current?.setFolderTargetPointerActive(false);
      releaseTargetPointerCapture(drag);
      callbacks.current.folderArrangement?.onTargetDraggingChange?.(false);
      if (!drag.moved) {
        setArrangementGesturePhase('idle');
        return;
      }
      setArrangementGesturePhase('committing');
      commitArrangementAnchor(drag.folderKey, drag.latestAnchor);
    },
    [commitArrangementAnchor],
  );

  const cancelTargetPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = targetPointerDragRef.current;
      if (drag === undefined || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      cancelArrangementPreview('Target movement canceled');
    },
    [cancelArrangementPreview],
  );

  const handleTargetMarkerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
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
      event.stopPropagation();
      nudgeActiveFolder(offset.x, offset.y);
    },
    [nudgeActiveFolder],
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
    if (ruleDraft === undefined) return;
    setArrangementGesturePhase('committing');
    commitArrangementAnchor(ruleDraft.folderKey, ruleDraft.anchor);
  }, [commitArrangementAnchor, ruleDraft]);

  const cancelRuleDraft = useCallback(() => {
    const folderKey = folderArrangement?.activeFolderKey;
    if (folderKey === undefined) return;
    cancelArrangementPreview();
    const defaultAnchor = sessionRef.current?.currentFolderAnchor(folderKey) ??
      activeConfirmedRule?.anchor ?? { x: 0, y: 0 };
    setRuleDraft(
      createFolderSpatialRuleDraft({
        folderKey,
        confirmedRule: draftBaselineRule,
        defaultAnchor,
      }),
    );
    setArrangementError(undefined);
    folderArrangement?.onAnnouncement(
      'Unapplied spatial rule changes canceled',
    );
  }, [
    activeConfirmedRule,
    cancelArrangementPreview,
    draftBaselineRule,
    folderArrangement,
  ]);

  const finishArrangement = useCallback(() => {
    if (draftDirty) {
      cancelRuleDraft();
      folderArrangement?.onAnnouncement(
        'Unapplied spatial rule changes were discarded; Arrange folders closed.',
      );
    }
    cancelArrangementPreview();
    folderArrangement?.onActiveChange(false);
  }, [
    cancelArrangementPreview,
    cancelRuleDraft,
    draftDirty,
    folderArrangement,
  ]);

  const resetActiveFolder = useCallback(() => {
    const folderKey = folderArrangement?.activeFolderKey;
    if (folderArrangement === undefined || folderKey === undefined) return;
    const failure = folderArrangement.onRemoveRule
      ? folderArrangement.onRemoveRule(folderKey)
      : folderArrangement.onResetFolder(folderKey);
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
      `${folderLabel(folderKey)} spatial rule removed`,
    );
  }, [folderArrangement]);

  const resetAllFolders = useCallback(() => {
    if (folderArrangement === undefined) return;
    const failure = folderArrangement.onClearRules
      ? folderArrangement.onClearRules()
      : folderArrangement.onResetAll();
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
    folderArrangement.onAnnouncement('All spatial rules removed');
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

  const arrangementScopeTree = folderArrangement?.scopeTree;
  const activeScopeTreeNode = useMemo(() => {
    const folderKey = activeArrangementFolderKey;
    const root = arrangementScopeTree;
    if (folderKey === undefined || root === undefined) return undefined;
    const pending = [root];
    while (pending.length > 0) {
      const candidate = pending.pop()!;
      if (candidate.folderKey === folderKey) return candidate;
      pending.push(...candidate.children);
    }
    return undefined;
  }, [activeArrangementFolderKey, arrangementScopeTree]);
  const customScopeRows = useMemo(
    () =>
      activeArrangementFolderKey === undefined
        ? []
        : flattenScopeTree(arrangementScopeTree, activeArrangementFolderKey),
    [activeArrangementFolderKey, arrangementScopeTree],
  );
  const visibleCustomScopeRows = useMemo(
    () => customScopeRows.slice(0, scopeTreeRowLimit),
    [customScopeRows, scopeTreeRowLimit],
  );
  const displayedRuleCount =
    folderArrangement?.ruleCount ?? folderArrangement?.anchorCount ?? 0;
  const inactiveRuleCount = useMemo(
    () =>
      spatialRules === undefined
        ? 0
        : resolveGlobalFolderSpatialRules(input, spatialRules).inactiveRules
            .length,
    [input, spatialRules],
  );

  return (
    <div
      className={`global-graph-canvas${folderArrangement?.active === true ? ' global-graph-canvas--arranging' : ''}`}
      data-arrangement-phase={arrangementGesturePhase}
      data-initial-presentation={initialPresentationReady ? 'ready' : 'pending'}
    >
      <div
        aria-hidden="true"
        className="global-graph-canvas__surface"
        ref={containerRef}
      />
      {folderArrangement?.active === true ? (
        <div
          aria-hidden="true"
          className={`global-graph-canvas__arrangement-spotlight${arrangementGesturePhase === 'dragging' ? ' global-graph-canvas__arrangement-spotlight--dragging' : ''}`}
          ref={spotlightRef}
        />
      ) : null}
      {folderArrangement?.active === true && ruleDraft !== undefined ? (
        <div
          aria-disabled={
            folderArrangement.editorPhase === 'choosing-scope'
              ? 'true'
              : undefined
          }
          aria-label={`Spatial target for ${folderLabel(ruleDraft.folderKey)}`}
          className={`global-graph-canvas__target-marker global-graph-canvas__target-marker--${ruleDraft.behavior}`}
          onKeyDown={handleTargetMarkerKeyDown}
          onLostPointerCapture={cancelTargetPointerDrag}
          onPointerCancel={cancelTargetPointerDrag}
          onPointerDown={beginTargetPointerDrag}
          onPointerMove={moveTargetPointerDrag}
          onPointerUp={finishTargetPointerDrag}
          ref={targetMarkerRef}
          role="button"
          tabIndex={folderArrangement.editorPhase === 'choosing-scope' ? -1 : 0}
        />
      ) : null}
      {projection.nodes.length === 0 && folderArrangement?.active !== true ? (
        <GlobalGraphEmptyState />
      ) : (
        <>
          <NetworkViewportControls
            label="All Network viewport controls"
            maximized={maximized}
            onFit={fit}
            onMaximizedChange={onMaximizedChange}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
          />
          {folderArrangement === undefined ? null : (
            <div className="global-graph-canvas__arrangement-tools">
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
                {folderArrangement.active ? 'Done' : 'Arrange folders'}
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
            </div>
          )}
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
                  <p>
                    Choose a folder, define its rule, then drag its spatial
                    target. Fixed placement also supports dragging an included
                    File.
                  </p>
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
              ) : ruleDraft === undefined ? (
                <p className="global-graph-canvas__arrangement-hint">
                  Preparing the spatial rule editor…
                </p>
              ) : (
                <>
                  <p className="global-graph-canvas__arrangement-folder">
                    <span>Active folder</span>
                    <strong>{folderLabel(activeArrangementFolderKey)}</strong>
                    {draftDirty ? <em>Unsaved changes</em> : null}
                  </p>
                  <fieldset className="global-graph-canvas__rule-options">
                    <legend>Behavior</legend>
                    <label>
                      <input
                        checked={ruleDraft.behavior === 'pull'}
                        name="folder-spatial-behavior"
                        onChange={() =>
                          setRuleDraft((current) =>
                            current === undefined
                              ? current
                              : setFolderSpatialDraftBehavior(current, 'pull'),
                          )
                        }
                        type="radio"
                      />
                      Dynamic pull
                    </label>
                    <label>
                      <input
                        checked={ruleDraft.behavior === 'place'}
                        name="folder-spatial-behavior"
                        onChange={() =>
                          setRuleDraft((current) =>
                            current === undefined
                              ? current
                              : setFolderSpatialDraftBehavior(current, 'place'),
                          )
                        }
                        type="radio"
                      />
                      Fixed placement
                    </label>
                  </fieldset>
                  {ruleDraft.behavior === 'pull' ? (
                    <label className="global-graph-canvas__strength">
                      <span>
                        Pull strength <strong>{ruleDraft.strength}</strong>
                      </span>
                      <input
                        aria-label="Pull strength"
                        max="100"
                        min="0"
                        onChange={(event) =>
                          setRuleDraft((current) =>
                            current === undefined
                              ? current
                              : setFolderSpatialDraftStrength(
                                  current,
                                  Number(event.currentTarget.value),
                                ),
                          )
                        }
                        step="1"
                        type="range"
                        value={ruleDraft.strength}
                      />
                      <small>
                        0 = no pull · 100 = strongest soft pull, not exact
                      </small>
                    </label>
                  ) : null}
                  <fieldset className="global-graph-canvas__rule-options">
                    <legend>Scope</legend>
                    {(['exact', 'subtree', 'custom'] as const).map((preset) => (
                      <button
                        aria-pressed={ruleDraft.scopePreset === preset}
                        key={preset}
                        onClick={() =>
                          setRuleDraft((current) =>
                            current === undefined
                              ? current
                              : setFolderSpatialDraftScopePreset(
                                  current,
                                  preset,
                                ),
                          )
                        }
                        type="button"
                      >
                        {scopePresetLabel(preset)}
                      </button>
                    ))}
                  </fieldset>
                  <p className="global-graph-canvas__scope-summary">
                    {scopeVisualization?.activeMemberNodeKeys.length ?? 0}{' '}
                    included ·{' '}
                    {scopeVisualization?.excludedCandidateNodeKeys.length ?? 0}{' '}
                    excluded ·{' '}
                    {scopeVisualization?.shadowedByChildNodeKeys.length ?? 0}{' '}
                    child-owned
                  </p>
                  {ruleDraft.scopePreset === 'custom' ? (
                    <div className="global-graph-canvas__scope-editor">
                      <label>
                        <input
                          checked={ruleDraft.customScope.includeRootFiles}
                          onChange={(event) => {
                            setRuleDraft((current) =>
                              current === undefined
                                ? current
                                : setFolderSpatialDraftRootFiles(
                                    current,
                                    event.currentTarget.checked,
                                  ),
                            );
                            pulseScope(ruleDraft.folderKey);
                          }}
                          type="checkbox"
                        />
                        Files directly in {folderLabel(ruleDraft.folderKey)} (
                        {activeScopeTreeNode?.directFileCount ?? 0})
                      </label>
                      <div
                        aria-label="Included subfolders"
                        className="global-graph-canvas__scope-tree"
                        role="group"
                      >
                        {customScopeRows.length === 0 ? (
                          <p>No subfolders in this workspace.</p>
                        ) : (
                          <>
                            {visibleCustomScopeRows.map((row) => {
                              const blocking = nearestExcludedFolder(
                                ruleDraft,
                                row.folderKey,
                              );
                              const childOwnRule =
                                row.ownRule !== undefined &&
                                row.folderKey !== ruleDraft.folderKey;
                              return (
                                <div
                                  className={
                                    scopePulseKey === row.folderKey
                                      ? 'global-graph-canvas__scope-row global-graph-canvas__scope-row--pulse'
                                      : 'global-graph-canvas__scope-row'
                                  }
                                  key={row.folderKey}
                                  style={{
                                    paddingInlineStart: `${Math.max(0, row.depth - (activeScopeTreeNode?.depth ?? 0) - 1) * 0.8}rem`,
                                  }}
                                >
                                  <label>
                                    <input
                                      checked={blocking === undefined}
                                      disabled={
                                        blocking !== undefined &&
                                        blocking !== row.folderKey
                                      }
                                      onChange={() => {
                                        setRuleDraft((current) =>
                                          current === undefined
                                            ? current
                                            : toggleFolderSpatialDraftSubtree(
                                                current,
                                                row.folderKey,
                                              ),
                                        );
                                        pulseScope(row.folderKey);
                                      }}
                                      type="checkbox"
                                    />
                                    <span>{row.name}</span>
                                    <small>
                                      {row.totalFileCount} Files
                                      {row.visibleFileCount ===
                                      row.totalFileCount
                                        ? ''
                                        : ` · ${row.visibleFileCount} visible`}
                                    </small>
                                  </label>
                                  {childOwnRule ? (
                                    <button
                                      aria-label={`Edit child rule ${row.folderKey}`}
                                      onClick={() =>
                                        folderArrangement.onEditChildRule?.(
                                          row.folderKey,
                                        )
                                      }
                                      type="button"
                                    >
                                      {row.ownRule?.behavior === 'pull'
                                        ? 'Pull'
                                        : 'Place'}{' '}
                                      · Edit child rule
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
                            {visibleCustomScopeRows.length <
                            customScopeRows.length ? (
                              <button
                                onClick={() =>
                                  setScopeTreeRowLimit((current) =>
                                    Math.min(
                                      current + SCOPE_TREE_PAGE_SIZE,
                                      customScopeRows.length,
                                    ),
                                  )
                                }
                                type="button"
                              >
                                Show more folders (
                                {customScopeRows.length -
                                  visibleCustomScopeRows.length}{' '}
                                remaining)
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                      <button
                        aria-pressed={
                          folderArrangement.editorPhase === 'choosing-scope'
                        }
                        onClick={() =>
                          folderArrangement.onChoosingScopeChange?.(
                            folderArrangement.editorPhase !== 'choosing-scope',
                          )
                        }
                        type="button"
                      >
                        {folderArrangement.editorPhase === 'choosing-scope'
                          ? 'Done selecting'
                          : 'Choose included folders'}
                      </button>
                      {folderArrangement.editorPhase === 'choosing-scope' ? (
                        <small>
                          Click visible Files to toggle their folder subtree.
                          Target dragging is paused.
                        </small>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="global-graph-canvas__arrangement-position">
                    Target: {describeNormalizedFolderAnchor(ruleDraft.anchor)}
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
                      disabled={!draftDirty && keyboardPreview === undefined}
                      onClick={saveKeyboardPreview}
                      type="button"
                    >
                      Apply changes
                    </button>
                    <button
                      disabled={!draftDirty && keyboardPreview === undefined}
                      onClick={cancelRuleDraft}
                      type="button"
                    >
                      Cancel changes
                    </button>
                    {activeConfirmedRule === undefined ? null : (
                      <button onClick={resetActiveFolder} type="button">
                        Remove spatial rule
                      </button>
                    )}
                  </div>
                  {folderArrangement.editorPhase === 'settling-pull' ? (
                    <p aria-live="polite">Settling Dynamic pull…</p>
                  ) : null}
                </>
              )}
              <p className="global-graph-canvas__arrangement-persistence">
                {folderArrangement.persistenceStatus} · {displayedRuleCount}{' '}
                spatial {displayedRuleCount === 1 ? 'rule' : 'rules'}
                {inactiveRuleCount === 0
                  ? ''
                  : ` · ${inactiveRuleCount} inactive in the current graph`}
              </p>
              {folderArrangement.canRecoverCorrupt === true ? (
                <button onClick={recoverCorruptArrangement} type="button">
                  Clear invalid saved positions
                </button>
              ) : displayedRuleCount === 0 ? null : confirmResetAll ? (
                <div
                  className="global-graph-canvas__arrangement-confirm"
                  role="group"
                  aria-label="Confirm remove all spatial rules"
                >
                  <span>Remove all {displayedRuleCount} spatial rules?</span>
                  <button onClick={resetAllFolders} type="button">
                    Reset all
                  </button>
                  <button
                    onClick={() => setConfirmResetAll(false)}
                    type="button"
                  >
                    Keep rules
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmResetAll(true)} type="button">
                  Reset all rules…
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
