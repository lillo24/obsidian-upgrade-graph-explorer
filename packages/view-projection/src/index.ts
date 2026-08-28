export {
  documentOnlyProjectionState,
  topLevelSectionProjectionState,
} from './presets';
export { projectSnapshot, projectView } from './project';
export { revealEntityInViewState } from './reveal';
export type {
  DiagnosticReferenceStatus,
  FocusProjectionState,
  ProjectedEdge,
  ProjectedEntityNode,
  ProjectedHierarchyEdge,
  ProjectedNode,
  ProjectedReferenceEdge,
  ProjectedReferenceTargetNode,
  ProjectionEdgeId,
  ProjectionIssue,
  ProjectionIssueCode,
  ProjectionNodeId,
  ReferenceResolutionStatus,
  SectionHeadingLevel,
  StructuralDisclosureState,
  ViewProjection,
  ViewProjectionFilters,
  ViewProjectionState,
  ViewProjectionValidationIssue,
  ViewProjectionValidationIssueCode,
  ViewProjectionValidationResult,
} from './types';
export { validateViewProjection } from './validation';
export { createProjectionWorkspace, ProjectionWorkspace } from './workspace';
