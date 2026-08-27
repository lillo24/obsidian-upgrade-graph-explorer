import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import type { EntityId, KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import type { DiagnosticIdentityStability } from '@icarus-graph-explorer/diagnostics-obsidian';
import { createInspectionWorkspace } from '@icarus-graph-explorer/explorer-inspection';
import {
  GraphCanvas,
  type GraphCenterRequest,
  type GraphSelection,
  type GraphViewportObservation,
} from '@icarus-graph-explorer/renderer-reactflow';
import {
  createPersistedWorkspaceView,
  serializePersistedWorkspaceView,
  type PersistedViewportAnchor,
} from '@icarus-graph-explorer/view-state';
import {
  createProjectionWorkspace,
  projectView,
  type ProjectedEntityNode,
  type ProjectedNode,
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
import { EntitySearch } from './EntitySearch';
import { GraphFilters } from './GraphFilters';
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

export function GraphExplorer({
  identityStability,
  snapshot,
  storage,
}: {
  readonly identityStability?: DiagnosticIdentityStability;
  readonly snapshot: KnowledgeSnapshot;
  readonly storage?: StorageLike | null;
}) {
  const projectionWorkspace = useMemo(
    () => createProjectionWorkspace(snapshot),
    [snapshot],
  );
  const [persistenceStorage] = useState(() =>
    storage === null ? undefined : (storage ?? browserStorage()),
  );
  const eligibility = persistenceEligibility(identityStability);
  const [hydration] = useState(() =>
    hydrateGraphView({
      eligibility,
      storage: persistenceStorage,
      workspace: projectionWorkspace,
    }),
  );
  const [viewState, dispatch] = useReducer(graphStateReducer, hydration.state);
  const result = useMemo<ProjectionResult>(() => {
    try {
      return {
        ok: true,
        projection: projectView(projectionWorkspace, viewState),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Graph projection failed: ${message}` };
    }
  }, [projectionWorkspace, viewState]);
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
  const [persistenceStatus, setPersistenceStatus] = useState(
    restoredViewportHidden
      ? `${hydration.status} The saved viewport anchor is hidden by the restored view, so the graph was fitted.`
      : hydration.status,
  );
  const [transientResetKey, setTransientResetKey] = useState(0);
  const [navigationStatus, setNavigationStatus] = useState(
    'Select a graph element to inspect it, or use Find to reveal a hidden entity.',
  );
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
  const inspectionWorkspace = useMemo(
    () => createInspectionWorkspace(snapshot),
    [snapshot],
  );
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
        state: viewState,
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
          setPersistenceStatus(
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
        setPersistenceStatus(
          `Could not prepare the saved graph view: ${message} The graph remains usable in memory.`,
        ),
      );
    }
  }, [
    eligibility,
    persistenceStorage,
    projectionWorkspace,
    viewState,
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
  const navigateToEntity = useCallback(
    (entityId: EntityId, origin: string) => {
      const plan = planEntityNavigation(
        projectionWorkspace,
        viewState,
        entityId,
      );
      if (!plan.ok) {
        setNavigationStatus(`${origin}: ${plan.message}`);
        return;
      }
      dispatch({ type: 'apply-navigation', state: plan.state });
      setSelection({ kind: 'node', id: plan.projectionNodeId });
      setCenterRequest((current) => ({
        key: (current?.key ?? 0) + 1,
        nodeId: plan.projectionNodeId,
        zoom: 1.1,
      }));
      setNavigationStatus(`${origin}: ${plan.announcement}`);
    },
    [projectionWorkspace, viewState],
  );

  function enterFocus(): void {
    if (focusEntity === undefined) return;
    dispatch({ type: 'enter-focus', entityId: focusEntity.entityId });
    setFitRequestKey((current) => current + 1);
    setNavigationStatus(
      `Focused ${focusEntity.entityKind} in ${focusEntity.sourcePath}.`,
    );
  }

  function exitFocus(): void {
    dispatch({ type: 'exit-focus' });
    setSelection(null);
    setFitRequestKey((current) => current + 1);
    setNavigationStatus('Exited focus and restored structural disclosure.');
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
      setPersistenceStatus(
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
      setPersistenceStatus(
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
    setPersistenceStatus('Saved graph view reset.');
    setNavigationStatus(
      'Saved view reset to documents-only; search and selection were cleared.',
    );
  }

  return (
    <section className="graph-workspace" aria-labelledby="graph-title">
      <div className="graph-heading">
        <div>
          <p className="eyebrow">KG9 · Durable Local View</p>
          <h2 id="graph-title">Knowledge Graph</h2>
        </div>
        {projection === undefined ? null : (
          <p className="graph-counts" aria-live="polite">
            <strong>{projection.nodes.length}</strong> nodes ·{' '}
            <strong>{projection.edges.length}</strong> edges
          </p>
        )}
      </div>

      <EntitySearch
        key={transientResetKey}
        onNavigate={navigateToEntity}
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
            aria-pressed={viewState.disclosure.defaultDepth === 0}
            onClick={() => dispatch({ type: 'set-depth', depth: 0 })}
            type="button"
          >
            Documents
          </button>
          <button
            aria-pressed={viewState.disclosure.defaultDepth === 1}
            onClick={() => dispatch({ type: 'set-depth', depth: 1 })}
            type="button"
          >
            Top-Level
          </button>
          <label className="graph-checkbox">
            <input
              checked={viewState.disclosure.includeBlocks}
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
        </div>
        <div
          className="control-group control-group--focus"
          aria-label="Focus controls"
          role="group"
        >
          {viewState.focus === undefined ? (
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
                    changeHops(Number(event.currentTarget.value) as 1 | 2 | 3)
                  }
                  value={viewState.focus.hops}
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
                  value={viewState.focus.direction}
                >
                  <option value="both">Both</option>
                  <option value="incoming">Incoming</option>
                  <option value="outgoing">Outgoing</option>
                </select>
              </label>
            </>
          )}
        </div>
      </div>

      <GraphFilters
        onAction={applyGraphAction}
        pathScopes={pathScopes}
        state={viewState}
      />
      <div className="persistence-status">
        <p aria-live="polite" aria-atomic="true">
          {persistenceStatus}
        </p>
        {eligibility === 'stable' ? (
          <button onClick={resetSavedView} type="button">
            Reset saved view
          </button>
        ) : null}
      </div>
      <p className="navigation-status" aria-live="polite" aria-atomic="true">
        {navigationStatus}
      </p>

      {result.ok ? (
        <div className="graph-stage">
          <GraphCanvas
            {...(centerRequest === undefined ? {} : { centerRequest })}
            expandedEntityIds={viewState.disclosure.expandedEntityIds}
            fitRequestKey={fitRequestKey}
            layoutMode={viewState.focus === undefined ? 'structure' : 'focus'}
            onSelectionChange={changeSelection}
            onToggleEntity={toggleEntity}
            onViewportObservation={observeViewport}
            projection={result.projection}
            selection={activeSelection}
          />
          <ProvenanceInspector
            key={
              activeSelection === null
                ? 'empty'
                : `${activeSelection.kind}:${activeSelection.id}`
            }
            onClear={clearSelection}
            onNavigate={navigateToEntity}
            projection={result.projection}
            selection={activeSelection}
            workspace={inspectionWorkspace}
          />
        </div>
      ) : (
        <p className="graph-failure" role="alert">
          {result.message}
        </p>
      )}
      {projection === undefined || projection.issues.length === 0 ? null : (
        <details className="projection-issues">
          <summary>{projection.issues.length} Projection Issues</summary>
          <ul>
            {projection.issues.map((issue) => (
              <li key={`${issue.code}:${issue.subject}`}>{issue.message}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
