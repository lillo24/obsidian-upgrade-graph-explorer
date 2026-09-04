import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, join } from 'node:path';
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

describe('HIER2 production boundary', () => {
  it('keeps the reusable package free of renderer, app, worker, view-state, and platform imports', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    const source = sourceFiles(root)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(source).not.toMatch(
      /renderer-reactflow|GraphExplorer|LocalStructuredGraphView|workspace-worker|view-state|@tauri-apps|\/web/,
    );
  });

  it('is absent from production packages and apps during HIER2', () => {
    const repository = fileURLToPath(new URL('../../..', import.meta.url));
    const roots = ['apps', 'packages']
      .flatMap((folder) => sourceFiles(join(repository, folder)))
      .filter((path) => !path.includes('focus-schematic-layout'));
    const imports = roots.filter((path) =>
      readFileSync(path, 'utf8').includes(
        '@icarus-graph-explorer/focus-schematic-layout',
      ),
    );
    expect(imports).toEqual([]);
  });
});
