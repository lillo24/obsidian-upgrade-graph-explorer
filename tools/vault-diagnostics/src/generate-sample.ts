import { fileURLToPath } from 'node:url';

import { parseObsidianDocument } from '@icarus-graph-explorer/adapter-obsidian';
import { buildObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import { resolveObsidianWorkspace } from '@icarus-graph-explorer/resolver-obsidian';
import { format } from 'prettier';

import { discoverVault } from './discovery';
import { writePrivateReport } from './output';

async function main(): Promise<void> {
  const vaultPath = fileURLToPath(
    new URL(
      '../../../tests/fixtures/workspaces/diagnostic-sample/input/',
      import.meta.url,
    ),
  );
  const outputPath = fileURLToPath(
    new URL('../../../apps/web/src/sample-report.json', import.meta.url),
  );
  const discovery = await discoverVault(vaultPath, []);
  const documents = discovery.markdownDocuments.map(parseObsidianDocument);
  const resolution = resolveObsidianWorkspace({
    workspaceId: 'diagnostic-sample',
    documents,
  });
  if (!resolution.ok) {
    throw new Error(
      `Synthetic workspace resolution failed: ${resolution.diagnostics[0]?.message ?? 'unknown failure'}`,
    );
  }
  const report = buildObsidianDiagnosticReport({
    snapshot: resolution.snapshot,
    diagnostics: resolution.diagnostics,
    documents,
    nonMarkdownPaths: discovery.nonMarkdownPaths,
  });
  const serializedReport = await format(JSON.stringify(report), {
    parser: 'json',
  });
  await writePrivateReport(outputPath, serializedReport);
  console.log(
    JSON.stringify({
      status: 'sample-generated',
      documents: documents.length,
      references: report.snapshot.references.length,
      diagnostics: report.diagnostics.length,
      probes: report.probes.length,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Synthetic report generation failed: ${message}`);
  process.exitCode = 1;
});
