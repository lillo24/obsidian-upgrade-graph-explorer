import { describe, expect, it } from 'vitest';
import type { FocusSchematicFolderBand } from '@icarus-graph-explorer/focus-schematic-layout';

import { focusSchematicFolderStrips } from './folder-band-strips';
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
});
