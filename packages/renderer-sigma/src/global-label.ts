import type {
  NodeHoverDrawingFunction,
  NodeLabelDrawingFunction,
} from 'sigma/rendering';

import type { GlobalEdgeAttributes, GlobalNodeAttributes } from './types';

const LABEL_GAP = 3;
const LABEL_PADDING = 2;
const VIEWPORT_PADDING = 4;

export interface GlobalLabelPlacementInput {
  readonly nodeX: number;
  readonly nodeY: number;
  readonly nodeSize: number;
  readonly textWidth: number;
  readonly labelSize: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

export interface GlobalLabelPlacement {
  readonly side: 'left' | 'right';
  readonly textX: number;
  readonly textY: number;
  readonly textWidth: number;
  readonly boxX: number;
  readonly boxY: number;
  readonly boxWidth: number;
  readonly boxHeight: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Places one already-selected Sigma label without changing label culling or
 * graph coordinates. Long labels use the larger side and a bounded canvas
 * maxWidth so forced hover/selection text remains inside the viewport.
 */
export function placeGlobalLabel({
  labelSize,
  nodeSize,
  nodeX,
  nodeY,
  textWidth,
  viewportHeight,
  viewportWidth,
}: GlobalLabelPlacementInput): GlobalLabelPlacement {
  const rightX = nodeX + nodeSize + LABEL_GAP;
  const leftEdge = nodeX - nodeSize - LABEL_GAP;
  const rightRoom = Math.max(
    0,
    viewportWidth - VIEWPORT_PADDING - LABEL_PADDING - rightX,
  );
  const leftRoom = Math.max(0, leftEdge - VIEWPORT_PADDING - LABEL_PADDING);
  const side =
    textWidth <= rightRoom || (textWidth > leftRoom && rightRoom >= leftRoom)
      ? 'right'
      : 'left';
  const availableWidth = side === 'right' ? rightRoom : leftRoom;
  const renderedTextWidth = Math.min(textWidth, availableWidth);
  const textX = side === 'right' ? rightX : leftEdge - renderedTextWidth;
  const boxHeight = labelSize + LABEL_PADDING * 2;
  const textY = clamp(
    nodeY,
    VIEWPORT_PADDING + boxHeight / 2,
    Math.max(
      VIEWPORT_PADDING + boxHeight / 2,
      viewportHeight - VIEWPORT_PADDING - boxHeight / 2,
    ),
  );

  return {
    side,
    textX,
    textY,
    textWidth: renderedTextWidth,
    boxX: textX - LABEL_PADDING,
    boxY: textY - boxHeight / 2,
    boxWidth: renderedTextWidth + LABEL_PADDING * 2,
    boxHeight,
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

type GlobalLabelData = Parameters<
  NodeLabelDrawingFunction<GlobalNodeAttributes, GlobalEdgeAttributes>
>[1];
type GlobalLabelSettings = Parameters<
  NodeLabelDrawingFunction<GlobalNodeAttributes, GlobalEdgeAttributes>
>[2];

function labelColor(
  data: GlobalLabelData,
  settings: GlobalLabelSettings,
): string {
  if (settings.labelColor.attribute === undefined) {
    return settings.labelColor.color;
  }
  const attributed = data[settings.labelColor.attribute];
  return typeof attributed === 'string'
    ? attributed
    : (settings.labelColor.color ?? '#000');
}

function prepareLabel(
  context: CanvasRenderingContext2D,
  data: GlobalLabelData,
  settings: GlobalLabelSettings,
): GlobalLabelPlacement | undefined {
  if (!data.label) return undefined;
  context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  const dimensions = logicalCanvasDimensions(context);
  return placeGlobalLabel({
    nodeX: data.x,
    nodeY: data.y,
    nodeSize: data.size,
    textWidth: context.measureText(data.label).width,
    labelSize: settings.labelSize,
    viewportWidth: dimensions.width,
    viewportHeight: dimensions.height,
  });
}

function drawPreparedLabel(
  context: CanvasRenderingContext2D,
  label: string,
  placement: GlobalLabelPlacement,
): void {
  if (placement.textWidth <= 0) return;
  context.textBaseline = 'middle';
  context.fillText(
    label,
    placement.textX,
    placement.textY,
    placement.textWidth,
  );
}

export const drawViewportAwareGlobalNodeLabel: NodeLabelDrawingFunction<
  GlobalNodeAttributes,
  GlobalEdgeAttributes
> = (context, data, settings) => {
  context.save();
  const placement = prepareLabel(context, data, settings);
  if (placement !== undefined && data.label) {
    context.fillStyle = labelColor(data, settings);
    drawPreparedLabel(context, data.label, placement);
  }
  context.restore();
};

export const drawViewportAwareGlobalNodeHover: NodeHoverDrawingFunction<
  GlobalNodeAttributes,
  GlobalEdgeAttributes
> = (context, data, settings) => {
  context.save();
  const placement = prepareLabel(context, data, settings);
  context.fillStyle = '#fff';
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 8;
  context.shadowColor = '#000';
  context.beginPath();
  context.arc(data.x, data.y, data.size + LABEL_PADDING, 0, Math.PI * 2);
  context.fill();
  if (placement !== undefined && placement.textWidth > 0) {
    context.fillRect(
      placement.boxX,
      placement.boxY,
      placement.boxWidth,
      placement.boxHeight,
    );
  }
  context.shadowBlur = 0;
  if (placement !== undefined && data.label) {
    context.fillStyle = labelColor(data, settings);
    drawPreparedLabel(context, data.label, placement);
  }
  context.restore();
};
