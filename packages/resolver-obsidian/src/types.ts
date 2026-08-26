import type { ParsedObsidianDocument } from '@icarus-graph-explorer/adapter-obsidian';
import type {
  EntityId,
  KnowledgeSnapshot,
  ReferenceId,
  SourceSpan,
  WorkspaceId,
  WorkspacePath,
} from '@icarus-graph-explorer/core';

export interface DocumentIdInput {
  readonly workspaceId: WorkspaceId;
  readonly path: WorkspacePath;
}

export interface SectionIdInput extends DocumentIdInput {
  readonly headingOffset: number;
}

export interface BlockIdInput extends DocumentIdInput {
  readonly markerOffset: number;
  readonly blockId: string;
}

export interface ReferenceIdInput extends DocumentIdInput {
  readonly sourceOffset: number;
}

/** Replaceable identity seam; KG4's default is deterministic but transient. */
export interface SnapshotIdProvider {
  documentId(input: DocumentIdInput): EntityId;
  sectionId(input: SectionIdInput): EntityId;
  blockId(input: BlockIdInput): EntityId;
  referenceId(input: ReferenceIdInput): ReferenceId;
}

export interface ResolveObsidianWorkspaceInput {
  readonly workspaceId: WorkspaceId;
  readonly documents: readonly ParsedObsidianDocument[];
  readonly idProvider?: SnapshotIdProvider;
}

export type WorkspaceResolutionDiagnosticCode =
  | 'invalid-workspace-id'
  | 'invalid-document-path'
  | 'duplicate-document-path'
  | 'invalid-source-structure'
  | 'id-provider-failure'
  | 'id-collision'
  | 'adapter-diagnostic'
  | 'unresolved-target'
  | 'ambiguous-target'
  | 'invalid-target'
  | 'unsupported-target'
  | 'canonical-validation';

/** Resolver and forwarded adapter information kept outside canonical truth. */
export interface WorkspaceResolutionDiagnostic {
  readonly code: WorkspaceResolutionDiagnosticCode;
  readonly severity: 'warning' | 'error';
  readonly fatal: boolean;
  readonly message: string;
  readonly sourcePath?: WorkspacePath;
  readonly sourceSpan?: SourceSpan;
  readonly relatedCode?: string;
}

export type WorkspaceResolutionResult =
  | {
      readonly ok: true;
      readonly snapshot: KnowledgeSnapshot;
      readonly diagnostics: readonly WorkspaceResolutionDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly WorkspaceResolutionDiagnostic[];
    };
