import type {
  LocalEdgeAttributes,
  LocalNodeAttributes,
  LocalVisualLod,
} from './local-types';
import type { VisualGroupNodePresentation } from '@icarus-graph-explorer/visual-groups';
import { resolveNetworkHoverEdgeWidthMultiplier } from './network-hover';
import { applyNetworkNodeSizeScale } from './node-size';
import {
  interpolateNetworkEdgeColor,
  type NetworkTheme,
  networkThemeFor,
} from './network-theme';

const KNOWN_NETWORK_THEMES = [
  networkThemeFor('light'),
  networkThemeFor('dark'),
] as const;

export function resolveLocalVisualLod(cameraRatio: number): LocalVisualLod {
  if (!Number.isFinite(cameraRatio) || cameraRatio <= 0) {
    throw new Error('Local camera ratio must be a positive finite number.');
  }
  if (cameraRatio > 1.25) return 'far-local';
  if (cameraRatio > 0.42) return 'normal-local';
  return 'near-local';
}

function localNodeThemeColor(
  attributes: LocalNodeAttributes,
  theme: NetworkTheme,
): string {
  const colorForKind = (palette: NetworkTheme) =>
    attributes.nodeKind === 'document'
      ? palette.node
      : attributes.nodeKind === 'section'
        ? palette.sectionNode
        : attributes.nodeKind === 'block'
          ? palette.blockNode
          : attributes.status === 'unresolved'
            ? palette.unresolvedNode
            : attributes.status === 'ambiguous'
              ? palette.diagnosticAmbiguous
              : attributes.status === 'invalid'
                ? palette.diagnosticInvalid
                : palette.node;
  return KNOWN_NETWORK_THEMES.some(
    (palette) => attributes.color === colorForKind(palette),
  )
    ? colorForKind(theme)
    : attributes.color;
}

export function resolveLocalNodeStyle(
  attributes: LocalNodeAttributes,
  context: {
    readonly hovered: boolean;
    readonly relatedToHover: boolean;
    readonly selected: boolean;
    readonly lod: LocalVisualLod;
    readonly visualGroup?: VisualGroupNodePresentation;
    readonly sizeScale?: number;
    /** Shared Network Base node size relative to the established Focus default. */
    readonly baseNodeSizeScale?: number;
    readonly theme?: NetworkTheme;
  },
) {
  const theme = context.theme ?? networkThemeFor('dark');
  const emphasized = context.selected || context.hovered;
  const themeColor = localNodeThemeColor(attributes, theme);
  const baseColor =
    attributes.nodeKind !== 'diagnostic' && attributes.entityId !== null
      ? (context.visualGroup?.accent ?? themeColor)
      : themeColor;
  const labelVisible =
    emphasized ||
    attributes.root ||
    context.lod === 'near-local' ||
    (context.lod === 'normal-local' && attributes.nodeKind !== 'block') ||
    (context.lod === 'far-local' && attributes.nodeKind === 'document');
  const automaticSize = attributes.size * (context.baseNodeSizeScale ?? 1);
  const size =
    attributes.nodeKind === 'document' && attributes.entityId !== null
      ? applyNetworkNodeSizeScale(
          automaticSize,
          context.sizeScale,
          attributes.root,
        )
      : automaticSize;
  return {
    ...attributes,
    size,
    networkLabelLogicalSize: size,
    color: context.selected
      ? theme.focusedNode
      : context.hovered
        ? theme.highlight
        : attributes.root
          ? theme.focusedNode
          : baseColor,
    forceLabel: emphasized || attributes.root,
    highlighted: emphasized,
    label: labelVisible ? attributes.label : '',
    zIndex: emphasized || attributes.root ? 2 : 0,
  };
}

export function resolveLocalEdgeStyle(
  attributes: LocalEdgeAttributes,
  context: {
    readonly hoverProgress: number;
    readonly lod: LocalVisualLod;
    /** Shared Network Link thickness relative to the established Focus default. */
    readonly linkThicknessScale?: number;
    readonly theme?: NetworkTheme;
  },
) {
  const theme = context.theme ?? networkThemeFor('dark');
  const hierarchy = attributes.edgeKind === 'hierarchy';
  const expectedColors = KNOWN_NETWORK_THEMES.map((palette) => palette.edge);
  const baseColor = hierarchy
    ? theme.hierarchyEdge
    : expectedColors.includes(attributes.color)
      ? theme.edge
      : attributes.color;
  return {
    ...attributes,
    color: interpolateNetworkEdgeColor(baseColor, context.hoverProgress, theme),
    // Focus is already a bounded projection: far LOD simplifies styling, never
    // removes its reference relationships. All Network has a separate policy.
    hidden: false,
    size:
      attributes.size *
      (context.linkThicknessScale ?? 1) *
      (context.lod === 'far-local'
        ? hierarchy
          ? 0.72
          : 0.45
        : context.lod === 'normal-local'
          ? 0.84
          : 1) *
      resolveNetworkHoverEdgeWidthMultiplier(context.hoverProgress),
    zIndex: context.hoverProgress > 0 ? 1 : 0,
  };
}
