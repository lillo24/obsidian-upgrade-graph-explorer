import type { SnapshotIdProvider } from './types';

function transientId(parts: readonly (number | string)[]): string {
  return `transient:${JSON.stringify(parts)}`;
}

/**
 * Deterministic identity for one parsed snapshot.
 *
 * Paths and source offsets make repeat assembly stable, but IDs are not
 * promised to survive source edits or renames. KG9 owns durable identity.
 */
export const transientSnapshotIdProvider: SnapshotIdProvider = {
  documentId: ({ workspaceId, path }) =>
    transientId(['document', workspaceId, path]),
  sectionId: ({ workspaceId, path, headingOffset }) =>
    transientId(['section', workspaceId, path, headingOffset]),
  blockId: ({ workspaceId, path, markerOffset, blockId }) =>
    transientId(['block', workspaceId, path, markerOffset, blockId]),
  referenceId: ({ workspaceId, path, sourceOffset }) =>
    transientId(['reference', workspaceId, path, sourceOffset]),
};
