import { McpServer } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import {
  ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
  ARGUMENT_PROPOSAL_MAX_LIST_ITEMS,
  ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
  ARGUMENT_PROPOSAL_MAX_TITLE_LENGTH,
  ARGUMENT_LIBRARY_SCHEMA_VERSION,
  ArgumentCanonicalResolutionService,
  ArgumentLibraryRepository,
  ArgumentProposalSubmissionService,
  CONTENT_FINGERPRINT_ALGORITHM,
  KNOWLEDGE_READER_CONTRACT_VERSION,
  prepareCanonicalResolution,
  type CanonicalResolutionPackageSpec,
  type CanonicalResolutionPlan,
  type ArgumentRuntime,
  type CreateArgumentProposalInput,
  type ReviseArgumentProposalInput,
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

const STAGING_WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const DISCARD_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const CANONICAL_WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
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
const proposalPremiseInput = z.discriminatedUnion('kind', [
  z
    .object({ id: proposalId, kind: z.literal('text'), text: proposalText })
    .strict(),
  z
    .object({
      id: proposalId,
      kind: z.literal('axiom'),
      axiomId: proposalId,
      reliedOnRevision: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      id: proposalId,
      kind: z.literal('argument-conclusion'),
      argumentId: proposalId,
      reliedOnRevision: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      id: proposalId,
      kind: z.literal('argument-premise'),
      argumentId: proposalId,
      premiseId: proposalId,
      reliedOnRevision: z.number().int().min(1),
    })
    .strict(),
]);
const reasoningReferenceInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('premise'), premiseId: proposalId }).strict(),
  z.object({ kind: z.literal('reasoning-step'), stepId: proposalId }).strict(),
]);
const proposalDraftRelationInput = z
  .object({
    id: proposalId,
    kind: z.enum([
      'attack',
      'support',
      'refine',
      'extend',
      'supersede',
      'related',
    ]),
    targetProposalId: proposalId,
    targetProposalRevision: z.number().int().min(1),
  })
  .strict();
const submitProposalInput = z
  .object({
    clientSubmissionId: proposalId.optional(),
    title: z.string().trim().min(1).max(ARGUMENT_PROPOSAL_MAX_TITLE_LENGTH),
    softExplanationMarkdown: proposalText.optional(),
    intent: z
      .enum([
        'unspecified',
        'new',
        'attack',
        'support',
        'refine',
        'extend',
        'add-boundary',
        'supersede',
      ])
      .optional(),
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
    premises: z
      .array(proposalPremiseInput)
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      .optional(),
    premiseHints: z
      .array(proposalText)
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      .optional(),
    suggestedAxiomIds: z
      .array(proposalId)
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      .optional(),
    reasoning: proposalText.optional(),
    reasoningSteps: z
      .array(
        z
          .object({
            id: proposalId,
            text: proposalText,
            uses: z
              .array(reasoningReferenceInput)
              .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS),
          })
          .strict(),
      )
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      .optional(),
    conclusion: proposalText,
    boundary: proposalText.optional(),
    sourceObservations: z
      .array(
        z
          .object({
            id: proposalId,
            observation: proposalText,
            label: proposalText.optional(),
            repository: proposalText.optional(),
            url: z.url().max(ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH).optional(),
            commitSha: z
              .string()
              .regex(/^[a-f0-9]{7,64}$/iu)
              .optional(),
            sourceVersion: proposalText.optional(),
            filePath: proposalText.optional(),
            heading: proposalText.optional(),
            span: proposalText.optional(),
          })
          .strict(),
      )
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      .optional(),
    draftRelations: z
      .array(proposalDraftRelationInput)
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      .optional(),
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
  .strict()
  .superRefine((value, context) => {
    if (
      value.premises !== undefined &&
      ((value.premiseHints?.length ?? 0) > 0 ||
        (value.suggestedAxiomIds?.length ?? 0) > 0)
    )
      context.addIssue({
        code: 'custom',
        message: 'Use typed premises or the legacy premise fields, not both.',
        path: ['premises'],
      });
  });

const reviseProposalInput = z
  .object({
    title: submitProposalInput.shape.title,
    softExplanationMarkdown: submitProposalInput.shape.softExplanationMarkdown,
    intent: submitProposalInput.shape.intent,
    topicId: submitProposalInput.shape.topicId,
    target: submitProposalInput.shape.target,
    examples: submitProposalInput.shape.examples,
    reasoning: submitProposalInput.shape.reasoning,
    reasoningSteps: submitProposalInput.shape.reasoningSteps,
    conclusion: submitProposalInput.shape.conclusion,
    boundary: submitProposalInput.shape.boundary,
    sourceObservations: submitProposalInput.shape.sourceObservations,
    draftRelations: submitProposalInput.shape.draftRelations,
    whyNovelOrUnresolved: submitProposalInput.shape.whyNovelOrUnresolved,
    consultation: submitProposalInput.shape.consultation,
    proposalId,
    expectedRevision: z.number().int().min(1),
    revisionReason: proposalText,
    premises: z
      .array(proposalPremiseInput)
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS),
  })
  .strict();

const proposalSnapshotInput = z
  .object({
    libraryId: proposalId,
    schemaVersion: z.literal(ARGUMENT_LIBRARY_SCHEMA_VERSION),
    libraryRevision: z.number().int().min(1),
    contentFingerprint: z
      .object({
        algorithm: z.literal(CONTENT_FINGERPRINT_ALGORITHM),
        value: z.string().regex(/^[a-f0-9]{64}$/u),
      })
      .strict(),
  })
  .strict();

const listProposalsInput = z
  .object({
    query: z.string().trim().max(2_000).optional(),
    status: z.enum(['pending', 'discarded', 'stored', 'all']).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

const readProposalInput = z.object({ proposalId }).strict();

const discardProposalInput = z
  .object({
    proposalId,
    expectedRevision: z.number().int().min(1),
    expectedSnapshot: proposalSnapshotInput,
    note: proposalText.optional(),
  })
  .strict();

const retrievalInput = z
  .object({
    aliases: z
      .array(proposalText)
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      .optional(),
    keywords: z
      .array(proposalText)
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      .optional(),
    phrases: z
      .array(proposalText)
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      .optional(),
  })
  .strict();
const sourcePositionInput = z
  .object({
    line: z.number().int().min(1),
    column: z.number().int().min(1),
    offset: z.number().int().min(0).optional(),
  })
  .strict();
const theorySourceReferenceInput = z
  .object({
    id: proposalId,
    sourceSpaceHint: proposalText.optional(),
    path: proposalText,
    heading: proposalText.optional(),
    block: proposalText.optional(),
    label: proposalText,
    originalWikilink: proposalText.optional(),
    role: z.enum(['target', 'basis', 'support']),
    entityIdHint: proposalText.optional(),
    recordedVersion: z
      .object({
        sourceVersion: proposalText.optional(),
        contentFingerprint:
          proposalSnapshotInput.shape.contentFingerprint.optional(),
        fingerprintScope: z.enum(['file', 'heading', 'block', 'span']),
        span: z
          .object({ start: sourcePositionInput, end: sourcePositionInput })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const resolutionArgumentReferenceInput = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('existing'),
      argumentId: proposalId,
      expectedRevision: z.number().int().min(1),
    })
    .strict(),
  z.object({ kind: z.literal('proposal'), proposalId }).strict(),
]);
const resolutionRelationInput = z
  .object({
    id: proposalId.optional(),
    kind: z.enum(['attack', 'support']),
    target: resolutionArgumentReferenceInput,
    targetPart: targetPartInput,
  })
  .strict();
const resolutionPremiseBindingInput = z
  .object({
    premiseId: proposalId,
    targetProposalId: proposalId,
    targetPart: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('conclusion') }).strict(),
      z.object({ kind: z.literal('premise'), premiseId: proposalId }).strict(),
    ]),
  })
  .strict();
const resolutionCounterTargetInput = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('argument'),
      argument: resolutionArgumentReferenceInput,
      part: targetPartInput,
    })
    .strict(),
  z
    .object({
      kind: z.literal('topic-claim'),
      topicId: proposalId,
      expectedRevision: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('axiom'),
      axiomId: proposalId,
      expectedRevision: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('counter-argument'),
      counterArgumentId: proposalId,
      expectedRevision: z.number().int().min(1),
    })
    .strict(),
]);
const resolutionResponseInput = z
  .object({
    answeringAxioms: z
      .array(
        z
          .object({
            axiomId: proposalId,
            reliedOnRevision: z.number().int().min(1),
          })
          .strict(),
      )
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      .optional(),
    explanation: z.string().max(ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH).optional(),
    outcome: z
      .enum([
        'unanswered',
        'standing',
        'partially-addressed',
        'refuted',
        'inapplicable-under-stated-scope',
      ])
      .optional(),
    boundary: proposalText.optional(),
    reopeningCondition: proposalText.optional(),
  })
  .strict();
const resolutionBaseFields = {
  proposalId,
  expectedRevision: z.number().int().min(1),
  canonicalId: proposalId.optional(),
  topicIds: z.array(proposalId).max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS),
  retrieval: retrievalInput.optional(),
  sourceReferences: z
    .array(theorySourceReferenceInput)
    .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
    .optional(),
  note: proposalText.optional(),
} as const;
const resolutionProposalInput = z.discriminatedUnion('kind', [
  z
    .object({
      ...resolutionBaseFields,
      kind: z.literal('argument'),
      contextIds: z
        .array(proposalId)
        .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
        .optional(),
      relations: z
        .array(resolutionRelationInput)
        .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
        .optional(),
      supersedes: resolutionArgumentReferenceInput.optional(),
      premiseBindings: z
        .array(resolutionPremiseBindingInput)
        .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
        .optional(),
      promoteTopicId: proposalId.optional(),
    })
    .strict(),
  z
    .object({
      ...resolutionBaseFields,
      kind: z.literal('counter-argument'),
      target: resolutionCounterTargetInput.optional(),
      response: resolutionResponseInput.optional(),
    })
    .strict(),
]);
const prepareResolutionInput = z
  .object({
    proposals: z.array(resolutionProposalInput).min(1).max(20),
    draftRelationDispositions: z
      .array(
        z
          .object({
            sourceProposalId: proposalId,
            relationId: proposalId,
            action: z.enum([
              'staging-only',
              'counter-target',
              'argument-relation',
              'supersession',
            ]),
          })
          .strict(),
      )
      .max(ARGUMENT_PROPOSAL_MAX_LIST_ITEMS),
  })
  .strict();
const applyResolutionInput = z
  .object({ plan: z.record(z.string(), z.unknown()) })
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
    ...(input.softExplanationMarkdown === undefined
      ? {}
      : { softExplanationMarkdown: input.softExplanationMarkdown }),
    ...(input.intent === undefined ? {} : { intent: input.intent }),
    ...(input.topicId === undefined ? {} : { topicId: input.topicId }),
    ...(input.target === undefined ? {} : { target: input.target }),
    examples: input.examples,
    ...(input.premises === undefined ? {} : { premises: input.premises }),
    ...(input.premiseHints === undefined
      ? {}
      : { premiseHints: input.premiseHints }),
    ...(input.suggestedAxiomIds === undefined
      ? {}
      : { suggestedAxiomIds: input.suggestedAxiomIds }),
    ...(input.reasoning === undefined ? {} : { reasoning: input.reasoning }),
    ...(input.reasoningSteps === undefined
      ? {}
      : { reasoningSteps: input.reasoningSteps }),
    conclusion: input.conclusion,
    ...(input.boundary === undefined ? {} : { boundary: input.boundary }),
    ...(input.sourceObservations === undefined
      ? {}
      : {
          sourceObservations: input.sourceObservations.map((observation) => ({
            id: observation.id,
            observation: observation.observation,
            ...(observation.label === undefined
              ? {}
              : { label: observation.label }),
            ...(observation.repository === undefined
              ? {}
              : { repository: observation.repository }),
            ...(observation.url === undefined ? {} : { url: observation.url }),
            ...(observation.commitSha === undefined
              ? {}
              : { commitSha: observation.commitSha }),
            ...(observation.sourceVersion === undefined
              ? {}
              : { sourceVersion: observation.sourceVersion }),
            ...(observation.filePath === undefined
              ? {}
              : { filePath: observation.filePath }),
            ...(observation.heading === undefined
              ? {}
              : { heading: observation.heading }),
            ...(observation.span === undefined
              ? {}
              : { span: observation.span }),
          })),
        }),
    ...(input.draftRelations === undefined
      ? {}
      : { draftRelations: input.draftRelations }),
    whyNovelOrUnresolved: input.whyNovelOrUnresolved,
    consultation: input.consultation,
  };
}

function domainRevisionInput(
  input: z.infer<typeof reviseProposalInput>,
): ReviseArgumentProposalInput {
  const draft = domainProposalInput(input);
  return {
    proposalId: input.proposalId,
    expectedRevision: input.expectedRevision,
    revisionReason: input.revisionReason,
    title: draft.title,
    ...(draft.softExplanationMarkdown === undefined
      ? {}
      : { softExplanationMarkdown: draft.softExplanationMarkdown }),
    ...(draft.intent === undefined ? {} : { intent: draft.intent }),
    ...(draft.topicId === undefined ? {} : { topicId: draft.topicId }),
    ...(draft.target === undefined ? {} : { target: draft.target }),
    examples: draft.examples,
    premises: input.premises,
    ...(draft.reasoning === undefined ? {} : { reasoning: draft.reasoning }),
    ...(draft.reasoningSteps === undefined
      ? {}
      : { reasoningSteps: draft.reasoningSteps }),
    conclusion: draft.conclusion,
    ...(draft.boundary === undefined ? {} : { boundary: draft.boundary }),
    ...(draft.sourceObservations === undefined
      ? {}
      : { sourceObservations: draft.sourceObservations }),
    ...(draft.draftRelations === undefined
      ? {}
      : { draftRelations: draft.draftRelations }),
    whyNovelOrUnresolved: draft.whyNovelOrUnresolved,
    consultation: draft.consultation,
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
        'After independent candidate reasoning, call compiler_usage_guide before a Compiler cross-check. Canonical index tools exclude Mailbox drafts. You may create, read, revise, and link material non-canonical To store Proposals autonomously. Discard and canonical prepare/apply require an explicit user request. Prepare exact canonical packages first; apply only an unchanged ready plan, never infer Current, supersession, or draft-link conversion.',
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
          toStoreProposals: loaded.library.proposals.filter(
            ({ status }) => status === 'pending',
          ).length,
          discardedProposals: loaded.library.proposals.filter(
            ({ status }) => status === 'discarded',
          ).length,
          storedProposals: loaded.library.proposals.filter(
            ({ status }) => status === 'stored',
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
    'compiler_list_proposals',
    {
      title: 'List Mailbox staging proposals',
      description:
        'List or text-filter bounded non-canonical Mailbox proposals. Defaults to active To store work and remains separate from the canonical Argument Library index.',
      inputSchema: listProposalsInput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) => {
      const loaded = await loader.load();
      if (loaded.status === 'error') return loadErrorResult(loaded);
      const query = input.query?.toLocaleLowerCase();
      const status = input.status ?? 'pending';
      const matching = loaded.library.proposals
        .filter((proposal) => status === 'all' || proposal.status === status)
        .filter((proposal) => {
          if (query === undefined || query === '') return true;
          return [
            proposal.id,
            proposal.title,
            proposal.conclusion,
            proposal.whyNovelOrUnresolved,
            proposal.softExplanationMarkdown ?? '',
          ].some((value) => value.toLocaleLowerCase().includes(query));
        })
        .sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            left.id.localeCompare(right.id),
        );
      const limit = input.limit ?? 50;
      return serializedResult({
        status: 'ok',
        snapshot: loaded.snapshot.descriptor,
        total: matching.length,
        truncated: matching.length > limit,
        proposals: matching.slice(0, limit).map((proposal) => ({
          id: proposal.id,
          revision: proposal.revision,
          status: proposal.status,
          title: proposal.title,
          conclusion: proposal.conclusion,
          intent: proposal.intent,
          topicId: proposal.topicId,
          updatedAt: proposal.updatedAt,
          priorRevisionCount: proposal.revisionHistory.length,
          draftRelationCount: proposal.draftRelations.length,
        })),
      });
    },
  );

  server.registerTool(
    'compiler_read_proposal',
    {
      title: 'Read one Mailbox staging proposal',
      description:
        'Read a non-canonical Proposal, its current revision, recoverable prior revisions, provenance, and draft Proposal links. This does not make the Proposal canonical.',
      inputSchema: readProposalInput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) => {
      const loaded = await loader.load();
      if (loaded.status === 'error') return loadErrorResult(loaded);
      const proposal = loaded.library.proposals.find(
        ({ id }) => id === input.proposalId,
      );
      if (proposal === undefined) {
        const error = {
          status: 'error',
          error: {
            code: 'proposal-not-found',
            message: `Proposal "${input.proposalId}" does not exist.`,
          },
        };
        return { ...serializedResult(error), isError: true };
      }
      const linkedFrom = loaded.library.proposals.flatMap((source) =>
        source.draftRelations
          .filter(({ targetProposalId }) => targetProposalId === proposal.id)
          .map((relation) => ({
            sourceProposalId: source.id,
            sourceProposalRevision: source.revision,
            relation,
          })),
      );
      return serializedResult({
        status: 'ok',
        snapshot: loaded.snapshot.descriptor,
        proposal,
        linkedFrom,
      });
    },
  );

  server.registerTool(
    'compiler_prepare_resolution',
    {
      title: 'Prepare an atomic canonical resolution package',
      description:
        'Explicit-user-only and read-only: validate an exact multi-Proposal canonical package against the current snapshot and return an immutable plan, preview, and fingerprint. Omitted Current promotion, supersession, and canonical relations mean none. Every selected draft relation must be explicitly mapped or marked staging-only. Preparation never changes canonical theory.',
      inputSchema: prepareResolutionInput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) => {
      const loaded = await loader.load();
      if (loaded.status === 'error') return loadErrorResult(loaded);
      try {
        const prepared = prepareCanonicalResolution(
          loaded.library,
          input as CanonicalResolutionPackageSpec,
          proposalRuntime,
        );
        if (prepared.status === 'needs-decision') {
          return serializedResult({
            status: prepared.status,
            snapshot: prepared.base,
            unresolvedChoices: prepared.unresolvedChoices,
          });
        }
        return serializedResult({
          status: 'ready',
          plan: prepared.plan,
          preview: prepared.plan.preview,
        });
      } catch (error: unknown) {
        const response = {
          status: 'error',
          error: {
            code: 'resolution-preparation-invalid',
            message: error instanceof Error ? error.message : String(error),
          },
        };
        return { ...serializedResult(response), isError: true };
      }
    },
  );

  server.registerTool(
    'compiler_submit_proposal',
    {
      title: 'Submit proposal to human Mailbox',
      description:
        'Create one active To store, non-canonical Proposal after independent reasoning and a Compiler cross-check. Prefer revising an existing Proposal over creating a duplicate. Draft Proposal relations are staging intent only. A human remains solely responsible for canonical storage, relations, supersession, Current promotion, or refutation.',
      inputSchema: submitProposalInput,
      annotations: STAGING_WRITE_ANNOTATIONS,
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

  server.registerTool(
    'compiler_revise_proposal',
    {
      title: 'Revise a To store Proposal',
      description:
        'Replace the current content of one active non-canonical Proposal while retaining the prior revision and reason. Requires the exact Proposal revision and consultation snapshot. Use only for a material improvement, correction, restructuring, or new draft relationship—not cosmetic wording churn. This tool cannot store canonical theory.',
      inputSchema: reviseProposalInput,
      annotations: STAGING_WRITE_ANNOTATIONS,
    },
    async (input) => {
      const fingerprint = input.consultation.contentFingerprint;
      const expected = {
        libraryId: input.consultation.libraryId,
        schemaVersion: ARGUMENT_LIBRARY_SCHEMA_VERSION,
        libraryRevision: input.consultation.libraryRevision,
        contentFingerprint: fingerprint,
      };
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
            code: 'proposal-revision-unavailable',
            message:
              opened.status === 'missing'
                ? 'The Argument Library is missing.'
                : opened.message,
          },
        };
        return { ...serializedResult(error), isError: true };
      }
      const result = await proposalService.reviseProposal(
        expected,
        domainRevisionInput(input),
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
      const proposal = result.snapshot.library.proposals.find(
        ({ id }) => id === input.proposalId,
      )!;
      return serializedResult({
        status: 'ok',
        proposalId: proposal.id,
        proposalStatus: proposal.status,
        proposalRevision: proposal.revision,
        priorRevisionCount: proposal.revisionHistory.length,
        snapshot: result.snapshot.descriptor,
      });
    },
  );

  server.registerTool(
    'compiler_discard_proposal',
    {
      title: 'Discard a Proposal from active staging',
      description:
        'Explicit-user-only: mark one active To store Proposal discarded while preserving its history. This creates no canonical Argument or Counter-Argument. The fact that an AI created or revised a Proposal never grants permission to discard it.',
      inputSchema: discardProposalInput,
      annotations: DISCARD_ANNOTATIONS,
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
            code: 'proposal-discard-unavailable',
            message:
              opened.status === 'missing'
                ? 'The Argument Library is missing.'
                : opened.message,
          },
        };
        return { ...serializedResult(error), isError: true };
      }
      const result = await proposalService.discardProposal(
        input.expectedSnapshot,
        {
          proposalId: input.proposalId,
          expectedRevision: input.expectedRevision,
          ...(input.note === undefined ? {} : { note: input.note }),
        },
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
      const proposal = result.snapshot.library.proposals.find(
        ({ id }) => id === input.proposalId,
      )!;
      return serializedResult({
        status: 'ok',
        proposalId: proposal.id,
        proposalStatus: proposal.status,
        proposalRevision: proposal.revision,
        canonicalRecordsCreated: 0,
        snapshot: result.snapshot.descriptor,
      });
    },
  );

  server.registerTool(
    'compiler_apply_resolution',
    {
      title: 'Apply an exact atomic canonical resolution plan',
      description:
        'Explicit-user-only canonical mutation: apply exactly one unchanged ready plan returned by compiler_prepare_resolution in a single expected-snapshot commit. Never reinterpret or silently rebase a stale plan. Exact retries are idempotent through the durable resolution receipt. A successful call changes canonical theory.',
      inputSchema: applyResolutionInput,
      annotations: CANONICAL_WRITE_ANNOTATIONS,
    },
    async (input) => {
      const repository = new ArgumentLibraryRepository(loader.store());
      const opened = await repository.open();
      if (opened.status !== 'ready') {
        const error = {
          status: 'error',
          error: {
            code: 'resolution-apply-unavailable',
            message:
              opened.status === 'missing'
                ? 'The Argument Library is missing.'
                : opened.message,
          },
        };
        return { ...serializedResult(error), isError: true };
      }
      const service = new ArgumentCanonicalResolutionService(
        repository,
        proposalRuntime,
      );
      const result = await service.apply(
        input.plan as unknown as CanonicalResolutionPlan,
      );
      if (
        result.status !== 'committed' &&
        result.status !== 'already-applied'
      ) {
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
        alreadyApplied: result.status === 'already-applied',
        resolutionReceipt: result.receipt,
        canonicalRecords: result.receipt.resultingRecords,
        snapshot: result.snapshot.descriptor,
      });
    },
  );

  return server;
}
