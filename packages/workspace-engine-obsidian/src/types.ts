import type { ParsedObsidianDocument } from '@icarus-graph-explorer/adapter-obsidian';
import type {
  KnowledgeSnapshot,
  WorkspaceId,
  WorkspacePath,
} from '@icarus-graph-explorer/core';
import type { WorkspaceResolutionDiagnostic } from '@icarus-graph-explorer/resolver-obsidian';
import type { KnowledgeSnapshotDelta } from '@icarus-graph-explorer/snapshot-delta';
import type {
  StableIdentityCatalog,
  StableIdentityReconciliationDiagnostic,
  StableIdentityReconciliationSummary,
} from '@icarus-graph-explorer/stable-identity';

export interface WorkspaceSourceDocument {
  readonly path: WorkspacePath;
  readonly source: string;
}

export type WorkspaceSourceChange =
  | {
      readonly kind: 'upsert';
      readonly path: WorkspacePath;
      readonly source: string;
    }
  | { readonly kind: 'delete'; readonly path: WorkspacePath }
  | {
      readonly kind: 'move';
      readonly fromPath: WorkspacePath;
      readonly toPath: WorkspacePath;
    };

export interface ObsidianWorkspaceEngine {
  readonly workspaceId: WorkspaceId;
  readonly revision: number;
  readonly snapshot: KnowledgeSnapshot;
  readonly identityCatalog: StableIdentityCatalog;
  readonly resolutionDiagnostics: readonly WorkspaceResolutionDiagnostic[];
  readonly parsedDocumentCount: number;
  parsedDocument(path: WorkspacePath): ParsedObsidianDocument | undefined;
  parsedDocuments(): readonly ParsedObsidianDocument[];
}

export type WorkspaceEngineFailureStage =
  'input' | 'parse' | 'resolution' | 'identity' | 'delta';

export interface WorkspaceEngineFailure {
  readonly stage: WorkspaceEngineFailureStage;
  readonly code: string;
  readonly message: string;
  readonly path?: WorkspacePath;
}

export interface WorkspaceEngineParseStats {
  readonly reparsedPaths: readonly WorkspacePath[];
  readonly reusedParsedDocumentCount: number;
  readonly totalParsedDocumentCount: number;
}

export interface InitializeObsidianWorkspaceEngineInput {
  readonly workspaceId: WorkspaceId;
  readonly documents: readonly WorkspaceSourceDocument[];
  readonly identityCatalog?: StableIdentityCatalog;
}

export type InitializeObsidianWorkspaceEngineResult =
  | {
      readonly ok: true;
      readonly engine: ObsidianWorkspaceEngine;
      readonly snapshot: KnowledgeSnapshot;
      readonly identityCatalog: StableIdentityCatalog;
      readonly resolutionDiagnostics: readonly WorkspaceResolutionDiagnostic[];
      readonly identitySummary: StableIdentityReconciliationSummary;
      readonly identityDiagnostics: readonly StableIdentityReconciliationDiagnostic[];
      readonly stats: WorkspaceEngineParseStats;
    }
  | { readonly ok: false; readonly failure: WorkspaceEngineFailure };

export type ApplyObsidianWorkspaceChangesResult =
  | {
      readonly ok: true;
      readonly engine: ObsidianWorkspaceEngine;
      readonly snapshot: KnowledgeSnapshot;
      readonly delta: KnowledgeSnapshotDelta;
      readonly identityCatalog: StableIdentityCatalog;
      readonly resolutionDiagnostics: readonly WorkspaceResolutionDiagnostic[];
      readonly identitySummary: StableIdentityReconciliationSummary;
      readonly identityDiagnostics: readonly StableIdentityReconciliationDiagnostic[];
      readonly stats: WorkspaceEngineParseStats;
      readonly fromRevision: number;
      readonly toRevision: number;
    }
  | { readonly ok: false; readonly failure: WorkspaceEngineFailure };
