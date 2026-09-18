import { describe, expect, it } from 'vitest';
import type { FocusSchematicLayoutCandidate } from '@icarus-graph-explorer/focus-schematic';

import {
  applyFocusSchematicSoftFolderCohesion,
  measureFocusSchematicSoftFolderCohesion,
} from './soft-folder-cohesion';
import { buildFocusSchematicSoftFolderDisplayTree } from './soft-folder-display';

function rectangle(moduleId: string, x: number, y: number) {
  return { moduleId, x, y, width: 240, height: 120 };
}

function candidate(): FocusSchematicLayoutCandidate {
  return {
    modelSchemaVersion: 1,
    rootModuleId: 'Focus',
    modules: [
      rectangle('Focus', -120, -60),
      rectangle('Peer', 1_200, 300),
      rectangle('OtherA', -900, 600),
      rectangle('OtherB', -1_300, 900),
      rectangle('Singleton', 700, -700),
    ],
    nodes: [
      {
        projectionNodeId: '["entity","Focus"]',
        moduleId: 'Focus',
        x: -90,
        y: -36,
        width: 180,
        height: 72,
      },
      {
        projectionNodeId: '["entity","Peer"]',
        moduleId: 'Peer',
        x: 1_230,
        y: 324,
        width: 180,
        height: 72,
      },
      {
        projectionNodeId: '["entity","OtherA"]',
        moduleId: 'OtherA',
        x: -870,
        y: 624,
        width: 180,
        height: 72,
      },
      {
        projectionNodeId: '["entity","OtherB"]',
        moduleId: 'OtherB',
        x: -1_270,
        y: 924,
        width: 180,
        height: 72,
      },
      {
        projectionNodeId: '["entity","Singleton"]',
        moduleId: 'Singleton',
        x: 730,
        y: -676,
        width: 180,
        height: 72,
      },
    ],
    routes: [],
  } as FocusSchematicLayoutCandidate;
}

const tree = buildFocusSchematicSoftFolderDisplayTree({
  visibleFiles: [
    { fileId: 'Focus', exactFolderKey: 'shared' },
    { fileId: 'Peer', exactFolderKey: 'shared' },
    { fileId: 'OtherA', exactFolderKey: 'other' },
    { fileId: 'OtherB', exactFolderKey: 'other' },
    { fileId: 'Singleton', exactFolderKey: 'single' },
  ],
});

describe('mandatory immediate-folder cohesion', () => {
  it('pins Focus, translates whole modules, and creates one island per named folder', () => {
    const before = candidate();
    expect(
      measureFocusSchematicSoftFolderCohesion(before, tree)
        .immediateFolderSplitViolationCount,
    ).toBeGreaterThan(0);
    const result = applyFocusSchematicSoftFolderCohesion(before, tree, 'Focus');
    expect(
      result.candidate.modules.find(({ moduleId }) => moduleId === 'Focus'),
    ).toEqual(before.modules.find(({ moduleId }) => moduleId === 'Focus'));
    for (const node of result.candidate.nodes) {
      const module = result.candidate.modules.find(
        ({ moduleId }) => moduleId === node.moduleId,
      )!;
      const originalNode = before.nodes.find(
        ({ projectionNodeId }) => projectionNodeId === node.projectionNodeId,
      )!;
      const originalModule = before.modules.find(
        ({ moduleId }) => moduleId === node.moduleId,
      )!;
      expect(node.x - module.x).toBe(originalNode.x - originalModule.x);
      expect(node.y - module.y).toBe(originalNode.y - originalModule.y);
    }
    expect(
      measureFocusSchematicSoftFolderCohesion(result.candidate, tree),
    ).toMatchObject({
      immediateFolderSplitViolationCount: 0,
    });
    expect(result.evidence).toMatchObject({
      immediateFolderGroupCount: 3,
      immediateFolderSingletonCount: 1,
    });
  });

  it('is deterministic under module and visible-file input permutation', () => {
    const input = candidate();
    const first = applyFocusSchematicSoftFolderCohesion(input, tree, 'Focus');
    const permutedTree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [...tree.files]
        .reverse()
        .map(({ fileId, exactFolderKey }) => ({ fileId, exactFolderKey })),
    });
    const second = applyFocusSchematicSoftFolderCohesion(
      {
        ...input,
        modules: [...input.modules].reverse(),
        nodes: [...input.nodes].reverse(),
      },
      permutedTree,
      'Focus',
    );
    expect(
      [...second.candidate.modules].sort((left, right) =>
        left.moduleId.localeCompare(right.moduleId),
      ),
    ).toEqual(
      [...first.candidate.modules].sort((left, right) =>
        left.moduleId.localeCompare(right.moduleId),
      ),
    );
  });
});
