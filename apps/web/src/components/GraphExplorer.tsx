import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import type { EntityId, KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import type { DiagnosticIdentityStability } from '@icarus-graph-explorer/diagnostics-obsidian';
import { createInspectionWorkspace } from '@icarus-graph-explorer/explorer-inspection';
import type { PerformanceInstrumentation } from '@icarus-graph-explorer/performance';
import {
  GraphCanvas,
  type GraphCenterRequest,
  type GraphSelection,
  type GraphViewportObservation,
  type TrackpadZoomMode,
} from '@icarus-graph-explorer/renderer-reactflow';
import {
  createPersistedWorkspaceView,
  reconcileCurrentWorkspaceView,
  serializePersistedWorkspaceView,
  type PersistedViewportAnchor,
} from '@icarus-graph-explorer/view-state';
import {
  createProjectionWorkspace,
  projectView,
  type ProjectedEntityNode,
  type ProjectedNode,
  type SectionHeadingLevel,
  type ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import {
  graphStateReducer,
  initialGraphState,
  type GraphStateAction,
} from '../graph-state';
import { planEntityNavigation, topLevelPathScopes } from '../navigation';
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
import { EntitySearch } from './EntitySearch';
import { GraphFilters } from './GraphFilters';
import { GraphSettings } from './GraphSettings';
import { activateMaximizedGraphMode } from './maximized-graph-mode';
import { ProvenanceInspector } from './ProvenanceInspector';

interface ProjectionSuccess {
  readonly ok: true;
  readonly projection: ViewProjection;
}

interface ProjectionFailure {
  readonly ok: false;
  readonly message: string;
}

type ProjectionResult = ProjectionSuccess | ProjectionFailure;
type WorkspaceOverlay = 'settings' | 'tools' | null;

const HEADING_LIMIT_OPTIONS = [
  1, 2, 3, 4, 5, 6,
] as const satisfies readonly SectionHeadingLevel[];

function selectedNode(
  projection: ViewProjection,
  selection: GraphSelection | null,
): ProjectedNode | undefined {
  return selection?.kind === 'node'
    ? projection.nodes.find((node) => node.id === selection.id)
    : undefined;
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
  identityStability,
  maximized,
  onMaximizedChange,
  performance,
  performanceUpdateKey,
  snapshot,
  storage,
}: {
  readonly identityStability?: DiagnosticIdentityStability;
  readonly maximized: boolean;
  readonly onMaximizedChange: (maximized: boolean) => void;
  /** Optional memory-only KG12 instrumentation, enabled by the app boundary. */
  readonly performance?: PerformanceInstrumentation;
  /** Runtime-only live-update correlation token; never persisted. */
  readonly performanceUpdateKey?: string;
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
  const [persistenceStorage] = useState(() =>
    storage === null ? undefined : (storage ?? browserStorage()),
  );
  const [preferenceLoad] = useState(() =>
    loadGraphPreferences(persistenceStorage),
  );
  const [trackpadZoomMode, setTrackpadZoomMode] = useState<TrackpadZoomMode>(
    preferenceLoad.preferences.trackpadZoomMode,
  );
  const [preferenceWarning, setPreferenceWarning] = useState<
    string | undefined
  >(preferenceLoad.warning ?? undefined);
  const [activeOverlay, setActiveOverlay] = useState<WorkspaceOverlay>(null);
  const eligibility = persistenceEligibility(identityStability);
  const [hydration] = useState(() =>
    hydrateGraphView({
      eligibility,
      storage: persistenceStorage,
      workspace: projectionWorkspace,
    }),
  );
  const [viewState, dispatch] = useReducer(graphStateReducer, hydration.state);
  const currentReconciliation = useMemo(
    () => reconcileCurrentWorkspaceView(projectionWorkspace, viewState),
    [projectionWorkspace, viewState],
  );
  const activeViewState = currentReconciliation.state;
  const result = useMemo<ProjectionResult>(() => {
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
  const restoredAnchor =
    result.ok && hydration.viewport !== undefined
      ? result.projection.nodes.find(
          (candidate) =>
            candidate.kind === 'entity' &&
            candidate.entityId === hydration.viewport?.anchorEntityId,
        )
      : undefined;
  const restoredViewportHidden =
    hydration.viewport !== undefined && restoredAnchor === undefined;
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [fitRequestKey, setFitRequestKey] = useState(
    restoredViewportHidden ? 1 : 0,
  );
  const [centerRequest, setCenterRequest] = useState<
    GraphCenterRequest | undefined
  >(() =>
    restoredAnchor === undefined || hydration.viewport === undefined
      ? undefined
      : {
          key: 1,
          nodeId: restoredAnchor.id,
          zoom: hydration.viewport.zoom,
        },
  );
  const [viewportBookmark, setViewportBookmark] = useState<
    PersistedViewportAnchor | undefined
  >(restoredViewportHidden ? undefined : hydration.viewport);
  const persistenceWritable = useRef(hydration.writable);
  const [persistenceAnnouncement, setPersistenceAnnouncement] = useState(
    restoredViewportHidden
      ? `${hydration.status} The saved viewport anchor is hidden by the restored view, so the graph was fitted.`
      : hydration.status,
  );
  const [persistenceError, setPersistenceError] = useState<string | undefined>(
    eligibility === 'stable' && !hydration.writable
      ? hydration.status
      : undefined,
  );
  const [transientResetKey, setTransientResetKey] = useState(0);
  const [navigationAnnouncement, setNavigationAnnouncement] = useState(
    'Select a graph element to inspect it, or use Search to reveal a hidden entity.',
  );
  const [navigationError, setNavigationError] = useState<string>();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [initialSerializedView] = useState(() =>
    hydration.writable
      ? serializePersistedWorkspaceView(
          createPersistedWorkspaceView({
            workspace: projectionWorkspace,
            state: hydration.state,
            ...(hydration.viewport === undefined
              ? {}
              : { viewport: hydration.viewport }),
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
  const node =
    projection === undefined
      ? undefined
      : selectedNode(projection, activeSelection);
  const focusEntity: ProjectedEntityNode | undefined =
    node?.kind === 'entity' ? node : undefined;
  const previousProjectionWorkspace = useRef(projectionWorkspace);

  useLayoutEffect(() => {
    if (performance === undefined) return;
    performance.markCommit('graph-explorer-commit');
  });

  useEffect(() => {
    if (previousProjectionWorkspace.current === projectionWorkspace) return;
    const reconciled = reconcileCurrentWorkspaceView(
      projectionWorkspace,
      viewState,
      viewportBookmark,
    );
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      previousProjectionWorkspace.current = projectionWorkspace;
      if (reconciled.state !== viewState) {
        dispatch({ type: 'replace-state', state: reconciled.state });
      }
      if (viewportBookmark === undefined) return;
      if (reconciled.viewport === undefined) {
        setViewportBookmark(undefined);
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
          candidate.entityId === reconciled.viewport?.anchorEntityId,
      );
      if (anchor === undefined) {
        setCenterRequest(undefined);
        setFitRequestKey((current) => current + 1);
        setNavigationAnnouncement(
          'The previous viewport anchor is hidden by the current live view, so the graph was fitted.',
        );
        return;
      }
      setCenterRequest((current) => ({
        key: (current?.key ?? 0) + 1,
        nodeId: anchor.id,
        zoom: reconciled.viewport!.zoom,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [projectionWorkspace, result, viewState, viewportBookmark]);

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
        setActiveOverlay(null);
        onMaximizedChange(false);
      },
    );
  }, [maximized, onMaximizedChange]);

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
        ...(viewportBookmark === undefined
          ? {}
          : { viewport: viewportBookmark }),
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
    viewportBookmark,
  ]);

  const toggleEntity = useCallback(
    (entityId: string, currentlyOpen: boolean) =>
      dispatch({ type: 'toggle-entity', entityId, currentlyOpen }),
    [],
  );
  const changeSelection = useCallback(
    (nextSelection: GraphSelection | null) => setSelection(nextSelection),
    [],
  );
  const applyGraphAction = useCallback(
    (action: GraphStateAction) => dispatch(action),
    [],
  );
  const clearSelection = useCallback(() => setSelection(null), []);
  const observeViewport = useCallback(
    (observation: GraphViewportObservation) =>
      setViewportBookmark(
        observation.anchorEntityId === null
          ? undefined
          : {
              anchorEntityId: observation.anchorEntityId,
              zoom: observation.zoom,
            },
      ),
    [],
  );
  const changeMaximized = useCallback(
    (nextMaximized: boolean) => {
      setActiveOverlay(null);
      onMaximizedChange(nextMaximized);
    },
    [onMaximizedChange],
  );
  const changeTrackpadZoomMode = useCallback(
    (mode: TrackpadZoomMode) => {
      setTrackpadZoomMode(mode);
      const saved = saveGraphPreferences(persistenceStorage, {
        trackpadZoomMode: mode,
      });
      setPreferenceWarning(saved.ok ? undefined : saved.message);
    },
    [persistenceStorage],
  );
  const changeSettingsOpen = useCallback(
    (open: boolean) => setActiveOverlay(open ? 'settings' : null),
    [],
  );
  const toggleTools = useCallback(
    () => setActiveOverlay((current) => (current === 'tools' ? null : 'tools')),
    [],
  );
  const closeTools = useCallback(() => setActiveOverlay(null), []);
  const toggleInspector = useCallback(
    () => setInspectorOpen((current) => !current),
    [],
  );
  const closeInspector = useCallback(() => setInspectorOpen(false), []);
  const navigateToEntity = useCallback(
    (entityId: EntityId, origin: string) => {
      const plan = planEntityNavigation(
        projectionWorkspace,
        activeViewState,
        entityId,
      );
      if (!plan.ok) {
        setNavigationError(`${origin}: ${plan.message}`);
        return;
      }
      dispatch({ type: 'apply-navigation', state: plan.state });
      setSelection({ kind: 'node', id: plan.projectionNodeId });
      setCenterRequest((current) => ({
        key: (current?.key ?? 0) + 1,
        nodeId: plan.projectionNodeId,
        zoom: 1.1,
      }));
      setNavigationError(undefined);
      setNavigationAnnouncement(`${origin}: ${plan.announcement}`);
    },
    [activeViewState, projectionWorkspace],
  );

  function enterFocus(): void {
    if (focusEntity === undefined) return;
    dispatch({ type: 'enter-focus', entityId: focusEntity.entityId });
    setFitRequestKey((current) => current + 1);
    setNavigationError(undefined);
    setNavigationAnnouncement(
      `Focused ${focusEntity.entityKind} in ${focusEntity.sourcePath}.`,
    );
  }

  function exitFocus(): void {
    dispatch({ type: 'exit-focus' });
    setSelection(null);
    setFitRequestKey((current) => current + 1);
    setNavigationError(undefined);
    setNavigationAnnouncement(
      'Exited focus and restored structural disclosure.',
    );
  }

  function changeHops(hops: 1 | 2 | 3): void {
    dispatch({ type: 'set-focus-hops', hops });
    setFitRequestKey((current) => current + 1);
  }

  function changeDirection(direction: 'incoming' | 'outgoing' | 'both'): void {
    dispatch({ type: 'set-focus-direction', direction });
    setFitRequestKey((current) => current + 1);
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
      }),
    );
    dispatch({ type: 'reset-view' });
    setSelection(null);
    setCenterRequest(undefined);
    setViewportBookmark(undefined);
    setTransientResetKey((current) => current + 1);
    setFitRequestKey((current) => current + 1);
    persistenceWritable.current = true;
    setPersistenceError(undefined);
    setPersistenceAnnouncement('Saved graph view reset.');
    setNavigationError(undefined);
    setNavigationAnnouncement(
      'Saved view reset to documents-only; search and selection were cleared.',
    );
  }

  return (
    <section
      className={`graph-workspace${maximized ? ' graph-workspace--maximized' : ''}`}
      aria-label="Knowledge graph workspace"
    >
      {maximized ? (
        <div
          aria-label="Canvas tools"
          className="graph-floating-controls"
          role="group"
        >
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
            onOpenChange={changeSettingsOpen}
            onTrackpadZoomModeChange={changeTrackpadZoomMode}
            open={activeOverlay === 'settings'}
            trackpadZoomMode={trackpadZoomMode}
            {...(preferenceWarning === undefined
              ? {}
              : { warning: preferenceWarning })}
          />
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
            <div
              className="control-group"
              aria-label="Structural depth"
              role="group"
            >
              <span>Structure</span>
              <button
                aria-pressed={activeViewState.disclosure.defaultDepth === 0}
                onClick={() => dispatch({ type: 'set-depth', depth: 0 })}
                type="button"
              >
                Documents
              </button>
              <button
                aria-pressed={activeViewState.disclosure.defaultDepth === 1}
                onClick={() => dispatch({ type: 'set-depth', depth: 1 })}
                type="button"
              >
                Top-Level
              </button>
              <label className="graph-checkbox">
                <input
                  checked={activeViewState.disclosure.includeBlocks}
                  name="include-blocks"
                  onChange={(event) =>
                    dispatch({
                      type: 'set-include-blocks',
                      includeBlocks: event.currentTarget.checked,
                    })
                  }
                  type="checkbox"
                />
                Blocks
              </label>
              <label
                className="heading-limit-control"
                title="Limits sections by their Markdown heading level. This is different from Top-Level, which means direct structural sections."
              >
                Headings
                <select
                  aria-label="Heading limit"
                  autoComplete="off"
                  name="heading-limit"
                  onChange={(event) =>
                    dispatch({
                      type: 'set-heading-limit',
                      maxSectionLevel:
                        event.currentTarget.value === ''
                          ? null
                          : (Number(
                              event.currentTarget.value,
                            ) as SectionHeadingLevel),
                    })
                  }
                  value={activeViewState.disclosure.maxSectionLevel ?? ''}
                >
                  <option value="">No limit</option>
                  {HEADING_LIMIT_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {'#'.repeat(level)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div
              className="control-group control-group--focus"
              aria-label="Focus controls"
              role="group"
            >
              {activeViewState.focus === undefined ? (
                <button
                  disabled={focusEntity === undefined}
                  onClick={enterFocus}
                  title={
                    focusEntity === undefined
                      ? 'Select an entity node to focus it.'
                      : 'Show its local reference neighborhood.'
                  }
                  type="button"
                >
                  Focus Selected
                </button>
              ) : (
                <>
                  <button onClick={exitFocus} type="button">
                    Exit Focus
                  </button>
                  <label>
                    Hops
                    <select
                      onChange={(event) =>
                        changeHops(
                          Number(event.currentTarget.value) as 1 | 2 | 3,
                        )
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
                </>
              )}
            </div>
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
                  onOpenChange={changeSettingsOpen}
                  onTrackpadZoomModeChange={changeTrackpadZoomMode}
                  open={activeOverlay === 'settings'}
                  trackpadZoomMode={trackpadZoomMode}
                  {...(preferenceWarning === undefined
                    ? {}
                    : { warning: preferenceWarning })}
                />
              )}
              <button
                aria-pressed={inspectorOpen}
                onClick={toggleInspector}
                type="button"
              >
                Inspector
              </button>
            </div>
          </div>

          <GraphFilters
            onAction={applyGraphAction}
            pathScopes={pathScopes}
            state={activeViewState}
          />
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
      </div>

      {result.ok ? (
        <div
          className={`graph-stage${
            inspectorOpen
              ? maximized
                ? ' graph-stage--inspector-drawer-open'
                : ' graph-stage--inspector-open'
              : ''
          }`}
        >
          <GraphCanvas
            {...(centerRequest === undefined ? {} : { centerRequest })}
            expandedEntityIds={activeViewState.disclosure.expandedEntityIds}
            fitRequestKey={fitRequestKey}
            layoutMode={
              activeViewState.focus === undefined ? 'structure' : 'focus'
            }
            maximized={maximized}
            onMaximizedChange={changeMaximized}
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
          {maximized && !inspectorOpen ? (
            <button
              aria-label="Open Inspector"
              className="graph-inspector-handle"
              onClick={toggleInspector}
              type="button"
            >
              <span aria-hidden="true">‹</span>
              <span>Open Inspector</span>
            </button>
          ) : null}
          {inspectorOpen ? (
            <ProvenanceInspector
              key={
                activeSelection === null
                  ? 'empty'
                  : `${activeSelection.kind}:${activeSelection.id}`
              }
              onClear={clearSelection}
              {...(maximized ? { onClose: closeInspector } : {})}
              onNavigate={navigateToEntity}
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
