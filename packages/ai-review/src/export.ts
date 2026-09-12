import { exportReviewRunJson } from './repository';
import type {
  ReviewAttemptRecord,
  ReviewRunRecord,
  ReviewStage,
} from './types';

const STAGE_LABELS: Record<ReviewStage, string> = {
  negative: 'Negative analysis',
  positive: 'Positive analysis',
  integrator: 'Integration',
  'post-check': 'Compiler-aware post-check',
};

function attemptMarkdown(attempt: ReviewAttemptRecord): string {
  const current = attempt.current ? 'current' : 'historical';
  const lines = [
    `## ${STAGE_LABELS[attempt.stage]} — attempt ${attempt.number}`,
    '',
    `- Attempt ID: \`${attempt.id}\``,
    `- State: ${attempt.state} (${current})`,
    `- Model: ${attempt.model.provider} / ${attempt.model.model}`,
    `- Dependencies: ${attempt.dependsOn.join(', ') || 'none'}`,
    `- Tools available: ${attempt.toolsAvailable.join(', ') || 'none'}`,
    `- Records retrieved: ${
      attempt.recordsRetrieved
        .map((reference) => `${reference.canonicalId}@${reference.revision}`)
        .join(', ') || 'none'
    }`,
    `- Usage: ${
      attempt.usage
        ? JSON.stringify(attempt.usage)
        : 'unavailable (not recorded as zero)'
    }`,
  ];
  if (attempt.error) {
    lines.push(`- Error: ${attempt.error.code} — ${attempt.error.message}`);
  }
  lines.push('', '### Rendered instructions', '', attempt.prompt.text);
  if (attempt.output) {
    lines.push(
      '',
      '### Raw output',
      '',
      attempt.output.rawMarkdown,
      '',
      `Structured output: ${attempt.output.structuredStatus}`,
    );
    if (attempt.output.validationErrors.length > 0) {
      lines.push(
        '',
        ...attempt.output.validationErrors.map((error) => `- ${error}`),
      );
    }
  } else {
    lines.push('', '_No output was retained for this attempt._');
  }
  return lines.join('\n');
}

export function exportReviewRunMarkdown(run: ReviewRunRecord): string {
  const source = run.frozenInput.source;
  const lines = [
    '# AI Review run',
    '',
    '> Scripted providers and synthetic compiler records, when used, are test data—not real AI conclusions or verified theory facts.',
    '',
    '## Request scope and frozen source',
    '',
    `- Run ID: \`${run.id}\``,
    `- State: ${run.state}`,
    `- Input fingerprint: \`${run.frozenInput.fingerprint}\``,
    `- Workspace identity: ${run.frozenInput.workspaceId}`,
    `- Source mode: ${source.mode}`,
    `- Completeness: ${source.completeness}`,
    `- Selected paths: ${source.selectedPaths.join(', ')}`,
    `- Missing material: ${source.missingMaterial.join('; ') || 'none declared'}`,
    `- Omissions: ${source.omissions.join('; ') || 'none declared'}`,
  ];
  if (source.mode === 'captured-git-history') {
    lines.push(
      `- Git base/head: ${source.baseCommitId} / ${source.headCommitId}`,
      `- Commits (${source.commitCount}): ${source.commitIds.join(', ')}`,
    );
  }
  lines.push(
    '',
    '### Additional request',
    '',
    run.frozenInput.additionalRequest || '_No additional request supplied._',
    '',
    '### Source material',
    '',
    run.frozenInput.sharedMaterial,
    '',
    '## Configuration',
    '',
    `- Common template: ${run.templates.common.version}`,
    `- Analysis template: ${run.templates.analysis.version}`,
    `- Integrator template: ${run.templates.integrator.version}`,
    `- Post-check template: ${run.templates.postCheck.version}`,
    `- Compiler snapshot: ${
      run.compilerBinding.descriptor
        ? `${run.compilerBinding.descriptor.snapshotId}@${run.compilerBinding.descriptor.revision}`
        : run.compilerBinding.requested
          ? `unavailable — ${run.compilerBinding.error?.message ?? 'unknown error'}`
          : 'not requested'
    }`,
    '',
    '# Attempts',
    '',
    run.attempts.map(attemptMarkdown).join('\n\n---\n\n'),
    '',
    '> This export is a static record. It is not a renderer, live provider session, or Obsidian synchronization mechanism.',
    '',
  );
  return lines.join('\n');
}

export { exportReviewRunJson };
