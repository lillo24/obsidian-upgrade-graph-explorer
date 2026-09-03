import type { AddressableEntity, EntityId } from '@icarus-graph-explorer/core';

import {
  NODE_SIZE_SCALE_RANGE,
  PRESENTATION_OVERRIDE_SCHEMA_VERSION,
  type EntityPresentationOverrideMap,
  type PresentationOverrideEntry,
  type PresentationOverrideRegistry,
} from './types';

type ValidationResult =
  | { readonly ok: true; readonly value: PresentationOverrideRegistry }
  | { readonly ok: false; readonly message: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidNodeSizeScale(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= NODE_SIZE_SCALE_RANGE.min &&
    value <= NODE_SIZE_SCALE_RANGE.max
  );
}

export function validatePresentationOverrideRegistry(
  value: unknown,
  expectedWorkspaceId?: string,
): ValidationResult {
  if (
    !record(value) ||
    Object.keys(value).sort().join(',') !== 'entities,schemaVersion,workspaceId'
  ) {
    return {
      ok: false,
      message: 'Presentation override registry fields are incompatible.',
    };
  }
  if (value.schemaVersion !== PRESENTATION_OVERRIDE_SCHEMA_VERSION) {
    return {
      ok: false,
      message: 'Unsupported presentation override schema version.',
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
      message: `Presentation overrides belong to workspace ${JSON.stringify(value.workspaceId)}, not ${JSON.stringify(expectedWorkspaceId)}.`,
    };
  }
  if (!Array.isArray(value.entities)) {
    return {
      ok: false,
      message: 'Expected a presentation override entry array.',
    };
  }
  const entities: PresentationOverrideEntry[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of value.entities.entries()) {
    if (
      !record(entry) ||
      Object.keys(entry).sort().join(',') !== 'entityId,sizeScale'
    ) {
      return {
        ok: false,
        message: `Presentation override ${index + 1} has incompatible fields.`,
      };
    }
    if (typeof entry.entityId !== 'string' || entry.entityId.length === 0) {
      return {
        ok: false,
        message: `Presentation override ${index + 1} needs a non-empty entity ID.`,
      };
    }
    if (seen.has(entry.entityId)) {
      return {
        ok: false,
        message: `Duplicate presentation override for entity ${JSON.stringify(entry.entityId)}.`,
      };
    }
    if (!isValidNodeSizeScale(entry.sizeScale)) {
      return {
        ok: false,
        message: `Presentation override ${index + 1} needs a finite size scale from ${NODE_SIZE_SCALE_RANGE.min} to ${NODE_SIZE_SCALE_RANGE.max}.`,
      };
    }
    seen.add(entry.entityId);
    entities.push({ entityId: entry.entityId, sizeScale: entry.sizeScale });
  }
  entities.sort((left, right) =>
    left.entityId < right.entityId
      ? -1
      : left.entityId > right.entityId
        ? 1
        : 0,
  );
  return {
    ok: true,
    value: {
      schemaVersion: PRESENTATION_OVERRIDE_SCHEMA_VERSION,
      workspaceId: value.workspaceId,
      entities,
    },
  };
}

function validated(
  value: unknown,
  workspaceId?: string,
): PresentationOverrideRegistry {
  const result = validatePresentationOverrideRegistry(value, workspaceId);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

export function createEmptyPresentationOverrideRegistry(
  workspaceId: string,
): PresentationOverrideRegistry {
  return validated({
    schemaVersion: PRESENTATION_OVERRIDE_SCHEMA_VERSION,
    workspaceId,
    entities: [],
  });
}

export function serializePresentationOverrideRegistry(
  registry: PresentationOverrideRegistry,
): string {
  return JSON.stringify(validated(registry));
}

/** Pure mutation; callers must authorize a canonical Document before editing. */
export function setEntitySizeScale(
  registry: PresentationOverrideRegistry,
  entityId: EntityId,
  sizeScale: number | undefined,
): PresentationOverrideRegistry {
  const current = validated(registry);
  if (entityId.length === 0)
    throw new Error('Size changes need a non-empty entity ID.');
  return validated({
    ...current,
    entities: [
      ...current.entities.filter((entry) => entry.entityId !== entityId),
      ...(sizeScale === undefined ? [] : [{ entityId, sizeScale }]),
    ],
  });
}

/**
 * Retain missing IDs in the registry, but keep them inactive. Only canonical
 * document existence matters: query/projection hiding never prunes an entry.
 * Cost is O(overrides); build the canonical index once per snapshot outside.
 */
export function reconcilePresentationOverrides(
  registry: PresentationOverrideRegistry,
  entityById: ReadonlyMap<EntityId, Pick<AddressableEntity, 'kind'>>,
): EntityPresentationOverrideMap {
  return new Map(
    registry.entities
      .filter((entry) => entityById.get(entry.entityId)?.kind === 'document')
      .map(({ entityId, sizeScale }) => [entityId, { sizeScale }]),
  );
}
