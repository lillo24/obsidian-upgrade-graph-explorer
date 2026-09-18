import type {
  GlobalEdgeAttributes,
  GlobalNodeAttributes,
  GlobalVisualLod,
  ResolvedGlobalLayoutSettings,
} from './types';
import type { VisualGroupNodePresentation } from '@icarus-graph-explorer/visual-groups';
import type { FolderScopeVisualizationState } from '@icarus-graph-explorer/spatial-overrides';
import { resolveNetworkHoverEdgeWidthMultiplier } from './network-hover';
import { applyNetworkNodeSizeScale } from './node-size';
import {
  interpolateNetworkEdgeColor,
  OBSIDIAN_DARK_NETWORK_THEME,
} from './network-theme';

export const GLOBAL_ALWAYS_LABELED_NODE_LIMIT = 12;

export function shouldAlwaysShowGlobalLabels(nodeCount: number): boolean {
  return nodeCount > 0 && nodeCount <= GLOBAL_ALWAYS_LABELED_NODE_LIMIT;
}

export function resolveGlobalVisualLod(cameraRatio: number): GlobalVisualLod {
  if (!Number.isFinite(cameraRatio) || cameraRatio <= 0) {
    throw new Error('Global camera ratio must be a positive finite number.');
  }
  if (cameraRatio > 1.15) return 'far';
  if (cameraRatio > 0.38) return 'regional';
  return 'near';
}

export interface GlobalNodeStyleContext {
  readonly arrangementActive?: boolean;
  readonly arrangementMember?: boolean;
  readonly scopeState?: FolderScopeVisualizationState;
  readonly scopePulse?: boolean;
  readonly alwaysShowLabel?: boolean;
  readonly hovered: boolean;
  readonly relatedToHover: boolean;
  readonly selected: boolean;
  readonly lod: GlobalVisualLod;
  readonly settings: ResolvedGlobalLayoutSettings;
  readonly visualGroup?: VisualGroupNodePresentation;
  readonly sizeScale?: number;
  /** Current automatic display radius; Graphology keeps topology-stable size. */
  readonly automaticSize?: number;
}

export interface GlobalEdgeStyleContext {
  readonly arrangementRelation?:
    'internal' | 'boundary' | 'child-owned' | 'unrelated';
  readonly hoverProgress: number;
  readonly lod: GlobalVisualLod;
  /** Current automatic display width; layout edge weight remains independent. */
  readonly automaticSize?: number;
}

/** Built-in layer; future GROUP1 may contribute before this final interaction pass. */
export function resolveGlobalNodeStyle(
  attributes: GlobalNodeAttributes,
  context: GlobalNodeStyleContext,
) {
  // Global visual settings and per-File scale are presentation only.
  const automaticSize = context.automaticSize ?? attributes.size;
  const size =
    attributes.nodeKind === 'document' && attributes.entityId !== null
      ? applyNetworkNodeSizeScale(automaticSize, context.sizeScale)
      : automaticSize;
  const emphasized = context.selected || context.hovered;
  const arrangementFocused =
    context.arrangementActive === true &&
    (context.scopeState !== undefined ||
      context.arrangementMember !== undefined);
  const arrangementMember =
    context.scopeState === 'active-member' ||
    context.arrangementMember === true;
  const forceLabel =
    emphasized || arrangementMember || context.alwaysShowLabel === true;
  const baseColor =
    attributes.nodeKind === 'document' && attributes.entityId !== null
      ? (context.visualGroup?.accent ?? attributes.color)
      : attributes.color;
  const visibleByScale =
    context.lod === 'near' ||
    (context.lod === 'regional'
      ? size >= context.settings.labelThreshold * 0.68
      : size >= context.settings.labelThreshold);
  const color = arrangementFocused
    ? context.selected
      ? OBSIDIAN_DARK_NETWORK_THEME.focusedNode
      : context.hovered
        ? OBSIDIAN_DARK_NETWORK_THEME.highlight
        : arrangementMember
          ? baseColor
          : context.scopeState === undefined
            ? OBSIDIAN_DARK_NETWORK_THEME.dimmedNode
            : context.scopeState === 'shadowed-by-child'
              ? OBSIDIAN_DARK_NETWORK_THEME.scopeShadowed
              : context.scopeState === 'excluded-candidate'
                ? OBSIDIAN_DARK_NETWORK_THEME.scopeExcluded
                : OBSIDIAN_DARK_NETWORK_THEME.scopeInactive
    : context.selected
      ? OBSIDIAN_DARK_NETWORK_THEME.focusedNode
      : context.hovered
        ? OBSIDIAN_DARK_NETWORK_THEME.highlight
        : baseColor;
  return {
    ...attributes,
    size,
    networkLabelLogicalSize: size,
    color,
    forceLabel,
    highlighted:
      emphasized ||
      arrangementMember ||
      context.scopeState === 'shadowed-by-child' ||
      context.scopePulse === true,
    label: visibleByScale || forceLabel ? attributes.label : '',
    zIndex: emphasized ? 2 : 0,
  };
}

export function resolveGlobalEdgeStyle(
  attributes: GlobalEdgeAttributes,
  context: GlobalEdgeStyleContext,
) {
  const arrangementRelation = context.arrangementRelation;
  const arrangementActive = arrangementRelation !== undefined;
  const weakFarEdge = context.lod === 'far' && attributes.referenceCount === 1;
  const hoverProgress = arrangementActive ? 0 : context.hoverProgress;
  return {
    ...attributes,
    color: arrangementActive
      ? arrangementRelation === 'internal'
        ? attributes.color
        : arrangementRelation === 'boundary'
          ? OBSIDIAN_DARK_NETWORK_THEME.hierarchyEdge
          : arrangementRelation === 'child-owned'
            ? OBSIDIAN_DARK_NETWORK_THEME.scopeShadowed
            : OBSIDIAN_DARK_NETWORK_THEME.dimmedEdge
      : interpolateNetworkEdgeColor(attributes.color, hoverProgress),
    hidden: !arrangementActive && weakFarEdge && hoverProgress <= 0,
    size:
      (context.automaticSize ?? attributes.size) *
      (arrangementActive
        ? arrangementRelation === 'internal'
          ? 1.15
          : arrangementRelation === 'boundary'
            ? 0.82
            : arrangementRelation === 'child-owned'
              ? 0.72
              : 0.38
        : (context.lod === 'far'
            ? 0.55
            : context.lod === 'regional'
              ? 0.78
              : 1) * resolveNetworkHoverEdgeWidthMultiplier(hoverProgress)),
    zIndex:
      arrangementRelation === 'internal' ||
      arrangementRelation === 'boundary' ||
      arrangementRelation === 'child-owned' ||
      hoverProgress > 0
        ? 1
        : 0,
  };
}
