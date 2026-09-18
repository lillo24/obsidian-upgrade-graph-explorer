import { describe, expect, it } from 'vitest';

import {
  buildFocusSchematicSoftFolderDisplayTree,
  canonicalFocusSchematicSoftFolderDisplayIntent,
  flattenFocusSchematicSoftFolder,
  focusSchematicSoftFolderScopeMemberships,
  moveFocusSchematicSoftFileUp,
  reconcileFocusSchematicSoftFolderDisplayIntent,
  restoreFocusSchematicSoftFile,
  restoreFocusSchematicSoftFolderLayer,
  validateFocusSchematicSoftFolderDisplayIntent,
  type FocusSchematicSoftFolderDisplayInputFile,
} from './soft-folder-display';

const file = (
  fileId: string,
  exactFolderKey: string,
): FocusSchematicSoftFolderDisplayInputFile => ({ fileId, exactFolderKey });

const folders = (
  tree: ReturnType<typeof buildFocusSchematicSoftFolderDisplayTree>,
) => tree.folders.map(({ folderKey }) => folderKey);

describe('nested Soft folder display tree', () => {
  it('validates and canonicalizes sparse source-neutral intent', () => {
    expect(
      canonicalFocusSchematicSoftFolderDisplayIntent({
        flattenedFolderKeys: ['Z/B', 'A/B'],
        fileParentOverrides: [
          { fileId: 'z', displayParentFolderKey: 'Z' },
          { fileId: 'a', displayParentFolderKey: 'A' },
        ],
      }),
    ).toEqual({
      fileParentOverrides: [
        { fileId: 'a', displayParentFolderKey: 'A' },
        { fileId: 'z', displayParentFolderKey: 'Z' },
      ],
      flattenedFolderKeys: ['A/B', 'Z/B'],
    });
    expect(
      validateFocusSchematicSoftFolderDisplayIntent({
        fileParentOverrides: [
          { fileId: 'a', displayParentFolderKey: '/private' },
        ],
        flattenedFolderKeys: [],
      }).valid,
    ).toBe(false);
  });

  it('N1 preserves a meaningful parent guide and nested child guide', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [
        file('a', 'Folder1'),
        file('b', 'Folder1/Folder2'),
        file('c', 'Folder1/Folder2'),
      ],
    });
    expect(folders(tree)).toEqual(['.', 'Folder1', 'Folder1/Folder2']);
    expect(
      tree.folders.find(({ folderKey }) => folderKey === 'Folder1'),
    ).toMatchObject({
      directFileIds: ['a'],
      childFolderKeys: ['Folder1/Folder2'],
      displayDepth: 1,
    });
    expect(
      tree.folders.find(({ folderKey }) => folderKey === 'Folder1/Folder2')
        ?.displayDepth,
    ).toBe(2);
  });

  it('N2-N4 promotes one File repeatedly and restores only its exact placement', () => {
    const visibleFiles = [
      file('a', 'Folder1/Folder2'),
      file('b', 'Folder1/Folder2'),
      file('c', 'Folder1/Folder2'),
      file('outer', 'Folder1'),
    ];
    let tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles });
    let intent = moveFocusSchematicSoftFileUp(tree, 'a');
    tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles, intent });
    expect(
      tree.folders.find(({ folderKey }) => folderKey === 'Folder1'),
    ).toMatchObject({ directFileIds: ['a', 'outer'] });
    expect(
      tree.folders.find(({ folderKey }) => folderKey === 'Folder1/Folder2')
        ?.directFileIds,
    ).toEqual(['b', 'c']);
    intent = moveFocusSchematicSoftFileUp(tree, 'a');
    expect(intent.fileParentOverrides).toEqual([
      { fileId: 'a', displayParentFolderKey: '.' },
    ]);
    tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles, intent });
    expect(
      restoreFocusSchematicSoftFile(tree, 'a').fileParentOverrides,
    ).toEqual([]);
  });

  it('N5-N7 flattens one layer, flattens displayed siblings, and restores layers', () => {
    const visibleFiles = [
      file('outer', 'A'),
      file('b1', 'A/B'),
      file('b2', 'A/B/C'),
      file('b3', 'A/B/C'),
      file('d1', 'A/D'),
      file('d2', 'A/D'),
    ];
    let tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles });
    let intent = flattenFocusSchematicSoftFolder(tree, 'A/B');
    tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles, intent });
    expect(folders(tree)).not.toContain('A/B');
    expect(folders(tree)).toContain('A/B/C');
    expect(
      tree.folders.find(({ folderKey }) => folderKey === 'A/B/C')
        ?.displayParentFolderKey,
    ).toBe('A');
    expect(
      tree.folders.find(({ folderKey }) => folderKey === 'A/B/C')?.displayDepth,
    ).toBe(2);
    intent = flattenFocusSchematicSoftFolder(tree, 'A/B/C', true);
    expect(intent.flattenedFolderKeys).toEqual(['A/B', 'A/B/C', 'A/D']);
    intent = restoreFocusSchematicSoftFolderLayer(intent, 'A/B');
    expect(intent.flattenedFolderKeys).toEqual(['A/B/C', 'A/D']);
  });

  it.each([
    {
      name: 'N8 one-File leaf',
      visibleFiles: [file('other', 'A'), file('only', 'A/B')],
      missing: [],
      kept: ['A', 'A/B'],
    },
    {
      name: 'N9 deep singleton chain',
      visibleFiles: [file('other', 'A'), file('only', 'A/B/C/D')],
      missing: ['A/B', 'A/B/C'],
      kept: ['A', 'A/B/C/D'],
    },
    {
      name: 'N10 two-File folder',
      visibleFiles: [
        file('other', 'A'),
        file('one', 'A/B'),
        file('two', 'A/B'),
      ],
      missing: [],
      kept: ['A', 'A/B'],
    },
    {
      name: 'N11 File plus child-folder parent',
      visibleFiles: [
        file('one', 'A'),
        file('two', 'A/B'),
        file('three', 'A/B'),
      ],
      missing: [],
      kept: ['A', 'A/B'],
    },
    {
      name: 'N12 two child folders keep parent',
      visibleFiles: [
        file('b1', 'A/B'),
        file('b2', 'A/B'),
        file('c1', 'A/C'),
        file('c2', 'A/C'),
      ],
      missing: [],
      kept: ['A', 'A/B', 'A/C'],
    },
  ])(
    '$name compresses only ancestor pass-through folders',
    ({ visibleFiles, missing, kept }) => {
      const tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles });
      for (const key of missing) expect(folders(tree)).not.toContain(key);
      for (const key of kept) expect(folders(tree)).toContain(key);
    },
  );

  it('L4-L7 derives depth from the current displayed tree after compression', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [
        file('outer', 'A'),
        file('b1', 'A/B/C/D'),
        file('b2', 'A/B/C/D'),
      ],
    });
    expect(
      tree.folders.map(({ folderKey, displayDepth }) => ({
        folderKey,
        displayDepth,
      })),
    ).toEqual([
      { folderKey: '.', displayDepth: 0 },
      { folderKey: 'A', displayDepth: 1 },
      { folderKey: 'A/B/C/D', displayDepth: 2 },
    ]);
  });

  it('N13 keeps an immediate folder after visibility changes while N14 Heading disclosure changes nothing', () => {
    const all = [
      file('outer', 'A'),
      file('one', 'A/B'),
      file('two', 'A/B'),
      file('hidden-intent', 'A/B'),
    ];
    const intent = {
      fileParentOverrides: [
        { fileId: 'hidden-intent', displayParentFolderKey: 'A' },
      ],
      flattenedFolderKeys: [],
    } as const;
    const before = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: all,
      intent,
    });
    const hidden = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: all.slice(0, 2),
      intent,
    });
    const disclosureOnly = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [...all],
      intent,
    });
    expect(folders(before)).toContain('A/B');
    expect(folders(hidden)).toContain('A/B');
    expect(hidden.reconciledIntent).toEqual(intent);
    expect(disclosureOnly).toEqual(before);
  });

  it('N15 preserves manual provenance without auto-compressing a direct folder', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [file('other', 'A'), file('only', 'A/B/C')],
      intent: {
        fileParentOverrides: [
          { fileId: 'only', displayParentFolderKey: 'A/B' },
        ],
        flattenedFolderKeys: [],
      },
    });
    expect(
      tree.files.find(({ fileId }) => fileId === 'only')?.provenance,
    ).toEqual(['exact', 'manual-file-promotion']);
  });

  it('N17 reconciles stale and non-ancestor intent without fuzzy migration', () => {
    expect(
      reconcileFocusSchematicSoftFolderDisplayIntent(
        {
          fileParentOverrides: [
            { fileId: 'gone', displayParentFolderKey: 'A' },
            { fileId: 'a', displayParentFolderKey: 'Elsewhere' },
            { fileId: 'b', displayParentFolderKey: 'A' },
          ],
          flattenedFolderKeys: ['Gone', 'A/B'],
        },
        [file('a', 'A/B'), file('b', 'A/B')],
      ),
    ).toEqual({
      fileParentOverrides: [{ fileId: 'b', displayParentFolderKey: 'A' }],
      flattenedFolderKeys: ['A/B'],
    });
  });

  it('bounds each File hierarchy-force budget for H0/H1/H2', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [file('a', 'A'), file('b', 'A/B'), file('c', 'A/B')],
    });
    for (const policy of [
      'nearest-only',
      'normalized-decay',
      'normalized-equal',
    ] as const)
      for (const base of [3, 4] as const) {
        const memberships = focusSchematicSoftFolderScopeMemberships(
          tree,
          policy,
          base,
        );
        for (const values of memberships.values())
          expect(
            values.reduce((sum, { weight }) => sum + weight, 0),
          ).toBeCloseTo(1);
      }
  });

  it('normalizes 1/3 and 1/4 ancestor decay and supports nearest-only membership', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [
        file('outer', 'A'),
        file('middle', 'A/B'),
        file('deep-a', 'A/B/C'),
        file('deep-b', 'A/B/C'),
      ],
    });
    const thirds = focusSchematicSoftFolderScopeMemberships(
      tree,
      'normalized-decay',
      3,
    ).get('deep-a')!;
    expect(thirds.map(({ folderKey }) => folderKey)).toEqual([
      'A/B/C',
      'A/B',
      'A',
    ]);
    expect(thirds[0]!.weight).toBeCloseTo(9 / 13);
    expect(thirds[1]!.weight).toBeCloseTo(3 / 13);
    expect(thirds[2]!.weight).toBeCloseTo(1 / 13);
    const fourths = focusSchematicSoftFolderScopeMemberships(
      tree,
      'normalized-decay',
      4,
    ).get('deep-a')!;
    expect(fourths[0]!.weight).toBeCloseTo(16 / 21);
    expect(fourths[1]!.weight).toBeCloseTo(4 / 21);
    expect(fourths[2]!.weight).toBeCloseTo(1 / 21);
    expect(
      focusSchematicSoftFolderScopeMemberships(tree, 'nearest-only', 4).get(
        'deep-a',
      ),
    ).toEqual([{ folderKey: 'A/B/C', weight: 1 }]);
  });

  it('D1-D3 keeps the immediate displayed parent before ancestor compression for Direct scope', () => {
    const chain = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [file('only', 'A/B/C')],
    });
    expect(chain.files[0]).toMatchObject({
      displayParentFolderKey: 'A/B/C',
      directDisplayParentFolderKey: 'A/B/C',
    });
    expect(
      chain.preCompressionFolders.map(({ folderKey }) => folderKey),
    ).toEqual(['.', 'A', 'A/B', 'A/B/C']);
    expect(
      focusSchematicSoftFolderScopeMemberships(chain, 'nearest-only').get(
        'only',
      ),
    ).toEqual([{ folderKey: 'A/B/C', weight: 1 }]);

    const parentAndChild = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [
        file('parent-file', 'Folder2'),
        file('child-file', 'Folder2/Folder1'),
      ],
    });
    const direct = focusSchematicSoftFolderScopeMemberships(
      parentAndChild,
      'nearest-only',
    );
    expect(direct.get('parent-file')).toEqual([
      { folderKey: 'Folder2', weight: 1 },
    ]);
    expect(direct.get('child-file')).toEqual([
      { folderKey: 'Folder2/Folder1', weight: 1 },
    ]);
  });

  it('D4-D6 applies promotion and flattening before Direct scope while preserving genuine root membership', () => {
    const promoted = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [file('promoted', 'A/B/C')],
      intent: {
        fileParentOverrides: [
          { fileId: 'promoted', displayParentFolderKey: 'A/B' },
        ],
        flattenedFolderKeys: [],
      },
    });
    expect(promoted.files[0]?.directDisplayParentFolderKey).toBe('A/B');

    const flattened = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [file('one', 'A/B'), file('two', 'A/B')],
      intent: {
        fileParentOverrides: [],
        flattenedFolderKeys: ['A/B'],
      },
    });
    expect(
      flattened.files.map(
        ({ directDisplayParentFolderKey }) => directDisplayParentFolderKey,
      ),
    ).toEqual(['A', 'A']);
    expect(
      focusSchematicSoftFolderScopeMemberships(flattened, 'nearest-only').get(
        'one',
      ),
    ).toEqual([{ folderKey: 'A', weight: 1 }]);

    const genuineRoot = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [file('root-file', '.')],
    });
    expect(genuineRoot.files[0]?.directDisplayParentFolderKey).toBe('.');
    expect(
      focusSchematicSoftFolderScopeMemberships(genuineRoot, 'nearest-only').get(
        'root-file',
      ),
    ).toEqual([]);
  });

  it('keeps Nested membership based on the final displayed hierarchy', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [
        file('outer', 'A'),
        file('deep-a', 'A/B/C'),
        file('deep-b', 'A/B/C'),
      ],
    });
    expect(
      focusSchematicSoftFolderScopeMemberships(tree, 'normalized-equal').get(
        'deep-a',
      ),
    ).toEqual([
      { folderKey: 'A/B/C', weight: 0.5 },
      { folderKey: 'A', weight: 0.5 },
    ]);
  });

  it('remains deterministic under deep chains, many singleton folders, and sparse manual intent', () => {
    const deepFolder = Array.from(
      { length: 10 },
      (_, index) => `D${index + 1}`,
    ).join('/');
    const visibleFiles = [
      file('deep', deepFolder),
      file('deep-sibling', 'D1'),
      ...Array.from({ length: 100 }, (_, index) =>
        file(`singleton-${index}`, `Groups/G${index}`),
      ),
    ];
    const intent = {
      fileParentOverrides: Array.from({ length: 40 }, (_, index) => ({
        fileId: `singleton-${index}`,
        displayParentFolderKey: 'Groups',
      })),
      flattenedFolderKeys: Array.from(
        { length: 20 },
        (_, index) => `Groups/G${index + 40}`,
      ),
    } as const;
    const first = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles,
      intent,
    });
    const second = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles,
      intent,
    });

    expect(second).toEqual(first);
    expect(first.files).toHaveLength(102);
    expect(
      Math.max(...first.folders.map(({ displayDepth }) => displayDepth)),
    ).toBeLessThanOrEqual(2);
    expect(first.reconciledIntent).toEqual(
      canonicalFocusSchematicSoftFolderDisplayIntent(intent),
    );
  });
});
