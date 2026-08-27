import { useCallback, useMemo, useReducer, useState } from 'react';

import {
  GraphCanvas,
  type GraphSelection,
} from '@icarus-graph-explorer/renderer-reactflow';
import {
  createProjectionWorkspace,
  projectView,
  type ProjectedEdge,
  type ProjectedNode,
  type ViewProjection,
} from '@icarus-graph-explorer/view-projection';
import type { ObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';

import { graphStateReducer, initialGraphState } from '../graph-state';

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

function selectedEdge(
  projection: ViewProjection,
  selection: GraphSelection | null,
): ProjectedEdge | undefined {
  return selection?.kind === 'edge'
    ? projection.edges.find((edge) => edge.id === selection.id)
    : undefined;
}

function SelectionPanel({
  edge,
  node,
}: {
  readonly edge: ProjectedEdge | undefined;
  readonly node: ProjectedNode | undefined;
}) {
  if (node === undefined && edge === undefined) {
    return (
      <div className="selection-empty">
        <strong>Nothing selected</strong>
        <span>Select a node or edge for a compact structural summary.</span>
      </div>
    );
  }
  if (node?.kind === 'entity') {
    return (
      <dl className="selection-facts">
        <div>
          <dt>Entity</dt>
          <dd>{node.entityKind}</dd>
        </div>
        <div>
          <dt>Path</dt>
          <dd title={node.sourcePath} translate="no">
            {node.sourcePath}
          </dd>
        </div>
        <div>
          <dt>Line</dt>
          <dd>{node.sourceStartLine}</dd>
        </div>
        <div>
          <dt>Hidden</dt>
          <dd>{node.hiddenDescendantCount}</dd>
        </div>
        <div>
          <dt>Internal links</dt>
          <dd>{node.internalReferenceIds.length}</dd>
        </div>
      </dl>
    );
  }
  if (node?.kind === 'reference-target') {
    return (
      <dl className="selection-facts">
        <div>
          <dt>Status</dt>
          <dd>{node.status}</dd>
        </div>
        <div>
          <dt>Raw target</dt>
          <dd title={node.rawTarget} translate="no">
            {node.rawTarget}
          </dd>
        </div>
        <div>
          <dt>References</dt>
          <dd>{node.referenceIds.length}</dd>
        </div>
        <div>
          <dt>Candidates</dt>
          <dd>{node.candidateEntityIds.length}</dd>
        </div>
      </dl>
    );
  }
  if (edge !== undefined) {
    return (
      <dl className="selection-facts">
        <div>
          <dt>Relationship</dt>
          <dd>{edge.kind}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{edge.kind === 'reference' ? edge.status : 'structural'}</dd>
        </div>
        <div>
          <dt>Occurrences</dt>
          <dd>{edge.kind === 'reference' ? edge.referenceIds.length : 1}</dd>
        </div>
      </dl>
    );
  }
  return null;
}

export function GraphExplorer({
  report,
}: {
  readonly report: ObsidianDiagnosticReport;
}) {
  const [viewState, dispatch] = useReducer(
    graphStateReducer,
    undefined,
    initialGraphState,
  );
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [fitRequestKey, setFitRequestKey] = useState(0);
  const workspace = useMemo(
    () => createProjectionWorkspace(report.snapshot),
    [report.snapshot],
  );
  const result = useMemo<ProjectionResult>(() => {
    try {
      return { ok: true, projection: projectView(workspace, viewState) };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Graph projection failed: ${message}` };
    }
  }, [viewState, workspace]);

  const projection = result.ok ? result.projection : undefined;
  const node =
    projection === undefined ? undefined : selectedNode(projection, selection);
  const edge =
    projection === undefined ? undefined : selectedEdge(projection, selection);
  const focusEntity = node?.kind === 'entity' ? node : undefined;

  const toggleEntity = useCallback(
    (entityId: string, currentlyOpen: boolean) =>
      dispatch({ type: 'toggle-entity', entityId, currentlyOpen }),
    [],
  );
  const changeSelection = useCallback(
    (nextSelection: GraphSelection | null) => setSelection(nextSelection),
    [],
  );

  function enterFocus(): void {
    if (focusEntity === undefined) return;
    dispatch({ type: 'enter-focus', entityId: focusEntity.entityId });
    setFitRequestKey((current) => current + 1);
  }

  function exitFocus(): void {
    dispatch({ type: 'exit-focus' });
    setSelection(null);
    setFitRequestKey((current) => current + 1);
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
          <p className="eyebrow">KG7 · Projection-driven</p>
          <h2 id="graph-title">Structural Graph</h2>
        </div>
        {projection === undefined ? null : (
          <p className="graph-counts" aria-live="polite">
            <strong>{projection.nodes.length}</strong> nodes ·{' '}
            <strong>{projection.edges.length}</strong> edges
          </p>
        )}
      </div>

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

      {result.ok ? (
        <div className="graph-stage">
          <GraphCanvas
            expandedEntityIds={viewState.disclosure.expandedEntityIds}
            fitRequestKey={fitRequestKey}
            layoutMode={viewState.focus === undefined ? 'structure' : 'focus'}
            onSelectionChange={changeSelection}
            onToggleEntity={toggleEntity}
            projection={result.projection}
            selection={selection}
          />
          <aside
            className="selection-panel"
            aria-label="Graph selection summary"
          >
            <div className="selection-panel__heading">
              <span>Selection</span>
              {selection === null ? null : (
                <button onClick={() => setSelection(null)} type="button">
                  Clear
                </button>
              )}
            </div>
            <SelectionPanel edge={edge} node={node} />
          </aside>
        </div>
      ) : (
        <p className="graph-failure" role="alert">
          {result.message}
        </p>
      )}
      {projection === undefined || projection.issues.length === 0 ? null : (
        <details className="projection-issues">
          <summary>{projection.issues.length} projection issues</summary>
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
