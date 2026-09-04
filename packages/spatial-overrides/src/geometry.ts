import { isNormalizedWorkspaceFolderKey } from './folder-key';
import { isValidNormalizedFolderAnchor } from './registry';
import {
  MINIMUM_AUTOMATIC_FRAME_HALF_EXTENT,
  NORMALIZED_FOLDER_ANCHOR_RANGE,
  type AppliedFolderTranslation,
  type AutomaticGraphFrame,
  type FolderClusterAnchorMap,
  type NormalizedFolderAnchor,
  type ResolvedFolderSpatialRules,
  type SpatialCompositionResult,
  type SpatialPoint,
  type SpatialPosition,
  type VisualDownGraphYSign,
} from './types';

function finitePoint(value: SpatialPoint, label: string): void {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} must contain finite x/y coordinates.`);
  }
}

function positionIndex(
  positions: readonly SpatialPosition[],
): ReadonlyMap<string, SpatialPoint> {
  const byKey = new Map<string, SpatialPoint>();
  for (const position of positions) {
    if (position.key.length === 0 || byKey.has(position.key)) {
      throw new Error('Automatic positions need unique non-empty node keys.');
    }
    finitePoint(position, `Automatic position ${JSON.stringify(position.key)}`);
    byKey.set(position.key, { x: position.x, y: position.y });
  }
  return byKey;
}

function validFrame(frame: AutomaticGraphFrame): void {
  finitePoint({ x: frame.centerX, y: frame.centerY }, 'Automatic frame center');
  if (
    !Number.isFinite(frame.halfWidth) ||
    !Number.isFinite(frame.halfHeight) ||
    frame.halfWidth < MINIMUM_AUTOMATIC_FRAME_HALF_EXTENT ||
    frame.halfHeight < MINIMUM_AUTOMATIC_FRAME_HALF_EXTENT
  ) {
    throw new Error('Automatic frame half extents are invalid.');
  }
}

function validVisualDownGraphYSign(value: VisualDownGraphYSign): void {
  if (value !== -1 && value !== 1) {
    throw new Error('Visual-down graph Y sign must be -1 or +1.');
  }
}

export function computeAutomaticGraphFrame(
  automaticPositions: readonly SpatialPosition[],
  documentNodeKeys: Iterable<string>,
): AutomaticGraphFrame {
  const byKey = positionIndex(automaticPositions);
  const points: SpatialPoint[] = [];
  const seen = new Set<string>();
  for (const key of documentNodeKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const point = byKey.get(key);
    if (point === undefined) {
      throw new Error(
        `Document node ${JSON.stringify(key)} has no automatic position.`,
      );
    }
    points.push(point);
  }
  if (points.length === 0) {
    return {
      centerX: 0,
      centerY: 0,
      halfWidth: MINIMUM_AUTOMATIC_FRAME_HALF_EXTENT,
      halfHeight: MINIMUM_AUTOMATIC_FRAME_HALF_EXTENT,
    };
  }
  let minX = points[0]!.x;
  let maxX = minX;
  let minY = points[0]!.y;
  let maxY = minY;
  for (const point of points.slice(1)) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    halfWidth: Math.max(MINIMUM_AUTOMATIC_FRAME_HALF_EXTENT, (maxX - minX) / 2),
    halfHeight: Math.max(
      MINIMUM_AUTOMATIC_FRAME_HALF_EXTENT,
      (maxY - minY) / 2,
    ),
  };
}

export function targetFromNormalizedAnchor(
  frame: AutomaticGraphFrame,
  anchor: NormalizedFolderAnchor,
  visualDownGraphYSign: VisualDownGraphYSign,
): SpatialPoint {
  validFrame(frame);
  validVisualDownGraphYSign(visualDownGraphYSign);
  if (!isValidNormalizedFolderAnchor(anchor)) {
    throw new Error('Normalized folder anchor is invalid or out of range.');
  }
  return {
    x: frame.centerX + anchor.x * frame.halfWidth,
    y: frame.centerY + anchor.y * frame.halfHeight * visualDownGraphYSign,
  };
}

function clampAnchorCoordinate(value: number): number {
  return Math.min(
    NORMALIZED_FOLDER_ANCHOR_RANGE.max,
    Math.max(NORMALIZED_FOLDER_ANCHOR_RANGE.min, value),
  );
}

/** Inverse used by SPATIAL1B; finite targets are clamped to schema-v1 bounds. */
export function normalizedAnchorFromTarget(
  frame: AutomaticGraphFrame,
  target: SpatialPoint,
  visualDownGraphYSign: VisualDownGraphYSign,
): NormalizedFolderAnchor {
  validFrame(frame);
  validVisualDownGraphYSign(visualDownGraphYSign);
  finitePoint(target, 'Spatial target');
  return {
    x: clampAnchorCoordinate((target.x - frame.centerX) / frame.halfWidth),
    y: clampAnchorCoordinate(
      ((target.y - frame.centerY) / frame.halfHeight) * visualDownGraphYSign,
    ),
  };
}

export function applyFolderClusterAnchors({
  automaticPositions,
  folderKeyByNodeKey,
  anchors,
  visualDownGraphYSign,
}: {
  readonly automaticPositions: readonly SpatialPosition[];
  readonly folderKeyByNodeKey: ReadonlyMap<string, string>;
  readonly anchors: FolderClusterAnchorMap;
  readonly visualDownGraphYSign: VisualDownGraphYSign;
}): SpatialCompositionResult {
  validVisualDownGraphYSign(visualDownGraphYSign);
  const automaticByKey = positionIndex(automaticPositions);
  const membersByFolder = new Map<string, string[]>();
  for (const [nodeKey, folderKey] of folderKeyByNodeKey) {
    if (!automaticByKey.has(nodeKey)) {
      throw new Error(
        `Folder metadata references missing node ${JSON.stringify(nodeKey)}.`,
      );
    }
    if (!isNormalizedWorkspaceFolderKey(folderKey)) {
      throw new Error(
        `Folder metadata contains invalid key ${JSON.stringify(folderKey)}.`,
      );
    }
    const members = membersByFolder.get(folderKey) ?? [];
    members.push(nodeKey);
    membersByFolder.set(folderKey, members);
  }
  const automaticFrame = computeAutomaticGraphFrame(
    automaticPositions,
    folderKeyByNodeKey.keys(),
  );
  const displayedByKey = new Map(automaticByKey);
  const activeFolders: AppliedFolderTranslation[] = [];
  const inactiveFolderKeys: string[] = [];
  const sortedAnchors = [...anchors].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  for (const [folderKey, anchor] of sortedAnchors) {
    if (!isNormalizedWorkspaceFolderKey(folderKey)) {
      throw new Error(
        `Anchor map contains invalid folder key ${JSON.stringify(folderKey)}.`,
      );
    }
    if (!isValidNormalizedFolderAnchor(anchor)) {
      throw new Error(
        `Anchor map contains invalid coordinates for ${JSON.stringify(folderKey)}.`,
      );
    }
    const members = membersByFolder.get(folderKey);
    if (members === undefined || members.length === 0) {
      inactiveFolderKeys.push(folderKey);
      continue;
    }
    members.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    let centerX = 0;
    let centerY = 0;
    for (const nodeKey of members) {
      const point = automaticByKey.get(nodeKey)!;
      centerX += point.x;
      centerY += point.y;
    }
    const automaticCenter = {
      x: centerX / members.length,
      y: centerY / members.length,
    };
    const target = targetFromNormalizedAnchor(
      automaticFrame,
      anchor,
      visualDownGraphYSign,
    );
    const translation = {
      x: target.x - automaticCenter.x,
      y: target.y - automaticCenter.y,
    };
    for (const nodeKey of members) {
      const point = automaticByKey.get(nodeKey)!;
      displayedByKey.set(nodeKey, {
        x: point.x + translation.x,
        y: point.y + translation.y,
      });
    }
    activeFolders.push({
      folderKey,
      memberNodeKeys: [...members],
      automaticCenter,
      target,
      translation,
    });
  }
  return {
    displayedPositions: automaticPositions
      .map(({ key }) => ({ key, ...displayedByKey.get(key)! }))
      .sort((left, right) =>
        left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
      ),
    automaticFrame,
    activeFolders,
    inactiveFolderKeys,
    issues: [],
  };
}

/**
 * Composes resolved place groups over the current dynamic layer while deriving
 * normalized targets exclusively from the immutable base automatic frame.
 */
export function applyResolvedFolderPlacements({
  baseAutomaticPositions,
  currentPositions,
  documentNodeKeys,
  resolved,
  visualDownGraphYSign,
}: {
  readonly baseAutomaticPositions: readonly SpatialPosition[];
  readonly currentPositions: readonly SpatialPosition[];
  readonly documentNodeKeys: Iterable<string>;
  readonly resolved: ResolvedFolderSpatialRules;
  readonly visualDownGraphYSign: VisualDownGraphYSign;
}): SpatialCompositionResult {
  validVisualDownGraphYSign(visualDownGraphYSign);
  const baseByKey = positionIndex(baseAutomaticPositions);
  const currentByKey = positionIndex(currentPositions);
  if (baseByKey.size !== currentByKey.size) {
    throw new Error('Base and dynamic spatial layers need the same node keys.');
  }
  for (const key of baseByKey.keys()) {
    if (!currentByKey.has(key)) {
      throw new Error(
        `Dynamic spatial layer omitted node ${JSON.stringify(key)}.`,
      );
    }
  }
  const automaticFrame = computeAutomaticGraphFrame(
    baseAutomaticPositions,
    documentNodeKeys,
  );
  const displayedByKey = new Map(currentByKey);
  const activeFolders: AppliedFolderTranslation[] = [];
  for (const group of resolved.placeGroups) {
    let centerX = 0;
    let centerY = 0;
    for (const nodeKey of group.memberNodeKeys) {
      const point = currentByKey.get(nodeKey);
      if (point === undefined) {
        throw new Error(
          `Resolved place group references missing node ${JSON.stringify(nodeKey)}.`,
        );
      }
      centerX += point.x;
      centerY += point.y;
    }
    const currentCenter = {
      x: centerX / group.memberNodeKeys.length,
      y: centerY / group.memberNodeKeys.length,
    };
    const target = targetFromNormalizedAnchor(
      automaticFrame,
      group.rule.anchor,
      visualDownGraphYSign,
    );
    const translation = {
      x: target.x - currentCenter.x,
      y: target.y - currentCenter.y,
    };
    for (const nodeKey of group.memberNodeKeys) {
      const point = currentByKey.get(nodeKey)!;
      displayedByKey.set(nodeKey, {
        x: point.x + translation.x,
        y: point.y + translation.y,
      });
    }
    activeFolders.push({
      folderKey: group.rule.folderKey,
      memberNodeKeys: group.memberNodeKeys,
      automaticCenter: currentCenter,
      target,
      translation,
    });
  }
  return {
    displayedPositions: currentPositions
      .map(({ key }) => ({ key, ...displayedByKey.get(key)! }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    automaticFrame,
    activeFolders,
    inactiveFolderKeys: resolved.inactiveRules
      .filter(({ rule }) => rule.behavior === 'place')
      .map(({ rule }) => rule.folderKey),
    issues: [],
  };
}
