import type {
  AddressableEntity,
  EntityId,
  KnowledgeSnapshot,
  SectionEntity,
} from '@icarus-graph-explorer/core';

import type { ObsidianDiagnosticReport } from './types';

export interface DiagnosticReportSummary {
  readonly documents: number;
  readonly sections: number;
  readonly blocks: number;
  readonly references: number;
  readonly resolved: number;
  readonly unresolved: number;
  readonly ambiguous: number;
  readonly invalid: number;
  readonly warningDiagnostics: number;
  readonly errorDiagnostics: number;
  readonly compatibilityProbes: number;
}

export interface DiagnosticLookups {
  readonly entityById: ReadonlyMap<EntityId, AddressableEntity>;
  readonly childrenByParentId: ReadonlyMap<
    EntityId,
    readonly AddressableEntity[]
  >;
  readonly labelByEntityId: ReadonlyMap<EntityId, string>;
}

function entityOrder(
  left: AddressableEntity,
  right: AddressableEntity,
): number {
  if (left.source.path !== right.source.path) {
    return left.source.path < right.source.path ? -1 : 1;
  }
  return (
    (left.source.span.start.offset ?? 0) - (right.source.span.start.offset ?? 0)
  );
}

export function createDiagnosticLookups(
  snapshot: KnowledgeSnapshot,
): DiagnosticLookups {
  const entityById = new Map(
    snapshot.entities.map((entity) => [entity.id, entity]),
  );
  const children = new Map<EntityId, AddressableEntity[]>();
  for (const entity of snapshot.entities) {
    if (entity.kind === 'document') continue;
    const existing = children.get(entity.parentId);
    if (existing === undefined) children.set(entity.parentId, [entity]);
    else existing.push(entity);
  }
  for (const values of children.values()) values.sort(entityOrder);

  const labels = new Map<EntityId, string>();
  function sectionBreadcrumb(section: SectionEntity): readonly string[] {
    const result = [section.title];
    let parent = entityById.get(section.parentId);
    while (parent?.kind === 'section') {
      result.unshift(parent.title);
      parent = entityById.get(parent.parentId);
    }
    return result;
  }
  for (const entity of snapshot.entities) {
    if (entity.kind === 'document') {
      labels.set(entity.id, `Document: ${entity.source.path}`);
    } else if (entity.kind === 'section') {
      labels.set(
        entity.id,
        `Section: ${entity.source.path} / ${sectionBreadcrumb(entity).join(' / ')}`,
      );
    } else {
      labels.set(
        entity.id,
        `Block: ${entity.source.path} / marker at line ${entity.source.span.start.line}`,
      );
    }
  }
  return {
    entityById,
    childrenByParentId: children,
    labelByEntityId: labels,
  };
}

export function summarizeDiagnosticReport(
  report: ObsidianDiagnosticReport,
): DiagnosticReportSummary {
  let documents = 0;
  let sections = 0;
  let blocks = 0;
  let resolved = 0;
  let unresolved = 0;
  let ambiguous = 0;
  let invalid = 0;
  let warningDiagnostics = 0;
  let errorDiagnostics = 0;
  for (const entity of report.snapshot.entities) {
    if (entity.kind === 'document') documents += 1;
    else if (entity.kind === 'section') sections += 1;
    else blocks += 1;
  }
  for (const reference of report.snapshot.references) {
    if (reference.resolution.status === 'resolved') resolved += 1;
    else if (reference.resolution.status === 'unresolved') unresolved += 1;
    else if (reference.resolution.status === 'ambiguous') ambiguous += 1;
    else invalid += 1;
  }
  for (const diagnostic of report.diagnostics) {
    if (diagnostic.severity === 'warning') warningDiagnostics += 1;
    else errorDiagnostics += 1;
  }
  return {
    documents,
    sections,
    blocks,
    references: report.snapshot.references.length,
    resolved,
    unresolved,
    ambiguous,
    invalid,
    warningDiagnostics,
    errorDiagnostics,
    compatibilityProbes: report.probes.length,
  };
}
