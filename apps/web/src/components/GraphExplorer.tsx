import { useCallback, useMemo, useReducer, useState } from 'react';

import type { EntityId, KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import { createInspectionWorkspace } from '@icarus-graph-explorer/explorer-inspection';
import {
  GraphCanvas,
  type GraphCenterRequest,
  type GraphSelection,
} from '@icarus-graph-explorer/renderer-reactflow';
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
  snapshot,
}: {
  readonly snapshot: KnowledgeSnapshot;
}) {
  const [viewState, dispatch] = useReducer(
    graphStateReducer,
    undefined,
    initialGraphState,
  );
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [fitRequestKey, setFitRequestKey] = useState(0);
  const [centerRequest, setCenterRequest] = useState<GraphCenterRequest>();
  const [navigationStatus, setNavigationStatus] = useState(
    'Select a graph element to inspect it, or use Find to reveal a hidden entity.',
  );
  const projectionWorkspace = useMemo(
    () => createProjectionWorkspace(snapshot),
    [snapshot],
  );
  const inspectionWorkspace = useMemo(
    () => createInspectionWorkspace(snapshot),
    [snapshot],
  );
  const pathScopes = useMemo(
    () => topLevelPathScopes(projectionWorkspace),
    [projectionWorkspace],
  );
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

  return (
    <section className="graph-workspace" aria-labelledby="graph-title">
      <div className="graph-heading">
        <div>
          <p className="eyebrow">KG8 · Explainable Navigation</p>
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
