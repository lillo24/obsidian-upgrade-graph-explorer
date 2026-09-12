import type {
  ArgumentBundle,
  ReadArgumentBundleResult,
} from '@icarus-graph-explorer/argument-workspace';

export interface ArgumentContextExport {
  readonly label: string;
  readonly text: string;
  readonly structured: string;
}

function line(label: string, value: string | undefined): readonly string[] {
  return value === undefined || value === '' ? [] : [`${label}: ${value}`];
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
    );
  }
  for (const axiom of bundle.axioms) {
    sections.push(
      '',
      `## Axiom — ${axiom.title} (${axiom.id})`,
      '',
      axiom.statement,
      ...line('Explanation', axiom.explanation),
      ...line('Scope', axiom.scope),
      `Human review state: ${axiom.reviewState}`,
      ...axiom.sourceReferences.map(
        (source) =>
          `Source locator (not read): ${source.originalWikilink ?? source.path}${
            source.heading === undefined ? '' : `#${source.heading}`
          } [${source.role}]`,
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
      `Response stale: ${counter.responseStale ? 'yes' : 'no'}`,
      ...line('Boundary', counter.response.boundary),
      ...line('Reopening condition', counter.response.reopeningCondition),
      ...counter.sourceReferences.map(
        (source) =>
          `Source locator (not read): ${source.originalWikilink ?? source.path}${
            source.heading === undefined ? '' : `#${source.heading}`
          } [${source.role}]`,
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
