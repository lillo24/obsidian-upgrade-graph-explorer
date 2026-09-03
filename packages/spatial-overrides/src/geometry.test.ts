import { describe, expect, it } from 'vitest';

import {
  applyFolderClusterAnchors,
  computeAutomaticGraphFrame,
  normalizedAnchorFromTarget,
  targetFromNormalizedAnchor,
} from './geometry';
import type { SpatialPosition } from './types';

const automatic: readonly SpatialPosition[] = [
  { key: 'a', x: -4, y: -2 },
  { key: 'b', x: -2, y: 2 },
  { key: 'c', x: 6, y: 4 },
  { key: 'diagnostic', x: 1_000, y: -1_000 },
];
const folders = new Map([
  ['a', 'alpha'],
  ['b', 'alpha'],
  ['c', 'beta/nested'],
]);

function position(
  positions: readonly SpatialPosition[],
  key: string,
): SpatialPosition {
  const found = positions.find((candidate) => candidate.key === key);
  if (found === undefined) throw new Error(`Missing ${key}`);
  return found;
}

describe('normalized folder-anchor geometry', () => {
  it('returns equivalent automatic positions for an empty anchor map', () => {
    const result = applyFolderClusterAnchors({
      automaticPositions: automatic,
      folderKeyByNodeKey: folders,
      anchors: new Map(),
      visualDownGraphYSign: -1,
    });
    expect(result.displayedPositions).toEqual(
      [...automatic].sort((left, right) => left.key.localeCompare(right.key)),
    );
    expect(result.activeFolders).toEqual([]);
    expect(result.inactiveFolderKeys).toEqual([]);
  });

  it('uses deterministic minimum extents for empty, singleton, and degenerate frames', () => {
    expect(computeAutomaticGraphFrame([], [])).toEqual({
      centerX: 0,
      centerY: 0,
      halfWidth: 1,
      halfHeight: 1,
    });
    expect(
      computeAutomaticGraphFrame([{ key: 'a', x: 8, y: -3 }], ['a']),
    ).toEqual({ centerX: 8, centerY: -3, halfWidth: 1, halfHeight: 1 });
    expect(
      computeAutomaticGraphFrame(
        [
          { key: 'a', x: 0, y: 4 },
          { key: 'b', x: 8, y: 4 },
        ],
        ['a', 'b'],
      ),
    ).toEqual({ centerX: 4, centerY: 4, halfWidth: 4, halfHeight: 1 });
    expect(
      computeAutomaticGraphFrame(
        [
          { key: 'a', x: 2, y: -8 },
          { key: 'b', x: 2, y: 8 },
        ],
        ['a', 'b'],
      ),
    ).toEqual({ centerX: 2, centerY: 0, halfWidth: 1, halfHeight: 8 });
  });

  it('excludes diagnostics from a rectangular automatic frame', () => {
    expect(computeAutomaticGraphFrame(automatic, folders.keys())).toEqual({
      centerX: 1,
      centerY: 1,
      halfWidth: 5,
      halfHeight: 3,
    });
  });

  it('moves root/nested folders rigidly and leaves untargeted nodes and diagnostics unchanged', () => {
    const automaticWithRoot = [
      ...automatic,
      { key: 'root', x: 0, y: 0 },
    ] as const;
    const rootFolders = new Map(folders).set('root', '.');
    const result = applyFolderClusterAnchors({
      automaticPositions: automaticWithRoot,
      folderKeyByNodeKey: rootFolders,
      anchors: new Map([
        ['alpha', { x: 0.5, y: 0.5 }],
        ['.', { x: -1, y: -1 }],
      ]),
      visualDownGraphYSign: -1,
    });
    const beforeDistance = Math.hypot(-4 - -2, -2 - 2);
    const afterA = position(result.displayedPositions, 'a');
    const afterB = position(result.displayedPositions, 'b');
    expect(Math.hypot(afterA.x - afterB.x, afterA.y - afterB.y)).toBeCloseTo(
      beforeDistance,
    );
    expect(position(result.displayedPositions, 'c')).toEqual(
      position(automatic, 'c'),
    );
    expect(position(result.displayedPositions, 'root')).not.toEqual(
      position(automaticWithRoot, 'root'),
    );
    expect(position(result.displayedPositions, 'diagnostic')).toEqual(
      position(automaticWithRoot, 'diagnostic'),
    );

    const diagnosticExcluded = applyFolderClusterAnchors({
      automaticPositions: automatic,
      folderKeyByNodeKey: folders,
      anchors: new Map([['alpha', { x: 0.5, y: 0.5 }]]),
      visualDownGraphYSign: -1,
    });
    expect(
      position(diagnosticExcluded.displayedPositions, 'diagnostic'),
    ).toEqual(position(automatic, 'diagnostic'));
  });

  it('reaches independent target centers for multiple folders', () => {
    const result = applyFolderClusterAnchors({
      automaticPositions: automatic,
      folderKeyByNodeKey: folders,
      anchors: new Map([
        ['alpha', { x: -0.5, y: 0.75 }],
        ['beta/nested', { x: 1, y: -1 }],
      ]),
      visualDownGraphYSign: -1,
    });
    for (const summary of result.activeFolders) {
      const displayedCenter = summary.memberNodeKeys.reduce(
        (total, key) => {
          const point = position(result.displayedPositions, key);
          return { x: total.x + point.x, y: total.y + point.y };
        },
        { x: 0, y: 0 },
      );
      expect(displayedCenter.x / summary.memberNodeKeys.length).toBeCloseTo(
        summary.target.x,
      );
      expect(displayedCenter.y / summary.memberNodeKeys.length).toBeCloseTo(
        summary.target.y,
      );
    }
  });

  it('reports absent folders inactive without pruning their anchors', () => {
    const anchors = new Map([['missing', { x: 1, y: 1 }]]);
    const result = applyFolderClusterAnchors({
      automaticPositions: automatic,
      folderKeyByNodeKey: folders,
      anchors,
      visualDownGraphYSign: -1,
    });
    expect(result.inactiveFolderKeys).toEqual(['missing']);
    expect(result.displayedPositions).toEqual(
      [...automatic].sort((a, b) => a.key.localeCompare(b.key)),
    );
    expect(anchors.has('missing')).toBe(true);
  });

  it('round-trips targets and clamps future drag targets to v1 bounds', () => {
    const frame = computeAutomaticGraphFrame(automatic, folders.keys());
    const anchor = { x: 0.7, y: 0.7 };
    const target = targetFromNormalizedAnchor(frame, anchor, -1);
    const restored = normalizedAnchorFromTarget(frame, target, -1);
    expect(restored.x).toBeCloseTo(anchor.x);
    expect(restored.y).toBeCloseTo(anchor.y);
    expect(normalizedAnchorFromTarget(frame, { x: 999, y: 999 }, -1)).toEqual({
      x: 2,
      y: -2,
    });
  });

  it('scales translations with a changed automatic frame', () => {
    const anchor = { x: 1, y: 1 };
    const small = targetFromNormalizedAnchor(
      { centerX: 0, centerY: 0, halfWidth: 2, halfHeight: 3 },
      anchor,
      -1,
    );
    const large = targetFromNormalizedAnchor(
      { centerX: 0, centerY: 0, halfWidth: 8, halfHeight: 12 },
      anchor,
      -1,
    );
    expect(large).toEqual({ x: small.x * 4, y: small.y * 4 });
  });

  it('is deterministic and never accumulates displayed-position drift', () => {
    const args = {
      automaticPositions: automatic,
      folderKeyByNodeKey: folders,
      anchors: new Map([['alpha', { x: 0.25, y: -0.5 }]]),
      visualDownGraphYSign: -1 as const,
    };
    const first = applyFolderClusterAnchors(args);
    const repeated = applyFolderClusterAnchors(args);
    expect(repeated).toEqual(first);
    expect(
      applyFolderClusterAnchors({
        ...args,
        automaticPositions: automatic,
      }).displayedPositions,
    ).toEqual(first.displayedPositions);
  });

  it('rejects malformed position, metadata, anchor, and orientation inputs', () => {
    expect(() =>
      computeAutomaticGraphFrame([{ key: 'a', x: NaN, y: 0 }], ['a']),
    ).toThrow('finite');
    expect(() =>
      applyFolderClusterAnchors({
        automaticPositions: automatic,
        folderKeyByNodeKey: new Map([['missing', 'folder']]),
        anchors: new Map(),
        visualDownGraphYSign: -1,
      }),
    ).toThrow('missing node');
    expect(() =>
      applyFolderClusterAnchors({
        automaticPositions: automatic,
        folderKeyByNodeKey: folders,
        anchors: new Map([['/invalid', { x: 0, y: 0 }]]),
        visualDownGraphYSign: -1,
      }),
    ).toThrow('invalid folder key');
    expect(() =>
      targetFromNormalizedAnchor(
        { centerX: 0, centerY: 0, halfWidth: 1, halfHeight: 1 },
        { x: 0, y: 0 },
        0 as -1,
      ),
    ).toThrow('must be -1 or +1');
  });
});
