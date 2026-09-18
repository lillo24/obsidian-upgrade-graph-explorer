import { describe, expect, it } from 'vitest';
import { VISUAL_GROUP_PALETTE } from '@icarus-graph-explorer/visual-groups';

import type { GlobalNodeAttributes } from './types';
import type { LocalNodeAttributes } from './local-types';
import {
  OBSIDIAN_DARK_NETWORK_THEME,
  OBSIDIAN_LIGHT_NETWORK_THEME,
} from './network-theme';
import { resolveGlobalNodeStyle } from './style';
import { resolveLocalEdgeStyle, resolveLocalNodeStyle } from './local-style';
import { resolveGlobalLayoutSettings } from './settings';

const globalContext = {
  hovered: false,
  relatedToHover: true,
  selected: false,
  lod: 'near' as const,
  settings: resolveGlobalLayoutSettings({
    folderClustering: false,
    spacingPreset: 'normal',
  }),
};

const documentNode: GlobalNodeAttributes = {
  x: 0,
  y: 0,
  size: 5,
  color: OBSIDIAN_DARK_NETWORK_THEME.node,
  label: 'Document',
  nodeKind: 'document',
  entityId: 'doc',
  sourcePath: 'Document.md',
  status: null,
  folderKey: '',
  revealableDescendantCount: 0,
};

const diagnosticNode = (
  status: 'unresolved' | 'ambiguous' | 'invalid',
): GlobalNodeAttributes => ({
  ...documentNode,
  nodeKind: 'diagnostic',
  entityId: null,
  sourcePath: null,
  status,
});

const localNode = (
  nodeKind: LocalNodeAttributes['nodeKind'],
  status: LocalNodeAttributes['status'] = null,
): LocalNodeAttributes => ({
  x: 0,
  y: 0,
  size: 5,
  color:
    nodeKind === 'section'
      ? OBSIDIAN_DARK_NETWORK_THEME.sectionNode
      : nodeKind === 'block'
        ? OBSIDIAN_DARK_NETWORK_THEME.blockNode
        : nodeKind === 'diagnostic' && status === 'unresolved'
          ? OBSIDIAN_DARK_NETWORK_THEME.unresolvedNode
          : nodeKind === 'diagnostic' && status === 'ambiguous'
            ? OBSIDIAN_DARK_NETWORK_THEME.diagnosticAmbiguous
            : nodeKind === 'diagnostic' && status === 'invalid'
              ? OBSIDIAN_DARK_NETWORK_THEME.diagnosticInvalid
              : OBSIDIAN_DARK_NETWORK_THEME.node,
  label: nodeKind,
  nodeKind,
  entityId: nodeKind === 'diagnostic' ? null : nodeKind,
  sourcePath: nodeKind === 'diagnostic' ? null : `${nodeKind}.md`,
  status,
  root: false,
  revealableDescendantCount: 0,
});

describe('light Network style layers', () => {
  it('themes interaction, diagnostics, and Arrange scope without geometry changes', () => {
    const base = resolveGlobalNodeStyle(documentNode, {
      ...globalContext,
      theme: OBSIDIAN_LIGHT_NETWORK_THEME,
    });
    expect(base).toMatchObject({
      x: 0,
      y: 0,
      size: 5,
      color: OBSIDIAN_LIGHT_NETWORK_THEME.node,
    });
    expect(
      resolveGlobalNodeStyle(documentNode, {
        ...globalContext,
        selected: true,
        theme: OBSIDIAN_LIGHT_NETWORK_THEME,
      }).color,
    ).toBe(OBSIDIAN_LIGHT_NETWORK_THEME.focusedNode);
    expect(
      resolveGlobalNodeStyle(documentNode, {
        ...globalContext,
        arrangementActive: true,
        scopeState: 'shadowed-by-child',
        theme: OBSIDIAN_LIGHT_NETWORK_THEME,
      }).color,
    ).toBe(OBSIDIAN_LIGHT_NETWORK_THEME.scopeShadowed);
    expect(
      resolveGlobalNodeStyle(diagnosticNode('unresolved'), {
        ...globalContext,
        theme: OBSIDIAN_LIGHT_NETWORK_THEME,
      }).color,
    ).toBe(OBSIDIAN_LIGHT_NETWORK_THEME.unresolvedNode);
    expect(
      resolveGlobalNodeStyle(diagnosticNode('ambiguous'), {
        ...globalContext,
        theme: OBSIDIAN_LIGHT_NETWORK_THEME,
      }).color,
    ).toBe(OBSIDIAN_LIGHT_NETWORK_THEME.diagnosticAmbiguous);
    expect(
      resolveGlobalNodeStyle(diagnosticNode('invalid'), {
        ...globalContext,
        theme: OBSIDIAN_LIGHT_NETWORK_THEME,
      }).color,
    ).toBe(OBSIDIAN_LIGHT_NETWORK_THEME.diagnosticInvalid);
  });

  it('themes Focus semantic nodes and hierarchy/reference edges', () => {
    const context = {
      hovered: false,
      relatedToHover: true,
      selected: false,
      lod: 'near-local' as const,
      theme: OBSIDIAN_LIGHT_NETWORK_THEME,
    };
    expect(resolveLocalNodeStyle(localNode('document'), context).color).toBe(
      OBSIDIAN_LIGHT_NETWORK_THEME.node,
    );
    expect(resolveLocalNodeStyle(localNode('section'), context).color).toBe(
      OBSIDIAN_LIGHT_NETWORK_THEME.sectionNode,
    );
    expect(resolveLocalNodeStyle(localNode('block'), context).color).toBe(
      OBSIDIAN_LIGHT_NETWORK_THEME.blockNode,
    );
    expect(
      resolveLocalNodeStyle(localNode('diagnostic', 'invalid'), context).color,
    ).toBe(OBSIDIAN_LIGHT_NETWORK_THEME.diagnosticInvalid);
    expect(
      resolveLocalEdgeStyle(
        {
          size: 1,
          color: OBSIDIAN_DARK_NETWORK_THEME.edge,
          edgeKind: 'reference',
          weight: 1,
          referenceCount: 1,
        },
        {
          hoverProgress: 1,
          lod: 'near-local',
          theme: OBSIDIAN_LIGHT_NETWORK_THEME,
        },
      ).color,
    ).toBe(OBSIDIAN_LIGHT_NETWORK_THEME.highlight);
    expect(
      resolveLocalEdgeStyle(
        {
          size: 1,
          color: OBSIDIAN_DARK_NETWORK_THEME.hierarchyEdge,
          edgeKind: 'hierarchy',
          weight: 1,
          referenceCount: 0,
        },
        {
          hoverProgress: 0,
          lod: 'near-local',
          theme: OBSIDIAN_LIGHT_NETWORK_THEME,
        },
      ).color,
    ).toBe(OBSIDIAN_LIGHT_NETWORK_THEME.hierarchyEdge);
  });

  it('keeps persisted Visual Group accents and validates both backgrounds', () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map((start) =>
        Number.parseInt(hex.slice(start, start + 2), 16),
      );
      const [red, green, blue] = channels.map((channel) => {
        const value = channel! / 255;
        return value <= 0.03928
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
    };
    const contrast = (foreground: string, background: string) => {
      const first = luminance(foreground);
      const second = luminance(background);
      return (
        (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
      );
    };

    for (const entry of VISUAL_GROUP_PALETTE) {
      expect(
        contrast(entry.accent, OBSIDIAN_LIGHT_NETWORK_THEME.background),
      ).toBeGreaterThan(3);
      expect(
        contrast(entry.accent, OBSIDIAN_DARK_NETWORK_THEME.background),
      ).toBeGreaterThan(2.9);
    }
    expect(
      resolveGlobalNodeStyle(documentNode, {
        ...globalContext,
        theme: OBSIDIAN_LIGHT_NETWORK_THEME,
        visualGroup: {
          accent: '#7c3aed',
          color: 'violet',
          groupName: 'Persisted',
        },
      }).color,
    ).toBe('#7c3aed');
  });
});
