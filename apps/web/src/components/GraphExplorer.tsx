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

import type { EntityId, KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import type { DiagnosticIdentityStability } from '@icarus-graph-explorer/diagnostics-obsidian';
import { createInspectionWorkspace } from '@icarus-graph-explorer/explorer-inspection';
import type { PerformanceInstrumentation } from '@icarus-graph-explorer/performance';
import {
  GraphCanvas,
  type GraphCenterRequest,
  type FocusAppearance,
  type GraphSelection,
  type GraphViewportObservation,
  type TrackpadZoomMode,
} from '@icarus-graph-explorer/renderer-reactflow';
import {
  createPersistedWorkspaceView,
  reconcileCurrentWorkspaceView,
  serializePersistedWorkspaceView,
  type PersistedViewportAnchor,
  type PersistedGlobalViewport,
  type PersistedRendererViewports,
  type RendererEntryMode,
} from '@icarus-graph-explorer/view-state';
import {
  createProjectionWorkspace,
  projectView,
  type StructuralDepth,
  type ViewProjection,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import type {
  GlobalCenterRequest,
  GlobalLayoutSettings,
  GlobalSelection,
  SemanticGlobalViewport,
} from '@icarus-graph-explorer/renderer-sigma/types';

import { graphHistoryShortcut } from '../graph-history-shortcuts';
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
  planSemanticViewportRestore,
  recordGraphNavigation,
  sameGraphViewState,
  type GraphHistoryCheckpoint,
  type GraphNavigationHistory,
} from '../navigation-history';
import { planEntityNavigation, topLevelPathScopes } from '../navigation';
import {
  addSavedGraphFilter,
  createEmptySavedGraphFilterRegistry,
  deleteSavedGraphFilter,
  loadSavedGraphFilters,
  saveSavedGraphFilterRegistry,
  type SavedGraphFilterRegistry,
} from '../persistence/saved-filters';
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
  saveGraphPreferences,
} from '../preferences/graph-preferences';
import { createDagreLayoutWorkerService } from '../workers/dagre-layout-worker-client';
import { EntitySearch } from './EntitySearch';
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
import type { GlobalGraphViewProps } from './GlobalGraphView';
import { useWorkerServiceDisposal } from './use-worker-service-disposal';

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
  readonly rendererMode: RendererEntryMode;
  readonly viewports: PersistedRendererViewports;
}

interface SavedFilterSession {
  readonly registry: SavedGraphFilterRegistry;
  readonly writable: boolean;
  readonly status: string;
  readonly error?: string;
}

const ENTITY_NAVIGATION_ZOOM = 1.1;
const GLOBAL_NAVIGATION_RATIO = 0.32;

const STRUCTURAL_DEPTH_OPTIONS = [
  { depth: 0, label: 'Files only' },
  { depth: 1, label: '1 level' },
  { depth: 2, label: '2 levels' },
  { depth: 3, label: '3 levels' },
] as const satisfies readonly {
  readonly depth: StructuralDepth;
  readonly label: string;
}[];

const GRAPH_HISTORY_SHORTCUT_EXCLUSION_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-graph-history-shortcuts="off"]';

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

function RendererModeControl({
  mode,
  onChange,
  globalUnavailable,
}: {
  readonly mode: RendererEntryMode;
  readonly onChange: (mode: RendererEntryMode) => void;
  readonly globalUnavailable?: string;
}) {
  return (
    <div
      aria-label="Graph presentation"
      className="control-group control-group--renderer"
      role="group"
    >
      <span>View</span>
      <button
        aria-pressed={mode === 'structure'}
        onClick={() => onChange('structure')}
        type="button"
      >
        Structure
      </button>
      <button
        aria-pressed={mode === 'global'}
        disabled={globalUnavailable !== undefined}
        onClick={() => onChange('global')}
        title={globalUnavailable}
        type="button"
      >
        Global
      </button>
    </div>
  );
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
  maximized,
  onMaximizedChange,
  performance,
  performanceUpdateKey,
  settingsContent,
  snapshot,
  storage,
}: {
  readonly applicationOverlayOpen?: boolean;
  readonly identityStability?: DiagnosticIdentityStability;
  readonly maximized: boolean;
  readonly onMaximizedChange: (maximized: boolean) => void;
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
  const [trackpadZoomMode, setTrackpadZoomMode] = useState<TrackpadZoomMode>(
    preferenceLoad.preferences.trackpadZoomMode,
  );
  const [focusAppearance, setFocusAppearance] = useState<FocusAppearance>(
    preferenceLoad.preferences.focusAppearance,
  );
  const [globalLayoutSettings, setGlobalLayoutSettings] =
    useState<GlobalLayoutSettings>(
      preferenceLoad.preferences.globalLayoutSettings,
    );
  const [preferenceWarning, setPreferenceWarning] = useState<
    string | undefined
  >(preferenceLoad.warning ?? undefined);
  const [{ activeOverlay, filtersOpen }, dispatchWorkspaceOverlay] = useReducer(
    graphWorkspaceOverlayReducer,
    CLOSED_GRAPH_WORKSPACE_OVERLAYS,
  );
  const eligibility = persistenceEligibility(identityStability);
  const [savedFilterSession, setSavedFilterSession] =
    useState<SavedFilterSession>(() => {
      const workspaceId = projectionWorkspace.snapshot().workspace.id;
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
  const [rendererMode, setRendererMode] = useState<RendererEntryMode>(
    hydration.rendererMode,
  );
  const rendererModeRef = useRef(rendererMode);
  const [globalUnavailable, setGlobalUnavailable] = useState<string>();
  const [GlobalGraphView, setGlobalGraphView] =
    useState<ComponentType<GlobalGraphViewProps>>();
  const legacyBlockFilterNormalized = initialViewState !== hydration.state;
  const [viewState, dispatch] = useReducer(graphStateReducer, initialViewState);
  const currentReconciliation = useMemo(
    () => reconcileCurrentWorkspaceView(projectionWorkspace, viewState),
    [projectionWorkspace, viewState],
  );
  const activeViewState = currentReconciliation.state;
  const structureResult = useMemo<ProjectionResult>(() => {
    try {
      return {
        ok: true,
        projection:
          performance === undefined
            ? projectView(projectionWorkspace, activeViewState)
            : performance.measure('project-view', 'projections', () =>
                projectView(projectionWorkspace, activeViewState),
              ),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Graph projection failed: ${message}` };
    }
  }, [activeViewState, performance, projectionWorkspace]);
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
      return { ok: false, message: `Global projection failed: ${message}` };
    }
  }, [globalViewState, performance, projectionWorkspace, rendererMode]);
  const globalProjectionFailure =
    rendererMode === 'global' && globalResult?.ok === false
      ? `${globalResult.message} Structure remains available for this session.`
      : undefined;
  const globalFailure = globalUnavailable ?? globalProjectionFailure;
  const effectiveRendererMode: RendererEntryMode =
    rendererMode === 'global' && globalFailure === undefined
      ? 'global'
      : 'structure';
  const result =
    effectiveRendererMode === 'global' && globalResult !== undefined
      ? globalResult
      : structureResult;
  const restoredStructureViewport = hydration.viewports.structure;
  const restoredAnchor =
    structureResult.ok && restoredStructureViewport !== undefined
      ? structureResult.projection.nodes.find(
          (candidate) =>
            candidate.kind === 'entity' &&
            candidate.entityId === restoredStructureViewport.anchorEntityId,
        )
      : undefined;
  const restoredViewportHidden =
    restoredStructureViewport !== undefined && restoredAnchor === undefined;
  const restoredGlobalViewport = hydration.viewports.global;
  const restoredGlobalAnchor =
    globalResult?.ok === true && restoredGlobalViewport !== undefined
      ? globalResult.projection.nodes.find(
          (candidate) =>
            candidate.kind === 'entity' &&
            candidate.entityId === restoredGlobalViewport.anchorEntityId,
        )
      : undefined;
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [fitRequestKey, setFitRequestKey] = useState(
    restoredViewportHidden ? 1 : 0,
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
  const [globalFitRequestKey, setGlobalFitRequestKey] = useState(
    rendererMode === 'global' &&
      restoredGlobalViewport !== undefined &&
      restoredGlobalAnchor === undefined
      ? 1
      : 0,
  );
  const [globalLayoutRequestKey, setGlobalLayoutRequestKey] = useState(0);
  const [viewportBookmark, setViewportBookmark] = useState<
    PersistedViewportAnchor | undefined
  >(restoredViewportHidden ? undefined : restoredStructureViewport);
  const [globalViewportBookmark, setGlobalViewportBookmark] = useState<
    PersistedGlobalViewport | undefined
  >(restoredGlobalAnchor === undefined ? undefined : restoredGlobalViewport);
  const [navigationHistory, setNavigationHistory] =
    useState<GraphNavigationHistory>(createGraphNavigationHistory);
  const navigationHistoryRef = useRef(navigationHistory);
  const activeViewStateRef = useRef(activeViewState);
  const viewportBookmarkRef = useRef(viewportBookmark);
  const globalViewportBookmarkRef = useRef(globalViewportBookmark);
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
        : hydration.status
    }${
      legacyBlockFilterNormalized
        ? ' Legacy Blocks filtering was normalized to the current view controls.'
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
  const [transientResetKey, setTransientResetKey] = useState(0);
  const [navigationAnnouncement, setNavigationAnnouncement] = useState(
    'Select a graph element to inspect it, or use Search to reveal a hidden entity.',
  );
  const [navigationError, setNavigationError] = useState<string>();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const inspectorToolbarRef = useRef<HTMLButtonElement>(null);
  const inspectorHandleRef = useRef<HTMLButtonElement>(null);
  const inspectorRestoreTarget = useRef<HTMLButtonElement | null>(null);
  const [initialSerializedView] = useState(() =>
    hydration.writable
      ? serializePersistedWorkspaceView(
          createPersistedWorkspaceView({
            workspace: projectionWorkspace,
            state: initialViewState,
            rendererMode: hydration.rendererMode,
            viewports: hydration.viewports,
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
  const activeSelection =
    projection !== undefined && selectionExists(projection, selection)
      ? selection
      : null;
  const previousProjectionWorkspace = useRef(projectionWorkspace);
  const previousWorkspaceId = useRef(
    projectionWorkspace.snapshot().workspace.id,
  );

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
      setGlobalCenterRequest({ key, ...request });
    },
    [],
  );
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
            setGlobalFitRequestKey((current) => current + 1);
          }
        } else setCenterRequest(undefined);
      }
      return committed;
    },
    [commitGraphDestination, setGlobalSemanticViewportBookmark],
  );
  const requestHistoryViewportRestore = useCallback(
    (
      nextRendererMode: RendererEntryMode,
      viewports: PersistedRendererViewports,
    ) => {
      const request: PendingHistoryViewportRestore = {
        key: nextGraphViewportRequestKey(
          historyViewportRestoreGeneration.current,
        ),
        rendererMode: nextRendererMode,
        viewports,
      };
      historyViewportRestoreGeneration.current = request.key;
      pendingHistoryViewportRestoreRef.current = request;
      setPendingHistoryViewportRestore(request);
    },
    [],
  );
  const traverseGraphHistory = useCallback(
    (direction: 'back' | 'forward'): boolean => {
      const traversal =
        direction === 'back'
          ? goBackInGraphHistory(
              navigationHistoryRef.current,
              currentHistoryCheckpoint(),
            )
          : goForwardInGraphHistory(
              navigationHistoryRef.current,
              currentHistoryCheckpoint(),
            );
      if (traversal === null) return false;

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
      const restoredSessionMode: RendererEntryMode =
        traversal.target.rendererMode === 'global' &&
        globalFailure !== undefined
          ? 'structure'
          : traversal.target.rendererMode;
      rendererModeRef.current = restoredSessionMode;
      setRendererMode(traversal.target.rendererMode);
      setSemanticViewportBookmark(reconciled.viewports.structure);
      setGlobalSemanticViewportBookmark(reconciled.viewports.global);
      setCenterRequest(undefined);
      setGlobalCenterRequest(undefined);
      requestHistoryViewportRestore(restoredSessionMode, reconciled.viewports);
      setNavigationError(undefined);
      setNavigationAnnouncement(
        (direction === 'back'
          ? 'Went back in graph history.'
          : 'Went forward in graph history.') +
          (reconciled.issues.length === 0
            ? ''
            : ' Some graph state was adjusted because the source changed.') +
          (restoredSessionMode === traversal.target.rendererMode
            ? ''
            : ' Global is unavailable, so this checkpoint is shown in Structure for this session.'),
      );
      return true;
    },
    [
      currentHistoryCheckpoint,
      globalFailure,
      projectionWorkspace,
      replaceNavigationHistory,
      requestHistoryViewportRestore,
      setGlobalSemanticViewportBookmark,
      setSemanticViewportBookmark,
    ],
  );
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
          `Global could not be loaded: ${message} Structure remains available for this session.`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [GlobalGraphView, globalFailure, rendererMode]);

  useLayoutEffect(() => {
    if (performance === undefined) return;
    performance.markCommit('graph-explorer-commit');
  });

  useLayoutEffect(() => {
    activeViewStateRef.current = activeViewState;
    rendererModeRef.current = effectiveRendererMode;
    viewportBookmarkRef.current = viewportBookmark;
    globalViewportBookmarkRef.current = globalViewportBookmark;
  }, [
    activeViewState,
    effectiveRendererMode,
    globalViewportBookmark,
    viewportBookmark,
  ]);

  useEffect(() => {
    const request = pendingHistoryViewportRestore;
    if (
      request === undefined ||
      !result.ok ||
      request.rendererMode !== effectiveRendererMode ||
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
      if (request.rendererMode === 'global') {
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
        setGlobalFitRequestKey((current) => current + 1);
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
    requestGlobalSemanticCenter,
    requestSemanticCenter,
    result,
    setGlobalSemanticViewportBookmark,
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
      if (rendererModeRef.current === 'global') {
        if (
          globalViewportBookmark !== undefined &&
          reconciled.viewports.global === undefined
        ) {
          setNavigationAnnouncement(
            'The previous Global viewport anchor was removed by a live update; the current camera was preserved.',
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
    projectionWorkspace,
    requestSemanticCenter,
    result,
    setGlobalSemanticViewportBookmark,
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
        if (activeOverlay !== null || filtersOpen) {
          dispatchWorkspaceOverlay({ type: 'close-all' });
          return;
        }
        onMaximizedChange(false);
      },
    );
  }, [activeOverlay, filtersOpen, maximized, onMaximizedChange]);

  useEffect(() => {
    if (!applicationOverlayOpen || (activeOverlay === null && !filtersOpen)) {
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
  }, [activeOverlay, applicationOverlayOpen, filtersOpen]);

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
        rendererMode,
        viewports: {
          ...(viewportBookmark === undefined
            ? {}
            : { structure: viewportBookmark }),
          ...(globalViewportBookmark === undefined
            ? {}
            : { global: globalViewportBookmark }),
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
          `Could not prepare the saved graph view: ${message} The graph remains usable in memory.`,
        ),
      );
    }
  }, [
    eligibility,
    persistenceStorage,
    projectionWorkspace,
    activeViewState,
    globalViewportBookmark,
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
  const applySavedFilter = useCallback(
    (query: string) => {
      const committed = commitHistoryGraphAction({ type: 'set-query', query });
      setNavigationError(undefined);
      setNavigationAnnouncement(
        committed
          ? 'Applied a Saved Filter query.'
          : 'That Saved Filter query is already active.',
      );
    },
    [commitHistoryGraphAction],
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
  const clearSelection = useCallback(() => setSelection(null), []);
  const changeGlobalSelection = useCallback(
    (nextSelection: GlobalSelection | null) =>
      setSelection((current) => retainGraphSelection(current, nextSelection)),
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
  const changeMaximized = useCallback(
    (nextMaximized: boolean) => {
      dispatchWorkspaceOverlay({ type: 'close-all' });
      onMaximizedChange(nextMaximized);
    },
    [onMaximizedChange],
  );
  const changeTrackpadZoomMode = useCallback(
    (mode: TrackpadZoomMode) => {
      setTrackpadZoomMode(mode);
      const saved = saveGraphPreferences(persistenceStorage, {
        focusAppearance,
        globalLayoutSettings,
        trackpadZoomMode: mode,
      });
      setPreferenceWarning(saved.ok ? undefined : saved.message);
    },
    [focusAppearance, globalLayoutSettings, persistenceStorage],
  );
  const changeFocusAppearance = useCallback(
    (appearance: FocusAppearance) => {
      setFocusAppearance(appearance);
      const saved = saveGraphPreferences(persistenceStorage, {
        focusAppearance: appearance,
        globalLayoutSettings,
        trackpadZoomMode,
      });
      setPreferenceWarning(saved.ok ? undefined : saved.message);
    },
    [globalLayoutSettings, persistenceStorage, trackpadZoomMode],
  );
  const changeGlobalLayoutSettings = useCallback(
    (settings: GlobalLayoutSettings) => {
      setGlobalLayoutSettings(settings);
      setGlobalLayoutRequestKey((current) => current + 1);
      const saved = saveGraphPreferences(persistenceStorage, {
        focusAppearance,
        globalLayoutSettings: settings,
        trackpadZoomMode,
      });
      setPreferenceWarning(saved.ok ? undefined : saved.message);
    },
    [focusAppearance, persistenceStorage, trackpadZoomMode],
  );
  const changeSettingsOpen = useCallback((open: boolean) => {
    dispatchWorkspaceOverlay({ type: 'change-settings', open });
  }, []);
  const changeFiltersOpen = useCallback(
    (open: boolean) => {
      dispatchWorkspaceOverlay({ type: 'change-filters', maximized, open });
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
  const toggleInspector = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (inspectorOpen) {
        closeInspector();
        return;
      }
      inspectorRestoreTarget.current = event.currentTarget;
      setInspectorOpen(true);
    },
    [closeInspector, inspectorOpen],
  );
  const changeRendererMode = useCallback(
    (nextMode: RendererEntryMode) => {
      if (
        nextMode === rendererModeRef.current ||
        (nextMode === 'global' && globalFailure !== undefined)
      ) {
        return;
      }
      const current = currentHistoryCheckpoint();
      const recordModeDestination = (
        structure: PersistedViewportAnchor | undefined,
        global: PersistedGlobalViewport | undefined,
      ) => {
        const destination = createGraphHistoryCheckpoint(
          activeViewStateRef.current,
          undefined,
          nextMode,
          {
            ...(structure === undefined ? {} : { structure }),
            ...(global === undefined ? {} : { global }),
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
            effectiveGlobalProjectionState(
              projectionWorkspace,
              activeViewStateRef.current,
            ),
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
        if (candidate === undefined || candidate.kind !== 'entity') {
          recordModeDestination(viewportBookmarkRef.current, undefined);
          setSelection(null);
          setGlobalCenterRequest(undefined);
          setGlobalFitRequestKey((value) => value + 1);
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
          recordModeDestination(viewportBookmarkRef.current, viewport);
          setGlobalSemanticViewportBookmark(viewport);
          setSelection({ kind: 'node', id: node.id });
          requestGlobalSemanticCenter({
            nodeId: node.id,
            ratio: viewport.ratio,
          });
        }
        setNavigationAnnouncement(
          'Opened Global overview. Zoom changes visual detail without changing graph topology or layout.',
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
      const candidate = structureResult.ok
        ? structureResult.projection.nodes.find(
            (candidate) =>
              candidate.kind === 'entity' &&
              candidate.entityId === anchorEntityId,
          )
        : undefined;
      rendererModeRef.current = 'structure';
      setRendererMode('structure');
      if (candidate === undefined || candidate.kind !== 'entity') {
        recordModeDestination(undefined, globalViewportBookmarkRef.current);
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
        recordModeDestination(viewport, globalViewportBookmarkRef.current);
        setSemanticViewportBookmark(viewport);
        setSelection({ kind: 'node', id: node.id });
        requestSemanticCenter({ nodeId: node.id, zoom: viewport.zoom });
      }
      setNavigationAnnouncement(
        'Opened Structure at the current file context.',
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
      requestGlobalSemanticCenter,
      requestSemanticCenter,
      selection,
      setGlobalSemanticViewportBookmark,
      setSemanticViewportBookmark,
      structureResult,
    ],
  );
  const navigateToEntity = useCallback(
    (entityId: EntityId, origin: string) => {
      const target = projectionWorkspace.entity(entityId);
      if (rendererModeRef.current === 'global' && target?.kind === 'document') {
        const node = globalResult?.ok
          ? globalResult.projection.nodes.find(
              (candidate) =>
                candidate.kind === 'entity' && candidate.entityId === entityId,
            )
          : undefined;
        if (node === undefined) {
          setNavigationError(
            `${origin}: the document is hidden by the current Global filters.`,
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
        setNavigationAnnouncement(`${origin}: centered the file in Global.`);
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
      cancelPendingHistoryViewportRestore,
      changeRendererMode,
      commitGraphDestination,
      globalResult,
      projectionWorkspace,
      requestGlobalSemanticCenter,
      requestSemanticCenter,
      setGlobalSemanticViewportBookmark,
      setSemanticViewportBookmark,
    ],
  );

  const enterFocus = useCallback(
    (entityId: string): void => {
      const focusEntity = projection?.nodes.find(
        (candidate) =>
          candidate.kind === 'entity' && candidate.entityId === entityId,
      );
      if (focusEntity === undefined || focusEntity.kind !== 'entity') return;
      setSelection({ kind: 'node', id: focusEntity.id });
      const committed = commitHistoryGraphAction(
        { type: 'enter-focus', entityId: focusEntity.entityId },
        { fitDestination: true },
      );
      if (!committed) return;
      setFitRequestKey((current) => current + 1);
      setNavigationError(undefined);
      setNavigationAnnouncement(
        `Focused ${focusEntity.entityKind} in ${focusEntity.sourcePath}.`,
      );
    },
    [commitHistoryGraphAction, projection],
  );

  function exitFocus(): void {
    const committed = commitHistoryGraphAction(
      { type: 'exit-focus' },
      { fitDestination: true },
    );
    if (!committed) return;
    setSelection(null);
    setFitRequestKey((current) => current + 1);
    setNavigationError(undefined);
    setNavigationAnnouncement(
      'Exited focus and restored structural disclosure.',
    );
  }

  function changeHops(hops: 1 | 2 | 3): void {
    if (
      commitHistoryGraphAction(
        { type: 'set-focus-hops', hops },
        { fitDestination: true },
      )
    ) {
      setFitRequestKey((current) => current + 1);
    }
  }

  function changeDirection(direction: 'incoming' | 'outgoing' | 'both'): void {
    if (
      commitHistoryGraphAction(
        { type: 'set-focus-direction', direction },
        { fitDestination: true },
      )
    ) {
      setFitRequestKey((current) => current + 1);
    }
  }

  function resetSavedView(): void {
    if (persistenceStorage === undefined) {
      setPersistenceError(
        'Could not reset the saved view because browser storage is unavailable.',
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
    lastSerializedView.current = serializePersistedWorkspaceView(
      createPersistedWorkspaceView({
        workspace: projectionWorkspace,
        state: defaults,
        rendererMode: 'structure',
        viewports: {},
      }),
    );
    clearNavigationHistory();
    dispatch({ type: 'reset-view' });
    activeViewStateRef.current = defaults;
    setSelection(null);
    rendererModeRef.current = 'structure';
    setRendererMode('structure');
    setCenterRequest(undefined);
    setGlobalCenterRequest(undefined);
    setSemanticViewportBookmark(undefined);
    setGlobalSemanticViewportBookmark(undefined);
    setTransientResetKey((current) => current + 1);
    setFitRequestKey((current) => current + 1);
    setGlobalFitRequestKey((current) => current + 1);
    persistenceWritable.current = true;
    setPersistenceError(undefined);
    setPersistenceAnnouncement('Saved graph view reset.');
    setNavigationError(undefined);
    setNavigationAnnouncement(
      'Saved view reset to Files only; search and selection were cleared.',
    );
  }

  const canGoBack = navigationHistory.past.length > 0;
  const canGoForward = navigationHistory.future.length > 0;

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
            focusAppearance={focusAppearance}
            globalLayoutSettings={globalLayoutSettings}
            onFocusAppearanceChange={changeFocusAppearance}
            onGlobalLayoutSettingsChange={changeGlobalLayoutSettings}
            onOpenChange={changeSettingsOpen}
            onTrackpadZoomModeChange={changeTrackpadZoomMode}
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
            <RendererModeControl
              {...(globalFailure === undefined
                ? {}
                : { globalUnavailable: globalFailure })}
              mode={effectiveRendererMode}
              onChange={changeRendererMode}
            />
            {effectiveRendererMode === 'structure' ? (
              <div
                className="control-group"
                aria-label="Structural depth"
                role="group"
              >
                <span>Structure</span>
                {STRUCTURAL_DEPTH_OPTIONS.map(({ depth, label }) => (
                  <button
                    aria-pressed={
                      activeViewState.disclosure.defaultDepth === depth
                    }
                    key={depth}
                    onClick={() =>
                      commitHistoryGraphAction({ type: 'set-depth', depth })
                    }
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div
                aria-label="Global layout controls"
                className="control-group"
                role="group"
              >
                <button
                  onClick={() =>
                    setGlobalLayoutRequestKey((current) => current + 1)
                  }
                  type="button"
                >
                  Re-layout
                </button>
              </div>
            )}
            <GraphFilters
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
            {activeViewState.focus === undefined ? null : (
              <div
                className="control-group control-group--focus"
                aria-label="Focus controls"
                role="group"
              >
                <button onClick={exitFocus} type="button">
                  Exit Focus
                </button>
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
                  Reset saved view
                </button>
              ) : null}
              {maximized ? null : (
                <GraphSettings
                  focusAppearance={focusAppearance}
                  globalLayoutSettings={globalLayoutSettings}
                  onFocusAppearanceChange={changeFocusAppearance}
                  onGlobalLayoutSettingsChange={changeGlobalLayoutSettings}
                  onOpenChange={changeSettingsOpen}
                  onTrackpadZoomModeChange={changeTrackpadZoomMode}
                  open={activeOverlay === 'settings'}
                  trackpadZoomMode={trackpadZoomMode}
                  {...(preferenceWarning === undefined
                    ? {}
                    : { warning: preferenceWarning })}
                >
                  {settingsContent}
                </GraphSettings>
              )}
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
        {globalFailure === undefined ? null : (
          <p className="graph-alert" role="alert">
            {globalFailure}
          </p>
        )}
      </div>

      {result.ok ? (
        <div
          className={`graph-stage${
            inspectorOpen ? ' graph-stage--inspector-drawer-open' : ''
          }`}
        >
          {effectiveRendererMode === 'global' ? (
            GlobalGraphView === undefined ? (
              <p className="graph-loading" role="status">
                Loading Global overview…
              </p>
            ) : (
              <GlobalGraphView
                {...(globalCenterRequest === undefined
                  ? {}
                  : { centerRequest: globalCenterRequest })}
                fitRequestKey={globalFitRequestKey}
                {...(performance === undefined
                  ? {}
                  : { instrumentation: performance })}
                layoutRequestKey={globalLayoutRequestKey}
                onFailure={(message) =>
                  setGlobalUnavailable(
                    `Global renderer failed: ${message} Structure remains available for this session.`,
                  )
                }
                onSelectionChange={changeGlobalSelection}
                onViewportObservation={observeGlobalViewport}
                projection={result.projection}
                selection={activeSelection}
                settings={globalLayoutSettings}
                trackpadZoomMode={trackpadZoomMode}
              />
            )
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
              onFocusEntity={enterFocus}
              onSelectionChange={changeSelection}
              onToggleEntity={toggleEntity}
              onViewportObservation={observeViewport}
              {...(performance === undefined ? {} : { performance })}
              {...(performanceUpdateKey === undefined
                ? {}
                : { performanceUpdateKey })}
              projection={result.projection}
              selection={activeSelection}
              trackpadZoomMode={trackpadZoomMode}
            />
          )}
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
              onClear={clearSelection}
              onClose={closeInspector}
              onNavigate={navigateToEntity}
              {...(effectiveRendererMode === 'global' &&
              activeSelection?.kind === 'node'
                ? {
                    onOpenInStructure: (entityId: EntityId) => {
                      changeRendererMode('structure');
                      queueMicrotask(() =>
                        navigateToEntity(entityId, 'Open in Structure'),
                      );
                    },
                  }
                : {})}
              {...(performance === undefined ? {} : { performance })}
              projection={result.projection}
              selection={activeSelection}
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
