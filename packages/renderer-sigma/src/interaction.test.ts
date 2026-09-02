import { describe, expect, it } from 'vitest';

import { GLOBAL_INTERACTION_OPERATION_CONTRACTS } from './interaction-contract';
import { LOCAL_INTERACTION_OPERATION_CONTRACTS } from './local-interaction-contract';
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
  shouldAlwaysShowGlobalLabels,
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

  it('preserves precise tiny movement and smooth repeated fine deltas', () => {
    expect(GLOBAL_ZOOM_SENSITIVITY).toBe(0.0017);
    const tinyDelta = normalizeWheelDeltaPixels(
      { deltaMode: 0, deltaY: 0.01 },
      800,
    );
    expect(tinyDelta).toBe(0.5);
    expect(ratioAfterWheelDelta(1, tinyDelta)).toBeGreaterThan(1);
    const repeatedFineRatio = Array.from({ length: 4 }).reduce<number>(
      (ratio) =>
        ratioAfterWheelDelta(
          ratio,
          normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: 0.5 }, 800),
        ),
      1,
    );
    expect(repeatedFineRatio).toBeCloseTo(
      ratioAfterWheelDelta(
        1,
        normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: 2 }, 800),
      ),
      12,
    );
  });

  it('keeps fine pixel input linear through the precision range', () => {
    expect(normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: 2 }, 800)).toBe(2);
    expect(normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: 8 }, 800)).toBe(8);
    expect(normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: -8 }, 800)).toBe(
      -8,
    );
  });

  it('compresses a coarse line-mode wheel notch to a modest step', () => {
    const normalized = normalizeWheelDeltaPixels(
      { deltaMode: 1, deltaY: 3 },
      800,
    );
    const nextRatio = ratioAfterWheelDelta(1, normalized);
    expect(normalized).toBeGreaterThan(8);
    expect(normalized).toBeLessThan(48);
    expect(nextRatio).toBeGreaterThan(1.03);
    expect(nextRatio).toBeLessThan(1.06);
  });

  it('compresses a coarse pixel-mode wheel event to a modest step', () => {
    const normalized = normalizeWheelDeltaPixels(
      { deltaMode: 0, deltaY: 100 },
      800,
    );
    const nextRatio = ratioAfterWheelDelta(1, normalized);
    expect(normalized).toBeLessThan(34);
    expect(nextRatio).toBeGreaterThan(1.03);
    expect(nextRatio).toBeLessThan(1.06);
  });

  it('keeps equivalent positive and negative events multiplicatively symmetric', () => {
    const positive = normalizeWheelDeltaPixels(
      { deltaMode: 0, deltaY: 100 },
      800,
    );
    const negative = normalizeWheelDeltaPixels(
      { deltaMode: 0, deltaY: -100 },
      800,
    );
    expect(negative).toBeCloseTo(-positive, 12);
    expect(
      ratioAfterWheelDelta(1, positive) * ratioAfterWheelDelta(1, negative),
    ).toBeCloseTo(1, 12);
  });

  it('bounds pathological events and rejects zero or non-finite input', () => {
    const positive = normalizeWheelDeltaPixels(
      { deltaMode: 0, deltaY: 10_000 },
      800,
    );
    const negative = normalizeWheelDeltaPixels(
      { deltaMode: 2, deltaY: -10_000 },
      800,
    );
    expect(positive).toBeLessThan(34);
    expect(negative).toBeGreaterThan(-34);
    expect(ratioAfterWheelDelta(1, positive)).toBeLessThan(1.061);
    expect(ratioAfterWheelDelta(1, negative)).toBeGreaterThan(1 / 1.061);
    expect(normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: 0 }, 800)).toBe(0);
    expect(
      normalizeWheelDeltaPixels({ deltaMode: 0, deltaY: Number.NaN }, 800),
    ).toBe(0);
    expect(
      normalizeWheelDeltaPixels(
        { deltaMode: 0, deltaY: Number.POSITIVE_INFINITY },
        800,
      ),
    ).toBe(0);
    expect(ratioAfterWheelDelta(1, 0)).toBe(1);
  });

  it('keeps short reversal-tail stabilization unchanged', () => {
    const stabilizer = new WheelDirectionStabilizer();
    expect(stabilizer.stabilize(-2, 0)).toBe(-2);
    expect(stabilizer.stabilize(1, 50)).toBe(0);
    expect(stabilizer.stabilize(1, 141)).toBe(1);
  });

  it('leaves the existing min/max ratio constraints to the Sigma camera', () => {
    expect(ratioAfterWheelDelta(6, 34)).toBeGreaterThan(6);
    expect(ratioAfterWheelDelta(0.02, -34)).toBeLessThan(0.02);
  });

  it('keeps All and Focus Network zoom camera-only', () => {
    expect(GLOBAL_INTERACTION_OPERATION_CONTRACTS.zoom).toMatchObject({
      projection: 0,
      graphReconciliation: 0,
      layoutRequest: 0,
    });
    expect(LOCAL_INTERACTION_OPERATION_CONTRACTS.zoom).toMatchObject({
      projection: 0,
      topologyReconciliation: 0,
      layoutRequest: 0,
      globalLayoutRequest: 0,
    });
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

  it('keeps labels legible for small Network results at regional zoom', () => {
    expect(shouldAlwaysShowGlobalLabels(1)).toBe(true);
    expect(shouldAlwaysShowGlobalLabels(12)).toBe(true);
    expect(shouldAlwaysShowGlobalLabels(13)).toBe(false);
    const styled = resolveGlobalNodeStyle(node, {
      alwaysShowLabel: true,
      hovered: false,
      relatedToHover: true,
      selected: false,
      lod: 'regional',
      settings: resolveGlobalLayoutSettings({
        folderClustering: true,
        spacingPreset: 'normal',
      }),
    });

    expect(styled.label).toBe('Alpha');
    expect(styled.forceLabel).toBe(true);
  });
});
