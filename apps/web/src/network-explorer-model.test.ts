import { describe, expect, it } from 'vitest';

import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import { createInspectionWorkspace } from '@icarus-graph-explorer/explorer-inspection';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectView,
  type ProjectedEntityNode,
  type ViewProjection,
} from '@icarus-graph-explorer/view-projection';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';

import sampleReport from './sample-report.json';
import {
  createNetworkExplorerModel,
  flattenNetworkExplorerRows,
  indexNetworkExplorerRows,
  networkExplorerKeyboardAction,
  networkExplorerScrollTopForIndex,
  networkExplorerVirtualWindow,
  reconcileNetworkExplorerExpansion,
} from './network-explorer-model';

const validation = validateObsidianDiagnosticReport(sampleReport);
if (!validation.valid) throw new Error('The web sample report must be valid.');
const snapshot = validation.value.snapshot;
const inspectionWorkspace = createInspectionWorkspace(snapshot);
const projection = projectView(
  createProjectionWorkspace(snapshot),
  documentOnlyProjectionState(),
);

function entityNode(path: string): ProjectedEntityNode {
  const node = projection.nodes.find(
    (candidate) => candidate.kind === 'entity' && candidate.sourcePath === path,
  );
  if (node?.kind !== 'entity') throw new Error(`Missing ${path}.`);
  return node;
}

describe('Network Explorer projection model', () => {
  it('presents every projected node in source order, with diagnostics last and one winning Visual Group', () => {
    const source = entityNode('Source.md');
    const groups: VisualGroupPresentationMap = new Map([
      [
        source.entityId,
        { groupName: 'Sources', color: 'teal', accent: '#0f766e' },
      ],
    ]);
    const shuffled: ViewProjection = {
      ...projection,
      nodes: [...projection.nodes]
        .reverse()
        .map((node) =>
          node.id === source.id ? { ...node, focusDistance: 0 } : node,
        ),
    };
    const model = createNetworkExplorerModel(
      shuffled,
      inspectionWorkspace,
      groups,
    );

    expect(model.nodes).toHaveLength(projection.nodes.length);
    expect(model.nodes[0]).toMatchObject({
      id: source.id,
      kindLabel: 'File',
      glyph: '▰',
      focusRoot: true,
      visualGroupName: 'Sources',
    });
    const firstDiagnostic = model.nodes.findIndex(
      (node) => node.kindLabel === 'Diagnostic',
    );
    expect(firstDiagnostic).toBeGreaterThan(0);
    expect(
      model.nodes
        .slice(firstDiagnostic)
        .every((node) => node.kindLabel === 'Diagnostic'),
    ).toBe(true);
    expect(model.nodes[firstDiagnostic]).toMatchObject({ glyph: '○' });
  });

  it('indexes projected hierarchy/reference adjacency symmetrically without deaggregating occurrences', () => {
    const model = createNetworkExplorerModel(
      projection,
      inspectionWorkspace,
      new Map(),
    );
    const source = model.nodeById.get(entityNode('Source.md').id);
    const target = model.nodeById.get(entityNode('Target.md').id);
    if (source === undefined || target === undefined) {
      throw new Error('Missing source/target model rows.');
    }
    const outgoing = source.adjacency.find(
      (adjacency) =>
        adjacency.relationship === 'outgoing' &&
        adjacency.targetNodeId === target.id,
    );
    const incoming = target.adjacency.find(
      (adjacency) =>
        adjacency.relationship === 'incoming' &&
        adjacency.targetNodeId === source.id,
    );

    expect(outgoing).toBeDefined();
    expect(incoming).toBeDefined();
    expect(outgoing?.edgeId).toBe(incoming?.edgeId);
    expect(outgoing?.referenceCount).toBeGreaterThan(1);
    expect(incoming?.referenceCount).toBe(outgoing?.referenceCount);
    expect(model.nodes.some((node) => node.internalReferenceCount > 0)).toBe(
      true,
    );
  });

  it('uses distinct file, heading, block, and diagnostic presentations', () => {
    const deepProjection = projectView(createProjectionWorkspace(snapshot), {
      disclosure: {
        defaultDepth: 3,
        expandedEntityIds: snapshot.entities
          .filter((entity) => entity.kind === 'section')
          .map((entity) => entity.id),
        collapsedEntityIds: [],
        includeBlocks: true,
      },
    });
    const model = createNetworkExplorerModel(
      deepProjection,
      inspectionWorkspace,
      new Map(),
    );

    expect(
      new Set(
        model.nodes.map(({ glyph, kindLabel }) => `${glyph}:${kindLabel}`),
      ),
    ).toEqual(new Set(['▰:File', '◇:Heading', '●:Block', '○:Diagnostic']));
    expect(
      model.nodes.some((node) =>
        node.adjacency.some(
          (adjacency) =>
            adjacency.relationship === 'parent' ||
            adjacency.relationship === 'child',
        ),
      ),
    ).toBe(true);
  });

  it('retains only expanded projected nodes and flattens their adjacency directly after the parent', () => {
    const model = createNetworkExplorerModel(
      projection,
      inspectionWorkspace,
      new Map(),
    );
    const source = model.nodeById.get(entityNode('Source.md').id);
    if (source === undefined) throw new Error('Missing Source model row.');
    const expanded = new Set([source.id, 'stale-node']);
    const reconciled = reconcileNetworkExplorerExpansion(expanded, model);
    const rows = flattenNetworkExplorerRows(model, reconciled);
    const sourceIndex = rows.findIndex(
      (row) => row.kind === 'node' && row.node.id === source.id,
    );

    expect([...reconciled]).toEqual([source.id]);
    expect(rows).toHaveLength(model.nodes.length + source.adjacency.length);
    expect(rows[sourceIndex + 1]).toMatchObject({
      kind: 'adjacency',
      adjacency: { parentNodeId: source.id },
    });
  });
});

describe('Network Explorer keyboard and virtual window contracts', () => {
  const model = createNetworkExplorerModel(
    projection,
    inspectionWorkspace,
    new Map(),
  );
  const expandable = model.nodes.find((node) => node.adjacency.length > 0);
  if (expandable === undefined) throw new Error('Expected an expandable node.');

  it('plans the complete tree keyboard contract over logical, not mounted, rows', () => {
    const collapsedRows = flattenNetworkExplorerRows(model, new Set());
    const collapsedRowIndex = indexNetworkExplorerRows(collapsedRows);
    const parentIndex = collapsedRows.findIndex(
      (row) => row.kind === 'node' && row.node.id === expandable.id,
    );
    const expand = networkExplorerKeyboardAction({
      rows: collapsedRows,
      rowIndexById: collapsedRowIndex,
      activeIndex: parentIndex,
      expandedNodeIds: new Set(),
      key: 'ArrowRight',
    });
    expect(expand).toEqual({
      kind: 'expand',
      nodeId: expandable.id,
      focusRowId: expandable.adjacency[0]?.id,
    });

    const expandedIds = new Set([expandable.id]);
    const rows = flattenNetworkExplorerRows(model, expandedIds);
    const rowIndexById = indexNetworkExplorerRows(rows);
    const expandedParentIndex = rows.findIndex(
      (row) => row.kind === 'node' && row.node.id === expandable.id,
    );
    const childIndex = expandedParentIndex + 1;
    const child = rows[childIndex];
    if (child?.kind !== 'adjacency') throw new Error('Missing adjacency row.');

    expect(
      networkExplorerKeyboardAction({
        rows,
        rowIndexById,
        activeIndex: expandedParentIndex,
        expandedNodeIds: expandedIds,
        key: 'ArrowRight',
      }),
    ).toEqual({ kind: 'activate', index: childIndex });
    expect(
      networkExplorerKeyboardAction({
        rows,
        rowIndexById,
        activeIndex: childIndex,
        expandedNodeIds: expandedIds,
        key: 'ArrowLeft',
      }),
    ).toEqual({ kind: 'activate', index: expandedParentIndex });
    expect(
      networkExplorerKeyboardAction({
        rows,
        rowIndexById,
        activeIndex: expandedParentIndex,
        expandedNodeIds: expandedIds,
        key: 'ArrowLeft',
      }),
    ).toEqual({ kind: 'collapse', nodeId: expandable.id });
    expect(
      networkExplorerKeyboardAction({
        rows,
        rowIndexById,
        activeIndex: childIndex,
        expandedNodeIds: expandedIds,
        key: 'Enter',
      }),
    ).toEqual({ kind: 'select', nodeId: child.adjacency.targetNodeId });
    expect(
      networkExplorerKeyboardAction({
        rows,
        rowIndexById,
        activeIndex: expandedParentIndex,
        expandedNodeIds: expandedIds,
        key: ' ',
      }),
    ).toEqual({ kind: 'select', nodeId: expandable.id });
    expect(
      networkExplorerKeyboardAction({
        rows,
        rowIndexById,
        activeIndex: childIndex,
        expandedNodeIds: expandedIds,
        key: 'Home',
      }),
    ).toEqual({ kind: 'activate', index: 0 });
    expect(
      networkExplorerKeyboardAction({
        rows,
        rowIndexById,
        activeIndex: childIndex,
        expandedNodeIds: expandedIds,
        key: 'End',
      }),
    ).toEqual({ kind: 'activate', index: rows.length - 1 });
  });

  it('bounds mounted rows to viewport plus overscan at stress scale and scrolls logical focus into view', () => {
    const window = networkExplorerVirtualWindow({
      rowCount: 10_000,
      scrollTop: 5_600,
      viewportHeight: 560,
    });
    expect(window.endIndex - window.startIndex).toBeLessThanOrEqual(22);
    expect(window.startIndex).toBeGreaterThan(0);
    expect(window.endIndex).toBeLessThan(10_000);
    expect(window.totalHeight).toBe(560_000);
    expect(
      networkExplorerScrollTopForIndex({
        index: 999,
        scrollTop: 0,
        viewportHeight: 560,
      }),
    ).toBe(55_440);
  });
});
