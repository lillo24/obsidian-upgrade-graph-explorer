import { describe, expect, it } from 'vitest';

import {
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
});
