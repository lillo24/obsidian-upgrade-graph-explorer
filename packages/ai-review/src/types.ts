export const REVIEW_RUN_SCHEMA_VERSION = 1 as const;
export const COMPILER_PROTOCOL_VERSION = 1 as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ReviewStage = 'negative' | 'positive' | 'integrator' | 'post-check';

export type AttemptState =
  | 'queued'
  | 'running'
  | 'waiting-for-tool'
  | 'completed'
  | 'failed'
  | 'cancel-requested'
  | 'cancelled'
  | 'interrupted'
  | 'blocked';

export type RunState =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancel-requested'
  | 'cancelled'
  | 'interrupted'
  | 'blocked';

export interface SuppliedMaterialProvenance {
  kind: 'supplied';
  label: string;
}

export interface GitMaterialProvenance {
  kind: 'git';
  commitId: string;
  baseCommitId: string;
  headCommitId: string;
}

export interface ReviewMaterial {
  id: string;
  relativePath: string;
  kind: 'source' | 'diff';
  content: string;
  provenance: SuppliedMaterialProvenance | GitMaterialProvenance;
}

interface ReviewSourceBase {
  selectedPaths: string[];
  materials: ReviewMaterial[];
  completeness: 'complete' | 'incomplete';
  missingMaterial: string[];
  omissions: string[];
  acceptIncomplete?: true;
}

export interface SuppliedReviewSource extends ReviewSourceBase {
  mode: 'supplied-material';
}

export interface GitHistoryReviewSource extends ReviewSourceBase {
  mode: 'captured-git-history';
  baseCommitId: string;
  headCommitId: string;
  commitIds: string[];
  commitCount: number;
}

export type ReviewSource = SuppliedReviewSource | GitHistoryReviewSource;

export interface TemplateDefinition {
  version: string;
  text: string;
}

export interface ReviewTemplates {
  common: TemplateDefinition;
  analysis: TemplateDefinition;
  integrator: TemplateDefinition;
  postCheck: TemplateDefinition;
}

export interface ModelSettings {
  provider: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  metadata?: Record<string, JsonValue>;
}

export interface ReviewModelConfiguration {
  analysis: ModelSettings;
  integrator: ModelSettings;
  postCheck: ModelSettings;
}

export interface ReviewResourceLimits {
  maxInputBytes: number;
  maxPromptBytes: number;
  maxOutputBytes: number;
  maxExecutionMs: number;
  maxToolCalls: number;
  maxToolResultBytes: number;
}

export interface CompilerPlacementPolicy {
  analysis: boolean;
  integrator: boolean;
  postCheck: boolean;
  requestedSnapshotId?: string;
}

export interface StartReviewInput {
  workspaceId: string;
  source: ReviewSource;
  additionalRequest: string;
  models: ReviewModelConfiguration;
  templates?: Partial<ReviewTemplates>;
  limits?: Partial<ReviewResourceLimits>;
  compiler?: Partial<CompilerPlacementPolicy>;
}

export interface FrozenReviewInput {
  workspaceId: string;
  source: ReviewSource;
  additionalRequest: string;
  sharedMaterial: string;
  fingerprint: string;
}

export interface RenderedPrompt {
  templateVersion: string;
  commonTemplateVersion: string;
  text: string;
}

export type CompilerCapability =
  'list-index' | 'search-index' | 'read-bundle' | 'read-source';

export interface CompilerSnapshotDescriptor {
  protocolVersion: typeof COMPILER_PROTOCOL_VERSION;
  snapshotId: string;
  revision: string;
  capabilities: CompilerCapability[];
  openedAt: string;
}

export type CompilerResultStatus =
  | 'ok'
  | 'unavailable'
  | 'not-found'
  | 'source-unavailable'
  | 'stale-snapshot'
  | 'unauthorized'
  | 'invalid-request'
  | 'limit-exceeded'
  | 'cancelled';

export interface CompilerReference {
  canonicalId: string;
  revision: string;
  sourceHeading?: string;
}

export interface CompilerResultEnvelope {
  protocolVersion: typeof COMPILER_PROTOCOL_VERSION;
  snapshotId: string;
  snapshotRevision: string;
  status: CompilerResultStatus;
  content?: JsonValue;
  references: CompilerReference[];
  completeness: 'complete' | 'incomplete' | 'not-applicable';
  omissions: string[];
  freshness: 'retained' | 'stale' | 'unavailable';
  error?: {
    code: string;
    message: string;
  };
}

export interface CompilerIndexEntry {
  id: string;
  kind: 'topic' | 'axiom' | 'counter-argument';
  title: string;
  summary: string;
  retrievalHint?: string;
}

export interface CompilerCounterArgumentBundle {
  id: string;
  objection: string;
  challenges: string;
  answeringAxioms: string[];
  recordedResponse: string;
  whyResponseApplies: string;
  outcome: string;
  scope: string;
  boundaries: string[];
  sourceHeadingLinks: string[];
  missingMaterial: string[];
  dependentMaterial: string[];
}

export interface CompilerSnapshotSession {
  descriptor: CompilerSnapshotDescriptor;
  listIndex(
    input: { cursor?: string; limit: number },
    signal: AbortSignal,
  ): Promise<CompilerResultEnvelope>;
  searchIndex(
    input: {
      query: string;
      filter?: string;
      cursor?: string;
      limit: number;
    },
    signal: AbortSignal,
  ): Promise<CompilerResultEnvelope>;
  readBundle(
    input: { id: string },
    signal: AbortSignal,
  ): Promise<CompilerResultEnvelope>;
  readSource(
    input: { sourceId: string },
    signal: AbortSignal,
  ): Promise<CompilerResultEnvelope>;
}

export interface CompilerProvider {
  openSnapshot(input: {
    workspaceId: string;
    requestedSnapshotId?: string;
    signal: AbortSignal;
  }): Promise<CompilerSnapshotSession>;
}

export const COMPILER_TOOL_NAMES = [
  'compiler_list_index',
  'compiler_search_index',
  'compiler_read_bundle',
  'compiler_read_source',
] as const;

export type CompilerToolName = (typeof COMPILER_TOOL_NAMES)[number];

export interface ProviderToolDefinition {
  name: CompilerToolName;
  description: string;
  inputSchema: JsonValue;
}

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

interface ProviderEventBase {
  runId: string;
  stage: ReviewStage;
  attemptId: string;
  eventId: string;
}

export interface ProviderProgressEvent extends ProviderEventBase {
  type: 'progress';
  message: string;
}

export interface ProviderTextEvent extends ProviderEventBase {
  type: 'text-delta';
  text: string;
}

export interface ProviderToolCallEvent extends ProviderEventBase {
  type: 'tool-call';
  toolCallId: string;
  name: string;
  arguments: JsonValue;
}

export type ProviderTerminalStatus =
  'completed' | 'refused' | 'truncated' | 'failed' | 'cancelled';

export interface ProviderTerminalEvent extends ProviderEventBase {
  type: 'terminal';
  status: ProviderTerminalStatus;
  rawText: string;
  structured?: JsonValue;
  usage?: ProviderUsage;
  error?: string;
}

export type ProviderEvent =
  | ProviderProgressEvent
  | ProviderTextEvent
  | ProviderToolCallEvent
  | ProviderTerminalEvent;

export interface ProviderToolResult {
  toolCallId: string;
  name: string;
  result: CompilerResultEnvelope;
}

export interface AgentExecution {
  events: AsyncIterable<ProviderEvent>;
  submitToolResult(result: ProviderToolResult): Promise<void>;
  cancel(reason: string): Promise<void>;
  adapterMetadata?: Record<string, JsonValue>;
}

export interface AgentRunRequest {
  runId: string;
  stage: ReviewStage;
  attemptId: string;
  attemptNumber: number;
  contextId: string;
  instructions: string;
  material: FrozenReviewInput;
  model: ModelSettings;
  tools: ProviderToolDefinition[];
  limits: ReviewResourceLimits;
  signal: AbortSignal;
}

export interface AgentProvider {
  start(request: AgentRunRequest): AgentExecution;
}

export interface ContributionReference {
  attemptId: string;
  locator?: string;
  quote?: string;
}

export type IntegrationRelation =
  | 'agreement'
  | 'compatible'
  | 'direct-disagreement'
  | 'negative-only'
  | 'positive-only';

export interface IntegrationIssueInput {
  id: string;
  relation: IntegrationRelation;
  negativeReferences: ContributionReference[];
  positiveReferences: ContributionReference[];
  negativeContribution?: string;
  positiveContribution?: string;
  integrationMarkdown: string;
  unresolvedPoints: string[];
  integratorNotes: string[];
}

export interface IntegrationResultInput {
  schemaVersion: 1;
  summary: string;
  issues: IntegrationIssueInput[];
  unresolvedQuestions: string[];
}

export interface VerifiedContributionReference extends ContributionReference {
  verification: 'verified' | 'invalid';
  verificationMessage?: string;
}

export interface IntegrationIssue extends Omit<
  IntegrationIssueInput,
  'negativeReferences' | 'positiveReferences'
> {
  negativeReferences: VerifiedContributionReference[];
  positiveReferences: VerifiedContributionReference[];
}

export interface IntegrationResult extends Omit<
  IntegrationResultInput,
  'issues'
> {
  issues: IntegrationIssue[];
  validationWarnings: string[];
}

export type PostCheckFindingKind =
  | 'applicable-resolution'
  | 'existing-response-criticism'
  | 'axiom-criticism'
  | 'correction'
  | 'open-question';

export interface PostCheckResultInput {
  schemaVersion: 1;
  summary: string;
  findings: Array<{
    id: string;
    kind: PostCheckFindingKind;
    markdown: string;
    references: ContributionReference[];
  }>;
  revisedSynthesis?: string;
}

export interface PostCheckResult extends Omit<
  PostCheckResultInput,
  'findings'
> {
  findings: Array<
    Omit<PostCheckResultInput['findings'][number], 'references'> & {
      references: VerifiedContributionReference[];
    }
  >;
  validationWarnings: string[];
}

export interface ReviewOutput {
  rawMarkdown: string;
  structured?: IntegrationResult | PostCheckResult;
  structuredStatus: 'not-required' | 'valid' | 'invalid';
  validationErrors: string[];
}

export interface ReviewArtifact {
  id: string;
  mediaType: 'application/json' | 'text/markdown';
  byteLength: number;
  content: JsonValue | string;
}

export interface ToolCallRecord {
  toolCallId: string;
  name: string;
  argumentsArtifactId: string;
  resultArtifactId: string;
  status: CompilerResultStatus;
  canonicalReferences: CompilerReference[];
  duplicateDeliveries: number;
}

export interface RecordedProviderEvent {
  eventId: string;
  type: ProviderEvent['type'];
  at: string;
  summary: string;
}

export interface ReviewAttemptRecord {
  id: string;
  stage: ReviewStage;
  number: number;
  contextId: string;
  state: AttemptState;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  prompt: RenderedPrompt;
  model: ModelSettings;
  toolsAvailable: CompilerToolName[];
  recordsRetrieved: CompilerReference[];
  events: RecordedProviderEvent[];
  toolCalls: ToolCallRecord[];
  output?: ReviewOutput;
  terminalStatus?: ProviderTerminalStatus;
  usage?: ProviderUsage;
  error?: {
    code: string;
    message: string;
  };
  dependsOn: string[];
  automatic: boolean;
  current: boolean;
  cancellation?: {
    requestedAt: string;
    reason: string;
    remoteTerminationConfirmed: boolean;
  };
  adapterMetadata?: Record<string, JsonValue>;
}

export interface CompilerRunBinding {
  requested: boolean;
  descriptor?: CompilerSnapshotDescriptor;
  error?: {
    code: string;
    message: string;
  };
}

export interface ReviewRunRecord {
  schemaVersion: typeof REVIEW_RUN_SCHEMA_VERSION;
  id: string;
  state: RunState;
  createdAt: string;
  updatedAt: string;
  frozenInput: FrozenReviewInput;
  templates: ReviewTemplates;
  renderedPrompts: Partial<Record<ReviewStage, RenderedPrompt>>;
  models: ReviewModelConfiguration;
  limits: ReviewResourceLimits;
  compilerPolicy: CompilerPlacementPolicy;
  compilerBinding: CompilerRunBinding;
  attempts: ReviewAttemptRecord[];
  currentAttemptIds: Partial<Record<ReviewStage, string>>;
  automaticIntegrationPairs: string[];
  automaticPostCheckIntegrations: string[];
  artifacts: Record<string, ReviewArtifact>;
  cancellation?: {
    requestedAt: string;
    reason: string;
  };
}

export interface ReviewRunRepository {
  save(run: ReviewRunRecord): Promise<void>;
  load(runId: string): Promise<ReviewRunRecord | undefined>;
  list(): Promise<ReviewRunRecord[]>;
}

export interface ReviewClock {
  now(): Date;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ReviewIdGenerator {
  next(kind: 'run' | 'attempt' | 'context' | 'artifact'): string;
}

export interface ReviewRunHandle {
  runId: string;
  completion: Promise<ReviewRunRecord>;
  cancel(reason?: string): Promise<ReviewRunRecord>;
}
