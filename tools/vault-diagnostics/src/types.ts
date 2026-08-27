import type {
  DiagnosticPipelineTimings,
  DiagnosticReportSummary,
  ObsidianDiagnosticReport,
  SyntheticSourceDocument,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import type { WorkspacePath } from '@icarus-graph-explorer/core';
import type {
  StableIdentityCatalog,
  StableIdentityReconciliationResult,
} from '@icarus-graph-explorer/stable-identity';

export interface VaultDiscovery {
  readonly markdownDocuments: readonly SyntheticSourceDocument[];
  readonly nonMarkdownPaths: readonly WorkspacePath[];
}

export interface VaultDiagnosticOptions {
  readonly vaultPath: string;
  readonly workspaceId: string;
  readonly excludes: readonly string[];
  readonly identityCatalog?: StableIdentityCatalog;
}

export interface PipelineSourceInput {
  readonly workspaceId: string;
  readonly markdownDocuments: readonly SyntheticSourceDocument[];
  readonly nonMarkdownPaths: readonly WorkspacePath[];
  readonly discoveryReadMs: number;
  readonly identityCatalog?: StableIdentityCatalog;
}

export interface VaultDiagnosticRun {
  readonly report: ObsidianDiagnosticReport;
  readonly serializedReport: string;
  readonly summary: DiagnosticReportSummary;
  readonly timings: DiagnosticPipelineTimings;
  readonly identity?: StableIdentityReconciliationResult & {
    readonly reconciliationMs: number;
  };
}

export interface DiagnosticCliOptions extends VaultDiagnosticOptions {
  readonly outputPath?: string;
  readonly identityStorePath?: string;
  readonly resetIdentity: boolean;
  readonly workspaceIdWasExplicit: boolean;
  readonly verbose: boolean;
}
