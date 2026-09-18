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
  OBSIDIAN_DARK_NETWORK_THEME,
} from './network-theme';

export function resolveLocalVisualLod(cameraRatio: number): LocalVisualLod {
  if (!Number.isFinite(cameraRatio) || cameraRatio <= 0) {
    throw new Error('Local camera ratio must be a positive finite number.');
  }
  if (cameraRatio > 1.25) return 'far-local';
  if (cameraRatio > 0.42) return 'normal-local';
  return 'near-local';
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
  },
) {
  const emphasized = context.selected || context.hovered;
  const baseColor =
    attributes.nodeKind !== 'diagnostic' && attributes.entityId !== null
      ? (context.visualGroup?.accent ?? attributes.color)
      : attributes.color;
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
      ? OBSIDIAN_DARK_NETWORK_THEME.focusedNode
      : context.hovered
        ? OBSIDIAN_DARK_NETWORK_THEME.highlight
        : attributes.root
          ? OBSIDIAN_DARK_NETWORK_THEME.focusedNode
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
  },
) {
  const hierarchy = attributes.edgeKind === 'hierarchy';
  const baseColor = hierarchy
    ? OBSIDIAN_DARK_NETWORK_THEME.hierarchyEdge
    : attributes.color;
  return {
    ...attributes,
    color: interpolateNetworkEdgeColor(baseColor, context.hoverProgress),
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
