export type {
  AddressableEntity,
  BlockEntity,
  DocumentEntity,
  EntityKind,
  SectionEntity,
} from './model/entities';
export type { EntityId, ReferenceId, WorkspaceId } from './model/ids';
export {
  isNormalizedWorkspaceFolderKey,
  workspaceFolderKeyContainsFolder,
  workspaceFolderKeyFromPath,
  type WorkspaceFolderKey,
} from './model/folder-key';
export type {
  Reference,
  ReferenceKind,
  ReferenceResolution,
} from './model/references';
export {
  KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION,
  type KnowledgeSnapshot,
  type WorkspaceDescriptor,
} from './model/snapshot';
export type {
  SourceLocation,
  SourcePoint,
  SourceSpan,
  WorkspacePath,
} from './model/source';
export { isNormalizedWorkspacePath } from './model/source';
export {
  validateKnowledgeSnapshot,
  type SnapshotValidationIssue,
  type SnapshotValidationIssueCode,
  type SnapshotValidationResult,
} from './model/validation';
