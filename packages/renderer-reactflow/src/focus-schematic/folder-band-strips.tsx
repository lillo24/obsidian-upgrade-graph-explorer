import { useMemo } from 'react';
import { ViewportPortal } from '@xyflow/react';
import type { FocusSchematicFolderBand } from '@icarus-graph-explorer/focus-schematic-layout';

import type { GraphFlowNode } from '../types';

const STRIP_PADDING_X = 48;

export interface FocusSchematicFolderStrip {
  readonly folderKey: string;
  readonly label: string;
  readonly root: boolean;
  readonly singleton: boolean;
  readonly topY: number;
  readonly bottomY: number;
  readonly centerY: number;
  readonly height: number;
  readonly x: number;
  readonly width: number;
}

function rectangleSize(
  node: GraphFlowNode,
): { readonly width: number; readonly height: number } | undefined {
  const width = node.width ?? node.measured?.width;
  const height = node.height ?? node.measured?.height;
  return width === undefined || height === undefined
    ? undefined
    : { width, height };
}

function folderLabel(folderKey: string): string {
  return folderKey === '.' ? 'Root folder' : folderKey;
}

/**
 * The band plan owns Y geometry and visibility. The renderer only gives every
 * strip one shared X extent from the final React Flow rectangles.
 */
export function focusSchematicFolderStrips(
  bands: readonly FocusSchematicFolderBand[],
  nodes: readonly GraphFlowNode[],
): readonly FocusSchematicFolderStrip[] {
  if (bands.length === 0) return [];
  const rectangles = nodes.flatMap((node) => {
    const size = rectangleSize(node);
    return size === undefined
      ? []
      : [
          {
            left: node.position.x,
            right: node.position.x + size.width,
          },
        ];
  });
  if (rectangles.length === 0) return [];
  const x = Math.min(...rectangles.map(({ left }) => left)) - STRIP_PADDING_X;
  const right =
    Math.max(...rectangles.map(({ right }) => right)) + STRIP_PADDING_X;
  return bands.map((band) => ({
    folderKey: band.folderKey,
    label: folderLabel(band.folderKey),
    root: band.root,
    singleton: band.singleton,
    topY: band.topY,
    bottomY: band.bottomY,
    centerY: band.centerY,
    height: band.height,
    x,
    width: right - x,
  }));
}

export function FocusSchematicFolderBandStrips({
  bands,
  nodes,
}: {
  readonly bands: readonly FocusSchematicFolderBand[];
  readonly nodes: readonly GraphFlowNode[];
}) {
  const strips = useMemo(
    () => focusSchematicFolderStrips(bands, nodes),
    [bands, nodes],
  );
  if (strips.length === 0) return null;
  return (
    <ViewportPortal>
      <svg
        aria-hidden="true"
        className="focus-schematic-folder-strips"
        focusable="false"
      >
        {strips.map((strip) => (
          <g key={strip.folderKey}>
            <rect
              className={
                strip.root
                  ? 'focus-schematic-folder-strip focus-schematic-folder-strip--root'
                  : 'focus-schematic-folder-strip'
              }
              height={strip.height}
              rx="12"
              width={strip.width}
              x={strip.x}
              y={strip.topY}
            />
            <line
              className="focus-schematic-folder-strip__guide"
              x1={strip.x}
              x2={strip.x + strip.width}
              y1={strip.centerY}
              y2={strip.centerY}
            />
            <text
              className="focus-schematic-folder-strip__label"
              x={strip.x + 14}
              y={strip.topY - 8}
            >
              {strip.label}
            </text>
          </g>
        ))}
      </svg>
    </ViewportPortal>
  );
}
