import type {
  DiagnosticLookups,
  ObsidianDiagnosticReport,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import type { Reference } from '@icarus-graph-explorer/core';

export type ResolutionFilter =
  'all' | 'resolved' | 'unresolved' | 'ambiguous' | 'invalid';

export interface ReferenceView {
  readonly reference: Reference;
  readonly sourcePath: string;
  readonly sourceLabel: string;
  readonly targetLabels: readonly string[];
  readonly searchText: string;
}

function targetIds(reference: Reference): readonly string[] {
  const resolution = reference.resolution;
  if (resolution.status === 'resolved') return [resolution.targetEntityId];
  if (resolution.status === 'ambiguous') return resolution.candidateEntityIds;
  return [];
}

export function buildReferenceViews(
  report: ObsidianDiagnosticReport,
  lookups: DiagnosticLookups,
): readonly ReferenceView[] {
  return report.snapshot.references.map((reference) => {
    const source = lookups.entityById.get(reference.sourceEntityId);
    const sourcePath = source?.source.path ?? 'Unknown source';
    const sourceLabel =
      lookups.labelByEntityId.get(reference.sourceEntityId) ??
      reference.sourceEntityId;
    const targetLabels = targetIds(reference).map(
      (id) => lookups.labelByEntityId.get(id) ?? id,
    );
    return {
      reference,
      sourcePath,
      sourceLabel,
      targetLabels,
      searchText: [
        sourcePath,
        sourceLabel,
        reference.rawTarget,
        ...targetLabels,
      ]
        .join('\n')
        .toLocaleLowerCase('en-US'),
    };
  });
}

export function filterReferenceViews(
  views: readonly ReferenceView[],
  status: ResolutionFilter,
  query: string,
): readonly ReferenceView[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('en-US');
  return views.filter(
    ({ reference, searchText }) =>
      (status === 'all' || reference.resolution.status === status) &&
      (normalizedQuery.length === 0 || searchText.includes(normalizedQuery)),
  );
}

export function matchingHierarchyDocumentIds(
  report: ObsidianDiagnosticReport,
  lookups: DiagnosticLookups,
  query: string,
): readonly string[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('en-US');
  const matchingPaths = new Set(
    report.snapshot.entities
      .filter((entity) => {
        if (normalizedQuery.length === 0) return true;
        const label = lookups.labelByEntityId.get(entity.id) ?? '';
        return label.toLocaleLowerCase('en-US').includes(normalizedQuery);
      })
      .map(({ source }) => source.path),
  );
  return report.snapshot.entities
    .filter(
      (entity) =>
        entity.kind === 'document' && matchingPaths.has(entity.source.path),
    )
    .map(({ id }) => id);
}
