import type {
  NodeHoverDrawingFunction,
  NodeLabelDrawingFunction,
} from 'sigma/rendering';

import {
  NetworkHoverTransitionController,
  resolveNetworkHoverLabelOffset,
} from './network-hover';
import { networkThemeFor } from './network-theme';

const OBSIDIAN_BASE_FONT_PX = 14;
const OBSIDIAN_FONT_RADIUS_FACTOR = 0.25;
const OBSIDIAN_NODE_LABEL_GAP_PX = 4.5;
const VIEWPORT_PADDING_PX = 4;
const HOVER_RING_GAP_PX = 2;
const NETWORK_LABEL_ELLIPSIS = '…';

export const NETWORK_LABEL_REFERENCE_TEXT =
  'Creativity - Initiative - Curiosity.md';

export type NetworkLabelSizeCandidate = 'conservative' | 'middle' | 'larger';

export const SELECTED_NETWORK_LABEL_SIZE_CANDIDATE = 'middle' as const;

const NETWORK_LABEL_SIZE_CANDIDATES = {
  conservative: {
    fontScale: 0.88,
    minimumDiameterRatio: 0.52,
    ratioBase: 0.5,
    ratioPerRadius: 0.015,
    maximumDiameterRatio: 0.64,
  },
  middle: {
    fontScale: 0.9,
    minimumDiameterRatio: 0.56,
    ratioBase: 0.54,
    ratioPerRadius: 0.015,
    maximumDiameterRatio: 0.69,
  },
  larger: {
    fontScale: 0.92,
    minimumDiameterRatio: 0.6,
    ratioBase: 0.58,
    ratioPerRadius: 0.015,
    maximumDiameterRatio: 0.74,
  },
} as const satisfies Record<
  NetworkLabelSizeCandidate,
  {
    readonly fontScale: number;
    readonly minimumDiameterRatio: number;
    readonly ratioBase: number;
    readonly ratioPerRadius: number;
    readonly maximumDiameterRatio: number;
  }
>;

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

export interface NetworkLabelScaleInput {
  readonly renderedNodeSize: number;
  readonly logicalNodeSize: number;
  readonly sizeCandidate?: NetworkLabelSizeCandidate;
}

export interface NetworkLabelScale {
  readonly fontSize: number;
  readonly gap: number;
  readonly renderScale: number;
}

export function resolveNetworkLabelDiameterRatio(
  logicalNodeSize: number,
  sizeCandidate: NetworkLabelSizeCandidate = SELECTED_NETWORK_LABEL_SIZE_CANDIDATE,
): number {
  const safeLogicalRadius = Math.max(0, logicalNodeSize);
  const candidate = NETWORK_LABEL_SIZE_CANDIDATES[sizeCandidate];
  return clamp(
    candidate.ratioBase + safeLogicalRadius * candidate.ratioPerRadius,
    candidate.minimumDiameterRatio,
    candidate.maximumDiameterRatio,
  );
}

/**
 * Sigma 3.0.3 passes a camera-scaled radius to label drawers while retaining
 * reducer data on the draw payload. The selected Icarus presentation curve
 * keeps Obsidian's logical font basis while applying a continuous,
 * size-sensitive ceiling below the rendered node diameter.
 */
export function resolveNetworkLabelScale({
  renderedNodeSize,
  logicalNodeSize,
  sizeCandidate = SELECTED_NETWORK_LABEL_SIZE_CANDIDATE,
}: NetworkLabelScaleInput): NetworkLabelScale {
  const safeRenderedRadius = Math.max(0, renderedNodeSize);
  const safeLogicalRadius =
    Number.isFinite(logicalNodeSize) && logicalNodeSize > 0
      ? logicalNodeSize
      : safeRenderedRadius;
  const renderScale =
    safeLogicalRadius > 0 ? safeRenderedRadius / safeLogicalRadius : 0;
  const candidate = NETWORK_LABEL_SIZE_CANDIDATES[sizeCandidate];
  const diameterRatio = resolveNetworkLabelDiameterRatio(
    safeLogicalRadius,
    sizeCandidate,
  );
  return {
    fontSize: Math.min(
      (OBSIDIAN_BASE_FONT_PX +
        safeLogicalRadius * OBSIDIAN_FONT_RADIUS_FACTOR) *
        renderScale *
        candidate.fontScale,
      safeRenderedRadius * 2 * diameterRatio,
    ),
    gap: OBSIDIAN_NODE_LABEL_GAP_PX * renderScale,
    renderScale,
  };
}

export interface NetworkLabelPlacementInput {
  /** Sigma's rendered screen-space node radius. */
  readonly nodeSize: number;
  /** Final reducer radius before Sigma applies camera zoom. */
  readonly logicalNodeSize?: number;
  readonly nodeX: number;
  readonly nodeY: number;
  readonly textWidth: number;
  readonly textWidthLimit?: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly hoverProgress?: number;
}

export interface NetworkLabelPlacement {
  readonly fontSize: number;
  readonly gap: number;
  readonly maxTextWidth: number;
  readonly textX: number;
  readonly textY: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Shared below-node geometry after text has been measured and truncated. */
export function placeNetworkLabel({
  nodeSize,
  logicalNodeSize = nodeSize,
  nodeX,
  nodeY,
  textWidth,
  textWidthLimit = textWidth,
  viewportWidth,
  hoverProgress = 0,
}: NetworkLabelPlacementInput): NetworkLabelPlacement {
  const safeRadius = Math.max(0, nodeSize);
  const scale = resolveNetworkLabelScale({
    renderedNodeSize: safeRadius,
    logicalNodeSize,
  });
  const availableViewportWidth = Math.max(
    0,
    viewportWidth - VIEWPORT_PADDING_PX * 2,
  );
  const maxTextWidth = Math.min(
    textWidth,
    textWidthLimit,
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
    fontSize: scale.fontSize,
    gap: scale.gap,
    maxTextWidth,
    textX,
    textY:
      nodeY +
      safeRadius +
      scale.gap +
      resolveNetworkHoverLabelOffset(safeRadius, hoverProgress),
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

type NetworkLabelData = Parameters<NodeLabelDrawingFunction>[1] & {
  readonly key?: string;
  readonly networkLabelLogicalSize?: number;
};
type NetworkLabelSettings = Pick<
  Parameters<NodeLabelDrawingFunction>[2],
  'labelColor' | 'labelFont' | 'labelRenderedSizeThreshold' | 'labelWeight'
>;

function labelColor(settings: NetworkLabelSettings): string {
  return settings.labelColor.color ?? networkThemeFor('dark').label;
}

/** Width-based ellipsis over Unicode code points; glyphs are never condensed. */
export function truncateNetworkLabel(
  context: { measureText: (text: string) => { readonly width: number } },
  label: string,
  maxWidth: number,
): string {
  if (maxWidth <= 0) return '';
  if (context.measureText(label).width <= maxWidth) return label;
  if (context.measureText(NETWORK_LABEL_ELLIPSIS).width > maxWidth) return '';
  const units = Array.from(label);
  let low = 0;
  let high = units.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${units.slice(0, middle).join('').trimEnd()}${NETWORK_LABEL_ELLIPSIS}`;
    if (context.measureText(candidate).width <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${units.slice(0, low).join('').trimEnd()}${NETWORK_LABEL_ELLIPSIS}`;
}

type PreparedNetworkLabel = {
  readonly label: string;
  readonly placement: NetworkLabelPlacement;
};

function prepareLabel(
  context: CanvasRenderingContext2D,
  data: NetworkLabelData,
  settings: NetworkLabelSettings,
  hoverProgress = 0,
): PreparedNetworkLabel | undefined {
  if (!data.label || data.size <= 0) return undefined;
  const dimensions = logicalCanvasDimensions(context);
  const logicalNodeSize = data.networkLabelLogicalSize ?? data.size;
  const scale = resolveNetworkLabelScale({
    renderedNodeSize: data.size,
    logicalNodeSize,
  });
  context.font = `${settings.labelWeight} ${scale.fontSize}px ${settings.labelFont}`;
  const widthLimit = Math.min(
    context.measureText(NETWORK_LABEL_REFERENCE_TEXT).width,
    Math.max(0, dimensions.width - VIEWPORT_PADDING_PX * 2),
  );
  const label = truncateNetworkLabel(context, data.label, widthLimit);
  if (label.length === 0) return undefined;
  return {
    label,
    placement: placeNetworkLabel({
      nodeX: data.x,
      nodeY: data.y,
      nodeSize: data.size,
      logicalNodeSize,
      textWidth: context.measureText(label).width,
      textWidthLimit: widthLimit,
      viewportWidth: dimensions.width,
      viewportHeight: dimensions.height,
      hoverProgress,
    }),
  };
}

function drawPreparedLabel(
  context: CanvasRenderingContext2D,
  prepared: PreparedNetworkLabel,
): void {
  const { label, placement } = prepared;
  if (placement.fontSize <= 0 || placement.maxTextWidth <= 0) return;
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.fillText(label, placement.textX, placement.textY);
}

export function drawNetworkNodeLabel(
  context: CanvasRenderingContext2D,
  data: NetworkLabelData,
  settings: NetworkLabelSettings,
): void {
  context.save();
  const prepared = prepareLabel(context, data, settings);
  const opacity = resolveNetworkLabelOpacity({
    renderedNodeSize: data.size,
    labelRenderedSizeThreshold: settings.labelRenderedSizeThreshold,
    forceLabel: data.forceLabel === true,
  });
  if (prepared !== undefined && opacity > 0) {
    context.font = `${settings.labelWeight} ${prepared.placement.fontSize}px ${settings.labelFont}`;
    context.fillStyle = labelColor(settings);
    context.globalAlpha *= opacity;
    drawPreparedLabel(context, prepared);
  }
  context.restore();
}

function drawNetworkNodeHoverPresentation(
  context: CanvasRenderingContext2D,
  data: NetworkLabelData,
  settings: NetworkLabelSettings,
  hoverProgress: number,
  drawRing: boolean,
): void {
  context.save();
  if (drawRing) {
    context.strokeStyle = data.color;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(data.x, data.y, data.size + HOVER_RING_GAP_PX, 0, Math.PI * 2);
    context.stroke();
  }
  const prepared = prepareLabel(context, data, settings, hoverProgress);
  if (prepared !== undefined) {
    context.font = `${settings.labelWeight} ${prepared.placement.fontSize}px ${settings.labelFont}`;
    context.fillStyle = labelColor(settings);
    drawPreparedLabel(context, prepared);
  }
  context.restore();
}

export function drawNetworkNodeHover(
  context: CanvasRenderingContext2D,
  data: NetworkLabelData,
  settings: NetworkLabelSettings,
): void {
  drawNetworkNodeHoverPresentation(context, data, settings, 0, true);
}

// Mirrors graphology-types' Attributes constraint without adding a new direct
// package dependency solely for this renderer-generic factory.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GraphAttributes = { [name: string]: any };

export function createNetworkLabelDrawers<
  N extends GraphAttributes,
  E extends GraphAttributes,
  G extends GraphAttributes = GraphAttributes,
>(
  hover: NetworkHoverTransitionController,
): {
  readonly drawLabel: NodeLabelDrawingFunction<N, E, G>;
  readonly drawHover: NodeHoverDrawingFunction<N, E, G>;
} {
  return {
    drawLabel: (context, data, settings) => {
      const key = typeof data.key === 'string' ? data.key : undefined;
      if (key !== undefined && hover.ownsLabelLayer(key)) return;
      drawNetworkNodeLabel(context, data, settings);
    },
    drawHover: (context, data, settings) => {
      const key = typeof data.key === 'string' ? data.key : undefined;
      const progress = key === undefined ? 0 : hover.progress(key);
      const drawRing =
        key === undefined || !hover.ownsLabelLayer(key) || hover.isHovered(key);
      drawNetworkNodeHoverPresentation(
        context,
        data,
        settings,
        progress,
        drawRing,
      );
    },
  };
}
