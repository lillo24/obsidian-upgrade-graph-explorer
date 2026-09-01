export {
  assignPrimaryVisualGroupPresentations,
  compileVisualGroups,
  matchingVisualGroupsForEntity,
  MAX_VISUAL_GROUP_NAME_LENGTH,
  MAX_VISUAL_GROUPS,
  resolvePrimaryVisualGroup,
  validateAndCanonicalizeVisualGroupDefinitions,
} from './compile';
export type {
  CompiledVisualGroups,
  VisualGroupCompilationResult,
} from './compile';
export {
  isVisualGroupColor,
  VISUAL_GROUP_PALETTE,
  visualGroupPaletteEntry,
} from './palette';
export type {
  VisualGroupColor,
  VisualGroupDefinition,
  VisualGroupDefinitionValidationResult,
  VisualGroupMatch,
  VisualGroupNodePresentation,
  VisualGroupPaletteEntry,
  VisualGroupPresentationMap,
  VisualGroupValidationIssue,
  VisualGroupValidationIssueCode,
} from './types';
