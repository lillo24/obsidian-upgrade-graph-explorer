import { describe, expect, it } from 'vitest';

import { GLOBAL_INTERACTION_OPERATION_CONTRACTS } from './interaction-contract';
import { LOCAL_INTERACTION_OPERATION_CONTRACTS } from './local-interaction-contract';
import {
  FINE_PINCH_ZOOM_SENSITIVITY,
  FINE_SCROLL_ZOOM_SENSITIVITY,
  GLOBAL_ZOOM_SENSITIVITY,
  isCoarseWheelDelta,
  normalizeWheelDeltaPixels,
  normalizeWheelPanDeltaPixels,
  preventSigmaWheelDefault,
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

interface TimedWheelDelta {
  readonly at: number;
  readonly ctrlKey?: boolean;
  readonly deltaMode?: number;
  readonly deltaY: number;
}

function applyWheelSequence(events: readonly TimedWheelDelta[]): {
  readonly appliedDeltas: readonly number[];
  readonly ratios: readonly number[];
} {
  const stabilizer = new WheelDirectionStabilizer();
  let ratio = 1;
  const appliedDeltas: number[] = [];
  const ratios: number[] = [];
  for (const event of events) {
    const deltaPixels = normalizeWheelDeltaPixels(
      { deltaMode: event.deltaMode ?? 0, deltaY: event.deltaY },
      800,
    );
    const applied = stabilizer.stabilize(
      deltaPixels,
      event.at,
      isCoarseWheelDelta(deltaPixels),
    );
    ratio = ratioAfterWheelDelta(ratio, applied, event.ctrlKey);
    appliedDeltas.push(applied);
    ratios.push(ratio);
  }
  return { appliedDeltas, ratios };
}

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

  it.each([
    'arrange-enter',
    'arrange-hover',
    'arrange-preview',
    'arrange-commit',
    'arrange-reset',
  ] as const)(
    '%s performs no projection, reconciliation, or layout',
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

  it('preserves many tiny same-direction deltas proportionally and monotonically', () => {
    expect(GLOBAL_ZOOM_SENSITIVITY).toBe(0.0017);
    expect(FINE_SCROLL_ZOOM_SENSITIVITY).toBe(0.0021);
    expect(FINE_PINCH_ZOOM_SENSITIVITY).toBe(0.012);
    const events = Array.from({ length: 40 }, (_, index) => ({
      at: index * 16.7,
      deltaY: 0.01 + index * 0.001,
    }));
    const { appliedDeltas, ratios } = applyWheelSequence(events);
    expect(appliedDeltas).toEqual(events.map(({ deltaY }) => deltaY));
    for (let index = 1; index < ratios.length; index += 1) {
      expect(ratios[index]).toBeGreaterThan(ratios[index - 1] ?? 0);
    }
    expect(ratios.at(-1)).toBeCloseTo(
      ratioAfterWheelDelta(
        1,
        events.reduce((sum, event) => sum + event.deltaY, 0),
      ),
      12,
    );
  });

  it('gives pinch stronger fine travel without changing the coarse-event gain', () => {
    expect(ratioAfterWheelDelta(1, 1)).toBeCloseTo(
      Math.exp(FINE_SCROLL_ZOOM_SENSITIVITY),
      12,
    );
    expect(ratioAfterWheelDelta(1, 1, true)).toBeCloseTo(
      Math.exp(FINE_PINCH_ZOOM_SENSITIVITY),
      12,
    );
    expect(ratioAfterWheelDelta(1, 8.01, true)).toBeCloseTo(
      Math.exp(8.01 * GLOBAL_ZOOM_SENSITIVITY),
      12,
    );
  });

  it('keeps short opposite-sign fine noise proportional instead of flooring or suppressing it', () => {
    const { appliedDeltas, ratios } = applyWheelSequence([
      { at: 0, deltaY: 0.25 },
      { at: 17, deltaY: 0.25 },
      { at: 34, deltaY: -0.01 },
      { at: 51, deltaY: 0.25 },
    ]);
    expect(appliedDeltas).toEqual([0.25, 0.25, -0.01, 0.25]);
    expect(ratios[2]).toBeCloseTo(
      ratioAfterWheelDelta(ratios[1] ?? 1, -0.01),
      12,
    );
    expect(ratios.at(-1)).toBeGreaterThan(ratios[1] ?? 1);
  });

  it('keeps very slow same-direction fine input proportional across long gaps', () => {
    const { appliedDeltas, ratios } = applyWheelSequence([
      { at: 0, deltaY: 0.000_012 },
      { at: 150, deltaY: 0.062_875 },
      { at: 700, deltaY: 0.253_731 },
      { at: 1_000, deltaY: 0.01 },
    ]);
    expect(appliedDeltas).toEqual([0.000_012, 0.062_875, 0.253_731, 0.01]);
    for (let index = 1; index < ratios.length; index += 1) {
      expect(ratios[index]).toBeGreaterThan(ratios[index - 1] ?? 0);
    }
    expect(ratios.at(-1)).toBeCloseTo(ratioAfterWheelDelta(1, 0.326_618), 12);
  });

  it('accepts an intentional fine-input direction reversal immediately', () => {
    const { appliedDeltas, ratios } = applyWheelSequence([
      { at: 0, deltaY: 0.25 },
      { at: 17, deltaY: 0.25 },
      { at: 34, deltaY: -0.25 },
      { at: 51, deltaY: -0.25 },
    ]);
    expect(appliedDeltas).toEqual([0.25, 0.25, -0.25, -0.25]);
    expect(ratios[2]).toBeLessThan(ratios[1] ?? 1);
    expect(ratios[3]).toBeLessThan(ratios[2] ?? 1);
    expect(ratios.at(-1)).toBeCloseTo(1, 12);
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

  it('normalizes two-axis line and page pan units against the viewport', () => {
    expect(
      normalizeWheelPanDeltaPixels(
        { deltaMode: 1, deltaX: -2, deltaY: 3 },
        { width: 1_200, height: 800 },
      ),
    ).toEqual({ x: -32, y: 48 });
    expect(
      normalizeWheelPanDeltaPixels(
        { deltaMode: 2, deltaX: -0.5, deltaY: 0.25 },
        { width: 1_200, height: 800 },
      ),
    ).toEqual({ x: -600, y: 200 });
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

  it('retains reversal-tail stabilization only for a coarse mouse-notch sequence', () => {
    const { appliedDeltas, ratios } = applyWheelSequence([
      { at: 0, deltaY: -100 },
      { at: 50, deltaY: 100 },
      { at: 141, deltaY: 100 },
    ]);
    expect(appliedDeltas[0]).toBeLessThan(-8);
    expect(appliedDeltas[1]).toBe(0);
    expect(appliedDeltas[2]).toBeGreaterThan(8);
    expect(ratios[1]).toBe(ratios[0]);
    expect(ratios[2]).toBeGreaterThan(ratios[1] ?? 0);
  });

  it('explicitly prevents Sigma 3.0.3 default wheel animation', () => {
    const coordinates = {
      sigmaDefaultPrevented: false,
      preventSigmaDefault() {
        // Reproduce Sigma 3.0.3's ineffective pre-spread closure.
      },
    };
    preventSigmaWheelDefault(coordinates);
    expect(coordinates.sigmaDefaultPrevented).toBe(true);
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

  it('layers arrangement emphasis after group color without changing size', () => {
    const settings = resolveGlobalLayoutSettings({
      folderClustering: true,
      spacingPreset: 'normal',
    });
    const member = resolveGlobalNodeStyle(node, {
      arrangementActive: true,
      arrangementMember: true,
      hovered: false,
      relatedToHover: true,
      selected: false,
      lod: 'far',
      settings,
      sizeScale: 1.8,
      visualGroup: {
        groupName: 'Research',
        color: 'teal',
        accent: '#0f766e',
      },
    });
    const unrelated = resolveGlobalNodeStyle(node, {
      arrangementActive: true,
      arrangementMember: false,
      hovered: false,
      relatedToHover: true,
      selected: false,
      lod: 'far',
      settings,
      sizeScale: 1.8,
      visualGroup: {
        groupName: 'Research',
        color: 'teal',
        accent: '#0f766e',
      },
    });
    expect(member.color).toBe('#0f766e');
    expect(member.forceLabel).toBe(true);
    expect(unrelated.color).toBe('#e1e6e7');
    expect(member.size).toBe(unrelated.size);
  });

  it('keeps internal and incident edges visible while fading unrelated edges', () => {
    const internal = resolveGlobalEdgeStyle(edge, {
      arrangementRelation: 'internal',
      hoverActive: false,
      relatedToHover: true,
      lod: 'far',
    });
    const incident = resolveGlobalEdgeStyle(edge, {
      arrangementRelation: 'boundary',
      hoverActive: false,
      relatedToHover: true,
      lod: 'far',
    });
    const unrelated = resolveGlobalEdgeStyle(edge, {
      arrangementRelation: 'unrelated',
      hoverActive: false,
      relatedToHover: true,
      lod: 'far',
    });
    expect(internal.hidden).toBe(false);
    expect(incident.hidden).toBe(false);
    expect(unrelated.hidden).toBe(false);
    expect(internal.size).toBeGreaterThan(incident.size);
    expect(incident.size).toBeGreaterThan(unrelated.size);
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
