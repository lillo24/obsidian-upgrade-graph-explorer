import { validateKnowledgeSnapshot } from '@icarus-graph-explorer/core';

import { buildCompatibilityProbes } from './probes';
import {
  OBSIDIAN_DIAGNOSTIC_REPORT_SCHEMA_VERSION,
  type BuildObsidianDiagnosticReportInput,
  type ObsidianDiagnosticReport,
} from './types';
import { validateObsidianDiagnosticReport } from './validation';

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Build deterministic, serializable KG5 evidence without source text. */
export function buildObsidianDiagnosticReport(
  input: BuildObsidianDiagnosticReportInput,
): ObsidianDiagnosticReport {
  const snapshotValidation = validateKnowledgeSnapshot(input.snapshot);
  if (!snapshotValidation.valid) {
    throw new Error(
      `Cannot build diagnostic report from invalid snapshot: ${snapshotValidation.issues[0]?.message ?? 'unknown validation failure'}`,
    );
  }
  const nonMarkdownPaths = [...(input.nonMarkdownPaths ?? [])].sort(
    compareText,
  );
  const diagnostics = [...input.diagnostics].sort(
    (left, right) =>
      compareText(left.sourcePath ?? '', right.sourcePath ?? '') ||
      (left.sourceSpan?.start.offset ?? -1) -
        (right.sourceSpan?.start.offset ?? -1) ||
      compareText(left.code, right.code) ||
      compareText(left.message, right.message),
  );
  const candidate: ObsidianDiagnosticReport = {
    schemaVersion: OBSIDIAN_DIAGNOSTIC_REPORT_SCHEMA_VERSION,
    snapshot: snapshotValidation.value,
    diagnostics,
    probes: buildCompatibilityProbes(
      snapshotValidation.value,
      input.documents,
      nonMarkdownPaths,
    ),
    sourceInventory: {
      markdownFileCount: input.documents.length,
      nonMarkdownFileCount: nonMarkdownPaths.length,
    },
    identity: input.identity,
    ...(input.timings === undefined ? {} : { timings: input.timings }),
  };
  const reportValidation = validateObsidianDiagnosticReport(candidate);
  if (!reportValidation.valid) {
    throw new Error(
      `Constructed diagnostic report failed validation at ${reportValidation.issues[0]?.path ?? '$'}: ${reportValidation.issues[0]?.message ?? 'unknown validation failure'}`,
    );
  }
  return reportValidation.value;
}
