import type {
  EntityId,
  Reference,
  ReferenceId,
} from '@icarus-graph-explorer/core';

import {
  diagnosticTargetNodeId,
  entityNodeId,
  hierarchyEdgeId,
  referenceEdgeId,
} from './ids';
import type {
  DiagnosticReferenceStatus,
  ProjectedEntityNode,
  ProjectedNode,
  ProjectedReferenceEdge,
  ProjectedReferenceTargetNode,
  ReferenceResolutionStatus,
  ViewProjection,
  ViewProjectionValidationIssue,
  ViewProjectionValidationIssueCode,
  ViewProjectionValidationResult,
} from './types';
import type { ProjectionWorkspace } from './workspace';

type PlainRecord = Record<string, unknown>;

function isRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addIssue(
  issues: ViewProjectionValidationIssue[],
  code: ViewProjectionValidationIssueCode,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function sortedUniqueStrings(
  value: unknown,
  path: string,
  issues: ViewProjectionValidationIssue[],
): readonly string[] | undefined {
  if (!isStringArray(value)) {
    addIssue(issues, 'invalid-shape', path, 'Expected an array of strings.');
    return undefined;
  }
  const seen = new Set<string>();
  let hasDuplicate = false;
  let sorted = true;
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (item === undefined) continue;
    if (seen.has(item)) hasDuplicate = true;
    seen.add(item);
    const previous = value[index - 1];
    if (previous !== undefined && previous > item) sorted = false;
  }
  if (hasDuplicate) {
    addIssue(
      issues,
      'duplicate-provenance',
      path,
      'Array entries must be unique.',
    );
  }
  if (!sorted) {
    addIssue(issues, 'invalid-shape', path, 'Array entries must be sorted.');
  }
  return value;
}

function isStatus(value: unknown): value is ReferenceResolutionStatus {
  return (
    value === 'resolved' ||
    value === 'unresolved' ||
    value === 'ambiguous' ||
    value === 'invalid'
  );
}

function isDiagnosticStatus(
  value: unknown,
): value is DiagnosticReferenceStatus {
  return value === 'unresolved' || value === 'ambiguous' || value === 'invalid';
}

function checkCanonicalReferences(
  workspace: ProjectionWorkspace,
  referenceIds: readonly string[] | undefined,
  path: string,
  issues: ViewProjectionValidationIssue[],
): readonly Reference[] {
  if (referenceIds === undefined) return [];
  const references: Reference[] = [];
  for (const [index, referenceId] of referenceIds.entries()) {
    const reference = workspace.reference(referenceId);
    if (reference === undefined) {
      addIssue(
        issues,
        'missing-canonical-reference',
        `${path}[${index}]`,
        `Canonical reference "${referenceId}" does not exist.`,
      );
    } else {
      references.push(reference);
    }
  }
  return references;
}

function parseEntityNode(
  workspace: ProjectionWorkspace,
  value: PlainRecord,
  path: string,
  issues: ViewProjectionValidationIssue[],
): ProjectedEntityNode | undefined {
  const validShape =
    typeof value.id === 'string' &&
    typeof value.entityId === 'string' &&
    (value.entityKind === 'document' ||
      value.entityKind === 'section' ||
      value.entityKind === 'block') &&
    typeof value.sourcePath === 'string' &&
    typeof value.sourceStartLine === 'number' &&
    Number.isInteger(value.sourceStartLine) &&
    value.sourceStartLine >= 1 &&
    (typeof value.title === 'string' || value.title === null) &&
    typeof value.revealableDescendantCount === 'number' &&
    Number.isInteger(value.revealableDescendantCount) &&
    value.revealableDescendantCount >= 0 &&
    (value.role === 'content' || value.role === 'context') &&
    (value.focusDistance === null ||
      (typeof value.focusDistance === 'number' &&
        Number.isInteger(value.focusDistance) &&
        value.focusDistance >= 0 &&
        value.focusDistance <= 3));
  if (!validShape) {
    addIssue(issues, 'invalid-shape', path, 'Invalid projected entity node.');
    return undefined;
  }

  const referenceIds = sortedUniqueStrings(
    value.internalReferenceIds,
    `${path}.internalReferenceIds`,
    issues,
  );
  const canonical = workspace.entity(value.entityId as EntityId);
  if (canonical === undefined) {
    addIssue(
      issues,
      'missing-canonical-entity',
      `${path}.entityId`,
      `Canonical entity "${String(value.entityId)}" does not exist.`,
    );
  } else if (
    canonical.kind !== value.entityKind ||
    canonical.source.path !== value.sourcePath ||
    canonical.source.span.start.line !== value.sourceStartLine ||
    (canonical.kind === 'section' ? canonical.title : null) !== value.title
  ) {
    addIssue(
      issues,
      'missing-canonical-entity',
      path,
      'Projected entity metadata does not match its canonical entity.',
    );
  }
  if (value.id !== entityNodeId(value.entityId as EntityId)) {
    addIssue(
      issues,
      'invalid-shape',
      `${path}.id`,
      'Entity node ID is not canonical.',
    );
  }
  if (value.role === 'context' && value.focusDistance !== null) {
    addIssue(
      issues,
      'invalid-focus-metadata',
      `${path}.focusDistance`,
      'Context nodes cannot carry a focus distance.',
    );
  }
  for (const reference of checkCanonicalReferences(
    workspace,
    referenceIds,
    `${path}.internalReferenceIds`,
    issues,
  )) {
    if (reference.resolution.status !== 'resolved') {
      addIssue(
        issues,
        'invalid-reference-edge',
        `${path}.internalReferenceIds`,
        `Internal reference "${reference.id}" is not resolved.`,
      );
    }
  }
  return value as unknown as ProjectedEntityNode;
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function sortedById(values: readonly { readonly id: string }[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (
      previous !== undefined &&
      current !== undefined &&
      previous.id > current.id
    ) {
      return false;
    }
  }
  return true;
}

function parseDiagnosticNode(
  workspace: ProjectionWorkspace,
  value: PlainRecord,
  path: string,
  issues: ViewProjectionValidationIssue[],
): ProjectedReferenceTargetNode | undefined {
  if (
    typeof value.id !== 'string' ||
    !isDiagnosticStatus(value.status) ||
    typeof value.rawTarget !== 'string'
  ) {
    addIssue(issues, 'invalid-shape', path, 'Invalid diagnostic target node.');
    return undefined;
  }
  const referenceIds = sortedUniqueStrings(
    value.referenceIds,
    `${path}.referenceIds`,
    issues,
  );
  const candidateEntityIds = sortedUniqueStrings(
    value.candidateEntityIds,
    `${path}.candidateEntityIds`,
    issues,
  );
  sortedUniqueStrings(value.reasons, `${path}.reasons`, issues);
  if (referenceIds?.length === 0) {
    addIssue(
      issues,
      'invalid-diagnostic-target',
      `${path}.referenceIds`,
      'A diagnostic target must retain at least one reference.',
    );
  }
  if (
    (value.status === 'ambiguous' && (candidateEntityIds?.length ?? 0) < 2) ||
    (value.status !== 'ambiguous' && (candidateEntityIds?.length ?? 0) !== 0)
  ) {
    addIssue(
      issues,
      'invalid-diagnostic-target',
      `${path}.candidateEntityIds`,
      'Candidate IDs are required only for ambiguous diagnostic targets.',
    );
  }
  for (const [index, entityId] of (candidateEntityIds ?? []).entries()) {
    if (workspace.entity(entityId) === undefined) {
      addIssue(
        issues,
        'missing-canonical-entity',
        `${path}.candidateEntityIds[${index}]`,
        `Ambiguous candidate "${entityId}" does not exist.`,
      );
    }
  }
  for (const reference of checkCanonicalReferences(
    workspace,
    referenceIds,
    `${path}.referenceIds`,
    issues,
  )) {
    if (
      reference.resolution.status !== value.status ||
      reference.rawTarget !== value.rawTarget ||
      (reference.resolution.status === 'ambiguous' &&
        !sameStrings(
          [...reference.resolution.candidateEntityIds].sort(),
          candidateEntityIds ?? [],
        ))
    ) {
      addIssue(
        issues,
        'invalid-diagnostic-target',
        `${path}.referenceIds`,
        `Reference "${reference.id}" is incompatible with this diagnostic target.`,
      );
    }
  }
  return value as unknown as ProjectedReferenceTargetNode;
}

function parseNodes(
  workspace: ProjectionWorkspace,
  value: unknown,
  issues: ViewProjectionValidationIssue[],
): readonly ProjectedNode[] {
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid-shape', '$.nodes', 'Expected a node array.');
    return [];
  }
  const nodes: ProjectedNode[] = [];
  const ids = new Set<string>();
  for (const [index, candidate] of value.entries()) {
    const path = `$.nodes[${index}]`;
    if (!isRecord(candidate)) {
      addIssue(issues, 'invalid-shape', path, 'Expected a plain node object.');
      continue;
    }
    const parsed =
      candidate.kind === 'entity'
        ? parseEntityNode(workspace, candidate, path, issues)
        : candidate.kind === 'reference-target'
          ? parseDiagnosticNode(workspace, candidate, path, issues)
          : undefined;
    if (parsed === undefined) {
      if (
        candidate.kind !== 'entity' &&
        candidate.kind !== 'reference-target'
      ) {
        addIssue(issues, 'invalid-shape', `${path}.kind`, 'Unknown node kind.');
      }
      continue;
    }
    if (ids.has(parsed.id)) {
      addIssue(
        issues,
        'duplicate-node-id',
        `${path}.id`,
        `Node ID "${parsed.id}" is duplicated.`,
      );
    }
    ids.add(parsed.id);
    nodes.push(parsed);
  }
  if (!sortedById(nodes)) {
    addIssue(issues, 'invalid-shape', '$.nodes', 'Nodes must be sorted by ID.');
  }
  return nodes;
}

function parseEdges(
  workspace: ProjectionWorkspace,
  value: unknown,
  nodes: readonly ProjectedNode[],
  issues: ViewProjectionValidationIssue[],
): readonly ViewProjection['edges'][number][] {
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid-shape', '$.edges', 'Expected an edge array.');
    return [];
  }
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges: ViewProjection['edges'][number][] = [];
  const edgeIds = new Set<string>();
  const representedReferences = new Set<ReferenceId>();
  const incomingDiagnosticReferenceIds = new Map<string, ReferenceId[]>();
  const incomingDiagnosticSourceIds = new Map<string, Set<string>>();
  for (const node of nodes) {
    if (node.kind !== 'entity') continue;
    for (const referenceId of node.internalReferenceIds) {
      if (representedReferences.has(referenceId)) {
        addIssue(
          issues,
          'duplicate-provenance',
          '$.nodes',
          `Reference "${referenceId}" is represented more than once.`,
        );
      }
      representedReferences.add(referenceId);
    }
  }

  for (const [index, candidate] of value.entries()) {
    const path = `$.edges[${index}]`;
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== 'string' ||
      typeof candidate.sourceNodeId !== 'string' ||
      typeof candidate.targetNodeId !== 'string'
    ) {
      addIssue(issues, 'invalid-shape', path, 'Expected a plain edge object.');
      continue;
    }
    if (edgeIds.has(candidate.id)) {
      addIssue(
        issues,
        'duplicate-edge-id',
        `${path}.id`,
        `Edge ID "${candidate.id}" is duplicated.`,
      );
    }
    edgeIds.add(candidate.id);
    const source = nodesById.get(candidate.sourceNodeId);
    const target = nodesById.get(candidate.targetNodeId);
    if (source === undefined || target === undefined) {
      addIssue(
        issues,
        'missing-edge-endpoint',
        path,
        'Both edge endpoints must exist.',
      );
    }

    if (candidate.kind === 'hierarchy') {
      if (
        source?.kind !== 'entity' ||
        target?.kind !== 'entity' ||
        source.id === target.id ||
        candidate.id !==
          hierarchyEdgeId(candidate.sourceNodeId, candidate.targetNodeId)
      ) {
        addIssue(
          issues,
          'invalid-hierarchy-edge',
          path,
          'Hierarchy edges must connect two distinct entity nodes with a canonical ID.',
        );
      }
      edges.push(candidate as unknown as ViewProjection['edges'][number]);
      continue;
    }

    if (candidate.kind !== 'reference' || !isStatus(candidate.status)) {
      addIssue(
        issues,
        'invalid-shape',
        path,
        'Unknown edge kind or reference status.',
      );
      continue;
    }
    const referenceIds = sortedUniqueStrings(
      candidate.referenceIds,
      `${path}.referenceIds`,
      issues,
    );
    if ((referenceIds?.length ?? 0) === 0) {
      addIssue(
        issues,
        'invalid-reference-edge',
        `${path}.referenceIds`,
        'A reference edge must retain provenance.',
      );
    }
    if (
      source?.kind !== 'entity' ||
      source.id === target?.id ||
      candidate.id !==
        referenceEdgeId(
          candidate.sourceNodeId,
          candidate.targetNodeId,
          candidate.status,
        ) ||
      (target?.kind === 'reference-target' &&
        target.status !== candidate.status) ||
      (target?.kind === 'entity' && candidate.status !== 'resolved')
    ) {
      addIssue(
        issues,
        'invalid-reference-edge',
        path,
        'Reference edge endpoints/status/ID are inconsistent.',
      );
    }
    for (const reference of checkCanonicalReferences(
      workspace,
      referenceIds,
      `${path}.referenceIds`,
      issues,
    )) {
      if (reference.resolution.status !== candidate.status) {
        addIssue(
          issues,
          'invalid-reference-edge',
          `${path}.referenceIds`,
          `Reference "${reference.id}" has a different canonical status.`,
        );
      }
      if (representedReferences.has(reference.id)) {
        addIssue(
          issues,
          'duplicate-provenance',
          `${path}.referenceIds`,
          `Reference "${reference.id}" is represented more than once.`,
        );
      }
      representedReferences.add(reference.id);
    }
    if (target?.kind === 'reference-target') {
      const incomingIds = incomingDiagnosticReferenceIds.get(target.id) ?? [];
      incomingIds.push(...(referenceIds ?? []));
      incomingDiagnosticReferenceIds.set(target.id, incomingIds);
      const sources = incomingDiagnosticSourceIds.get(target.id) ?? new Set();
      sources.add(candidate.sourceNodeId);
      incomingDiagnosticSourceIds.set(target.id, sources);
    }
    edges.push(candidate as unknown as ProjectedReferenceEdge);
  }
  if (!sortedById(edges)) {
    addIssue(issues, 'invalid-shape', '$.edges', 'Edges must be sorted by ID.');
  }

  for (const node of nodes) {
    if (node.kind !== 'reference-target') continue;
    const incomingReferenceIds =
      incomingDiagnosticReferenceIds.get(node.id) ?? [];
    if (!sameStrings([...incomingReferenceIds].sort(), node.referenceIds)) {
      addIssue(
        issues,
        'invalid-diagnostic-target',
        '$.nodes',
        `Diagnostic target "${node.id}" must mirror its incoming edge provenance.`,
      );
    }
    const incomingSources = incomingDiagnosticSourceIds.get(node.id);
    const incomingSourceId =
      incomingSources?.size === 1 ? [...incomingSources][0] : undefined;
    if (
      incomingSourceId === undefined ||
      node.id !==
        diagnosticTargetNodeId(
          incomingSourceId,
          node.status,
          node.rawTarget,
          node.candidateEntityIds,
        )
    ) {
      addIssue(
        issues,
        'invalid-diagnostic-target',
        '$.nodes',
        `Diagnostic target "${node.id}" has an inconsistent source-scoped ID.`,
      );
    }
  }
  return edges;
}

/** Validate deserialized projection data against its canonical workspace. */
export function validateViewProjection(
  workspace: ProjectionWorkspace,
  value: unknown,
): ViewProjectionValidationResult {
  const issues: ViewProjectionValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [
        {
          code: 'invalid-shape',
          path: '$',
          message: 'Expected a projection object.',
        },
      ],
    };
  }
  const nodes = parseNodes(workspace, value.nodes, issues);
  const edges = parseEdges(workspace, value.edges, nodes, issues);
  if (
    !Array.isArray(value.issues) ||
    !value.issues.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.code === 'string' &&
        typeof entry.subject === 'string' &&
        typeof entry.message === 'string',
    )
  ) {
    addIssue(
      issues,
      'invalid-shape',
      '$.issues',
      'Expected a projection issue array.',
    );
  }
  if (issues.length > 0) return { valid: false, issues };
  return {
    valid: true,
    value: { nodes, edges, issues: value.issues as ViewProjection['issues'] },
    issues: [],
  };
}
