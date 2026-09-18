import type {
  ArgumentBundle,
  ArgumentDependencyPathStep,
  ArgumentPremiseStaleness,
  ArgumentPremiseStalenessCause,
  CounterArgumentTarget,
  ReadArgumentBundleResult,
} from '@icarus-graph-explorer/argument-workspace';
import { formatTheorySourceLocator } from '@icarus-graph-explorer/argument-workspace';

export interface ArgumentContextExport {
  readonly label: string;
  readonly text: string;
  readonly structured: string;
  readonly bundle: ArgumentBundle;
}

function prose(label: string, value: string | undefined): readonly string[] {
  return value === undefined || value === ''
    ? []
    : ['', `### ${label}`, '', value];
}

function target(value: CounterArgumentTarget | undefined): string {
  if (value === undefined) return 'No structured target recorded.';
  if (value.kind === 'topic-claim') return `Topic claim: ${value.topicId}`;
  if (value.kind === 'axiom') return `Axiom: ${value.axiomId}`;
  if (value.kind === 'counter-argument')
    return `Counter-Argument: ${value.counterArgumentId}`;
  return `Argument: ${value.argumentId} (${value.part.kind}${
    value.part.kind === 'premise' ? ` ${value.part.premiseId}` : ''
  })`;
}

function dependencyStep(step: ArgumentDependencyPathStep): string {
  const owner = `${step.argumentId}.${step.premiseId}`;
  if (step.kind === 'axiom') return `${owner} -> ${step.axiomId}`;
  if (step.kind === 'argument-conclusion') {
    return `${owner} -> ${step.sourceArgumentId}.conclusion`;
  }
  return `${owner} -> ${step.sourceArgumentId}.${step.sourcePremiseId}`;
}

function stalenessCause(cause: ArgumentPremiseStalenessCause): string {
  const root = cause.root;
  const rootLabel =
    root.kind === 'revision-mismatch'
      ? `${root.recordKind} ${root.recordId} revision ${root.reliedOnRevision} -> ${root.currentRevision}`
      : root.kind === 'missing-reference'
        ? `missing ${root.recordKind} ${root.recordId}`
        : `dependency cycle at ${root.argumentId}.${root.premiseId}`;
  return `${cause.kind} [${cause.path.map(dependencyStep).join('; ')}] root: ${rootLabel}`;
}

function premiseStaleness(
  results: readonly ArgumentPremiseStaleness[],
): readonly string[] {
  const stale = results.filter((result) => result.stale);
  return stale.length === 0
    ? ['Premise staleness diagnostics: none']
    : [
        'Premise staleness diagnostics:',
        ...stale.map(
          (result) =>
            `- ${result.premiseId}: direct=${result.direct ? 'yes' : 'no'}; inherited=${result.inherited ? 'yes' : 'no'}; ${result.causes.map(stalenessCause).join('; ')}`,
        ),
      ];
}

export function formatArgumentBundle(
  bundle: ArgumentBundle,
): ArgumentContextExport {
  const sections: string[] = [
    '# Argument-library context',
    '',
    'Linked theory source text not read.',
    '',
    `Snapshot: ${bundle.snapshot.libraryId} / revision ${bundle.snapshot.libraryRevision}`,
    `Fingerprint: ${bundle.snapshot.contentFingerprint.value}`,
  ];
  for (const topic of bundle.topics) {
    sections.push(
      '',
      `## Topic — ${topic.title} (${topic.id})`,
      '',
      topic.summary,
      '',
      `Human review state: ${topic.reviewState}`,
      `Archived: ${topic.archived ? 'yes' : 'no'}`,
      `Axiom memberships: ${topic.axiomIds.join(', ') || 'none'}`,
      `Argument memberships: ${topic.argumentIds.join(', ') || 'none'}`,
      `Current Argument: ${topic.currentArgumentId ?? 'none'}`,
      `Counter-Argument memberships: ${topic.counterArgumentIds.join(', ') || 'none'}`,
    );
  }
  for (const context of bundle.contexts) {
    sections.push(
      '',
      `## Context — ${context.title} (${context.id})`,
      '',
      context.description ?? 'No description.',
      '',
      'This is background context, not an inference premise.',
      `Parent chain: ${context.parentContextIds.join(' -> ') || 'none'}`,
      `Direct Axioms: ${context.axiomIds.join(', ') || 'none'}`,
      `Inherited Axioms: ${context.inheritedAxiomIds.join(', ') || 'none'}`,
      `Effective Axioms: ${context.effectiveAxiomIds.join(', ') || 'none'}`,
      `Human review state: ${context.reviewState}`,
      `Archived: ${context.archived ? 'yes' : 'no'}`,
    );
  }
  for (const argument of bundle.arguments) {
    sections.push(
      '',
      `## Argument — ${argument.title} (${argument.id})`,
      '',
      '### Examples',
      '',
      ...(argument.examples.length === 0
        ? ['None.']
        : argument.examples.map(
            (example, index) => `${index + 1}. [${example.id}] ${example.text}`,
          )),
      '',
      '### Premises',
      '',
      ...(argument.premises.length === 0
        ? ['None.']
        : argument.premises.map((premise, index) => {
            if (premise.kind === 'text') {
              return `${index + 1}. [${premise.id}] ${premise.text}${
                premise.exampleIds?.length
                  ? ` [Examples: ${premise.exampleIds.join(', ')}]`
                  : ''
              }`;
            }
            const reference =
              premise.kind === 'axiom'
                ? `Axiom ${premise.axiomId}`
                : premise.kind === 'argument-conclusion'
                  ? `Argument conclusion ${premise.argumentId}`
                  : `Argument premise ${premise.argumentId}.${premise.premiseId}`;
            return `${index + 1}. [${premise.id}] ${reference} @ relied-on revision ${premise.reliedOnRevision}${
              premise.exampleIds?.length
                ? ` [Local Examples: ${premise.exampleIds.join(', ')}]`
                : ''
            }`;
          })),
      ...prose('Reasoning', argument.reasoning),
      '',
      '### Conclusion',
      '',
      argument.conclusion,
      ...prose('Boundary / Invariance', argument.boundary),
      '',
      '### Argument relations',
      '',
      ...(argument.relations.length === 0
        ? ['None.']
        : argument.relations.map(
            (relation) =>
              `${relation.kind} ${relation.targetArgumentId}.${
                relation.targetPart.kind === 'premise'
                  ? `premise:${relation.targetPart.premiseId}`
                  : relation.targetPart.kind
              } @ relied-on revision ${relation.reliedOnRevision}`,
          )),
      '',
      `Human review state: ${argument.reviewState}`,
      `Archived: ${argument.archived ? 'yes' : 'no'}`,
      `Dependencies stale: ${argument.argumentStale ? 'yes' : 'no'}`,
      `Stale premise IDs: ${argument.stalePremiseIds.join(', ') || 'none'}`,
      `Stale relation IDs: ${argument.staleRelationIds.join(', ') || 'none'}`,
      ...premiseStaleness(argument.premiseStaleness),
      `Topic memberships: ${argument.topicIds.join(', ') || 'none'}`,
      `Current for Topics: ${argument.currentTopicIds.join(', ') || 'none'}`,
      `Attached Contexts (background, not premises): ${argument.contextIds.join(', ') || 'none'}`,
      `Effective background Axioms: ${
        argument.backgroundAxioms
          .map(
            ({ axiomId, viaContextIds }) =>
              `${axiomId} via ${viaContextIds.join('+')}`,
          )
          .join(', ') || 'none'
      }`,
      `Supersedes: ${argument.supersedesArgumentId ?? 'none'}`,
      `Superseded by: ${argument.supersededByArgumentIds.join(', ') || 'none'}`,
      `Targeting Counter-Arguments: ${argument.targetingCounterArgumentIds.join(', ') || 'none'}`,
      ...argument.sourceReferences.map(
        (source) =>
          `Source locator (not read): ${formatTheorySourceLocator(source)} [${source.role}; ${source.id}]`,
      ),
    );
  }
  for (const axiom of bundle.axioms) {
    sections.push(
      '',
      `## Axiom — ${axiom.title} (${axiom.id})`,
      '',
      axiom.statement,
      ...prose('Explanation', axiom.explanation),
      ...prose('Scope', axiom.scope),
      ...prose('Supporting reasoning', axiom.supportingReasoning),
      '',
      `Human review state: ${axiom.reviewState}`,
      `Archived: ${axiom.archived ? 'yes' : 'no'}`,
      `Linked Counter-Arguments: ${axiom.linkedCounterArgumentIds.join(', ') || 'none'}`,
      ...axiom.sourceReferences.map(
        (source) =>
          `Source locator (not read): ${formatTheorySourceLocator(source)} [${source.role}; ${source.id}]`,
      ),
    );
  }
  for (const counter of bundle.counterArguments) {
    sections.push(
      '',
      `## Counter-Argument — ${counter.title} (${counter.id})`,
      '',
      `Observation / example / argument: ${counter.observation}`,
      `What this is intended to challenge: ${counter.challengedClaim}`,
      `Structured target: ${target(counter.target)}`,
      `Answered using: ${
        counter.response.answeringAxioms
          .map(
            ({ axiomId, reliedOnRevision }) => `${axiomId}@${reliedOnRevision}`,
          )
          .join(', ') || 'none'
      }`,
      `Recorded response — why it applies: ${
        counter.response.explanation || 'No response recorded.'
      }`,
      `Current outcome: ${counter.response.outcome}`,
      `Human review state: ${counter.reviewState}`,
      `Archived: ${counter.archived ? 'yes' : 'no'}`,
      `Response stale: ${counter.responseStale ? 'yes' : 'no'}`,
      `Stale Axiom IDs: ${counter.staleAxiomIds.join(', ') || 'none'}`,
      ...prose('Boundary', counter.response.boundary),
      ...prose('Reopening condition', counter.response.reopeningCondition),
      ...counter.sourceReferences.map(
        (source) =>
          `Source locator (not read): ${formatTheorySourceLocator(source)} [${source.role}; ${source.id}]`,
      ),
    );
  }
  if (bundle.completeness.warnings.length > 0) {
    sections.push(
      '',
      '## Warnings',
      ...bundle.completeness.warnings.map((warning) => `- ${warning}`),
    );
  }
  sections.push(
    '',
    '## Consultation receipt',
    '',
    JSON.stringify(bundle.receipt, null, 2),
  );
  return {
    label: 'Argument-library context; linked theory source text not read',
    text: `${sections.join('\n')}\n`,
    structured: `${JSON.stringify(bundle, null, 2)}\n`,
    bundle,
  };
}

export function argumentBundleFailure(
  result: Exclude<ReadArgumentBundleResult, { status: 'ok' }>,
): string {
  if (result.status === 'limit-exceeded') {
    return `Complete context exceeds the configured limit: ${result.omissions.join(' ')}`;
  }
  if (result.status === 'snapshot-mismatch') {
    return 'The selected context belongs to a different library snapshot.';
  }
  if (result.status === 'invalid-request') return result.issues.join(' ');
  if (result.status === 'ambiguous-selector')
    return `Record ID is ambiguous across: ${result.kinds.join(', ')}.`;
  return `Record ${result.id} was not found.`;
}
