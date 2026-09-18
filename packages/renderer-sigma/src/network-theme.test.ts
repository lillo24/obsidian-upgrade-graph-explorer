import { describe, expect, it } from 'vitest';

import {
  interpolateNetworkEdgeColor,
  networkThemeFor,
  OBSIDIAN_DARK_NETWORK_THEME,
  OBSIDIAN_LIGHT_NETWORK_THEME,
  resolveIncidentEdgeColor,
} from './network-theme';

describe('Obsidian Network themes', () => {
  it('keeps the resolved Obsidian 1.11.5 light palette exact', () => {
    expect(OBSIDIAN_LIGHT_NETWORK_THEME).toMatchObject({
      id: 'obsidian-light',
      background: '#ffffff',
      edge: '#d4d4d4',
      hierarchyEdge: '#ababab',
      focusedNode: '#8a5cf5',
      highlight: '#9873f7',
      label: '#222222',
      node: '#5c5c5c',
      unresolvedNode: 'rgba(171, 171, 171, 0.5)',
      unresolvedNodeBase: '#ababab',
      tagNode: '#08b94e',
      attachmentNode: '#e0ac00',
    });
  });

  it('keeps the approved dark palette visually compatible', () => {
    expect(OBSIDIAN_DARK_NETWORK_THEME).toMatchObject({
      id: 'obsidian-dark',
      background: '#1e1e1e',
      edge: '#3f3f3f',
      hierarchyEdge: '#666666',
      focusedNode: '#a68af9',
      highlight: '#8a5cf5',
      label: '#dadada',
      node: '#b3b3b3',
      unresolvedNode: 'rgba(102, 102, 102, 0.5)',
      unresolvedNodeBase: '#666666',
      tagNode: '#44cf6e',
      attachmentNode: '#e0de71',
    });
  });

  it('selects one shared immutable palette by resolved app theme', () => {
    expect(networkThemeFor('light')).toBe(OBSIDIAN_LIGHT_NETWORK_THEME);
    expect(networkThemeFor('dark')).toBe(OBSIDIAN_DARK_NETWORK_THEME);
  });

  it('uses each accent for neutral incident edges', () => {
    expect(
      resolveIncidentEdgeColor('#3f3f3f', OBSIDIAN_DARK_NETWORK_THEME),
    ).toBe('#8a5cf5');
    expect(
      resolveIncidentEdgeColor('#666666', OBSIDIAN_DARK_NETWORK_THEME),
    ).toBe('#8a5cf5');
    expect(
      resolveIncidentEdgeColor('#d4d4d4', OBSIDIAN_LIGHT_NETWORK_THEME),
    ).toBe('#9873f7');
    expect(
      resolveIncidentEdgeColor('#ababab', OBSIDIAN_LIGHT_NETWORK_THEME),
    ).toBe('#9873f7');
  });

  it('moves semantic hues toward contrast instead of always toward white', () => {
    expect(
      resolveIncidentEdgeColor('#123456', OBSIDIAN_DARK_NETWORK_THEME),
    ).toBe('#546d85');
    expect(
      resolveIncidentEdgeColor('#123456', OBSIDIAN_LIGHT_NETWORK_THEME),
    ).toBe('#0f2b47');
  });

  it('keeps hover progress identical while using theme-specific targets', () => {
    expect(
      interpolateNetworkEdgeColor('#3f3f3f', 0.5, OBSIDIAN_DARK_NETWORK_THEME),
    ).toBe('#654e9a');
    expect(
      interpolateNetworkEdgeColor('#d4d4d4', 0.5, OBSIDIAN_LIGHT_NETWORK_THEME),
    ).toBe('#b6a4e6');
    expect(
      interpolateNetworkEdgeColor('#123456', 0.5, OBSIDIAN_LIGHT_NETWORK_THEME),
    ).toBe('#11304f');
  });
});
