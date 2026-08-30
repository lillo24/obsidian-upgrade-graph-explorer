import type {
  ProjectedEntityNode,
  ProjectedNode,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import type {
  GlobalEdgeAttributes,
  GlobalNodeAttributes,
  GlobalReferenceStatus,
  GlobalRendererInput,
} from './types';

const STATUS_COLORS = {
  resolved: '#6f8792',
  unresolved: '#c18a22',
  ambiguous: '#bd6725',
  invalid: '#b34853',
} as const satisfies Record<GlobalReferenceStatus, string>;

function hash32(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function unitFromHash(value: string, seed: number): number {
  return hash32(value, seed) / 0xffff_ffff;
}

/** Deterministic benchmark/layout seed only; never persisted as knowledge truth. */
export function deterministicPosition(key: string): {
  readonly x: number;
  readonly y: number;
} {
  const angle = unitFromHash(key, 2_166_136_261) * Math.PI * 2;
  const radius = 0.12 + Math.sqrt(unitFromHash(key, 1_013_904_223)) * 0.88;
  return {
    x: Number((Math.cos(angle) * radius).toFixed(6)),
    y: Number((Math.sin(angle) * radius).toFixed(6)),
  };
}

function entityLabel(node: ProjectedEntityNode): string {
  if (node.title !== null) return node.title;
  const segments = node.sourcePath.split('/');
  return segments.at(-1) ?? node.sourcePath;
}

function nodeAttributes(node: ProjectedNode): GlobalNodeAttributes {
  const position = deterministicPosition(node.id);
  if (node.kind === 'reference-target') {
    return {
      ...position,
      size: 2.5,
      color: STATUS_COLORS[node.status],
      label: node.rawTarget,
      nodeKind: 'diagnostic',
      entityId: null,
      sourcePath: null,
      status: node.status,
      revealableDescendantCount: 0,
    };
  }
  const size =
    node.entityKind === 'document'
      ? 4.5 + Math.min(5, Math.log2(node.revealableDescendantCount + 1))
      : node.entityKind === 'section'
        ? 3.25
        : 2.5;
  const color =
    node.role === 'context'
      ? '#97a8af'
      : node.entityKind === 'document'
        ? '#1f6f8b'
        : node.entityKind === 'section'
          ? '#6b6294'
          : '#90733d';
  return {
    ...position,
    size,
    color,
    label: entityLabel(node),
    nodeKind: node.entityKind,
    entityId: node.entityId,
    sourcePath: node.sourcePath,
    status: null,
    revealableDescendantCount: node.revealableDescendantCount,
  };
}

function edgeAttributes(
  edge: ViewProjection['edges'][number],
): GlobalEdgeAttributes {
  if (edge.kind === 'hierarchy') {
    return {
      size: 0.6,
      color: '#b7c2c7',
      edgeKind: 'hierarchy',
      status: 'resolved',
      referenceCount: 0,
    };
  }
  return {
    size: 0.45 + Math.min(2.75, Math.log2(edge.referenceIds.length + 1) * 0.55),
    color: STATUS_COLORS[edge.status],
    edgeKind: 'reference',
    status: edge.status,
    referenceCount: edge.referenceIds.length,
  };
}

export function mapProjectionToGlobal(
  projection: ViewProjection,
): GlobalRendererInput {
  const nodeIds = new Set<string>();
  const nodes = projection.nodes.map((node) => {
    if (nodeIds.has(node.id)) {
      throw new Error(
        `Global renderer input has duplicate node ID ${node.id}.`,
      );
    }
    nodeIds.add(node.id);
    return { key: node.id, attributes: nodeAttributes(node) };
  });
  const edgeIds = new Set<string>();
  const edges = projection.edges.map((edge) => {
    if (edgeIds.has(edge.id)) {
      throw new Error(
        `Global renderer input has duplicate edge ID ${edge.id}.`,
      );
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      throw new Error(
        `Global renderer edge ${edge.id} references a missing endpoint.`,
      );
    }
    return {
      key: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      attributes: edgeAttributes(edge),
    };
  });
  return { nodes, edges, projectionIssues: projection.issues };
}

export function resetDeterministicPositions(
  input: GlobalRendererInput,
): GlobalRendererInput {
  return {
    ...input,
    nodes: input.nodes.map((node) => ({
      ...node,
      attributes: {
        ...node.attributes,
        ...deterministicPosition(node.key),
      },
    })),
  };
}
