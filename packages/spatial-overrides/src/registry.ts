import type { WorkspaceId } from '@icarus-graph-explorer/core';

import { isNormalizedWorkspaceFolderKey } from './folder-key';
import {
  NORMALIZED_FOLDER_ANCHOR_RANGE,
  SPATIAL_OVERRIDE_SCHEMA_VERSION,
  type FolderClusterAnchorEntry,
  type FolderClusterAnchorMap,
  type NormalizedFolderAnchor,
  type SpatialOverrideRegistry,
  type WorkspaceFolderKey,
} from './types';

export type SpatialOverrideValidationResult =
  | { readonly ok: true; readonly value: SpatialOverrideRegistry }
  | { readonly ok: false; readonly message: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactFields(
  value: Record<string, unknown>,
  expected: string,
): boolean {
  return Object.keys(value).sort().join(',') === expected;
}

export function isValidNormalizedFolderAnchor(
  value: unknown,
): value is NormalizedFolderAnchor {
  if (!record(value) || !exactFields(value, 'x,y')) return false;
  return [value.x, value.y].every(
    (coordinate) =>
      typeof coordinate === 'number' &&
      Number.isFinite(coordinate) &&
      coordinate >= NORMALIZED_FOLDER_ANCHOR_RANGE.min &&
      coordinate <= NORMALIZED_FOLDER_ANCHOR_RANGE.max,
  );
}

function compareEntries(
  left: FolderClusterAnchorEntry,
  right: FolderClusterAnchorEntry,
): number {
  return left.folderKey < right.folderKey
    ? -1
    : left.folderKey > right.folderKey
      ? 1
      : 0;
}

function immutableRegistry(
  workspaceId: WorkspaceId,
  folderAnchors: readonly FolderClusterAnchorEntry[],
): SpatialOverrideRegistry {
  const entries = Object.freeze(
    folderAnchors.map((entry) =>
      Object.freeze({
        folderKey: entry.folderKey,
        anchor: Object.freeze({ x: entry.anchor.x, y: entry.anchor.y }),
      }),
    ),
  );
  return Object.freeze({
    schemaVersion: SPATIAL_OVERRIDE_SCHEMA_VERSION,
    workspaceId,
    allNetwork: Object.freeze({ folderAnchors: entries }),
  });
}

export function validateSpatialOverrideRegistry(
  value: unknown,
  expectedWorkspaceId?: string,
): SpatialOverrideValidationResult {
  if (
    !record(value) ||
    !exactFields(value, 'allNetwork,schemaVersion,workspaceId')
  ) {
    return {
      ok: false,
      message: 'Spatial override registry fields are incompatible.',
    };
  }
  if (value.schemaVersion !== SPATIAL_OVERRIDE_SCHEMA_VERSION) {
    return {
      ok: false,
      message: 'Unsupported spatial override schema version.',
    };
  }
  if (typeof value.workspaceId !== 'string' || value.workspaceId.length === 0) {
    return { ok: false, message: 'Expected a non-empty workspace ID.' };
  }
  if (
    expectedWorkspaceId !== undefined &&
    value.workspaceId !== expectedWorkspaceId
  ) {
    return {
      ok: false,
      message: `Spatial overrides belong to workspace ${JSON.stringify(value.workspaceId)}, not ${JSON.stringify(expectedWorkspaceId)}.`,
    };
  }
  if (
    !record(value.allNetwork) ||
    !exactFields(value.allNetwork, 'folderAnchors')
  ) {
    return {
      ok: false,
      message: 'All Network spatial override fields are incompatible.',
    };
  }
  if (!Array.isArray(value.allNetwork.folderAnchors)) {
    return {
      ok: false,
      message: 'Expected an All Network folder-anchor array.',
    };
  }
  const folderAnchors: FolderClusterAnchorEntry[] = [];
  const seen = new Set<string>();
  for (const [index, candidate] of value.allNetwork.folderAnchors.entries()) {
    if (!record(candidate) || !exactFields(candidate, 'anchor,folderKey')) {
      return {
        ok: false,
        message: `Folder anchor ${index + 1} has incompatible fields.`,
      };
    }
    if (!isNormalizedWorkspaceFolderKey(candidate.folderKey)) {
      return {
        ok: false,
        message: `Folder anchor ${index + 1} needs a normalized workspace-relative folder key.`,
      };
    }
    if (seen.has(candidate.folderKey)) {
      return {
        ok: false,
        message: `Duplicate spatial override for folder ${JSON.stringify(candidate.folderKey)}.`,
      };
    }
    if (!isValidNormalizedFolderAnchor(candidate.anchor)) {
      return {
        ok: false,
        message: `Folder anchor ${index + 1} needs finite x/y coordinates from ${NORMALIZED_FOLDER_ANCHOR_RANGE.min} to ${NORMALIZED_FOLDER_ANCHOR_RANGE.max}.`,
      };
    }
    seen.add(candidate.folderKey);
    folderAnchors.push({
      folderKey: candidate.folderKey,
      anchor: { x: candidate.anchor.x, y: candidate.anchor.y },
    });
  }
  folderAnchors.sort(compareEntries);
  return {
    ok: true,
    value: immutableRegistry(value.workspaceId, folderAnchors),
  };
}

function validated(
  value: unknown,
  expectedWorkspaceId?: string,
): SpatialOverrideRegistry {
  const result = validateSpatialOverrideRegistry(value, expectedWorkspaceId);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

export function createEmptySpatialOverrideRegistry(
  workspaceId: WorkspaceId,
): SpatialOverrideRegistry {
  return validated({
    schemaVersion: SPATIAL_OVERRIDE_SCHEMA_VERSION,
    workspaceId,
    allNetwork: { folderAnchors: [] },
  });
}

export function setFolderClusterAnchor(
  registry: SpatialOverrideRegistry,
  folderKey: WorkspaceFolderKey,
  anchor: NormalizedFolderAnchor,
): SpatialOverrideRegistry {
  const current = validated(registry);
  return validated({
    ...current,
    allNetwork: {
      folderAnchors: [
        ...current.allNetwork.folderAnchors.filter(
          (entry) => entry.folderKey !== folderKey,
        ),
        { folderKey, anchor },
      ],
    },
  });
}

export function removeFolderClusterAnchor(
  registry: SpatialOverrideRegistry,
  folderKey: WorkspaceFolderKey,
): SpatialOverrideRegistry {
  if (!isNormalizedWorkspaceFolderKey(folderKey)) {
    throw new Error('Reset folder needs a normalized workspace folder key.');
  }
  const current = validated(registry);
  return validated({
    ...current,
    allNetwork: {
      folderAnchors: current.allNetwork.folderAnchors.filter(
        (entry) => entry.folderKey !== folderKey,
      ),
    },
  });
}

export function clearFolderClusterAnchors(
  registry: SpatialOverrideRegistry,
): SpatialOverrideRegistry {
  const current = validated(registry);
  return immutableRegistry(current.workspaceId, []);
}

export function serializeSpatialOverrideRegistry(
  registry: SpatialOverrideRegistry,
): string {
  return JSON.stringify(validated(registry));
}

export function folderClusterAnchorMap(
  registry: SpatialOverrideRegistry,
): FolderClusterAnchorMap {
  const current = validated(registry);
  return new Map(
    current.allNetwork.folderAnchors.map((entry) => [
      entry.folderKey,
      entry.anchor,
    ]),
  );
}

/** Creates a preview map without mutating persisted state; preview wins by key. */
export function mergeFolderClusterAnchorMaps(
  persisted: FolderClusterAnchorMap,
  preview: FolderClusterAnchorMap,
): FolderClusterAnchorMap {
  return new Map([...persisted, ...preview]);
}
