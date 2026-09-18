import { McpServer } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import {
  ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
  ARGUMENT_PROPOSAL_MAX_LIST_ITEMS,
  ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
  ARGUMENT_PROPOSAL_MAX_TITLE_LENGTH,
  ArgumentLibraryRepository,
  ArgumentProposalSubmissionService,
  CONTENT_FINGERPRINT_ALGORITHM,
  KNOWLEDGE_READER_CONTRACT_VERSION,
  type ArgumentRuntime,
  type CreateArgumentProposalInput,
  type ListIndexRequest,
  type ReadArgumentBundleResult,
  type ReadArgumentBundleRequest,
  type SearchIndexRequest,
  type SnapshotBoundResult,
  type IndexPage,
} from '@icarus-graph-explorer/argument-workspace';
import { randomUUID } from 'node:crypto';

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

const APPEND_ONLY_ANNOTATIONS = {
  readOnlyHint: false,
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

const targetPartInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('argument') }).strict(),
  z
    .object({
      kind: z.literal('premise'),
      premiseId: z.string().trim().min(1).max(ARGUMENT_PROPOSAL_MAX_ID_LENGTH),
    })
    .strict(),
  z.object({ kind: z.literal('reasoning') }).strict(),
  z.object({ kind: z.literal('conclusion') }).strict(),
]);

const proposalText = z
  .string()
  .trim()
  .min(1)
  .max(ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH);
const proposalId = z
  .string()
  .trim()
  .min(1)
  .max(ARGUMENT_PROPOSAL_MAX_ID_LENGTH);
const submitProposalInput = z
  .object({
    clientSubmissionId: proposalId.optional(),
    title: z.string().trim().min(1).max(ARGUMENT_PROPOSAL_MAX_TITLE_LENGTH),
    topicId: proposalId.optional(),
    target: z
      .object({
        argumentId: proposalId,
        part: targetPartInput,
        reliedOnRevision: z.number().int().min(1),
      })
      .strict()
      .optional(),
    examples: z.array(proposalText).max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS),
    premiseHints: z.array(proposalText).max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS),
    suggestedAxiomIds: z
      .array(proposalId)
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      .optional(),
    reasoning: proposalText.optional(),
    conclusion: proposalText,
    boundary: proposalText.optional(),
    whyNovelOrUnresolved: proposalText,
    consultation: z
      .object({
        libraryId: proposalId,
        libraryRevision: z.number().int().min(1),
        contentFingerprint: z
          .object({
            algorithm: z.literal(CONTENT_FINGERPRINT_ALGORITHM),
            value: z.string().regex(/^[a-f0-9]{64}$/u),
          })
          .strict(),
        records: z
          .array(
            z
              .object({
                kind: z.enum([
                  'topic',
                  'axiom',
                  'argument',
                  'counter-argument',
                ]),
                id: proposalId,
                revision: z.number().int().min(1),
              })
              .strict(),
          )
          .min(1)
          .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS),
      })
      .strict(),
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

function domainProposalInput(
  input: z.infer<typeof submitProposalInput>,
): CreateArgumentProposalInput {
  return {
    ...(input.clientSubmissionId === undefined
      ? {}
      : { clientSubmissionId: input.clientSubmissionId }),
    title: input.title,
    ...(input.topicId === undefined ? {} : { topicId: input.topicId }),
    ...(input.target === undefined ? {} : { target: input.target }),
    examples: input.examples,
    premiseHints: input.premiseHints,
    ...(input.suggestedAxiomIds === undefined
      ? {}
      : { suggestedAxiomIds: input.suggestedAxiomIds }),
    ...(input.reasoning === undefined ? {} : { reasoning: input.reasoning }),
    conclusion: input.conclusion,
    ...(input.boundary === undefined ? {} : { boundary: input.boundary }),
    whyNovelOrUnresolved: input.whyNovelOrUnresolved,
    consultation: input.consultation,
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
  readonly proposalRuntime?: ArgumentRuntime;
}

export function createArgumentMcpServer(
  options: CreateArgumentMcpServerOptions = {},
): McpServer {
  const loader = options.loader ?? new ArgumentLibraryLoader(options);
  const proposalRuntime = options.proposalRuntime ?? {
    createId: (kind) => `${kind}-${randomUUID()}`,
    now: () => new Date().toISOString(),
  };
  const server = new McpServer(
    { name: ARGUMENT_MCP_SERVER_NAME, version: ARGUMENT_MCP_SERVER_VERSION },
    {
      instructions:
        'After independent candidate reasoning, call compiler_usage_guide when beginning a Compiler cross-check. Search before guessing IDs and fight the prior response. Submit only a surviving unresolved candidate; Mailbox submission is non-canonical and awaits human resolution.',
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
          proposals: loaded.library.proposals.length,
          pendingProposals: loaded.library.proposals.filter(
            ({ status }) => status === 'pending',
          ).length,
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

  server.registerTool(
    'compiler_submit_proposal',
    {
      title: 'Submit proposal to human Mailbox',
      description:
        'Append one pending, non-canonical proposal after independent reasoning and a Compiler cross-check. Mailbox submission does not establish that the proposal is correct. A human must accept or reject it and is solely responsible for any canonical Argument, Counter-Argument, Axiom dependency, supersession, or Current promotion.',
      inputSchema: submitProposalInput,
      annotations: APPEND_ONLY_ANNOTATIONS,
    },
    async (input) => {
      const proposalRepository = new ArgumentLibraryRepository(loader.store());
      const proposalService = new ArgumentProposalSubmissionService(
        proposalRepository,
        proposalRuntime,
      );
      const opened = await proposalRepository.open();
      if (opened.status !== 'ready') {
        const error = {
          status: 'error',
          error: {
            code: 'proposal-submission-unavailable',
            message:
              opened.status === 'missing'
                ? 'The Argument Library is missing.'
                : opened.message,
          },
        };
        return {
          ...serializedResult(error),
          isError: true,
        };
      }
      const result = await proposalService.submitProposal(
        opened.snapshot.descriptor,
        domainProposalInput(input),
      );
      if (result.status !== 'committed') {
        const error = {
          status: 'error',
          error: {
            code: result.status,
            message: result.message,
            ...(result.actual === undefined ? {} : { actual: result.actual }),
          },
        };
        return { ...serializedResult(error), isError: true };
      }
      return serializedResult({
        status: 'ok',
        proposalId: result.proposal.id,
        proposalStatus: result.proposal.status,
        duplicate: result.duplicate,
        snapshot: result.snapshot.descriptor,
      });
    },
  );

  return server;
}
