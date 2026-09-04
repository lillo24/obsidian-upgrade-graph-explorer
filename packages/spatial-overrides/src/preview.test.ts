import { describe, expect, it } from 'vitest';

import { applyFolderClusterAnchors } from './geometry';
import {
  createFolderClusterPreviewGeometry,
  createFolderSpatialRulePreviewGeometry,
  offsetNormalizedFolderAnchor,
  previewFolderClusterAtAnchor,
  previewFolderClusterFromPointer,
} from './preview';
import type { SpatialPosition } from './types';

const automatic: readonly SpatialPosition[] = [
  { key: 'a', x: -5, y: -2 },
  { key: 'b', x: -1, y: 2 },
  { key: 'nested', x: 2, y: 3 },
  { key: 'other', x: 5, y: -3 },
  { key: 'diagnostic', x: 50, y: 50 },
];
const folders = new Map([
  ['a', 'Theory'],
  ['b', 'Theory'],
  ['nested', 'Theory/Language'],
  ['other', 'Other'],
]);

describe('sparse folder preview geometry', () => {
  it('captures exact-folder members and causes no jump at the start pointer', () => {
    const anchors = new Map([['Theory', { x: 0.4, y: -0.2 }]]);
    const geometry = createFolderClusterPreviewGeometry({
      automaticPositions: automatic,
      folderKeyByNodeKey: folders,
      anchors,
      folderKey: 'Theory',
      visualDownGraphYSign: -1,
    });
    expect(geometry.memberAutomaticPositions.map(({ key }) => key)).toEqual([
      'a',
      'b',
    ]);
    const preview = previewFolderClusterFromPointer({
      geometry,
      startPointer: { x: 10, y: 20 },
      currentPointer: { x: 10, y: 20 },
      visualDownGraphYSign: -1,
    });
    expect(preview.anchor.x).toBeCloseTo(0.4);
    expect(preview.anchor.y).toBeCloseTo(-0.2);
    expect(preview.target.x).toBeCloseTo(geometry.displayedCenter.x);
    expect(preview.target.y).toBeCloseTo(geometry.displayedCenter.y);
  });

  it('converts pointer delta to equal folder-center delta and logical down', () => {
    const geometry = createFolderClusterPreviewGeometry({
      automaticPositions: automatic,
      folderKeyByNodeKey: folders,
      anchors: new Map(),
      folderKey: 'Theory',
      visualDownGraphYSign: -1,
    });
    const preview = previewFolderClusterFromPointer({
      geometry,
      startPointer: { x: 5, y: 8 },
      currentPointer: { x: 8, y: 4 },
      visualDownGraphYSign: -1,
    });
    expect(preview.target.x - geometry.displayedCenter.x).toBeCloseTo(3);
    expect(preview.target.y - geometry.displayedCenter.y).toBeCloseTo(-4);
    expect(preview.anchor.y).toBeGreaterThan(geometry.displayedAnchor.y);
  });

  it('matches authoritative composition while updating only active members', () => {
    const persisted = new Map([['Other', { x: -0.6, y: 0.3 }]]);
    const previewAnchor = { x: 0.75, y: 0.5 };
    const geometry = createFolderClusterPreviewGeometry({
      automaticPositions: automatic,
      folderKeyByNodeKey: folders,
      anchors: persisted,
      folderKey: 'Theory',
      visualDownGraphYSign: -1,
    });
    const sparse = previewFolderClusterAtAnchor({
      geometry,
      anchor: previewAnchor,
      visualDownGraphYSign: -1,
    });
    const full = applyFolderClusterAnchors({
      automaticPositions: automatic,
      folderKeyByNodeKey: folders,
      anchors: new Map([...persisted, ['Theory', previewAnchor]]),
      visualDownGraphYSign: -1,
    });
    const fullByKey = new Map(
      full.displayedPositions.map((position) => [position.key, position]),
    );
    expect(sparse.positions).toEqual(
      sparse.positions.map(({ key }) => fullByKey.get(key)),
    );
    expect(sparse.positions.map(({ key }) => key)).toEqual(['a', 'b']);
  });

  it('always derives repeated previews from the automatic base', () => {
    const geometry = createFolderClusterPreviewGeometry({
      automaticPositions: automatic,
      folderKeyByNodeKey: folders,
      anchors: new Map(),
      folderKey: 'Theory',
      visualDownGraphYSign: -1,
    });
    const args = {
      geometry,
      anchor: { x: 1, y: 1 },
      visualDownGraphYSign: -1 as const,
    };
    expect(previewFolderClusterAtAnchor(args)).toEqual(
      previewFolderClusterAtAnchor(args),
    );
  });

  it('clamps pointer and keyboard previews to schema-v1 bounds', () => {
    const geometry = createFolderClusterPreviewGeometry({
      automaticPositions: automatic,
      folderKeyByNodeKey: folders,
      anchors: new Map(),
      folderKey: 'Theory',
      visualDownGraphYSign: -1,
    });
    expect(
      previewFolderClusterFromPointer({
        geometry,
        startPointer: { x: 0, y: 0 },
        currentPointer: { x: 10_000, y: 10_000 },
        visualDownGraphYSign: -1,
      }).anchor,
    ).toEqual({ x: 2, y: -2 });
    expect(
      offsetNormalizedFolderAnchor({ x: 1.98, y: -1.98 }, { x: 0.1, y: -0.1 }),
    ).toEqual({ x: 2, y: -2 });
  });

  it('rejects absent folders and invalid nudge input loudly', () => {
    expect(() =>
      createFolderClusterPreviewGeometry({
        automaticPositions: automatic,
        folderKeyByNodeKey: folders,
        anchors: new Map(),
        folderKey: 'Missing',
        visualDownGraphYSign: -1,
      }),
    ).toThrow('no visible document members');
    expect(() =>
      offsetNormalizedFolderAnchor({ x: 0, y: 0 }, { x: Number.NaN, y: 0 }),
    ).toThrow('finite');
  });

  it('previews an arbitrary deepest-wins member set from current displayed geometry', () => {
    const current = automatic.map((position) => ({
      ...position,
      x: position.x + (position.key === 'nested' ? 10 : 1),
    }));
    const geometry = createFolderSpatialRulePreviewGeometry({
      baseAutomaticPositions: automatic,
      currentPositions: current,
      documentNodeKeys: folders.keys(),
      memberNodeKeys: ['a', 'nested'],
      folderKey: 'Theory',
      visualDownGraphYSign: -1,
    });
    expect(geometry.memberAutomaticPositions.map(({ key }) => key)).toEqual([
      'a',
      'nested',
    ]);
    const preview = previewFolderClusterFromPointer({
      geometry,
      startPointer: { x: 0, y: 0 },
      currentPointer: { x: 3, y: -2 },
      visualDownGraphYSign: -1,
    });
    const currentByKey = new Map(current.map((point) => [point.key, point]));
    for (const point of preview.positions) {
      expect(point.x - currentByKey.get(point.key)!.x).toBeCloseTo(3);
      expect(point.y - currentByKey.get(point.key)!.y).toBeCloseTo(-2);
    }
    expect(preview.positions.map(({ key }) => key)).not.toContain('b');
  });
});
