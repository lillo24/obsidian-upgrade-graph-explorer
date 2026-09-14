import { useMemo } from 'react';
import { ViewportPortal } from '@xyflow/react';
import type {
  FocusSchematicFolderBand,
  FocusSchematicFolderBandPlan,
} from '@icarus-graph-explorer/focus-schematic-layout';

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
  readonly nested: boolean;
}

export interface FocusSchematicFolderParentStrip {
  readonly id: string;
  readonly folderKey: string;
  readonly label: string;
  readonly topY: number;
  readonly height: number;
  readonly x: number;
  readonly width: number;
}

export interface FocusSchematicDirectionalFolderOverlay {
  readonly parents: readonly FocusSchematicFolderParentStrip[];
  readonly bands: readonly FocusSchematicFolderStrip[];
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

function shortFolderLabel(folderKey: string): string {
  if (folderKey === '.') return 'Root folder';
  return folderKey.slice(folderKey.lastIndexOf('/') + 1);
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
    nested: false,
  }));
}

/** Consumes worker-owned nested geometry; React only supplies shared flat X extents. */
export function focusSchematicDirectionalFolderOverlay(
  plan: FocusSchematicFolderBandPlan,
  nodes: readonly GraphFlowNode[],
): FocusSchematicDirectionalFolderOverlay {
  if (plan.hierarchy === undefined)
    return {
      parents: [],
      bands: focusSchematicFolderStrips(plan.bands, nodes),
    };
  const shared = focusSchematicFolderStrips(
    plan.bands.filter(({ root }) => root),
    nodes,
  )[0];
  if (shared === undefined) return { parents: [], bands: [] };
  const hierarchy = plan.hierarchy;
  const bands: FocusSchematicFolderStrip[] = [];
  for (const unit of hierarchy.topLevelUnits) {
    if (unit.kind === 'parent-container') continue;
    bands.push({
      folderKey: unit.folderKey,
      label: folderLabel(unit.folderKey),
      root: unit.kind === 'root-band',
      singleton: unit.moduleIds.length === 1,
      topY: unit.topY,
      bottomY: unit.bottomY,
      centerY: unit.centerY,
      height: unit.height,
      x: shared.x,
      width: shared.width,
      nested: false,
    });
  }
  for (const unit of hierarchy.internalUnits) {
    if (unit.kind !== 'child-band') continue;
    bands.push({
      folderKey: unit.folderKey,
      label: unit.label ?? shortFolderLabel(unit.folderKey),
      root: false,
      singleton: unit.moduleIds.length === 1,
      topY: unit.topY,
      bottomY: unit.bottomY,
      centerY: unit.centerY,
      height: unit.height,
      x: unit.x,
      width: unit.width,
      nested: true,
    });
  }
  return {
    parents: hierarchy.parentContainers.map((parent) => ({
      id: parent.id,
      folderKey: parent.folderKey,
      label: parent.label,
      topY: parent.topY,
      height: parent.height,
      x: parent.x,
      width: parent.width,
    })),
    bands: bands.sort(
      (left, right) =>
        left.topY - right.topY || left.folderKey.localeCompare(right.folderKey),
    ),
  };
}

export function FocusSchematicFolderBandStrips({
  plan,
  nodes,
}: {
  readonly plan: FocusSchematicFolderBandPlan;
  readonly nodes: readonly GraphFlowNode[];
}) {
  const overlay = useMemo(
    () => focusSchematicDirectionalFolderOverlay(plan, nodes),
    [plan, nodes],
  );
  if (overlay.bands.length === 0) return null;
  return (
    <ViewportPortal>
      <svg
        aria-hidden="true"
        className="focus-schematic-folder-strips"
        focusable="false"
        style={{ pointerEvents: 'none' }}
      >
        {overlay.parents.map((parent) => (
          <g data-folder-key={parent.folderKey} key={parent.id}>
            <title>{parent.folderKey}</title>
            <rect
              className="focus-schematic-folder-parent-strip"
              height={parent.height}
              rx="14"
              width={parent.width}
              x={parent.x}
              y={parent.topY}
            />
            <text
              className="focus-schematic-folder-parent-strip__label"
              x={parent.x + 14}
              y={parent.topY - 8}
            >
              {parent.label}
            </text>
          </g>
        ))}
        {overlay.bands.map((strip) => (
          <g data-folder-key={strip.folderKey} key={strip.folderKey}>
            <title>{strip.folderKey}</title>
            <rect
              className={
                strip.root
                  ? 'focus-schematic-folder-strip focus-schematic-folder-strip--root'
                  : `focus-schematic-folder-strip${strip.nested ? ' focus-schematic-folder-strip--nested' : ''}`
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
