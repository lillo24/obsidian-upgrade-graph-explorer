import { diagnosticCliHelp, parseDiagnosticCliArguments } from './arguments';
import { writePrivateReport } from './output';
import { runVaultDiagnostics } from './pipeline';

async function main(): Promise<void> {
  const options = parseDiagnosticCliArguments(process.argv.slice(2));
  if ('help' in options) {
    console.log(diagnosticCliHelp());
    return;
  }
  const run = await runVaultDiagnostics(options);
  if (options.outputPath !== undefined) {
    await writePrivateReport(options.outputPath, run.serializedReport);
  }
  const output = {
    status: 'success',
    workspaceId: options.workspaceId,
    sourceInventory: run.report.sourceInventory,
    summary: run.summary,
    probeCounts: Object.fromEntries(
      [...new Set(run.report.probes.map(({ code }) => code))]
        .sort()
        .map((code) => [
          code,
          run.report.probes.filter((probe) => probe.code === code).length,
        ]),
    ),
    ...(options.outputPath === undefined
      ? {}
      : { reportWritten: options.outputPath }),
    ...(options.verbose ? { timingsMs: run.timings } : {}),
  };
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Vault diagnostics failed: ${message}`);
  process.exitCode = 1;
});
