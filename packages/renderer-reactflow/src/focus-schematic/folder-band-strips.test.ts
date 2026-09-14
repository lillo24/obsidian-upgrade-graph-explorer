import { describe, expect, it } from 'vitest';
import type {
  FocusSchematicFolderBand,
  FocusSchematicFolderBandPlan,
} from '@icarus-graph-explorer/focus-schematic-layout';

import {
  focusSchematicDirectionalFolderOverlay,
  focusSchematicFolderStrips,
} from './folder-band-strips';
import type { GraphFlowNode } from '../types';

const bands = [
  {
    folderKey: '.',
    root: true,
    order: 0,
    topY: -60,
    bottomY: 60,
    centerY: 0,
    height: 120,
    moduleIds: ['root'],
    requiredHeight: 120,
    baselineMedianCenterY: 0,
    singleton: true,
  },
  {
    folderKey: 'research',
    root: false,
    order: 1,
    topY: 90,
    bottomY: 250,
    centerY: 170,
    height: 160,
    moduleIds: ['research-a', 'research-b'],
    requiredHeight: 160,
    baselineMedianCenterY: 170,
    singleton: false,
  },
] satisfies readonly FocusSchematicFolderBand[];

const nodes = [
  { id: 'module-root', position: { x: -200, y: -40 }, width: 260, height: 90 },
  {
    id: 'module-research',
    position: { x: 110, y: 100 },
    width: 190,
    height: 130,
  },
] as unknown as readonly GraphFlowNode[];

describe('Focus Schematic folder-band strips', () => {
  it('copies exact plan Y geometry, retains singleton/root bands, and shares one renderer extent', () => {
    const strips = focusSchematicFolderStrips(bands, nodes);

    expect(strips).toEqual([
      expect.objectContaining({
        folderKey: '.',
        label: 'Root folder',
        root: true,
        singleton: true,
        topY: -60,
        bottomY: 60,
        centerY: 0,
        height: 120,
        x: -248,
        width: 596,
      }),
      expect.objectContaining({
        folderKey: 'research',
        label: 'research',
        root: false,
        singleton: false,
        topY: 90,
        bottomY: 250,
        centerY: 170,
        height: 160,
        x: -248,
        width: 596,
      }),
    ]);
  });

  it('renders nothing when the computed plan exposes no visible bands', () => {
    expect(focusSchematicFolderStrips([], nodes)).toEqual([]);
  });

  it('keeps the normalized label outside the module-filled band interior', () => {
    const [root] = focusSchematicFolderStrips(bands, nodes);
    expect(root?.label).toBe('Root folder');
    expect(root?.topY).toBe(-60);
  });

  it('uses worker-owned parent/child geometry and relative nested labels', () => {
    const plan = {
      schemaVersion: 4,
      enabled: true,
      rootFolderKey: '.',
      folderOrder: ['.', 'A'],
      bands,
      modulePlacements: [],
      exceptions: [],
      rootBalance: null,
      optimization: null,
      hierarchy: {
        schemaVersion: 1,
        maximumNestedDepth: 1,
        rootBandFolderKey: '.',
        topLevelUnits: [
          {
            id: 'root-band:.',
            kind: 'root-band',
            folderKey: '.',
            order: 0,
            topY: -60,
            bottomY: 60,
            centerY: 0,
            height: 120,
            moduleIds: ['root'],
          },
          {
            id: 'parent:A',
            kind: 'parent-container',
            folderKey: 'A',
            order: 1,
            topY: 90,
            bottomY: 310,
            centerY: 200,
            height: 220,
            moduleIds: ['research-a', 'research-b'],
          },
        ],
        parentContainers: [
          {
            id: 'parent:A',
            folderKey: 'A',
            label: 'A',
            fullLabel: 'A',
            topY: 90,
            bottomY: 310,
            centerY: 200,
            height: 220,
            x: -220,
            width: 540,
            initialInternalUnitIds: ['child:A:A/B', 'child:A:A/C'],
            internalUnitIds: ['child:A:A/B', 'child:A:A/C'],
            moduleIds: ['research-a', 'research-b'],
          },
        ],
        internalUnits: [
          {
            id: 'child:A:A/B',
            kind: 'child-band',
            folderKey: 'A/B',
            parentContainerId: 'parent:A',
            label: 'B',
            fullLabel: 'A/B',
            order: 0,
            topY: 114,
            bottomY: 184,
            centerY: 149,
            height: 70,
            x: -204,
            width: 508,
            moduleIds: ['research-a'],
          },
          {
            id: 'child:A:A/C',
            kind: 'child-band',
            folderKey: 'A/C',
            parentContainerId: 'parent:A',
            label: 'C',
            fullLabel: 'A/C',
            order: 1,
            topY: 220,
            bottomY: 286,
            centerY: 253,
            height: 66,
            x: -204,
            width: 508,
            moduleIds: ['research-b'],
          },
        ],
        modulePlacements: [],
        summary: {
          visibleExactFolderCount: 3,
          parentContainerCount: 1,
          childBandCount: 2,
          standaloneBandCount: 0,
          simplifiedSingletonChildCount: 0,
          topLevelOrderingCandidateCount: 4,
          parentLocalOrderingSweepCount: 4,
          parentLocalOrderingChangeCount: 0,
          maximumNestedDepth: 1,
        },
      },
      summary: {
        visibleFolderCount: 3,
        visibleModuleCount: 3,
        satisfiedModuleCount: 3,
        exceptionModuleCount: 0,
        satisfactionRatio: 1,
        rootFolderVisibleModuleCount: 1,
        filteredExcludedModuleCount: 0,
      },
    } satisfies FocusSchematicFolderBandPlan;

    const overlay = focusSchematicDirectionalFolderOverlay(plan, nodes);
    expect(overlay.parents).toEqual([
      expect.objectContaining({ folderKey: 'A', label: 'A', x: -220 }),
    ]);
    expect(overlay.bands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          folderKey: '.',
          label: 'Root folder',
          nested: false,
        }),
        expect.objectContaining({
          folderKey: 'A/B',
          label: 'B',
          nested: true,
          x: -204,
        }),
        expect.objectContaining({ folderKey: 'A/C', label: 'C' }),
      ]),
    );
  });
});
