import type {
  GlobalEdgeAttributes,
  GlobalNodeAttributes,
  GlobalVisualLod,
  ResolvedGlobalLayoutSettings,
} from './types';
import type { VisualGroupNodePresentation } from '@icarus-graph-explorer/visual-groups';
import type { FolderScopeVisualizationState } from '@icarus-graph-explorer/spatial-overrides';
import { applyNetworkNodeSizeScale } from './node-size';

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
  readonly relatedToHover: boolean;
  readonly hoverActive: boolean;
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
      ? '#d7a126'
      : context.hovered
        ? '#55a8c2'
        : arrangementMember
          ? baseColor
          : context.scopeState === undefined
            ? '#e1e6e7'
            : context.scopeState === 'shadowed-by-child'
              ? '#9baec7'
              : context.scopeState === 'excluded-candidate'
                ? '#d9dfe1'
                : '#edf0f1'
    : context.selected
      ? '#d7a126'
      : context.hovered
        ? '#55a8c2'
        : context.relatedToHover
          ? baseColor
          : '#d8e0e3';
  return {
    ...attributes,
    size,
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
  return {
    ...attributes,
    color: arrangementActive
      ? arrangementRelation === 'internal'
        ? attributes.color
        : arrangementRelation === 'boundary'
          ? '#aebdc1'
          : arrangementRelation === 'child-owned'
            ? '#a7b6cb'
            : '#edf0f1'
      : context.relatedToHover
        ? attributes.color
        : '#e3e9eb',
    hidden:
      !arrangementActive &&
      weakFarEdge &&
      !(context.hoverActive && context.relatedToHover),
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
        : context.lod === 'far'
          ? 0.55
          : context.lod === 'regional'
            ? 0.78
            : 1),
    zIndex:
      arrangementRelation === 'internal' ||
      arrangementRelation === 'boundary' ||
      arrangementRelation === 'child-owned' ||
      (context.hoverActive && context.relatedToHover)
        ? 1
        : 0,
  };
}
