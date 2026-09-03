import { createNetworkExplorerFolders } from './network-explorer-folders';
import { describe, expect, it } from 'vitest';
import {
  networkExplorerContextTarget,
  networkExplorerMenuActions,
  networkExplorerMenuIndex,
  networkExplorerSizeEntityId,
  currentNetworkExplorerContextTarget,
  type NetworkExplorerContext,
} from './network-explorer-context';
import type {
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

describe('Network Explorer context contract', () => {
  it('targets only current graph nodes; folders and stale rows have no actions', () => {
    const folders = createNetworkExplorerFolders([entity]);
    const model = {
      nodes: [entity],
      nodeById: new Map([[entity.id, entity]]),
      ...folders,
    };
    const row: NetworkExplorerRow = {
      kind: 'node',
      id: 'node:node',
      node: entity,
      nestedInFile: false,
      level: 2,
      parentFolderId: 'folder:Notes',
      position: 1,
      setSize: 1,
    };
    expect(networkExplorerContextTarget(row, model)).toBe(entity);
    expect(
      networkExplorerContextTarget(row, {
        ...model,
        nodes: [],
        nodeById: new Map(),
      }),
    ).toBeUndefined();
    const folder = folders.folderByPath.get('Notes')!;
    expect(
      networkExplorerContextTarget(
        {
          kind: 'folder',
          id: 'folder:Notes',
          folder,
          expanded: true,
          level: 1,
          parentFolderId: undefined,
          position: 1,
          setSize: 1,
        },
        model,
      ),
    ).toBeUndefined();
  });
  it('enables entity actions, guards the entire focused file, and guards already-hidden paths', () => {
    expect(
      networkExplorerMenuActions(entity, undefined, new Set()).every(
        (action) => action.disabledReason === undefined,
      ),
    ).toBe(true);
    for (const kindLabel of ['File', 'Heading', 'Block'] as const) {
      expect(
        networkExplorerMenuActions(
          { ...entity, kindLabel },
          entity.sourcePath,
          new Set(),
        )[2]?.disabledReason,
      ).toContain('Change Focus');
    }
    expect(
      networkExplorerMenuActions(entity, undefined, new Set(['Notes/A.md']))[2]
        ?.disabledReason,
    ).toContain('already hidden');
  });
  it('allows diagnostic inspection without inventing a source path or Focus entity', () => {
    const actions = networkExplorerMenuActions(
      diagnostic,
      undefined,
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
      entity,
      entity.sourcePath,
      new Set(),
    );
    expect(networkExplorerMenuIndex(actions, 0, 'ArrowUp')).toBe(3);
    expect(networkExplorerMenuIndex(actions, 1, 'ArrowDown')).toBe(3);
    expect(networkExplorerMenuIndex(actions, 3, 'ArrowDown')).toBe(0);
    expect(networkExplorerMenuIndex(actions, 1, 'Home')).toBe(0);
    expect(networkExplorerMenuIndex(actions, 0, 'End')).toBe(3);
  });
  it('offers Size only for canonical Files and uses EntityId rather than row key/path/name', () => {
    expect(networkExplorerSizeEntityId(entity)).toBe('entity');
    expect(
      networkExplorerMenuActions(entity, undefined, new Set()).map(
        (action) => action.id,
      ),
    ).toEqual(['focus', 'inspect', 'hide', 'size']);
    for (const node of [
      diagnostic,
      { ...entity, kindLabel: 'Heading' as const },
      { ...entity, kindLabel: 'Block' as const },
      { ...diagnostic, kindLabel: 'File' as const },
    ]) {
      expect(networkExplorerSizeEntityId(node)).toBeUndefined();
      expect(
        networkExplorerMenuActions(node, undefined, new Set()).some(
          (action) => action.id === 'size',
        ),
      ).toBe(false);
    }
  });
  it('keeps editor targets independent of DOM mounting and closes on changed projection/logical row removal', () => {
    const model = {
      nodes: [entity],
      nodeById: new Map([[entity.id, entity]]),
      ...createNetworkExplorerFolders([entity]),
    };
    const context: NetworkExplorerContext = {
      rowId: 'node:node',
      targetId: entity.id,
      model,
      screen: 'size',
      x: 10,
      y: 20,
    };
    const rows = new Map([[context.rowId, 9000]]);
    expect(currentNetworkExplorerContextTarget(context, model, rows)).toBe(
      entity,
    );
    expect(
      currentNetworkExplorerContextTarget(context, model, new Map()),
    ).toBeUndefined();
    expect(
      currentNetworkExplorerContextTarget(
        context,
        {
          nodes: [],
          nodeById: new Map(),
          ...createNetworkExplorerFolders([]),
        },
        rows,
      ),
    ).toBeUndefined();
    expect(
      currentNetworkExplorerContextTarget(context, { ...model }, rows),
    ).toBeUndefined();
    expect(
      currentNetworkExplorerContextTarget(null, model, rows),
    ).toBeUndefined();
  });
});
