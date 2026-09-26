import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
  const serverPath = join(packageRoot, 'dist', 'server.js');
  const libraryPath = join(temporary, 'library-v9.json');
  const { library } = createSyntheticLibrary();
  await writeFile(libraryPath, serializeArgumentLibrary(library), 'utf8');
  await mkdir(dirname(serverPath), { recursive: true });
  await build({
    entryPoints: [resolve(packageRoot, 'src/cli.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    loader: { '.md': 'text' },
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
    expect(tools.tools.map(({ name }) => name)).toContain(
      'compiler_usage_guide',
    );
    expect(tools.tools.map(({ name }) => name)).toContain('compiler_status');
    const proposalTool = tools.tools.find(
      ({ name }) => name === 'compiler_submit_proposal',
    );
    expect(proposalTool).toBeDefined();
    const proposalProperties = (
      proposalTool?.inputSchema as {
        properties?: Record<string, unknown>;
      }
    ).properties;
    expect(Object.keys(proposalProperties ?? {})).toEqual(
      expect.arrayContaining([
        'intent',
        'premises',
        'reasoningSteps',
        'sourceObservations',
      ]),
    );
    const guide = await client.callTool({
      name: 'compiler_usage_guide',
      arguments: {},
    });
    expect(guide.structuredContent).toMatchObject({
      status: 'ok',
      version: 'argument-compiler-ai-usage-v6',
      format: 'markdown',
      guide: expect.stringContaining(
        'search result -> plausible prior record -> compiler_read_bundle',
      ),
    });
    expect((guide.structuredContent as { guide: string }).guide).toContain(
      'Run an argument-evolution resolution sweep',
    );
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
}, 15_000);

it('rebuilds before repository-supported start without polluting protocol stdout', async () => {
  const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const pnpmEntryPoint = process.env.npm_execpath;
  if (!pnpmEntryPoint) {
    throw new Error(
      'npm_execpath is required to exercise the pnpm start path.',
    );
  }
  const temporary = await mkdtemp(join(tmpdir(), 'icarus-argument-mcp-start-'));
  const libraryPath = join(temporary, 'library-v9.json');
  const { library } = createSyntheticLibrary();
  await writeFile(libraryPath, serializeArgumentLibrary(library), 'utf8');

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      pnpmEntryPoint,
      '--filter',
      '@icarus-graph-explorer/argument-mcp-server',
      'start',
    ],
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
  const client = new Client({ name: 'start-test', version: '1.0.0' });

  try {
    await client.connect(transport);
    const guide = await client.callTool({
      name: 'compiler_usage_guide',
      arguments: {},
    });
    expect(guide.structuredContent).toMatchObject({
      status: 'ok',
      version: 'argument-compiler-ai-usage-v6',
      guide: expect.stringContaining(
        'Run an argument-evolution resolution sweep',
      ),
    });
  } finally {
    await client.close();
    await rm(temporary, { recursive: true, force: true });
  }

  expect(stderr).toContain('listening on stdio');
  expect(stderr).not.toContain(libraryPath);
}, 20_000);
