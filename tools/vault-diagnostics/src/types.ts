import type {
  DiagnosticPipelineTimings,
  DiagnosticReportSummary,
  ObsidianDiagnosticReport,
  SyntheticSourceDocument,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import type { WorkspacePath } from '@icarus-graph-explorer/core';

export interface VaultDiscovery {
  readonly markdownDocuments: readonly SyntheticSourceDocument[];
  readonly nonMarkdownPaths: readonly WorkspacePath[];
}

export interface VaultDiagnosticOptions {
  readonly vaultPath: string;
  readonly workspaceId: string;
  readonly excludes: readonly string[];
}

export interface PipelineSourceInput {
  readonly workspaceId: string;
  readonly markdownDocuments: readonly SyntheticSourceDocument[];
  readonly nonMarkdownPaths: readonly WorkspacePath[];
  readonly discoveryReadMs: number;
}

export interface VaultDiagnosticRun {
  readonly report: ObsidianDiagnosticReport;
  readonly serializedReport: string;
  readonly summary: DiagnosticReportSummary;
  readonly timings: DiagnosticPipelineTimings;
}

export interface DiagnosticCliOptions extends VaultDiagnosticOptions {
  readonly outputPath?: string;
  readonly verbose: boolean;
}
