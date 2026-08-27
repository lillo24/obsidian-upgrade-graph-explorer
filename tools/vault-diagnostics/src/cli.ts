import { diagnosticCliHelp, parseDiagnosticCliArguments } from './arguments';
import {
  prepareIdentityStore,
  writeIdentityCatalogAtomically,
} from './identity-store';
import { writePrivateReport } from './output';
import { runVaultDiagnostics } from './pipeline';

async function main(): Promise<void> {
  const options = parseDiagnosticCliArguments(process.argv.slice(2));
  if ('help' in options) {
    console.log(diagnosticCliHelp());
    return;
  }
  const identityStore =
    options.identityStorePath === undefined
      ? undefined
      : await prepareIdentityStore({
          vaultPath: options.vaultPath,
          identityStorePath: options.identityStorePath,
          reset: options.resetIdentity,
          ...(options.workspaceIdWasExplicit
            ? { explicitWorkspaceId: options.workspaceId }
            : {}),
        });
  const run = await runVaultDiagnostics({
    vaultPath: options.vaultPath,
    workspaceId: identityStore?.catalog.workspaceId ?? options.workspaceId,
    excludes: options.excludes,
    ...(identityStore === undefined
      ? {}
      : { identityCatalog: identityStore.catalog }),
  });
  if (options.outputPath !== undefined) {
    await writePrivateReport(options.outputPath, run.serializedReport);
  }
  if (options.identityStorePath !== undefined) {
    if (run.identity === undefined) {
      throw new Error(
        'Persistent run completed without a reconciled identity catalog.',
      );
    }
    await writeIdentityCatalogAtomically(
      options.identityStorePath,
      run.identity.catalog,
    );
  }
  const output = {
    status: 'success',
    workspaceId: run.report.snapshot.workspace.id,
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
    ...(options.identityStorePath === undefined
      ? {}
      : {
          identityStoreWritten: options.identityStorePath,
          identityReset: options.resetIdentity,
        }),
    ...(options.verbose
      ? {
          timingsMs: run.timings,
          ...(run.identity === undefined
            ? {}
            : {
                identity: {
                  reconciliationMs: run.identity.reconciliationMs,
                  summary: run.identity.summary,
                  diagnosticCounts: Object.fromEntries(
                    [
                      ...new Set(
                        run.identity.diagnostics.map(({ code }) => code),
                      ),
                    ]
                      .sort()
                      .map((code) => [
                        code,
                        run.identity?.diagnostics.filter(
                          (diagnostic) => diagnostic.code === code,
                        ).length ?? 0,
                      ]),
                  ),
                },
              }),
        }
      : {}),
  };
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Vault diagnostics failed: ${message}`);
  process.exitCode = 1;
});
