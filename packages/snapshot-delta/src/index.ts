export { applyKnowledgeSnapshotDelta } from './apply';
export { diffKnowledgeSnapshots } from './diff';
export {
  KNOWLEDGE_SNAPSHOT_DELTA_SCHEMA_VERSION,
  type AddedRecord,
  type KnowledgeSnapshotDelta,
  type RemovedRecord,
  type SnapshotCollectionDelta,
  type SnapshotDeltaValidationIssue,
  type SnapshotDeltaValidationResult,
  type UpdatedRecord,
} from './types';
export { validateKnowledgeSnapshotDelta } from './validation';
