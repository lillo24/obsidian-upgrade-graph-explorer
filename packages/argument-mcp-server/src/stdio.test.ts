import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { serializeArgumentLibrary } from '@icarus-graph-explorer/argument-workspace';
import { build } from 'esbuild';
import { expect, it } from 'vitest';

import { ARGUMENT_LIBRARY_PATH_ENV } from './loader';
import { createSyntheticLibrary } from './test-fixture';

function inheritedEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

it('serves initialize, tools/list, and tools/call over clean stdio', async () => {
  const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const temporary = await mkdtemp(join(tmpdir(), 'icarus-argument-mcp-stdio-'));
  const serverPath = join(temporary, 'server.mjs');
  const libraryPath = join(temporary, 'library-v3.json');
  const { library } = createSyntheticLibrary();
  await writeFile(libraryPath, serializeArgumentLibrary(library), 'utf8');
  await build({
    entryPoints: [resolve(packageRoot, 'src/cli.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    outfile: serverPath,
    logLevel: 'silent',
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: packageRoot,
    env: {
      ...inheritedEnvironment(),
      [ARGUMENT_LIBRARY_PATH_ENV]: libraryPath,
    },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk: unknown) => {
    stderr += String(chunk);
  });
  const client = new Client({ name: 'stdio-test', version: '1.0.0' });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map(({ name }) => name)).toContain('compiler_status');
    const status = await client.callTool({
      name: 'compiler_status',
      arguments: {},
    });
    expect(status.structuredContent).toMatchObject({
      available: true,
      libraryId: 'library-mcp-test',
    });
  } finally {
    await client.close();
    await rm(temporary, { recursive: true, force: true });
  }

  expect(stderr).toContain('listening on stdio');
  expect(stderr).not.toContain(libraryPath);
});
