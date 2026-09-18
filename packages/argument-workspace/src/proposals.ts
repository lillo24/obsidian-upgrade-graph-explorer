import {
  clonePlainData,
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
  ArgumentProposalTarget,
  ArgumentRuntime,
  CreateArgumentProposalInput,
  ProposalConsultedRecord,
  ResolveProposalAsArgumentInput,
  ResolveProposalAsRejectedInput,
} from './types';
import { assertValidArgumentLibrary } from './validation';

export const ARGUMENT_PROPOSAL_MAX_BYTES = 128 * 1024;
export const ARGUMENT_PROPOSAL_MAX_TITLE_LENGTH = 300;
export const ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH = 20_000;
export const ARGUMENT_PROPOSAL_MAX_LIST_ITEMS = 40;
export const ARGUMENT_PROPOSAL_MAX_ID_LENGTH = 512;

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

function normalizedSubmission(input: CreateArgumentProposalInput) {
  const suggestedAxiomIds = uniqueIds(
    input.suggestedAxiomIds ?? [],
    'Suggested Axiom IDs',
  );
  return {
    title: requiredText(
      input.title,
      'Proposal title',
      ARGUMENT_PROPOSAL_MAX_TITLE_LENGTH,
    ),
    ...(input.topicId === undefined
      ? {}
      : {
          topicId: requiredText(
            input.topicId,
            'Proposal Topic ID',
            ARGUMENT_PROPOSAL_MAX_ID_LENGTH,
          ),
        }),
    ...(input.target === undefined ? {} : { target: input.target }),
    examples: boundedStrings(input.examples, 'Proposal examples'),
    premiseHints: boundedStrings(input.premiseHints, 'Proposal premise hints'),
    suggestedAxiomIds,
    ...(optionalText(
      input.reasoning,
      'Proposal reasoning',
      ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
    ) === undefined
      ? {}
      : { reasoning: input.reasoning }),
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
    whyNovelOrUnresolved: requiredText(
      input.whyNovelOrUnresolved,
      'Why novel or unresolved',
      ARGUMENT_PROPOSAL_MAX_TEXT_LENGTH,
    ),
    consultation: clonePlainData(input.consultation),
  };
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
  const normalized = normalizedSubmission(input);
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
  for (const axiomId of input.suggestedAxiomIds ?? []) {
    if (!library.axioms.some(({ id }) => id === axiomId)) {
      throw new Error(`Suggested Axiom "${axiomId}" does not exist.`);
    }
    if (consultationIdentity(input, 'axiom', axiomId) === undefined) {
      throw new Error(
        `Suggested Axiom "${axiomId}" must appear in the consultation records.`,
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
    ...(clientSubmissionId === undefined ? {} : { clientSubmissionId }),
    submissionFingerprint,
  };
  return {
    library: withProposals(library, [...library.proposals, proposal], runtime),
    proposal,
    duplicate: false,
  };
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
    | { readonly status: 'accepted'; readonly resultingArgumentId: string }
    | {
        readonly status: 'rejected';
        readonly resultingCounterArgumentId: string;
      },
  note: string | undefined,
  runtime: ArgumentRuntime,
): ArgumentLibrary {
  const decidedAt = timestamp(runtime);
  const next: ArgumentProposal = {
    ...proposal,
    revision: proposal.revision + 1,
    updatedAt: decidedAt,
    status: resolution.status,
    decision: {
      decidedAt,
      ...(note === undefined ? {} : { note }),
      ...(resolution.status === 'accepted'
        ? { resultingArgumentId: resolution.resultingArgumentId }
        : {
            resultingCounterArgumentId: resolution.resultingCounterArgumentId,
          }),
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
    { status: 'accepted', resultingArgumentId: input.argument.id },
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
    {
      status: 'rejected',
      resultingCounterArgumentId: input.counterArgument.id,
    },
    resolutionNote(input.note),
    runtime,
  );
}
