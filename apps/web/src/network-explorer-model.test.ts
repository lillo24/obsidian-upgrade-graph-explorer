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
  shouldRevealNetworkExplorerSelection,
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
  it('presents source-ordered nodes with focus/group context and trailing diagnostics', () => {
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
    expect(model.nodeById.get(source.id)).toMatchObject({
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
    expect(model.roots.at(-1)).toMatchObject({
      kind: 'node',
      node: { kindLabel: 'Diagnostic' },
    });
    expect(model.folderByPath.has('folder-a')).toBe(true);
    expect(model.folderByPath.has('folder-b')).toBe(true);
  });

  it('does not read or change projected edges and adds no relationship index', () => {
    const input = {
      nodes: projection.nodes,
      get edges(): never {
        throw new Error('Sidebar must not index graph relationships.');
      },
    };
    const model = createNetworkExplorerModel(
      input,
      inspectionWorkspace,
      new Map(),
    );
    expect(
      model.nodes.every(
        (node) => !('adjacency' in node) && !('internalReferenceCount' in node),
      ),
    ).toBe(true);
    expect(
      flattenNetworkExplorerRows(model, new Map()).filter(
        (row) => row.kind === 'node',
      ),
    ).toHaveLength(projection.nodes.length);
  });

  it('keeps every projected File, Heading, Block and Diagnostic reachable, even without its File row', () => {
    const deep = projectView(createProjectionWorkspace(snapshot), {
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
      deep,
      inspectionWorkspace,
      new Map(),
    );
    expect(
      new Set(
        model.nodes.map(({ glyph, kindLabel }) => `${glyph}:${kindLabel}`),
      ),
    ).toEqual(new Set(['▰:File', '◇:Heading', '●:Block', '○:Diagnostic']));
    const rows = flattenNetworkExplorerRows(model, new Map());
    expect(rows.filter((row) => row.kind === 'node')).toHaveLength(
      deep.nodes.length,
    );
    expect(
      rows.some(
        (row) =>
          row.kind === 'node' &&
          row.node.kindLabel === 'Heading' &&
          row.nestedInFile,
      ),
    ).toBe(true);
    const withoutFiles = createNetworkExplorerModel(
      {
        nodes: deep.nodes.filter(
          (node) => node.kind !== 'entity' || node.entityKind !== 'document',
        ),
      },
      inspectionWorkspace,
      new Map(),
    );
    const remaining = flattenNetworkExplorerRows(
      withoutFiles,
      new Map(),
    ).filter((row) => row.kind === 'node');
    expect(remaining).toHaveLength(withoutFiles.nodes.length);
    expect(
      remaining.every(
        (row) =>
          row.kind === 'node' &&
          !row.nestedInFile &&
          row.node.kindLabel !== 'File',
      ),
    ).toBe(true);
  });

  it('uses only current projection membership for source folders', () => {
    const node = entityNode('folder-a/Note.md');
    const filtered = createNetworkExplorerModel(
      { nodes: [node] },
      inspectionWorkspace,
      new Map(),
    );
    expect([...filtered.folderByPath.keys()]).toEqual(['folder-a']);
    expect(filtered.nodes).toHaveLength(1);
    const empty = createNetworkExplorerModel(
      { nodes: [] },
      inspectionWorkspace,
      new Map(),
    );
    expect(empty.roots).toEqual([]);
    expect(empty.folderByPath.size).toBe(0);
  });
});

describe('Network Explorer keyboard and virtual window contracts', () => {
  const model = createNetworkExplorerModel(
    projection,
    inspectionWorkspace,
    new Map(),
  );

  it('reveals external selection once without reasserting it during scrolling', () => {
    const selectedNodeId = entityNode('Source.md').id;
    expect(
      shouldRevealNetworkExplorerSelection(undefined, selectedNodeId),
    ).toBe(true);
    expect(
      shouldRevealNetworkExplorerSelection(selectedNodeId, selectedNodeId),
    ).toBe(false);
    expect(
      shouldRevealNetworkExplorerSelection(
        selectedNodeId,
        entityNode('Target.md').id,
      ),
    ).toBe(true);
    expect(
      shouldRevealNetworkExplorerSelection(selectedNodeId, undefined),
    ).toBe(false);
  });

  it('gives disclosure keys to folders only and navigates logical rows', () => {
    const rows = flattenNetworkExplorerRows(model, new Map());
    const folderIndex = rows.findIndex(
      (row) => row.kind === 'folder' && row.folder.path === 'folder-a',
    );
    const childIndex = folderIndex + 1;
    const child = rows[childIndex];
    if (child?.kind !== 'node') throw new Error('Expected folder child.');
    const action = (index: number, key: string) =>
      networkExplorerKeyboardAction({
        rows,
        rowIndexById: indexNetworkExplorerRows(rows),
        activeIndex: index,
        key,
      });
    expect(action(folderIndex, 'ArrowRight')).toEqual({
      kind: 'activate',
      index: childIndex,
    });
    expect(action(childIndex, 'ArrowLeft')).toEqual({
      kind: 'activate',
      index: folderIndex,
    });
    expect(action(folderIndex, 'ArrowLeft')).toEqual({
      kind: 'toggle-folder',
      path: 'folder-a',
      expanded: false,
    });
    expect(action(folderIndex, 'Enter')).toEqual({
      kind: 'toggle-folder',
      path: 'folder-a',
      expanded: false,
    });
    expect(action(childIndex, 'ArrowRight')).toEqual({ kind: 'none' });
    expect(action(childIndex, 'Enter')).toEqual({
      kind: 'select',
      nodeId: child.node.id,
    });
    expect(action(childIndex, ' ')).toEqual({
      kind: 'select',
      nodeId: child.node.id,
    });
    expect(action(childIndex, 'Home')).toEqual({ kind: 'activate', index: 0 });
    expect(action(childIndex, 'End')).toEqual({
      kind: 'activate',
      index: rows.length - 1,
    });
    expect(action(childIndex, 'ArrowUp')).toEqual({
      kind: 'activate',
      index: folderIndex,
    });
    expect(action(0, 'ArrowUp')).toEqual({ kind: 'activate', index: 0 });
    expect(action(rows.length - 1, 'ArrowDown')).toEqual({
      kind: 'activate',
      index: rows.length - 1,
    });
    const collapsed = flattenNetworkExplorerRows(
      model,
      new Map([['folder-a', false]]),
    );
    const index = collapsed.findIndex(
      (row) => row.kind === 'folder' && row.folder.path === 'folder-a',
    );
    expect(
      networkExplorerKeyboardAction({
        rows: collapsed,
        rowIndexById: indexNetworkExplorerRows(collapsed),
        activeIndex: index,
        key: 'ArrowRight',
      }),
    ).toEqual({ kind: 'toggle-folder', path: 'folder-a', expanded: true });
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

  it('keeps a valid window when collapsing folders shrinks scrolled content', () => {
    expect(
      networkExplorerVirtualWindow({
        rowCount: 3,
        scrollTop: 56000,
        viewportHeight: 560,
      }),
    ).toEqual({ startIndex: 0, endIndex: 3, offset: 0, totalHeight: 168 });
    expect(
      networkExplorerVirtualWindow({
        rowCount: 0,
        scrollTop: 56000,
        viewportHeight: 560,
      }),
    ).toEqual({ startIndex: 0, endIndex: 0, offset: 0, totalHeight: 0 });
  });
});
