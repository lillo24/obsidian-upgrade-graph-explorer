import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

describe('HIER1 production boundary', () => {
  it('is absent from production web, renderer, and Dagre source graphs', () => {
    const roots = [
      new URL('../../../apps/web/src', import.meta.url),
      new URL('../../renderer-reactflow/src', import.meta.url),
      new URL('../../dagre-layout/src', import.meta.url),
    ];
    const offenders = roots.flatMap((url) =>
      sourceFiles(fileURLToPath(url)).filter((path) =>
        readFileSync(path, 'utf8').includes(
          '@icarus-graph-explorer/focus-schematic',
        ),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
