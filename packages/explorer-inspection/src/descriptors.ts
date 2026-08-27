import type {
  AddressableEntity,
  Reference,
  SourceSpan,
} from '@icarus-graph-explorer/core';

import type {
  BreadcrumbPart,
  EntityDescriptor,
  OccurrenceResolutionDescriptor,
  ReferenceOccurrenceDescriptor,
} from './types';
import type { InspectionWorkspace } from './workspace';

function documentName(path: string): string {
  const name = path.split('/').at(-1) ?? path;
  return name.toLocaleLowerCase('en-US').endsWith('.md')
    ? name.slice(0, -3)
    : name;
}

export function entityDisplayName(entity: AddressableEntity): string {
  if (entity.kind === 'document') return documentName(entity.source.path);
  if (entity.kind === 'block') {
    return `Block at line ${entity.source.span.start.line}`;
  }
  const title = entity.title.trim();
  return title.length === 0
    ? `Untitled Section at line ${entity.source.span.start.line}`
    : title;
}

function breadcrumbLabel(entity: AddressableEntity): string {
  return entity.kind === 'document'
    ? entity.source.path
    : entityDisplayName(entity);
}

export function formatSourceProvenance(path: string, span: SourceSpan): string {
  return `${path} · L${span.start.line}:C${span.start.column}–L${span.end.line}:C${span.end.column}`;
}

export function describeEntity(
  workspace: InspectionWorkspace,
  entityId: string,
): EntityDescriptor {
  const entity = workspace.requireEntity(entityId);
  const breadcrumb: BreadcrumbPart[] = workspace
    .ancestors(entity.id)
    .map((ancestor) => ({
      entityId: ancestor.id,
      kind: ancestor.kind,
      label: breadcrumbLabel(ancestor),
    }));
  return {
    entityId: entity.id,
    kind: entity.kind,
    displayName: entityDisplayName(entity),
    sourcePath: entity.source.path,
    sourceSpan: entity.source.span,
    sourceProvenance: formatSourceProvenance(
      entity.source.path,
      entity.source.span,
    ),
    breadcrumb,
  };
}

function describeResolution(
  workspace: InspectionWorkspace,
  reference: Reference,
): OccurrenceResolutionDescriptor {
  const resolution = reference.resolution;
  switch (resolution.status) {
    case 'resolved':
      return {
        status: 'resolved',
        target: describeEntity(workspace, resolution.targetEntityId),
        candidates: [],
        reason: null,
      };
    case 'unresolved':
      return {
        status: 'unresolved',
        target: null,
        candidates: [],
        reason: resolution.reason ?? null,
      };
    case 'ambiguous':
      return {
        status: 'ambiguous',
        target: null,
        candidates: resolution.candidateEntityIds
          .map((entityId) => describeEntity(workspace, entityId))
          .sort(
            (left, right) =>
              left.sourcePath.localeCompare(right.sourcePath) ||
              left.sourceSpan.start.line - right.sourceSpan.start.line ||
              left.sourceSpan.start.column - right.sourceSpan.start.column ||
              left.entityId.localeCompare(right.entityId),
          ),
        reason: resolution.reason ?? null,
      };
    case 'invalid':
      return {
        status: 'invalid',
        target: null,
        candidates: [],
        reason: resolution.reason,
      };
  }
}

export function describeReference(
  workspace: InspectionWorkspace,
  referenceId: string,
): ReferenceOccurrenceDescriptor {
  const reference = workspace.requireReference(referenceId);
  return {
    referenceId: reference.id,
    kind: reference.kind,
    source: describeEntity(workspace, reference.sourceEntityId),
    sourceSpan: reference.sourceSpan,
    sourceProvenance: formatSourceProvenance(
      workspace.requireEntity(reference.sourceEntityId).source.path,
      reference.sourceSpan,
    ),
    rawTarget: reference.rawTarget,
    status: reference.resolution.status,
    resolution: describeResolution(workspace, reference),
  };
}
