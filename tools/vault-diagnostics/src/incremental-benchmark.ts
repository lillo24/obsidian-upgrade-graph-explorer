import { performance } from 'node:perf_hooks';

import type { SyntheticSourceDocument } from '@icarus-graph-explorer/diagnostics-obsidian';
import { applyKnowledgeSnapshotDelta } from '@icarus-graph-explorer/snapshot-delta';
import {
  applyObsidianWorkspaceChanges,
  initializeObsidianWorkspaceEngine,
  type ObsidianWorkspaceEngine,
  type WorkspaceSourceChange,
} from '@icarus-graph-explorer/workspace-engine-obsidian';

function elapsed(start: number): number {
  return Number((performance.now() - start).toFixed(3));
}

function asDocuments(
  values: ReadonlyMap<string, string>,
): SyntheticSourceDocument[] {
  return [...values]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, source]) => ({ path, source }));
}

function applyToSources(
  values: ReadonlyMap<string, string>,
  changes: readonly WorkspaceSourceChange[],
): Map<string, string> {
  const next = new Map(values);
  for (const change of changes) {
    if (change.kind === 'upsert') next.set(change.path, change.source);
    else if (change.kind === 'delete') next.delete(change.path);
    else {
      const source = next.get(change.fromPath);
      if (source === undefined) {
        throw new Error('Incremental benchmark move source is missing.');
      }
      next.delete(change.fromPath);
      next.set(change.toPath, source);
    }
  }
  return next;
}

function touchedPathCount(changes: readonly WorkspaceSourceChange[]): number {
  const paths = new Set<string>();
  for (const change of changes) {
    if (change.kind === 'move') {
      paths.add(change.fromPath);
      paths.add(change.toPath);
    } else paths.add(change.path);
  }
  return paths.size;
}

function deltaCounts(
  delta: Extract<
    ReturnType<typeof applyObsidianWorkspaceChanges>,
    { readonly ok: true }
  >['delta'],
) {
  return {
    entities: {
      added: delta.entities.added.length,
      removed: delta.entities.removed.length,
      updated: delta.entities.updated.length,
    },
    references: {
      added: delta.references.added.length,
      removed: delta.references.removed.length,
      updated: delta.references.updated.length,
    },
  };
}

function measureCase(
  name: string,
  engine: ObsidianWorkspaceEngine,
  sourceMap: ReadonlyMap<string, string>,
  changes: readonly WorkspaceSourceChange[],
) {
  const incrementalStart = performance.now();
  const incremental = applyObsidianWorkspaceChanges(engine, changes);
  const incrementalTotalMs = elapsed(incrementalStart);
  if (!incremental.ok) {
    throw new Error(
      `Incremental benchmark ${name} failed at ${incremental.failure.stage}: ${incremental.failure.message}`,
    );
  }
  const nextSources = applyToSources(sourceMap, changes);
  const fullStart = performance.now();
  const full = initializeObsidianWorkspaceEngine({
    workspaceId: engine.workspaceId,
    documents: asDocuments(nextSources),
    identityCatalog: engine.identityCatalog,
  });
  const fullRebuildMs = elapsed(fullStart);
  if (!full.ok) {
    throw new Error(
      `Incremental benchmark ${name} oracle failed at ${full.failure.stage}: ${full.failure.message}`,
    );
  }
  const snapshotEqual =
    JSON.stringify(incremental.snapshot) === JSON.stringify(full.snapshot);
  const catalogEqual =
    JSON.stringify(incremental.identityCatalog) ===
    JSON.stringify(full.identityCatalog);
  const appliedEqual =
    JSON.stringify(
      applyKnowledgeSnapshotDelta(engine.snapshot, incremental.delta),
    ) === JSON.stringify(full.snapshot);
  if (!snapshotEqual || !catalogEqual || !appliedEqual) {
    throw new Error(`Incremental benchmark ${name} failed its exact oracle.`);
  }
  return {
    changeType: name,
    changedPathCount: touchedPathCount(changes),
    reparsedFileCount: incremental.stats.reparsedPaths.length,
    reusedParsedDocumentCount: incremental.stats.reusedParsedDocumentCount,
    incrementalTotalMs,
    fullRebuildMs,
    delta: deltaCounts(incremental.delta),
    oracle: { snapshotEqual, catalogEqual, appliedDeltaEqual: appliedEqual },
  };
}

export function measureIncrementalWorkspace(
  workspaceId: string,
  documents: readonly SyntheticSourceDocument[],
) {
  const sourceMap = new Map(
    documents.map(({ path, source }) => [path, source]),
  );
  const sortedPaths = [...sourceMap.keys()].sort();
  const firstPath = sortedPaths[0];
  const lastPath = sortedPaths.at(-1);
  if (firstPath === undefined || lastPath === undefined) {
    throw new Error('Incremental benchmark requires at least one document.');
  }
  const firstSource = sourceMap.get(firstPath);
  if (firstSource === undefined) {
    throw new Error('Incremental benchmark first source is missing.');
  }
  const initializationStart = performance.now();
  const initialized = initializeObsidianWorkspaceEngine({
    workspaceId,
    documents,
  });
  const initializationMs = elapsed(initializationStart);
  if (!initialized.ok) {
    throw new Error(
      `Incremental benchmark initialization failed at ${initialized.failure.stage}: ${initialized.failure.message}`,
    );
  }
  const movedPath = `moved/${firstPath}`;
  const scenarios = [
    measureCase('one-file-edit', initialized.engine, sourceMap, [
      {
        kind: 'upsert',
        path: firstPath,
        source: `${firstSource}\nIncremental benchmark body edit.\n`,
      },
    ]),
    measureCase('add', initialized.engine, sourceMap, [
      {
        kind: 'upsert',
        path: 'kg10-incremental-added.md',
        source: '# Incremental benchmark addition\n',
      },
    ]),
    measureCase('delete', initialized.engine, sourceMap, [
      { kind: 'delete', path: lastPath },
    ]),
    measureCase('move', initialized.engine, sourceMap, [
      { kind: 'move', fromPath: firstPath, toPath: movedPath },
    ]),
  ];
  return {
    workspace: {
      documents: initialized.snapshot.entities.filter(
        ({ kind }) => kind === 'document',
      ).length,
      entities: initialized.snapshot.entities.length,
      references: initialized.snapshot.references.length,
    },
    initialization: {
      timingMs: initializationMs,
      reparsedFileCount: initialized.stats.reparsedPaths.length,
    },
    scenarios,
  };
}
