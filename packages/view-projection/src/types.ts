import type {
  EntityId,
  EntityKind,
  ReferenceId,
  WorkspacePath,
} from '@icarus-graph-explorer/core';

export type ProjectionNodeId = string;
export type ProjectionEdgeId = string;
export type ReferenceResolutionStatus =
  'resolved' | 'unresolved' | 'ambiguous' | 'invalid';
export type SectionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export const STRUCTURAL_DEPTHS = [0, 1, 2, 3] as const;
export type StructuralDepth = (typeof STRUCTURAL_DEPTHS)[number];
export type DiagnosticReferenceStatus = Exclude<
  ReferenceResolutionStatus,
  'resolved'
>;

export interface StructuralDisclosureState {
  /** Automatic canonical section-tree generations; Blocks are never included. */
  readonly defaultDepth: StructuralDepth;
  /** Optional literal Markdown heading ceiling; absent means no limit. */
  readonly maxSectionLevel?: SectionHeadingLevel;
  /** Reveals an entity's immediate children, subject to collapse precedence. */
  readonly expandedEntityIds: readonly EntityId[];
  /** Hides an entity's descendants without hiding the entity itself. */
  readonly collapsedEntityIds: readonly EntityId[];
  /** Blocks still require their visible parent to be explicitly expanded. */
  readonly includeBlocks: boolean;
}

export interface FocusProjectionState {
  readonly rootEntityId: EntityId;
  readonly hops: 1 | 2 | 3;
  readonly direction: 'incoming' | 'outgoing' | 'both';
  readonly hierarchyContext: 'ancestors' | 'ancestors-and-children';
}

export interface ViewProjectionFilters {
  /** Normalized workspace-relative path or folder prefixes. */
  readonly pathPrefixes?: readonly WorkspacePath[];
  /** Case-insensitive match over projected paths, section titles, and raw diagnostic targets. */
  readonly text?: string;
  readonly entityKinds?: readonly EntityKind[];
  readonly referenceStatuses?: readonly ReferenceResolutionStatus[];
}

export interface ViewProjectionState {
  readonly disclosure: StructuralDisclosureState;
  readonly focus?: FocusProjectionState;
  readonly filters?: ViewProjectionFilters;
}

export interface ProjectedEntityNode {
  readonly id: ProjectionNodeId;
  readonly kind: 'entity';
  readonly entityId: EntityId;
  readonly entityKind: EntityKind;
  readonly sourcePath: WorkspacePath;
  readonly sourceStartLine: number;
  readonly title: string | null;
  /** Descendants that one explicit Expand action can reveal in the final view. */
  readonly revealableDescendantCount: number;
  readonly internalReferenceIds: readonly ReferenceId[];
  readonly role: 'content' | 'context';
  readonly focusDistance: number | null;
}

export interface ProjectedReferenceTargetNode {
  readonly id: ProjectionNodeId;
  readonly kind: 'reference-target';
  readonly status: DiagnosticReferenceStatus;
  readonly rawTarget: string;
  readonly referenceIds: readonly ReferenceId[];
  /** Empty for unresolved/invalid targets; canonical IDs for ambiguous targets. */
  readonly candidateEntityIds: readonly EntityId[];
  /** Stable distinct canonical resolution reasons, when supplied. */
  readonly reasons: readonly string[];
}

export type ProjectedNode = ProjectedEntityNode | ProjectedReferenceTargetNode;

export interface ProjectedHierarchyEdge {
  readonly id: ProjectionEdgeId;
  readonly kind: 'hierarchy';
  readonly sourceNodeId: ProjectionNodeId;
  readonly targetNodeId: ProjectionNodeId;
}

export interface ProjectedReferenceEdge {
  readonly id: ProjectionEdgeId;
  readonly kind: 'reference';
  readonly sourceNodeId: ProjectionNodeId;
  readonly targetNodeId: ProjectionNodeId;
  readonly status: ReferenceResolutionStatus;
  readonly referenceIds: readonly ReferenceId[];
}

export type ProjectedEdge = ProjectedHierarchyEdge | ProjectedReferenceEdge;

export type ProjectionIssueCode =
  | 'unknown-expanded-entity'
  | 'unknown-collapsed-entity'
  | 'conflicting-disclosure-state'
  | 'unknown-focus-root'
  | 'hidden-focus-root'
  | 'invalid-path-prefix';

export interface ProjectionIssue {
  readonly code: ProjectionIssueCode;
  readonly subject: string;
  readonly message: string;
}

export interface ViewProjection {
  readonly nodes: readonly ProjectedNode[];
  readonly edges: readonly ProjectedEdge[];
  readonly issues: readonly ProjectionIssue[];
}

export type ViewProjectionValidationIssueCode =
  | 'invalid-shape'
  | 'duplicate-node-id'
  | 'duplicate-edge-id'
  | 'missing-edge-endpoint'
  | 'missing-canonical-entity'
  | 'missing-canonical-reference'
  | 'duplicate-provenance'
  | 'invalid-hierarchy-edge'
  | 'invalid-reference-edge'
  | 'invalid-diagnostic-target'
  | 'invalid-focus-metadata';

export interface ViewProjectionValidationIssue {
  readonly code: ViewProjectionValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export type ViewProjectionValidationResult =
  | {
      readonly valid: true;
      readonly value: ViewProjection;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly ViewProjectionValidationIssue[];
    };
