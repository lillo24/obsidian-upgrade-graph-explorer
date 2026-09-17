import type { NodeLabelDrawingFunction } from 'sigma/rendering';

import { OBSIDIAN_DARK_NETWORK_THEME } from './network-theme';

const OBSIDIAN_BASE_FONT_PX = 14;
const OBSIDIAN_FONT_RADIUS_FACTOR = 0.25;
const OBSIDIAN_NODE_LABEL_GAP_PX = 5;
const OBSIDIAN_WORD_WRAP_WIDTH_PX = 300;
const VIEWPORT_PADDING_PX = 4;
const HOVER_RING_GAP_PX = 2;

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
  'labelColor' | 'labelFont' | 'labelWeight'
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
  if (placement !== undefined && data.label) {
    context.font = `${settings.labelWeight} ${placement.fontSize}px ${settings.labelFont}`;
    context.fillStyle = labelColor(settings);
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
