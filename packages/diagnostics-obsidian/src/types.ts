import type { ParsedObsidianDocument } from '@icarus-graph-explorer/adapter-obsidian';
import type {
  EntityId,
  KnowledgeSnapshot,
  ReferenceId,
  WorkspacePath,
} from '@icarus-graph-explorer/core';
import type { WorkspaceResolutionDiagnostic } from '@icarus-graph-explorer/resolver-obsidian';

export const OBSIDIAN_DIAGNOSTIC_REPORT_SCHEMA_VERSION = 1 as const;

export type CompatibilityProbeCode =
  | 'case-only-file-match'
  | 'case-only-heading-match'
  | 'attachment-present-unmodeled'
  | 'attachment-not-found'
  | 'attachment-match-ambiguous';

/** Non-canonical evidence that never changes KG4 resolution truth. */
export interface CompatibilityProbe {
  readonly code: CompatibilityProbeCode;
  readonly referenceId: ReferenceId;
  readonly message: string;
  readonly candidateEntityIds?: readonly EntityId[];
  readonly candidatePaths?: readonly WorkspacePath[];
}

export interface DiagnosticSourceInventory {
  readonly markdownFileCount: number;
  readonly nonMarkdownFileCount: number;
}

/** Coarse local evidence only; KG5 defines no performance budgets. */
export interface DiagnosticPipelineTimings {
  readonly discoveryReadMs: number;
  readonly parseAdaptMs: number;
  readonly resolutionMs: number;
  readonly reportConstructionMs: number;
  readonly reportSerializationMs: number;
}

export interface ObsidianDiagnosticReport {
  readonly schemaVersion: typeof OBSIDIAN_DIAGNOSTIC_REPORT_SCHEMA_VERSION;
  readonly snapshot: KnowledgeSnapshot;
  readonly diagnostics: readonly WorkspaceResolutionDiagnostic[];
  readonly probes: readonly CompatibilityProbe[];
  readonly sourceInventory: DiagnosticSourceInventory;
  readonly timings?: DiagnosticPipelineTimings;
}

export interface BuildObsidianDiagnosticReportInput {
  readonly snapshot: KnowledgeSnapshot;
  readonly diagnostics: readonly WorkspaceResolutionDiagnostic[];
  readonly documents: readonly ParsedObsidianDocument[];
  readonly nonMarkdownPaths?: readonly WorkspacePath[];
  readonly timings?: DiagnosticPipelineTimings;
}

export interface DiagnosticReportValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type DiagnosticReportValidationResult =
  | {
      readonly valid: true;
      readonly value: ObsidianDiagnosticReport;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly DiagnosticReportValidationIssue[];
    };

export interface SyntheticWorkspaceConfig {
  readonly documentCount: number;
  readonly sectionsPerDocument: number;
  readonly nestedDepth: number;
  readonly resolvedReferencesPerSection: number;
  readonly unresolvedReferencesPerSection: number;
  readonly ambiguousReferencesPerSection: number;
}

export interface SyntheticSourceDocument {
  readonly path: WorkspacePath;
  readonly source: string;
}
