import { describe, expect, it } from 'vitest';

import {
  interpolateNetworkEdgeColor,
  NETWORK_GRAPH_THEME_ID,
  OBSIDIAN_DARK_NETWORK_THEME,
  resolveIncidentEdgeColor,
} from './network-theme';

describe('Obsidian dark Network theme', () => {
  it('keeps the resolved Obsidian 1.11.5 base palette explicit', () => {
    expect(OBSIDIAN_DARK_NETWORK_THEME).toMatchObject({
      background: '#1e1e1e',
      edge: '#3f3f3f',
      focusedNode: '#a68af9',
      highlight: '#8a5cf5',
      label: '#dadada',
      node: '#b3b3b3',
      unresolvedNode: 'rgba(102, 102, 102, 0.5)',
      unresolvedNodeBase: '#666666',
    });
  });

  it('exposes one shared canvas theme marker', () => {
    expect(NETWORK_GRAPH_THEME_ID).toBe('obsidian-dark');
  });

  it('uses the accent for neutral incident edges and preserves semantic hue', () => {
    expect(resolveIncidentEdgeColor('#3f3f3f')).toBe('#8a5cf5');
    expect(resolveIncidentEdgeColor('#666666')).toBe('#8a5cf5');
    expect(resolveIncidentEdgeColor('#123456')).toBe('#546d85');
  });

  it('interpolates incident edge colors continuously to their semantic target', () => {
    expect(interpolateNetworkEdgeColor('#3f3f3f', 0)).toBe('#3f3f3f');
    expect(interpolateNetworkEdgeColor('#3f3f3f', 0.5)).toBe('#654e9a');
    expect(interpolateNetworkEdgeColor('#3f3f3f', 1)).toBe('#8a5cf5');
    expect(interpolateNetworkEdgeColor('#123456', 0.5)).toBe('#33516e');
    expect(interpolateNetworkEdgeColor('#123456', 1)).toBe('#546d85');
    const neutralSteps = [0, 0.25, 0.5, 0.75, 1].map((progress) =>
      Number.parseInt(
        interpolateNetworkEdgeColor('#3f3f3f', progress).slice(1),
        16,
      ),
    );
    for (let index = 1; index < neutralSteps.length; index += 1) {
      expect(neutralSteps[index]).toBeGreaterThan(neutralSteps[index - 1]!);
    }
  });
});
