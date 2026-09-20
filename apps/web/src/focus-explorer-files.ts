import type { EntityId } from '@icarus-graph-explorer/core';
import { entityDisplayName } from '@icarus-graph-explorer/explorer-inspection';
import type {
  ProjectedEntityNode,
  ProjectionNodeId,
  ProjectionWorkspace,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import {
  createSourceFolders,
  type SourceFolders,
} from './network-explorer-folders';

export interface FocusExplorerFile {
  readonly id: ProjectionNodeId;
  readonly entityId: EntityId;
  readonly sourcePath: string;
  readonly name: string;
  readonly folderContext: string;
  readonly focusRoot: boolean;
}

export interface FocusExplorerFilesModel extends SourceFolders<FocusExplorerFile> {
  readonly files: readonly FocusExplorerFile[];
  readonly fileById: ReadonlyMap<ProjectionNodeId, FocusExplorerFile>;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Lists only File modules already present in the current Focus projection. */
export function createFocusExplorerFilesModel(
  projection: Pick<ViewProjection, 'nodes'>,
  workspace: ProjectionWorkspace,
  focusDocumentEntityId: EntityId,
): FocusExplorerFilesModel {
  const files = projection.nodes
    .filter(
      (node): node is ProjectedEntityNode =>
        node.kind === 'entity' && node.entityKind === 'document',
    )
    .sort(
      (left, right) =>
        compareText(left.sourcePath, right.sourcePath) ||
        left.sourceStartLine - right.sourceStartLine ||
        compareText(left.id, right.id),
    )
    .map((node): FocusExplorerFile => {
      const entity = workspace.requireEntity(node.entityId);
      const folder = node.sourcePath.split('/').slice(0, -1).join('/');
      return {
        id: node.id,
        entityId: node.entityId,
        sourcePath: node.sourcePath,
        name: entityDisplayName(entity),
        folderContext: folder.length === 0 ? 'Workspace root' : folder,
        focusRoot: node.entityId === focusDocumentEntityId,
      };
    });
  return {
    files,
    fileById: new Map(files.map((file) => [file.id, file])),
    ...createSourceFolders(files, () => true),
  };
}
