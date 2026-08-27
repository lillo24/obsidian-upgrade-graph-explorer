import { performance } from 'node:perf_hooks';

import { parseObsidianDocument } from '@icarus-graph-explorer/adapter-obsidian';
import {
  buildObsidianDiagnosticReport,
  summarizeDiagnosticReport,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import { resolveObsidianWorkspace } from '@icarus-graph-explorer/resolver-obsidian';
import { reconcileStableIdentity } from '@icarus-graph-explorer/stable-identity';

import { discoverVault } from './discovery';
import type {
  PipelineSourceInput,
  VaultDiagnosticOptions,
  VaultDiagnosticRun,
} from './types';

function elapsed(start: number): number {
  return Number((performance.now() - start).toFixed(3));
}

export function buildReportFromSources(
  input: PipelineSourceInput,
): VaultDiagnosticRun {
  const parseStart = performance.now();
  const documents = input.markdownDocuments.map(parseObsidianDocument);
  const parseAdaptMs = elapsed(parseStart);

  const resolutionStart = performance.now();
  const resolution = resolveObsidianWorkspace({
    workspaceId: input.workspaceId,
    documents,
  });
  const resolutionMs = elapsed(resolutionStart);
  if (!resolution.ok) {
    const first = resolution.diagnostics.find(({ fatal }) => fatal);
    throw new Error(
      `Workspace resolution failed${first === undefined ? '.' : `: ${first.message}`}`,
    );
  }

  const identityStart = performance.now();
  const identity =
    input.identityCatalog === undefined
      ? undefined
      : {
          ...reconcileStableIdentity({
            snapshot: resolution.snapshot,
            previousCatalog: input.identityCatalog,
          }),
          reconciliationMs: elapsed(identityStart),
        };
  const snapshot = identity?.snapshot ?? resolution.snapshot;

  const reportStart = performance.now();
  const evidenceReport = buildObsidianDiagnosticReport({
    snapshot,
    diagnostics: resolution.diagnostics,
    documents,
    identity: { stability: identity === undefined ? 'transient' : 'stable' },
    nonMarkdownPaths: input.nonMarkdownPaths,
  });
  const reportConstructionMs = elapsed(reportStart);

  const serializationStart = performance.now();
  JSON.stringify(evidenceReport);
  const reportSerializationMs = elapsed(serializationStart);
  const timings = {
    discoveryReadMs: input.discoveryReadMs,
    parseAdaptMs,
    resolutionMs,
    reportConstructionMs,
    reportSerializationMs,
  };
  const report = buildObsidianDiagnosticReport({
    snapshot,
    diagnostics: resolution.diagnostics,
    documents,
    identity: { stability: identity === undefined ? 'transient' : 'stable' },
    nonMarkdownPaths: input.nonMarkdownPaths,
    timings,
  });
  return {
    report,
    serializedReport: `${JSON.stringify(report, null, 2)}\n`,
    summary: summarizeDiagnosticReport(report),
    timings,
    ...(identity === undefined ? {} : { identity }),
  };
}

export async function runVaultDiagnostics(
  options: VaultDiagnosticOptions,
): Promise<VaultDiagnosticRun> {
  const discoveryStart = performance.now();
  const discovery = await discoverVault(options.vaultPath, options.excludes);
  const discoveryReadMs = elapsed(discoveryStart);
  return buildReportFromSources({
    workspaceId: options.workspaceId,
    markdownDocuments: discovery.markdownDocuments,
    nonMarkdownPaths: discovery.nonMarkdownPaths,
    discoveryReadMs,
    ...(options.identityCatalog === undefined
      ? {}
      : { identityCatalog: options.identityCatalog }),
  });
}
