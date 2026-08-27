export {
  describeEntity,
  describeReference,
  entityDisplayName,
  formatSourceProvenance,
} from './descriptors';
export { inspectEntity } from './entity-inspection';
export {
  inspectProjectedEdge,
  inspectProjectedNode,
} from './projection-inspection';
export { searchEntities } from './search';
export type {
  AmbiguousCandidateMentionInspection,
  BacklinkInspection,
  BreadcrumbPart,
  EntityDescriptor,
  EntityInspection,
  EntitySearchResult,
  OccurrenceResolutionDescriptor,
  OutgoingReferenceInspection,
  ProjectedDiagnosticInspection,
  ProjectedEdgeInspection,
  ProjectedEntityInspection,
  ProjectedHierarchyEdgeInspection,
  ProjectedNodeInspection,
  ProjectedOccurrenceInspection,
  ProjectedReferenceEdgeInspection,
  ReferenceOccurrenceDescriptor,
  SearchEntitiesOptions,
  SearchMatchKind,
} from './types';
export { createInspectionWorkspace, InspectionWorkspace } from './workspace';
