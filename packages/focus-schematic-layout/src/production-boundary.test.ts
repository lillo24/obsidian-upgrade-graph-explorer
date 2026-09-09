import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const productionExtensions = new Set(['.ts', '.tsx']);
const excluded = /(?:\.test|test-helpers)\.tsx?$/;

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory() && entry.name === 'node_modules') return [];
    return entry.isDirectory()
      ? sourceFiles(path)
      : productionExtensions.has(extname(entry.name)) &&
          !excluded.test(entry.name)
        ? [path]
        : [];
  });
}

describe('HIER3B production boundary', () => {
  it('keeps the reusable package free of renderer, app, worker, view-state, and platform imports', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    const source = sourceFiles(root)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(source).not.toMatch(
      /renderer-reactflow|GraphExplorer|LocalStructuredGraphView|workspace-worker|view-state|@tauri-apps|\/web/,
    );
  });

  it('is imported only by the approved renderer, worker/cache, policy, and scope persistence seams', () => {
    const repository = fileURLToPath(new URL('../../..', import.meta.url));
    const packageRoot = join(repository, 'packages', 'focus-schematic-layout');
    const roots = ['apps', 'packages']
      .flatMap((folder) => sourceFiles(join(repository, folder)))
      .filter((path) => !path.startsWith(`${packageRoot}${sep}`));
    const imports = roots
      .filter((path) =>
        readFileSync(path, 'utf8').includes(
          '@icarus-graph-explorer/focus-schematic-layout',
        ),
      )
      .map((path) => relative(repository, path).replaceAll('\\', '/'))
      .sort();
    expect(imports).toEqual(
      [
        'apps/web/src/components/ModularStructuredGraphView.tsx',
        'apps/web/src/focus-schematic-layout-cache.ts',
        'apps/web/src/persistence/soft-folder-scope.ts',
        'apps/web/src/preferences/graph-preferences.ts',
        'apps/web/src/soft-folder-scope/session.ts',
        'apps/web/src/soft-folder-scope/use-soft-folder-scope.ts',
        'apps/web/src/workers/focus-schematic-layout-worker-client.ts',
        'apps/web/src/workers/focus-schematic-layout.worker.ts',
        'packages/renderer-reactflow/src/focus-schematic/folder-band-strips.tsx',
        'packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.tsx',
        'packages/renderer-reactflow/src/focus-schematic/index.ts',
      ].sort(),
    );
    expect(
      readFileSync(
        join(
          repository,
          'apps',
          'web',
          'src',
          'preferences',
          'graph-preferences.ts',
        ),
        'utf8',
      ),
    ).toContain('@icarus-graph-explorer/focus-schematic-layout/policies');
  });
});
