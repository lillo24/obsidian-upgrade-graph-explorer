import { McpServer } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import {
  KNOWLEDGE_READER_CONTRACT_VERSION,
  type ListIndexRequest,
  type ReadArgumentBundleResult,
  type ReadArgumentBundleRequest,
  type SearchIndexRequest,
  type SnapshotBoundResult,
  type IndexPage,
} from '@icarus-graph-explorer/argument-workspace';

import {
  ArgumentLibraryLoader,
  type ArgumentLibraryLoaderOptions,
  type LibraryLoadResult,
} from './loader';
import {
  ARGUMENT_COMPILER_USAGE_GUIDE_MARKDOWN,
  ARGUMENT_COMPILER_USAGE_GUIDE_VERSION,
} from './usage-guide';

export const ARGUMENT_MCP_SERVER_NAME =
  '@icarus-graph-explorer/argument-mcp-server';
export const ARGUMENT_MCP_SERVER_VERSION = '0.0.0';
export const MAX_TOOL_RESULT_BYTES = 1024 * 1024;

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const emptyInput = z.object({}).strict();

const usageGuideOutput = z
  .object({
    status: z.literal('ok'),
    version: z.string(),
    format: z.literal('markdown'),
    guide: z.string(),
  })
  .strict();

const listIndexInput = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).max(8_192).optional(),
    includeArchived: z.boolean().optional(),
  })
  .strict();

const searchIndexInput = z
  .object({
    query: z.string().max(2_000),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).max(8_192).optional(),
    includeArchived: z.boolean().optional(),
  })
  .strict();

const readBundleInput = z
  .object({
    id: z.string().trim().min(1).max(512),
    kind: z
      .enum(['topic', 'context', 'axiom', 'argument', 'counter-argument'])
      .optional(),
    maxRecords: z.number().int().min(1).max(500).optional(),
    maxDepth: z.number().int().min(0).max(32).optional(),
  })
  .strict();

type JsonObject = Record<string, unknown>;

function domainListRequest(
  input: z.infer<typeof listIndexInput>,
): ListIndexRequest {
  return {
    ...(input.limit === undefined ? {} : { limit: input.limit }),
    ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
    ...(input.includeArchived === undefined
      ? {}
      : { includeArchived: input.includeArchived }),
  };
}

function domainSearchRequest(
  input: z.infer<typeof searchIndexInput>,
): SearchIndexRequest {
  return { query: input.query, ...domainListRequest(input) };
}

function domainBundleRequest(
  input: z.infer<typeof readBundleInput>,
): ReadArgumentBundleRequest {
  return {
    id: input.id,
    ...(input.kind === undefined ? {} : { kind: input.kind }),
    ...(input.maxRecords === undefined ? {} : { maxRecords: input.maxRecords }),
    ...(input.maxDepth === undefined ? {} : { maxDepth: input.maxDepth }),
  };
}

function asJsonObject(value: object): JsonObject {
  return value as JsonObject;
}

function serializedResult(value: JsonObject): CallToolResult {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text, 'utf8') > MAX_TOOL_RESULT_BYTES) {
    const error = {
      status: 'error',
      error: {
        code: 'response-too-large',
        message:
          'The tool result exceeds the response limit. Request fewer records or a shallower bundle.',
      },
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(error) }],
      structuredContent: error,
      isError: true,
    };
  }
  return {
    content: [{ type: 'text', text }],
    structuredContent: value,
  };
}

function loadErrorResult(
  result: Extract<LibraryLoadResult, { readonly status: 'error' }>,
): CallToolResult {
  const error = {
    status: 'error',
    error: { code: result.code, message: result.message },
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(error) }],
    structuredContent: error,
    isError: true,
  };
}

function readerResult(
  result: SnapshotBoundResult<IndexPage> | ReadArgumentBundleResult,
): CallToolResult {
  const response = serializedResult(asJsonObject(result));
  return result.status === 'ok' ? response : { ...response, isError: true };
}

function usageGuideResult(): CallToolResult {
  const structuredContent = {
    status: 'ok',
    version: ARGUMENT_COMPILER_USAGE_GUIDE_VERSION,
    format: 'markdown',
    guide: ARGUMENT_COMPILER_USAGE_GUIDE_MARKDOWN,
  };
  const resultBytes = Buffer.byteLength(
    JSON.stringify(structuredContent),
    'utf8',
  );
  if (resultBytes > MAX_TOOL_RESULT_BYTES) {
    throw new Error(
      `Bundled Compiler usage guide result is ${resultBytes} bytes; the maximum is ${MAX_TOOL_RESULT_BYTES}.`,
    );
  }
  return {
    content: [{ type: 'text', text: ARGUMENT_COMPILER_USAGE_GUIDE_MARKDOWN }],
    structuredContent,
  };
}

export interface CreateArgumentMcpServerOptions extends ArgumentLibraryLoaderOptions {
  readonly loader?: ArgumentLibraryLoader;
}

export function createArgumentMcpServer(
  options: CreateArgumentMcpServerOptions = {},
): McpServer {
  const loader = options.loader ?? new ArgumentLibraryLoader(options);
  const server = new McpServer(
    { name: ARGUMENT_MCP_SERVER_NAME, version: ARGUMENT_MCP_SERVER_VERSION },
    {
      instructions:
        'After independent candidate reasoning, call compiler_usage_guide when beginning a Compiler cross-check. Search before guessing record IDs. Stored records are challengeable framework knowledge, not external proof.',
    },
  );

  server.registerTool(
    'compiler_usage_guide',
    {
      title: 'Read Argument Compiler usage guide',
      description:
        'Read the Argument Compiler retrieval and cross-check protocol. Use after independent candidate reasoning is complete and before querying the Argument Library in depth.',
      inputSchema: emptyInput,
      outputSchema: usageGuideOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => usageGuideResult(),
  );

  server.registerTool(
    'compiler_status',
    {
      title: 'Argument Library status',
      description:
        'Check whether the Argument Library is readable and return portable snapshot identity and record counts. Never returns its local path.',
      inputSchema: emptyInput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      const loaded = await loader.load();
      if (loaded.status === 'error') {
        return serializedResult({
          available: false,
          error: { code: loaded.code, message: loaded.message },
        });
      }
      return serializedResult({
        available: true,
        libraryId: loaded.snapshot.descriptor.libraryId,
        schemaVersion: loaded.snapshot.descriptor.schemaVersion,
        libraryRevision: loaded.snapshot.descriptor.libraryRevision,
        contentFingerprint: loaded.snapshot.descriptor.contentFingerprint,
        recordCounts: {
          topics: loaded.library.topics.length,
          contexts: loaded.library.contexts.length,
          axioms: loaded.library.axioms.length,
          arguments: loaded.library.arguments.length,
          counterArguments: loaded.library.counterArguments.length,
        },
        knowledgeReaderContractVersion: KNOWLEDGE_READER_CONTRACT_VERSION,
      });
    },
  );

  server.registerTool(
    'compiler_list_index',
    {
      title: 'List Argument Library index',
      description:
        'List a bounded page of descriptive records and stable IDs. Search before guessing IDs. Results are framework knowledge, not a logical verdict or external proof.',
      inputSchema: listIndexInput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) => {
      const loaded = await loader.load();
      return loaded.status === 'error'
        ? loadErrorResult(loaded)
        : readerResult(loaded.reader.listIndex(domainListRequest(input)));
    },
  );

  server.registerTool(
    'compiler_search_index',
    {
      title: 'Search Argument Library index',
      description:
        'Search bounded descriptive records for relevant context before guessing IDs. An empty result is valid; matches are framework knowledge, not a verdict or external proof.',
      inputSchema: searchIndexInput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) => {
      const loaded = await loader.load();
      return loaded.status === 'error'
        ? loadErrorResult(loaded)
        : readerResult(loaded.reader.searchIndex(domainSearchRequest(input)));
    },
  );

  server.registerTool(
    'compiler_read_bundle',
    {
      title: 'Read Argument Library bundle',
      description:
        'Read a record with its bounded argument context, response, scope, source references, completeness, and receipt. Read an existing objection bundle before repeating it. Stored Axioms and responses may be challenged explicitly; this retrieval does not prove claims externally, and MCP1 cannot read live source text.',
      inputSchema: readBundleInput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) => {
      const loaded = await loader.load();
      return loaded.status === 'error'
        ? loadErrorResult(loaded)
        : readerResult(
            loaded.reader.readArgumentBundle(domainBundleRequest(input)),
          );
    },
  );

  return server;
}
