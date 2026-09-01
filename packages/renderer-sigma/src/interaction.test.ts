import { describe, expect, it } from 'vitest';

import { GLOBAL_INTERACTION_OPERATION_CONTRACTS } from './interaction-contract';
import {
  GLOBAL_ZOOM_SENSITIVITY,
  normalizeWheelDeltaPixels,
  ratioAfterWheelDelta,
  WheelDirectionStabilizer,
} from './precision-wheel-zoom';
import { resolveGlobalLayoutSettings } from './settings';
import {
  resolveGlobalEdgeStyle,
  resolveGlobalNodeStyle,
  resolveGlobalVisualLod,
} from './style';
import type { GlobalEdgeAttributes, GlobalNodeAttributes } from './types';

const node: GlobalNodeAttributes = {
  x: 0,
  y: 0,
  size: 4,
  color: '#123456',
  label: 'Alpha',
  nodeKind: 'document',
  entityId: 'doc-a',
  sourcePath: 'A.md',
  status: null,
  folderKey: '.',
  revealableDescendantCount: 0,
};
const edge: GlobalEdgeAttributes = {
  size: 1,
  color: '#555555',
  edgeKind: 'reference',
  status: 'resolved',
  referenceCount: 1,
};

describe('Global visual interactions', () => {
  it.each([
    'zoom',
    'pan',
    'hover',
    'selection',
    'visual-group-style-change',
    'inspector',
  ] as const)(
    '%s does not reproject, reconcile topology, or request layout',
    (interaction) => {
      expect(GLOBAL_INTERACTION_OPERATION_CONTRACTS[interaction]).toMatchObject(
        {
          projection: 0,
          graphReconciliation: 0,
          layoutRequest: 0,
        },
      );
    },
  );

  it('requests layout only for semantic, folder, settings, or explicit layout changes', () => {
    const layoutTriggers = Object.entries(
      GLOBAL_INTERACTION_OPERATION_CONTRACTS,
    )
      .filter(([, operations]) => operations.layoutRequest === 1)
      .map(([interaction]) => interaction);
    expect(layoutTriggers).toEqual([
      'projection-change',
      'folder-assignment-change',
      'layout-settings-change',
      'source-topology-change',
      'explicit-relayout',
    ]);
  });

  it('has explicit far, regional, and near visual LOD thresholds', () => {
    expect(resolveGlobalVisualLod(2)).toBe('far');
    expect(resolveGlobalVisualLod(0.8)).toBe('regional');
    expect(resolveGlobalVisualLod(0.2)).toBe('near');
    expect(
      resolveGlobalNodeStyle(node, {
        hovered: false,
        relatedToHover: true,
        selected: false,
        lod: 'far',
        settings: resolveGlobalLayoutSettings({
          folderClustering: true,
          spacingPreset: 'normal',
        }),
      }).label,
    ).toBe('');
    expect(
      resolveGlobalEdgeStyle(edge, {
        hoverActive: false,
        relatedToHover: true,
        lod: 'far',
      }).hidden,
    ).toBe(true);
  });

  it('preserves precise tiny movement and suppresses short reversal tails', () => {
    expect(GLOBAL_ZOOM_SENSITIVITY).toBe(0.0017);
    expect(normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: 0.01 }, 800)).toBe(
      0.5,
    );
    expect(ratioAfterWheelDelta(1, 0.5)).toBeGreaterThan(1);
    const stabilizer = new WheelDirectionStabilizer();
    expect(stabilizer.stabilize(-2, 0)).toBe(-2);
    expect(stabilizer.stabilize(1, 50)).toBe(0);
    expect(stabilizer.stabilize(1, 141)).toBe(1);
  });

  it('applies hover and selection only through styling', () => {
    const settings = resolveGlobalLayoutSettings({
      folderClustering: true,
      spacingPreset: 'normal',
    });
    const selected = resolveGlobalNodeStyle(node, {
      hovered: false,
      relatedToHover: true,
      selected: true,
      lod: 'far',
      settings,
    });
    expect(selected.forceLabel).toBe(true);
    expect(selected.x).toBe(node.x);
    expect(selected.y).toBe(node.y);
  });
});
