import {
  canonicalJson,
  captureArgumentLibrarySnapshot,
  clonePlainData,
  contentFingerprint,
  sameFingerprint,
  sameSnapshot,
  sha256,
} from './canonical';
import {
  ARGUMENT_WORKSPACE_INSERT_FORMAT,
  previewArgumentWorkspaceInsert,
  type ArgumentWorkspaceInsertDocument,
  type ArgumentWorkspaceInsertPreview,
} from './insert';
import { argumentProposalDraft } from './proposals';
import type {
  ArgumentLibrary,
  ArgumentProposal,
  ArgumentProposalResolutionReceipt,
  ArgumentProposalResultingRecord,
  ArgumentRelationKind,
  ArgumentRuntime,
  ArgumentTargetPart,
  ContentFingerprint,
  CounterArgumentResponse,
  CreateArgumentInput,
  CreateCounterArgumentInput,
  RetrievalMetadata,
  SnapshotDescriptor,
  TheorySourceReference,
} from './types';
import { assertValidArgumentLibrary } from './validation';

export const CANONICAL_RESOLUTION_FORMAT =
  'argument-canonical-resolution-v1' as const;
export const CANONICAL_RESOLUTION_MAX_PROPOSALS = 20;
export const CANONICAL_RESOLUTION_MAX_BYTES = 512 * 1024;

export type CanonicalResolutionArgumentReference =
  | {
      readonly kind: 'existing';
      readonly argumentId: string;
      readonly expectedRevision: number;
    }
  | { readonly kind: 'proposal'; readonly proposalId: string };

export interface CanonicalResolutionArgumentRelationSpec {
  readonly id?: string;
  readonly kind: ArgumentRelationKind;
  readonly target: CanonicalResolutionArgumentReference;
  readonly targetPart: ArgumentTargetPart;
}

export interface CanonicalResolutionPremiseBinding {
  readonly premiseId: string;
  readonly targetProposalId: string;
  readonly targetPart:
    | { readonly kind: 'conclusion' }
    | { readonly kind: 'premise'; readonly premiseId: string };
}

export type CanonicalResolutionCounterTargetSpec =
  | {
      readonly kind: 'argument';
      readonly argument: CanonicalResolutionArgumentReference;
      readonly part: ArgumentTargetPart;
    }
  | {
      readonly kind: 'topic-claim';
      readonly topicId: string;
      readonly expectedRevision: number;
    }
  | {
      readonly kind: 'axiom';
      readonly axiomId: string;
      readonly expectedRevision: number;
    }
  | {
      readonly kind: 'counter-argument';
      readonly counterArgumentId: string;
      readonly expectedRevision: number;
    };

interface CanonicalResolutionProposalSpecBase {
  readonly proposalId: string;
  readonly expectedRevision: number;
  readonly canonicalId?: string;
  readonly topicIds: readonly string[];
  readonly retrieval?: Partial<RetrievalMetadata>;
  readonly sourceReferences?: readonly TheorySourceReference[];
  readonly note?: string;
}

export interface CanonicalResolutionArgumentSpec extends CanonicalResolutionProposalSpecBase {
  readonly kind: 'argument';
  readonly contextIds?: readonly string[];
  readonly relations?: readonly CanonicalResolutionArgumentRelationSpec[];
  readonly supersedes?: CanonicalResolutionArgumentReference;
  readonly premiseBindings?: readonly CanonicalResolutionPremiseBinding[];
  readonly promoteTopicId?: string;
}

export interface CanonicalResolutionCounterArgumentSpec extends CanonicalResolutionProposalSpecBase {
  readonly kind: 'counter-argument';
  readonly target?: CanonicalResolutionCounterTargetSpec;
  readonly response?: Partial<CounterArgumentResponse>;
}

export type CanonicalResolutionProposalSpec =
  CanonicalResolutionArgumentSpec | CanonicalResolutionCounterArgumentSpec;

export type CanonicalResolutionDraftRelationAction =
  'staging-only' | 'counter-target' | 'argument-relation' | 'supersession';

export interface CanonicalResolutionDraftRelationDisposition {
  readonly sourceProposalId: string;
  readonly relationId: string;
  readonly action: CanonicalResolutionDraftRelationAction;
}

export interface CanonicalResolutionPackageSpec {
  readonly proposals: readonly CanonicalResolutionProposalSpec[];
  readonly draftRelationDispositions: readonly CanonicalResolutionDraftRelationDisposition[];
}

export interface CanonicalResolutionPlanProposal {
  readonly proposalId: string;
  readonly proposalRevision: number;
  readonly resultingRecord: ArgumentProposalResultingRecord;
  readonly note?: string;
}

export interface CanonicalResolutionPreview {
  readonly summary: string;
  readonly proposals: readonly CanonicalResolutionPlanProposal[];
  readonly insert: ArgumentWorkspaceInsertPreview;
  readonly currentPromotions: readonly {
    readonly topicId: string;
    readonly argumentId: string;
  }[];
  readonly draftRelationDispositions: readonly CanonicalResolutionDraftRelationDisposition[];
  readonly warnings: readonly string[];
}

export interface CanonicalResolutionPlan {
  readonly format: typeof CANONICAL_RESOLUTION_FORMAT;
  readonly base: SnapshotDescriptor;
  readonly proposals: readonly CanonicalResolutionPlanProposal[];
  readonly document: ArgumentWorkspaceInsertDocument;
  readonly currentPromotions: readonly {
    readonly topicId: string;
    readonly argumentId: string;
  }[];
  readonly draftRelationDispositions: readonly CanonicalResolutionDraftRelationDisposition[];
  readonly preview: CanonicalResolutionPreview;
  readonly resolutionId: string;
  readonly planFingerprint: ContentFingerprint;
}

export type CanonicalResolutionPreparationResult =
  | {
      readonly status: 'ready';
      readonly plan: CanonicalResolutionPlan;
      readonly candidate: ArgumentLibrary;
    }
  | {
      readonly status: 'needs-decision';
      readonly base: SnapshotDescriptor;
      readonly unresolvedChoices: readonly string[];
    };

export interface CanonicalResolutionApplyResult {
  readonly library: ArgumentLibrary;
  readonly receipt: ArgumentProposalResolutionReceipt;
  readonly alreadyApplied: boolean;
}

function requiredId(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized === '') throw new Error(`${label} is required.`);
  if (normalized.length > 512)
    throw new Error(`${label} exceeds the 512-character limit.`);
  return normalized;
}

function optionalNote(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (normalized === '') return undefined;
  if (normalized.length > 20_000)
    throw new Error('Resolution note exceeds the 20000-character limit.');
  return normalized;
}

function orderedUnique(values: readonly string[], label: string): string[] {
  const normalized = values.map((value, index) =>
    requiredId(value, `${label} ${index + 1}`),
  );
  if (new Set(normalized).size !== normalized.length)
    throw new Error(`${label} values must be unique.`);
  return [...normalized].sort((left, right) => left.localeCompare(right));
}

function generatedRecordId(
  library: ArgumentLibrary,
  proposal: ArgumentProposal,
  kind: 'argument' | 'counter-argument',
): string {
  const prefix = kind === 'argument' ? 'AR' : 'CA';
  const hash = sha256(
    canonicalJson({
      libraryId: library.libraryId,
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
      kind,
    }),
  )
    .slice(0, 20)
    .toUpperCase();
  return `${prefix}-RES-${hash}`;
}

export function proposalCanonicalReasoning(
  proposal: ArgumentProposal,
): string | undefined {
  const paragraphs = [
    proposal.reasoning,
    ...proposal.reasoningSteps.map((step) => {
      const uses = step.uses
        .map((reference) =>
          reference.kind === 'premise' ? reference.premiseId : reference.stepId,
        )
        .join(', ');
      return `${step.id}${uses === '' ? '' : ` (uses ${uses})`}: ${step.text}`;
    }),
  ].filter((value): value is string => value !== undefined);
  return paragraphs.length === 0 ? undefined : paragraphs.join('\n\n');
}

export function proposalToCanonicalArgumentInput(
  proposal: ArgumentProposal,
  options: {
    readonly id: string;
    readonly exampleIds?: readonly string[];
    readonly premises?: CreateArgumentInput['premises'];
    readonly relations?: CreateArgumentInput['relations'];
    readonly contextIds?: CreateArgumentInput['contextIds'];
    readonly retrieval?: CreateArgumentInput['retrieval'];
    readonly sourceReferences?: CreateArgumentInput['sourceReferences'];
    readonly supersedesArgumentId?: string;
  },
): CreateArgumentInput & { readonly id: string } {
  const exampleIds =
    options.exampleIds ??
    proposal.examples.map((_, index) => `${options.id}-EX-${index + 1}`);
  if (exampleIds.length !== proposal.examples.length)
    throw new Error('Canonical example IDs must match Proposal examples.');
  const reasoning = proposalCanonicalReasoning(proposal);
  return {
    id: requiredId(options.id, 'Canonical Argument ID'),
    title: proposal.title,
    examples: proposal.examples.map((text, index) => ({
      id: requiredId(exampleIds[index]!, `Example ${index + 1} ID`),
      text,
    })),
    premises: clonePlainData(options.premises ?? proposal.premises),
    ...(reasoning === undefined ? {} : { reasoning }),
    conclusion: proposal.conclusion,
    ...(proposal.boundary === undefined ? {} : { boundary: proposal.boundary }),
    relations: clonePlainData(options.relations ?? []),
    contextIds: clonePlainData(options.contextIds ?? []),
    ...(options.retrieval === undefined
      ? {}
      : { retrieval: clonePlainData(options.retrieval) }),
    sourceReferences: clonePlainData(options.sourceReferences ?? []),
    ...(options.supersedesArgumentId === undefined
      ? {}
      : { supersedesArgumentId: options.supersedesArgumentId }),
    reviewState: 'accepted',
  };
}

export function proposalToCanonicalCounterArgumentInput(
  proposal: ArgumentProposal,
  options: {
    readonly id: string;
    readonly target?: CreateCounterArgumentInput['target'];
    readonly response?: CreateCounterArgumentInput['response'];
    readonly retrieval?: CreateCounterArgumentInput['retrieval'];
    readonly sourceReferences?: CreateCounterArgumentInput['sourceReferences'];
  },
): CreateCounterArgumentInput & { readonly id: string } {
  const observation =
    proposal.examples.length === 0
      ? (proposal.reasoning ?? proposal.conclusion)
      : proposal.examples.join('\n\n');
  return {
    id: requiredId(options.id, 'Canonical Counter-Argument ID'),
    title: proposal.title,
    observation,
    challengedClaim: proposal.conclusion,
    ...(options.target === undefined
      ? {}
      : { target: clonePlainData(options.target) }),
    ...(options.retrieval === undefined
      ? {}
      : { retrieval: clonePlainData(options.retrieval) }),
    sourceReferences: clonePlainData(options.sourceReferences ?? []),
    response: clonePlainData(options.response ?? { outcome: 'unanswered' }),
    reviewState: 'accepted',
  };
}

function proposalById(
  library: ArgumentLibrary,
  proposalId: string,
): ArgumentProposal {
  const proposal = library.proposals.find(({ id }) => id === proposalId);
  if (proposal === undefined)
    throw new Error(`Proposal "${proposalId}" does not exist.`);
  return proposal;
}

function validateSelectedProposal(
  library: ArgumentLibrary,
  spec: CanonicalResolutionProposalSpec,
): ArgumentProposal {
  const proposal = proposalById(library, spec.proposalId);
  if (proposal.status !== 'pending')
    throw new Error(`Proposal "${proposal.id}" is not active To store work.`);
  if (proposal.revision !== spec.expectedRevision) {
    throw new Error(
      `Proposal "${proposal.id}" revision is stale: expected ${spec.expectedRevision}, current ${proposal.revision}.`,
    );
  }
  return proposal;
}

function resolveArgumentReference(
  library: ArgumentLibrary,
  selected: ReadonlyMap<string, CanonicalResolutionProposalSpec>,
  canonicalIds: ReadonlyMap<string, string>,
  reference: CanonicalResolutionArgumentReference,
): { readonly id: string; readonly revision: number } {
  if (reference.kind === 'proposal') {
    const target = selected.get(reference.proposalId);
    if (target === undefined || target.kind !== 'argument') {
      throw new Error(
        `Package reference Proposal "${reference.proposalId}" must be selected as an Argument.`,
      );
    }
    return { id: canonicalIds.get(reference.proposalId)!, revision: 1 };
  }
  const target = library.arguments.find(
    ({ id }) => id === reference.argumentId,
  );
  if (target === undefined)
    throw new Error(`Argument "${reference.argumentId}" does not exist.`);
  if (target.revision !== reference.expectedRevision) {
    throw new Error(
      `Argument "${target.id}" revision is stale: expected ${reference.expectedRevision}, current ${target.revision}.`,
    );
  }
  return { id: target.id, revision: target.revision };
}

function resolveCounterTarget(
  library: ArgumentLibrary,
  selected: ReadonlyMap<string, CanonicalResolutionProposalSpec>,
  canonicalIds: ReadonlyMap<string, string>,
  target: CanonicalResolutionCounterTargetSpec | undefined,
): CreateCounterArgumentInput['target'] | undefined {
  if (target === undefined) return undefined;
  if (target.kind === 'argument') {
    const resolved = resolveArgumentReference(
      library,
      selected,
      canonicalIds,
      target.argument,
    );
    return { kind: 'argument', argumentId: resolved.id, part: target.part };
  }
  const collection =
    target.kind === 'topic-claim'
      ? library.topics
      : target.kind === 'axiom'
        ? library.axioms
        : library.counterArguments;
  const id =
    target.kind === 'topic-claim'
      ? target.topicId
      : target.kind === 'axiom'
        ? target.axiomId
        : target.counterArgumentId;
  const record = collection.find((candidate) => candidate.id === id);
  if (record === undefined)
    throw new Error(`${target.kind} target "${id}" does not exist.`);
  if (record.revision !== target.expectedRevision)
    throw new Error(`${target.kind} target "${id}" revision is stale.`);
  return target.kind === 'topic-claim'
    ? { kind: 'topic-claim', topicId: id }
    : target.kind === 'axiom'
      ? { kind: 'axiom', axiomId: id }
      : { kind: 'counter-argument', counterArgumentId: id };
}

function applyPremiseBindings(
  library: ArgumentLibrary,
  proposal: ArgumentProposal,
  spec: CanonicalResolutionArgumentSpec,
  selected: ReadonlyMap<string, CanonicalResolutionProposalSpec>,
  canonicalIds: ReadonlyMap<string, string>,
): CreateArgumentInput['premises'] {
  const bindings = new Map(
    (spec.premiseBindings ?? []).map((binding) => [binding.premiseId, binding]),
  );
  if (bindings.size !== (spec.premiseBindings ?? []).length)
    throw new Error(
      `Proposal "${proposal.id}" premise bindings are duplicated.`,
    );
  for (const premiseId of bindings.keys()) {
    if (!proposal.premises.some(({ id }) => id === premiseId))
      throw new Error(
        `Proposal "${proposal.id}" premise "${premiseId}" does not exist.`,
      );
  }
  return proposal.premises.map((premise) => {
    const binding = bindings.get(premise.id);
    if (binding === undefined) return clonePlainData(premise);
    const targetSpec = selected.get(binding.targetProposalId);
    if (targetSpec === undefined || targetSpec.kind !== 'argument') {
      throw new Error(
        `Premise binding target Proposal "${binding.targetProposalId}" must be selected as an Argument.`,
      );
    }
    const targetProposal = proposalById(library, binding.targetProposalId);
    const provenance =
      premise.exampleIds === undefined
        ? {}
        : { exampleIds: clonePlainData(premise.exampleIds) };
    if (binding.targetPart.kind === 'conclusion') {
      return {
        id: premise.id,
        kind: 'argument-conclusion' as const,
        argumentId: canonicalIds.get(binding.targetProposalId)!,
        reliedOnRevision: 1,
        ...provenance,
      };
    }
    const targetPart = binding.targetPart;
    if (
      !targetProposal.premises.some(({ id }) => id === targetPart.premiseId)
    ) {
      throw new Error(
        `Premise binding target "${binding.targetProposalId}.${targetPart.premiseId}" does not exist.`,
      );
    }
    return {
      id: premise.id,
      kind: 'argument-premise' as const,
      argumentId: canonicalIds.get(binding.targetProposalId)!,
      premiseId: targetPart.premiseId,
      reliedOnRevision: 1,
      ...provenance,
    };
  });
}

function planCore(
  plan: CanonicalResolutionPlan,
): Omit<CanonicalResolutionPlan, 'resolutionId' | 'planFingerprint'> {
  return {
    format: plan.format,
    base: plan.base,
    proposals: plan.proposals,
    document: plan.document,
    currentPromotions: plan.currentPromotions,
    draftRelationDispositions: plan.draftRelationDispositions,
    preview: plan.preview,
  };
}

export function canonicalResolutionPlanFingerprint(
  plan: Omit<CanonicalResolutionPlan, 'resolutionId' | 'planFingerprint'>,
): ContentFingerprint {
  return contentFingerprint(plan);
}

function withCurrentPromotions(
  candidate: ArgumentLibrary,
  promotions: CanonicalResolutionPlan['currentPromotions'],
): ArgumentLibrary {
  if (promotions.length === 0) return candidate;
  const promotedTopics = new Set<string>();
  const topics = candidate.topics.map((topic) => {
    const promotion = promotions.find(({ topicId }) => topicId === topic.id);
    if (promotion === undefined) return topic;
    if (promotedTopics.has(topic.id))
      throw new Error(`Topic "${topic.id}" has multiple Current promotions.`);
    promotedTopics.add(topic.id);
    if (!topic.argumentIds.includes(promotion.argumentId)) {
      throw new Error(
        `Argument "${promotion.argumentId}" must belong to Topic "${topic.id}" before promotion.`,
      );
    }
    const argument = candidate.arguments.find(
      ({ id }) => id === promotion.argumentId,
    );
    if (
      argument === undefined ||
      argument.archived ||
      argument.reviewState !== 'accepted'
    ) {
      throw new Error('Only a non-archived accepted Argument can be Current.');
    }
    return { ...topic, currentArgumentId: promotion.argumentId };
  });
  for (const promotion of promotions) {
    if (!promotedTopics.has(promotion.topicId))
      throw new Error(`Topic "${promotion.topicId}" does not exist.`);
  }
  return assertValidArgumentLibrary(clonePlainData({ ...candidate, topics }));
}

function receiptForPlan(
  plan: CanonicalResolutionPlan,
): ArgumentProposalResolutionReceipt {
  return {
    id: plan.resolutionId,
    planFingerprint: plan.planFingerprint,
    proposalRevisions: plan.proposals.map(
      ({ proposalId, proposalRevision }) => ({
        proposalId,
        revision: proposalRevision,
      }),
    ),
    resultingRecords: plan.proposals.map(
      ({ resultingRecord }) => resultingRecord,
    ),
  };
}

function markProposalsStored(
  candidate: ArgumentLibrary,
  plan: CanonicalResolutionPlan,
): ArgumentLibrary {
  const receipt = receiptForPlan(plan);
  const outcomes = new Map(
    plan.proposals.map((entry) => [entry.proposalId, entry]),
  );
  const proposals = candidate.proposals.map((proposal) => {
    const outcome = outcomes.get(proposal.id);
    if (outcome === undefined) return proposal;
    if (
      proposal.status !== 'pending' ||
      proposal.revision !== outcome.proposalRevision
    )
      throw new Error(`Proposal "${proposal.id}" changed before resolution.`);
    if (proposal.revisionHistory.length >= 40)
      throw new Error(
        `Proposal "${proposal.id}" reached the 40-revision history limit.`,
      );
    return {
      ...proposal,
      revision: proposal.revision + 1,
      updatedAt: candidate.updatedAt,
      status: 'stored' as const,
      revisionHistory: [
        ...proposal.revisionHistory,
        {
          revision: proposal.revision,
          replacedAt: candidate.updatedAt,
          revisionReason: `Stored as canonical ${outcome.resultingRecord.kind} by explicit resolution ${plan.resolutionId}.`,
          content: argumentProposalDraft(proposal),
        },
      ],
      decision: {
        decidedAt: candidate.updatedAt,
        ...(outcome.note === undefined ? {} : { note: outcome.note }),
        resultingRecords: [outcome.resultingRecord],
        resolutionReceipt: receipt,
      },
    };
  });
  return assertValidArgumentLibrary(
    clonePlainData({ ...candidate, proposals }),
  );
}

function buildCandidate(
  library: ArgumentLibrary,
  plan: CanonicalResolutionPlan,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const inserted = previewArgumentWorkspaceInsert(
    captureArgumentLibrarySnapshot(library),
    JSON.stringify(plan.document),
    runtime,
  );
  if (inserted.status !== 'valid') {
    throw new Error(
      `Canonical resolution candidate is invalid: ${inserted.message}`,
    );
  }
  const promoted = withCurrentPromotions(
    inserted.plan.candidate,
    plan.currentPromotions,
  );
  return markProposalsStored(promoted, plan);
}

function validateDraftDispositions(
  library: ArgumentLibrary,
  selected: ReadonlyMap<string, CanonicalResolutionProposalSpec>,
  canonicalIds: ReadonlyMap<string, string>,
  document: ArgumentWorkspaceInsertDocument,
  dispositions: readonly CanonicalResolutionDraftRelationDisposition[],
): void {
  const argumentsById = new Map(
    (document.arguments ?? []).map((entry) => [entry.id, entry]),
  );
  const countersById = new Map(
    (document.counterArguments ?? []).map((entry) => [entry.id, entry]),
  );
  for (const disposition of dispositions) {
    const source = proposalById(library, disposition.sourceProposalId);
    if (!selected.has(source.id))
      throw new Error(
        `Draft relation source Proposal "${source.id}" is not selected.`,
      );
    const relation = source.draftRelations.find(
      ({ id }) => id === disposition.relationId,
    );
    if (relation === undefined)
      throw new Error(
        `Draft relation "${disposition.relationId}" does not exist on Proposal "${source.id}".`,
      );
    const target = proposalById(library, relation.targetProposalId);
    if (target.revision !== relation.targetProposalRevision)
      throw new Error(
        `Draft relation "${relation.id}" target revision is stale.`,
      );
    if (disposition.action === 'staging-only') continue;
    const sourceSpec = selected.get(source.id)!;
    const targetSpec = selected.get(target.id);
    if (targetSpec === undefined || targetSpec.kind !== 'argument')
      throw new Error(
        `Draft relation "${relation.id}" canonical target must be a selected Argument.`,
      );
    const targetId = canonicalIds.get(target.id)!;
    const sourceId = canonicalIds.get(source.id)!;
    if (disposition.action === 'counter-target') {
      const counter = countersById.get(sourceId);
      if (
        sourceSpec.kind !== 'counter-argument' ||
        counter?.target?.kind !== 'argument' ||
        counter.target.argumentId !== targetId ||
        (relation.kind !== 'attack' && relation.kind !== 'related')
      )
        throw new Error(
          `Draft relation "${relation.id}" does not match the exact Counter-Argument target.`,
        );
    } else if (disposition.action === 'argument-relation') {
      const argument = argumentsById.get(sourceId);
      if (
        sourceSpec.kind !== 'argument' ||
        (relation.kind !== 'attack' && relation.kind !== 'support') ||
        !argument?.relations?.some(
          (candidate) =>
            candidate.kind === relation.kind &&
            candidate.targetArgumentId === targetId,
        )
      )
        throw new Error(
          `Draft relation "${relation.id}" does not match an exact canonical Argument relation.`,
        );
    } else {
      const argument = argumentsById.get(sourceId);
      if (
        sourceSpec.kind !== 'argument' ||
        relation.kind !== 'supersede' ||
        argument?.supersedesArgumentId !== targetId
      )
        throw new Error(
          `Draft relation "${relation.id}" does not match exact canonical supersession.`,
        );
    }
  }
}

export function prepareCanonicalResolution(
  library: ArgumentLibrary,
  spec: CanonicalResolutionPackageSpec,
  runtime: ArgumentRuntime,
): CanonicalResolutionPreparationResult {
  const encoded = new TextEncoder().encode(JSON.stringify(spec));
  if (encoded.byteLength > CANONICAL_RESOLUTION_MAX_BYTES)
    throw new Error(
      `Canonical resolution package exceeds the ${CANONICAL_RESOLUTION_MAX_BYTES}-byte limit.`,
    );
  if (spec.proposals.length === 0)
    throw new Error('Canonical resolution requires at least one Proposal.');
  if (spec.proposals.length > CANONICAL_RESOLUTION_MAX_PROPOSALS)
    throw new Error(
      `Canonical resolution exceeds the ${CANONICAL_RESOLUTION_MAX_PROPOSALS}-Proposal limit.`,
    );
  const selected = new Map<string, CanonicalResolutionProposalSpec>();
  const proposals = new Map<string, ArgumentProposal>();
  for (const entry of spec.proposals) {
    if (selected.has(entry.proposalId))
      throw new Error(
        `Proposal "${entry.proposalId}" is selected more than once.`,
      );
    selected.set(entry.proposalId, entry);
    proposals.set(entry.proposalId, validateSelectedProposal(library, entry));
  }
  const dispositionKeys = new Set<string>();
  for (const disposition of spec.draftRelationDispositions) {
    const key = `${disposition.sourceProposalId}\0${disposition.relationId}`;
    if (dispositionKeys.has(key))
      throw new Error(
        `Draft relation disposition "${disposition.relationId}" is duplicated.`,
      );
    dispositionKeys.add(key);
  }
  const unresolvedChoices = [...proposals.values()].flatMap((proposal) =>
    proposal.draftRelations
      .filter(
        (relation) => !dispositionKeys.has(`${proposal.id}\0${relation.id}`),
      )
      .map(
        (relation) =>
          `Choose the canonical interpretation of ${proposal.id}.${relation.id} (${relation.kind} → ${relation.targetProposalId}@${relation.targetProposalRevision}), or mark it staging-only.`,
      ),
  );
  if (unresolvedChoices.length > 0) {
    return {
      status: 'needs-decision',
      base: captureArgumentLibrarySnapshot(library).descriptor,
      unresolvedChoices,
    };
  }

  const canonicalIds = new Map<string, string>();
  for (const entry of spec.proposals) {
    const proposal = proposals.get(entry.proposalId)!;
    canonicalIds.set(
      entry.proposalId,
      entry.canonicalId === undefined
        ? generatedRecordId(library, proposal, entry.kind)
        : requiredId(entry.canonicalId, 'Canonical record ID'),
    );
  }
  if (new Set(canonicalIds.values()).size !== canonicalIds.size)
    throw new Error(
      'Canonical record IDs in one resolution package must be unique.',
    );

  const argumentsInput: NonNullable<
    ArgumentWorkspaceInsertDocument['arguments']
  >[number][] = [];
  const counterArguments: NonNullable<
    ArgumentWorkspaceInsertDocument['counterArguments']
  >[number][] = [];
  const memberships: NonNullable<
    ArgumentWorkspaceInsertDocument['memberships']
  >[number][] = [];
  const promotions: CanonicalResolutionPlan['currentPromotions'][number][] = [];
  const planProposals: CanonicalResolutionPlanProposal[] = [];
  for (const entry of spec.proposals) {
    const proposal = proposals.get(entry.proposalId)!;
    const canonicalId = canonicalIds.get(entry.proposalId)!;
    const topicIds = orderedUnique(entry.topicIds, 'Topic ID');
    if (entry.kind === 'argument') {
      const premises = applyPremiseBindings(
        library,
        proposal,
        entry,
        selected,
        canonicalIds,
      );
      const relations = (entry.relations ?? []).map((relation, index) => {
        const target = resolveArgumentReference(
          library,
          selected,
          canonicalIds,
          relation.target,
        );
        return {
          id: relation.id ?? `${canonicalId}-REL-${index + 1}`,
          kind: relation.kind,
          targetArgumentId: target.id,
          targetPart: relation.targetPart,
          reliedOnRevision: target.revision,
        };
      });
      const supersedes =
        entry.supersedes === undefined
          ? undefined
          : resolveArgumentReference(
              library,
              selected,
              canonicalIds,
              entry.supersedes,
            ).id;
      argumentsInput.push(
        proposalToCanonicalArgumentInput(proposal, {
          id: canonicalId,
          premises,
          relations,
          contextIds: entry.contextIds,
          retrieval: entry.retrieval,
          sourceReferences: entry.sourceReferences,
          ...(supersedes === undefined
            ? {}
            : { supersedesArgumentId: supersedes }),
        }),
      );
      if (entry.promoteTopicId !== undefined) {
        if (!topicIds.includes(entry.promoteTopicId))
          throw new Error(
            'Current promotion Topic must be a selected membership.',
          );
        promotions.push({
          topicId: entry.promoteTopicId,
          argumentId: canonicalId,
        });
      }
    } else {
      counterArguments.push(
        proposalToCanonicalCounterArgumentInput(proposal, {
          id: canonicalId,
          target: resolveCounterTarget(
            library,
            selected,
            canonicalIds,
            entry.target,
          ),
          response: entry.response,
          retrieval: entry.retrieval,
          sourceReferences: entry.sourceReferences,
        }),
      );
    }
    memberships.push(
      ...topicIds.map((topicId) => ({
        topicId,
        kind: entry.kind,
        recordId: canonicalId,
      })),
    );
    const note = optionalNote(entry.note);
    planProposals.push({
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
      resultingRecord: { kind: entry.kind, id: canonicalId },
      ...(note === undefined ? {} : { note }),
    });
  }
  const document: ArgumentWorkspaceInsertDocument = {
    format: ARGUMENT_WORKSPACE_INSERT_FORMAT,
    arguments: argumentsInput,
    counterArguments,
    memberships,
  };
  validateDraftDispositions(
    library,
    selected,
    canonicalIds,
    document,
    spec.draftRelationDispositions,
  );
  const inserted = previewArgumentWorkspaceInsert(
    captureArgumentLibrarySnapshot(library),
    JSON.stringify(document),
    runtime,
  );
  if (inserted.status !== 'valid')
    throw new Error(
      `Canonical resolution package is invalid: ${inserted.message}`,
    );
  const promoted = withCurrentPromotions(inserted.plan.candidate, promotions);
  void promoted;
  const warnings = [
    ...inserted.plan.preview.warnings,
    ...[...proposals.values()].flatMap((proposal) => [
      ...(proposal.softExplanationMarkdown === undefined
        ? []
        : [`Proposal ${proposal.id} Soft Explanation remains non-canonical.`]),
      ...(proposal.sourceObservations.length === 0
        ? []
        : [
            `Proposal ${proposal.id} source observations were not copied into canonical source references.`,
          ]),
    ]),
    ...spec.draftRelationDispositions
      .filter(({ action }) => action === 'staging-only')
      .map(
        ({ sourceProposalId, relationId }) =>
          `Draft relation ${sourceProposalId}.${relationId} remains staging provenance only.`,
      ),
  ];
  const preview: CanonicalResolutionPreview = {
    summary: `Store ${argumentsInput.length} Argument${argumentsInput.length === 1 ? '' : 's'} and ${counterArguments.length} Counter-Argument${counterArguments.length === 1 ? '' : 's'} from ${planProposals.length} Proposal${planProposals.length === 1 ? '' : 's'} in one atomic commit.`,
    proposals: planProposals,
    insert: inserted.plan.preview,
    currentPromotions: promotions,
    draftRelationDispositions: clonePlainData(spec.draftRelationDispositions),
    warnings,
  };
  const core = {
    format: CANONICAL_RESOLUTION_FORMAT,
    base: captureArgumentLibrarySnapshot(library).descriptor,
    proposals: planProposals,
    document,
    currentPromotions: promotions,
    draftRelationDispositions: clonePlainData(spec.draftRelationDispositions),
    preview,
  } satisfies Omit<CanonicalResolutionPlan, 'resolutionId' | 'planFingerprint'>;
  const planFingerprint = canonicalResolutionPlanFingerprint(core);
  const plan: CanonicalResolutionPlan = {
    ...core,
    resolutionId: `RES-${planFingerprint.value.slice(0, 24).toUpperCase()}`,
    planFingerprint,
  };
  return {
    status: 'ready',
    plan,
    candidate: markProposalsStored(promoted, plan),
  };
}

export function validateCanonicalResolutionPlan(
  plan: CanonicalResolutionPlan,
): void {
  const encoded = new TextEncoder().encode(JSON.stringify(plan));
  if (encoded.byteLength > CANONICAL_RESOLUTION_MAX_BYTES)
    throw new Error(
      `Canonical resolution plan exceeds the ${CANONICAL_RESOLUTION_MAX_BYTES}-byte limit.`,
    );
  if (plan.format !== CANONICAL_RESOLUTION_FORMAT)
    throw new Error('Unsupported canonical resolution plan format.');
  const expected = canonicalResolutionPlanFingerprint(planCore(plan));
  if (!sameFingerprint(expected, plan.planFingerprint))
    throw new Error(
      'Canonical resolution plan fingerprint does not match its payload.',
    );
  const expectedId = `RES-${expected.value.slice(0, 24).toUpperCase()}`;
  if (plan.resolutionId !== expectedId)
    throw new Error(
      'Canonical resolution ID does not match its plan fingerprint.',
    );
}

function appliedReceipt(
  library: ArgumentLibrary,
  plan: CanonicalResolutionPlan,
): ArgumentProposalResolutionReceipt | undefined {
  const expected = receiptForPlan(plan);
  const receipts = plan.proposals.map(
    ({ proposalId }) =>
      library.proposals.find(({ id }) => id === proposalId)?.decision
        ?.resolutionReceipt,
  );
  const matching = receipts.filter(
    (receipt) =>
      receipt?.id === plan.resolutionId &&
      sameFingerprint(receipt.planFingerprint, plan.planFingerprint),
  );
  if (matching.length === 0) return undefined;
  if (matching.length !== plan.proposals.length)
    throw new Error('Canonical resolution receipt is only partially present.');
  if (
    matching.some(
      (receipt) => canonicalJson(receipt) !== canonicalJson(expected),
    )
  )
    throw new Error(
      'Canonical resolution receipt does not match the exact plan.',
    );
  const receipt = matching[0]!;
  for (const record of receipt.resultingRecords) {
    const exists =
      record.kind === 'argument'
        ? library.arguments.some(({ id }) => id === record.id)
        : library.counterArguments.some(({ id }) => id === record.id);
    if (!exists)
      throw new Error(
        `Resolution receipt result ${record.kind} "${record.id}" is missing.`,
      );
  }
  return receipt;
}

export function applyCanonicalResolution(
  library: ArgumentLibrary,
  plan: CanonicalResolutionPlan,
  runtime: ArgumentRuntime,
): CanonicalResolutionApplyResult {
  validateCanonicalResolutionPlan(plan);
  const priorReceipt = appliedReceipt(library, plan);
  if (priorReceipt !== undefined) {
    return { library, receipt: priorReceipt, alreadyApplied: true };
  }
  const current = captureArgumentLibrarySnapshot(library).descriptor;
  if (!sameSnapshot(current, plan.base))
    throw new Error(
      'Prepared canonical resolution is stale; prepare it again.',
    );
  for (const entry of plan.proposals) {
    const proposal = proposalById(library, entry.proposalId);
    if (
      proposal.status !== 'pending' ||
      proposal.revision !== entry.proposalRevision
    )
      throw new Error(
        `Proposal "${entry.proposalId}" changed after preparation.`,
      );
  }
  const candidate = buildCandidate(library, plan, runtime);
  return {
    library: candidate,
    receipt: receiptForPlan(plan),
    alreadyApplied: false,
  };
}
