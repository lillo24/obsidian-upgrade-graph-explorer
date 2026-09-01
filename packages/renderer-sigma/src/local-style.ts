import type {
  LocalEdgeAttributes,
  LocalNodeAttributes,
  LocalVisualLod,
} from './local-types';

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
  },
) {
  const emphasized = context.selected || context.hovered;
  const labelVisible =
    emphasized ||
    attributes.root ||
    context.lod === 'near-local' ||
    (context.lod === 'normal-local' && attributes.nodeKind !== 'block') ||
    (context.lod === 'far-local' && attributes.nodeKind === 'document');
  return {
    ...attributes,
    color: context.selected
      ? '#d29b22'
      : context.hovered
        ? '#38a5c2'
        : context.relatedToHover
          ? attributes.color
          : '#dce4e6',
    forceLabel: emphasized || attributes.root,
    highlighted: emphasized,
    label: labelVisible ? attributes.label : '',
    zIndex: emphasized || attributes.root ? 2 : 0,
  };
}

export function resolveLocalEdgeStyle(
  attributes: LocalEdgeAttributes,
  context: {
    readonly relatedToHover: boolean;
    readonly hoverActive: boolean;
    readonly lod: LocalVisualLod;
  },
) {
  const hierarchy = attributes.edgeKind === 'hierarchy';
  return {
    ...attributes,
    color: context.relatedToHover
      ? hierarchy
        ? '#7c8790'
        : attributes.color
      : '#e1e8ea',
    hidden:
      context.lod === 'far-local' &&
      !hierarchy &&
      !(context.hoverActive && context.relatedToHover),
    size:
      attributes.size *
      (context.lod === 'far-local'
        ? hierarchy
          ? 0.72
          : 0.45
        : context.lod === 'normal-local'
          ? 0.84
          : 1),
    zIndex: context.hoverActive && context.relatedToHover ? 1 : 0,
  };
}
