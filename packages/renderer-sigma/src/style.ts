import type {
  GlobalEdgeAttributes,
  GlobalNodeAttributes,
  GlobalVisualLod,
  ResolvedGlobalLayoutSettings,
} from './types';
import type { VisualGroupNodePresentation } from '@icarus-graph-explorer/visual-groups';

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
  readonly alwaysShowLabel?: boolean;
  readonly hovered: boolean;
  readonly relatedToHover: boolean;
  readonly selected: boolean;
  readonly lod: GlobalVisualLod;
  readonly settings: ResolvedGlobalLayoutSettings;
  readonly visualGroup?: VisualGroupNodePresentation;
}

export interface GlobalEdgeStyleContext {
  readonly relatedToHover: boolean;
  readonly hoverActive: boolean;
  readonly lod: GlobalVisualLod;
}

/** Built-in layer; future GROUP1 may contribute before this final interaction pass. */
export function resolveGlobalNodeStyle(
  attributes: GlobalNodeAttributes,
  context: GlobalNodeStyleContext,
) {
  const emphasized = context.selected || context.hovered;
  const forceLabel = emphasized || context.alwaysShowLabel === true;
  const baseColor =
    attributes.nodeKind === 'document' && attributes.entityId !== null
      ? (context.visualGroup?.accent ?? attributes.color)
      : attributes.color;
  const visibleByScale =
    context.lod === 'near' ||
    (context.lod === 'regional'
      ? attributes.size >= context.settings.labelThreshold * 0.68
      : attributes.size >= context.settings.labelThreshold);
  const color = context.selected
    ? '#d7a126'
    : context.hovered
      ? '#55a8c2'
      : context.relatedToHover
        ? baseColor
        : '#d8e0e3';
  return {
    ...attributes,
    color,
    forceLabel,
    highlighted: emphasized,
    label: visibleByScale || forceLabel ? attributes.label : '',
    zIndex: emphasized ? 2 : 0,
  };
}

export function resolveGlobalEdgeStyle(
  attributes: GlobalEdgeAttributes,
  context: GlobalEdgeStyleContext,
) {
  const weakFarEdge = context.lod === 'far' && attributes.referenceCount === 1;
  return {
    ...attributes,
    color: context.relatedToHover ? attributes.color : '#e3e9eb',
    hidden: weakFarEdge && !(context.hoverActive && context.relatedToHover),
    size:
      attributes.size *
      (context.lod === 'far' ? 0.55 : context.lod === 'regional' ? 0.78 : 1),
    zIndex: context.hoverActive && context.relatedToHover ? 1 : 0,
  };
}
