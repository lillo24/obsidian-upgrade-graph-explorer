import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';

/** Rebuilt only with topology, never by a slider tick. Supports repeated File keys. */
export function indexFileNodeKeys(
  nodes: readonly {
    key: string;
    attributes: { nodeKind: string; entityId: string | null };
  }[],
): ReadonlyMap<string, readonly string[]> {
  const result = new Map<string, string[]>();
  for (const { key, attributes } of nodes) {
    if (attributes.nodeKind !== 'document' || attributes.entityId === null)
      continue;
    const keys = result.get(attributes.entityId);
    if (keys === undefined) result.set(attributes.entityId, [key]);
    else keys.push(key);
  }
  return result;
}

/** O(stored overrides), plus visible keys of changed Files; no graph-wide scan. */
export function changedFileSizeNodeKeys(
  previous: EntityPresentationOverrideMap | undefined,
  next: EntityPresentationOverrideMap | undefined,
  fileNodeKeys: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  if (previous === next) return [];
  const changed = new Set<string>();
  for (const [id, value] of previous ?? [])
    if (value.sizeScale !== next?.get(id)?.sizeScale) changed.add(id);
  for (const [id, value] of next ?? [])
    if (value.sizeScale !== previous?.get(id)?.sizeScale) changed.add(id);
  return [...changed].flatMap((id) => fileNodeKeys.get(id) ?? []);
}
