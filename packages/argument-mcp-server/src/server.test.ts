import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  createKnowledgeReaderFromLibrary,
  serializeArgumentLibrary,
  setRecordArchived,
  updateCounterArgumentResponse,
} from '@icarus-graph-explorer/argument-workspace';
import { afterEach, describe, expect, it } from 'vitest';

import { createArgumentMcpServer, MAX_TOOL_RESULT_BYTES } from './server';
import { createSyntheticLibrary } from './test-fixture';

const temporaryDirectories: string[] = [];

async function temporaryLibrary(): Promise<{
  readonly directory: string;
  readonly path: string;
}> {
  const directory = await mkdtemp(join(tmpdir(), 'icarus-argument-mcp-'));
  temporaryDirectories.push(directory);
  return { directory, path: join(directory, 'library-v2.json') };
}

async function connect(server: McpServer): Promise<{
  readonly client: Client;
  readonly close: () => Promise<void>;
}> {
  const client = new Client({ name: 'argument-mcp-test', version: '1.0.0' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function structured(result: { readonly structuredContent?: unknown }): object {
  expect(result.structuredContent).toBeDefined();
  expect(typeof result.structuredContent).toBe('object');
  expect(result.structuredContent).not.toBeNull();
  return result.structuredContent as object;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('Argument Library MCP tools', () => {
  it('registers exactly four read-only tools and no write capability', async () => {
    const { path } = await temporaryLibrary();
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      const listed = await session.client.listTools();

      expect(listed.tools.map(({ name }) => name)).toEqual([
        'compiler_status',
        'compiler_list_index',
        'compiler_search_index',
        'compiler_read_bundle',
      ]);
      expect(listed.tools).toSatisfy((tools: typeof listed.tools) =>
        tools.every(
          ({ annotations }) =>
            annotations?.readOnlyHint === true &&
            annotations.destructiveHint === false,
        ),
      );
      expect(JSON.stringify(listed.tools)).not.toMatch(
        /save|create|update|delete|import|read_source/u,
      );
    } finally {
      await session.close();
    }
  });

  it('returns safe status and exact domain list/search results', async () => {
    const { path } = await temporaryLibrary();
    const { library } = createSyntheticLibrary();
    await writeFile(path, serializeArgumentLibrary(library), 'utf8');
    const domain = createKnowledgeReaderFromLibrary(library);
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      const status = await session.client.callTool({
        name: 'compiler_status',
        arguments: {},
      });
      expect(structured(status)).toMatchObject({
        available: true,
        libraryId: 'library-mcp-test',
        recordCounts: {
          topics: 1,
          axioms: 1,
          arguments: 1,
          counterArguments: 1,
        },
      });
      expect(JSON.stringify(status)).not.toContain(path);

      const list = await session.client.callTool({
        name: 'compiler_list_index',
        arguments: { limit: 2 },
      });
      expect(structured(list)).toEqual(domain.listIndex({ limit: 2 }));
      expect(JSON.stringify(list)).not.toContain(path);

      const search = await session.client.callTool({
        name: 'compiler_search_index',
        arguments: { query: 'contradiction', limit: 10 },
      });
      expect(structured(search)).toEqual(
        domain.searchIndex({ query: 'contradiction', limit: 10 }),
      );
      expect(JSON.stringify(search)).not.toContain(path);
    } finally {
      await session.close();
    }
  });

  it('returns the domain bundle with objection, response, axiom, and context', async () => {
    const { path } = await temporaryLibrary();
    const { library } = createSyntheticLibrary();
    await writeFile(path, serializeArgumentLibrary(library), 'utf8');
    const domain = createKnowledgeReaderFromLibrary(library);
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      const result = await session.client.callTool({
        name: 'compiler_read_bundle',
        arguments: { id: 'CA-CONTRADICTION', kind: 'counter-argument' },
      });

      expect(structured(result)).toEqual(
        domain.readArgumentBundle({
          id: 'CA-CONTRADICTION',
          kind: 'counter-argument',
        }),
      );
      expect(structured(result)).toMatchObject({
        status: 'ok',
        value: {
          topics: [{ id: 'T-MEASUREMENT' }],
          axioms: [{ id: 'AX-UNITS' }],
          counterArguments: [
            {
              id: 'CA-CONTRADICTION',
              response: {
                outcome: 'inapplicable-under-stated-scope',
                answeringAxioms: [{ axiomId: 'AX-UNITS' }],
              },
            },
          ],
          completeness: { theorySources: 'not-read' },
          receipt: { completeness: 'complete' },
        },
      });
      expect(JSON.stringify(result)).not.toContain(path);
    } finally {
      await session.close();
    }
  });

  it('preserves the domain archive policy', async () => {
    const { path } = await temporaryLibrary();
    const fixture = createSyntheticLibrary();
    const library = setRecordArchived(
      fixture.library,
      'counter-argument',
      'CA-CONTRADICTION',
      true,
      fixture.runtime,
    );
    await writeFile(path, serializeArgumentLibrary(library), 'utf8');
    const domain = createKnowledgeReaderFromLibrary(library);
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      const hidden = await session.client.callTool({
        name: 'compiler_search_index',
        arguments: { query: 'contradiction', limit: 10 },
      });
      const included = await session.client.callTool({
        name: 'compiler_search_index',
        arguments: {
          query: 'contradiction',
          limit: 10,
          includeArchived: true,
        },
      });

      expect(structured(hidden)).toEqual(
        domain.searchIndex({ query: 'contradiction', limit: 10 }),
      );
      expect(structured(included)).toEqual(
        domain.searchIndex({
          query: 'contradiction',
          limit: 10,
          includeArchived: true,
        }),
      );
      expect(structured(hidden)).not.toMatchObject({
        value: { candidates: [{ id: 'CA-CONTRADICTION' }] },
      });
      expect(structured(included)).toMatchObject({
        value: {
          candidates: expect.arrayContaining([
            expect.objectContaining({ id: 'CA-CONTRADICTION' }),
          ]),
        },
      });
    } finally {
      await session.close();
    }
  });

  it('returns explicit safe failures and remains usable after file repair', async () => {
    const { path } = await temporaryLibrary();
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      const missing = await session.client.callTool({
        name: 'compiler_list_index',
        arguments: {},
      });
      expect(missing.isError).toBe(true);
      expect(structured(missing)).toMatchObject({
        status: 'error',
        error: { code: 'library-missing' },
      });

      for (const [source, code] of [
        ['{broken', 'invalid-json'],
        [JSON.stringify({ schemaVersion: 3 }), 'future-schema'],
      ] as const) {
        await writeFile(path, source, 'utf8');
        const failed = await session.client.callTool({
          name: 'compiler_list_index',
          arguments: {},
        });
        expect(failed.isError).toBe(true);
        expect(structured(failed)).toMatchObject({
          status: 'error',
          error: { code },
        });
        expect(JSON.stringify(failed)).not.toContain(path);
        expect(JSON.stringify(failed)).not.toContain(source);
      }

      const { library } = createSyntheticLibrary();
      await writeFile(path, serializeArgumentLibrary(library), 'utf8');
      const recovered = await session.client.callTool({
        name: 'compiler_list_index',
        arguments: {},
      });
      expect(recovered.isError).not.toBe(true);
      expect(structured(recovered)).toMatchObject({ status: 'ok' });
    } finally {
      await session.close();
    }
  });

  it('reloads the library for each call', async () => {
    const { path } = await temporaryLibrary();
    const fixture = createSyntheticLibrary();
    await writeFile(path, serializeArgumentLibrary(fixture.library), 'utf8');
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      const first = structured(
        await session.client.callTool({
          name: 'compiler_status',
          arguments: {},
        }),
      ) as { libraryRevision: number; contentFingerprint: object };
      const changed = setRecordArchived(
        fixture.library,
        'counter-argument',
        'CA-CONTRADICTION',
        true,
        fixture.runtime,
      );
      await writeFile(path, serializeArgumentLibrary(changed), 'utf8');

      const second = structured(
        await session.client.callTool({
          name: 'compiler_status',
          arguments: {},
        }),
      ) as { libraryRevision: number; contentFingerprint: object };

      expect(second.libraryRevision).toBeGreaterThan(first.libraryRevision);
      expect(second.contentFingerprint).not.toEqual(first.contentFingerprint);
    } finally {
      await session.close();
    }
  });

  it('rejects invalid bounds and exact-shape violations before domain dispatch', async () => {
    const { path } = await temporaryLibrary();
    const { library } = createSyntheticLibrary();
    await writeFile(path, serializeArgumentLibrary(library), 'utf8');
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      for (const request of [
        {
          name: 'compiler_status',
          arguments: { unexpected: true },
        },
        {
          name: 'compiler_list_index',
          arguments: { limit: 101 },
        },
        {
          name: 'compiler_search_index',
          arguments: { query: 'x'.repeat(2_001) },
        },
        {
          name: 'compiler_read_bundle',
          arguments: { id: 'AX-UNITS', expectedSnapshot: {} },
        },
      ]) {
        const result = await session.client.callTool(request);
        expect(result.isError).toBe(true);
      }

      const missingRecord = await session.client.callTool({
        name: 'compiler_read_bundle',
        arguments: { id: 'DOES-NOT-EXIST' },
      });
      expect(missingRecord.isError).toBe(true);
      expect(structured(missingRecord)).toEqual({
        status: 'not-found',
        id: 'DOES-NOT-EXIST',
      });
    } finally {
      await session.close();
    }
  });

  it('rejects a cursor bound to an earlier file snapshot', async () => {
    const { path } = await temporaryLibrary();
    const fixture = createSyntheticLibrary();
    await writeFile(path, serializeArgumentLibrary(fixture.library), 'utf8');
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      const first = structured(
        await session.client.callTool({
          name: 'compiler_list_index',
          arguments: { limit: 1 },
        }),
      ) as { value: { nextCursor: string } };
      const changed = setRecordArchived(
        fixture.library,
        'counter-argument',
        'CA-CONTRADICTION',
        true,
        fixture.runtime,
      );
      await writeFile(path, serializeArgumentLibrary(changed), 'utf8');

      const stale = await session.client.callTool({
        name: 'compiler_list_index',
        arguments: { limit: 1, cursor: first.value.nextCursor },
      });

      expect(stale.isError).toBe(true);
      expect(structured(stale)).toMatchObject({ status: 'invalid-request' });
    } finally {
      await session.close();
    }
  });

  it('fails explicitly instead of truncating an oversized response', async () => {
    const { path } = await temporaryLibrary();
    const fixture = createSyntheticLibrary();
    const library = updateCounterArgumentResponse(
      fixture.library,
      'CA-CONTRADICTION',
      { explanation: 'x'.repeat(MAX_TOOL_RESULT_BYTES + 128) },
      fixture.runtime,
    );
    await writeFile(path, serializeArgumentLibrary(library), 'utf8');
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      const result = await session.client.callTool({
        name: 'compiler_read_bundle',
        arguments: { id: 'CA-CONTRADICTION' },
      });

      expect(result.isError).toBe(true);
      expect(structured(result)).toMatchObject({
        status: 'error',
        error: { code: 'response-too-large' },
      });
    } finally {
      await session.close();
    }
  });
});
