import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/u.test(entry.name) && !entry.name.includes('.test.')
        ? [path]
        : [];
  });
}

describe('HIER3B semantic-model production boundary', () => {
  it('is imported only by the approved lazy modular production seams', () => {
    const repository = fileURLToPath(new URL('../../..', import.meta.url));
    const roots = [
      new URL('../../../apps/web/src', import.meta.url),
      new URL('../../renderer-reactflow/src', import.meta.url),
      new URL('../../dagre-layout/src', import.meta.url),
    ];
    const imports = roots
      .flatMap((url) =>
        sourceFiles(fileURLToPath(url)).filter((path) =>
          readFileSync(path, 'utf8').includes(
            '@icarus-graph-explorer/focus-schematic',
          ),
        ),
      )
      .map((path) => relative(repository, path).replaceAll('\\', '/'))
      .sort();
    expect(imports).toEqual(
      [
        'apps/web/src/components/ModularStructuredGraphView.tsx',
        'apps/web/src/focus-schematic-layout-cache.ts',
        'apps/web/src/workers/focus-schematic-layout-worker-client.ts',
        'apps/web/src/workers/focus-schematic-layout.worker.ts',
        'packages/renderer-reactflow/src/focus-schematic/index.ts',
      ].sort(),
    );
  });
});
