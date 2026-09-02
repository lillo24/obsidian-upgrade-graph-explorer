export {
  documentOnlyProjectionState,
  structuralDepthProjectionState,
  topLevelSectionProjectionState,
} from './presets';
export { STRUCTURAL_DEPTHS } from './types';
export { projectSnapshot, projectView } from './project';
export type {
  ProjectionInstrumentation,
  ProjectionOperation,
  ProjectionPhase,
} from './instrumentation';
export { projectStructureView } from './structure';
export {
  containingDocumentEntityId,
  deriveLocalProjectionState,
  projectLocalView,
} from './local';
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
  StructuralDepth,
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
