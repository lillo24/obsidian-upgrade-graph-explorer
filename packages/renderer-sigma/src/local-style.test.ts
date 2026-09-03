import { describe, expect, it } from 'vitest';
import {
  resolveLocalEdgeStyle,
  resolveLocalNodeStyle,
  resolveLocalVisualLod,
} from './local-style';
import type { LocalEdgeAttributes, LocalNodeAttributes } from './local-types';

const reference: LocalEdgeAttributes = {
  size: 2,
  color: '#367f83',
  edgeKind: 'reference',
  weight: 1,
  referenceCount: 1,
};

describe('Focus reference visibility', () => {
  // 0.02–6 is LocalRendererSession's supported camera interval; LOD thresholds stay unchanged.
  it.each([0.02, 0.42, 0.8, 1.25, 1.26, 2, 6])(
    'keeps references visible without hover at camera ratio %s',
    (ratio) => {
      const lod = resolveLocalVisualLod(ratio);
      const style = resolveLocalEdgeStyle(reference, {
        lod,
        relatedToHover: true,
        hoverActive: false,
      });
      expect(style.hidden).toBe(false);
      expect(style.size).toBeCloseTo(
        reference.size *
          (lod === 'far-local' ? 0.45 : lod === 'normal-local' ? 0.84 : 1),
      );
    },
  );

  it('retains far hover emphasis without hiding unrelated references', () => {
    const related = resolveLocalEdgeStyle(reference, {
      lod: 'far-local',
      relatedToHover: true,
      hoverActive: true,
    });
    const unrelated = resolveLocalEdgeStyle(reference, {
      lod: 'far-local',
      relatedToHover: false,
      hoverActive: true,
    });
    expect(related).toMatchObject({
      hidden: false,
      color: reference.color,
      zIndex: 1,
    });
    expect(unrelated).toMatchObject({
      hidden: false,
      color: '#e1e8ea',
      zIndex: 0,
    });
  });

  it('preserves hierarchy widths and non-reference emphasis', () => {
    const hierarchy = { ...reference, edgeKind: 'hierarchy' } as const;
    expect(
      resolveLocalEdgeStyle(hierarchy, {
        lod: 'far-local',
        relatedToHover: true,
        hoverActive: true,
      }),
    ).toMatchObject({ hidden: false, size: 1.44, color: '#7c8790', zIndex: 1 });
  });

  it('keeps far-local label simplification and root/selection emphasis', () => {
    const heading: LocalNodeAttributes = {
      x: 0,
      y: 0,
      size: 4,
      color: '#367f83',
      label: 'Heading',
      nodeKind: 'section',
      entityId: 'heading',
      sourcePath: 'A.md',
      status: null,
      root: false,
      revealableDescendantCount: 0,
    };
    const context = {
      lod: resolveLocalVisualLod(6),
      relatedToHover: true,
      hovered: false,
      selected: false,
    };
    expect(context.lod).toBe('far-local');
    expect(resolveLocalNodeStyle(heading, context).label).toBe('');
    expect(
      resolveLocalNodeStyle({ ...heading, root: true }, context).label,
    ).toBe('Heading');
    expect(
      resolveLocalNodeStyle(heading, { ...context, selected: true }).label,
    ).toBe('Heading');
    expect(
      resolveLocalNodeStyle(heading, { ...context, lod: 'near-local' }).label,
    ).toBe('Heading');
  });
});
