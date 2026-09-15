import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { describe, expect, it } from 'vitest';

import {
  assertWorkerChunkIsDomFree,
  WORKER_SAFE_NAMED_REFERENCE_MODULE,
} from '../../vite.config';

const WEB_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const WORKSPACE_WORKER_DEV_URL =
  '/src/workers/workspace.worker.ts?worker_file&type=module';

function staticImportSpecifiers(code: string): readonly string[] {
  return Array.from(
    code.matchAll(
      /(?:^|;|\n)\s*(?:import|export)\s+(?:[^"'();]+?\s+from\s+)?["']([^"']+)["']/g,
    ),
    (match) => match[1]!,
  );
}

async function fetchDevWorkerGraph(
  origin: URL,
): Promise<ReadonlyMap<string, string>> {
  const pending = [new URL(WORKSPACE_WORKER_DEV_URL, origin)];
  const modules = new Map<string, string>();

  while (pending.length > 0) {
    const url = pending.shift()!;
    if (modules.has(url.href)) continue;
    if (modules.size >= 200) {
      throw new Error('Workspace dev worker graph exceeded 200 modules.');
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Vite dev worker module ${url.href} returned ${response.status}.`,
      );
    }
    const code = await response.text();
    modules.set(url.href, code);
    for (const specifier of staticImportSpecifiers(code)) {
      if (!specifier.startsWith('/')) continue;
      const imported = new URL(specifier, origin);
      if (!modules.has(imported.href)) pending.push(imported);
    }
  }

  return modules;
}

describe('Vite worker runtime boundary', () => {
  it('resolves named references to the package worker-safe implementation', () => {
    const normalized = WORKER_SAFE_NAMED_REFERENCE_MODULE.replaceAll('\\', '/');
    expect(normalized).toMatch(/decode-named-character-reference\/index\.js$/);
    expect(normalized).not.toContain('index.dom.js');
  });

  it('accepts worker-safe globals and rejects DOM construction', () => {
    expect(() =>
      assertWorkerChunkIsDomFree(
        'safe.worker.js',
        'self.onmessage = () => postMessage(1)',
      ),
    ).not.toThrow();
    expect(() =>
      assertWorkerChunkIsDomFree(
        'unsafe.worker.js',
        "const decoder = document.createElement('i')",
      ),
    ).toThrow(
      'Worker bundle unsafe.worker.js contains forbidden DOM runtime document.createElement.',
    );
  });

  it('serves the workspace worker graph with the worker-safe decoder in dev', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'icarus-vite-worker-'));
    const server = await createServer({
      root: WEB_ROOT,
      configFile: join(WEB_ROOT, 'vite.config.ts'),
      cacheDir,
      logLevel: 'silent',
      server: {
        host: '127.0.0.1',
        port: 0,
        strictPort: true,
      },
    });

    try {
      await server.listen();
      const address = server.httpServer?.address() as AddressInfo | null;
      if (address === null) throw new Error('Vite dev server did not listen.');
      const modules = await fetchDevWorkerGraph(
        new URL(`http://127.0.0.1:${address.port}`),
      );
      const moduleUrls = [...modules.keys()].map((url) =>
        decodeURIComponent(url).replaceAll('\\', '/'),
      );

      expect(
        moduleUrls.some((url) =>
          url.includes('/decode-named-character-reference/index.js'),
        ),
        moduleUrls.join('\n'),
      ).toBe(true);
      expect(
        moduleUrls.some((url) =>
          url.includes('/decode-named-character-reference/index.dom.js'),
        ),
      ).toBe(false);
      for (const [url, code] of modules) {
        expect(() => assertWorkerChunkIsDomFree(url, code)).not.toThrow();
      }
    } finally {
      await server.close();
      await rm(cacheDir, { recursive: true, force: true });
    }
  }, 30_000);
});
