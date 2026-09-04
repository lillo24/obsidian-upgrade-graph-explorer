import { isNormalizedWorkspaceFolderKey } from './folder-key';
import {
  applyFolderClusterAnchors,
  computeAutomaticGraphFrame,
  normalizedAnchorFromTarget,
  targetFromNormalizedAnchor,
} from './geometry';
import { isValidNormalizedFolderAnchor } from './registry';
import {
  NORMALIZED_FOLDER_ANCHOR_RANGE,
  type FolderClusterAnchorMap,
  type FolderClusterPreviewGeometry,
  type FolderClusterPreviewResult,
  type NormalizedFolderAnchor,
  type SpatialPoint,
  type SpatialPosition,
  type VisualDownGraphYSign,
  type WorkspaceFolderKey,
} from './types';

function finitePoint(point: SpatialPoint, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`${label} must contain finite x/y coordinates.`);
  }
}

/**
 * Captures any already-resolved member set against the immutable base frame.
 * Members start from current displayed geometry, so Pull and Place both preview
 * rigidly without feeding displayed coordinates back into automatic layout.
 */
export function createFolderSpatialRulePreviewGeometry({
  baseAutomaticPositions,
  currentPositions,
  documentNodeKeys,
  memberNodeKeys,
  folderKey,
  visualDownGraphYSign,
}: {
  readonly baseAutomaticPositions: readonly SpatialPosition[];
  readonly currentPositions: readonly SpatialPosition[];
  readonly documentNodeKeys: Iterable<string>;
  readonly memberNodeKeys: Iterable<string>;
  readonly folderKey: WorkspaceFolderKey;
  readonly visualDownGraphYSign: VisualDownGraphYSign;
}): FolderClusterPreviewGeometry {
  if (!isNormalizedWorkspaceFolderKey(folderKey)) {
    throw new Error('Folder preview needs a normalized workspace folder key.');
  }
  const currentByKey = new Map(
    currentPositions.map((position) => [position.key, position] as const),
  );
  if (currentByKey.size !== currentPositions.length) {
    throw new Error('Current folder-preview positions need unique node keys.');
  }
  const memberAutomaticPositions = [...new Set(memberNodeKeys)]
    .map((nodeKey) => {
      const position = currentByKey.get(nodeKey);
      if (position === undefined) {
        throw new Error(
          `Resolved folder preview references missing node ${JSON.stringify(nodeKey)}.`,
        );
      }
      return position;
    })
    .sort((left, right) => left.key.localeCompare(right.key));
  if (memberAutomaticPositions.length === 0) {
    throw new Error(
      `Folder ${JSON.stringify(folderKey)} has no visible document members.`,
    );
  }
  const displayedCenter = memberAutomaticPositions.reduce(
    (center, position) => ({
      x: center.x + position.x / memberAutomaticPositions.length,
      y: center.y + position.y / memberAutomaticPositions.length,
    }),
    { x: 0, y: 0 },
  );
  const automaticFrame = computeAutomaticGraphFrame(
    baseAutomaticPositions,
    documentNodeKeys,
  );
  return {
    folderKey,
    automaticFrame,
    automaticCenter: displayedCenter,
    displayedCenter,
    displayedAnchor: normalizedAnchorFromTarget(
      automaticFrame,
      displayedCenter,
      visualDownGraphYSign,
    ),
    memberAutomaticPositions,
  };
}

function clamp(value: number): number {
  return Math.min(
    NORMALIZED_FOLDER_ANCHOR_RANGE.max,
    Math.max(NORMALIZED_FOLDER_ANCHOR_RANGE.min, value),
  );
}

/** Adds a logical normalized nudge while retaining schema-v1 bounds. */
export function offsetNormalizedFolderAnchor(
  anchor: NormalizedFolderAnchor,
  offset: SpatialPoint,
): NormalizedFolderAnchor {
  if (!isValidNormalizedFolderAnchor(anchor)) {
    throw new Error('Normalized folder anchor is invalid or out of range.');
  }
  finitePoint(offset, 'Normalized folder-anchor offset');
  return { x: clamp(anchor.x + offset.x), y: clamp(anchor.y + offset.y) };
}

/** Converts one anchor into the rigid translation for a captured folder. */
export function folderTranslationFromAnchor({
  automaticCenter,
  automaticFrame,
  anchor,
  visualDownGraphYSign,
}: Pick<FolderClusterPreviewGeometry, 'automaticCenter' | 'automaticFrame'> & {
  readonly anchor: NormalizedFolderAnchor;
  readonly visualDownGraphYSign: VisualDownGraphYSign;
}): { readonly target: SpatialPoint; readonly translation: SpatialPoint } {
  finitePoint(automaticCenter, 'Automatic folder center');
  const target = targetFromNormalizedAnchor(
    automaticFrame,
    anchor,
    visualDownGraphYSign,
  );
  return {
    target,
    translation: {
      x: target.x - automaticCenter.x,
      y: target.y - automaticCenter.y,
    },
  };
}

/**
 * Captures the immutable automatic base and current committed center once.
 * This intentionally performs the authoritative full composition only at
 * gesture start; raw pointer moves use `previewFolderClusterAtAnchor`.
 */
export function createFolderClusterPreviewGeometry({
  automaticPositions,
  currentPositions = automaticPositions,
  folderKeyByNodeKey,
  anchors,
  folderKey,
  visualDownGraphYSign,
}: {
  readonly automaticPositions: readonly SpatialPosition[];
  readonly currentPositions?: readonly SpatialPosition[];
  readonly folderKeyByNodeKey: ReadonlyMap<string, string>;
  readonly anchors: FolderClusterAnchorMap;
  readonly folderKey: WorkspaceFolderKey;
  readonly visualDownGraphYSign: VisualDownGraphYSign;
}): FolderClusterPreviewGeometry {
  if (!isNormalizedWorkspaceFolderKey(folderKey)) {
    throw new Error('Folder preview needs a normalized workspace folder key.');
  }
  const composition = applyFolderClusterAnchors({
    automaticPositions,
    folderKeyByNodeKey,
    anchors,
    visualDownGraphYSign,
  });
  const automaticByKey = new Map(
    currentPositions.map((position) => [position.key, position] as const),
  );
  if (automaticByKey.size !== automaticPositions.length) {
    throw new Error(
      'Current folder-preview positions must match the base layer.',
    );
  }
  const memberAutomaticPositions = [...folderKeyByNodeKey]
    .filter(([, candidateFolderKey]) => candidateFolderKey === folderKey)
    .map(([nodeKey]) => automaticByKey.get(nodeKey)!)
    .sort((left, right) => left.key.localeCompare(right.key));
  if (memberAutomaticPositions.length === 0) {
    throw new Error(
      `Folder ${JSON.stringify(folderKey)} has no visible document members.`,
    );
  }
  const automaticCenter = memberAutomaticPositions.reduce(
    (center, position) => ({
      x: center.x + position.x / memberAutomaticPositions.length,
      y: center.y + position.y / memberAutomaticPositions.length,
    }),
    { x: 0, y: 0 },
  );
  const committedAnchor = anchors.get(folderKey);
  const displayedCenter =
    committedAnchor === undefined
      ? automaticCenter
      : targetFromNormalizedAnchor(
          composition.automaticFrame,
          committedAnchor,
          visualDownGraphYSign,
        );
  return {
    folderKey,
    automaticFrame: composition.automaticFrame,
    automaticCenter,
    displayedCenter,
    displayedAnchor: normalizedAnchorFromTarget(
      composition.automaticFrame,
      displayedCenter,
      visualDownGraphYSign,
    ),
    memberAutomaticPositions,
  };
}

/** Sparse rigid positions for one folder; every call starts from automatic data. */
export function previewFolderClusterAtAnchor({
  geometry,
  anchor,
  visualDownGraphYSign,
}: {
  readonly geometry: FolderClusterPreviewGeometry;
  readonly anchor: NormalizedFolderAnchor;
  readonly visualDownGraphYSign: VisualDownGraphYSign;
}): FolderClusterPreviewResult {
  const { target, translation } = folderTranslationFromAnchor({
    automaticCenter: geometry.automaticCenter,
    automaticFrame: geometry.automaticFrame,
    anchor,
    visualDownGraphYSign,
  });
  return {
    folderKey: geometry.folderKey,
    anchor,
    target,
    translation,
    positions: geometry.memberAutomaticPositions.map((position) => ({
      key: position.key,
      x: position.x + translation.x,
      y: position.y + translation.y,
    })),
  };
}

/** No-jump pointer delta converted to one bounded sparse folder preview. */
export function previewFolderClusterFromPointer({
  geometry,
  startPointer,
  currentPointer,
  visualDownGraphYSign,
}: {
  readonly geometry: FolderClusterPreviewGeometry;
  readonly startPointer: SpatialPoint;
  readonly currentPointer: SpatialPoint;
  readonly visualDownGraphYSign: VisualDownGraphYSign;
}): FolderClusterPreviewResult {
  finitePoint(startPointer, 'Folder drag start pointer');
  finitePoint(currentPointer, 'Folder drag current pointer');
  const desiredCenter = {
    x: geometry.displayedCenter.x + currentPointer.x - startPointer.x,
    y: geometry.displayedCenter.y + currentPointer.y - startPointer.y,
  };
  return previewFolderClusterAtAnchor({
    geometry,
    anchor: normalizedAnchorFromTarget(
      geometry.automaticFrame,
      desiredCenter,
      visualDownGraphYSign,
    ),
    visualDownGraphYSign,
  });
}
