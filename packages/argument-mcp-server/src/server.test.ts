import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  createArgument,
  captureArgumentLibrarySnapshot,
  createContext,
  createKnowledgeReaderFromLibrary,
  parseArgumentLibraryJson,
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
  return { directory, path: join(directory, 'library-v7.json') };
}

function proposalArguments(
  library: ReturnType<typeof createSyntheticLibrary>['library'],
) {
  const snapshot = captureArgumentLibrarySnapshot(library).descriptor;
  const argument = library.arguments[0]!;
  const topic = library.topics[0]!;
  return {
    clientSubmissionId: 'mcp-proposal-1',
    title: 'Verified normalization exception',
    softExplanationMarkdown:
      '## Reviewer summary\n\nThe proposal adds a **bounded exception**.',
    intent: 'refine' as const,
    topicId: topic.id,
    target: {
      argumentId: argument.id,
      part: { kind: 'reasoning' as const },
      reliedOnRevision: argument.revision,
    },
    examples: ['The quantities were normalized upstream.'],
    premises: [
      {
        id: 'P-CLAIM',
        kind: 'text' as const,
        text: 'A current normalization receipt exists.',
      },
      {
        id: 'P-AXIOM',
        kind: 'axiom' as const,
        axiomId: 'AX-UNITS',
        reliedOnRevision: library.axioms[0]!.revision,
      },
      {
        id: 'P-ARGUMENT',
        kind: 'argument-conclusion' as const,
        argumentId: argument.id,
        reliedOnRevision: argument.revision,
      },
    ],
    reasoning: 'A repeated conversion may be unnecessary.',
    reasoningSteps: [
      {
        id: 'R-1',
        uses: [
          { kind: 'premise' as const, premiseId: 'P-CLAIM' },
          { kind: 'premise' as const, premiseId: 'P-AXIOM' },
        ],
        text: 'The receipt and Axiom establish compatibility.',
      },
    ],
    conclusion: 'Verified normalized quantities can be compared directly.',
    boundary: 'Only while the normalization receipt remains current.',
    sourceObservations: [
      {
        id: 'SOURCE-1',
        label: 'Normalization implementation',
        repository: 'icarus/example',
        url: 'https://example.com/icarus/commit/36c927fabcd',
        commitSha: '36c927fabcd',
        filePath: 'Associated Value.md',
        observation: 'The implementation normalizes quantities upstream.',
      },
    ],
    whyNovelOrUnresolved:
      'The existing response does not discuss pre-normalized quantities.',
    consultation: {
      libraryId: snapshot.libraryId,
      libraryRevision: snapshot.libraryRevision,
      contentFingerprint: snapshot.contentFingerprint,
      records: [
        { kind: 'topic' as const, id: topic.id, revision: topic.revision },
        {
          kind: 'argument' as const,
          id: argument.id,
          revision: argument.revision,
        },
        {
          kind: 'axiom' as const,
          id: library.axioms[0]!.id,
          revision: library.axioms[0]!.revision,
        },
      ],
    },
  };
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
  it('registers five read-only tools and one proposal-only append capability', async () => {
    const { path } = await temporaryLibrary();
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      const listed = await session.client.listTools();
      const instructions = session.client.getInstructions();

      expect(instructions).toContain(
        'call compiler_usage_guide when beginning a Compiler cross-check',
      );
      expect(instructions?.length).toBeLessThan(300);
      expect(listed.tools.map(({ name }) => name)).toEqual([
        'compiler_usage_guide',
        'compiler_status',
        'compiler_list_index',
        'compiler_search_index',
        'compiler_read_bundle',
        'compiler_submit_proposal',
      ]);
      expect(
        listed.tools.find(({ name }) => name === 'compiler_usage_guide'),
      ).toMatchObject({
        description: expect.stringContaining(
          'after independent candidate reasoning is complete',
        ),
        outputSchema: {
          type: 'object',
          required: expect.arrayContaining([
            'status',
            'version',
            'format',
            'guide',
          ]),
        },
      });
      expect(listed.tools.slice(0, 5)).toSatisfy((tools: typeof listed.tools) =>
        tools.every(
          ({ annotations }) =>
            annotations?.readOnlyHint === true &&
            annotations.destructiveHint === false,
        ),
      );
      expect(listed.tools[5]).toMatchObject({
        name: 'compiler_submit_proposal',
        annotations: { readOnlyHint: false, destructiveHint: false },
      });
      expect(listed.tools.map(({ name }) => name)).not.toContain(
        'compiler_create_argument',
      );
      expect(listed.tools.map(({ name }) => name)).not.toContain(
        'compiler_resolve_proposal',
      );
    } finally {
      await session.close();
    }
  });

  it('appends only a pending proposal and makes an exact retry idempotent', async () => {
    const { path } = await temporaryLibrary();
    const fixture = createSyntheticLibrary();
    await writeFile(path, serializeArgumentLibrary(fixture.library), 'utf8');
    const session = await connect(
      createArgumentMcpServer({
        libraryPath: path,
        proposalRuntime: fixture.runtime,
      }),
    );
    const input = proposalArguments(fixture.library);
    try {
      const first = await session.client.callTool({
        name: 'compiler_submit_proposal',
        arguments: input,
      });
      expect(first.isError).not.toBe(true);
      expect(structured(first)).toMatchObject({
        status: 'ok',
        proposalStatus: 'pending',
        duplicate: false,
      });

      const retry = await session.client.callTool({
        name: 'compiler_submit_proposal',
        arguments: input,
      });
      expect(structured(retry)).toMatchObject({
        status: 'ok',
        duplicate: true,
      });
      const firstId = (structured(first) as { proposalId: string }).proposalId;
      expect((structured(retry) as { proposalId: string }).proposalId).toBe(
        firstId,
      );

      const parsed = parseArgumentLibraryJson(await readFile(path, 'utf8'));
      expect(parsed.status).toBe('valid');
      if (parsed.status !== 'valid') return;
      expect(parsed.value.proposals).toHaveLength(1);
      expect(parsed.value.proposals[0]).toMatchObject({
        id: firstId,
        status: 'pending',
        intent: 'refine',
        softExplanationMarkdown: input.softExplanationMarkdown,
        premises: input.premises,
        reasoningSteps: input.reasoningSteps,
        sourceObservations: input.sourceObservations,
        consultation: input.consultation,
      });
      expect(parsed.value.topics).toEqual(fixture.library.topics);
      expect(parsed.value.axioms).toEqual(fixture.library.axioms);
      expect(parsed.value.arguments).toEqual(fixture.library.arguments);
      expect(parsed.value.counterArguments).toEqual(
        fixture.library.counterArguments,
      );

      const changedExplanation = await session.client.callTool({
        name: 'compiler_submit_proposal',
        arguments: {
          ...input,
          softExplanationMarkdown: 'A different review explanation.',
        },
      });
      expect(changedExplanation.isError).toBe(true);
      expect(structured(changedExplanation)).toMatchObject({
        status: 'error',
        error: { code: 'persistence-error' },
      });
    } finally {
      await session.close();
    }
  });

  it('normalizes the transitional premise fields into the typed proposal model', async () => {
    const { path } = await temporaryLibrary();
    const fixture = createSyntheticLibrary();
    await writeFile(path, serializeArgumentLibrary(fixture.library), 'utf8');
    const session = await connect(
      createArgumentMcpServer({
        libraryPath: path,
        proposalRuntime: fixture.runtime,
      }),
    );
    const rich = proposalArguments(fixture.library);
    const shared = { ...rich } as Record<string, unknown>;
    delete shared.premises;
    delete shared.reasoningSteps;
    delete shared.sourceObservations;
    delete shared.intent;
    delete shared.softExplanationMarkdown;
    try {
      const result = await session.client.callTool({
        name: 'compiler_submit_proposal',
        arguments: {
          ...shared,
          clientSubmissionId: 'mcp-proposal-legacy',
          premiseHints: ['A legacy claim remains plain text.'],
          suggestedAxiomIds: ['AX-UNITS'],
        },
      });
      expect(result.isError).not.toBe(true);

      const parsed = parseArgumentLibraryJson(await readFile(path, 'utf8'));
      expect(parsed.status).toBe('valid');
      if (parsed.status !== 'valid') return;
      expect(parsed.value.proposals[0]).toMatchObject({
        intent: 'unspecified',
        premises: [
          {
            id: 'legacy-text-1',
            kind: 'text',
            text: 'A legacy claim remains plain text.',
          },
          { id: 'legacy-axiom-1', kind: 'axiom', axiomId: 'AX-UNITS' },
        ],
        reasoningSteps: [],
        sourceObservations: [],
      });
    } finally {
      await session.close();
    }
  });

  it('rejects malformed, oversized, and stale-target submissions', async () => {
    const { path } = await temporaryLibrary();
    const fixture = createSyntheticLibrary();
    await writeFile(path, serializeArgumentLibrary(fixture.library), 'utf8');
    const session = await connect(
      createArgumentMcpServer({
        libraryPath: path,
        proposalRuntime: fixture.runtime,
      }),
    );
    const input = proposalArguments(fixture.library);
    try {
      const malformed = await session.client.callTool({
        name: 'compiler_submit_proposal',
        arguments: { ...input, unexpected: true },
      });
      expect(malformed.isError).toBe(true);

      const oversized = await session.client.callTool({
        name: 'compiler_submit_proposal',
        arguments: { ...input, conclusion: 'x'.repeat(20_001) },
      });
      expect(oversized.isError).toBe(true);

      const stale = await session.client.callTool({
        name: 'compiler_submit_proposal',
        arguments: {
          ...input,
          clientSubmissionId: 'mcp-proposal-stale',
          target: { ...input.target, reliedOnRevision: 99 },
        },
      });
      expect(stale.isError).toBe(true);
      expect(structured(stale)).toMatchObject({
        status: 'error',
        error: { code: 'persistence-error' },
      });

      const parsed = parseArgumentLibraryJson(await readFile(path, 'utf8'));
      expect(parsed.status).toBe('valid');
      if (parsed.status === 'valid') expect(parsed.value.proposals).toEqual([]);
    } finally {
      await session.close();
    }
  });

  it('returns the canonical usage protocol without loading or mutating a library', async () => {
    const { path } = await temporaryLibrary();
    expect(existsSync(path)).toBe(false);
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      const result = await session.client.callTool({
        name: 'compiler_usage_guide',
        arguments: {},
      });
      const response = structured(result) as {
        status: string;
        version: string;
        format: string;
        guide: string;
      };

      expect(result.isError).not.toBe(true);
      expect(response).toMatchObject({
        status: 'ok',
        version: 'argument-compiler-ai-usage-v4',
        format: 'markdown',
      });
      expect(
        Buffer.byteLength(JSON.stringify(response), 'utf8'),
      ).toBeLessThanOrEqual(MAX_TOOL_RESULT_BYTES);
      const normalizedGuide = response.guide.replace(/\s+/gu, ' ');
      expect(normalizedGuide).toContain(
        'substantive candidate ideas already exist',
      );
      expect(normalizedGuide).toContain(
        'multiple focused lexical formulations',
      );
      expect(normalizedGuide).toContain(
        'search result -> plausible prior record -> compiler_read_bundle',
      );
      expect(normalizedGuide).toContain(
        'not authority and not external empirical proof',
      );
      expect(normalizedGuide).toContain('Prior response still applies');
      expect(normalizedGuide).toContain(
        'Run an argument-evolution resolution sweep',
      );
      expect(normalizedGuide).toContain(
        'earlier claim -> challenge / counterexample / ambiguity -> revision',
      );
      expect(normalizedGuide).toContain(
        'arguments which survived meaningful criticism or revision',
      );
      expect(normalizedGuide).toContain('Compiler Mailbox');
      expect(normalizedGuide).toContain('compiler_submit_proposal');
      expect(normalizedGuide).toContain(
        'The Mailbox is not an Argument Library record',
      );
      expect(normalizedGuide).toContain('softExplanationMarkdown');
      expect(normalizedGuide).toContain(
        'If `compiler_submit_proposal` is not present in the current tool list',
      );
      expect(result.content).toEqual([{ type: 'text', text: response.guide }]);
      expect(existsSync(path)).toBe(false);
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
          contexts: 0,
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

  it('lists, searches, and reads Context background without adding write tools', async () => {
    const { path } = await temporaryLibrary();
    const fixture = createSyntheticLibrary();
    let library = createContext(
      fixture.library,
      {
        id: 'CTX-MEASUREMENT',
        title: 'Measurement framework',
        description: 'Background assumptions for compatible comparisons.',
        axiomIds: ['AX-UNITS'],
        retrieval: { keywords: ['framework-context'] },
        reviewState: 'accepted',
      },
      fixture.runtime,
    );
    library = createArgument(
      library,
      {
        id: 'AR-CONTEXT-ONLY',
        title: 'Context-only interpretation',
        premises: [],
        conclusion: 'The Context remains background rather than a premise.',
        contextIds: ['CTX-MEASUREMENT'],
        reviewState: 'accepted',
      },
      fixture.runtime,
    );
    await writeFile(path, serializeArgumentLibrary(library), 'utf8');
    const session = await connect(
      createArgumentMcpServer({ libraryPath: path }),
    );
    try {
      const status = await session.client.callTool({
        name: 'compiler_status',
        arguments: {},
      });
      expect(structured(status)).toMatchObject({
        recordCounts: { contexts: 1 },
      });

      const search = await session.client.callTool({
        name: 'compiler_search_index',
        arguments: { query: 'framework-context' },
      });
      expect(structured(search)).toMatchObject({
        status: 'ok',
        value: {
          candidates: [
            expect.objectContaining({
              kind: 'context',
              id: 'CTX-MEASUREMENT',
            }),
          ],
        },
      });

      const context = await session.client.callTool({
        name: 'compiler_read_bundle',
        arguments: { kind: 'context', id: 'CTX-MEASUREMENT' },
      });
      expect(structured(context)).toMatchObject({
        status: 'ok',
        value: {
          contexts: [
            expect.objectContaining({
              id: 'CTX-MEASUREMENT',
              effectiveAxiomIds: ['AX-UNITS'],
            }),
          ],
          axioms: [expect.objectContaining({ id: 'AX-UNITS' })],
          arguments: [],
        },
      });

      const argument = await session.client.callTool({
        name: 'compiler_read_bundle',
        arguments: { kind: 'argument', id: 'AR-CONTEXT-ONLY' },
      });
      expect(structured(argument)).toMatchObject({
        status: 'ok',
        value: {
          arguments: [
            expect.objectContaining({
              contextIds: ['CTX-MEASUREMENT'],
              resolvedPremises: [],
              backgroundAxioms: [
                expect.objectContaining({
                  axiomId: 'AX-UNITS',
                  viaContextIds: ['CTX-MEASUREMENT'],
                }),
              ],
            }),
          ],
        },
      });
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
        [JSON.stringify({ schemaVersion: 8 }), 'future-schema'],
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
