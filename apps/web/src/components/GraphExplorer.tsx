import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';

import {
  workspaceFolderKeyContainsFolder,
  workspaceFolderKeyFromPath,
  type AddressableEntity,
  type EntityId,
  type KnowledgeSnapshot,
  type WorkspaceFolderKey,
} from '@icarus-graph-explorer/core';
import type { DiagnosticIdentityStability } from '@icarus-graph-explorer/diagnostics-obsidian';
import { createInspectionWorkspace } from '@icarus-graph-explorer/explorer-inspection';
import {
  listExactPathExclusions,
  listFolderExclusions,
} from '@icarus-graph-explorer/graph-query';
import type { PerformanceInstrumentation } from '@icarus-graph-explorer/performance';
import {
  GraphCanvas,
  type GraphCenterRequest,
  type FocusAppearance,
  type GraphSelection,
  type GraphTransitionAnchor,
  type GraphTransitionAnchorApi,
  type GraphViewportObservation,
  type TrackpadZoomMode,
} from '@icarus-graph-explorer/renderer-reactflow';
import {
  createPersistedWorkspaceView,
  reconcileCurrentWorkspaceView,
  serializePersistedWorkspaceView,
  type PersistedViewportAnchor,
  type PersistedGlobalViewport,
  type PersistedLocalViewport,
  type PersistedRendererViewports,
  type GraphPresentationMode,
  type LocalLayoutMode,
} from '@icarus-graph-explorer/view-state';
import {
  createProjectionWorkspace,
  projectLocalView,
  projectStructureView,
  projectView,
  type ProjectionNodeId,
  type ViewProjection,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import type {
  GlobalCenterRequest,
  GlobalDensityQaDiagnostics,
  GlobalLayoutSettings,
  GlobalSelection,
  GlobalTransitionAnchorApi,
  LocalCenterRequest,
  LocalDensityQaDiagnostics,
  LocalSelection,
  LocalTransitionAnchorApi as LocalFreeTransitionAnchorApi,
  SemanticGlobalViewport,
  SemanticLocalViewport,
} from '@icarus-graph-explorer/renderer-sigma/types';
import type {
  NetworkPhysicsLifecycleState,
  NetworkStartupTrace,
  TemporaryFileMoveController,
  TemporaryNodeConstraintCapability,
  TemporaryNodeConstraintEndReason,
} from '@icarus-graph-explorer/renderer-sigma';
import { NETWORK_PHYSICS_SUPPORTED_NODE_LIMIT } from '@icarus-graph-explorer/renderer-sigma/physics';
import type { NetworkPhysicsPresentationState } from '@icarus-graph-explorer/renderer-sigma/physics';
import { resolveNetworkSettings } from '@icarus-graph-explorer/renderer-sigma/settings';
import {
  compileVisualGroups,
  matchingVisualGroupsForEntity,
  type CompiledVisualGroups,
  type VisualGroupMatch,
  type VisualGroupPresentationMap,
} from '@icarus-graph-explorer/visual-groups';

import { graphHistoryShortcut } from '../graph-history-shortcuts';
import {
  createNetworkExplorerModel,
  type NetworkExplorerFolderState,
  type NetworkExplorerRevealRequest,
} from '../network-explorer-model';
import {
  containingDocumentEntityId,
  effectiveGlobalProjectionState,
  withExplicitGlobalReferenceStatus,
} from '../global-view';
import {
  graphStateReducer,
  initialGraphState,
  normalizeGraphState,
  type GraphStateAction,
} from '../graph-state';
import {
  createGraphHistoryCheckpoint,
  createGraphNavigationHistory,
  goBackInGraphHistory,
  goForwardInGraphHistory,
  graphHistoryActionPolicy,
  nextGraphViewportRequestKey,
  normalizeAvailableGraphHistory,
  planSemanticViewportRestore,
  recordGraphNavigation,
  returnToAllInGraphHistory,
  sameGraphViewState,
  type GraphHistoryCheckpoint,
  type GraphHistoryTraversal,
  type GraphNavigationHistory,
} from '../navigation-history';
import { planEntityNavigation, topLevelPathScopes } from '../navigation';
import { planLocalEntityNavigation, planLocalEntry } from '../local-view';
import {
  allPresentationMode,
  allHierarchyAvailable,
  resolveAvailablePresentationMode,
  explorationLayout,
  explorationScope,
  focusLayoutMode,
  globalLayoutSettingsApplyImmediately,
  globalLayoutSettingsRequireImmediateLayout,
  hierarchyVisualVariantForScope,
  type ExplorationLayout,
  type ExplorationScope,
} from '../exploration-model';
import {
  addSavedGraphFilter,
  createEmptySavedGraphFilterRegistry,
  deleteSavedGraphFilter,
  loadSavedGraphFilters,
  saveSavedGraphFilterRegistry,
  type SavedGraphFilterRegistry,
} from '../persistence/saved-filters';
import {
  addSavedView,
  deleteSavedView,
  renameSavedView,
  updateSavedView,
  type SavedViewRegistry,
} from '../persistence/saved-views';
import {
  commitSavedViewSessionMutation,
  createSavedViewSession,
  resetSavedViewSession,
} from '../persistence/saved-views-session';
import type { VisualGroupRegistry } from '../persistence/visual-groups';
import {
  hydrateGraphView,
  persistenceEligibility,
} from '../persistence/session';
import {
  browserStorage,
  clearWorkspaceView,
  saveWorkspaceView,
  type StorageLike,
} from '../persistence/storage';
import {
  loadGraphPreferences,
  normalizeModularFocusSoftFolderStrength,
  saveGraphPreferences,
  type FocusHierarchyImplementation,
  type GraphPreferences,
} from '../preferences/graph-preferences';
import {
  DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH,
  DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH,
  resetGraphSandbox,
} from '../preferences/sandbox-settings';
import { deriveProjectionVisualGroupPresentationMap } from '../visual-groups/presentation';
import {
  captureSavedView,
  planSavedViewApply,
  sameSavedViewSnapshot,
} from '../saved-view';
import { usePresentationOverrides } from '../presentation-overrides/use-presentation-overrides';
import { useSpatialOverrides } from '../spatial-overrides/use-spatial-overrides';
import { useSoftFolderDisplay } from '../soft-folder-display/use-soft-folder-display';
import {
  folderArrangementActive,
  folderArrangementActiveFolder,
  folderArrangementModeReducer,
  INACTIVE_FOLDER_ARRANGEMENT_MODE,
} from '../spatial-overrides/arrangement';
import { createFolderScopeTree } from '../spatial-overrides/folder-scope-model';
import {
  NETWORK_EDITING_OFF,
  reduceNetworkEditing,
  type NetworkEditingAction,
  type NetworkEditingState,
} from '../network-editing';
import {
  commitVisualGroupSessionMutation,
  createVisualGroupSession,
  resetCorruptVisualGroupSession,
} from '../visual-groups/session';
import { createDagreLayoutWorkerService } from '../workers/dagre-layout-worker-client';
import { EntitySearch } from './EntitySearch';
import { ExplorationControls } from './ExplorationControls';
import { retainGraphSelection } from './controlled-selection';
import { GraphFilters } from './GraphFilters';
import { GraphHistoryControls } from './GraphHistoryControls';
import { GraphSettings } from './GraphSettings';
import {
  CLOSED_GRAPH_WORKSPACE_OVERLAYS,
  graphWorkspaceOverlayReducer,
} from './graph-workspace-overlays';
import { activateMaximizedGraphMode } from './maximized-graph-mode';
import { ProvenanceInspector } from './ProvenanceInspector';
import { NetworkExplorer } from './NetworkExplorer';
import { NetworkEditingControls } from './NetworkEditingControls';
import type { SavedGraphQueriesState } from './SavedGraphQueries';
import type { SavedViewsState } from './SavedViews';
import { SavedViewsPopover } from './SavedViewsPopover';
import { StructureDepthControl } from './StructureDepthControl';
import { VisualGroups } from './VisualGroups';
import type { GlobalGraphViewProps } from './GlobalGraphView';
import type { LocalGraphViewProps } from './LocalGraphView';
import type {
  LocalStructuredGraphViewProps,
  SemanticLocalStructuredViewport,
} from './LocalStructuredGraphView';
import type { ModularStructuredGraphViewProps } from './ModularStructuredGraphView';
import { useWorkerServiceDisposal } from './use-worker-service-disposal';
import { useGraphQueryDraft } from './use-graph-query-draft';

interface ProjectionSuccess {
  readonly ok: true;
  readonly projection: ViewProjection;
}

interface ProjectionFailure {
  readonly ok: false;
  readonly message: string;
}

type ProjectionResult = ProjectionSuccess | ProjectionFailure;

interface PendingHistoryViewportRestore {
  readonly key: number;
  readonly presentationMode: GraphPresentationMode;
  readonly viewports: PersistedRendererViewports;
}

interface SavedFilterSession {
  readonly registry: SavedGraphFilterRegistry;
  readonly writable: boolean;
  readonly status: string;
  readonly error?: string;
}

interface VisualGroupCompilation {
  readonly compiled: CompiledVisualGroups;
  readonly error?: string;
}

interface VisualGroupPresentation {
  readonly styles: VisualGroupPresentationMap;
  readonly error?: string;
}

const ENTITY_NAVIGATION_ZOOM = 1.1;
const GLOBAL_NAVIGATION_RATIO = 0.32;
const LOCAL_NAVIGATION_RATIO = 0.48;
const LOCAL_STRUCTURED_NAVIGATION_ZOOM = 0.92;
const NARROW_GRAPH_WORKSPACE_MEDIA_QUERY = '(max-width: 900px)';

const GRAPH_HISTORY_SHORTCUT_EXCLUSION_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-graph-history-shortcuts="off"]';

const emptyVisualGroupCompilation = compileVisualGroups([]);
if (!emptyVisualGroupCompilation.ok) {
  throw new Error('The empty Visual Group registry must compile.');
}
const EMPTY_COMPILED_VISUAL_GROUPS = emptyVisualGroupCompilation.value;
const EMPTY_VISUAL_GROUP_PRESENTATIONS: VisualGroupPresentationMap = new Map();

function historyShortcutTargetIsExcluded(target: EventTarget | null): boolean {
  return (
    typeof Element === 'undefined' ||
    !(target instanceof Element) ||
    target.closest(GRAPH_HISTORY_SHORTCUT_EXCLUSION_SELECTOR) !== null
  );
}

function selectionExists(
  projection: ViewProjection,
  selection: GraphSelection | null,
): boolean {
  if (selection === null) return false;
  return selection.kind === 'node'
    ? projection.nodes.some((node) => node.id === selection.id)
    : projection.edges.some((edge) => edge.id === selection.id);
}

function selectedEntityId(
  projection: ViewProjection | undefined,
  selection: GraphSelection | null,
): EntityId | undefined {
  if (projection === undefined || selection?.kind !== 'node') return undefined;
  const node = projection.nodes.find(
    (candidate) => candidate.id === selection.id,
  );
  return node?.kind === 'entity' ? node.entityId : undefined;
}

function ToolsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="graph-shell-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function InspectorSidebarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="graph-shell-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <path d="M15 4v16" />
    </svg>
  );
}

function NetworkExplorerIcon() {
  return (
    <svg
      aria-hidden="true"
      className="graph-shell-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <path d="M9 4v16M5.5 8h1M5.5 12h1M5.5 16h1" />
    </svg>
  );
}

function ProjectionIssues({
  projection,
}: {
  readonly projection: ViewProjection | undefined;
}) {
  if (projection === undefined || projection.issues.length === 0) return null;
  return (
    <details className="projection-issues">
      <summary>{projection.issues.length} Projection Issues</summary>
      <ul>
        {projection.issues.map((issue) => (
          <li key={`${issue.code}:${issue.subject}`}>{issue.message}</li>
        ))}
      </ul>
    </details>
  );
}

export function GraphExplorer({
  applicationOverlayOpen = false,
  identityStability,
  initialViewport = 'restore',
  maximized,
  networkStartupCapabilityDelayMs = 0,
  onMaximizedChange,
  networkStartupTrace,
  performance,
  performanceUpdateKey,
  settingsContent,
  snapshot,
  storage,
}: {
  readonly applicationOverlayOpen?: boolean;
  readonly identityStability?: DiagnosticIdentityStability;
  /** Source-session camera policy; later navigation and live updates are unaffected. */
  readonly initialViewport?: 'fit' | 'restore';
  readonly maximized: boolean;
  /** QA-only delayed capability adoption; zero in ordinary production. */
  readonly networkStartupCapabilityDelayMs?: number;
  readonly onMaximizedChange: (maximized: boolean) => void;
  /** Explicit QA trace; absent from ordinary production sessions. */
  readonly networkStartupTrace?: NetworkStartupTrace;
  /** Optional memory-only KG12 instrumentation, enabled by the app boundary. */
  readonly performance?: PerformanceInstrumentation;
  /** Runtime-only live-update correlation token; never persisted. */
  readonly performanceUpdateKey?: string;
  readonly settingsContent?: ReactNode;
  readonly snapshot: KnowledgeSnapshot;
  readonly storage?: StorageLike | null;
}) {
  const projectionWorkspace = useMemo(() => {
    const create = () => createProjectionWorkspace(snapshot);
    return performance === undefined
      ? create()
      : performance.measure(
          'projection-workspace',
          'projection-workspace-builds',
          create,
        );
  }, [performance, snapshot]);
  const layoutService = useMemo(() => createDagreLayoutWorkerService(), []);
  useWorkerServiceDisposal(layoutService);
  const [persistenceStorage] = useState(() =>
    storage === null ? undefined : (storage ?? browserStorage()),
  );
  const [preferenceLoad] = useState(() =>
    loadGraphPreferences(persistenceStorage),
  );
  const [preferenceWarning, setPreferenceWarning] = useState<
    string | undefined
  >(preferenceLoad.warning ?? undefined);
  const [{ activeOverlay, activeToolPanel }, dispatchWorkspaceOverlay] =
    useReducer(graphWorkspaceOverlayReducer, CLOSED_GRAPH_WORKSPACE_OVERLAYS);
  const filtersOpen = activeToolPanel === 'filters';
  const groupsOpen = activeToolPanel === 'groups';
  const eligibility = persistenceEligibility(identityStability);
  const workspaceId = projectionWorkspace.snapshot().workspace.id;
  const loadedVisualGroupSession = useMemo(
    () =>
      createVisualGroupSession({
        eligibility,
        storage: persistenceStorage,
        workspaceId,
      }),
    [eligibility, persistenceStorage, workspaceId],
  );
  const visualGroupSessionKey = `${eligibility}\0${workspaceId}`;
  const [visualGroupSessions, setVisualGroupSessions] = useState(
    () => new Map([[visualGroupSessionKey, loadedVisualGroupSession]]),
  );
  // The keyed map preserves same-page session-only edits while ensuring a
  // prop-level workspace switch can never render another workspace's groups.
  const activeVisualGroupSession =
    visualGroupSessions.get(visualGroupSessionKey) ?? loadedVisualGroupSession;
  const adoptVisualGroupSession = useCallback(
    (nextSession: typeof activeVisualGroupSession) => {
      setVisualGroupSessions((current) => {
        const next = new Map(current);
        next.set(visualGroupSessionKey, nextSession);
        return next;
      });
    },
    [visualGroupSessionKey],
  );
  const [savedFilterSession, setSavedFilterSession] =
    useState<SavedFilterSession>(() => {
      const registry = createEmptySavedGraphFilterRegistry(workspaceId);
      if (eligibility !== 'stable') {
        return {
          registry,
          writable: false,
          status:
            'Saving is unavailable because this workspace does not have stable identity. Advanced queries still work for this session.',
        };
      }
      if (persistenceStorage === undefined) {
        return {
          registry,
          writable: false,
          status:
            'Saving is unavailable because browser storage could not be accessed. Advanced queries still work for this session.',
        };
      }
      const loaded = loadSavedGraphFilters(persistenceStorage, workspaceId);
      if (loaded.status === 'error') {
        return {
          registry,
          writable: false,
          status:
            'Saved Filters are unavailable until the stored value is repaired outside the app.',
          error: `${loaded.message} The stored value was left unchanged.`,
        };
      }
      return {
        registry: loaded.value,
        writable: true,
        status:
          loaded.status === 'loaded'
            ? 'Saved Filters are stored for this stable workspace.'
            : 'No Saved Filters have been stored for this stable workspace.',
      };
    });
  const [savedViewSession, setSavedViewSession] = useState(() =>
    createSavedViewSession({
      eligibility,
      storage: persistenceStorage,
      workspaceId,
    }),
  );
  const [hydration] = useState(() =>
    hydrateGraphView({
      eligibility,
      storage: persistenceStorage,
      workspace: projectionWorkspace,
    }),
  );
  const [initialViewState] = useState(() =>
    normalizeGraphState(hydration.state),
  );
  const legacyFocusedStructure =
    hydration.presentationMode === 'structure' &&
    initialViewState.focus !== undefined;
  const [preferences, setPreferences] = useState<GraphPreferences>(() => ({
    ...preferenceLoad.preferences,
    localLayoutMode: legacyFocusedStructure
      ? 'structured'
      : preferenceLoad.preferences.localLayoutMode,
  }));
  const preferencesRef = useRef(preferences);
  const [
    allNetworkDensityFramingStrength,
    setAllNetworkDensityFramingStrength,
  ] = useState(DEFAULT_GLOBAL_DENSITY_FRAMING_STRENGTH);
  const [
    focusNetworkDensityFramingStrength,
    setFocusNetworkDensityFramingStrength,
  ] = useState(DEFAULT_LOCAL_DENSITY_FRAMING_STRENGTH);
  const [allNetworkDensityQaDiagnostics, setAllNetworkDensityQaDiagnostics] =
    useState<GlobalDensityQaDiagnostics>();
  const [
    focusNetworkDensityQaDiagnostics,
    setFocusNetworkDensityQaDiagnostics,
  ] = useState<LocalDensityQaDiagnostics | undefined>();
  const {
    focusAppearance,
    focusHierarchyImplementation,
    globalLayoutSettings,
    localLayoutMode,
    modularFocusHeadingOrder,
    modularFocusInternalLayout,
    modularFocusMacroLayout,
    modularFocusSoftFolderStrength,
    modularFolderStripsVisible,
    modularConnectionStyle,
    trackpadZoomMode,
    showExperimentalAllHierarchy,
  } = preferences;
  const networkSettings = useMemo(
    () => resolveNetworkSettings(globalLayoutSettings),
    [globalLayoutSettings],
  );
  const commitGraphPreferences = useCallback(
    (next: GraphPreferences) => {
      preferencesRef.current = next;
      setPreferences(next);
      const saved = saveGraphPreferences(persistenceStorage, next);
      setPreferenceWarning(saved.ok ? undefined : saved.message);
    },
    [persistenceStorage],
  );
  // Every control patches the same complete record, including updates batched
  // before React renders. Storage failure does not roll back session behavior.
  const updateGraphPreferences = useCallback(
    (patch: Partial<GraphPreferences>) => {
      commitGraphPreferences({ ...preferencesRef.current, ...patch });
    },
    [commitGraphPreferences],
  );
  const localLayoutModeRef = useRef(localLayoutMode);
  const [rendererMode, setRendererMode] = useState<GraphPresentationMode>(
    resolveAvailablePresentationMode(
      legacyFocusedStructure ? 'local' : hydration.presentationMode,
      initialViewState,
      { showExperimentalAllHierarchy, allNetworkAvailable: true },
    ),
  );
  const rendererModeRef = useRef(rendererMode);
  const [globalUnavailable, setGlobalUnavailable] = useState<string>();
  const [GlobalGraphView, setGlobalGraphView] =
    useState<ComponentType<GlobalGraphViewProps>>();
  const [localFreeUnavailable, setLocalFreeUnavailable] = useState<string>();
  const [localStructuredUnavailable, setLocalStructuredUnavailable] =
    useState<string>();
  const [modularLoadFailure, setModularLoadFailure] = useState<{
    workspaceId: string;
    message: string;
  }>();
  const [modularSessionFailureState, setModularSessionFailureState] = useState<{
    workspaceId: string;
    message: string;
  }>();
  const [LocalGraphView, setLocalGraphView] =
    useState<ComponentType<LocalGraphViewProps>>();
  const [LocalStructuredGraphView, setLocalStructuredGraphView] =
    useState<ComponentType<LocalStructuredGraphViewProps>>();
  const [ModularStructuredGraphView, setModularStructuredGraphView] =
    useState<ComponentType<ModularStructuredGraphViewProps>>();
  const modularPreviewRequested =
    focusHierarchyImplementation === 'modular-preview';
  const modularLoadUnavailable =
    modularLoadFailure?.workspaceId === workspaceId
      ? modularLoadFailure.message
      : undefined;
  const modularSessionFailure =
    modularSessionFailureState?.workspaceId === workspaceId
      ? modularSessionFailureState.message
      : undefined;
  const modularPreviewActive =
    modularPreviewRequested && modularSessionFailure === undefined;
  const localUnavailable =
    localLayoutMode === 'free'
      ? localFreeUnavailable
      : modularPreviewActive
        ? undefined
        : localStructuredUnavailable;
  const legacyBlockFilterNormalized = initialViewState !== hydration.state;
  const [viewState, dispatch] = useReducer(graphStateReducer, initialViewState);
  const visualGroupCompilation = useMemo<VisualGroupCompilation>(() => {
    try {
      const result = compileVisualGroups(
        activeVisualGroupSession.registry.groups,
      );
      if (!result.ok) {
        return {
          compiled: EMPTY_COMPILED_VISUAL_GROUPS,
          error:
            result.issues[0]?.message ??
            'Visual Groups could not be compiled. Node colors were left unchanged.',
        };
      }
      return { compiled: result.value };
    } catch (error: unknown) {
      return {
        compiled: EMPTY_COMPILED_VISUAL_GROUPS,
        error: `Visual Groups could not be compiled: ${
          error instanceof Error ? error.message : String(error)
        } Node colors were left unchanged.`,
      };
    }
  }, [activeVisualGroupSession.registry.groups]);
  const visualGroupEntityById = useMemo(
    () =>
      new Map<EntityId, AddressableEntity>(
        snapshot.entities.map((entity) => [entity.id, entity]),
      ),
    [snapshot],
  );
  const nodePresentation = usePresentationOverrides({
    workspaceId,
    eligibility,
    storage: persistenceStorage,
    entityById: visualGroupEntityById,
  });
  const spatialOverrides = useSpatialOverrides({
    workspaceId,
    eligibility,
    storage: persistenceStorage,
  });
  const workspaceSoftFolderFiles = useMemo(
    () =>
      snapshot.entities
        .flatMap((entity) =>
          entity.kind === 'document'
            ? [
                {
                  fileId: entity.id,
                  exactFolderKey: workspaceFolderKeyFromPath(
                    entity.source.path,
                  ),
                },
              ]
            : [],
        )
        .sort((left, right) => left.fileId.localeCompare(right.fileId)),
    [snapshot.entities],
  );
  const softFolderDisplay = useSoftFolderDisplay({
    workspaceId,
    workspaceFiles: workspaceSoftFolderFiles,
    eligibility,
    storage: persistenceStorage,
  });
  const [folderArrangementMode, dispatchFolderArrangementMode] = useReducer(
    folderArrangementModeReducer,
    INACTIVE_FOLDER_ARRANGEMENT_MODE,
  );
  const [folderArrangementDraftDirty, setFolderArrangementDraftDirty] =
    useState(false);
  const [networkEditingState, setNetworkEditingState] =
    useState<NetworkEditingState>(NETWORK_EDITING_OFF);
  const [temporaryFileMoveController, setTemporaryFileMoveController] =
    useState<TemporaryFileMoveController>();
  const temporaryFileMoveControllerRef = useRef<
    TemporaryFileMoveController | undefined
  >(undefined);
  const temporaryFileMoveCapabilityTimerRef = useRef<number | undefined>(
    undefined,
  );
  const [temporaryFileMoveCapability, setTemporaryFileMoveCapability] =
    useState<TemporaryNodeConstraintCapability>({
      status: 'unavailable',
      reason: 'simulation-not-running',
    });
  const [temporaryFileMoveLifecycle, setTemporaryFileMoveLifecycle] =
    useState<NetworkPhysicsLifecycleState>('sleeping');
  const [temporaryFileMovePresentation, setTemporaryFileMovePresentation] =
    useState<NetworkPhysicsPresentationState>('idle');
  const [temporaryFileMoveFailure, setTemporaryFileMoveFailure] =
    useState<string>();
  const [temporaryFileMoveRetryKey, setTemporaryFileMoveRetryKey] = useState(0);
  const [keyboardFileMoveNodeId, setKeyboardFileMoveNodeId] =
    useState<ProjectionNodeId>();
  const [keyboardFileMoveRequestKey, setKeyboardFileMoveRequestKey] =
    useState(0);
  const handledKeyboardFileMoveRequest = useRef(0);
  const transitionNetworkEditing = useCallback(
    (
      action: NetworkEditingAction,
      cancellationReason: Exclude<
        TemporaryNodeConstraintEndReason,
        'released'
      > = 'mode-exit',
    ) => {
      const transition = reduceNetworkEditing(networkEditingState, action);
      if (transition.clearActiveGesture) {
        temporaryFileMoveController?.cancel(cancellationReason);
      }
      setNetworkEditingState(transition.state);
      if (transition.state.phase === 'editing') {
        setKeyboardFileMoveNodeId(undefined);
      }
      return transition;
    },
    [networkEditingState, temporaryFileMoveController],
  );
  const [
    folderArrangementFocusRequestKey,
    setFolderArrangementFocusRequestKey,
  ] = useState(0);
  const [folderArrangementAvailability, setFolderArrangementAvailability] =
    useState<{
      readonly available: boolean;
      readonly reason?: string;
    }>({
      available: false,
      reason: 'Wait for the All Network renderer to start',
    });
  const changeFolderArrangementAvailability = useCallback(
    (available: boolean, reason: string | undefined) => {
      setFolderArrangementAvailability((current) =>
        current.available === available && current.reason === reason
          ? current
          : {
              available,
              ...(reason === undefined ? {} : { reason }),
            },
      );
    },
    [],
  );
  const currentReconciliation = useMemo(
    () => reconcileCurrentWorkspaceView(projectionWorkspace, viewState),
    [projectionWorkspace, viewState],
  );
  const activeViewState = currentReconciliation.state;
  const globalViewState = useMemo(
    () => effectiveGlobalProjectionState(projectionWorkspace, activeViewState),
    [activeViewState, projectionWorkspace],
  );
  const globalResult = useMemo<ProjectionResult | undefined>(() => {
    if (rendererMode !== 'global') return undefined;
    try {
      const project = () => projectView(projectionWorkspace, globalViewState);
      return {
        ok: true,
        projection:
          performance === undefined
            ? project()
            : performance.measure(
                'global-projection',
                'global-projections',
                project,
              ),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message: `All Network projection failed: ${message}`,
      };
    }
  }, [globalViewState, performance, projectionWorkspace, rendererMode]);
  const localResult = useMemo<ProjectionResult | undefined>(() => {
    if (rendererMode !== 'local') return undefined;
    try {
      const project = () =>
        projectLocalView(projectionWorkspace, activeViewState);
      return {
        ok: true,
        projection:
          performance === undefined
            ? project()
            : performance.measure(
                'local-projection',
                'local-projections',
                project,
              ),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Focus projection failed: ${message}` };
    }
  }, [activeViewState, performance, projectionWorkspace, rendererMode]);
  const globalProjectionFailure =
    rendererMode === 'global' && globalResult?.ok === false
      ? `${globalResult.message} All Hierarchy remains available for this session.`
      : undefined;
  const globalFailure = globalUnavailable ?? globalProjectionFailure;
  const availability = useMemo(
    () => ({
      showExperimentalAllHierarchy,
      allNetworkAvailable: globalFailure === undefined,
    }),
    [showExperimentalAllHierarchy, globalFailure],
  );
  const availabilityRef = useRef(availability);
  useLayoutEffect(() => {
    availabilityRef.current = availability;
  }, [availability]);
  const allHierarchyExposed = allHierarchyAvailable(availability);
  const effectiveRendererMode = resolveAvailablePresentationMode(
    rendererMode,
    activeViewState,
    availability,
  );
  const structureResult = useMemo<ProjectionResult | undefined>(() => {
    // Local owns its bounded projection. Avoid an invisible full Structure
    // projection on every Local disclosure, search, and live update.
    if (effectiveRendererMode !== 'structure') return undefined;
    try {
      return {
        ok: true,
        projection:
          performance === undefined
            ? projectStructureView(projectionWorkspace, activeViewState)
            : performance.measure('project-view', 'projections', () =>
                projectStructureView(projectionWorkspace, activeViewState),
              ),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Graph projection failed: ${message}` };
    }
  }, [
    activeViewState,
    performance,
    projectionWorkspace,
    effectiveRendererMode,
  ]);
  const activeScope = explorationScope(effectiveRendererMode);
  const activeLayout = explorationLayout(
    effectiveRendererMode,
    localLayoutMode,
  );
  const networkLayoutActive =
    rendererMode === 'global' ||
    (rendererMode === 'local' && localLayoutMode === 'free');
  useEffect(() => {
    if (effectiveRendererMode === 'global') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      dispatchFolderArrangementMode({ type: 'exit' });
      changeFolderArrangementAvailability(
        false,
        'Arrange folders is available only in All Network',
      );
    });
    return () => {
      cancelled = true;
    };
  }, [changeFolderArrangementAvailability, effectiveRendererMode]);
  useEffect(() => {
    temporaryFileMoveControllerRef.current?.cancel('workspace-changed');
    queueMicrotask(() => {
      setNetworkEditingState(NETWORK_EDITING_OFF);
      setKeyboardFileMoveNodeId(undefined);
      setTemporaryFileMoveFailure(undefined);
      setTemporaryFileMoveLifecycle('sleeping');
      setTemporaryFileMovePresentation('idle');
      dispatchFolderArrangementMode({ type: 'exit' });
    });
  }, [workspaceId]);
  useEffect(() => {
    if (
      activeLayout === 'network' &&
      !(
        activeScope === 'focus' &&
        networkEditingState.phase === 'editing' &&
        networkEditingState.tool === 'arrange-folder'
      )
    ) {
      return;
    }
    temporaryFileMoveController?.cancel('layout-changed');
    queueMicrotask(() => {
      transitionNetworkEditing({ type: 'leave-network' }, 'layout-changed');
      dispatchFolderArrangementMode({ type: 'exit' });
    });
  }, [
    activeLayout,
    activeScope,
    networkEditingState,
    temporaryFileMoveController,
    transitionNetworkEditing,
  ]);
  const unavailableProjection: ProjectionResult = {
    ok: false,
    message: 'The active graph presentation could not be prepared.',
  };
  const result: ProjectionResult =
    effectiveRendererMode === 'global' && globalResult !== undefined
      ? globalResult
      : effectiveRendererMode === 'local' && localResult !== undefined
        ? localResult
        : (structureResult ?? unavailableProjection);
  const fitInitialViewport = initialViewport === 'fit';
  const restoredStructureViewport = fitInitialViewport
    ? undefined
    : hydration.viewports.structure;
  const restoredAnchor =
    structureResult?.ok === true && restoredStructureViewport !== undefined
      ? structureResult.projection.nodes.find(
          (candidate) =>
            candidate.kind === 'entity' &&
            candidate.entityId === restoredStructureViewport.anchorEntityId,
        )
      : undefined;
  const restoredViewportHidden =
    restoredStructureViewport !== undefined && restoredAnchor === undefined;
  const restoredGlobalViewport = fitInitialViewport
    ? undefined
    : hydration.viewports.global;
  const restoredGlobalAnchor =
    globalResult?.ok === true && restoredGlobalViewport !== undefined
      ? globalResult.projection.nodes.find(
          (candidate) =>
            candidate.kind === 'entity' &&
            candidate.entityId === restoredGlobalViewport.anchorEntityId,
        )
      : undefined;
  const restoredLocalViewport = fitInitialViewport
    ? undefined
    : hydration.viewports.local;
  const restoredLocalAnchor =
    localResult?.ok === true && restoredLocalViewport !== undefined
      ? localResult.projection.nodes.find(
          (candidate) =>
            candidate.kind === 'entity' &&
            candidate.entityId === restoredLocalViewport.anchorEntityId,
        )
      : undefined;
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [fitRequestKey, setFitRequestKey] = useState(
    fitInitialViewport || restoredViewportHidden ? 1 : 0,
  );
  const [centerRequest, setCenterRequest] = useState<
    GraphCenterRequest | undefined
  >(() =>
    restoredAnchor === undefined || restoredStructureViewport === undefined
      ? undefined
      : {
          key: 1,
          nodeId: restoredAnchor.id,
          zoom: restoredStructureViewport.zoom,
        },
  );
  // Clearing a request must not reset its identity: the renderer remembers
  // handled keys across Fit transitions to reject stale async layout work.
  const centerRequestGeneration = useRef(centerRequest?.key ?? 0);
  const [globalCenterRequest, setGlobalCenterRequest] = useState<
    GlobalCenterRequest | undefined
  >(() =>
    restoredGlobalAnchor === undefined || restoredGlobalViewport === undefined
      ? undefined
      : {
          key: 1,
          nodeId: restoredGlobalAnchor.id,
          ratio: restoredGlobalViewport.ratio,
        },
  );
  const globalCenterRequestGeneration = useRef(globalCenterRequest?.key ?? 0);
  const [localCenterRequest, setLocalCenterRequest] = useState<
    LocalCenterRequest | undefined
  >(() =>
    localLayoutMode !== 'free' ||
    restoredLocalAnchor === undefined ||
    restoredLocalViewport === undefined
      ? undefined
      : {
          key: 1,
          nodeId: restoredLocalAnchor.id,
          freeRatio: restoredLocalViewport.freeRatio,
        },
  );
  const [localStructuredCenterRequest, setLocalStructuredCenterRequest] =
    useState<GraphCenterRequest | undefined>(() =>
      localLayoutMode !== 'structured' ||
      restoredLocalAnchor === undefined ||
      restoredLocalViewport === undefined
        ? undefined
        : {
            key: 1,
            nodeId: restoredLocalAnchor.id,
            zoom:
              restoredLocalViewport.structuredZoom ??
              LOCAL_STRUCTURED_NAVIGATION_ZOOM,
          },
    );
  const localCenterRequestGeneration = useRef(
    Math.max(
      localCenterRequest?.key ?? 0,
      localStructuredCenterRequest?.key ?? 0,
    ),
  );
  const initialGlobalFitRequest =
    rendererMode === 'global' &&
    (fitInitialViewport ||
      (restoredGlobalViewport !== undefined &&
        restoredGlobalAnchor === undefined))
      ? { key: 1, automatic: true }
      : undefined;
  const [globalFitRequest, setGlobalFitRequest] = useState<
    { readonly key: number; readonly automatic: boolean } | undefined
  >(initialGlobalFitRequest);
  const globalFitRequestGeneration = useRef(initialGlobalFitRequest?.key ?? 0);
  const [globalLayoutRequestKey, setGlobalLayoutRequestKey] = useState(0);
  const [localLayoutRequestKey, setLocalLayoutRequestKey] = useState(0);
  const initialLocalFitRequestKey =
    rendererMode === 'local' &&
    (fitInitialViewport ||
      (restoredLocalViewport !== undefined &&
        restoredLocalAnchor === undefined))
      ? 1
      : undefined;
  const [localFitRequestKey, setLocalFitRequestKey] = useState<
    number | undefined
  >(initialLocalFitRequestKey);
  const localFitRequestGeneration = useRef(initialLocalFitRequestKey ?? 0);
  const [automaticLocalFitRequestKey, setAutomaticLocalFitRequestKey] =
    useState(initialLocalFitRequestKey);
  const [localTransitionAnchor, setLocalTransitionAnchor] = useState<
    GraphTransitionAnchor | undefined
  >();
  const localTransitionGeneration = useRef(0);
  const globalTransitionAnchorApiRef = useRef<
    GlobalTransitionAnchorApi | undefined
  >(undefined);
  const structureTransitionAnchorApiRef = useRef<
    GraphTransitionAnchorApi | undefined
  >(undefined);
  const localFreeTransitionAnchorApiRef = useRef<
    LocalFreeTransitionAnchorApi | undefined
  >(undefined);
  const localStructuredTransitionAnchorApiRef = useRef<
    GraphTransitionAnchorApi | undefined
  >(undefined);
  const [viewportBookmark, setViewportBookmark] = useState<
    PersistedViewportAnchor | undefined
  >(restoredViewportHidden ? undefined : restoredStructureViewport);
  const [globalViewportBookmark, setGlobalViewportBookmark] = useState<
    PersistedGlobalViewport | undefined
  >(restoredGlobalAnchor === undefined ? undefined : restoredGlobalViewport);
  const [localViewportBookmark, setLocalViewportBookmark] = useState<
    PersistedLocalViewport | undefined
  >(restoredLocalAnchor === undefined ? undefined : restoredLocalViewport);
  const [navigationHistory, setNavigationHistory] =
    useState<GraphNavigationHistory>(createGraphNavigationHistory);
  const navigationHistoryRef = useRef(navigationHistory);
  const activeViewStateRef = useRef(activeViewState);
  const viewportBookmarkRef = useRef(viewportBookmark);
  const globalViewportBookmarkRef = useRef(globalViewportBookmark);
  const localViewportBookmarkRef = useRef(localViewportBookmark);
  const pendingHistoryViewportRestoreRef = useRef<
    PendingHistoryViewportRestore | undefined
  >(undefined);
  const historyViewportRestoreGeneration = useRef(0);
  const [pendingHistoryViewportRestore, setPendingHistoryViewportRestore] =
    useState<PendingHistoryViewportRestore>();
  const persistenceWritable = useRef(hydration.writable);
  const [persistenceAnnouncement, setPersistenceAnnouncement] = useState(
    `${
      restoredViewportHidden
        ? `${hydration.status} The saved viewport anchor is hidden by the restored view, so the graph was fitted.`
        : fitInitialViewport
          ? `${hydration.status} The graph was fitted for this source load.`
          : hydration.status
    }${
      legacyBlockFilterNormalized
        ? ' Legacy Blocks filtering was normalized to the current view controls.'
        : ''
    }${
      legacyFocusedStructure
        ? ' The saved focused hierarchy was restored as Focus with Hierarchy layout.'
        : ''
    }`,
  );
  const [persistenceError, setPersistenceError] = useState<string | undefined>(
    eligibility === 'stable' && !hydration.writable
      ? hydration.status
      : undefined,
  );
  const [savedFilterError, setSavedFilterError] = useState<string | undefined>(
    savedFilterSession.error,
  );
  const [savedViewError, setSavedViewError] = useState<string | undefined>(
    savedViewSession.error,
  );
  const [transientResetKey, setTransientResetKey] = useState(0);
  const [navigationAnnouncement, setNavigationAnnouncement] = useState(
    'Select a graph element to inspect it, or use Search to reveal a hidden entity.',
  );
  const [navigationError, setNavigationError] = useState<string>();
  const beginFolderArrangement = useCallback(
    (folderKey?: string) => {
      const currentFolder = folderArrangementActiveFolder(
        folderArrangementMode,
      );
      if (
        folderArrangementDraftDirty &&
        folderKey !== undefined &&
        currentFolder !== undefined &&
        folderKey !== currentFolder
      ) {
        setNavigationAnnouncement(
          'Apply or cancel the current spatial rule changes before switching folders.',
        );
        setFolderArrangementFocusRequestKey((current) => current + 1);
        return;
      }
      temporaryFileMoveController?.cancel('mode-exit');
      setKeyboardFileMoveNodeId(undefined);
      transitionNetworkEditing({ type: 'enter', tool: 'arrange-folder' });
      dispatchFolderArrangementMode({
        type: 'enter',
        ...(folderKey === undefined ? {} : { folderKey }),
      });
      setFolderArrangementFocusRequestKey((current) => current + 1);
    },
    [
      folderArrangementDraftDirty,
      folderArrangementMode,
      temporaryFileMoveController,
      transitionNetworkEditing,
    ],
  );
  const folderArrangementIsActive = folderArrangementActive(
    folderArrangementMode,
  );
  const activeArrangementFolderKey = folderArrangementActiveFolder(
    folderArrangementMode,
  );
  const folderScopeTree = useMemo(
    () =>
      createFolderScopeTree({
        documentPaths: snapshot.entities.flatMap((entity) =>
          entity.kind === 'document' ? [entity.source.path] : [],
        ),
        visibleDocumentPaths: new Set(
          globalResult?.ok === true
            ? globalResult.projection.nodes.flatMap((node) =>
                node.kind === 'entity' && node.sourcePath !== undefined
                  ? [node.sourcePath]
                  : [],
              )
            : [],
        ),
        rules: spatialOverrides.rules,
      }),
    [globalResult, snapshot.entities, spatialOverrides.rules],
  );
  const folderArrangementViewProps = useMemo<
    NonNullable<GlobalGraphViewProps['folderArrangement']>
  >(
    () => ({
      active: folderArrangementIsActive,
      ...(activeArrangementFolderKey === undefined
        ? {}
        : { activeFolderKey: activeArrangementFolderKey }),
      ...(folderArrangementMode.phase === 'inactive'
        ? {}
        : { editorPhase: folderArrangementMode.phase }),
      ruleCount: spatialOverrides.rules.length,
      scopeTree: folderScopeTree,
      anchorCount: spatialOverrides.anchors.size,
      editable:
        spatialOverrides.session.persistenceMode !== 'blocked-corrupt' &&
        spatialOverrides.session.persistenceMode !== 'blocked-write-failure',
      ...(spatialOverrides.session.error === undefined
        ? {}
        : { blockedReason: spatialOverrides.session.error }),
      canRecoverCorrupt:
        spatialOverrides.session.persistenceMode === 'blocked-corrupt',
      focusRequestKey: folderArrangementFocusRequestKey,
      persistenceStatus: spatialOverrides.session.status,
      onActiveChange: (active) => {
        if (active) beginFolderArrangement();
        else {
          transitionNetworkEditing({ type: 'exit' });
          dispatchFolderArrangementMode({ type: 'exit' });
        }
      },
      onActiveFolderChange: (folderKey) =>
        dispatchFolderArrangementMode({
          type: 'activate-folder',
          folderKey,
        }),
      onAnnouncement: setNavigationAnnouncement,
      onAvailabilityChange: changeFolderArrangementAvailability,
      onCommitAnchor: spatialOverrides.setFolderAnchor,
      onCommitRule: spatialOverrides.setFolderRule,
      onRemoveRule: spatialOverrides.removeFolderRule,
      onClearRules: spatialOverrides.clearFolderRules,
      onEditChildRule: beginFolderArrangement,
      onChoosingScopeChange: (active) =>
        dispatchFolderArrangementMode({ type: 'choose-scope', active }),
      onTargetDraggingChange: (active) =>
        dispatchFolderArrangementMode({ type: 'target-drag', active }),
      onCommitStarted: (behavior) =>
        dispatchFolderArrangementMode({ type: 'commit', behavior }),
      onAdopted: () => dispatchFolderArrangementMode({ type: 'adopted' }),
      onDraftDirtyChange: setFolderArrangementDraftDirty,
      onRecoverCorrupt: spatialOverrides.recoverCorruptRegistry,
      onResetAll: spatialOverrides.resetAllFolderAnchors,
      onResetFolder: spatialOverrides.resetFolderAnchor,
    }),
    [
      beginFolderArrangement,
      changeFolderArrangementAvailability,
      activeArrangementFolderKey,
      folderArrangementIsActive,
      folderScopeTree,
      folderArrangementFocusRequestKey,
      folderArrangementMode,
      spatialOverrides.anchors.size,
      spatialOverrides.clearFolderRules,
      spatialOverrides.removeFolderRule,
      spatialOverrides.rules.length,
      spatialOverrides.recoverCorruptRegistry,
      spatialOverrides.resetAllFolderAnchors,
      spatialOverrides.resetFolderAnchor,
      spatialOverrides.session.error,
      spatialOverrides.session.persistenceMode,
      spatialOverrides.session.status,
      spatialOverrides.setFolderAnchor,
      spatialOverrides.setFolderRule,
      transitionNetworkEditing,
    ],
  );
  const ruleByFolderKey = useMemo(
    () =>
      new Map(
        spatialOverrides.rules.map((rule) => [rule.folderKey, rule] as const),
      ),
    [spatialOverrides.rules],
  );
  const removeFolderRule = spatialOverrides.removeFolderRule;
  const networkExplorerArrangement = useMemo(
    () =>
      effectiveRendererMode !== 'global'
        ? undefined
        : {
            active: folderArrangementIsActive,
            ...(activeArrangementFolderKey === undefined
              ? {}
              : { activeFolderKey: activeArrangementFolderKey }),
            ruleByFolderKey,
            available: folderArrangementAvailability.available,
            ...(folderArrangementAvailability.reason === undefined
              ? {}
              : {
                  unavailableReason: folderArrangementAvailability.reason,
                }),
            onArrangeFolder: beginFolderArrangement,
            onRemoveFolderRule: (folderKey: WorkspaceFolderKey) => {
              const failure = removeFolderRule(folderKey);
              if (failure === undefined) {
                setNavigationAnnouncement(
                  `${folderKey === '.' ? 'Root folder' : folderKey} spatial rule removed`,
                );
              } else
                setNavigationError(`Spatial rule was not removed: ${failure}`);
            },
          },
    [
      activeArrangementFolderKey,
      beginFolderArrangement,
      effectiveRendererMode,
      folderArrangementIsActive,
      folderArrangementAvailability,
      ruleByFolderKey,
      removeFolderRule,
    ],
  );
  const retainDirtyFolderDraft = useCallback(() => {
    if (!folderArrangementDraftDirty) return false;
    setNavigationAnnouncement(
      'Apply or cancel the current spatial rule changes before leaving Arrange Folders.',
    );
    setFolderArrangementFocusRequestKey((current) => current + 1);
    return true;
  }, [folderArrangementDraftDirty]);
  const finishNetworkEditing = useCallback(() => {
    if (retainDirtyFolderDraft()) return;
    transitionNetworkEditing({ type: 'exit' });
    dispatchFolderArrangementMode({ type: 'exit' });
  }, [retainDirtyFolderDraft, transitionNetworkEditing]);
  const retryTemporaryFileMove = useCallback(() => {
    temporaryFileMoveController?.cancel('error');
    setKeyboardFileMoveNodeId(undefined);
    setTemporaryFileMoveFailure(undefined);
    setTemporaryFileMoveLifecycle('sleeping');
    setTemporaryFileMovePresentation('idle');
    setTemporaryFileMoveRetryKey((current) => current + 1);
    setNavigationAnnouncement('Retrying File movement.');
  }, [temporaryFileMoveController]);
  const changeTemporaryFileMoveCapability = useCallback(
    (capability: TemporaryNodeConstraintCapability) => {
      const adopt = () => {
        temporaryFileMoveCapabilityTimerRef.current = undefined;
        setTemporaryFileMoveCapability((current) =>
          current.status === capability.status &&
          (current.status === 'available' ||
            (capability.status === 'unavailable' &&
              current.reason === capability.reason))
            ? current
            : capability,
        );
      };
      if (temporaryFileMoveCapabilityTimerRef.current !== undefined) {
        window.clearTimeout(temporaryFileMoveCapabilityTimerRef.current);
        temporaryFileMoveCapabilityTimerRef.current = undefined;
      }
      if (
        capability.status === 'available' &&
        networkStartupCapabilityDelayMs > 0
      ) {
        temporaryFileMoveCapabilityTimerRef.current = window.setTimeout(
          adopt,
          networkStartupCapabilityDelayMs,
        );
        return;
      }
      adopt();
    },
    [networkStartupCapabilityDelayMs],
  );
  useEffect(
    () => () => {
      if (temporaryFileMoveCapabilityTimerRef.current !== undefined) {
        window.clearTimeout(temporaryFileMoveCapabilityTimerRef.current);
      }
    },
    [],
  );
  const changeTemporaryFileMoveLifecycle = useCallback(
    (lifecycle: NetworkPhysicsLifecycleState) => {
      setTemporaryFileMoveLifecycle((current) =>
        current === lifecycle ? current : lifecycle,
      );
    },
    [],
  );
  const changeTemporaryFileMovePresentation = useCallback(
    (state: NetworkPhysicsPresentationState) => {
      setTemporaryFileMovePresentation((current) =>
        current === state ? current : state,
      );
    },
    [],
  );
  const reportTemporaryFileMoveFailure = useCallback((message: string) => {
    setKeyboardFileMoveNodeId(undefined);
    setTemporaryFileMoveLifecycle('failed');
    setTemporaryFileMovePresentation('idle');
    setTemporaryFileMoveFailure(`File movement stopped: ${message}`);
    setNavigationAnnouncement(
      'File movement stopped. The last valid graph remains visible; use Retry Move to recover.',
    );
  }, []);
  const changeTemporaryFileMoveController = useCallback(
    (controller: TemporaryFileMoveController | undefined) => {
      temporaryFileMoveControllerRef.current = controller;
      setTemporaryFileMoveController(controller);
    },
    [],
  );
  useEffect(() => {
    if (networkEditingState.phase === 'off') return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          '[role="dialog"], [role="menu"], input, textarea, select, [contenteditable="true"], [data-network-editing-escape="handled"]',
        ) !== null
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      finishNetworkEditing();
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [finishNetworkEditing, networkEditingState.phase]);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const inspectorToolbarRef = useRef<HTMLButtonElement>(null);
  const inspectorHandleRef = useRef<HTMLButtonElement>(null);
  const inspectorRestoreTarget = useRef<HTMLElement | null>(null);
  const [inspectorFocusRequestKey, setInspectorFocusRequestKey] = useState(0);
  const [networkExplorerOpen, setNetworkExplorerOpen] = useState(false);
  // Folder overrides survive query/live membership changes and sidebar remounts.
  const [networkExplorerFolderState, setNetworkExplorerFolderState] =
    useState<NetworkExplorerFolderState>(() => new Map());
  const [graphClickSelection, setGraphClickSelection] =
    useState<GraphSelection | null>(null);
  const [networkExplorerRevealRequest, setNetworkExplorerRevealRequest] =
    useState<
      | (NetworkExplorerRevealRequest & { readonly projection: ViewProjection })
      | undefined
    >();

  const networkExplorerToolbarRef = useRef<HTMLButtonElement>(null);
  const networkExplorerHandleRef = useRef<HTMLButtonElement>(null);
  const networkExplorerRestoreTarget = useRef<HTMLButtonElement | null>(null);
  const [narrowGraphWorkspace, setNarrowGraphWorkspace] = useState(false);
  const mostRecentlyOpenedDrawer = useRef<'inspector' | 'network-explorer'>(
    'inspector',
  );
  const networkExplorerVisible = networkExplorerOpen && networkLayoutActive;
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia === undefined)
      return;
    const mediaQuery = window.matchMedia(NARROW_GRAPH_WORKSPACE_MEDIA_QUERY);
    const observe = () => setNarrowGraphWorkspace(mediaQuery.matches);
    observe();
    mediaQuery.addEventListener('change', observe);
    return () => mediaQuery.removeEventListener('change', observe);
  }, []);
  useEffect(() => {
    if (!narrowGraphWorkspace || !inspectorOpen || !networkExplorerOpen) return;
    if (mostRecentlyOpenedDrawer.current === 'network-explorer') {
      setInspectorOpen(false);
    } else {
      setNetworkExplorerOpen(false);
    }
  }, [inspectorOpen, narrowGraphWorkspace, networkExplorerOpen]);
  useEffect(() => {
    if (networkLayoutActive || !networkExplorerOpen) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setNetworkExplorerOpen(false);
    });
    return () => {
      cancelled = true;
    };
  }, [networkExplorerOpen, networkLayoutActive]);
  const [initialSerializedView] = useState(() =>
    hydration.writable
      ? serializePersistedWorkspaceView(
          createPersistedWorkspaceView({
            workspace: projectionWorkspace,
            state: initialViewState,
            presentationMode: rendererMode,
            viewports: fitInitialViewport ? {} : hydration.viewports,
          }),
        )
      : undefined,
  );
  const lastSerializedView = useRef(initialSerializedView);
  const inspectionWorkspace = useMemo(() => {
    const create = () => createInspectionWorkspace(snapshot);
    return performance === undefined
      ? create()
      : performance.measure(
          'inspection-workspace',
          'inspection-workspace-builds',
          create,
        );
  }, [performance, snapshot]);
  const pathScopes = useMemo(
    () => topLevelPathScopes(projectionWorkspace),
    [projectionWorkspace],
  );
  const projection = result.ok ? result.projection : undefined;
  const visualGroupPresentation = useMemo<VisualGroupPresentation>(() => {
    if (projection === undefined) {
      return { styles: EMPTY_VISUAL_GROUP_PRESENTATIONS };
    }
    try {
      return {
        styles: deriveProjectionVisualGroupPresentationMap(
          projection,
          visualGroupEntityById,
          visualGroupCompilation.compiled,
        ),
      };
    } catch (error: unknown) {
      return {
        styles: EMPTY_VISUAL_GROUP_PRESENTATIONS,
        error: `Visual Group colors could not be derived: ${
          error instanceof Error ? error.message : String(error)
        } Node colors were left unchanged.`,
      };
    }
  }, [projection, visualGroupCompilation.compiled, visualGroupEntityById]);
  const networkProjection =
    rendererMode === 'global' && globalResult?.ok === true
      ? globalResult.projection
      : rendererMode === 'local' &&
          localLayoutMode === 'free' &&
          localResult?.ok === true
        ? localResult.projection
        : undefined;
  const networkExplorerModel = useMemo(
    () =>
      networkProjection === undefined
        ? undefined
        : createNetworkExplorerModel(
            networkProjection,
            inspectionWorkspace,
            visualGroupPresentation.styles,
          ),
    [inspectionWorkspace, networkProjection, visualGroupPresentation.styles],
  );
  const startKeyboardFileMove = useCallback(
    (nodeId: ProjectionNodeId) => {
      const node = networkExplorerModel?.nodeById.get(nodeId);
      if (node?.kindLabel !== 'File') {
        setNavigationAnnouncement('Only visible Files can be moved.');
        return;
      }
      if (networkEditingState.phase === 'editing') {
        setNavigationAnnouncement(
          'Finish Arrange Folders before moving a File.',
        );
        return;
      }
      if (retainDirtyFolderDraft()) return;
      temporaryFileMoveController?.cancel('mode-exit');
      // Keyboard movement selects without issuing a semantic center request.
      setSelection({ kind: 'node', id: nodeId });
      setKeyboardFileMoveNodeId(nodeId);
      setKeyboardFileMoveRequestKey((current) => current + 1);
      setNavigationAnnouncement(
        `Move File ${node.name}. Use arrow keys, then release to settle. The position is not saved.`,
      );
    },
    [
      networkEditingState.phase,
      networkExplorerModel,
      retainDirtyFolderDraft,
      temporaryFileMoveController,
    ],
  );
  useEffect(() => {
    if (
      keyboardFileMoveNodeId === undefined ||
      keyboardFileMoveRequestKey === handledKeyboardFileMoveRequest.current ||
      temporaryFileMoveCapability.status !== 'available'
    ) {
      return;
    }
    const result = temporaryFileMoveController?.start(keyboardFileMoveNodeId);
    if (result?.status === 'started') {
      handledKeyboardFileMoveRequest.current = keyboardFileMoveRequestKey;
      return;
    }
    if (result?.reason === 'node-unavailable') {
      queueMicrotask(() => {
        setKeyboardFileMoveNodeId(undefined);
        setNavigationAnnouncement(
          'The selected File is no longer available to move.',
        );
      });
    }
  }, [
    keyboardFileMoveNodeId,
    keyboardFileMoveRequestKey,
    temporaryFileMoveCapability.status,
    temporaryFileMoveController,
  ]);
  const nudgeKeyboardFileMove = useCallback(
    (x: number, y: number) => {
      if (temporaryFileMoveController?.nudge({ x, y }) === true) return;
      setKeyboardFileMoveNodeId(undefined);
      setNavigationAnnouncement(
        'Move File ended because the graph changed or movement became unavailable.',
      );
    },
    [temporaryFileMoveController],
  );
  const releaseKeyboardFileMove = useCallback(() => {
    temporaryFileMoveController?.release();
    setKeyboardFileMoveNodeId(undefined);
    setNavigationAnnouncement(
      'File released. Network physics is settling; no position was saved.',
    );
  }, [temporaryFileMoveController]);
  const cancelKeyboardFileMove = useCallback(() => {
    temporaryFileMoveController?.cancel('cancelled');
    setKeyboardFileMoveNodeId(undefined);
    setNavigationAnnouncement('File movement canceled; no position was saved.');
  }, [temporaryFileMoveController]);
  const handleUnavailableKeyboardFileMoveTarget = useCallback(() => {
    temporaryFileMoveController?.cancel('topology-changed');
    setKeyboardFileMoveNodeId(undefined);
    setNavigationAnnouncement(
      'The File being moved is no longer visible. Movement ended safely.',
    );
  }, [temporaryFileMoveController]);
  const networkExplorerFileMove = useMemo(
    () => ({
      ...(keyboardFileMoveNodeId === undefined
        ? {}
        : { activeNodeId: keyboardFileMoveNodeId }),
      available:
        temporaryFileMoveCapability.status === 'available' &&
        temporaryFileMoveFailure === undefined &&
        networkEditingState.phase === 'off' &&
        !folderArrangementDraftDirty,
      ...(networkEditingState.phase === 'editing'
        ? { unavailableReason: 'Finish Arrange Folders first.' }
        : folderArrangementDraftDirty
          ? {
              unavailableReason:
                'Apply or cancel the current folder rule changes first.',
            }
          : temporaryFileMoveFailure !== undefined
            ? { unavailableReason: 'Retry File movement before moving a File.' }
            : temporaryFileMoveCapability.status === 'available'
              ? {}
              : {
                  unavailableReason:
                    temporaryFileMoveCapability.reason ===
                    'simulation-not-running'
                      ? 'Waiting for Network layout…'
                      : temporaryFileMoveCapability.reason === 'graph-too-large'
                        ? `File movement supports up to ${NETWORK_PHYSICS_SUPPORTED_NODE_LIMIT} visible nodes in this release.`
                        : 'File movement is unavailable in this Network view.',
                }),
      onCancel: cancelKeyboardFileMove,
      onNudge: nudgeKeyboardFileMove,
      onRelease: releaseKeyboardFileMove,
      onStart: startKeyboardFileMove,
      onTargetUnavailable: handleUnavailableKeyboardFileMoveTarget,
    }),
    [
      cancelKeyboardFileMove,
      folderArrangementDraftDirty,
      handleUnavailableKeyboardFileMoveTarget,
      keyboardFileMoveNodeId,
      nudgeKeyboardFileMove,
      networkEditingState.phase,
      releaseKeyboardFileMove,
      startKeyboardFileMove,
      temporaryFileMoveCapability,
      temporaryFileMoveFailure,
    ],
  );
  const activeSelection =
    projection !== undefined && selectionExists(projection, selection)
      ? selection
      : null;
  const selectedFocusableEntityId = selectedEntityId(
    projection,
    activeSelection,
  );
  const focusedRootLabel = useMemo(() => {
    const rootEntityId = activeViewState.focus?.rootEntityId;
    if (rootEntityId === undefined) return undefined;
    const root = projectionWorkspace.entity(rootEntityId);
    const path = root?.source.path;
    if (path === undefined) return undefined;
    return (path.split('/').at(-1) ?? path).replace(/\.md$/iu, '');
  }, [activeViewState.focus?.rootEntityId, projectionWorkspace]);
  const selectedVisualGroups = useMemo<{
    readonly matches: readonly VisualGroupMatch[];
    readonly error?: string;
  }>(() => {
    const entityId = selectedEntityId(projection, activeSelection);
    if (entityId === undefined) return { matches: [] };
    const entity = visualGroupEntityById.get(entityId);
    if (entity === undefined) return { matches: [] };
    try {
      return {
        matches: matchingVisualGroupsForEntity(
          entity,
          visualGroupCompilation.compiled,
        ),
      };
    } catch (error: unknown) {
      return {
        matches: [],
        error: `Visual Group matches could not be inspected: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }, [
    activeSelection,
    projection,
    visualGroupCompilation.compiled,
    visualGroupEntityById,
  ]);
  const visualGroupError =
    activeVisualGroupSession.error ??
    visualGroupCompilation.error ??
    visualGroupPresentation.error ??
    selectedVisualGroups.error;
  const previousProjectionWorkspace = useRef(projectionWorkspace);
  const previousWorkspaceId = useRef(workspaceId);

  const replaceNavigationHistory = useCallback(
    (next: GraphNavigationHistory) => {
      navigationHistoryRef.current = next;
      setNavigationHistory(next);
    },
    [],
  );
  const setSemanticViewportBookmark = useCallback(
    (next: PersistedViewportAnchor | undefined) => {
      viewportBookmarkRef.current = next;
      setViewportBookmark(next);
    },
    [],
  );
  const setGlobalSemanticViewportBookmark = useCallback(
    (next: PersistedGlobalViewport | undefined) => {
      globalViewportBookmarkRef.current = next;
      setGlobalViewportBookmark(next);
    },
    [],
  );
  const setLocalSemanticViewportBookmark = useCallback(
    (next: PersistedLocalViewport | undefined) => {
      localViewportBookmarkRef.current = next;
      setLocalViewportBookmark(next);
    },
    [],
  );
  const requestSemanticCenter = useCallback(
    (request: Omit<GraphCenterRequest, 'key'>) => {
      const key = nextGraphViewportRequestKey(centerRequestGeneration.current);
      centerRequestGeneration.current = key;
      setCenterRequest({ key, ...request });
    },
    [],
  );
  const requestGlobalSemanticCenter = useCallback(
    (request: Omit<GlobalCenterRequest, 'key'>) => {
      const key = nextGraphViewportRequestKey(
        globalCenterRequestGeneration.current,
      );
      globalCenterRequestGeneration.current = key;
      setGlobalFitRequest(undefined);
      setGlobalCenterRequest({ key, ...request });
    },
    [],
  );
  const requestLocalSemanticCenter = useCallback(
    (request: {
      readonly nodeId: LocalCenterRequest['nodeId'];
      readonly freeRatio: number;
      readonly structuredZoom?: number;
    }) => {
      const key = nextGraphViewportRequestKey(
        localCenterRequestGeneration.current,
      );
      localCenterRequestGeneration.current = key;
      setAutomaticLocalFitRequestKey(undefined);
      setLocalFitRequestKey(undefined);
      if (localLayoutModeRef.current === 'structured') {
        setLocalCenterRequest(undefined);
        setLocalStructuredCenterRequest({
          key,
          nodeId: request.nodeId,
          zoom: request.structuredZoom ?? LOCAL_STRUCTURED_NAVIGATION_ZOOM,
        });
      } else {
        setLocalStructuredCenterRequest(undefined);
        setLocalCenterRequest({
          key,
          nodeId: request.nodeId,
          freeRatio: request.freeRatio,
        });
      }
    },
    [],
  );
  const requestGlobalFit = useCallback(() => {
    const key = nextGraphViewportRequestKey(globalFitRequestGeneration.current);
    globalFitRequestGeneration.current = key;
    setGlobalCenterRequest(undefined);
    setGlobalFitRequest({ key, automatic: false });
  }, []);
  const consumeGlobalFitRequest = useCallback((key: number) => {
    setGlobalFitRequest((current) =>
      current?.key === key ? undefined : current,
    );
  }, []);
  const consumeGlobalCenterRequest = useCallback((key: number) => {
    setGlobalCenterRequest((current) =>
      current?.key === key ? undefined : current,
    );
  }, []);
  const requestLocalFit = useCallback(() => {
    const key = nextGraphViewportRequestKey(localFitRequestGeneration.current);
    localFitRequestGeneration.current = key;
    setAutomaticLocalFitRequestKey(undefined);
    setLocalCenterRequest(undefined);
    setLocalStructuredCenterRequest(undefined);
    setLocalFitRequestKey(key);
  }, []);
  const consumeLocalFitRequest = useCallback((key: number) => {
    setAutomaticLocalFitRequestKey((current) =>
      current === key ? undefined : current,
    );
    setLocalFitRequestKey((current) => (current === key ? undefined : current));
  }, []);
  const consumeLocalCenterRequest = useCallback((key: number) => {
    setLocalCenterRequest((current) =>
      current?.key === key ? undefined : current,
    );
  }, []);
  const consumeLocalTransitionAnchor = useCallback((key: number) => {
    setLocalTransitionAnchor((current) =>
      current?.key === key ? undefined : current,
    );
  }, []);
  const cancelPendingHistoryViewportRestore = useCallback(() => {
    pendingHistoryViewportRestoreRef.current = undefined;
    setPendingHistoryViewportRestore(undefined);
  }, []);
  const clearNavigationHistory = useCallback(() => {
    replaceNavigationHistory(createGraphNavigationHistory());
    cancelPendingHistoryViewportRestore();
  }, [cancelPendingHistoryViewportRestore, replaceNavigationHistory]);
  const currentHistoryCheckpoint = useCallback(
    (): GraphHistoryCheckpoint =>
      createGraphHistoryCheckpoint(
        activeViewStateRef.current,
        undefined,
        rendererModeRef.current,
        {
          ...(viewportBookmarkRef.current === undefined
            ? {}
            : { structure: viewportBookmarkRef.current }),
          ...(globalViewportBookmarkRef.current === undefined
            ? {}
            : { global: globalViewportBookmarkRef.current }),
          ...(localViewportBookmarkRef.current === undefined
            ? {}
            : { local: localViewportBookmarkRef.current }),
        },
      ),
    [],
  );
  const commitGraphDestination = useCallback(
    (
      nextState: ViewProjectionState,
      nextViewport: PersistedViewportAnchor | undefined,
    ): boolean => {
      const current = currentHistoryCheckpoint();
      const destination = createGraphHistoryCheckpoint(
        nextState,
        undefined,
        rendererModeRef.current,
        {
          ...(nextViewport === undefined ? {} : { structure: nextViewport }),
          ...(globalViewportBookmarkRef.current === undefined
            ? {}
            : { global: globalViewportBookmarkRef.current }),
          ...(localViewportBookmarkRef.current === undefined
            ? {}
            : { local: localViewportBookmarkRef.current }),
        },
      );
      const nextHistory = recordGraphNavigation(
        navigationHistoryRef.current,
        current,
        destination,
      );
      if (nextHistory === navigationHistoryRef.current) return false;
      replaceNavigationHistory(nextHistory);
      cancelPendingHistoryViewportRestore();
      if (!sameGraphViewState(activeViewStateRef.current, nextState)) {
        activeViewStateRef.current = nextState;
        dispatch({ type: 'replace-state', state: nextState });
      }
      setSemanticViewportBookmark(nextViewport);
      return true;
    },
    [
      cancelPendingHistoryViewportRestore,
      currentHistoryCheckpoint,
      replaceNavigationHistory,
      setSemanticViewportBookmark,
    ],
  );
  const commitHistoryGraphAction = useCallback(
    (
      action: GraphStateAction,
      options: { readonly fitDestination?: boolean } = {},
    ): boolean => {
      if (graphHistoryActionPolicy(action) !== 'record') {
        throw new Error(
          `Graph action "${action.type}" cannot create a history checkpoint.`,
        );
      }
      const nextState = graphStateReducer(activeViewStateRef.current, action);
      if (sameGraphViewState(activeViewStateRef.current, nextState)) {
        return false;
      }
      const committed = commitGraphDestination(
        nextState,
        options.fitDestination && rendererModeRef.current === 'structure'
          ? undefined
          : viewportBookmarkRef.current,
      );
      if (committed) {
        if (rendererModeRef.current === 'global') {
          if (options.fitDestination) {
            setGlobalSemanticViewportBookmark(undefined);
            setGlobalCenterRequest(undefined);
            requestGlobalFit();
          }
        } else if (rendererModeRef.current === 'local') {
          setLocalCenterRequest(undefined);
          setLocalStructuredCenterRequest(undefined);
          if (options.fitDestination) {
            setLocalSemanticViewportBookmark(undefined);
            requestLocalFit();
          }
        } else setCenterRequest(undefined);
      }
      return committed;
    },
    [
      commitGraphDestination,
      requestGlobalFit,
      requestLocalFit,
      setGlobalSemanticViewportBookmark,
      setLocalSemanticViewportBookmark,
    ],
  );
  const requestHistoryViewportRestore = useCallback(
    (
      nextPresentationMode: GraphPresentationMode,
      viewports: PersistedRendererViewports,
    ) => {
      const request: PendingHistoryViewportRestore = {
        key: nextGraphViewportRequestKey(
          historyViewportRestoreGeneration.current,
        ),
        presentationMode: nextPresentationMode,
        viewports,
      };
      historyViewportRestoreGeneration.current = request.key;
      pendingHistoryViewportRestoreRef.current = request;
      setPendingHistoryViewportRestore(request);
    },
    [],
  );
  const applyHistoryTraversal = useCallback(
    (traversal: GraphHistoryTraversal, announcement: string): boolean => {
      const reconciled = reconcileCurrentWorkspaceView(
        projectionWorkspace,
        traversal.target.state,
        traversal.target.viewports,
      );
      replaceNavigationHistory(traversal.history);
      if (!sameGraphViewState(activeViewStateRef.current, reconciled.state)) {
        activeViewStateRef.current = reconciled.state;
        dispatch({ type: 'replace-state', state: reconciled.state });
      }
      const restoredSessionMode = resolveAvailablePresentationMode(
        traversal.target.presentationMode,
        reconciled.state,
        availabilityRef.current,
      );
      rendererModeRef.current = restoredSessionMode;
      setRendererMode(restoredSessionMode);
      setSemanticViewportBookmark(reconciled.viewports.structure);
      setGlobalSemanticViewportBookmark(reconciled.viewports.global);
      setLocalSemanticViewportBookmark(reconciled.viewports.local);
      setCenterRequest(undefined);
      setGlobalCenterRequest(undefined);
      setLocalCenterRequest(undefined);
      setLocalStructuredCenterRequest(undefined);
      requestHistoryViewportRestore(restoredSessionMode, reconciled.viewports);
      setNavigationError(undefined);
      setNavigationAnnouncement(
        announcement +
          (reconciled.issues.length === 0
            ? ''
            : ' Some graph state was adjusted because the source changed.') +
          (restoredSessionMode === traversal.target.presentationMode
            ? ''
            : traversal.target.presentationMode === 'local'
              ? ` The Focus root no longer exists, so the checkpoint recovered to All ${restoredSessionMode === 'global' ? 'Network' : 'Hierarchy'}.`
              : restoredSessionMode === 'global'
                ? ' Experimental All Hierarchy is hidden; this checkpoint is shown in All Network.'
                : ' All Network is unavailable, so this checkpoint is shown in All Hierarchy for this session.'),
      );
      return true;
    },
    [
      projectionWorkspace,
      replaceNavigationHistory,
      requestHistoryViewportRestore,
      setGlobalSemanticViewportBookmark,
      setLocalSemanticViewportBookmark,
      setSemanticViewportBookmark,
    ],
  );
  const traverseGraphHistory = useCallback(
    (direction: 'back' | 'forward'): boolean => {
      const normalized = normalizeAvailableGraphHistory(
        navigationHistoryRef.current,
        currentHistoryCheckpoint(),
        availabilityRef.current,
      );
      const traversal =
        direction === 'back'
          ? goBackInGraphHistory(normalized.history, normalized.current)
          : goForwardInGraphHistory(normalized.history, normalized.current);
      return traversal === null
        ? false
        : applyHistoryTraversal(
            traversal,
            direction === 'back'
              ? 'Went back in graph history.'
              : 'Went forward in graph history.',
          );
    },
    [applyHistoryTraversal, currentHistoryCheckpoint],
  );
  const returnToPriorAll = useCallback((): boolean => {
    const normalized = normalizeAvailableGraphHistory(
      navigationHistoryRef.current,
      currentHistoryCheckpoint(),
      availabilityRef.current,
    );
    const traversal = returnToAllInGraphHistory(
      normalized.history,
      normalized.current,
    );
    if (traversal === null) return false;
    const apply = () =>
      applyHistoryTraversal(traversal, 'Returned to the previous All context.');
    return performance === undefined
      ? apply()
      : performance.measure(
          'local-to-global-transition',
          'local-to-global-transitions',
          apply,
        );
  }, [applyHistoryTraversal, currentHistoryCheckpoint, performance]);
  const exitFocusToAll = useCallback((): void => {
    temporaryFileMoveController?.cancel('scope-changed');
    setKeyboardFileMoveNodeId(undefined);
    if (returnToPriorAll()) return;
    const applyFallback = () => {
      const focusState = activeViewStateRef.current;
      const rootEntityId = focusState.focus?.rootEntityId;
      const allState: ViewProjectionState = {
        disclosure: focusState.disclosure,
        ...(focusState.filters === undefined
          ? {}
          : { filters: focusState.filters }),
      };
      const targetMode = resolveAvailablePresentationMode(
        allPresentationMode(
          localLayoutModeRef.current === 'free' ? 'network' : 'hierarchy',
        ),
        allState,
        availabilityRef.current,
      );
      const candidateProjection =
        targetMode === 'global'
          ? projectView(
              projectionWorkspace,
              effectiveGlobalProjectionState(projectionWorkspace, allState),
            )
          : projectStructureView(projectionWorkspace, allState);
      const savedAnchorEntityId =
        targetMode === 'global'
          ? globalViewportBookmarkRef.current?.anchorEntityId
          : viewportBookmarkRef.current?.anchorEntityId;
      const anchor = candidateProjection.nodes.find(
        (node) =>
          node.kind === 'entity' &&
          node.entityId === (savedAnchorEntityId ?? rootEntityId),
      );
      const globalViewport: PersistedGlobalViewport | undefined =
        targetMode === 'global' && anchor?.kind === 'entity'
          ? {
              anchorEntityId: anchor.entityId,
              ratio:
                globalViewportBookmarkRef.current?.anchorEntityId ===
                anchor.entityId
                  ? globalViewportBookmarkRef.current.ratio
                  : GLOBAL_NAVIGATION_RATIO,
            }
          : undefined;
      const structureViewport: PersistedViewportAnchor | undefined =
        targetMode === 'structure' && anchor?.kind === 'entity'
          ? {
              anchorEntityId: anchor.entityId,
              zoom:
                viewportBookmarkRef.current?.anchorEntityId === anchor.entityId
                  ? viewportBookmarkRef.current.zoom
                  : ENTITY_NAVIGATION_ZOOM,
            }
          : undefined;
      const destination = createGraphHistoryCheckpoint(
        allState,
        undefined,
        targetMode,
        {
          ...(structureViewport === undefined
            ? viewportBookmarkRef.current === undefined
              ? {}
              : { structure: viewportBookmarkRef.current }
            : { structure: structureViewport }),
          ...(globalViewport === undefined
            ? globalViewportBookmarkRef.current === undefined
              ? {}
              : { global: globalViewportBookmarkRef.current }
            : { global: globalViewport }),
          ...(localViewportBookmarkRef.current === undefined
            ? {}
            : { local: localViewportBookmarkRef.current }),
        },
      );
      replaceNavigationHistory(
        recordGraphNavigation(
          navigationHistoryRef.current,
          currentHistoryCheckpoint(),
          destination,
        ),
      );
      activeViewStateRef.current = allState;
      dispatch({ type: 'replace-state', state: allState });
      rendererModeRef.current = targetMode;
      setRendererMode(targetMode);
      if (
        targetMode === 'global' &&
        anchor?.kind === 'entity' &&
        globalViewport !== undefined
      ) {
        setGlobalSemanticViewportBookmark(globalViewport);
        setSelection({ kind: 'node', id: anchor.id });
        requestGlobalSemanticCenter({
          nodeId: anchor.id,
          ratio: globalViewport.ratio,
        });
      } else if (
        targetMode === 'structure' &&
        anchor?.kind === 'entity' &&
        structureViewport !== undefined
      ) {
        setSemanticViewportBookmark(structureViewport);
        setSelection({ kind: 'node', id: anchor.id });
        requestSemanticCenter({
          nodeId: anchor.id,
          zoom: structureViewport.zoom,
        });
      } else {
        setSelection(null);
        if (targetMode === 'global') {
          setGlobalCenterRequest(undefined);
          requestGlobalFit();
        } else {
          setCenterRequest(undefined);
          setFitRequestKey((value) => value + 1);
        }
      }
      setNavigationError(undefined);
      setNavigationAnnouncement(
        `Returned to All ${targetMode === 'global' ? 'Network' : 'Hierarchy'} using the focused root because no prior All checkpoint was available.`,
      );
    };
    try {
      if (performance === undefined) applyFallback();
      else {
        performance.measure(
          'local-to-global-transition',
          'local-to-global-transitions',
          applyFallback,
        );
      }
    } catch (error: unknown) {
      setNavigationError(
        `Could not return to All: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }, [
    currentHistoryCheckpoint,
    performance,
    projectionWorkspace,
    replaceNavigationHistory,
    requestGlobalFit,
    requestGlobalSemanticCenter,
    requestSemanticCenter,
    returnToPriorAll,
    setGlobalSemanticViewportBookmark,
    setSemanticViewportBookmark,
    temporaryFileMoveController,
  ]);
  const goBack = useCallback(
    () => void traverseGraphHistory('back'),
    [traverseGraphHistory],
  );
  const goForward = useCallback(
    () => void traverseGraphHistory('forward'),
    [traverseGraphHistory],
  );
  const activateGraphHistoryShortcut = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const direction = graphHistoryShortcut({
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        repeat: event.repeat,
        editableTarget: historyShortcutTargetIsExcluded(event.target),
        graphContext: true,
        applicationOverlayOpen,
        canGoBack: navigationHistoryRef.current.past.length > 0,
        canGoForward: navigationHistoryRef.current.future.length > 0,
      });
      if (direction === null || !traverseGraphHistory(direction)) return;
      event.preventDefault();
      event.stopPropagation();
    },
    [applicationOverlayOpen, traverseGraphHistory],
  );

  useEffect(() => {
    if (
      rendererMode !== 'global' ||
      GlobalGraphView !== undefined ||
      globalFailure !== undefined
    ) {
      return;
    }
    let cancelled = false;
    void import('./GlobalGraphView')
      .then((module) => {
        if (!cancelled) setGlobalGraphView(() => module.default);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setGlobalUnavailable(
          `All Network could not be loaded: ${message} All Hierarchy remains available for this session.`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [GlobalGraphView, globalFailure, rendererMode]);

  useEffect(() => {
    if (
      rendererMode !== 'local' ||
      localLayoutMode !== 'free' ||
      LocalGraphView !== undefined ||
      localFreeUnavailable !== undefined
    ) {
      return;
    }
    let cancelled = false;
    void import('./LocalGraphView')
      .then((module) => {
        if (!cancelled) setLocalGraphView(() => module.default);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setLocalFreeUnavailable(
          `Focus Network could not be loaded: ${message} Use Focus Hierarchy or return to All.`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [LocalGraphView, localFreeUnavailable, localLayoutMode, rendererMode]);

  useEffect(() => {
    if (
      rendererMode !== 'local' ||
      localLayoutMode !== 'structured' ||
      modularPreviewActive ||
      LocalStructuredGraphView !== undefined ||
      localStructuredUnavailable !== undefined
    ) {
      return;
    }
    let cancelled = false;
    void import('./LocalStructuredGraphView')
      .then((module) => {
        if (!cancelled) setLocalStructuredGraphView(() => module.default);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setLocalStructuredUnavailable(
          `Focus Hierarchy could not be loaded: ${message} Use an available Focus layout or return to All.`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [
    LocalStructuredGraphView,
    localLayoutMode,
    localStructuredUnavailable,
    modularPreviewActive,
    rendererMode,
  ]);

  useEffect(() => {
    if (
      rendererMode !== 'local' ||
      localLayoutMode !== 'structured' ||
      !modularPreviewActive ||
      ModularStructuredGraphView !== undefined ||
      modularLoadUnavailable !== undefined
    ) {
      return;
    }
    let cancelled = false;
    void import('./ModularStructuredGraphView')
      .then((module) => {
        if (!cancelled) setModularStructuredGraphView(() => module.default);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setModularLoadFailure({
          workspaceId,
          message: `Modular Preview could not be loaded: ${message}`,
        });
        setModularSessionFailureState({
          workspaceId,
          message: `Modular Preview could not be loaded: ${message} Classic Focus Hierarchy is active for this session.`,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [
    ModularStructuredGraphView,
    localLayoutMode,
    modularLoadUnavailable,
    modularPreviewActive,
    rendererMode,
    workspaceId,
  ]);

  useLayoutEffect(() => {
    if (performance === undefined) return;
    performance.markCommit('graph-explorer-commit');
  });

  useLayoutEffect(() => {
    activeViewStateRef.current = activeViewState;
    if (!(rendererMode === 'local' && activeViewState.focus === undefined))
      rendererModeRef.current = effectiveRendererMode;
    localLayoutModeRef.current = localLayoutMode;
    viewportBookmarkRef.current = viewportBookmark;
    globalViewportBookmarkRef.current = globalViewportBookmark;
    localViewportBookmarkRef.current = localViewportBookmark;
  }, [
    activeViewState,
    effectiveRendererMode,
    rendererMode,
    globalViewportBookmark,
    localLayoutMode,
    localViewportBookmark,
    viewportBookmark,
  ]);

  useEffect(() => {
    const request = pendingHistoryViewportRestore;
    if (
      request === undefined ||
      !result.ok ||
      request.presentationMode !== effectiveRendererMode ||
      pendingHistoryViewportRestoreRef.current?.key !== request.key
    ) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (
        cancelled ||
        pendingHistoryViewportRestoreRef.current?.key !== request.key
      ) {
        return;
      }
      pendingHistoryViewportRestoreRef.current = undefined;
      setPendingHistoryViewportRestore((current) =>
        current?.key === request.key ? undefined : current,
      );
      setSelection((current) =>
        current !== null && selectionExists(result.projection, current)
          ? current
          : null,
      );
      if (request.presentationMode === 'global') {
        const viewport = request.viewports.global;
        const anchor =
          viewport === undefined
            ? undefined
            : result.projection.nodes.find(
                (candidate) =>
                  candidate.kind === 'entity' &&
                  candidate.entityId === viewport.anchorEntityId,
              );
        if (viewport !== undefined && anchor !== undefined) {
          requestGlobalSemanticCenter({
            nodeId: anchor.id,
            ratio: viewport.ratio,
          });
          return;
        }
        setGlobalSemanticViewportBookmark(undefined);
        setGlobalCenterRequest(undefined);
        requestGlobalFit();
        return;
      }
      if (request.presentationMode === 'local') {
        const viewport = request.viewports.local;
        const anchor =
          viewport === undefined
            ? undefined
            : result.projection.nodes.find(
                (candidate) =>
                  candidate.kind === 'entity' &&
                  candidate.entityId === viewport.anchorEntityId,
              );
        if (viewport !== undefined && anchor !== undefined) {
          requestLocalSemanticCenter({
            nodeId: anchor.id,
            freeRatio: viewport.freeRatio,
            ...(viewport.structuredZoom === undefined
              ? {}
              : { structuredZoom: viewport.structuredZoom }),
          });
          return;
        }
        setLocalSemanticViewportBookmark(undefined);
        setLocalCenterRequest(undefined);
        setLocalStructuredCenterRequest(undefined);
        requestLocalFit();
        return;
      }
      const restore = planSemanticViewportRestore(
        result.projection,
        request.viewports.structure,
      );
      if (restore.kind === 'center') {
        requestSemanticCenter({ nodeId: restore.nodeId, zoom: restore.zoom });
        return;
      }
      setSemanticViewportBookmark(undefined);
      setCenterRequest(undefined);
      setFitRequestKey((current) => current + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [
    effectiveRendererMode,
    pendingHistoryViewportRestore,
    requestGlobalFit,
    requestGlobalSemanticCenter,
    requestLocalFit,
    requestLocalSemanticCenter,
    requestSemanticCenter,
    result,
    setGlobalSemanticViewportBookmark,
    setLocalSemanticViewportBookmark,
    setSemanticViewportBookmark,
  ]);

  useEffect(() => {
    if (previousProjectionWorkspace.current === projectionWorkspace) return;
    const currentWorkspaceId = projectionWorkspace.snapshot().workspace.id;
    if (previousWorkspaceId.current !== currentWorkspaceId) {
      previousWorkspaceId.current = currentWorkspaceId;
      clearNavigationHistory();
    }
    const reconciled = reconcileCurrentWorkspaceView(
      projectionWorkspace,
      viewState,
      {
        ...(viewportBookmark === undefined
          ? {}
          : { structure: viewportBookmark }),
        ...(globalViewportBookmark === undefined
          ? {}
          : { global: globalViewportBookmark }),
        ...(localViewportBookmark === undefined
          ? {}
          : { local: localViewportBookmark }),
      },
    );
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      previousProjectionWorkspace.current = projectionWorkspace;
      if (reconciled.state !== viewState) {
        activeViewStateRef.current = reconciled.state;
        dispatch({ type: 'replace-state', state: reconciled.state });
      }
      setSemanticViewportBookmark(reconciled.viewports.structure);
      setGlobalSemanticViewportBookmark(reconciled.viewports.global);
      setLocalSemanticViewportBookmark(reconciled.viewports.local);
      if (
        rendererModeRef.current === 'local' &&
        reconciled.state.focus === undefined
      ) {
        const recoveryMode = resolveAvailablePresentationMode(
          'local',
          reconciled.state,
          availabilityRef.current,
        );
        rendererModeRef.current = recoveryMode;
        setRendererMode(recoveryMode);
        setSelection(null);
        setLocalCenterRequest(undefined);
        setLocalStructuredCenterRequest(undefined);
        setLocalSemanticViewportBookmark(undefined);
        setNavigationAnnouncement(
          `The Focus root was removed by a live update. Focus closed safely and ${
            recoveryMode === 'global'
              ? 'All Network was restored.'
              : 'All Hierarchy remains available.'
          }`,
        );
        return;
      }
      if (rendererModeRef.current === 'global') {
        if (
          globalViewportBookmark !== undefined &&
          reconciled.viewports.global === undefined
        ) {
          setNavigationAnnouncement(
            'The previous All Network viewport anchor was removed by a live update; the current camera was preserved.',
          );
        }
        return;
      }
      if (rendererModeRef.current === 'local') {
        if (
          localViewportBookmark !== undefined &&
          reconciled.viewports.local === undefined
        ) {
          setNavigationAnnouncement(
            'The previous Focus viewport anchor was removed by a live update; surviving positions and camera were preserved.',
          );
        }
        return;
      }
      if (viewportBookmark === undefined) return;
      const structureViewport = reconciled.viewports.structure;
      if (structureViewport === undefined) {
        setSemanticViewportBookmark(undefined);
        setCenterRequest(undefined);
        setFitRequestKey((current) => current + 1);
        setNavigationAnnouncement(
          'The previous viewport anchor was removed by a live update, so the graph was fitted.',
        );
        return;
      }
      if (!result.ok) return;
      const anchor = result.projection.nodes.find(
        (candidate) =>
          candidate.kind === 'entity' &&
          candidate.entityId === structureViewport.anchorEntityId,
      );
      if (anchor === undefined) {
        setSemanticViewportBookmark(undefined);
        setCenterRequest(undefined);
        setFitRequestKey((current) => current + 1);
        setNavigationAnnouncement(
          'The previous viewport anchor is hidden by the current live view, so the graph was fitted.',
        );
        return;
      }
      requestSemanticCenter({
        nodeId: anchor.id,
        zoom: structureViewport.zoom,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    clearNavigationHistory,
    globalViewportBookmark,
    globalFailure,
    localViewportBookmark,
    projectionWorkspace,
    requestSemanticCenter,
    result,
    setGlobalSemanticViewportBookmark,
    setLocalSemanticViewportBookmark,
    setSemanticViewportBookmark,
    viewState,
    viewportBookmark,
  ]);

  useEffect(() => {
    if (
      previousProjectionWorkspace.current === projectionWorkspace ||
      selection === null ||
      projection === undefined ||
      selectionExists(projection, selection)
    ) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSelection(null);
      setNavigationAnnouncement(
        'The selected graph element was removed by a live update; selection was cleared.',
      );
    });
    return () => {
      cancelled = true;
    };
  }, [projection, projectionWorkspace, selection]);

  useEffect(() => {
    if (!maximized || typeof document === 'undefined') return;
    return activateMaximizedGraphMode(
      {
        bodyStyle: document.body.style,
        addKeydownListener: (listener) =>
          window.addEventListener('keydown', listener),
        removeKeydownListener: (listener) =>
          window.removeEventListener('keydown', listener),
      },
      () => {
        if (activeOverlay !== null || activeToolPanel !== null) {
          dispatchWorkspaceOverlay({ type: 'close-all' });
          return;
        }
        onMaximizedChange(false);
      },
    );
  }, [activeOverlay, activeToolPanel, maximized, onMaximizedChange]);

  useEffect(() => {
    if (
      !applicationOverlayOpen ||
      (activeOverlay === null && activeToolPanel === null)
    ) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        dispatchWorkspaceOverlay({ type: 'close-all' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeOverlay, activeToolPanel, applicationOverlayOpen]);

  useEffect(() => {
    if (
      eligibility !== 'stable' ||
      !persistenceWritable.current ||
      persistenceStorage === undefined
    ) {
      return;
    }
    try {
      const persisted = createPersistedWorkspaceView({
        workspace: projectionWorkspace,
        state: activeViewState,
        presentationMode: rendererMode,
        viewports: {
          ...(viewportBookmark === undefined
            ? {}
            : { structure: viewportBookmark }),
          ...(globalViewportBookmark === undefined
            ? {}
            : { global: globalViewportBookmark }),
          ...(localViewportBookmark === undefined
            ? {}
            : { local: localViewportBookmark }),
        },
      });
      const serialized = serializePersistedWorkspaceView(persisted);
      if (serialized === lastSerializedView.current) return;
      const saved = saveWorkspaceView(persistenceStorage, persisted);
      if (!saved.ok) {
        persistenceWritable.current = false;
        queueMicrotask(() =>
          setPersistenceError(
            `${saved.message} The graph remains usable in memory.`,
          ),
        );
        return;
      }
      lastSerializedView.current = serialized;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      persistenceWritable.current = false;
      queueMicrotask(() =>
        setPersistenceError(
          `Could not prepare the current view: ${message} The graph remains usable in memory.`,
        ),
      );
    }
  }, [
    eligibility,
    persistenceStorage,
    projectionWorkspace,
    activeViewState,
    globalViewportBookmark,
    localViewportBookmark,
    rendererMode,
    viewportBookmark,
  ]);

  const toggleEntity = useCallback(
    (entityId: string, currentlyOpen: boolean) =>
      void commitHistoryGraphAction({
        type: 'toggle-entity',
        entityId,
        currentlyOpen,
      }),
    [commitHistoryGraphAction],
  );
  const changeSelection = useCallback(
    (nextSelection: GraphSelection | null) =>
      setSelection((current) => retainGraphSelection(current, nextSelection)),
    [],
  );
  const applyGraphAction = useCallback(
    (action: GraphStateAction) => {
      if (
        rendererModeRef.current === 'global' &&
        action.type === 'toggle-reference-status'
      ) {
        const nextState = withExplicitGlobalReferenceStatus(
          activeViewStateRef.current,
          action.status,
          action.enabled,
        );
        void commitGraphDestination(nextState, viewportBookmarkRef.current);
        return;
      }
      void commitHistoryGraphAction(action);
    },
    [commitGraphDestination, commitHistoryGraphAction],
  );
  const commitQuery = useCallback(
    (query: string | undefined) => {
      void commitHistoryGraphAction({
        type: 'set-query',
        query: query ?? null,
      });
    },
    [commitHistoryGraphAction],
  );
  const queryEditor = useGraphQueryDraft(
    activeViewState.filters?.query,
    commitQuery,
  );
  const { adoptQuery, mutateExactPath, mutateFolder } = queryEditor;
  const captureCurrentNamedView = useCallback(
    (name: string) =>
      captureSavedView({
        name,
        workspace: projectionWorkspace,
        state: activeViewStateRef.current,
        presentationMode: rendererModeRef.current,
        layout: explorationLayout(
          rendererModeRef.current,
          localLayoutModeRef.current,
        ),
        viewports: {
          ...(viewportBookmarkRef.current === undefined
            ? {}
            : { structure: viewportBookmarkRef.current }),
          ...(globalViewportBookmarkRef.current === undefined
            ? {}
            : { global: globalViewportBookmarkRef.current }),
          ...(localViewportBookmarkRef.current === undefined
            ? {}
            : { local: localViewportBookmarkRef.current }),
        },
      }),
    [projectionWorkspace],
  );
  const commitNamedViewRegistry = useCallback(
    (
      candidate: SavedViewRegistry,
      announcement: string,
    ): string | undefined => {
      const committed = commitSavedViewSessionMutation(
        savedViewSession,
        candidate,
        persistenceStorage,
      );
      setSavedViewSession(committed.session);
      setSavedViewError(committed.session.error);
      if (!committed.ok) return committed.message;
      setPersistenceAnnouncement(announcement);
      return undefined;
    },
    [persistenceStorage, savedViewSession],
  );
  const saveCurrentNamedView = useCallback(
    (name: string): string | undefined => {
      if (!savedViewSession.writable) return savedViewSession.status;
      try {
        const entry = captureCurrentNamedView(name);
        const candidate = addSavedView(savedViewSession.registry, entry);
        return candidate.ok
          ? commitNamedViewRegistry(
              candidate.value,
              `Saved current view as "${entry.name}".`,
            )
          : candidate.message;
      } catch (error: unknown) {
        return error instanceof Error ? error.message : String(error);
      }
    },
    [captureCurrentNamedView, commitNamedViewRegistry, savedViewSession],
  );
  const updateNamedView = useCallback(
    (name: string): string | undefined => {
      if (!savedViewSession.writable) return savedViewSession.status;
      try {
        const entry = captureCurrentNamedView(name);
        const candidate = updateSavedView(
          savedViewSession.registry,
          name,
          entry,
        );
        return candidate.ok
          ? commitNamedViewRegistry(
              candidate.value,
              `Updated Saved View "${name}" from the current graph.`,
            )
          : candidate.message;
      } catch (error: unknown) {
        return error instanceof Error ? error.message : String(error);
      }
    },
    [captureCurrentNamedView, commitNamedViewRegistry, savedViewSession],
  );
  const renameNamedView = useCallback(
    (name: string, nextName: string): string | undefined => {
      const candidate = renameSavedView(
        savedViewSession.registry,
        name,
        nextName,
      );
      return candidate.ok
        ? commitNamedViewRegistry(
            candidate.value,
            `Renamed Saved View "${name}" to "${nextName.trim()}".`,
          )
        : candidate.message;
    },
    [commitNamedViewRegistry, savedViewSession.registry],
  );
  const deleteNamedView = useCallback(
    (name: string): string | undefined => {
      const candidate = deleteSavedView(savedViewSession.registry, name);
      return candidate.ok
        ? commitNamedViewRegistry(
            candidate.value,
            `Deleted Saved View "${name}".`,
          )
        : candidate.message;
    },
    [commitNamedViewRegistry, savedViewSession.registry],
  );
  const resetNamedViews = useCallback((): string | undefined => {
    const reset = resetSavedViewSession(savedViewSession, persistenceStorage);
    setSavedViewSession(reset.session);
    setSavedViewError(reset.session.error);
    if (!reset.ok) return reset.message;
    setPersistenceAnnouncement(
      "Reset this workspace's Saved Views registry. The current view was unchanged.",
    );
    return undefined;
  }, [persistenceStorage, savedViewSession]);
  const applyNamedView = useCallback(
    (name: string): string | undefined => {
      const entry = savedViewSession.registry.views.find(
        (candidate) => candidate.name === name,
      );
      if (entry === undefined) return `Saved View "${name}" does not exist.`;
      if (retainDirtyFolderDraft()) {
        return 'Apply or cancel the current spatial rule changes before applying a Saved View.';
      }
      try {
        const plan = planSavedViewApply({
          entry,
          workspace: projectionWorkspace,
          availability: availabilityRef.current,
        });
        const current = captureCurrentNamedView(entry.name);
        const equivalent = sameSavedViewSnapshot(current, entry);

        temporaryFileMoveController?.cancel('scope-changed');
        setKeyboardFileMoveNodeId(undefined);
        transitionNetworkEditing({ type: 'exit' }, 'scope-changed');
        dispatchFolderArrangementMode({ type: 'exit' });
        // Applying a named graph context establishes a new navigation baseline.
        clearNavigationHistory();
        if (
          plan.presentationMode === 'local' &&
          localLayoutModeRef.current !== plan.localLayoutMode
        ) {
          // Focus layout is owned by Graph Preferences, so this is the only
          // preference field a Saved View may update during application.
          localLayoutModeRef.current = plan.localLayoutMode;
          updateGraphPreferences({ localLayoutMode: plan.localLayoutMode });
        }
        if (!sameGraphViewState(activeViewStateRef.current, plan.state)) {
          activeViewStateRef.current = plan.state;
          dispatch({ type: 'replace-state', state: plan.state });
        }
        rendererModeRef.current = plan.presentationMode;
        setRendererMode(plan.presentationMode);
        setSemanticViewportBookmark(plan.viewports.structure);
        setGlobalSemanticViewportBookmark(plan.viewports.global);
        setLocalSemanticViewportBookmark(plan.viewports.local);
        setCenterRequest(undefined);
        setGlobalCenterRequest(undefined);
        setGlobalFitRequest(undefined);
        setLocalCenterRequest(undefined);
        setLocalStructuredCenterRequest(undefined);
        setLocalTransitionAnchor(undefined);
        setAutomaticLocalFitRequestKey(undefined);
        setLocalFitRequestKey(undefined);
        if (!equivalent) {
          requestHistoryViewportRestore(plan.presentationMode, plan.viewports);
        }
        setSelection(null);
        setGraphClickSelection(null);
        setNetworkExplorerRevealRequest(undefined);
        adoptQuery(plan.state.filters?.query ?? '');
        setNavigationError(undefined);
        setNavigationAnnouncement(
          `Applied Saved View "${entry.name}" as ${
            plan.presentationMode === 'local' ? 'Focus' : 'All'
          } ${
            plan.presentationMode === 'local'
              ? plan.localLayoutMode === 'free'
                ? 'Network'
                : 'Hierarchy'
              : plan.presentationMode === 'global'
                ? 'Network'
                : 'Hierarchy'
          }.${
            plan.issues.length === 0
              ? ''
              : ` ${plan.issues.length} stale saved item${
                  plan.issues.length === 1 ? ' was' : 's were'
                } removed for this application only.`
          }${plan.adjustment === undefined ? '' : ` ${plan.adjustment}`}`,
        );
        return undefined;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setNavigationError(`Could not apply Saved View "${name}": ${message}`);
        return message;
      }
    },
    [
      adoptQuery,
      captureCurrentNamedView,
      clearNavigationHistory,
      projectionWorkspace,
      requestHistoryViewportRestore,
      retainDirtyFolderDraft,
      savedViewSession.registry.views,
      setGlobalSemanticViewportBookmark,
      setLocalSemanticViewportBookmark,
      setSemanticViewportBookmark,
      temporaryFileMoveController,
      transitionNetworkEditing,
      updateGraphPreferences,
    ],
  );
  const namedSavedViews = useMemo<SavedViewsState>(
    () => ({
      views: savedViewSession.registry.views,
      status: savedViewSession.status,
      writable: savedViewSession.writable,
      recoveryAvailable: savedViewSession.recoveryAvailable,
      onApply: applyNamedView,
      onDelete: deleteNamedView,
      onRename: renameNamedView,
      onReset: resetNamedViews,
      onSave: saveCurrentNamedView,
      onUpdate: updateNamedView,
    }),
    [
      applyNamedView,
      deleteNamedView,
      renameNamedView,
      resetNamedViews,
      saveCurrentNamedView,
      savedViewSession,
      updateNamedView,
    ],
  );
  const hiddenFileResult = useMemo(
    () => listExactPathExclusions(activeViewState.filters?.query),
    [activeViewState.filters?.query],
  );
  const hiddenFolderResult = useMemo(
    () => listFolderExclusions(activeViewState.filters?.query),
    [activeViewState.filters?.query],
  );
  const focusedSourcePath =
    activeViewState.focus === undefined
      ? undefined
      : projectionWorkspace.entity(activeViewState.focus.rootEntityId)?.source
          .path;
  const restoreNetworkFile = useCallback(
    (path: string) => {
      mutateExactPath(path, 'remove');
    },
    [mutateExactPath],
  );
  const restoreNetworkFolder = useCallback(
    (folderKey: WorkspaceFolderKey) => {
      mutateFolder(folderKey, 'remove');
    },
    [mutateFolder],
  );
  const hideNetworkFile = useCallback(
    (path: string) => {
      if (
        path === focusedSourcePath ||
        !hiddenFileResult.ok ||
        hiddenFileResult.paths.includes(path) ||
        !networkExplorerModel?.nodes.some((node) => node.sourcePath === path)
      )
        return;
      mutateExactPath(path, 'add');
    },
    [
      focusedSourcePath,
      hiddenFileResult,
      mutateExactPath,
      networkExplorerModel,
    ],
  );
  const hideNetworkFolder = useCallback(
    (folderKey: WorkspaceFolderKey) => {
      const focusedFolderKey =
        focusedSourcePath === undefined
          ? undefined
          : workspaceFolderKeyFromPath(focusedSourcePath);
      if (
        !hiddenFolderResult.ok ||
        hiddenFolderResult.folderKeys.includes(folderKey) ||
        !networkExplorerModel?.folderByPath.has(folderKey) ||
        (focusedFolderKey !== undefined &&
          workspaceFolderKeyContainsFolder(folderKey, focusedFolderKey))
      )
        return;
      mutateFolder(folderKey, 'add');
    },
    [focusedSourcePath, hiddenFolderResult, mutateFolder, networkExplorerModel],
  );
  const applySavedFilter = useCallback(
    (query: string) => {
      const committed = commitHistoryGraphAction({ type: 'set-query', query });
      adoptQuery(query);
      setNavigationError(undefined);
      setNavigationAnnouncement(
        committed
          ? 'Applied a Saved Filter query.'
          : 'That Saved Filter query is already active.',
      );
    },
    [adoptQuery, commitHistoryGraphAction],
  );
  const saveCurrentQuery = useCallback(
    (name: string): string | undefined => {
      const query = activeViewStateRef.current.filters?.query;
      if (query === undefined) return 'Apply a valid query before saving it.';
      if (!savedFilterSession.writable || persistenceStorage === undefined) {
        return savedFilterSession.status;
      }
      const candidate = addSavedGraphFilter(
        savedFilterSession.registry,
        name,
        query,
      );
      if (!candidate.ok) return candidate.message;
      const saved = saveSavedGraphFilterRegistry(
        persistenceStorage,
        candidate.value,
      );
      if (!saved.ok) {
        setSavedFilterSession((current) => ({
          ...current,
          writable: false,
          status:
            'Saved Filters are unavailable after a storage write failure.',
        }));
        setSavedFilterError(
          `${saved.message} Confirmed Saved Filters were retained in memory.`,
        );
        return saved.message;
      }
      setSavedFilterSession((current) => ({
        ...current,
        registry: candidate.value,
        status: 'Saved Filters are stored for this stable workspace.',
      }));
      setSavedFilterError(undefined);
      setPersistenceAnnouncement(`Saved filter "${name.trim()}".`);
      return undefined;
    },
    [persistenceStorage, savedFilterSession],
  );
  const removeSavedFilter = useCallback(
    (name: string): string | undefined => {
      if (!savedFilterSession.writable || persistenceStorage === undefined) {
        return savedFilterSession.status;
      }
      const candidate = deleteSavedGraphFilter(
        savedFilterSession.registry,
        name,
      );
      if (!candidate.ok) return candidate.message;
      const saved = saveSavedGraphFilterRegistry(
        persistenceStorage,
        candidate.value,
      );
      if (!saved.ok) {
        setSavedFilterSession((current) => ({
          ...current,
          writable: false,
          status:
            'Saved Filters are unavailable after a storage write failure.',
        }));
        setSavedFilterError(
          `${saved.message} Confirmed Saved Filters were retained in memory.`,
        );
        return saved.message;
      }
      setSavedFilterSession((current) => ({
        ...current,
        registry: candidate.value,
      }));
      setSavedFilterError(undefined);
      setPersistenceAnnouncement(`Deleted saved filter "${name}".`);
      return undefined;
    },
    [persistenceStorage, savedFilterSession],
  );
  const savedQueries = useMemo<SavedGraphQueriesState>(
    () => ({
      activeQuery: activeViewState.filters?.query ?? '',
      savedFilters: savedFilterSession.registry.filters,
      savedFiltersStatus: savedFilterSession.status,
      savedFiltersWritable: savedFilterSession.writable,
      onApplySavedFilter: applySavedFilter,
      onDeleteSavedFilter: removeSavedFilter,
      onSaveCurrentQuery: saveCurrentQuery,
    }),
    [
      activeViewState.filters?.query,
      applySavedFilter,
      removeSavedFilter,
      saveCurrentQuery,
      savedFilterSession,
    ],
  );

  const commitVisualGroupMutation = useCallback(
    (
      candidate: VisualGroupRegistry,
      announcement: string,
    ): string | undefined => {
      const committed = commitVisualGroupSessionMutation(
        activeVisualGroupSession,
        candidate,
        persistenceStorage,
      );
      adoptVisualGroupSession(committed.value);
      if (!committed.ok) return committed.message;
      setPersistenceAnnouncement(announcement);
      return undefined;
    },
    [activeVisualGroupSession, adoptVisualGroupSession, persistenceStorage],
  );
  const resetSavedVisualGroups = useCallback((): string | undefined => {
    const reset = resetCorruptVisualGroupSession(
      activeVisualGroupSession,
      persistenceStorage,
    );
    adoptVisualGroupSession(reset.value);
    if (!reset.ok) return reset.message;
    setPersistenceAnnouncement('Saved Visual Groups reset.');
    return undefined;
  }, [activeVisualGroupSession, adoptVisualGroupSession, persistenceStorage]);
  const clearSelection = useCallback(() => setSelection(null), []);
  const changeGlobalSelection = useCallback(
    (nextSelection: GlobalSelection | null) => {
      setGraphClickSelection(nextSelection);
      setSelection((current) => retainGraphSelection(current, nextSelection));
    },
    [],
  );
  const changeLocalSelection = useCallback(
    (nextSelection: LocalSelection | null) => {
      setGraphClickSelection(nextSelection);
      setSelection((current) => retainGraphSelection(current, nextSelection));
    },
    [],
  );
  const observeViewport = useCallback(
    (observation: GraphViewportObservation) =>
      setSemanticViewportBookmark(
        observation.anchorEntityId === null
          ? undefined
          : {
              anchorEntityId: observation.anchorEntityId,
              zoom: observation.zoom,
            },
      ),
    [setSemanticViewportBookmark],
  );
  const observeGlobalViewport = useCallback(
    (observation: SemanticGlobalViewport | undefined) =>
      setGlobalSemanticViewportBookmark(observation),
    [setGlobalSemanticViewportBookmark],
  );
  const changeGlobalTransitionAnchorApi = useCallback(
    (api: GlobalTransitionAnchorApi | undefined) => {
      globalTransitionAnchorApiRef.current = api;
    },
    [],
  );
  const changeStructureTransitionAnchorApi = useCallback(
    (api: GraphTransitionAnchorApi | undefined) => {
      structureTransitionAnchorApiRef.current = api;
    },
    [],
  );
  const observeLocalFreeViewport = useCallback(
    (observation: SemanticLocalViewport | undefined) => {
      if (observation === undefined) {
        setLocalSemanticViewportBookmark(undefined);
        return;
      }
      const structuredZoom = localViewportBookmarkRef.current?.structuredZoom;
      setLocalSemanticViewportBookmark({
        ...observation,
        ...(structuredZoom === undefined ? {} : { structuredZoom }),
      });
    },
    [setLocalSemanticViewportBookmark],
  );
  const observeLocalStructuredViewport = useCallback(
    (observation: SemanticLocalStructuredViewport | undefined) => {
      if (observation === undefined) {
        setLocalSemanticViewportBookmark(undefined);
        return;
      }
      setLocalSemanticViewportBookmark({
        anchorEntityId: observation.anchorEntityId,
        freeRatio:
          localViewportBookmarkRef.current?.freeRatio ?? LOCAL_NAVIGATION_RATIO,
        structuredZoom: observation.structuredZoom,
      });
    },
    [setLocalSemanticViewportBookmark],
  );
  const changeLocalFreeTransitionAnchorApi = useCallback(
    (api: LocalFreeTransitionAnchorApi | undefined) => {
      localFreeTransitionAnchorApiRef.current = api;
    },
    [],
  );
  const changeLocalStructuredTransitionAnchorApi = useCallback(
    (api: GraphTransitionAnchorApi | undefined) => {
      localStructuredTransitionAnchorApiRef.current = api;
    },
    [],
  );
  const changeMaximized = useCallback(
    (nextMaximized: boolean) => {
      dispatchWorkspaceOverlay({ type: 'close-all' });
      onMaximizedChange(nextMaximized);
    },
    [onMaximizedChange],
  );
  const changeTrackpadZoomMode = useCallback(
    (mode: TrackpadZoomMode) => {
      updateGraphPreferences({ trackpadZoomMode: mode });
    },
    [updateGraphPreferences],
  );
  const changeAllNetworkDensityFramingStrength = useCallback(
    (strength: number) => {
      setAllNetworkDensityFramingStrength(strength);
    },
    [],
  );
  const changeFocusNetworkDensityFramingStrength = useCallback(
    (strength: number) => {
      setFocusNetworkDensityFramingStrength(strength);
    },
    [],
  );
  const changeFocusAppearance = useCallback(
    (appearance: FocusAppearance) => {
      updateGraphPreferences({ focusAppearance: appearance });
    },
    [updateGraphPreferences],
  );
  const changeFocusHierarchyImplementation = useCallback(
    (implementation: FocusHierarchyImplementation) => {
      if (
        implementation ===
          preferencesRef.current.focusHierarchyImplementation &&
        !(
          implementation === 'modular-preview' &&
          modularSessionFailure !== undefined
        )
      )
        return;
      if (
        rendererModeRef.current === 'local' &&
        localLayoutModeRef.current === 'structured'
      ) {
        const currentProjection = projection;
        const selectedNode =
          selection?.kind === 'node'
            ? currentProjection?.nodes.find(
                (node) => node.kind === 'entity' && node.id === selection.id,
              )
            : undefined;
        const rootEntityId = activeViewStateRef.current.focus?.rootEntityId;
        const rootNode = currentProjection?.nodes.find(
          (node) => node.kind === 'entity' && node.entityId === rootEntityId,
        );
        const bookmarkNode = currentProjection?.nodes.find(
          (node) =>
            node.kind === 'entity' &&
            node.entityId === localViewportBookmarkRef.current?.anchorEntityId,
        );
        const anchorNode = selectedNode ?? rootNode ?? bookmarkNode;
        const point =
          anchorNode === undefined
            ? undefined
            : localStructuredTransitionAnchorApiRef.current?.nodeViewportPoint(
                anchorNode.id,
              );
        if (anchorNode !== undefined && point !== undefined) {
          const key = nextGraphViewportRequestKey(
            localTransitionGeneration.current,
          );
          localTransitionGeneration.current = key;
          setLocalTransitionAnchor({
            key,
            nodeId: anchorNode.id,
            point,
            zoom:
              localViewportBookmarkRef.current?.structuredZoom ??
              LOCAL_STRUCTURED_NAVIGATION_ZOOM,
          });
        }
      }
      setModularSessionFailureState(undefined);
      setModularLoadFailure(undefined);
      updateGraphPreferences({ focusHierarchyImplementation: implementation });
      setNavigationAnnouncement(
        implementation === 'modular-preview'
          ? 'Modular Preview opened with the same Focus hierarchy and viewport context.'
          : 'Classic Focus Hierarchy opened with the same Focus hierarchy and viewport context.',
      );
    },
    [modularSessionFailure, projection, selection, updateGraphPreferences],
  );
  // Network controls stay inert in Hierarchy. All explicitly requests physics;
  // Focus keys its own worker/cache lifecycle only by shared Reference Pull.
  const changeGlobalLayoutSettings = useCallback(
    (settings: GlobalLayoutSettings) => {
      if (
        globalLayoutSettingsRequireImmediateLayout(
          activeScope,
          activeLayout,
          preferencesRef.current.globalLayoutSettings,
          settings,
        )
      ) {
        setGlobalLayoutRequestKey((current) => current + 1);
      }
      updateGraphPreferences({ globalLayoutSettings: settings });
    },
    [updateGraphPreferences, activeLayout, activeScope],
  );
  const changeModularFocusInternalLayout = useCallback(
    (layout: GraphPreferences['modularFocusInternalLayout']) => {
      updateGraphPreferences({ modularFocusInternalLayout: layout });
    },
    [updateGraphPreferences],
  );
  const changeModularFocusHeadingOrder = useCallback(
    (order: GraphPreferences['modularFocusHeadingOrder']) => {
      updateGraphPreferences({ modularFocusHeadingOrder: order });
    },
    [updateGraphPreferences],
  );
  const changeModularFocusMacroLayout = useCallback(
    (layout: GraphPreferences['modularFocusMacroLayout']) => {
      updateGraphPreferences({ modularFocusMacroLayout: layout });
    },
    [updateGraphPreferences],
  );
  const changeModularFocusSoftFolderStrength = useCallback(
    (strength: number) => {
      updateGraphPreferences({
        modularFocusSoftFolderStrength:
          normalizeModularFocusSoftFolderStrength(strength),
      });
    },
    [updateGraphPreferences],
  );
  const changeModularFolderStripsVisible = useCallback(
    (visible: GraphPreferences['modularFolderStripsVisible']) => {
      updateGraphPreferences({ modularFolderStripsVisible: visible });
    },
    [updateGraphPreferences],
  );
  const changeModularConnectionStyle = useCallback(
    (style: GraphPreferences['modularConnectionStyle']) => {
      updateGraphPreferences({ modularConnectionStyle: style });
    },
    [updateGraphPreferences],
  );
  const changeLocalLayoutMode = useCallback(
    (mode: LocalLayoutMode) => {
      if (
        rendererModeRef.current !== 'local' ||
        mode === localLayoutModeRef.current
      ) {
        return;
      }
      if (mode === 'structured') {
        temporaryFileMoveController?.cancel('layout-changed');
        setKeyboardFileMoveNodeId(undefined);
        transitionNetworkEditing({ type: 'leave-network' }, 'layout-changed');
        dispatchFolderArrangementMode({ type: 'exit' });
      }
      const rootEntityId = activeViewStateRef.current.focus?.rootEntityId;
      const rootNode =
        rootEntityId === undefined
          ? undefined
          : projection?.nodes.find(
              (node) =>
                node.kind === 'entity' && node.entityId === rootEntityId,
            );
      const selectedNode =
        selection?.kind === 'node'
          ? projection?.nodes.find((node) => node.id === selection.id)
          : undefined;
      const anchorNode = selectedNode ?? rootNode;
      const sourceApi =
        localLayoutModeRef.current === 'free'
          ? localFreeTransitionAnchorApiRef.current
          : localStructuredTransitionAnchorApiRef.current;
      const point =
        anchorNode === undefined
          ? undefined
          : sourceApi?.nodeViewportPoint(anchorNode.id);
      const bookmark = localViewportBookmarkRef.current;
      const targetZoom =
        mode === 'structured'
          ? (bookmark?.structuredZoom ?? LOCAL_STRUCTURED_NAVIGATION_ZOOM)
          : (bookmark?.freeRatio ?? LOCAL_NAVIGATION_RATIO);

      localLayoutModeRef.current = mode;
      setLocalCenterRequest(undefined);
      setLocalStructuredCenterRequest(undefined);
      if (point !== undefined && anchorNode !== undefined) {
        const key = nextGraphViewportRequestKey(
          localTransitionGeneration.current,
        );
        localTransitionGeneration.current = key;
        setLocalTransitionAnchor({
          key,
          nodeId: anchorNode.id,
          point,
          zoom: targetZoom,
        });
      } else if (anchorNode !== undefined) {
        setLocalTransitionAnchor(undefined);
        requestLocalSemanticCenter({
          nodeId: anchorNode.id,
          freeRatio: bookmark?.freeRatio ?? LOCAL_NAVIGATION_RATIO,
          structuredZoom:
            bookmark?.structuredZoom ?? LOCAL_STRUCTURED_NAVIGATION_ZOOM,
        });
      }
      if (mode === 'free' && selection?.kind === 'edge') {
        setSelection(null);
      }
      updateGraphPreferences({ localLayoutMode: mode });
      setNavigationAnnouncement(
        mode === 'structured'
          ? 'Focus Hierarchy opened with the same bounded graph.'
          : `Focus Network opened with the same bounded graph.${
              selection?.kind === 'edge'
                ? ' The Hierarchy edge selection was cleared.'
                : ''
            }`,
      );
    },
    [
      updateGraphPreferences,
      projection,
      requestLocalSemanticCenter,
      selection,
      temporaryFileMoveController,
      transitionNetworkEditing,
    ],
  );
  const changeSettingsOpen = useCallback((open: boolean) => {
    dispatchWorkspaceOverlay({ type: 'change-settings', open });
  }, []);
  const changeFiltersOpen = useCallback(
    (open: boolean) => {
      dispatchWorkspaceOverlay({
        type: 'change-tool-panel',
        panel: 'filters',
        maximized,
        open,
      });
    },
    [maximized],
  );
  const changeGroupsOpen = useCallback(
    (open: boolean) => {
      dispatchWorkspaceOverlay({
        type: 'change-tool-panel',
        panel: 'groups',
        maximized,
        open,
      });
    },
    [maximized],
  );
  const toggleTools = useCallback(() => {
    dispatchWorkspaceOverlay({ type: 'toggle-tools' });
  }, []);
  const closeTools = useCallback(() => {
    dispatchWorkspaceOverlay({ type: 'close-tools' });
  }, []);
  const closeInspector = useCallback(() => {
    setInspectorOpen(false);
    queueMicrotask(() => {
      const target = inspectorRestoreTarget.current;
      if (target?.isConnected && target.closest('[hidden]') === null) {
        target.focus();
      } else inspectorHandleRef.current?.focus();
    });
  }, []);
  const closeNetworkExplorer = useCallback(() => {
    setNetworkExplorerOpen(false);
    queueMicrotask(() => {
      const target = networkExplorerRestoreTarget.current;
      if (target?.isConnected && target.closest('[hidden]') === null) {
        target.focus();
      } else networkExplorerHandleRef.current?.focus();
    });
  }, []);
  const toggleInspector = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (inspectorOpen) {
        closeInspector();
        return;
      }
      inspectorRestoreTarget.current = event.currentTarget;
      mostRecentlyOpenedDrawer.current = 'inspector';
      if (narrowGraphWorkspace) setNetworkExplorerOpen(false);
      setInspectorOpen(true);
    },
    [closeInspector, inspectorOpen, narrowGraphWorkspace],
  );
  const toggleNetworkExplorer = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (networkExplorerOpen) {
        closeNetworkExplorer();
        return;
      }
      networkExplorerRestoreTarget.current = event.currentTarget;
      mostRecentlyOpenedDrawer.current = 'network-explorer';
      if (narrowGraphWorkspace) setInspectorOpen(false);
      setNetworkExplorerOpen(true);
      setGraphClickSelection(null);
    },
    [closeNetworkExplorer, narrowGraphWorkspace, networkExplorerOpen],
  );
  const selectNetworkExplorerNode = useCallback(
    (nodeId: ProjectionNodeId) => {
      if (networkExplorerModel?.nodeById.has(nodeId) !== true) return;
      setSelection({ kind: 'node', id: nodeId });
      if (rendererModeRef.current === 'global') {
        requestGlobalSemanticCenter({
          nodeId,
          ratio:
            globalViewportBookmarkRef.current?.ratio ?? GLOBAL_NAVIGATION_RATIO,
        });
      } else if (
        rendererModeRef.current === 'local' &&
        localLayoutModeRef.current === 'free'
      ) {
        requestLocalSemanticCenter({
          nodeId,
          freeRatio:
            localViewportBookmarkRef.current?.freeRatio ??
            LOCAL_NAVIGATION_RATIO,
        });
      }
      setNavigationAnnouncement(
        'Network Explorer selected and centered the visible node.',
      );
    },
    [
      networkExplorerModel,
      requestGlobalSemanticCenter,
      requestLocalSemanticCenter,
    ],
  );
  const revealGraphNode = useCallback(
    (nodeId: ProjectionNodeId) => {
      if (!networkExplorerVisible || networkProjection === undefined) return;
      setNetworkExplorerRevealRequest((current) => ({
        key: (current?.key ?? 0) + 1,
        nodeId,
        projection: networkProjection,
      }));
    },
    [networkExplorerVisible, networkProjection],
  );
  const inspectNetworkExplorerNode = useCallback(
    (nodeId: ProjectionNodeId, origin: HTMLElement | null) => {
      if (networkExplorerModel?.nodeById.has(nodeId) !== true) return;
      setSelection((current) =>
        retainGraphSelection(current, { kind: 'node', id: nodeId }),
      );
      inspectorRestoreTarget.current = origin;
      mostRecentlyOpenedDrawer.current = 'inspector';
      if (narrowGraphWorkspace) setNetworkExplorerOpen(false);
      setInspectorFocusRequestKey((current) => current + 1);
      setInspectorOpen(true);
    },
    [narrowGraphWorkspace, networkExplorerModel],
  );
  const changeRendererMode = useCallback(
    (nextMode: GraphPresentationMode) => {
      if (nextMode === 'local') return;
      nextMode = resolveAvailablePresentationMode(
        nextMode,
        activeViewStateRef.current,
        availabilityRef.current,
      );
      if (rendererModeRef.current === 'local' && nextMode === 'global') {
        exitFocusToAll();
        return;
      }
      if (
        nextMode === rendererModeRef.current ||
        (nextMode === 'global' && globalFailure !== undefined)
      ) {
        return;
      }
      if (rendererModeRef.current === 'global' && nextMode === 'structure') {
        if (retainDirtyFolderDraft()) return;
        temporaryFileMoveController?.cancel('layout-changed');
        setKeyboardFileMoveNodeId(undefined);
        transitionNetworkEditing({ type: 'leave-network' }, 'layout-changed');
        dispatchFolderArrangementMode({ type: 'exit' });
      }
      const currentState = activeViewStateRef.current;
      const nextAllState: ViewProjectionState = {
        disclosure: currentState.disclosure,
        ...(currentState.filters === undefined
          ? {}
          : { filters: currentState.filters }),
      };
      const current = currentHistoryCheckpoint();
      const recordModeDestination = (
        structure: PersistedViewportAnchor | undefined,
        global: PersistedGlobalViewport | undefined,
        local: PersistedLocalViewport | undefined,
      ) => {
        const destination = createGraphHistoryCheckpoint(
          nextAllState,
          undefined,
          nextMode,
          {
            ...(structure === undefined ? {} : { structure }),
            ...(global === undefined ? {} : { global }),
            ...(local === undefined ? {} : { local }),
          },
        );
        replaceNavigationHistory(
          recordGraphNavigation(
            navigationHistoryRef.current,
            current,
            destination,
          ),
        );
      };
      cancelPendingHistoryViewportRestore();

      const selected = selectedEntityId(projection, selection);
      if (nextMode === 'global') {
        const selectedDocument =
          selected === undefined
            ? undefined
            : containingDocumentEntityId(projectionWorkspace, selected);
        const structureAnchorDocument =
          viewportBookmarkRef.current === undefined
            ? undefined
            : containingDocumentEntityId(
                projectionWorkspace,
                viewportBookmarkRef.current.anchorEntityId,
              );
        const anchorEntityId =
          selectedDocument ??
          structureAnchorDocument ??
          globalViewportBookmarkRef.current?.anchorEntityId;
        const projectGlobalDestination = () =>
          projectView(
            projectionWorkspace,
            effectiveGlobalProjectionState(projectionWorkspace, nextAllState),
          );
        const nextProjection =
          performance === undefined
            ? projectGlobalDestination()
            : performance.measure(
                'global-projection',
                'global-projections',
                projectGlobalDestination,
              );
        const candidate = nextProjection.nodes.find(
          (candidate) =>
            candidate.kind === 'entity' &&
            candidate.entityId === anchorEntityId,
        );
        rendererModeRef.current = 'global';
        setRendererMode('global');
        if (!sameGraphViewState(currentState, nextAllState)) {
          activeViewStateRef.current = nextAllState;
          dispatch({ type: 'replace-state', state: nextAllState });
        }
        if (candidate === undefined || candidate.kind !== 'entity') {
          recordModeDestination(
            viewportBookmarkRef.current,
            undefined,
            localViewportBookmarkRef.current,
          );
          setSelection(null);
          setGlobalCenterRequest(undefined);
          requestGlobalFit();
        } else {
          const node = candidate;
          const savedGlobalViewport = globalViewportBookmarkRef.current;
          const viewport = {
            anchorEntityId: node.entityId,
            ratio:
              savedGlobalViewport?.anchorEntityId === node.entityId
                ? savedGlobalViewport.ratio
                : GLOBAL_NAVIGATION_RATIO,
          } satisfies PersistedGlobalViewport;
          recordModeDestination(
            viewportBookmarkRef.current,
            viewport,
            localViewportBookmarkRef.current,
          );
          setGlobalSemanticViewportBookmark(viewport);
          setSelection({ kind: 'node', id: node.id });
          requestGlobalSemanticCenter({
            nodeId: node.id,
            ratio: viewport.ratio,
          });
        }
        setNavigationAnnouncement(
          'Opened All Network. Zoom changes visual detail without changing graph topology or layout.',
        );
        return;
      }

      const selectedDocument =
        selected === undefined
          ? undefined
          : containingDocumentEntityId(projectionWorkspace, selected);
      const anchorEntityId =
        selectedDocument ??
        globalViewportBookmarkRef.current?.anchorEntityId ??
        viewportBookmarkRef.current?.anchorEntityId;
      let structureProjection =
        structureResult?.ok === true ? structureResult.projection : undefined;
      if (structureProjection === undefined) {
        try {
          structureProjection = projectStructureView(
            projectionWorkspace,
            nextAllState,
          );
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          setNavigationError(
            `Could not open All Hierarchy: graph projection failed: ${message}`,
          );
          return;
        }
      }
      const candidate = structureProjection
        ? structureProjection.nodes.find(
            (candidate) =>
              candidate.kind === 'entity' &&
              candidate.entityId === anchorEntityId,
          )
        : undefined;
      rendererModeRef.current = 'structure';
      setRendererMode('structure');
      if (!sameGraphViewState(currentState, nextAllState)) {
        activeViewStateRef.current = nextAllState;
        dispatch({ type: 'replace-state', state: nextAllState });
      }
      if (candidate === undefined || candidate.kind !== 'entity') {
        recordModeDestination(
          undefined,
          globalViewportBookmarkRef.current,
          localViewportBookmarkRef.current,
        );
        setSelection(null);
        setCenterRequest(undefined);
        setFitRequestKey((value) => value + 1);
      } else {
        const node = candidate;
        const savedStructureViewport = viewportBookmarkRef.current;
        const viewport = {
          anchorEntityId: node.entityId,
          zoom:
            savedStructureViewport?.anchorEntityId === node.entityId
              ? savedStructureViewport.zoom
              : ENTITY_NAVIGATION_ZOOM,
        } satisfies PersistedViewportAnchor;
        recordModeDestination(
          viewport,
          globalViewportBookmarkRef.current,
          localViewportBookmarkRef.current,
        );
        setSemanticViewportBookmark(viewport);
        setSelection({ kind: 'node', id: node.id });
        requestSemanticCenter({ nodeId: node.id, zoom: viewport.zoom });
      }
      setNavigationAnnouncement(
        'Opened All Hierarchy at the current file context.',
      );
    },
    [
      cancelPendingHistoryViewportRestore,
      currentHistoryCheckpoint,
      globalFailure,
      performance,
      projection,
      projectionWorkspace,
      replaceNavigationHistory,
      requestGlobalFit,
      requestGlobalSemanticCenter,
      requestSemanticCenter,
      retainDirtyFolderDraft,
      exitFocusToAll,
      selection,
      setGlobalSemanticViewportBookmark,
      setSemanticViewportBookmark,
      structureResult,
      temporaryFileMoveController,
      transitionNetworkEditing,
    ],
  );
  const applyExperimentalAllHierarchyAvailability = useCallback(
    (show: boolean) => {
      const wasStructure = rendererModeRef.current === 'structure';
      availabilityRef.current = {
        ...availabilityRef.current,
        showExperimentalAllHierarchy: show,
      };
      if (!show && wasStructure) {
        if (availabilityRef.current.allNetworkAvailable) {
          changeRendererMode('global');
          setNavigationAnnouncement(
            'Experimental All Hierarchy hidden. Opened All Network.',
          );
        } else {
          setNavigationAnnouncement(
            'All Hierarchy remains visible because All Network is unavailable. The experiment is off.',
          );
        }
      }
      const normalized = normalizeAvailableGraphHistory(
        navigationHistoryRef.current,
        currentHistoryCheckpoint(),
        availabilityRef.current,
      );
      replaceNavigationHistory(normalized.history);
    },
    [changeRendererMode, currentHistoryCheckpoint, replaceNavigationHistory],
  );
  const changeExperimentalAllHierarchy = useCallback(
    (show: boolean) => {
      updateGraphPreferences({ showExperimentalAllHierarchy: show });
      applyExperimentalAllHierarchyAvailability(show);
    },
    [applyExperimentalAllHierarchyAvailability, updateGraphPreferences],
  );
  const resetSandbox = useCallback(() => {
    const reset = resetGraphSandbox(preferencesRef.current);
    if (
      preferencesRef.current.focusHierarchyImplementation !==
      reset.preferences.focusHierarchyImplementation
    ) {
      changeFocusHierarchyImplementation(
        reset.preferences.focusHierarchyImplementation,
      );
    }
    if (globalLayoutSettingsApplyImmediately(activeScope, activeLayout)) {
      setGlobalLayoutRequestKey((current) => current + 1);
    }
    setAllNetworkDensityFramingStrength(reset.allNetworkDensityFramingStrength);
    setFocusNetworkDensityFramingStrength(
      reset.focusNetworkDensityFramingStrength,
    );
    commitGraphPreferences(reset.preferences);
    applyExperimentalAllHierarchyAvailability(
      reset.preferences.showExperimentalAllHierarchy,
    );
  }, [
    activeLayout,
    activeScope,
    applyExperimentalAllHierarchyAvailability,
    changeFocusHierarchyImplementation,
    commitGraphPreferences,
  ]);
  const enterFocusScope = useCallback(
    (entityId: EntityId): void => {
      const sourceMode = rendererModeRef.current;
      if (sourceMode !== 'global' && sourceMode !== 'structure') return;
      if (
        sourceMode === 'global' &&
        networkEditingState.phase === 'editing' &&
        networkEditingState.tool === 'arrange-folder'
      ) {
        if (retainDirtyFolderDraft()) return;
        transitionNetworkEditing({ type: 'exit' }, 'scope-changed');
        dispatchFolderArrangementMode({ type: 'exit' });
      } else {
        temporaryFileMoveController?.cancel('scope-changed');
        setKeyboardFileMoveNodeId(undefined);
      }
      try {
        const targetLayoutMode: LocalLayoutMode =
          sourceMode === 'global' ? 'free' : 'structured';
        const targetDepth =
          sourceMode === 'global'
            ? 0
            : activeViewStateRef.current.disclosure.defaultDepth;
        const prepare = () =>
          planLocalEntry(
            projectionWorkspace,
            activeViewStateRef.current,
            entityId,
            targetDepth,
          );
        const plan =
          performance === undefined
            ? prepare()
            : performance.measure(
                'global-to-local-transition',
                'global-to-local-transitions',
                prepare,
              );
        const sourceRootNode = projection?.nodes.find(
          (candidate) =>
            candidate.kind === 'entity' &&
            candidate.entityId === plan.rootEntityId,
        );
        const point =
          sourceRootNode === undefined
            ? undefined
            : sourceMode === 'global'
              ? globalTransitionAnchorApiRef.current?.nodeViewportPoint(
                  sourceRootNode.id,
                )
              : structureTransitionAnchorApiRef.current?.nodeViewportPoint(
                  sourceRootNode.id,
                );
        const destinationRootNode = plan.projection.nodes.find(
          (candidate) =>
            candidate.kind === 'entity' &&
            candidate.entityId === plan.rootEntityId,
        );
        const viewport = {
          anchorEntityId: plan.rootEntityId,
          freeRatio:
            localViewportBookmarkRef.current?.anchorEntityId ===
            plan.rootEntityId
              ? localViewportBookmarkRef.current.freeRatio
              : LOCAL_NAVIGATION_RATIO,
          structuredZoom:
            localViewportBookmarkRef.current?.anchorEntityId ===
            plan.rootEntityId
              ? (localViewportBookmarkRef.current.structuredZoom ??
                LOCAL_STRUCTURED_NAVIGATION_ZOOM)
              : LOCAL_STRUCTURED_NAVIGATION_ZOOM,
        } satisfies PersistedLocalViewport;
        const destination = createGraphHistoryCheckpoint(
          plan.state,
          undefined,
          'local',
          {
            ...(viewportBookmarkRef.current === undefined
              ? {}
              : { structure: viewportBookmarkRef.current }),
            ...(globalViewportBookmarkRef.current === undefined
              ? {}
              : { global: globalViewportBookmarkRef.current }),
            local: viewport,
          },
        );
        replaceNavigationHistory(
          recordGraphNavigation(
            navigationHistoryRef.current,
            currentHistoryCheckpoint(),
            destination,
          ),
        );
        cancelPendingHistoryViewportRestore();
        activeViewStateRef.current = plan.state;
        dispatch({ type: 'replace-state', state: plan.state });
        if (localLayoutModeRef.current !== targetLayoutMode) {
          localLayoutModeRef.current = targetLayoutMode;
          updateGraphPreferences({ localLayoutMode: targetLayoutMode });
        }
        rendererModeRef.current = 'local';
        setRendererMode('local');
        setSelection({ kind: 'node', id: plan.projectionNodeId });
        setLocalSemanticViewportBookmark(viewport);
        setLocalCenterRequest(undefined);
        setLocalStructuredCenterRequest(undefined);
        if (point === undefined) {
          requestLocalSemanticCenter({
            nodeId: destinationRootNode?.id ?? plan.projectionNodeId,
            freeRatio: viewport.freeRatio,
            structuredZoom: viewport.structuredZoom,
          });
        } else {
          const key = nextGraphViewportRequestKey(
            localTransitionGeneration.current,
          );
          localTransitionGeneration.current = key;
          setLocalTransitionAnchor({
            key,
            nodeId: destinationRootNode?.id ?? plan.projectionNodeId,
            point,
            zoom:
              targetLayoutMode === 'structured'
                ? viewport.structuredZoom
                : viewport.freeRatio,
          });
        }
        setNavigationError(undefined);
        setNavigationAnnouncement(plan.announcement);
      } catch (error: unknown) {
        setNavigationError(
          `Open Focus failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
    [
      updateGraphPreferences,
      cancelPendingHistoryViewportRestore,
      currentHistoryCheckpoint,
      performance,
      projection,
      projectionWorkspace,
      networkEditingState,
      retainDirtyFolderDraft,
      replaceNavigationHistory,
      requestLocalSemanticCenter,
      setLocalSemanticViewportBookmark,
      temporaryFileMoveController,
      transitionNetworkEditing,
    ],
  );
  const navigateToEntity = useCallback(
    (entityId: EntityId, origin: string) => {
      const target = projectionWorkspace.entity(entityId);
      const enterExactFocus =
        rendererModeRef.current !== 'local' &&
        target !== undefined &&
        target.kind !== 'document' &&
        !allHierarchyAvailable(availabilityRef.current);
      if (rendererModeRef.current === 'local' || enterExactFocus) {
        try {
          const plan = planLocalEntityNavigation(
            projectionWorkspace,
            activeViewStateRef.current,
            entityId,
          );
          const viewport = {
            anchorEntityId: entityId,
            freeRatio:
              localViewportBookmarkRef.current?.freeRatio ??
              LOCAL_NAVIGATION_RATIO,
            structuredZoom:
              localViewportBookmarkRef.current?.structuredZoom ??
              LOCAL_STRUCTURED_NAVIGATION_ZOOM,
          } satisfies PersistedLocalViewport;
          const destination = createGraphHistoryCheckpoint(
            plan.state,
            undefined,
            'local',
            {
              ...(viewportBookmarkRef.current === undefined
                ? {}
                : { structure: viewportBookmarkRef.current }),
              ...(globalViewportBookmarkRef.current === undefined
                ? {}
                : { global: globalViewportBookmarkRef.current }),
              local: viewport,
            },
          );
          replaceNavigationHistory(
            recordGraphNavigation(
              navigationHistoryRef.current,
              currentHistoryCheckpoint(),
              destination,
            ),
          );
          cancelPendingHistoryViewportRestore();
          activeViewStateRef.current = plan.state;
          dispatch({ type: 'replace-state', state: plan.state });
          if (enterExactFocus) {
            localLayoutModeRef.current = 'structured';
            updateGraphPreferences({ localLayoutMode: 'structured' });
            rendererModeRef.current = 'local';
            setRendererMode('local');
          }
          setLocalSemanticViewportBookmark(viewport);
          setSelection({ kind: 'node', id: plan.projectionNodeId });
          requestLocalSemanticCenter({
            nodeId: plan.projectionNodeId,
            freeRatio: viewport.freeRatio,
            structuredZoom: viewport.structuredZoom,
          });
          setNavigationError(undefined);
          setNavigationAnnouncement(
            `${origin}: ${
              enterExactFocus
                ? 'Opened Focus Hierarchy and revealed the exact target.'
                : plan.announcement
            }`,
          );
        } catch (error: unknown) {
          setNavigationError(
            `${origin}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        return;
      }
      if (rendererModeRef.current === 'global' && target?.kind === 'document') {
        const node = globalResult?.ok
          ? globalResult.projection.nodes.find(
              (candidate) =>
                candidate.kind === 'entity' && candidate.entityId === entityId,
            )
          : undefined;
        if (node === undefined) {
          setNavigationError(
            `${origin}: the document is hidden by the current All Network filters.`,
          );
          return;
        }
        const viewport = {
          anchorEntityId: entityId,
          ratio: GLOBAL_NAVIGATION_RATIO,
        } satisfies PersistedGlobalViewport;
        setGlobalSemanticViewportBookmark(viewport);
        setSelection({ kind: 'node', id: node.id });
        requestGlobalSemanticCenter({
          nodeId: node.id,
          ratio: viewport.ratio,
        });
        setNavigationError(undefined);
        setNavigationAnnouncement(
          `${origin}: centered the file in All Network.`,
        );
        return;
      }
      if (rendererModeRef.current === 'global') {
        changeRendererMode('structure');
      }
      const plan = planEntityNavigation(
        projectionWorkspace,
        activeViewStateRef.current,
        entityId,
      );
      if (!plan.ok) {
        setNavigationError(`${origin}: ${plan.message}`);
        return;
      }
      const targetViewport = {
        anchorEntityId: entityId,
        zoom: ENTITY_NAVIGATION_ZOOM,
      } satisfies PersistedViewportAnchor;
      commitGraphDestination(plan.state, targetViewport);
      cancelPendingHistoryViewportRestore();
      setSemanticViewportBookmark(targetViewport);
      setSelection({ kind: 'node', id: plan.projectionNodeId });
      requestSemanticCenter({
        nodeId: plan.projectionNodeId,
        zoom: ENTITY_NAVIGATION_ZOOM,
      });
      setNavigationError(undefined);
      setNavigationAnnouncement(`${origin}: ${plan.announcement}`);
    },
    [
      updateGraphPreferences,
      cancelPendingHistoryViewportRestore,
      changeRendererMode,
      commitGraphDestination,
      currentHistoryCheckpoint,
      globalResult,
      projectionWorkspace,
      replaceNavigationHistory,
      requestGlobalSemanticCenter,
      requestLocalSemanticCenter,
      requestSemanticCenter,
      setGlobalSemanticViewportBookmark,
      setLocalSemanticViewportBookmark,
      setSemanticViewportBookmark,
    ],
  );
  const focusLocalEntity = useCallback(
    (entityId: EntityId) => navigateToEntity(entityId, 'Focus'),
    [navigateToEntity],
  );
  const focusNetworkExplorerNode = useCallback(
    (nodeId: ProjectionNodeId) => {
      const entityId = networkExplorerModel?.nodeById.get(nodeId)?.entityId;
      if (entityId === undefined) return;
      if (rendererModeRef.current === 'global') enterFocusScope(entityId);
      else navigateToEntity(entityId, 'Focus');
    },
    [enterFocusScope, navigateToEntity, networkExplorerModel],
  );

  function changeHierarchyDepth(depth: 0 | 1 | 2 | 3): void {
    if (rendererModeRef.current !== 'local') {
      void commitHistoryGraphAction({ type: 'set-depth', depth });
      return;
    }
    const rootEntityId = activeViewStateRef.current.focus?.rootEntityId;
    const rootNode = projection?.nodes.find(
      (node) => node.kind === 'entity' && node.entityId === rootEntityId,
    );
    const sourceApi =
      localLayoutModeRef.current === 'free'
        ? localFreeTransitionAnchorApiRef.current
        : localStructuredTransitionAnchorApiRef.current;
    const rootAnchorStaged =
      rootNode === undefined
        ? false
        : (sourceApi?.stageNodeAnchor(rootNode.id) ?? false);
    if (!commitHistoryGraphAction({ type: 'set-depth', depth })) return;
    const bookmark = localViewportBookmarkRef.current;
    // Each active Focus renderer stages the root before the semantic update,
    // then preserves it through its seed/reconciliation and worker refinement.
    // KG6 runs once and no sibling renderer or workspace work is started.
    if (!rootAnchorStaged && rootNode !== undefined) {
      requestLocalSemanticCenter({
        nodeId: rootNode.id,
        freeRatio: bookmark?.freeRatio ?? LOCAL_NAVIGATION_RATIO,
        structuredZoom:
          bookmark?.structuredZoom ?? LOCAL_STRUCTURED_NAVIGATION_ZOOM,
      });
    }
  }

  function changeHops(hops: 1 | 2 | 3): void {
    if (rendererModeRef.current === 'local') {
      void commitHistoryGraphAction({ type: 'set-focus-hops', hops });
      return;
    }
    if (
      commitHistoryGraphAction(
        { type: 'set-focus-hops', hops },
        { fitDestination: true },
      )
    )
      setFitRequestKey((current) => current + 1);
  }

  function changeDirection(direction: 'incoming' | 'outgoing' | 'both'): void {
    if (rendererModeRef.current === 'local') {
      void commitHistoryGraphAction({
        type: 'set-focus-direction',
        direction,
      });
      return;
    }
    if (
      commitHistoryGraphAction(
        { type: 'set-focus-direction', direction },
        { fitDestination: true },
      )
    )
      setFitRequestKey((current) => current + 1);
  }

  const changeExplorationScope = useCallback(
    (scope: ExplorationScope): void => {
      if (scope === activeScope) return;
      if (scope === 'all') {
        exitFocusToAll();
        return;
      }
      if (selectedFocusableEntityId !== undefined) {
        enterFocusScope(selectedFocusableEntityId);
      }
    },
    [activeScope, enterFocusScope, exitFocusToAll, selectedFocusableEntityId],
  );

  const changeExplorationLayout = useCallback(
    (layout: ExplorationLayout): void => {
      if (layout === activeLayout) return;
      if (activeScope === 'focus') {
        changeLocalLayoutMode(focusLayoutMode(layout));
      } else {
        changeRendererMode(allPresentationMode(layout));
      }
    },
    [activeLayout, activeScope, changeLocalLayoutMode, changeRendererMode],
  );

  const temporaryFileMoveStatus =
    temporaryFileMoveFailure !== undefined ||
    networkEditingState.phase === 'editing'
      ? undefined
      : temporaryFileMoveCapability.status === 'unavailable'
        ? temporaryFileMoveCapability.reason === 'simulation-not-running'
          ? 'Waiting for Network layout…'
          : temporaryFileMoveCapability.reason === 'graph-too-large'
            ? `File movement supports up to ${NETWORK_PHYSICS_SUPPORTED_NODE_LIMIT} visible nodes in this release.`
            : 'File movement is unavailable in this Network view.'
        : temporaryFileMoveLifecycle === 'cooling' ||
            temporaryFileMovePresentation === 'settling'
          ? 'Settling…'
          : undefined;

  function resetSavedView(): void {
    if (persistenceStorage === undefined) {
      setPersistenceError(
        'Could not reset the current view because browser storage is unavailable.',
      );
      return;
    }
    const cleared = clearWorkspaceView(
      persistenceStorage,
      projectionWorkspace.snapshot().workspace.id,
    );
    if (!cleared.ok) {
      persistenceWritable.current = false;
      setPersistenceError(
        `${cleared.message} The graph remains usable in memory.`,
      );
      return;
    }
    const defaults = initialGraphState();
    const defaultMode = resolveAvailablePresentationMode(
      'global',
      defaults,
      availabilityRef.current,
    );
    lastSerializedView.current = serializePersistedWorkspaceView(
      createPersistedWorkspaceView({
        workspace: projectionWorkspace,
        state: defaults,
        presentationMode: defaultMode,
        viewports: {},
      }),
    );
    clearNavigationHistory();
    dispatch({ type: 'reset-view' });
    activeViewStateRef.current = defaults;
    setSelection(null);
    rendererModeRef.current = defaultMode;
    setRendererMode(defaultMode);
    setCenterRequest(undefined);
    setGlobalCenterRequest(undefined);
    setLocalCenterRequest(undefined);
    setLocalStructuredCenterRequest(undefined);
    setSemanticViewportBookmark(undefined);
    setGlobalSemanticViewportBookmark(undefined);
    setLocalSemanticViewportBookmark(undefined);
    setLocalTransitionAnchor(undefined);
    setTransientResetKey((current) => current + 1);
    setFitRequestKey((current) => current + 1);
    requestGlobalFit();
    setAutomaticLocalFitRequestKey(undefined);
    setLocalFitRequestKey(undefined);
    persistenceWritable.current = true;
    setPersistenceError(undefined);
    setPersistenceAnnouncement('Current graph view reset.');
    setNavigationError(undefined);
    setNavigationAnnouncement(
      'Current view reset to Files only; search and selection were cleared. Named Saved Views were unchanged.',
    );
  }

  const canGoBack = navigationHistory.past.length > 0;
  const canGoForward = navigationHistory.future.length > 0;
  const selectedLocalEntity =
    effectiveRendererMode === 'local' &&
    activeSelection?.kind === 'node' &&
    projection !== undefined
      ? projection.nodes.find(
          (node) => node.kind === 'entity' && node.id === activeSelection.id,
        )
      : undefined;
  const selectedLocalExpanded =
    selectedLocalEntity?.kind === 'entity' &&
    (activeViewState.disclosure.expandedEntityIds.includes(
      selectedLocalEntity.entityId,
    ) ||
      (projection?.edges.some(
        (edge) =>
          edge.kind === 'hierarchy' &&
          edge.sourceNodeId === selectedLocalEntity.id,
      ) ??
        false)) === true;
  const localDisclosureControl =
    selectedLocalEntity?.kind === 'entity' &&
    (selectedLocalEntity.entityKind === 'document' ||
      selectedLocalEntity.entityKind === 'section') &&
    (selectedLocalExpanded || selectedLocalEntity.revealableDescendantCount > 0)
      ? {
          entityId: selectedLocalEntity.entityId,
          currentlyOpen: selectedLocalExpanded,
          label: selectedLocalExpanded
            ? ('Collapse' as const)
            : ('Expand' as const),
        }
      : undefined;
  const localRootEntityId =
    effectiveRendererMode === 'local'
      ? activeViewState.focus?.rootEntityId
      : undefined;
  const networkExplorerSelection =
    networkProjection !== undefined &&
    selectionExists(networkProjection, selection)
      ? selection
      : null;

  return (
    <section
      className={`graph-workspace${maximized ? ' graph-workspace--maximized' : ''}`}
      aria-label="Knowledge graph workspace"
      onKeyDownCapture={activateGraphHistoryShortcut}
    >
      {maximized ? (
        <div
          aria-label="Canvas tools"
          className="graph-floating-controls"
          role="group"
        >
          <GraphHistoryControls
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={goBack}
            onForward={goForward}
          />
          <SavedViewsPopover {...namedSavedViews} />
          <button
            aria-controls="graph-tools-panel"
            aria-expanded={activeOverlay === 'tools'}
            className="graph-tools-trigger"
            onClick={toggleTools}
            type="button"
          >
            <ToolsIcon />
            <span>Tools</span>
          </button>
          <GraphSettings
            {...(allNetworkDensityQaDiagnostics === undefined
              ? {}
              : { allNetworkDensityQaDiagnostics })}
            allNetworkDensityFramingStrength={allNetworkDensityFramingStrength}
            {...(focusNetworkDensityQaDiagnostics === undefined
              ? {}
              : { focusNetworkDensityQaDiagnostics })}
            focusNetworkDensityFramingStrength={
              focusNetworkDensityFramingStrength
            }
            focusHierarchyImplementation={focusHierarchyImplementation}
            modularFocusHeadingOrder={modularFocusHeadingOrder}
            modularFocusInternalLayout={modularFocusInternalLayout}
            modularFocusMacroLayout={modularFocusMacroLayout}
            modularFocusSoftFolderStrength={modularFocusSoftFolderStrength}
            modularFolderStripsVisible={modularFolderStripsVisible}
            modularConnectionStyle={modularConnectionStyle}
            showExperimentalAllHierarchy={showExperimentalAllHierarchy}
            onShowExperimentalAllHierarchyChange={
              changeExperimentalAllHierarchy
            }
            focusAppearance={focusAppearance}
            globalLayoutSettings={globalLayoutSettings}
            onAllNetworkDensityFramingStrengthChange={
              changeAllNetworkDensityFramingStrength
            }
            onFocusNetworkDensityFramingStrengthChange={
              changeFocusNetworkDensityFramingStrength
            }
            onFocusAppearanceChange={changeFocusAppearance}
            onFocusHierarchyImplementationChange={
              changeFocusHierarchyImplementation
            }
            onModularFocusHeadingOrderChange={changeModularFocusHeadingOrder}
            onModularFocusInternalLayoutChange={
              changeModularFocusInternalLayout
            }
            onModularFocusMacroLayoutChange={changeModularFocusMacroLayout}
            onModularFocusSoftFolderStrengthChange={
              changeModularFocusSoftFolderStrength
            }
            onModularFolderStripsVisibleChange={
              changeModularFolderStripsVisible
            }
            onModularConnectionStyleChange={changeModularConnectionStyle}
            onGlobalLayoutSettingsChange={changeGlobalLayoutSettings}
            onOpenChange={changeSettingsOpen}
            onTrackpadZoomModeChange={changeTrackpadZoomMode}
            onResetSandbox={resetSandbox}
            open={activeOverlay === 'settings'}
            trackpadZoomMode={trackpadZoomMode}
            {...(preferenceWarning === undefined
              ? {}
              : { warning: preferenceWarning })}
          >
            {settingsContent}
          </GraphSettings>
        </div>
      ) : null}

      <div
        className="graph-tools-surface"
        hidden={maximized && activeOverlay !== 'tools'}
        id="graph-tools-panel"
      >
        <div className="graph-tools-panel__heading">
          <h2>Tools</h2>
          <button onClick={closeTools} type="button">
            Close Tools
          </button>
        </div>
        <div className="graph-tools-panel__body" data-graph-scroll-container>
          <EntitySearch
            key={transientResetKey}
            onNavigate={navigateToEntity}
            {...(performance === undefined ? {} : { performance })}
            workspace={inspectionWorkspace}
          />

          <div className="graph-toolbar" aria-label="Graph view controls">
            {maximized ? null : (
              <GraphHistoryControls
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                onBack={goBack}
                onForward={goForward}
              />
            )}
            <ExplorationControls
              allHierarchyExposed={allHierarchyExposed}
              {...(activeScope === 'all' &&
              selectedFocusableEntityId === undefined
                ? { focusDisabledReason: 'Select a file first.' }
                : {})}
              {...(focusedRootLabel === undefined ? {} : { focusedRootLabel })}
              layout={activeLayout}
              {...(globalFailure === undefined
                ? {}
                : { networkDisabledReason: globalFailure })}
              onLayoutChange={changeExplorationLayout}
              onScopeChange={changeExplorationScope}
              scope={activeScope}
            />
            {maximized ? null : <SavedViewsPopover {...namedSavedViews} />}
            {networkLayoutActive ? (
              <NetworkEditingControls
                {...(activeScope !== 'all' ||
                folderArrangementAvailability.available
                  ? {}
                  : {
                      arrangeDisabledReason:
                        folderArrangementAvailability.reason === undefined
                          ? 'Arrange Folders is unavailable right now.'
                          : 'Waiting for Network layout…',
                    })}
                {...(temporaryFileMoveFailure === undefined
                  ? {}
                  : { failure: temporaryFileMoveFailure })}
                onDone={finishNetworkEditing}
                onArrange={beginFolderArrangement}
                onRetry={retryTemporaryFileMove}
                scope={activeScope}
                state={networkEditingState}
                {...(temporaryFileMoveStatus === undefined
                  ? {}
                  : { status: temporaryFileMoveStatus })}
              />
            ) : null}
            {activeScope === 'focus' || activeLayout === 'hierarchy' ? (
              <StructureDepthControl
                custom={
                  activeViewState.disclosure.expandedEntityIds.length > 0 ||
                  activeViewState.disclosure.collapsedEntityIds.length > 0
                }
                depth={activeViewState.disclosure.defaultDepth}
                onChange={changeHierarchyDepth}
              />
            ) : null}
            {activeLayout === 'network' || activeScope === 'focus' ? (
              <div
                aria-label="Layout actions"
                className="control-group"
                role="group"
              >
                <button
                  onClick={() => {
                    if (
                      networkEditingState.phase === 'editing' &&
                      networkEditingState.tool === 'arrange-folder' &&
                      retainDirtyFolderDraft()
                    ) {
                      return;
                    }
                    temporaryFileMoveController?.cancel('layout-changed');
                    setKeyboardFileMoveNodeId(undefined);
                    if (
                      networkEditingState.phase === 'editing' &&
                      networkEditingState.tool === 'arrange-folder'
                    ) {
                      transitionNetworkEditing(
                        { type: 'exit' },
                        'layout-changed',
                      );
                    }
                    dispatchFolderArrangementMode({ type: 'exit' });
                    if (activeScope === 'focus') {
                      setLocalLayoutRequestKey((current) => current + 1);
                    } else {
                      setGlobalLayoutRequestKey((current) => current + 1);
                    }
                  }}
                  type="button"
                >
                  Re-layout
                </button>
              </div>
            ) : null}
            <GraphFilters
              queryEditor={queryEditor}
              queryInNetworkExplorer={networkLayoutActive}
              contained={maximized}
              onAction={applyGraphAction}
              onApplySavedFilter={applySavedFilter}
              onDeleteSavedFilter={removeSavedFilter}
              onOpenChange={changeFiltersOpen}
              onSaveCurrentQuery={saveCurrentQuery}
              open={filtersOpen}
              pathScopes={pathScopes}
              rendererMode={effectiveRendererMode}
              savedFilters={savedFilterSession.registry.filters}
              savedFiltersStatus={savedFilterSession.status}
              savedFiltersWritable={savedFilterSession.writable}
              state={activeViewState}
            />
            <VisualGroups
              {...(activeViewState.filters?.query === undefined
                ? {}
                : { activeQuery: activeViewState.filters.query })}
              contained={maximized}
              {...(visualGroupError === undefined
                ? {}
                : { error: visualGroupError })}
              onCommit={commitVisualGroupMutation}
              key={visualGroupSessionKey}
              onOpenChange={changeGroupsOpen}
              onResetSaved={resetSavedVisualGroups}
              open={groupsOpen}
              session={activeVisualGroupSession}
            />
            {activeScope !== 'focus' ||
            activeViewState.focus === undefined ? null : (
              <div
                className="control-group control-group--focus"
                aria-label="Focus controls"
                role="group"
              >
                <label>
                  Hops
                  <select
                    onChange={(event) =>
                      changeHops(Number(event.currentTarget.value) as 1 | 2 | 3)
                    }
                    value={activeViewState.focus.hops}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </label>
                <label>
                  Direction
                  <select
                    onChange={(event) =>
                      changeDirection(
                        event.currentTarget.value as
                          'incoming' | 'outgoing' | 'both',
                      )
                    }
                    value={activeViewState.focus.direction}
                  >
                    <option value="both">Both</option>
                    <option value="incoming">Incoming</option>
                    <option value="outgoing">Outgoing</option>
                  </select>
                </label>
              </div>
            )}
            <div
              className="control-group control-group--workspace"
              aria-label="Workspace controls"
              role="group"
            >
              {projection === undefined ? null : (
                <span className="graph-counts" aria-live="polite">
                  {projection.nodes.length} nodes · {projection.edges.length}{' '}
                  edges
                </span>
              )}
              {eligibility === 'stable' ? (
                <button onClick={resetSavedView} type="button">
                  Reset current view
                </button>
              ) : null}
              {maximized ? null : (
                <GraphSettings
                  {...(allNetworkDensityQaDiagnostics === undefined
                    ? {}
                    : { allNetworkDensityQaDiagnostics })}
                  allNetworkDensityFramingStrength={
                    allNetworkDensityFramingStrength
                  }
                  {...(focusNetworkDensityQaDiagnostics === undefined
                    ? {}
                    : { focusNetworkDensityQaDiagnostics })}
                  focusNetworkDensityFramingStrength={
                    focusNetworkDensityFramingStrength
                  }
                  focusHierarchyImplementation={focusHierarchyImplementation}
                  modularFocusHeadingOrder={modularFocusHeadingOrder}
                  modularFocusInternalLayout={modularFocusInternalLayout}
                  modularFocusMacroLayout={modularFocusMacroLayout}
                  modularFocusSoftFolderStrength={
                    modularFocusSoftFolderStrength
                  }
                  modularFolderStripsVisible={modularFolderStripsVisible}
                  modularConnectionStyle={modularConnectionStyle}
                  showExperimentalAllHierarchy={showExperimentalAllHierarchy}
                  onShowExperimentalAllHierarchyChange={
                    changeExperimentalAllHierarchy
                  }
                  focusAppearance={focusAppearance}
                  globalLayoutSettings={globalLayoutSettings}
                  onAllNetworkDensityFramingStrengthChange={
                    changeAllNetworkDensityFramingStrength
                  }
                  onFocusNetworkDensityFramingStrengthChange={
                    changeFocusNetworkDensityFramingStrength
                  }
                  onFocusAppearanceChange={changeFocusAppearance}
                  onFocusHierarchyImplementationChange={
                    changeFocusHierarchyImplementation
                  }
                  onModularFocusHeadingOrderChange={
                    changeModularFocusHeadingOrder
                  }
                  onModularFocusInternalLayoutChange={
                    changeModularFocusInternalLayout
                  }
                  onModularFocusMacroLayoutChange={
                    changeModularFocusMacroLayout
                  }
                  onModularFocusSoftFolderStrengthChange={
                    changeModularFocusSoftFolderStrength
                  }
                  onModularFolderStripsVisibleChange={
                    changeModularFolderStripsVisible
                  }
                  onModularConnectionStyleChange={changeModularConnectionStyle}
                  onGlobalLayoutSettingsChange={changeGlobalLayoutSettings}
                  onOpenChange={changeSettingsOpen}
                  onTrackpadZoomModeChange={changeTrackpadZoomMode}
                  onResetSandbox={resetSandbox}
                  open={activeOverlay === 'settings'}
                  trackpadZoomMode={trackpadZoomMode}
                  {...(preferenceWarning === undefined
                    ? {}
                    : { warning: preferenceWarning })}
                >
                  {settingsContent}
                </GraphSettings>
              )}
              {networkLayoutActive && networkExplorerModel !== undefined ? (
                <button
                  aria-label={
                    networkExplorerVisible
                      ? 'Close Network Explorer'
                      : 'Open Network Explorer'
                  }
                  aria-pressed={networkExplorerVisible}
                  className="graph-inspector-toggle graph-network-explorer-toggle"
                  onClick={toggleNetworkExplorer}
                  ref={networkExplorerToolbarRef}
                  title={
                    networkExplorerVisible
                      ? 'Close Network Explorer'
                      : 'Open Network Explorer'
                  }
                  type="button"
                >
                  <NetworkExplorerIcon />
                </button>
              ) : null}
              <button
                aria-label={
                  inspectorOpen ? 'Close Inspector' : 'Open Inspector'
                }
                aria-pressed={inspectorOpen}
                className="graph-inspector-toggle"
                onClick={toggleInspector}
                ref={inspectorToolbarRef}
                title="Inspector"
                type="button"
              >
                <InspectorSidebarIcon />
              </button>
            </div>
          </div>
          {maximized ? <ProjectionIssues projection={projection} /> : null}
        </div>
      </div>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {persistenceAnnouncement}
      </p>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {navigationAnnouncement}
      </p>
      <div className="graph-alert-stack">
        {persistenceError === undefined ? null : (
          <p className="graph-alert" role="alert">
            {persistenceError}
          </p>
        )}
        {navigationError === undefined ? null : (
          <p className="graph-alert" role="alert">
            {navigationError}
          </p>
        )}
        {savedFilterError === undefined ? null : (
          <p className="graph-alert" role="alert">
            {savedFilterError}
          </p>
        )}
        {savedViewError === undefined ? null : (
          <p className="graph-alert" role="alert">
            {savedViewError}
          </p>
        )}
        {visualGroupError === undefined ? null : (
          <p className="graph-alert" role="alert">
            {visualGroupError}
          </p>
        )}
        {nodePresentation.session.error === undefined ? null : (
          <p className="graph-alert" role="alert">
            {nodePresentation.session.error}
          </p>
        )}
        {spatialOverrides.session.error === undefined ? null : (
          <p className="graph-alert" role="alert">
            {spatialOverrides.session.error}
          </p>
        )}
        {globalFailure === undefined ? null : (
          <p className="graph-alert" role="alert">
            {globalFailure}
          </p>
        )}
        {localUnavailable === undefined ? null : (
          <p className="graph-alert" role="alert">
            {localUnavailable}
          </p>
        )}
        {modularSessionFailure === undefined ? null : (
          <div className="graph-alert" role="alert">
            <span>{modularSessionFailure}</span>{' '}
            <button
              onClick={() => {
                setModularLoadFailure(undefined);
                setModularSessionFailureState(undefined);
              }}
              type="button"
            >
              Retry Modular Preview
            </button>
          </div>
        )}
      </div>

      {result.ok ? (
        <div
          className={`graph-stage${
            inspectorOpen ? ' graph-stage--inspector-drawer-open' : ''
          }${networkExplorerVisible ? ' graph-stage--network-explorer-open' : ''}`}
        >
          {effectiveRendererMode === 'global' ? (
            GlobalGraphView === undefined ? (
              <p className="graph-loading" role="status">
                Loading All Network…
              </p>
            ) : (
              <GlobalGraphView
                {...(globalFitRequest?.automatic === true
                  ? { automaticFitRequestKey: globalFitRequest.key }
                  : {})}
                densityFramingStrength={allNetworkDensityFramingStrength}
                folderArrangement={folderArrangementViewProps}
                {...(globalCenterRequest === undefined
                  ? {}
                  : { centerRequest: globalCenterRequest })}
                fitRequestKey={globalFitRequest?.key ?? 0}
                {...(globalViewportBookmark === undefined
                  ? {}
                  : { initialViewport: globalViewportBookmark })}
                {...(performance === undefined
                  ? {}
                  : { instrumentation: performance })}
                layoutRequestKey={globalLayoutRequestKey}
                maximized={maximized}
                {...(networkStartupTrace === undefined
                  ? {}
                  : { startupTrace: networkStartupTrace })}
                onFailure={(message) =>
                  setGlobalUnavailable(
                    `All Network renderer failed: ${message} All Hierarchy remains available for this session.`,
                  )
                }
                onTemporaryFileMoveCapabilityChange={
                  changeTemporaryFileMoveCapability
                }
                onTemporaryFileMoveControllerChange={
                  changeTemporaryFileMoveController
                }
                onTemporaryFileMoveFailure={reportTemporaryFileMoveFailure}
                onTemporaryFileMoveLifecycleChange={
                  changeTemporaryFileMoveLifecycle
                }
                onTemporaryFileMovePresentationChange={
                  changeTemporaryFileMovePresentation
                }
                onDensityQaDiagnosticsChange={setAllNetworkDensityQaDiagnostics}
                onCenterRequestConsumed={consumeGlobalCenterRequest}
                onFitRequestConsumed={consumeGlobalFitRequest}
                onFitRequested={requestGlobalFit}
                onMaximizedChange={changeMaximized}
                onNodeActivate={enterFocusScope}
                onNodeSingleClick={revealGraphNode}
                onSelectionChange={changeGlobalSelection}
                onTransitionAnchorApiChange={changeGlobalTransitionAnchorApi}
                onViewportObservation={observeGlobalViewport}
                projection={result.projection}
                selection={activeSelection}
                settings={globalLayoutSettings}
                presentationOverrides={nodePresentation.overrides}
                spatialOverrides={spatialOverrides.anchors}
                spatialRules={spatialOverrides.rules}
                spatialSourceKey={workspaceId}
                trackpadZoomMode={trackpadZoomMode}
                temporaryConstraintActive={networkEditingState.phase === 'off'}
                temporaryConstraintRetryKey={temporaryFileMoveRetryKey}
                visualGroupStyles={visualGroupPresentation.styles}
              />
            )
          ) : effectiveRendererMode === 'local' ? (
            localUnavailable !== undefined ||
            localRootEntityId === undefined ? (
              <div className="graph-failure" role="alert">
                <p>
                  {localUnavailable ??
                    `Focus ${localLayoutMode === 'free' ? 'Network' : 'Hierarchy'} has no stable document root. Return to All to recover.`}
                </p>
                {localLayoutMode === 'structured' &&
                localStructuredUnavailable !== undefined ? (
                  <button
                    onClick={() => changeLocalLayoutMode('free')}
                    type="button"
                  >
                    Open Focus Network
                  </button>
                ) : null}
                {localLayoutMode === 'free' &&
                localStructuredUnavailable === undefined ? (
                  <button
                    onClick={() => changeLocalLayoutMode('structured')}
                    type="button"
                  >
                    Open Focus Hierarchy
                  </button>
                ) : null}
                {allHierarchyExposed ? (
                  <button
                    onClick={() => changeRendererMode('structure')}
                    type="button"
                  >
                    Open full hierarchy
                  </button>
                ) : null}
                <button onClick={exitFocusToAll} type="button">
                  Return to All
                </button>
              </div>
            ) : localLayoutMode === 'free' && LocalGraphView === undefined ? (
              <p className="graph-loading" role="status">
                Loading Focus Network…
              </p>
            ) : localLayoutMode === 'structured' &&
              modularPreviewActive &&
              ModularStructuredGraphView === undefined ? (
              <p className="graph-loading" role="status">
                Loading Modular Focus Hierarchy…
              </p>
            ) : localLayoutMode === 'structured' &&
              !modularPreviewActive &&
              LocalStructuredGraphView === undefined ? (
              <p className="graph-loading" role="status">
                Loading Focus Hierarchy…
              </p>
            ) : localLayoutMode === 'free' && LocalGraphView !== undefined ? (
              <LocalGraphView
                {...(automaticLocalFitRequestKey === undefined
                  ? {}
                  : {
                      automaticFitRequestKey: automaticLocalFitRequestKey,
                    })}
                densityFramingStrength={focusNetworkDensityFramingStrength}
                {...(localCenterRequest === undefined
                  ? {}
                  : { centerRequest: localCenterRequest })}
                {...(localFitRequestKey === undefined
                  ? {}
                  : { fitRequestKey: localFitRequestKey })}
                {...(localViewportBookmark === undefined
                  ? {}
                  : { initialViewport: localViewportBookmark })}
                layoutRequestKey={localLayoutRequestKey}
                maximized={maximized}
                networkSettings={networkSettings}
                {...(localTransitionAnchor === undefined
                  ? {}
                  : { initialTransitionAnchor: localTransitionAnchor })}
                {...(performance === undefined
                  ? {}
                  : { instrumentation: performance })}
                onFailure={(message) =>
                  setLocalFreeUnavailable(
                    `Focus Network renderer failed: ${message} Use Focus Hierarchy or return to All.`,
                  )
                }
                onTemporaryFileMoveCapabilityChange={
                  changeTemporaryFileMoveCapability
                }
                onTemporaryFileMoveControllerChange={
                  changeTemporaryFileMoveController
                }
                onTemporaryFileMoveFailure={reportTemporaryFileMoveFailure}
                onTemporaryFileMoveLifecycleChange={
                  changeTemporaryFileMoveLifecycle
                }
                onTemporaryFileMovePresentationChange={
                  changeTemporaryFileMovePresentation
                }
                onDensityQaDiagnosticsChange={
                  setFocusNetworkDensityQaDiagnostics
                }
                onCenterRequestConsumed={consumeLocalCenterRequest}
                onFitRequestConsumed={consumeLocalFitRequest}
                onFitRequested={requestLocalFit}
                onMaximizedChange={changeMaximized}
                onNodeActivate={focusLocalEntity}
                onNodeSingleClick={revealGraphNode}
                onSelectionChange={changeLocalSelection}
                onTransitionAnchorApiChange={changeLocalFreeTransitionAnchorApi}
                onTransitionAnchorConsumed={consumeLocalTransitionAnchor}
                onViewportObservation={observeLocalFreeViewport}
                projection={result.projection}
                rootEntityId={localRootEntityId}
                selection={activeSelection}
                temporaryConstraintActive={networkEditingState.phase === 'off'}
                temporaryConstraintRetryKey={temporaryFileMoveRetryKey}
                trackpadZoomMode={trackpadZoomMode}
                presentationOverrides={nodePresentation.overrides}
                visualGroupStyles={visualGroupPresentation.styles}
              />
            ) : modularPreviewActive &&
              ModularStructuredGraphView !== undefined ? (
              <ModularStructuredGraphView
                key={workspaceId}
                {...(localStructuredCenterRequest === undefined
                  ? {}
                  : { centerRequest: localStructuredCenterRequest })}
                fitRequestKey={localFitRequestKey ?? 0}
                focusAppearance={focusAppearance}
                endpointOrderPolicy={modularFocusHeadingOrder}
                folderGuidesVisible={modularFolderStripsVisible}
                internalLayoutVariant={modularFocusInternalLayout}
                macroLayout={modularFocusMacroLayout}
                softFolderStrength={modularFocusSoftFolderStrength}
                softFolderDisplayIntent={softFolderDisplay.displayIntent}
                softFolderDisplayPersistenceError={
                  softFolderDisplay.session.error
                }
                softFolderDisplayPersistenceStatus={
                  softFolderDisplay.session.status
                }
                routeStyle={modularConnectionStyle}
                {...(localTransitionAnchor === undefined
                  ? {}
                  : { initialTransitionAnchor: localTransitionAnchor })}
                {...(performance === undefined
                  ? {}
                  : { instrumentation: performance })}
                onFatalFailure={(message) =>
                  setModularSessionFailureState({
                    workspaceId,
                    message: `${message} Classic Focus Hierarchy is active for this session. The Modular Preview preference was retained.`,
                  })
                }
                onFitRequestConsumed={consumeLocalFitRequest}
                onFocusEntity={focusLocalEntity}
                onSelectionChange={changeSelection}
                onChangeSoftFolderDisplayIntent={softFolderDisplay.commit}
                onResetSoftFolderDisplay={softFolderDisplay.reset}
                onToggleEntity={toggleEntity}
                onTransitionAnchorApiChange={
                  changeLocalStructuredTransitionAnchorApi
                }
                onTransitionAnchorConsumed={consumeLocalTransitionAnchor}
                onViewportObservation={observeLocalStructuredViewport}
                projection={result.projection}
                projectionState={activeViewState}
                projectionWorkspace={projectionWorkspace}
                rootEntityId={localRootEntityId}
                selection={activeSelection}
                trackpadZoomMode={trackpadZoomMode}
                visualGroupStyles={visualGroupPresentation.styles}
              />
            ) : LocalStructuredGraphView !== undefined ? (
              <LocalStructuredGraphView
                {...(localStructuredCenterRequest === undefined
                  ? {}
                  : { centerRequest: localStructuredCenterRequest })}
                fitRequestKey={localFitRequestKey ?? 0}
                focusAppearance={focusAppearance}
                {...(localTransitionAnchor === undefined
                  ? {}
                  : { initialTransitionAnchor: localTransitionAnchor })}
                {...(performance === undefined
                  ? {}
                  : { instrumentation: performance })}
                layoutRequestKey={localLayoutRequestKey}
                onFailure={(message) =>
                  setLocalStructuredUnavailable(
                    `Focus Hierarchy renderer failed: ${message} Use an available Focus layout or return to All.`,
                  )
                }
                onFitRequestConsumed={consumeLocalFitRequest}
                onFocusEntity={focusLocalEntity}
                onSelectionChange={changeSelection}
                onToggleEntity={toggleEntity}
                onTransitionAnchorApiChange={
                  changeLocalStructuredTransitionAnchorApi
                }
                onTransitionAnchorConsumed={consumeLocalTransitionAnchor}
                onViewportObservation={observeLocalStructuredViewport}
                projection={result.projection}
                rootEntityId={localRootEntityId}
                selection={activeSelection}
                trackpadZoomMode={trackpadZoomMode}
                visualGroupStyles={visualGroupPresentation.styles}
                visualVariant={hierarchyVisualVariantForScope(activeScope)}
              />
            ) : null
          ) : (
            <GraphCanvas
              {...(centerRequest === undefined ? {} : { centerRequest })}
              fitRequestKey={fitRequestKey}
              focusAppearance={focusAppearance}
              layoutMode={
                activeViewState.focus === undefined ? 'structure' : 'focus'
              }
              layoutService={layoutService}
              maximized={maximized}
              onMaximizedChange={changeMaximized}
              onFocusEntity={enterFocusScope}
              onSelectionChange={changeSelection}
              onToggleEntity={toggleEntity}
              onTransitionAnchorApiChange={changeStructureTransitionAnchorApi}
              onViewportObservation={observeViewport}
              {...(performance === undefined ? {} : { performance })}
              {...(performanceUpdateKey === undefined
                ? {}
                : { performanceUpdateKey })}
              projection={result.projection}
              selection={activeSelection}
              trackpadZoomMode={trackpadZoomMode}
              visualGroupStyles={visualGroupPresentation.styles}
              visualVariant={hierarchyVisualVariantForScope(activeScope)}
            />
          )}
          {networkLayoutActive &&
          networkExplorerModel !== undefined &&
          !networkExplorerVisible ? (
            <button
              aria-label="Open Network Explorer"
              className="graph-network-explorer-handle"
              onClick={toggleNetworkExplorer}
              ref={networkExplorerHandleRef}
              title="Open Network Explorer"
              type="button"
            >
              <span aria-hidden="true">›</span>
            </button>
          ) : null}
          {networkLayoutActive &&
          networkExplorerModel !== undefined &&
          networkExplorerVisible ? (
            <NetworkExplorer
              {...(networkExplorerArrangement === undefined
                ? {}
                : { arrangement: networkExplorerArrangement })}
              fileMove={networkExplorerFileMove}
              presentationOverrides={nodePresentation.overrides}
              sizePersistenceStatus={nodePresentation.session.status}
              sizeEditingDisabled={
                nodePresentation.session.persistenceMode ===
                  'blocked-corrupt' ||
                nodePresentation.session.persistenceMode ===
                  'blocked-write-failure'
              }
              onSizeScaleChange={nodePresentation.changeSizeScale}
              queryEditor={{
                ...queryEditor,
                queryIssue:
                  queryEditor.queryIssue ??
                  (hiddenFileResult.ok && hiddenFolderResult.ok
                    ? undefined
                    : 'Hidden files or folders could not be read from the applied QUERY1 expression.'),
              }}
              hiddenPaths={hiddenFileResult.ok ? hiddenFileResult.paths : []}
              hiddenFolderKeys={
                hiddenFolderResult.ok ? hiddenFolderResult.folderKeys : []
              }
              focusedSourcePath={focusedSourcePath}
              onRestoreFile={restoreNetworkFile}
              onRestoreFolder={restoreNetworkFolder}
              onFocusNode={focusNetworkExplorerNode}
              onInspectNode={inspectNetworkExplorerNode}
              onHideFile={hideNetworkFile}
              onHideFolder={hideNetworkFolder}
              folderState={networkExplorerFolderState}
              savedQueries={savedQueries}
              model={networkExplorerModel}
              onClose={closeNetworkExplorer}
              onFolderStateChange={setNetworkExplorerFolderState}
              onSelectNode={selectNetworkExplorerNode}
              selection={networkExplorerSelection}
              deferSelectionReveal={selection === graphClickSelection}
              revealRequest={
                networkExplorerRevealRequest?.projection === networkProjection
                  ? networkExplorerRevealRequest
                  : undefined
              }
            />
          ) : null}
          {!inspectorOpen ? (
            <button
              aria-label="Open Inspector"
              className="graph-inspector-handle"
              onClick={toggleInspector}
              ref={inspectorHandleRef}
              title="Inspector"
              type="button"
            >
              <span aria-hidden="true">‹</span>
            </button>
          ) : null}
          {inspectorOpen ? (
            <ProvenanceInspector
              focusRequestKey={inspectorFocusRequestKey}
              onClear={clearSelection}
              onClose={closeInspector}
              onNavigate={navigateToEntity}
              {...(allHierarchyExposed &&
              (effectiveRendererMode === 'global' ||
                effectiveRendererMode === 'local') &&
              activeSelection?.kind === 'node'
                ? {
                    onOpenFullHierarchy: (entityId: EntityId) => {
                      changeRendererMode('structure');
                      queueMicrotask(() =>
                        navigateToEntity(entityId, 'Open full hierarchy'),
                      );
                    },
                  }
                : {})}
              {...(activeScope === 'all' && activeSelection?.kind === 'node'
                ? { onFocus: enterFocusScope }
                : {})}
              {...(localDisclosureControl === undefined
                ? {}
                : {
                    disclosureControl: localDisclosureControl,
                    onToggleDisclosure: toggleEntity,
                  })}
              {...(performance === undefined ? {} : { performance })}
              projection={result.projection}
              selection={activeSelection}
              visualGroupMatches={selectedVisualGroups.matches}
              workspace={inspectionWorkspace}
            />
          ) : null}
        </div>
      ) : (
        <p className="graph-failure" role="alert">
          {result.message}
        </p>
      )}
      {maximized ? null : <ProjectionIssues projection={projection} />}
    </section>
  );
}
