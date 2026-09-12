import { describe, expect, it } from 'vitest';
import { createNetworkExplorerFolders } from './network-explorer-folders';
import {
  currentNetworkExplorerContextTarget,
  networkExplorerContextTarget,
  networkExplorerMenuActions,
  networkExplorerMenuIndex,
  networkExplorerSizeEntityId,
  type NetworkExplorerContext,
  type NetworkExplorerContextTarget,
} from './network-explorer-context';
import type {
  NetworkExplorerModel,
  NetworkExplorerNode,
  NetworkExplorerRow,
} from './network-explorer-model';

const entity: NetworkExplorerNode = {
  id: 'node',
  entityId: 'entity',
  sourcePath: 'Notes/A.md',
  glyph: '▰',
  kindLabel: 'File',
  name: 'A',
  secondary: 'Notes/A.md',
  focusRoot: false,
  focusDistance: null,
};
const diagnostic: NetworkExplorerNode = {
  id: 'diagnostic',
  glyph: '○',
  kindLabel: 'Diagnostic',
  name: 'Missing',
  secondary: 'unresolved',
  focusRoot: false,
  focusDistance: null,
};

const nodeTarget = (
  node: NetworkExplorerNode,
): NetworkExplorerContextTarget => ({ kind: 'node', node });

function fixture(): {
  readonly model: NetworkExplorerModel;
  readonly folderRow: Extract<NetworkExplorerRow, { kind: 'folder' }>;
  readonly nodeRow: Extract<NetworkExplorerRow, { kind: 'node' }>;
} {
  const folders = createNetworkExplorerFolders([entity]);
  const model = {
    nodes: [entity],
    nodeById: new Map([[entity.id, entity]]),
    ...folders,
  };
  const folder = folders.folderByPath.get('Notes')!;
  return {
    model,
    folderRow: {
      kind: 'folder',
      id: 'folder:Notes',
      folder,
      expanded: true,
      level: 1,
      parentFolderId: undefined,
      position: 1,
      setSize: 1,
    },
    nodeRow: {
      kind: 'node',
      id: 'node:node',
      node: entity,
      nestedInFile: false,
      level: 2,
      parentFolderId: 'folder:Notes',
      position: 1,
      setSize: 1,
    },
  };
}

describe('Network Explorer context contract', () => {
  it('resolves current node and real-folder targets without fake graph IDs', () => {
    const { folderRow, model, nodeRow } = fixture();
    expect(networkExplorerContextTarget(nodeRow, model)).toEqual(
      nodeTarget(entity),
    );
    expect(networkExplorerContextTarget(folderRow, model)).toEqual({
      kind: 'folder',
      folder: folderRow.folder,
    });
    expect(
      networkExplorerContextTarget(nodeRow, {
        ...model,
        nodes: [],
        nodeById: new Map(),
      }),
    ).toBeUndefined();
    expect(
      networkExplorerContextTarget(folderRow, {
        ...model,
        folderByPath: new Map(),
      }),
    ).toBeUndefined();
  });

  it('keeps File actions and their focused/already-hidden guards unchanged', () => {
    expect(
      networkExplorerMenuActions(
        nodeTarget(entity),
        undefined,
        new Set(),
        new Set(),
      ).every((action) => action.disabledReason === undefined),
    ).toBe(true);
    for (const kindLabel of ['File', 'Heading', 'Block'] as const) {
      expect(
        networkExplorerMenuActions(
          nodeTarget({ ...entity, kindLabel }),
          entity.sourcePath,
          new Set(),
          new Set(),
        )[2]?.disabledReason,
      ).toContain('Change Focus');
    }
    expect(
      networkExplorerMenuActions(
        nodeTarget(entity),
        undefined,
        new Set(['Notes/A.md']),
        new Set(),
      )[2]?.disabledReason,
    ).toContain('already hidden');
  });

  it('offers one exact Hide folder action and protects the focused subtree by segments', () => {
    const { folderRow, model } = fixture();
    const target = networkExplorerContextTarget(folderRow, model)!;
    expect(
      networkExplorerMenuActions(target, undefined, new Set(), new Set()),
    ).toEqual([{ id: 'hide-folder', label: 'Hide folder' }]);
    expect(
      networkExplorerMenuActions(
        target,
        'Notes/Sub/Focused.md',
        new Set(),
        new Set(),
      ),
    ).toEqual([
      {
        id: 'hide-folder',
        label: 'Hide folder',
        disabledReason:
          'Change Focus before hiding the folder that contains the focused file.',
      },
    ]);
    expect(
      networkExplorerMenuActions(
        target,
        'Notes-old/Focused.md',
        new Set(),
        new Set(),
      )[0]?.disabledReason,
    ).toBeUndefined();
    expect(
      networkExplorerMenuActions(
        target,
        undefined,
        new Set(),
        new Set(['Notes']),
      )[0]?.disabledReason,
    ).toContain('already hidden');
  });

  it('allows diagnostic inspection without inventing a source path or Focus entity', () => {
    const actions = networkExplorerMenuActions(
      nodeTarget(diagnostic),
      undefined,
      new Set(),
      new Set(),
    );
    expect(actions[0]?.disabledReason).toBeDefined();
    expect(actions[1]?.disabledReason).toBeUndefined();
    expect(actions[2]?.disabledReason).toBeDefined();
    expect(networkExplorerMenuIndex(actions, -1, 'Home')).toBe(1);
    expect(networkExplorerMenuIndex(actions, 1, 'ArrowDown')).toBe(1);
  });

  it('navigates and wraps only enabled menu items with arrows, Home and End', () => {
    const actions = networkExplorerMenuActions(
      nodeTarget(entity),
      entity.sourcePath,
      new Set(),
      new Set(),
    );
    expect(networkExplorerMenuIndex(actions, 0, 'ArrowUp')).toBe(3);
    expect(networkExplorerMenuIndex(actions, 1, 'ArrowDown')).toBe(3);
    expect(networkExplorerMenuIndex(actions, 3, 'ArrowDown')).toBe(0);
    expect(networkExplorerMenuIndex(actions, 1, 'Home')).toBe(0);
    expect(networkExplorerMenuIndex(actions, 0, 'End')).toBe(3);
  });

  it('offers Size only for canonical Files and uses EntityId', () => {
    expect(networkExplorerSizeEntityId(entity)).toBe('entity');
    expect(
      networkExplorerMenuActions(
        nodeTarget(entity),
        undefined,
        new Set(),
        new Set(),
      ).map((action) => action.id),
    ).toEqual(['focus', 'inspect', 'hide', 'size']);
    for (const node of [
      diagnostic,
      { ...entity, kindLabel: 'Heading' as const },
      { ...entity, kindLabel: 'Block' as const },
      { ...diagnostic, kindLabel: 'File' as const },
    ]) {
      expect(networkExplorerSizeEntityId(node)).toBeUndefined();
      expect(
        networkExplorerMenuActions(
          nodeTarget(node),
          undefined,
          new Set(),
          new Set(),
        ).some((action) => action.id === 'size'),
      ).toBe(false);
    }
  });

  it('offers Move File only for canonical Files and explains unavailability', () => {
    expect(
      networkExplorerMenuActions(
        nodeTarget(entity),
        undefined,
        new Set(),
        new Set(),
        { available: true },
      ).map((action) => action.id),
    ).toEqual(['focus', 'inspect', 'move-file', 'hide', 'size']);
    expect(
      networkExplorerMenuActions(
        nodeTarget(entity),
        undefined,
        new Set(),
        new Set(),
        { available: false, reason: 'Waiting for Network layout…' },
      ).find((action) => action.id === 'move-file'),
    ).toEqual({
      id: 'move-file',
      label: 'Move File',
      disabledReason: 'Waiting for Network layout…',
    });
    for (const kindLabel of ['Heading', 'Block', 'Diagnostic'] as const) {
      expect(
        networkExplorerMenuActions(
          nodeTarget({ ...entity, kindLabel }),
          undefined,
          new Set(),
          new Set(),
          { available: true },
        ).some((action) => action.id === 'move-file'),
      ).toBe(false);
    }
  });

  it('keeps logical virtual targets and fails closed after row/projection removal', () => {
    const { folderRow, model, nodeRow } = fixture();
    const rows = [folderRow, nodeRow];
    const indexes = new Map(rows.map((row, index) => [row.id, index]));
    const context: NetworkExplorerContext = {
      rowId: folderRow.id,
      model,
      screen: 'actions',
      x: 10,
      y: 20,
    };
    expect(
      currentNetworkExplorerContextTarget(context, model, rows, indexes),
    ).toEqual({ kind: 'folder', folder: folderRow.folder });
    expect(
      currentNetworkExplorerContextTarget(context, model, [], new Map()),
    ).toBeUndefined();
    expect(
      currentNetworkExplorerContextTarget(context, { ...model }, rows, indexes),
    ).toBeUndefined();
    expect(
      currentNetworkExplorerContextTarget(null, model, rows, indexes),
    ).toBeUndefined();
  });
});
