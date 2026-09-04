import { describe, expect, it } from 'vitest';

import {
  applyFolderClusterAnchors,
  applyResolvedFolderPlacements,
  computeAutomaticGraphFrame,
  dynamicTargetFromDisplayedTarget,
  indexAppliedFixedTranslations,
  normalizedAnchorFromTarget,
  targetFromNormalizedAnchor,
} from './geometry';
import { resolveFolderSpatialRules } from './resolution';
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
  it('composes fixed groups from dynamic positions against the base frame', () => {
    const dynamic = automatic.map((item) =>
      item.key === 'a' || item.key === 'b' ? { ...item, x: item.x + 10 } : item,
    );
    const resolved = resolveFolderSpatialRules({
      rules: [
        {
          folderKey: 'alpha',
          behavior: 'place',
          scope: { kind: 'exact' },
          anchor: { x: 0, y: 0 },
        },
      ],
      folderKeyByNodeKey: folders,
    });
    const result = applyResolvedFolderPlacements({
      baseAutomaticPositions: automatic,
      currentPositions: dynamic,
      documentNodeKeys: folders.keys(),
      resolved,
      visualDownGraphYSign: -1,
    });
    expect(result.automaticFrame).toEqual({
      centerX: 1,
      centerY: 1,
      halfWidth: 5,
      halfHeight: 3,
    });
    const alpha = result.activeFolders[0]!;
    expect(alpha.automaticCenter).toEqual({ x: 7, y: 0 });
    expect(alpha.target).toEqual({ x: 1, y: 1 });
    expect(position(result.displayedPositions, 'a')).toEqual({
      key: 'a',
      x: 0,
      y: -1,
    });
    expect(position(result.displayedPositions, 'diagnostic')).toEqual(
      position(automatic, 'diagnostic'),
    );
  });

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

describe('displayed-to-dynamic fixed composition inverse', () => {
  function composedTarget({
    rules,
    folderKeyByNodeKey,
    currentPositions = automatic,
    nodeKey,
  }: {
    readonly rules: Parameters<typeof resolveFolderSpatialRules>[0]['rules'];
    readonly folderKeyByNodeKey: ReadonlyMap<string, string>;
    readonly currentPositions?: readonly SpatialPosition[];
    readonly nodeKey: string;
  }) {
    const resolved = resolveFolderSpatialRules({
      rules,
      folderKeyByNodeKey,
    });
    const composition = applyResolvedFolderPlacements({
      baseAutomaticPositions: automatic,
      currentPositions,
      documentNodeKeys: folderKeyByNodeKey.keys(),
      resolved,
      visualDownGraphYSign: -1,
    });
    const displayed = position(composition.displayedPositions, nodeKey);
    return {
      composition,
      dynamic: dynamicTargetFromDisplayedTarget({
        nodeKey,
        displayedTarget: displayed,
        fixedTranslationByNodeKey: indexAppliedFixedTranslations(
          composition.activeFolders,
        ),
      }),
    };
  }

  it('uses identity when no Place rule applies', () => {
    expect(
      dynamicTargetFromDisplayedTarget({
        nodeKey: 'a',
        displayedTarget: { x: 7, y: -9 },
        fixedTranslationByNodeKey: new Map(),
      }),
    ).toEqual({ x: 7, y: -9 });
  });

  it('subtracts an exact Place winner exactly once', () => {
    const result = composedTarget({
      rules: [
        {
          folderKey: 'alpha',
          behavior: 'place',
          scope: { kind: 'exact' },
          anchor: { x: 0.75, y: -0.5 },
        },
      ],
      folderKeyByNodeKey: folders,
      nodeKey: 'a',
    });
    expect(result.dynamic).toEqual({ x: -4, y: -2 });
    const translation = result.composition.activeFolders[0]!.translation;
    const displayed = position(result.composition.displayedPositions, 'a');
    expect({
      x: result.dynamic.x + translation.x,
      y: result.dynamic.y + translation.y,
    }).toEqual({ x: displayed.x, y: displayed.y });
    expect(
      dynamicTargetFromDisplayedTarget({
        nodeKey: 'a',
        displayedTarget: result.dynamic,
        fixedTranslationByNodeKey: new Map([['a', translation]]),
      }),
    ).toEqual({
      x: result.dynamic.x - translation.x,
      y: result.dynamic.y - translation.y,
    });
  });

  it('preserves a dynamic Pull displacement beneath a Place translation', () => {
    const dynamic = automatic.map((item) =>
      item.key === 'a' ? { ...item, x: item.x + 13, y: item.y - 8 } : item,
    );
    const result = composedTarget({
      rules: [
        {
          folderKey: 'alpha',
          behavior: 'place',
          scope: { kind: 'exact' },
          anchor: { x: -0.5, y: 1 },
        },
      ],
      folderKeyByNodeKey: folders,
      currentPositions: dynamic,
      nodeKey: 'a',
    });
    expect(result.dynamic).toEqual({ x: 9, y: -10 });
  });

  it('indexes the actual child Place winner under a parent subtree rule', () => {
    const nestedFolders = new Map([
      ['a', 'alpha'],
      ['b', 'alpha/child'],
      ['c', 'alpha/child/deep'],
    ]);
    const rules = [
      {
        folderKey: 'alpha',
        behavior: 'place' as const,
        scope: {
          kind: 'subtree' as const,
          includeRootFiles: true,
          excludedSubtrees: [],
        },
        anchor: { x: -1, y: 0 },
      },
      {
        folderKey: 'alpha/child',
        behavior: 'place' as const,
        scope: {
          kind: 'subtree' as const,
          includeRootFiles: true,
          excludedSubtrees: [],
        },
        anchor: { x: 1, y: 0 },
      },
    ];
    for (const nodeKey of ['a', 'b', 'c']) {
      expect(
        composedTarget({ rules, folderKeyByNodeKey: nestedFolders, nodeKey })
          .dynamic,
      ).toEqual((({ x, y }) => ({ x, y }))(position(automatic, nodeKey)));
    }
  });

  it('keeps Pull winners, excluded descendants, and root-dot nonmembers on identity', () => {
    const folderKeyByNodeKey = new Map([
      ['a', '.'],
      ['b', 'alpha/live'],
      ['c', 'alpha/archive'],
    ]);
    const resolved = resolveFolderSpatialRules({
      rules: [
        {
          folderKey: '.',
          behavior: 'pull',
          scope: {
            kind: 'subtree',
            includeRootFiles: true,
            excludedSubtrees: ['alpha'],
          },
          anchor: { x: 0, y: 0 },
          strength: 50,
        },
        {
          folderKey: 'alpha',
          behavior: 'place',
          scope: {
            kind: 'subtree',
            includeRootFiles: true,
            excludedSubtrees: ['alpha/archive'],
          },
          anchor: { x: 1, y: 1 },
        },
      ],
      folderKeyByNodeKey,
    });
    const composition = applyResolvedFolderPlacements({
      baseAutomaticPositions: automatic,
      currentPositions: automatic,
      documentNodeKeys: folderKeyByNodeKey.keys(),
      resolved,
      visualDownGraphYSign: -1,
    });
    const index = indexAppliedFixedTranslations(composition.activeFolders);
    expect(index.has('a')).toBe(false);
    expect(index.has('b')).toBe(true);
    expect(index.has('c')).toBe(false);
  });

  it('is deterministic and rejects duplicate or ambiguous applied groups', () => {
    const folder = {
      folderKey: 'alpha',
      memberNodeKeys: ['b', 'a'],
      automaticCenter: { x: 0, y: 0 },
      target: { x: 2, y: 3 },
      translation: { x: 2, y: 3 },
    } as const;
    expect([...indexAppliedFixedTranslations([folder])]).toEqual([
      ['a', { x: 2, y: 3 }],
      ['b', { x: 2, y: 3 }],
    ]);
    expect(() => indexAppliedFixedTranslations([folder, folder])).toThrow(
      'duplicate folder',
    );
    expect(() =>
      indexAppliedFixedTranslations([
        folder,
        { ...folder, folderKey: 'beta', memberNodeKeys: ['a'] },
      ]),
    ).toThrow('ambiguous');
  });
});
