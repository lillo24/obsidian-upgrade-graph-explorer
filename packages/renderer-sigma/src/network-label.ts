import type { NodeLabelDrawingFunction } from 'sigma/rendering';

import { OBSIDIAN_DARK_NETWORK_THEME } from './network-theme';

const OBSIDIAN_BASE_FONT_PX = 14;
const OBSIDIAN_FONT_RADIUS_FACTOR = 0.25;
const OBSIDIAN_NODE_LABEL_GAP_PX = 5;
const OBSIDIAN_WORD_WRAP_WIDTH_PX = 300;
const VIEWPORT_PADDING_PX = 4;
const HOVER_RING_GAP_PX = 2;

/**
 * Obsidian fades text from renderer scale 1 to 2 while its rendered node radius
 * grows with sqrt(scale), so the equivalent rendered-size window is 1..sqrt(2).
 */
export const NETWORK_LABEL_FULL_OPACITY_RATIO = Math.SQRT2;

export interface NetworkLabelOpacityInput {
  /** Sigma's rendered screen-space node radius passed to the label drawer. */
  readonly renderedNodeSize: number;
  /** Sigma's current hard-cull boundary for ordinary labels. */
  readonly labelRenderedSizeThreshold: number;
  /** Forced labels preserve the product contract and bypass zoom fading. */
  readonly forceLabel?: boolean;
}

/**
 * Adapts Obsidian's `clamp(log2(scale), 0, 1)` text fade to Sigma's
 * rendered-node-size threshold domain. Sigma still owns the hard cull below the
 * threshold; this resolver makes the exact boundary transparent and reaches
 * full opacity once the rendered radius has grown by sqrt(2).
 */
export function resolveNetworkLabelOpacity({
  renderedNodeSize,
  labelRenderedSizeThreshold,
  forceLabel = false,
}: NetworkLabelOpacityInput): number {
  if (forceLabel) return 1;
  if (!Number.isFinite(renderedNodeSize) || renderedNodeSize <= 0) return 0;
  if (
    !Number.isFinite(labelRenderedSizeThreshold) ||
    labelRenderedSizeThreshold <= 0
  ) {
    return 1;
  }
  const renderedRatio = renderedNodeSize / labelRenderedSizeThreshold;
  if (renderedRatio <= 1) return 0;
  if (renderedRatio >= NETWORK_LABEL_FULL_OPACITY_RATIO) return 1;
  return clamp(2 * Math.log2(renderedRatio), 0, 1);
}

export interface NetworkLabelPlacementInput {
  /** Sigma's rendered screen-space node radius. */
  readonly nodeSize: number;
  readonly nodeX: number;
  readonly nodeY: number;
  readonly textWidth: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

export interface NetworkLabelPlacement {
  readonly fontSize: number;
  readonly maxTextWidth: number;
  readonly textX: number;
  readonly textY: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Reproduces Obsidian's below-node anchor and `14 + radius / 4` font rule.
 * Icarus can render nodes below Obsidian's radius floor, so the final font is
 * additionally capped at the rendered diameter required by the product.
 */
export function placeNetworkLabel({
  nodeSize,
  nodeX,
  nodeY,
  textWidth,
  viewportWidth,
}: NetworkLabelPlacementInput): NetworkLabelPlacement {
  const safeRadius = Math.max(0, nodeSize);
  const fontSize = Math.min(
    OBSIDIAN_BASE_FONT_PX + safeRadius * OBSIDIAN_FONT_RADIUS_FACTOR,
    safeRadius * 2,
  );
  const availableViewportWidth = Math.max(
    0,
    viewportWidth - VIEWPORT_PADDING_PX * 2,
  );
  const maxTextWidth = Math.min(
    textWidth,
    OBSIDIAN_WORD_WRAP_WIDTH_PX,
    availableViewportWidth,
  );
  const halfTextWidth = maxTextWidth / 2;
  const textX = clamp(
    nodeX,
    VIEWPORT_PADDING_PX + halfTextWidth,
    Math.max(
      VIEWPORT_PADDING_PX + halfTextWidth,
      viewportWidth - VIEWPORT_PADDING_PX - halfTextWidth,
    ),
  );
  return {
    fontSize,
    maxTextWidth,
    textX,
    textY: nodeY + safeRadius + OBSIDIAN_NODE_LABEL_GAP_PX,
  };
}

function logicalCanvasDimensions(context: CanvasRenderingContext2D): {
  readonly width: number;
  readonly height: number;
} {
  const transform = context.getTransform();
  const scaleX = Math.abs(transform.a) || 1;
  const scaleY = Math.abs(transform.d) || 1;
  return {
    width: context.canvas.width / scaleX,
    height: context.canvas.height / scaleY,
  };
}

type NetworkLabelData = Parameters<NodeLabelDrawingFunction>[1];
type NetworkLabelSettings = Pick<
  Parameters<NodeLabelDrawingFunction>[2],
  'labelColor' | 'labelFont' | 'labelRenderedSizeThreshold' | 'labelWeight'
>;

function labelColor(settings: NetworkLabelSettings): string {
  return settings.labelColor.color ?? OBSIDIAN_DARK_NETWORK_THEME.label;
}

function prepareLabel(
  context: CanvasRenderingContext2D,
  data: NetworkLabelData,
  settings: NetworkLabelSettings,
): NetworkLabelPlacement | undefined {
  if (!data.label || data.size <= 0) return undefined;
  const dimensions = logicalCanvasDimensions(context);
  const provisionalFontSize = Math.min(
    OBSIDIAN_BASE_FONT_PX + data.size * OBSIDIAN_FONT_RADIUS_FACTOR,
    data.size * 2,
  );
  context.font = `${settings.labelWeight} ${provisionalFontSize}px ${settings.labelFont}`;
  return placeNetworkLabel({
    nodeX: data.x,
    nodeY: data.y,
    nodeSize: data.size,
    textWidth: context.measureText(data.label).width,
    viewportWidth: dimensions.width,
    viewportHeight: dimensions.height,
  });
}

function drawPreparedLabel(
  context: CanvasRenderingContext2D,
  label: string,
  placement: NetworkLabelPlacement,
): void {
  if (placement.fontSize <= 0 || placement.maxTextWidth <= 0) return;
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.fillText(
    label,
    placement.textX,
    placement.textY,
    placement.maxTextWidth,
  );
}

export function drawNetworkNodeLabel(
  context: CanvasRenderingContext2D,
  data: NetworkLabelData,
  settings: NetworkLabelSettings,
): void {
  context.save();
  const placement = prepareLabel(context, data, settings);
  const opacity = resolveNetworkLabelOpacity({
    renderedNodeSize: data.size,
    labelRenderedSizeThreshold: settings.labelRenderedSizeThreshold,
    forceLabel: data.forceLabel === true,
  });
  if (placement !== undefined && data.label && opacity > 0) {
    context.font = `${settings.labelWeight} ${placement.fontSize}px ${settings.labelFont}`;
    context.fillStyle = labelColor(settings);
    context.globalAlpha *= opacity;
    drawPreparedLabel(context, data.label, placement);
  }
  context.restore();
}

export function drawNetworkNodeHover(
  context: CanvasRenderingContext2D,
  data: NetworkLabelData,
  settings: NetworkLabelSettings,
): void {
  context.save();
  context.strokeStyle = data.color;
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(data.x, data.y, data.size + HOVER_RING_GAP_PX, 0, Math.PI * 2);
  context.stroke();
  const placement = prepareLabel(context, data, settings);
  if (placement !== undefined && data.label) {
    context.font = `${settings.labelWeight} ${placement.fontSize}px ${settings.labelFont}`;
    context.fillStyle = labelColor(settings);
    drawPreparedLabel(context, data.label, placement);
  }
  context.restore();
}
