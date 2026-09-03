import { describe, expect, it } from 'vitest';
import {
  networkExplorerContextTarget,
  networkExplorerMenuActions,
  networkExplorerMenuIndex,
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
  internalReferenceCount: 0,
  adjacency: [],
};
const diagnostic: NetworkExplorerNode = {
  id: 'diagnostic',
  glyph: '○',
  kindLabel: 'Diagnostic',
  name: 'Missing',
  secondary: 'unresolved',
  focusRoot: false,
  focusDistance: null,
  internalReferenceCount: 0,
  adjacency: [],
};

describe('Network Explorer context contract', () => {
  it('normalizes adjacency to the current target rather than its parent or selection', () => {
    const row: NetworkExplorerRow = {
      kind: 'adjacency',
      id: 'relation',
      position: 1,
      setSize: 1,
      adjacency: {
        id: 'relation',
        edgeId: 'edge',
        parentNodeId: diagnostic.id,
        targetNodeId: entity.id,
        relationship: 'outgoing',
        targetName: entity.name,
        targetKindLabel: entity.kindLabel,
        referenceCount: 20,
      },
    };
    expect(
      networkExplorerContextTarget(row, {
        nodes: [entity],
        nodeById: new Map([[entity.id, entity]]),
      }),
    ).toBe(entity);
    expect(
      networkExplorerContextTarget(row, { nodes: [], nodeById: new Map() }),
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
    expect(networkExplorerMenuIndex(actions, 0, 'ArrowUp')).toBe(1);
    expect(networkExplorerMenuIndex(actions, 1, 'ArrowDown')).toBe(0);
    expect(networkExplorerMenuIndex(actions, 1, 'Home')).toBe(0);
    expect(networkExplorerMenuIndex(actions, 0, 'End')).toBe(1);
  });
});
