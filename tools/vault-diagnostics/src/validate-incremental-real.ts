import { performance } from 'node:perf_hooks';

import { applyKnowledgeSnapshotDelta } from '@icarus-graph-explorer/snapshot-delta';
import {
  applyObsidianWorkspaceChanges,
  initializeObsidianWorkspaceEngine,
} from '@icarus-graph-explorer/workspace-engine-obsidian';

import { parseDiagnosticCliArguments } from './arguments';
import { discoverVault } from './discovery';
import { prepareIdentityStore } from './identity-store';

function elapsed(start: number): number {
  return Number((performance.now() - start).toFixed(3));
}

async function main(): Promise<void> {
  const options = parseDiagnosticCliArguments(process.argv.slice(2));
  if ('help' in options) {
    throw new Error(
      'Usage: pnpm --filter @icarus-graph-explorer/vault-diagnostics validate:incremental-real -- --vault <path> --identity-store <path> [--exclude <prefix>]',
    );
  }
  if (options.identityStorePath === undefined) {
    throw new Error('Real incremental validation requires --identity-store.');
  }
  const discovery = await discoverVault(options.vaultPath, options.excludes);
  const prepared = await prepareIdentityStore({
    vaultPath: options.vaultPath,
    identityStorePath: options.identityStorePath,
    reset: false,
  });
  if (prepared.created) {
    throw new Error(
      'Real incremental validation requires an existing stable identity catalog.',
    );
  }
  const initializationStart = performance.now();
  const initialized = initializeObsidianWorkspaceEngine({
    workspaceId: prepared.catalog.workspaceId,
    documents: discovery.markdownDocuments,
    identityCatalog: prepared.catalog,
  });
  const initializationMs = elapsed(initializationStart);
  if (!initialized.ok) {
    throw new Error(
      `Real incremental initialization failed at ${initialized.failure.stage}: ${initialized.failure.message}`,
    );
  }
  const selected = discovery.markdownDocuments[0];
  if (selected === undefined) {
    throw new Error('Real incremental validation requires one Markdown file.');
  }
  const revisedSource = `${selected.source}\n\n<!-- kg10 in-memory validation -->\n`;
  const incrementalStart = performance.now();
  const incremental = applyObsidianWorkspaceChanges(initialized.engine, [
    { kind: 'upsert', path: selected.path, source: revisedSource },
  ]);
  const incrementalMs = elapsed(incrementalStart);
  if (!incremental.ok) {
    throw new Error(
      `Real incremental update failed at ${incremental.failure.stage}: ${incremental.failure.message}`,
    );
  }
  const revisedDocuments = discovery.markdownDocuments.map((document) =>
    document.path === selected.path
      ? { path: document.path, source: revisedSource }
      : document,
  );
  const fullStart = performance.now();
  const full = initializeObsidianWorkspaceEngine({
    workspaceId: initialized.engine.workspaceId,
    documents: revisedDocuments,
    identityCatalog: initialized.engine.identityCatalog,
  });
  const fullRebuildMs = elapsed(fullStart);
  if (!full.ok) {
    throw new Error(
      `Real full-rebuild oracle failed at ${full.failure.stage}: ${full.failure.message}`,
    );
  }
  const snapshotEqual =
    JSON.stringify(incremental.snapshot) === JSON.stringify(full.snapshot);
  const catalogEqual =
    JSON.stringify(incremental.identityCatalog) ===
    JSON.stringify(full.identityCatalog);
  const appliedDeltaEqual =
    JSON.stringify(
      applyKnowledgeSnapshotDelta(initialized.snapshot, incremental.delta),
    ) === JSON.stringify(full.snapshot);
  if (!snapshotEqual || !catalogEqual || !appliedDeltaEqual) {
    throw new Error('Real incremental validation failed its exact oracle.');
  }
  console.log(
    JSON.stringify(
      {
        status: 'success',
        workspace: {
          documents: discovery.markdownDocuments.length,
          entities: initialized.snapshot.entities.length,
          references: initialized.snapshot.references.length,
        },
        change: {
          kind: 'in-memory-body-append',
          changedFileCount: 1,
          reparsedFileCount: incremental.stats.reparsedPaths.length,
          reusedParsedDocumentCount:
            incremental.stats.reusedParsedDocumentCount,
        },
        timingsMs: { initializationMs, incrementalMs, fullRebuildMs },
        delta: {
          entities: {
            added: incremental.delta.entities.added.length,
            removed: incremental.delta.entities.removed.length,
            updated: incremental.delta.entities.updated.length,
          },
          references: {
            added: incremental.delta.references.added.length,
            removed: incremental.delta.references.removed.length,
            updated: incremental.delta.references.updated.length,
          },
        },
        oracle: { snapshotEqual, catalogEqual, appliedDeltaEqual },
        note: 'The source edit existed only in memory; no vault file was written.',
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Real incremental validation failed: ${message}`);
  process.exitCode = 1;
}
