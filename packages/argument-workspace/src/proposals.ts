import {
  clonePlainData,
  canonicalJson,
  contentFingerprint,
  sameFingerprint,
} from './canonical';
import {
  createArgument,
  createCounterArgument,
  promoteArgumentToCurrent,
  setTopicMembership,
} from './library';
import type {
  ArgumentLibrary,
  ArgumentProposal,
  ArgumentProposalDraft,
  ArgumentProposalDraftRelation,
  ArgumentProposalIntent,
  ArgumentProposalPremise,
  ArgumentProposalReasoningStep,
  ArgumentProposalSourceObservation,
  ArgumentProposalTarget,
  ArgumentRuntime,
  CreateArgumentProposalInput,
  DiscardArgumentProposalInput,
  ProposalConsultedRecord,
  ReviseArgumentProposalInput,
  ResolveProposalAsArgumentInput,
  ResolveProposalAsRejectedInput,
} from './types';
import { assertValidArgumentLibrary } from './validation';

export const ARGUMENT_PROPOSAL_MAX_BYTES = 128 * 1024;
export const ARGUMENT_PROPOSAL_MAX_TITLE_LENGTH = 300;
export const ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH = 20_000;
export const ARGUMENT_PROPOSAL_MAX_LIST_ITEMS = 40;
export const ARGUMENT_PROPOSAL_MAX_ID_LENGTH = 512;
export const ARGUMENT_PROPOSAL_MAX_REVISIONS = 40;

const PROPOSAL_INTENTS = new Set<ArgumentProposalIntent>([
  'unspecified',
  'new',
  'attack',
  'support',
  'refine',
  'extend',
  'add-boundary',
  'supersede',
]);

const PROPOSAL_DRAFT_RELATION_KINDS = new Set([
  'attack',
  'support',
  'refine',
  'extend',
  'supersede',
  'related',
]);

export interface ArgumentProposalSubmissionOutcome {
  readonly library: ArgumentLibrary;
  readonly proposal: ArgumentProposal;
  readonly duplicate: boolean;
}

function requiredText(value: string, label: string, maximum: number): string {
  if (value.trim() === '') throw new Error(`${label} must not be empty.`);
  if (value.length > maximum) {
    throw new Error(`${label} exceeds the ${maximum}-character limit.`);
  }
  return value;
}

function optionalText(
  value: string | undefined,
  label: string,
  maximum: number,
): string | undefined {
  return value === undefined ? undefined : requiredText(value, label, maximum);
}

function boundedStrings(
  values: readonly string[],
  label: string,
): readonly string[] {
  if (values.length > ARGUMENT_PROPOSAL_MAX_LIST_ITEMS) {
    throw new Error(
      `${label} exceeds the ${ARGUMENT_PROPOSAL_MAX_LIST_ITEMS}-item limit.`,
    );
  }
  return values.map((value, index) =>
    requiredText(
      value,
      `${label} item ${index + 1}`,
      ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
    ),
  );
}

function uniqueIds(
  values: readonly string[],
  label: string,
): readonly string[] {
  const result = [...new Set(values)];
  if (result.length !== values.length) {
    throw new Error(`${label} must not contain duplicate IDs.`);
  }
  return result.map((value, index) =>
    requiredText(
      value,
      `${label} item ${index + 1}`,
      ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
    ),
  );
}

function proposalIntent(
  input: Pick<CreateArgumentProposalInput, 'intent' | 'target'>,
): ArgumentProposalIntent {
  const intent =
    input.intent ?? (input.target === undefined ? 'new' : 'unspecified');
  if (!PROPOSAL_INTENTS.has(intent))
    throw new Error('Proposal intent is invalid.');
  if (intent === 'new' && input.target !== undefined)
    throw new Error('An independent Proposal must not identify a target.');
  if (
    intent !== 'new' &&
    intent !== 'unspecified' &&
    input.target === undefined
  )
    throw new Error(`Proposal intent "${intent}" requires a target Argument.`);
  return intent;
}

function legacyPremises(
  input: CreateArgumentProposalInput,
): readonly ArgumentProposalPremise[] {
  if (
    input.premises !== undefined &&
    ((input.premiseHints?.length ?? 0) > 0 ||
      (input.suggestedAxiomIds?.length ?? 0) > 0)
  )
    throw new Error(
      'Use typed Proposal premises or legacy premise hints, not both.',
    );
  if (input.premises !== undefined) return clonePlainData(input.premises);
  const text = boundedStrings(
    input.premiseHints ?? [],
    'Proposal premise hints',
  ).map((value, index) => ({
    id: `legacy-text-${index + 1}`,
    kind: 'text' as const,
    text: value,
  }));
  const axiomIds = uniqueIds(
    input.suggestedAxiomIds ?? [],
    'Suggested Axiom IDs',
  );
  const axioms = axiomIds.map((axiomId, index) => {
    const consulted = input.consultation.records.find(
      (record) => record.kind === 'axiom' && record.id === axiomId,
    );
    if (consulted?.revision === undefined)
      throw new Error(
        `Suggested Axiom "${axiomId}" requires a consulted revision.`,
      );
    return {
      id: `legacy-axiom-${index + 1}`,
      kind: 'axiom' as const,
      axiomId,
      reliedOnRevision: consulted.revision,
    };
  });
  return [...text, ...axioms];
}

function normalizeProposalPremises(
  input: CreateArgumentProposalInput,
): readonly ArgumentProposalPremise[] {
  const premises = legacyPremises(input);
  if (premises.length > ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
    throw new Error(
      `Proposal premises exceed the ${ARGUMENT_PROPOSAL_MAX_LIST_ITEMS}-item limit.`,
    );
  const ids = new Set<string>();
  return premises.map((premise, index) => {
    requiredText(
      premise.id,
      `Proposal premise ${index + 1} ID`,
      ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
    );
    if (ids.has(premise.id))
      throw new Error(`Proposal premise ID "${premise.id}" is duplicated.`);
    ids.add(premise.id);
    if (premise.kind === 'text')
      requiredText(
        premise.text,
        `Proposal premise ${index + 1}`,
        ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
      );
    return clonePlainData(premise);
  });
}

function normalizeReasoningSteps(
  values: readonly ArgumentProposalReasoningStep[],
  premiseIds: ReadonlySet<string>,
): readonly ArgumentProposalReasoningStep[] {
  if (values.length > ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
    throw new Error(
      `Proposal reasoning steps exceed the ${ARGUMENT_PROPOSAL_MAX_LIST_ITEMS}-item limit.`,
    );
  const priorStepIds = new Set<string>();
  return values.map((step, index) => {
    requiredText(
      step.id,
      `Reasoning step ${index + 1} ID`,
      ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
    );
    requiredText(
      step.text,
      `Reasoning step ${index + 1}`,
      ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
    );
    if (priorStepIds.has(step.id))
      throw new Error(`Reasoning step ID "${step.id}" is duplicated.`);
    if (step.uses.length > ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
      throw new Error(`Reasoning step "${step.id}" has too many references.`);
    for (const reference of step.uses) {
      if (reference.kind === 'premise' && !premiseIds.has(reference.premiseId))
        throw new Error(
          `Reasoning step "${step.id}" references unknown premise "${reference.premiseId}".`,
        );
      if (
        reference.kind === 'reasoning-step' &&
        !priorStepIds.has(reference.stepId)
      )
        throw new Error(
          `Reasoning step "${step.id}" must reference an earlier reasoning step.`,
        );
    }
    priorStepIds.add(step.id);
    return clonePlainData(step);
  });
}

function normalizeSourceObservations(
  values: readonly ArgumentProposalSourceObservation[],
): readonly ArgumentProposalSourceObservation[] {
  if (values.length > ARGUMENT_PROPOSAL_MAX_LIST_ITEMS)
    throw new Error(
      `Proposal source observations exceed the ${ARGUMENT_PROPOSAL_MAX_LIST_ITEMS}-item limit.`,
    );
  const ids = new Set<string>();
  return values.map((observation, index) => {
    requiredText(
      observation.id,
      `Source observation ${index + 1} ID`,
      ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
    );
    requiredText(
      observation.observation,
      `Source observation ${index + 1}`,
      ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
    );
    if (ids.has(observation.id))
      throw new Error(
        `Source observation ID "${observation.id}" is duplicated.`,
      );
    ids.add(observation.id);
    for (const [label, value] of [
      ['label', observation.label],
      ['repository', observation.repository],
      ['source version', observation.sourceVersion],
      ['file path', observation.filePath],
      ['heading', observation.heading],
      ['span', observation.span],
    ] as const) {
      if (value !== undefined)
        requiredText(
          value,
          `Source observation ${label}`,
          ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
        );
    }
    if (
      observation.commitSha !== undefined &&
      !/^[a-f0-9]{7,64}$/iu.test(observation.commitSha)
    )
      throw new Error('Source observation commit SHA is invalid.');
    if (observation.url !== undefined) {
      let parsed: URL;
      try {
        parsed = new URL(observation.url);
      } catch {
        throw new Error('Source observation URL is invalid.');
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
        throw new Error('Source observation URL must use HTTP or HTTPS.');
    }
    return clonePlainData(observation);
  });
}

function normalizeDraftRelations(
  library: ArgumentLibrary,
  values: readonly ArgumentProposalDraftRelation[],
  proposalId?: string,
): readonly ArgumentProposalDraftRelation[] {
  if (values.length > ARGUMENT_PROPOSAL_MAX_LIST_ITEMS) {
    throw new Error(
      `Proposal draft relations exceed the ${ARGUMENT_PROPOSAL_MAX_LIST_ITEMS}-item limit.`,
    );
  }
  const ids = new Set<string>();
  return values.map((relation, index) => {
    requiredText(
      relation.id,
      `Draft relation ${index + 1} ID`,
      ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
    );
    if (ids.has(relation.id)) {
      throw new Error(`Draft relation ID "${relation.id}" is duplicated.`);
    }
    ids.add(relation.id);
    if (!PROPOSAL_DRAFT_RELATION_KINDS.has(relation.kind)) {
      throw new Error(`Draft relation "${relation.id}" has an invalid kind.`);
    }
    requiredText(
      relation.targetProposalId,
      `Draft relation ${index + 1} target Proposal ID`,
      ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
    );
    if (relation.targetProposalId === proposalId) {
      throw new Error('A Proposal draft relation cannot target itself.');
    }
    const target = library.proposals.find(
      ({ id }) => id === relation.targetProposalId,
    );
    if (target === undefined) {
      throw new Error(
        `Draft relation target Proposal "${relation.targetProposalId}" does not exist.`,
      );
    }
    if (target.status !== 'pending') {
      throw new Error(
        `Draft relation target Proposal "${relation.targetProposalId}" is not active To store work.`,
      );
    }
    if (target.revision !== relation.targetProposalRevision) {
      throw new Error(
        `Draft relation target Proposal "${relation.targetProposalId}" revision is stale.`,
      );
    }
    return clonePlainData(relation);
  });
}

function targetPartExists(
  library: ArgumentLibrary,
  target: ArgumentProposalTarget,
): boolean {
  const argument = library.arguments.find(({ id }) => id === target.argumentId);
  if (argument === undefined) return false;
  if (target.part.kind === 'premise') {
    const premiseId = target.part.premiseId;
    return argument.premises.some(({ id }) => id === premiseId);
  }
  return target.part.kind !== 'reasoning' || argument.reasoning !== undefined;
}

function consultedRecord(
  library: ArgumentLibrary,
  identity: ProposalConsultedRecord,
) {
  if (identity.kind === 'topic') {
    return library.topics.find(({ id }) => id === identity.id);
  }
  if (identity.kind === 'axiom') {
    return library.axioms.find(({ id }) => id === identity.id);
  }
  if (identity.kind === 'argument') {
    return library.arguments.find(({ id }) => id === identity.id);
  }
  return library.counterArguments.find(({ id }) => id === identity.id);
}

function consultationIdentity(
  input: CreateArgumentProposalInput,
  kind: ProposalConsultedRecord['kind'],
  id: string,
): ProposalConsultedRecord | undefined {
  return input.consultation.records.find(
    (identity) => identity.kind === kind && identity.id === id,
  );
}

function validateConsultation(
  library: ArgumentLibrary,
  input: CreateArgumentProposalInput,
): void {
  const consultation = input.consultation;
  if (consultation.libraryId !== library.libraryId) {
    throw new Error('Proposal consultation library ID does not match.');
  }
  if (consultation.libraryRevision !== library.libraryRevision) {
    throw new Error('Proposal consultation snapshot is stale.');
  }
  if (
    consultation.contentFingerprint !== undefined &&
    !sameFingerprint(
      consultation.contentFingerprint,
      contentFingerprint(library),
    )
  ) {
    throw new Error('Proposal consultation fingerprint does not match.');
  }
  if (consultation.records.length === 0) {
    throw new Error('Proposal consultation must identify at least one record.');
  }
  if (consultation.records.length > ARGUMENT_PROPOSAL_MAX_LIST_ITEMS) {
    throw new Error(
      `Proposal consultation exceeds the ${ARGUMENT_PROPOSAL_MAX_LIST_ITEMS}-record limit.`,
    );
  }
  const identities = new Set<string>();
  consultation.records.forEach((identity, index) => {
    requiredText(
      identity.id,
      `Consulted record ${index + 1} ID`,
      ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
    );
    const key = `${identity.kind}\0${identity.id}`;
    if (identities.has(key)) {
      throw new Error(`Consulted record "${identity.id}" is duplicated.`);
    }
    identities.add(key);
    const record = consultedRecord(library, identity);
    if (record === undefined) {
      throw new Error(
        `Consulted ${identity.kind} "${identity.id}" does not exist.`,
      );
    }
    if (
      identity.revision !== undefined &&
      identity.revision !== record.revision
    ) {
      throw new Error(
        `Consulted ${identity.kind} "${identity.id}" revision is stale.`,
      );
    }
  });
}

function nextProposalId(
  library: ArgumentLibrary,
  runtime: ArgumentRuntime,
): string {
  const id = requiredText(
    runtime.createId('proposal'),
    'Proposal ID',
    ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
  );
  const exists = [
    ...library.topics,
    ...library.contexts,
    ...library.axioms,
    ...library.arguments,
    ...library.counterArguments,
    ...library.proposals,
  ].some((record) => record.id === id);
  if (exists) throw new Error(`Proposal ID "${id}" already exists.`);
  return id;
}

function timestamp(runtime: ArgumentRuntime): string {
  const value = runtime.now();
  if (value.trim() === '' || !Number.isFinite(Date.parse(value))) {
    throw new Error('Argument Workspace clock returned an invalid timestamp.');
  }
  return value;
}

function withProposals(
  library: ArgumentLibrary,
  proposals: readonly ArgumentProposal[],
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  return assertValidArgumentLibrary(
    clonePlainData({
      ...library,
      libraryRevision: library.libraryRevision + 1,
      updatedAt: timestamp(runtime),
      proposals: [...proposals].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    }),
  );
}

function normalizedSubmission(
  library: ArgumentLibrary,
  input: CreateArgumentProposalInput | ReviseArgumentProposalInput,
  proposalId?: string,
): ArgumentProposalDraft {
  const premises =
    'proposalId' in input
      ? normalizeProposalPremises({ ...input, premises: input.premises })
      : normalizeProposalPremises(input);
  const premiseIds = new Set(premises.map(({ id }) => id));
  return {
    title: requiredText(
      input.title,
      'Proposal title',
      ARGUMENT_PROPOSAL_MAX_TITLE_LENGTH,
    ),
    ...(optionalText(
      input.softExplanationMarkdown,
      'Proposal Soft Explanation',
      ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
    ) === undefined
      ? {}
      : { softExplanationMarkdown: input.softExplanationMarkdown }),
    ...(input.topicId === undefined
      ? {}
      : {
          topicId: requiredText(
            input.topicId,
            'Proposal Topic ID',
            ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
          ),
        }),
    intent: proposalIntent(input),
    ...(input.target === undefined
      ? {}
      : { target: clonePlainData(input.target) }),
    examples: boundedStrings(input.examples, 'Proposal examples'),
    premises,
    ...(optionalText(
      input.reasoning,
      'Proposal reasoning',
      ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
    ) === undefined
      ? {}
      : { reasoning: input.reasoning }),
    reasoningSteps: normalizeReasoningSteps(
      input.reasoningSteps ?? [],
      premiseIds,
    ),
    conclusion: requiredText(
      input.conclusion,
      'Proposal conclusion',
      ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
    ),
    ...(optionalText(
      input.boundary,
      'Proposal Boundary / Invariance',
      ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
    ) === undefined
      ? {}
      : { boundary: input.boundary }),
    sourceObservations: normalizeSourceObservations(
      input.sourceObservations ?? [],
    ),
    whyNovelOrUnresolved: requiredText(
      input.whyNovelOrUnresolved,
      'Why novel or unresolved',
      ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
    ),
    consultation: clonePlainData(input.consultation),
    draftRelations: normalizeDraftRelations(
      library,
      input.draftRelations ?? [],
      proposalId,
    ),
  };
}

function validatePremiseConsultation(
  library: ArgumentLibrary,
  input: CreateArgumentProposalInput,
  premises: readonly ArgumentProposalPremise[],
): void {
  for (const premise of premises) {
    if (premise.kind === 'text') continue;
    if (premise.kind === 'axiom') {
      const axiom = library.axioms.find(({ id }) => id === premise.axiomId);
      if (axiom === undefined)
        throw new Error(
          `Proposal premise Axiom "${premise.axiomId}" does not exist.`,
        );
      if (axiom.revision !== premise.reliedOnRevision)
        throw new Error(
          `Proposal premise Axiom "${premise.axiomId}" revision is stale.`,
        );
      const consulted = consultationIdentity(input, 'axiom', premise.axiomId);
      if (consulted?.revision !== premise.reliedOnRevision)
        throw new Error(
          `Proposal premise Axiom "${premise.axiomId}" must be revision-pinned in consultation records.`,
        );
      continue;
    }
    const argument = library.arguments.find(
      ({ id }) => id === premise.argumentId,
    );
    if (argument === undefined)
      throw new Error(
        `Proposal premise Argument "${premise.argumentId}" does not exist.`,
      );
    if (argument.revision !== premise.reliedOnRevision)
      throw new Error(
        `Proposal premise Argument "${premise.argumentId}" revision is stale.`,
      );
    if (
      premise.kind === 'argument-premise' &&
      !argument.premises.some(({ id }) => id === premise.premiseId)
    )
      throw new Error(
        `Proposal referenced premise "${premise.premiseId}" does not exist.`,
      );
    const consulted = consultationIdentity(
      input,
      'argument',
      premise.argumentId,
    );
    if (consulted?.revision !== premise.reliedOnRevision)
      throw new Error(
        `Proposal premise Argument "${premise.argumentId}" must be revision-pinned in consultation records.`,
      );
  }
}

/** Append-only, non-canonical submission with exact-payload idempotency. */
export function submitArgumentProposal(
  library: ArgumentLibrary,
  input: CreateArgumentProposalInput,
  runtime: ArgumentRuntime,
): ArgumentProposalSubmissionOutcome {
  const encoded = new TextEncoder().encode(JSON.stringify(input));
  if (encoded.byteLength > ARGUMENT_PROPOSAL_MAX_BYTES) {
    throw new Error(
      `Proposal submission exceeds the ${ARGUMENT_PROPOSAL_MAX_BYTES}-byte limit.`,
    );
  }
  const normalized = normalizedSubmission(library, input);
  const clientSubmissionId = optionalText(
    input.clientSubmissionId,
    'Client submission ID',
    ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
  );
  const submissionFingerprint = contentFingerprint({
    ...normalized,
    ...(clientSubmissionId === undefined ? {} : { clientSubmissionId }),
  });
  const duplicate = library.proposals.find(({ submissionFingerprint: value }) =>
    sameFingerprint(value, submissionFingerprint),
  );
  if (duplicate !== undefined) {
    return { library, proposal: duplicate, duplicate: true };
  }
  if (clientSubmissionId !== undefined) {
    const collision = library.proposals.find(
      (proposal) => proposal.clientSubmissionId === clientSubmissionId,
    );
    if (collision !== undefined) {
      throw new Error(
        `Client submission ID "${clientSubmissionId}" was already used for different content.`,
      );
    }
  }
  validateConsultation(library, input);
  validatePremiseConsultation(library, input, normalized.premises);
  if (
    input.topicId !== undefined &&
    !library.topics.some(({ id }) => id === input.topicId)
  ) {
    throw new Error(`Proposal Topic "${input.topicId}" does not exist.`);
  }
  if (
    input.topicId !== undefined &&
    consultationIdentity(input, 'topic', input.topicId) === undefined
  ) {
    throw new Error('Proposal Topic must appear in the consultation records.');
  }
  if (input.target !== undefined) {
    const target = library.arguments.find(
      ({ id }) => id === input.target?.argumentId,
    );
    if (target === undefined) {
      throw new Error(
        `Proposal target Argument "${input.target.argumentId}" does not exist.`,
      );
    }
    if (target.revision !== input.target.reliedOnRevision) {
      throw new Error('Proposal target Argument revision is stale.');
    }
    if (!targetPartExists(library, input.target)) {
      throw new Error('Proposal target part does not exist.');
    }
    const consultedTarget = consultationIdentity(
      input,
      'argument',
      input.target.argumentId,
    );
    if (
      consultedTarget === undefined ||
      consultedTarget.revision !== input.target.reliedOnRevision
    ) {
      throw new Error(
        'Proposal target and revision must appear in the consultation records.',
      );
    }
  }
  const now = timestamp(runtime);
  const proposal: ArgumentProposal = {
    id: nextProposalId(library, runtime),
    revision: 1,
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    ...normalized,
    revisionHistory: [],
    ...(clientSubmissionId === undefined ? {} : { clientSubmissionId }),
    submissionFingerprint,
  };
  return {
    library: withProposals(library, [...library.proposals, proposal], runtime),
    proposal,
    duplicate: false,
  };
}

export function argumentProposalDraft(
  proposal: ArgumentProposal,
): ArgumentProposalDraft {
  return clonePlainData({
    title: proposal.title,
    ...(proposal.softExplanationMarkdown === undefined
      ? {}
      : { softExplanationMarkdown: proposal.softExplanationMarkdown }),
    intent: proposal.intent,
    ...(proposal.topicId === undefined ? {} : { topicId: proposal.topicId }),
    ...(proposal.target === undefined ? {} : { target: proposal.target }),
    examples: proposal.examples,
    premises: proposal.premises,
    ...(proposal.reasoning === undefined
      ? {}
      : { reasoning: proposal.reasoning }),
    reasoningSteps: proposal.reasoningSteps,
    conclusion: proposal.conclusion,
    ...(proposal.boundary === undefined ? {} : { boundary: proposal.boundary }),
    sourceObservations: proposal.sourceObservations,
    whyNovelOrUnresolved: proposal.whyNovelOrUnresolved,
    consultation: proposal.consultation,
    draftRelations: proposal.draftRelations,
  });
}

function validateProposalContentReferences(
  library: ArgumentLibrary,
  input: CreateArgumentProposalInput | ReviseArgumentProposalInput,
  premises: readonly ArgumentProposalPremise[],
): void {
  validateConsultation(library, input);
  validatePremiseConsultation(library, input, premises);
  if (
    input.topicId !== undefined &&
    !library.topics.some(({ id }) => id === input.topicId)
  ) {
    throw new Error(`Proposal Topic "${input.topicId}" does not exist.`);
  }
  if (
    input.topicId !== undefined &&
    consultationIdentity(input, 'topic', input.topicId) === undefined
  ) {
    throw new Error('Proposal Topic must appear in the consultation records.');
  }
  if (input.target === undefined) return;
  const target = library.arguments.find(
    ({ id }) => id === input.target?.argumentId,
  );
  if (target === undefined) {
    throw new Error(
      `Proposal target Argument "${input.target.argumentId}" does not exist.`,
    );
  }
  if (target.revision !== input.target.reliedOnRevision) {
    throw new Error('Proposal target Argument revision is stale.');
  }
  if (!targetPartExists(library, input.target)) {
    throw new Error('Proposal target part does not exist.');
  }
  const consultedTarget = consultationIdentity(
    input,
    'argument',
    input.target.argumentId,
  );
  if (
    consultedTarget === undefined ||
    consultedTarget.revision !== input.target.reliedOnRevision
  ) {
    throw new Error(
      'Proposal target and revision must appear in the consultation records.',
    );
  }
}

/** Replaces the active draft while retaining a bounded, recoverable snapshot. */
export function reviseArgumentProposal(
  library: ArgumentLibrary,
  input: ReviseArgumentProposalInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const encoded = new TextEncoder().encode(JSON.stringify(input));
  if (encoded.byteLength > ARGUMENT_PROPOSAL_MAX_BYTES) {
    throw new Error(
      `Proposal revision exceeds the ${ARGUMENT_PROPOSAL_MAX_BYTES}-byte limit.`,
    );
  }
  const proposal = pendingProposal(library, input.proposalId);
  if (proposal.revision !== input.expectedRevision) {
    throw new Error(
      `Proposal "${proposal.id}" revision is stale: expected ${input.expectedRevision}, current ${proposal.revision}.`,
    );
  }
  if (proposal.revisionHistory.length >= ARGUMENT_PROPOSAL_MAX_REVISIONS) {
    throw new Error(
      `Proposal "${proposal.id}" reached the ${ARGUMENT_PROPOSAL_MAX_REVISIONS}-revision history limit.`,
    );
  }
  const revisionReason = requiredText(
    input.revisionReason,
    'Proposal revision reason',
    10_000,
  );
  const normalized = normalizedSubmission(library, input, proposal.id);
  validateProposalContentReferences(library, input, normalized.premises);
  const previousContent = argumentProposalDraft(proposal);
  if (canonicalJson(previousContent) === canonicalJson(normalized)) {
    throw new Error('Proposal revision must change the active draft content.');
  }
  const replacedAt = timestamp(runtime);
  const next: ArgumentProposal = {
    id: proposal.id,
    revision: proposal.revision + 1,
    createdAt: proposal.createdAt,
    updatedAt: replacedAt,
    status: 'pending',
    ...normalized,
    revisionHistory: [
      ...proposal.revisionHistory,
      {
        revision: proposal.revision,
        replacedAt,
        revisionReason,
        content: previousContent,
      },
    ],
    ...(proposal.clientSubmissionId === undefined
      ? {}
      : { clientSubmissionId: proposal.clientSubmissionId }),
    submissionFingerprint: proposal.submissionFingerprint,
  };
  return withProposals(
    library,
    library.proposals.map((candidate) =>
      candidate.id === proposal.id ? next : candidate,
    ),
    runtime,
  );
}

/** Removes a Proposal from active staging without creating canonical records. */
export function discardArgumentProposal(
  library: ArgumentLibrary,
  input: DiscardArgumentProposalInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const proposal = pendingProposal(library, input.proposalId);
  if (proposal.revision !== input.expectedRevision) {
    throw new Error(
      `Proposal "${proposal.id}" revision is stale: expected ${input.expectedRevision}, current ${proposal.revision}.`,
    );
  }
  if (proposal.revisionHistory.length >= ARGUMENT_PROPOSAL_MAX_REVISIONS) {
    throw new Error(
      `Proposal "${proposal.id}" reached the ${ARGUMENT_PROPOSAL_MAX_REVISIONS}-revision history limit.`,
    );
  }
  const decidedAt = timestamp(runtime);
  const note = resolutionNote(input.note);
  const next: ArgumentProposal = {
    ...proposal,
    revision: proposal.revision + 1,
    updatedAt: decidedAt,
    status: 'discarded',
    revisionHistory: [
      ...proposal.revisionHistory,
      {
        revision: proposal.revision,
        replacedAt: decidedAt,
        revisionReason:
          note ?? 'Discarded from active To store staging by the user.',
        content: argumentProposalDraft(proposal),
      },
    ],
    decision: {
      decidedAt,
      ...(note === undefined ? {} : { note }),
      resultingRecords: [],
    },
  };
  return withProposals(
    library,
    library.proposals.map((candidate) =>
      candidate.id === proposal.id ? next : candidate,
    ),
    runtime,
  );
}

function pendingProposal(
  library: ArgumentLibrary,
  proposalId: string,
): ArgumentProposal {
  const proposal = library.proposals.find(({ id }) => id === proposalId);
  if (proposal === undefined) {
    throw new Error(`Proposal "${proposalId}" does not exist.`);
  }
  if (proposal.status !== 'pending') {
    throw new Error(`Proposal "${proposalId}" has already been resolved.`);
  }
  return proposal;
}

function resolutionNote(note: string | undefined): string | undefined {
  return optionalText(note, 'Proposal decision note', 10_000);
}

function resolveProposal(
  library: ArgumentLibrary,
  proposal: ArgumentProposal,
  resolution:
    | { readonly kind: 'argument'; readonly id: string }
    | { readonly kind: 'counter-argument'; readonly id: string },
  note: string | undefined,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  if (proposal.revisionHistory.length >= ARGUMENT_PROPOSAL_MAX_REVISIONS) {
    throw new Error(
      `Proposal "${proposal.id}" reached the ${ARGUMENT_PROPOSAL_MAX_REVISIONS}-revision history limit.`,
    );
  }
  const decidedAt = timestamp(runtime);
  const next: ArgumentProposal = {
    ...proposal,
    revision: proposal.revision + 1,
    updatedAt: decidedAt,
    status: 'stored',
    revisionHistory: [
      ...proposal.revisionHistory,
      {
        revision: proposal.revision,
        replacedAt: decidedAt,
        revisionReason:
          resolution.kind === 'argument'
            ? 'Stored as a canonical Argument by human resolution.'
            : 'Stored as a canonical Counter-Argument by human resolution.',
        content: argumentProposalDraft(proposal),
      },
    ],
    decision: {
      decidedAt,
      ...(note === undefined ? {} : { note }),
      resultingRecords: [resolution],
    },
  };
  return withProposals(
    library,
    library.proposals.map((candidate) =>
      candidate.id === proposal.id ? next : candidate,
    ),
    runtime,
  );
}

function requireTopicIds(
  library: ArgumentLibrary,
  topicIds: readonly string[],
): readonly string[] {
  const unique = uniqueIds(topicIds, 'Resolution Topic IDs');
  if (unique.length === 0) {
    throw new Error('Proposal resolution requires at least one Topic.');
  }
  for (const topicId of unique) {
    if (!library.topics.some(({ id }) => id === topicId)) {
      throw new Error(`Resolution Topic "${topicId}" does not exist.`);
    }
  }
  return unique;
}

/** One in-memory candidate for canonical Argument creation plus Mailbox resolution. */
export function resolveProposalAsArgument(
  library: ArgumentLibrary,
  input: ResolveProposalAsArgumentInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const proposal = pendingProposal(library, input.proposalId);
  const topicIds = requireTopicIds(library, input.topicIds);
  if (
    input.promoteTopicId !== undefined &&
    !topicIds.includes(input.promoteTopicId)
  ) {
    throw new Error('Current promotion Topic must be a selected membership.');
  }
  let next = createArgument(
    library,
    { ...input.argument, reviewState: 'accepted' },
    runtime,
  );
  for (const topicId of topicIds) {
    next = setTopicMembership(
      next,
      topicId,
      'argument',
      input.argument.id,
      true,
      runtime,
    );
  }
  if (input.promoteTopicId !== undefined) {
    next = promoteArgumentToCurrent(
      next,
      input.promoteTopicId,
      input.argument.id,
      runtime,
    );
  }
  return resolveProposal(
    next,
    proposal,
    { kind: 'argument', id: input.argument.id },
    resolutionNote(input.note),
    runtime,
  );
}

/** One in-memory candidate for canonical Audit creation plus Mailbox resolution. */
export function resolveProposalAsRejected(
  library: ArgumentLibrary,
  input: ResolveProposalAsRejectedInput,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const proposal = pendingProposal(library, input.proposalId);
  const topicIds = requireTopicIds(library, input.topicIds);
  const response = input.counterArgument.response;
  if (response?.explanation?.trim() === '') {
    throw new Error('Rejected proposal requires a response explanation.');
  }
  if (response?.explanation === undefined) {
    throw new Error('Rejected proposal requires a response explanation.');
  }
  if (response.outcome === undefined || response.outcome === 'unanswered') {
    throw new Error('Rejected proposal requires a resolved response outcome.');
  }
  let next = createCounterArgument(
    library,
    { ...input.counterArgument, reviewState: 'accepted' },
    runtime,
  );
  for (const topicId of topicIds) {
    next = setTopicMembership(
      next,
      topicId,
      'counter-argument',
      input.counterArgument.id,
      true,
      runtime,
    );
  }
  return resolveProposal(
    next,
    proposal,
    { kind: 'counter-argument', id: input.counterArgument.id },
    resolutionNote(input.note),
    runtime,
  );
}
